import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ChainKey, TxResult } from '@bidv/shared';
import {
  getLedger,
  InvalidAddressError,
  LedgerError,
  normalizeEvmAddress,
  receiptTimeoutFor,
  type ILedgerPort,
  type VaultLockMode,
  type VaultStatus,
} from '@/lib/ledger';
import { can } from '@/lib/rbac';
import { currentActorId } from '@/lib/rbac/session';
import { readVaultDefaultPercentBps } from '@/lib/store/config-values';
import { getStore, getVaultStore } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { trackTxn } from './issuance.service';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';
import {
  bpsToPercent,
  describeVaultConfigStep,
  parseFixedLock,
  percentToBps,
  planVaultConfig,
  VAULT_CONFIG_STEP_LABELS,
  type VaultConfigStep,
} from './vault-config';

export interface VaultStatusView {
  address: string;
  wptBalance: string;
  vndbBalance: string;
  lockMode: VaultLockMode;
  fixedLockAmount: string;
  percentRateBps: string;
  pendingPercentRateBps: string | null;
  netProceeds: string;
  lockedAmount: string;
  withdrawable: string;
  lastPeriodRef: string;
  lastDistributedPrev: string;
  percentLocked: string;
  payoutWallet: string | null;
  withdrawalsPaused: boolean;
}

export interface VaultPeriodCloseView {
  periodRef: string;
  distributedPrev: string;
  rateBps: string;
  percentLocked: string;
  operator: string;
  txHash: string;
  blockNumber: string;
  timestamp: number;
}

/** Mục "Cấu hình khoá" trên `/vault` (BE-13 QĐ-C). */
export interface VaultConfigFormView {
  /** Chỉ Kiểm soát viên lưu được; vai khác chỉ xem. */
  canConfigure: boolean;
  /** Phần trăm điền sẵn: tỷ lệ chờ, rồi tỷ lệ trên chuỗi; vault `UNSET` thì lấy `vault.default_percent_bps`. */
  percent: string;
  /** Số khoá cố định điền sẵn: chỉ khi chế độ hiện hành là FIXED, còn lại để trống. */
  fixedLock: string;
  payoutWallet: string;
  /** Thao tác đang giữ khoá vận hành của chain, `null` khi rảnh. */
  busy: { kind: 'CONFIG' | 'WITHDRAW'; acquiredAt: string } | null;
}

export interface VaultOverviewView {
  chain: ChainKey;
  status: VaultStatusView | null;
  history: VaultPeriodCloseView[];
  /** Lỗi lịch sử không được che trạng thái hiện tại, nhất là khi address book cũ thiếu deployBlock. */
  historyError: string | null;
  /** `null` khi chain không có vault. */
  config: VaultConfigFormView | null;
  /** Kiểm soát viên chốt được lệnh rút `NEEDS_REVIEW` (`vault:reconcile`, QĐ-F). */
  canResolveWithdrawals: boolean;
}

/** Trạng thái công khai của vault. Chỉ đọc, nhưng vẫn kiểm quyền ở tầng máy chủ. */
export async function getVaultOverview(input: unknown): Promise<Result<VaultOverviewView>> {
  const parsed = chainSchema.safeParse(
    typeof input === 'object' && input !== null ? (input as { chain?: unknown }).chain : undefined,
  );
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  const chain = parsed.data;

  try {
    const role = await authorize('vault:read', null, chain);
    const ledger = getLedger(chain);
    const status = await ledger.vaultStatus();
    const canResolveWithdrawals = can(role, 'vault:reconcile');
    if (status === null) {
      return ok({ chain, status: null, history: [], historyError: null, config: null, canResolveWithdrawals });
    }

    let history: VaultPeriodCloseView[] = [];
    let historyError: string | null = null;
    try {
      history = (await ledger.vaultPeriodCloses(10)).map((entry) => ({
        periodRef: entry.periodRef.toString(),
        distributedPrev: entry.distributedPrev.toString(),
        rateBps: entry.rateBps.toString(),
        percentLocked: entry.percentLocked.toString(),
        operator: entry.operator,
        txHash: entry.txHash,
        blockNumber: entry.blockNumber.toString(),
        timestamp: entry.timestamp,
      }));
    } catch (error) {
      const converted = toResult<never>(error);
      historyError = converted.ok ? null : converted.error;
    }

    const [defaultBps, busy] = await Promise.all([
      readVaultDefaultPercentBps(),
      getVaultStore().findOperationLock(chain),
    ]);
    const percentBps =
      status.lockMode === 'UNSET' ? BigInt(defaultBps) : (status.pendingPercentRateBps ?? status.percentRateBps);

    return ok({
      chain,
      status: toStatusView(status),
      history,
      historyError,
      config: {
        canConfigure: can(role, 'vault:configure'),
        percent: percentBps > 0n ? bpsToPercent(percentBps) : bpsToPercent(defaultBps),
        fixedLock: status.lockMode === 'FIXED' ? status.fixedLockAmount.toString() : '',
        payoutWallet: status.payoutWallet ?? '',
        busy: busy ? { kind: busy.kind, acquiredAt: busy.acquiredAt } : null,
      },
      canResolveWithdrawals,
    });
  } catch (error) {
    return toResult(error);
  }
}

