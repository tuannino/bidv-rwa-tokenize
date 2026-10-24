import 'server-only';

import { randomUUID } from 'node:crypto';
import { isChainKey, type ChainKey, type TxResult } from '@bidv/shared';
import { z } from 'zod';
import { serverEnv } from '@/lib/config/env';
import { getLedger, LedgerError, LedgerNotImplementedError, receiptTimeoutFor } from '@/lib/ledger';
import { assertCan, can, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import {
  getDistributionStore, getProjectStore, getSettlementStore, getStore, getVaultStore,
  UniqueConstraintError, type NewAudit, type ProjectRecord, type SettlementCaseRecord,
  type SettlementRoundRecord, type TxnRecord,
} from '@/lib/store';
import { authorize, toResult } from './authorize';
import { countInFlightOrders } from './config.service';
import { submitTxn } from './issuance.service';
import { addDays, daysBetween, isCalendarDate, recallPhaseOf, todayVn, type RecallPhase } from './recall-phase';
import { err, ok, type Result } from './result';

export const RECALL_BATCH_SIZE = 10;
export const RECALL_STUCK_MINUTES = 10;
const RECALL_STUCK_MS = RECALL_STUCK_MINUTES * 60_000;
const CHAIN_SCHEMA = z.string().refine(isChainKey, 'Chain không hợp lệ.').transform((value) => value as ChainKey);
const REASON_SCHEMA = z.string().trim().min(5, 'Lý do phải có ít nhất 5 ký tự.').max(200, 'Lý do tối đa 200 ký tự.');

const openSchema = z.object({ chain: CHAIN_SCHEMA, maturityDate: z.string(), noticeDays: z.coerce.number().int(), reason: REASON_SCHEMA });
const roundSchema = z.object({ chain: CHAIN_SCHEMA, roundId: z.string().uuid() });
const cancelRoundSchema = roundSchema.extend({ reason: REASON_SCHEMA });
const confirmSchema = z.object({ chain: CHAIN_SCHEMA, roundId: z.string().uuid(), confirmSymbol: z.string().trim() });
const unfreezeSchema = confirmSchema.extend({ reason: REASON_SCHEMA });
const rescheduleSchema = openSchema.extend({ roundId: z.string().uuid() });

function validation<T>(parsed: { success: true; data: T } | { success: false; error: z.ZodError }): Result<T> {
  return parsed.success ? ok(parsed.data) : err('VALIDATION', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
}

export function validateRecallDates(input: {
  chain: ChainKey; maturityDate: string; noticeDays: number; today: string; demo: boolean;
}): { maturityDate: string; recallFrom: string; noticeDays: number } {
  if (!isCalendarDate(input.maturityDate)) throw new Error('Ngày hết hạn không có thật hoặc không theo dạng YYYY-MM-DD.');
  if (input.maturityDate < input.today) throw new Error('Ngày hết hạn không được trước hôm nay.');
  if (!Number.isInteger(input.noticeDays) || input.noticeDays < 0 || input.noticeDays > 365) {
    throw new Error('Số ngày báo trước phải là số nguyên từ 0 đến 365.');
  }
  if (input.noticeDays === 0 && !input.demo && input.chain !== 'mock' && input.chain !== 'hardhat-local') {
    throw new Error('Chain này cần ít nhất 1 ngày báo trước; chỉ mock, hardhat-local hoặc chế độ trình diễn cho phép 0 ngày.');
  }
  return { maturityDate: input.maturityDate, noticeDays: input.noticeDays, recallFrom: addDays(input.maturityDate, input.noticeDays) };
}

async function projectFor(chain: ChainKey, projectId?: string | null): Promise<ProjectRecord | null> {
  const rows = await getProjectStore().listProjects({ chain, limit: 50 });
  return projectId ? rows.find((row) => row.id === projectId) ?? null : rows.find((row) => row.status === 'ISSUED') ?? rows[0] ?? null;
}

async function settlementModeOrUnknown(chain: ChainKey): Promise<boolean | null> {
  try { return await getLedger(chain).isSettlementMode(); }
  catch (error) { if (error instanceof LedgerNotImplementedError) return null; throw error; }
}

export async function readRecallPhase(chain: ChainKey): Promise<RecallPhase> {
  const store = getSettlementStore();
  const round = await store.findActiveRound(chain) ?? await store.latestRecallRound(chain);
  const project = await projectFor(chain, round?.projectId);
  return recallPhaseOf(round, project, todayVn());
}

function successAudit(role: Role, action: 'settlement:initiate' | 'settlement:recall', target: string, chain: ChainKey, detail: string): NewAudit {
  return { actorRole: role, action, target, outcome: 'SUCCESS', detail, chain };
}

function recallBudget(chain: ChainKey): number { return receiptTimeoutFor(chain) + 60_000; }

async function withRecallLock<T>(chain: ChainKey, role: Role, body: () => Promise<Result<T>>): Promise<Result<T>> {
  const refId = randomUUID();
  const budget = recallBudget(chain);
  const actor = await currentActorId(role);
  const lock = await getVaultStore().acquireOperationLock({
    chain, kind: 'RECALL', refId, actor,
    takeOverRecallBefore: new Date(Date.now() - budget - 120_000),
  });
  if (!lock) return err('REQUEST_STATE', 'Đang có thao tác khác trên chain; vui lòng chờ thao tác đó kết thúc.');
  try { return await body(); }
  finally { await getVaultStore().releaseOperationLock({ chain, refId }); }
}

function roundMatches(round: SettlementRoundRecord | null, id: string, status?: SettlementRoundRecord['status']): round is SettlementRoundRecord {
  return Boolean(round && round.id === id && (!status || round.status === status));
}

export async function openRecall(input: unknown): Promise<Result<SettlementRoundRecord>> {
  const parsed = openSchema.safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  const { chain, reason } = checked.data;
  try {
    const role = await authorize('settlement:initiate', chain, chain);
    let dates;
    try { dates = validateRecallDates({ ...checked.data, today: todayVn(), demo: serverEnv().enableDemoRecall }); }
    catch (error) { return err('VALIDATION', error instanceof Error ? error.message : 'Mốc thu hồi không hợp lệ.'); }
    const project = await projectFor(chain);
    if (!project || project.status !== 'ISSUED') return err('REQUEST_STATE', 'Dự án trên chain phải ở trạng thái ISSUED trước khi mở đợt thu hồi.');
    const openedBy = await currentActorId(role);
    try { return ok(await getSettlementStore().openRecallRound({ chain, projectId: project.id, ...dates, openedBy, reason })); }
    catch (error) { if (error instanceof UniqueConstraintError) return err('REQUEST_STATE', 'Chain đã có một đợt thu hồi chưa kết thúc.'); throw error; }
  } catch (error) { return toResult(error); }
}

export async function cancelRecall(input: unknown): Promise<Result<SettlementRoundRecord>> {
  const parsed = cancelRoundSchema.safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await authorize('settlement:initiate', checked.data.roundId, checked.data.chain);
    return withRecallLock(checked.data.chain, role, async () => {
      const round = await getSettlementStore().findActiveRound(checked.data.chain);
      if (!roundMatches(round, checked.data.roundId, 'INITIATED') || round.freezeRequestedAt) return err('REQUEST_STATE', 'Đợt không còn ở trạng thái có thể huỷ.');
      if (await getLedger(checked.data.chain).isSettlementMode()) return err('REQUEST_STATE', 'Token đang đóng băng trên chuỗi; không thể huỷ đợt.');
      const updated = await getSettlementStore().cancelRound({ id: round.id, cancelledAt: new Date().toISOString(), audit: successAudit(role, 'settlement:initiate', round.id, checked.data.chain, checked.data.reason ?? 'Huỷ đợt thu hồi.') });
      return updated ? ok(updated) : err('REQUEST_STATE', 'Đợt vừa được thao tác khác xử lý.');
    });
  } catch (error) { return toResult(error); }
}

export async function rescheduleRecall(input: unknown): Promise<Result<SettlementRoundRecord>> {
  const parsed = rescheduleSchema.safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await authorize('settlement:initiate', checked.data.roundId, checked.data.chain);
    let dates;
    try { dates = validateRecallDates({ ...checked.data, today: todayVn(), demo: serverEnv().enableDemoRecall }); }
    catch (error) { return err('VALIDATION', error instanceof Error ? error.message : 'Mốc thu hồi không hợp lệ.'); }
    return withRecallLock(checked.data.chain, role, async () => {
      const round = await getSettlementStore().findActiveRound(checked.data.chain);
      if (!roundMatches(round, checked.data.roundId, 'INITIATED') || round.freezeRequestedAt) return err('REQUEST_STATE', 'Đợt không còn ở trạng thái có thể sửa mốc.');
      const detail = `Sửa mốc từ ${round.maturityDate}/${round.noticeDays} ngày thành ${dates.maturityDate}/${dates.noticeDays} ngày. Lý do: ${checked.data.reason}`;
      const updated = await getSettlementStore().rescheduleRound({ id: round.id, ...dates, audit: successAudit(role, 'settlement:initiate', round.id, checked.data.chain, detail) });
      return updated ? ok(updated) : err('REQUEST_STATE', 'Đợt vừa được thao tác khác xử lý.');
    });
  } catch (error) { return toResult(error); }
}