function toStatusView(status: VaultStatus): VaultStatusView {
  return {
    address: status.address,
    wptBalance: status.wptBalance.toString(),
    vndbBalance: status.vndbBalance.toString(),
    lockMode: status.lockMode,
    fixedLockAmount: status.fixedLockAmount.toString(),
    percentRateBps: status.percentRateBps.toString(),
    pendingPercentRateBps: status.pendingPercentRateBps?.toString() ?? null,
    netProceeds: status.netProceeds.toString(),
    lockedAmount: status.lockedAmount.toString(),
    withdrawable: status.withdrawable.toString(),
    lastPeriodRef: status.lastPeriodRef.toString(),
    lastDistributedPrev: status.lastDistributedPrev.toString(),
    percentLocked: status.percentLocked.toString(),
    payoutWallet: status.payoutWallet,
    withdrawalsPaused: status.withdrawalsPaused,
  };
}

// =============================================================================
//  CẤU HÌNH KHOÁ (BE-13 QĐ-C, QĐ-D)
// =============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const saveVaultConfigSchema = z.object({
  chain: chainSchema,
  percent: z.string().max(20),
  fixedLock: z.string().max(80).optional().default(''),
  payoutWallet: z.string().max(80),
});

export interface VaultConfigStepView {
  kind: VaultConfigStep['kind'];
  label: string;
  detail: string;
  txHash: string;
}

export interface SaveVaultConfigView {
  /** `NO_CHANGE`: chuỗi đã đúng cấu hình, không gửi giao dịch nào. */
  outcome: 'SAVED' | 'NO_CHANGE';
  steps: VaultConfigStepView[];
  status: VaultStatusView;
}

/**
 * Khoá vận hành `CONFIG` treo quá thời gian chờ biên nhận thì lần lưu kế tiếp được tiếp quản: cấu
 * hình gửi lại an toàn vì chỉ gửi phần còn khác trạng thái chuỗi (QĐ-D).
 */
export function vaultConfigLockTakeOverBefore(chain: ChainKey, now: Date = new Date()): Date {
  return new Date(now.getTime() - receiptTimeoutFor(chain));
}

/** Gửi một bước cấu hình theo đúng setter của cổng. */
function sendConfigStep(ledger: ILedgerPort, step: VaultConfigStep): Promise<TxResult> {
  switch (step.kind) {
    case 'setPayoutWallet':
      return ledger.setVaultPayoutWallet(step.wallet);
    case 'setFixedLock':
      return ledger.setVaultFixedLock(step.amount);
    case 'setPercentRate':
      return ledger.setVaultPercentRate(step.bps);
    case 'setLockMode':
      return ledger.setVaultLockMode(step.mode);
  }
}

/**
 * Kiểm soát viên lưu cấu hình khoá vault (BE-13 QĐ-C).
 *
 * Thứ tự: kiểm quyền, kiểm dạng ba ô, lấy khoá vận hành `CONFIG`, đọc trạng thái chuỗi, kiểm ví
 * nhận (khác 0, khác vault, đã whitelist), lập danh sách giao dịch theo bảng chuyển tiếp rồi gửi
 * TỪNG giao dịch: lưu `Txn` trước khi chờ biên nhận, chờ xong mới gửi bước sau, ghi audit giá trị cũ
 * và mới. Lỗi giữa chừng thì dừng và trả bước đã xong, bước lỗi; lần lưu sau đọc lại chuỗi nên chỉ
 * gửi phần còn thiếu.
 */