async function waitReceipt(chain: ChainKey, txHash: string, timeoutMs: number): Promise<TxResult> {
  try { return await getLedger(chain).waitReceipt(txHash, Math.max(1, timeoutMs)); }
  catch { return { txHash, status: 'PENDING', reason: 'Chưa đọc được biên nhận.' }; }
}

async function updateSavedTxn(chain: ChainKey, receipt: TxResult): Promise<void> {
  const txn = await getStore().findTxnByHash(chain, receipt.txHash);
  if (txn) await getStore().updateTxnStatus(txn.id, receipt.status, receipt.reason);
}

async function recoverTxn(chain: ChainKey, operation: string, from: string | null, after: string): Promise<TxnRecord | null> {
  const rows = await getStore().listTxns({ chain, limit: 500 });
  return rows.find((row) => row.operation === operation && row.fromWallet?.toLowerCase() === from?.toLowerCase() && row.createdAt >= after) ?? null;
}

async function recallWallets(chain: ChainKey): Promise<{ rows: Array<{ holderWallet: string; wptAmount: string; payoutAmount: string }>; truncated: boolean }> {
  const ledger = getLedger(chain);
  const [listed, spv] = await Promise.all([ledger.listTokenWallets(), ledger.spvWallet()]);
  return {
    truncated: listed.truncated,
    rows: listed.wallets.filter((entry) => entry.balance > 0n && entry.wallet.toLowerCase() !== spv?.toLowerCase())
      .map((entry) => ({ holderWallet: entry.wallet.toLowerCase(), wptAmount: entry.balance.toString(), payoutAmount: '0' })),
  };
}