export async function saveVaultConfig(input: unknown): Promise<Result<SaveVaultConfigView>> {
  const parsed = saveVaultConfigSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;

  let role;
  try {
    role = await authorize('vault:configure', null, chain);
  } catch (error) {
    return toResult(error);
  }
  const store = getStore();
  const audit = (outcome: 'SUCCESS' | 'FAILURE', detail: string, target: string | null = null) =>
    store.appendAudit({ actorRole: role, action: 'vault:configure', target, outcome, detail, chain });

  // Kiểm dạng TRƯỚC khi lấy khoá hay chạm chuỗi.
  const fieldErrors: Record<string, string[]> = {};
  const percentBps = percentToBps(parsed.data.percent);
  if (percentBps === null) {
    fieldErrors.percent = ['Tỷ lệ là số phần trăm lớn hơn 0, không quá 100, tối đa hai chữ số thập phân.'];
  }
  const fixedLock = parseFixedLock(parsed.data.fixedLock);
  if (fixedLock === 'INVALID') fieldErrors.fixedLock = ['Số khoá cố định là số nguyên VNDB lớn hơn 0, hoặc để trống.'];
  let payoutWallet: string | null = null;
  try {
    payoutWallet = normalizeEvmAddress(parsed.data.payoutWallet);
    if (payoutWallet.toLowerCase() === ZERO_ADDRESS) {
      fieldErrors.payoutWallet = ['Ví nhận không được là địa chỉ 0.'];
    }
  } catch (error) {
    if (!(error instanceof InvalidAddressError)) throw error;
    fieldErrors.payoutWallet = ['Ví nhận không phải địa chỉ hợp lệ (0x + 40 ký tự hex).'];
  }
  if (Object.keys(fieldErrors).length > 0 || percentBps === null || fixedLock === 'INVALID' || !payoutWallet) {
    await audit('FAILURE', `Từ chối trước khi gửi: ${Object.values(fieldErrors).flat().join(' ')}`);
    return err('VALIDATION', 'Cấu hình khoá chưa hợp lệ.', fieldErrors);
  }

  const vaultStore = getVaultStore();
  const refId = randomUUID();
  const actor = await currentActorId(role);
  const lock = await vaultStore.acquireOperationLock({
    chain,
    kind: 'CONFIG',
    refId,
    actor,
    takeOverConfigBefore: vaultConfigLockTakeOverBefore(chain),
  });
  if (!lock) {
    const held = await vaultStore.findOperationLock(chain);
    const busy = `Vault đang có thao tác khác (${held?.kind === 'WITHDRAW' ? 'lệnh rút đang dở' : 'lần lưu cấu hình khác'}); thử lại sau.`;
    await audit('FAILURE', busy);
    return err('VAULT_BUSY', busy);
  }

  // Biên nhận chưa về (hết thời gian chờ) thì GIỮ khoá: giao dịch có thể vẫn vào block, lần lưu sau
  // tiếp quản khi khoá quá hạn. Mọi kết cục khác nhả khoá.
  let keepLock = false;
  try {
    const ledger = getLedger(chain);
    const status = await ledger.vaultStatus();
    if (!status) return err('VALIDATION', `Chain "${chain}" không có vault thanh toán SPV để cấu hình.`);

    if (payoutWallet.toLowerCase() === status.address.toLowerCase()) {
      fieldErrors.payoutWallet = ['Ví nhận phải khác địa chỉ vault.'];
    } else if (!(await ledger.isWhitelisted(payoutWallet))) {
      fieldErrors.payoutWallet = [`Ví nhận ${payoutWallet} chưa được whitelist (chưa xác minh danh tính).`];
    }
    if (Object.keys(fieldErrors).length > 0) {
      await audit('FAILURE', `Từ chối trước khi gửi: ${Object.values(fieldErrors).flat().join(' ')}`);
      return err('VALIDATION', 'Cấu hình khoá chưa hợp lệ.', fieldErrors);
    }

    const steps = planVaultConfig(status, { percentBps, fixedLock, payoutWallet });
    const done: VaultConfigStepView[] = [];
    for (const step of steps) {
      const label = VAULT_CONFIG_STEP_LABELS[step.kind];
      const detail = describeVaultConfigStep(step);
      let receipt: TxResult;
      try {
        const pending = await sendConfigStep(ledger, step);
        receipt = await trackTxn({
          chain,
          pending,
          operation: `vault:${step.kind}`,
          fromWallet: null,
          toWallet: status.address,
          amount: step.kind === 'setFixedLock' ? step.amount : step.kind === 'setPercentRate' ? step.bps : 0n,
          role,
        });
      } catch (error) {
        const reason = error instanceof LedgerError ? error.message : error instanceof Error ? error.message : String(error);
        return await configFailure(done, label, reason);
      }
      if (receipt.status === 'PENDING') keepLock = true;
      if (receipt.status !== 'CONFIRMED') {
        return await configFailure(
          done,
          label,
          receipt.status === 'PENDING'
            ? `chưa có biên nhận của ${receipt.txHash} sau thời gian chờ; giao dịch có thể vẫn vào block.`
            : (receipt.reason ?? `giao dịch ${receipt.txHash} bị revert.`),
        );
      }
      await audit('SUCCESS', `${label}: ${detail}; tx ${receipt.txHash}.`, status.address);
      done.push({ kind: step.kind, label, detail, txHash: receipt.txHash });
    }

    const after = await ledger.vaultStatus();
    return ok({ outcome: done.length === 0 ? 'NO_CHANGE' : 'SAVED', steps: done, status: toStatusView(after ?? status) });
  } catch (error) {
    return toResult(error);
  } finally {
    if (!keepLock) await vaultStore.releaseOperationLock({ chain, refId });
  }

  async function configFailure(done: VaultConfigStepView[], failedLabel: string, reason: string) {
    const payoutChanged = done.some((step) => step.kind === 'setPayoutWallet');
    const summary =
      `Lưu cấu hình dừng ở bước "${failedLabel}": ${reason} ` +
      (done.length > 0 ? `Đã xong: ${done.map((step) => step.label).join(', ')}. ` : 'Chưa bước nào lên chuỗi. ') +
      `Ví nhận ${payoutChanged ? 'đã' : 'chưa'} đổi. Lưu lại để gửi phần còn thiếu.`;
    await audit('FAILURE', summary);
    return err<SaveVaultConfigView>('LEDGER', summary, {
      completedSteps: done.map((step) => step.kind),
      failedStep: [failedLabel],
      payoutChanged: [String(payoutChanged)],
    });
  }
}