async function completeFreeze(chain: ChainKey, round: SettlementRoundRecord, role: Role): Promise<Result<SettlementRoundRecord>> {
  const wallets = await recallWallets(chain);
  if (wallets.truncated) return err('REQUEST_STATE', 'Danh sách ví bị cắt; không thể lập đợt thu hồi an toàn.');
  const updated = await getSettlementStore().completeFreeze({
    id: round.id, frozenAt: new Date().toISOString(), cases: wallets.rows,
    audit: successAudit(role, 'settlement:recall', round.id, chain, `Đóng băng token và lập ${wallets.rows.length} hồ sơ thu hồi.`),
  });
  return updated ? ok(updated) : err('REQUEST_STATE', 'Đợt vừa được thao tác khác xử lý.');
}

export async function freezeToken(input: unknown): Promise<Result<SettlementRoundRecord>> {
  const parsed = confirmSchema.safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await authorize('settlement:recall', checked.data.roundId, checked.data.chain);
    return withRecallLock(checked.data.chain, role, async () => {
      const started = Date.now(); const { chain, roundId, confirmSymbol } = checked.data;
      const ledger = getLedger(chain); const store = getSettlementStore();
      const round = await store.findActiveRound(chain); const project = await projectFor(chain, round?.projectId);
      if (!roundMatches(round, roundId, 'INITIATED') || !project) return err('REQUEST_STATE', 'Không có đợt INITIATED tương ứng.');
      if (confirmSymbol !== project.tokenSymbol) return err('VALIDATION', `Hãy gõ đúng ký hiệu ${project.tokenSymbol} để xác nhận.`);
      if (await ledger.isSettlementMode()) return completeFreeze(chain, round, role);

      let shouldSend = !round.freezeRequestedAt;
      if (round.freezeRequestedAt) {
        const recovered = round.freezeTxHash ? await getStore().findTxnByHash(chain, round.freezeTxHash) : await recoverTxn(chain, 'freeze', null, round.freezeRequestedAt);
        if (recovered && !round.freezeTxHash) await store.setFreezeTx({ id: round.id, txHash: recovered.txHash });
        if (recovered) {
          const receipt = await waitReceipt(chain, recovered.txHash, 1_000); await updateSavedTxn(chain, receipt);
          if (receipt.status === 'CONFIRMED') return completeFreeze(chain, round, role);
          if (receipt.status === 'FAILED') {
            await store.setFreezeTx({ id: round.id, txHash: null, clearRequest: true });
            return err('LEDGER', receipt.reason ?? 'Giao dịch đóng băng thất bại; có thể thử lại.');
          }
        }
        if (Date.now() - Date.parse(round.freezeRequestedAt) < RECALL_STUCK_MS) return err('REQUEST_STATE', 'Giao dịch đóng băng đang chờ xác nhận.');
        shouldSend = true;
      }

      if (!round.freezeRequestedAt) {
        if (!round.recallFrom || todayVn() < round.recallFrom) return err('REQUEST_STATE', `Chưa tới ngày bắt đầu thu hồi ${round.recallFrom ?? '(chưa đặt)'}.`);
        const [orders, activeDistribution, wallets] = await Promise.all([countInFlightOrders(chain), getDistributionStore().findActivePeriod(chain), recallWallets(chain)]);
        if (orders.PLACED + orders.CHECKING + orders.EXECUTING > 0) return err('REQUEST_STATE', 'Vẫn còn lệnh đang xử lý; phải xử lý hết trước khi đóng băng.');
        if (activeDistribution) return err('REQUEST_STATE', 'Vẫn còn kỳ chia lợi nhuận đang hoạt động.');
        if (wallets.truncated) return err('REQUEST_STATE', 'Danh sách ví bị cắt; không thể đóng băng an toàn.');
        if (!(await store.requestFreeze({ id: round.id, at: new Date().toISOString() }))) return err('REQUEST_STATE', 'Một lượt khác vừa bắt đầu đóng băng.');
      }

      if (shouldSend) {
        let pending: TxResult;
        try { pending = await ledger.setSettlementMode(true); }
        catch (error) {
          if (error instanceof LedgerError && error.reverted) await store.setFreezeTx({ id: round.id, txHash: null, clearRequest: true });
          throw error;
        }
        await submitTxn({ chain, pending, operation: 'freeze', fromWallet: null, toWallet: null, amount: null, role, onSubmitted: (txHash) => store.setFreezeTx({ id: round.id, txHash }) });
        const receipt = await waitReceipt(chain, pending.txHash, recallBudget(chain) - (Date.now() - started)); await updateSavedTxn(chain, receipt);
        if (receipt.status === 'CONFIRMED') return completeFreeze(chain, round, role);
        if (receipt.status === 'FAILED') { await store.setFreezeTx({ id: round.id, txHash: null, clearRequest: true }); return err('LEDGER', receipt.reason ?? 'Giao dịch đóng băng thất bại.'); }
      }
      return err('REQUEST_STATE', 'Giao dịch đóng băng đang chờ xác nhận.');
    });
  } catch (error) { return toResult(error); }
}

export async function unfreezeToken(input: unknown): Promise<Result<SettlementRoundRecord>> {
  const parsed = unfreezeSchema.safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await authorize('settlement:recall', checked.data.roundId, checked.data.chain);
    return withRecallLock(checked.data.chain, role, async () => {
      const { chain, roundId, confirmSymbol, reason } = checked.data; const store = getSettlementStore(); const ledger = getLedger(chain);
      const round = await store.findActiveRound(chain); const project = await projectFor(chain, round?.projectId);
      if (!roundMatches(round, roundId, 'IN_PROGRESS') || !project) return err('REQUEST_STATE', 'Không có đợt đang đóng băng tương ứng.');
      if (confirmSymbol !== project.tokenSymbol) return err('VALIDATION', `Hãy gõ đúng ký hiệu ${project.tokenSymbol} để xác nhận.`);
      const audit = successAudit(role, 'settlement:recall', round.id, chain, `Mở đóng băng trước khi đốt. Lý do: ${reason}`);
      if (!(await ledger.isSettlementMode())) {
        const done = await store.completeUnfreeze({ id: round.id, audit });
        return done ? ok(done) : err('REQUEST_STATE', 'Đợt đã có hồ sơ được đốt hoặc đang gửi đốt.');
      }
      let send = !round.unfreezeRequestedAt;
      if (round.unfreezeRequestedAt) {
        const recovered = round.unfreezeTxHash ? await getStore().findTxnByHash(chain, round.unfreezeTxHash) : await recoverTxn(chain, 'unfreeze', null, round.unfreezeRequestedAt);
        if (recovered && !round.unfreezeTxHash) await store.setUnfreezeTx({ id: round.id, txHash: recovered.txHash });
        if (recovered) {
          const receipt = await waitReceipt(chain, recovered.txHash, 1_000); await updateSavedTxn(chain, receipt);
          if (receipt.status === 'CONFIRMED') { const done = await store.completeUnfreeze({ id: round.id, audit }); return done ? ok(done) : err('REQUEST_STATE', 'Không thể mở: đã bắt đầu đốt token.'); }
          if (receipt.status === 'FAILED') { await store.setUnfreezeTx({ id: round.id, txHash: null, clearRequest: true }); return err('LEDGER', receipt.reason ?? 'Giao dịch mở đóng băng thất bại.'); }
        }
        if (Date.now() - Date.parse(round.unfreezeRequestedAt) < RECALL_STUCK_MS) return err('REQUEST_STATE', 'Giao dịch mở đóng băng đang chờ xác nhận.');
        send = true;
      }
      if (!round.unfreezeRequestedAt && !(await store.requestUnfreeze({ id: round.id, at: new Date().toISOString() }))) return err('REQUEST_STATE', 'Không thể mở: đã bắt đầu đốt token hoặc một lượt khác đang xử lý.');
      if (send) {
        let pending: TxResult;
        try { pending = await ledger.setSettlementMode(false); }
        catch (error) { if (error instanceof LedgerError && error.reverted) await store.setUnfreezeTx({ id: round.id, txHash: null, clearRequest: true }); throw error; }
        await submitTxn({ chain, pending, operation: 'unfreeze', fromWallet: null, toWallet: null, amount: null, role, onSubmitted: (txHash) => store.setUnfreezeTx({ id: round.id, txHash }) });
        const receipt = await waitReceipt(chain, pending.txHash, recallBudget(chain)); await updateSavedTxn(chain, receipt);
        if (receipt.status === 'CONFIRMED') { const done = await store.completeUnfreeze({ id: round.id, audit }); return done ? ok(done) : err('REQUEST_STATE', 'Không thể mở: đã bắt đầu đốt token.'); }
        if (receipt.status === 'FAILED') { await store.setUnfreezeTx({ id: round.id, txHash: null, clearRequest: true }); return err('LEDGER', receipt.reason ?? 'Giao dịch mở đóng băng thất bại.'); }
      }
      return err('REQUEST_STATE', 'Giao dịch mở đóng băng đang chờ xác nhận.');
    });
  } catch (error) { return toResult(error); }
}

async function reconcileBurning(chain: ChainKey, cases: SettlementCaseRecord[]): Promise<void> {
  const ledger = getLedger(chain); const store = getSettlementStore();
  await Promise.all(cases.map(async (item) => {
    let txHash = item.burnTxHash;
    if (!txHash && item.burnSentAt) {
      const recovered = await recoverTxn(chain, 'recall', item.holderWallet, item.burnSentAt);
      if (recovered) { txHash = recovered.txHash; await store.attachBurnTx({ roundId: item.roundId, holderWallet: item.holderWallet, txHash }); }
    }
    if (!txHash) {
      const balance = await ledger.balanceOf(item.holderWallet);
      await store.settleCase({ roundId: item.roundId, holderWallet: item.holderWallet, to: balance === 0n ? 'BURNED' : 'FAILED', at: new Date().toISOString(), reason: balance === 0n ? undefined : 'Gửi giao dịch đốt không thành.' });
      return;
    }
    const receipt = await waitReceipt(chain, txHash, 1_000); await updateSavedTxn(chain, receipt);
    if (receipt.status !== 'PENDING') {
      await store.settleCase({ roundId: item.roundId, holderWallet: item.holderWallet, to: receipt.status === 'CONFIRMED' ? 'BURNED' : 'FAILED', at: new Date().toISOString(), reason: receipt.reason }); return;
    }
    if (item.burnSentAt && Date.now() - Date.parse(item.burnSentAt) >= RECALL_STUCK_MS) {
      const balance = await ledger.balanceOf(item.holderWallet);
      if (balance === 0n) await store.settleCase({ roundId: item.roundId, holderWallet: item.holderWallet, to: 'BURNED', at: new Date().toISOString() });
      else if (!(await ledger.isTransactionKnown(txHash))) await store.settleCase({ roundId: item.roundId, holderWallet: item.holderWallet, to: 'FAILED', at: new Date().toISOString(), reason: 'Giao dịch treo không còn được nút RPC biết tới.' });
    }
  }));
}

export interface RecallBatchProgress { burned: number; pending: number; failed: number; remaining: number; outsideRemaining: string; completed: boolean; }

export async function recallBatch(input: unknown): Promise<Result<RecallBatchProgress>> {
  const parsed = roundSchema.pick({ chain: true, roundId: true }).safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await authorize('settlement:recall', checked.data.roundId, checked.data.chain);
    return withRecallLock(checked.data.chain, role, async () => {
      const started = Date.now(); const { chain, roundId } = checked.data; const store = getSettlementStore(); const ledger = getLedger(chain);
      const round = await store.findActiveRound(chain);
      if (!roundMatches(round, roundId, 'IN_PROGRESS')) return err('REQUEST_STATE', 'Đợt không ở trạng thái đang thu hồi.');
      if (round.unfreezeRequestedAt) return err('REQUEST_STATE', 'Đang mở đóng băng; không thể đồng thời gửi lệnh thu hồi.');
      if (!(await ledger.isSettlementMode())) return err('REQUEST_STATE', 'Đợt đang thu hồi nhưng token không còn đóng băng trên chuỗi; đã dừng trước khi đốt.');

      await reconcileBurning(chain, await store.listRoundCases({ roundId, statuses: ['BURNING'] }));
      const wallets = await recallWallets(chain);
      if (wallets.truncated) return err('REQUEST_STATE', 'Danh sách ví bị cắt; không thể thu hồi an toàn.');
      await store.addMissingCases({ roundId, rows: wallets.rows });
      const candidates = (await store.listRoundCases({ roundId, statuses: ['NOTIFIED', 'FAILED'] })).slice(0, RECALL_BATCH_SIZE);
      const submitted: Array<{ item: SettlementCaseRecord; txn: TxnRecord }> = [];
      for (const item of candidates) {
        if (Date.now() - started > recallBudget(chain) / 2) break;
        const claimed = await store.claimCase({ roundId, holderWallet: item.holderWallet, at: new Date().toISOString() });
        if (!claimed) continue;
        const amount = await ledger.balanceOf(item.holderWallet);
        if (amount === 0n) { await store.settleCase({ roundId, holderWallet: item.holderWallet, to: 'BURNED', at: new Date().toISOString() }); continue; }
        try {
          const pending = await ledger.burn(item.holderWallet, amount);
          const txn = await submitTxn({ chain, pending, operation: 'recall', fromWallet: item.holderWallet, toWallet: null, amount, role, onSubmitted: async (txHash) => { if (!(await store.attachBurnTx({ roundId, holderWallet: item.holderWallet, txHash }))) throw new Error('Không gắn được mã giao dịch vào hồ sơ đã chiếm.'); } });
          submitted.push({ item: claimed, txn });
        } catch (error) {
          if (error instanceof LedgerError && error.reverted) await store.settleCase({ roundId, holderWallet: item.holderWallet, to: 'FAILED', at: new Date().toISOString(), reason: error.message });
        }
      }
      const remainingBudget = Math.max(1, recallBudget(chain) - (Date.now() - started));
      await Promise.all(submitted.map(async ({ item, txn }) => {
        const receipt = await waitReceipt(chain, txn.txHash, remainingBudget);
        await getStore().updateTxnStatus(txn.id, receipt.status, receipt.reason);
        if (receipt.status !== 'PENDING') await store.settleCase({ roundId, holderWallet: item.holderWallet, to: receipt.status === 'CONFIRMED' ? 'BURNED' : 'FAILED', at: new Date().toISOString(), reason: receipt.reason });
      }));

      const all = await store.listRoundCases({ roundId });
      const counts = { burned: all.filter((row) => row.status === 'BURNED').length, pending: all.filter((row) => row.status === 'BURNING').length, failed: all.filter((row) => row.status === 'FAILED').length, remaining: all.filter((row) => !['BURNED'].includes(row.status)).length };
      const [info, spv] = await Promise.all([ledger.tokenInfo(), ledger.spvWallet()]);
      const spvBalance = spv ? await ledger.balanceOf(spv) : 0n;
      const outside = info.totalSupply > spvBalance ? info.totalSupply - spvBalance : 0n;
      if (counts.remaining === 0 && outside === 0n && round.projectId) {
        const completed = await store.completeRound({ id: round.id, projectId: round.projectId, completedAt: new Date().toISOString(), audit: successAudit(role, 'settlement:recall', round.id, chain, 'Đã thu hồi toàn bộ token ngoài vault; đóng dự án.') });
        if (completed) return ok({ ...counts, outsideRemaining: '0', completed: true });
      }
      return ok({ ...counts, outsideRemaining: outside.toString(), completed: false });
    });
  } catch (error) { return toResult(error); }
}

export interface RecallOverview {
  chain: ChainKey;
  project: Pick<ProjectRecord, 'id' | 'tokenSymbol' | 'name' | 'status'> | null;
  round: (SettlementRoundRecord & { phase: RecallPhase['kind']; daysToMaturity: number; daysToRecall: number }) | null;
  settlementMode: boolean | null;
  inFlightOrders: Awaited<ReturnType<typeof countInFlightOrders>>;
  activeDistribution: boolean;
  chainLock: { kind: string; acquiredAt: string } | null;
  cases: Array<{ wallet: string; wptAmount: string; burnedAmount: string | null; status: string; txHash: string | null; reason: string | null }>;
  preview: { wallets: Array<{ wallet: string; balance: string }>; truncated: boolean } | null;
  supplyOutsideVault: string;
  canManage: boolean; canUnfreeze: boolean; demoMode: boolean;
}

export async function getRecallOverview(input: unknown): Promise<Result<RecallOverview>> {
  const parsed = z.object({ chain: CHAIN_SCHEMA }).safeParse(input); const checked = validation(parsed); if (!checked.ok) return checked;
  try {
    const role = await currentRole(); assertCan(role, 'ops:read'); const { chain } = checked.data;
    const store = getSettlementStore(); const ledger = getLedger(chain);
    const active = await store.findActiveRound(chain); const round = active ?? await store.latestRecallRound(chain);
    const project = await projectFor(chain, round?.projectId);
    const [settlementMode, orders, distribution, lock, cases, token, spv, previewData] = await Promise.all([
      settlementModeOrUnknown(chain), countInFlightOrders(chain), getDistributionStore().findActivePeriod(chain), getVaultStore().findOperationLock(chain),
      round ? store.listRoundCases({ roundId: round.id }) : Promise.resolve([]), ledger.tokenInfo(), ledger.spvWallet(),
      !round || round.status === 'INITIATED' ? ledger.listTokenWallets() : Promise.resolve(null),
    ]);
    const spvBalance = spv ? await ledger.balanceOf(spv) : 0n;
    const outside = token.totalSupply > spvBalance ? token.totalSupply - spvBalance : 0n;
    const today = todayVn(); const phase = recallPhaseOf(round, project, today);
    const startedBurn = cases.some((item) => item.status === 'BURNING' || (item.status === 'BURNED' && item.burnTxHash));
    return ok({
      chain, project: project ? { id: project.id, tokenSymbol: project.tokenSymbol, name: project.name, status: project.status } : null,
      round: round ? { ...round, phase: phase.kind, daysToMaturity: round.maturityDate ? daysBetween(today, round.maturityDate) : 0, daysToRecall: round.recallFrom ? daysBetween(today, round.recallFrom) : 0 } : null,
      settlementMode, inFlightOrders: orders, activeDistribution: Boolean(distribution), chainLock: lock ? { kind: lock.kind, acquiredAt: lock.acquiredAt } : null,
      cases: cases.map((item) => ({ wallet: item.holderWallet, wptAmount: item.wptAmount, burnedAmount: item.status === 'BURNED' ? item.wptAmount : null, status: item.status, txHash: item.burnTxHash, reason: item.reason })),
      preview: previewData ? { wallets: previewData.wallets.filter((item) => item.balance > 0n && item.wallet.toLowerCase() !== spv?.toLowerCase()).map((item) => ({ wallet: item.wallet, balance: item.balance.toString() })), truncated: previewData.truncated } : null,
      supplyOutsideVault: outside.toString(), canManage: can(role, 'settlement:recall'), canUnfreeze: round?.status === 'IN_PROGRESS' && !startedBurn,
      demoMode: serverEnv().enableDemoRecall,
    });
  } catch (error) { return toResult(error); }
}
