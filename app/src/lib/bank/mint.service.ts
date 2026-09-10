import 'server-only';

import type { ChainKey, TxStatus } from '@bidv/shared';
import { LedgerError, getLedger, receiptTimeoutFor } from '@/lib/ledger';
import { InvalidAddressError } from '@/lib/ledger';
import { KycProviderError, getKycProvider } from '@/lib/providers/kyc';
import { ForbiddenError, assertCan, type Action, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { SignerUnavailableError, getBankSigner } from '@/lib/signer';
import { getStore } from '@/lib/store';
import { err, ok, type Result } from './result';
import {
  balanceQuerySchema,
  mintSchema,
  onboardInvestorSchema,
  txnQuerySchema,
} from './schemas';

/**
 * Nghiệp vụ MINT — nơi DUY NHẤT ghép ba trục abstraction lại với nhau.
 *
 * Cả UI (server action) và HTTP (`/api/*`, dùng bởi demo runner + e2e) đều gọi vào đây,
 * nên guard RBAC + audit nằm ở tầng này, không nằm ở transport: thêm một transport mới
 * cũng không thể lỡ mất guard.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #2 ký qua `getBankSigner()` · LUẬT #3 quyền qua `assertCan()`.
 */

export interface TxnView {
  id: string;
  chain: ChainKey;
  operation: string;
  txHash: string;
  status: TxStatus;
  fromWallet: string | null;
  toWallet: string | null;
  amount: string | null;
  reason: string | null;
  actorRole: string;
  createdAt: string;
}

export interface OnboardResult {
  wallet: string;
  kycReference: string;
  kycProvider: string;
  whitelisted: boolean;
  txHash: string;
  status: TxStatus;
}

export interface MintResult {
  wallet: string;
  /** Chuỗi thập phân: bigint không qua được biên server -> client an toàn. */
  amount: string;
  txHash: string;
  status: TxStatus;
  balanceAfter: string;
  chain: ChainKey;
}

export interface TokenOverview {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  chain: ChainKey;
  /** Địa chỉ ví ngân hàng đang ký (để đối chiếu quyền on-chain). */
  bankAddress: string | null;
}

/** Quy lỗi ném ra thành `Result` có mã — một chỗ, dùng cho mọi nghiệp vụ. */
function toResult<T>(error: unknown): Result<T> {
  if (error instanceof ForbiddenError) return err('FORBIDDEN', error.message);
  if (error instanceof InvalidAddressError) return err('VALIDATION', error.message);
  if (error instanceof SignerUnavailableError) return err('SIGNER', error.message);
  if (error instanceof KycProviderError) return err('PROVIDER', error.message);
  if (error instanceof LedgerError) return err('LEDGER', error.message);
  return err('UNKNOWN', error instanceof Error ? error.message : 'Lỗi không xác định.');
}

/**
 * Guard chung: kiểm quyền RỒI ghi audit cho CẢ hai kết cục.
 * Ghi cả lần bị chặn là có chủ ý — kênh `(audit)` cần thấy ai đã thử làm gì.
 */
async function authorize(action: Action, target: string | null, chain: ChainKey | null): Promise<Role> {
  const role = await currentRole();
  const store = getStore();
  try {
    assertCan(role, action);
  } catch (error) {
    await store.appendAudit({
      actorRole: role,
      action,
      target,
      outcome: 'DENIED',
      detail: error instanceof Error ? error.message : null,
      chain,
    });
    throw error;
  }
  await store.appendAudit({
    actorRole: role,
    action,
    target,
    outcome: 'ALLOWED',
    detail: null,
    chain,
  });
  return role;
}

/** B1 của luồng: KYC (mock auto-approve) -> whitelist on-chain. */
export async function onboardInvestor(input: unknown): Promise<Result<OnboardResult>> {
  const parsed = onboardInvestorSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet, fullName, nationalId } = parsed.data;

  try {
    // KYC và whitelist là hai quyền khác nhau: COMPLIANCE có cả hai, INVESTOR không có.
    const role = await authorize('kyc:approve', wallet, chain);
    await authorize('investor:whitelist', wallet, chain);

    const kyc = await getKycProvider().verify({ wallet, fullName, nationalId });
    if (!kyc.approved) {
      return err('PROVIDER', `KYC từ chối: ${kyc.reason ?? 'không rõ lý do'}`);
    }

    const ledger = getLedger(chain);
    const signer = getBankSigner();

    const pending = await ledger.whitelist(wallet);
    const receipt = await ledger.waitReceipt(pending.txHash);

    const store = getStore();
    await store.saveTxn({
      chain,
      operation: 'whitelist',
      txHash: receipt.txHash,
      status: receipt.status,
      fromWallet: null,
      toWallet: wallet,
      amount: null,
      reason: receipt.reason ?? null,
      actorRole: role,
      actorAddress: await signer.getAddress(),
    });
    await store.appendAudit({
      actorRole: role,
      action: 'investor:whitelist',
      target: wallet,
      outcome: receipt.status === 'CONFIRMED' ? 'SUCCESS' : 'FAILURE',
      detail: `KYC ${kyc.reference} (${kyc.provider}); tx ${receipt.txHash} ${receipt.status}`,
      chain,
    });

    return ok({
      wallet,
      kycReference: kyc.reference,
      kycProvider: kyc.provider,
      // Đọc lại từ ledger thay vì tin vào receipt — đây là sự thật cuối cùng.
      whitelisted: await ledger.isWhitelisted(wallet),
      txHash: receipt.txHash,
      status: receipt.status,
    });
  } catch (error) {
    return toResult(error);
  }
}

/** B2 của luồng: phát hành token cho nhà đầu tư đã whitelist. */
export async function mintTokens(input: unknown): Promise<Result<MintResult>> {
  const parsed = mintSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet, amount } = parsed.data;

  try {
    const role = await authorize('token:mint', wallet, chain);

    const ledger = getLedger(chain);
    const signer = getBankSigner();
    const store = getStore();

    // AC#2: chưa whitelist thì TỪ CHỐI TRƯỚC KHI gửi tx (không đốt gas vào tx chắc chắn revert).
    if (!(await ledger.isWhitelisted(wallet))) {
      await store.appendAudit({
        actorRole: role,
        action: 'token:mint',
        target: wallet,
        outcome: 'FAILURE',
        detail: 'Bị chặn: ví chưa whitelist (không gửi tx).',
        chain,
      });
      return err(
        'NOT_WHITELISTED',
        `Ví ${wallet} chưa được whitelist. Chạy bước KYC/whitelist trước khi phát hành.`,
      );
    }

    const pending = await ledger.mint(wallet, amount);

    // Lưu ngay ở trạng thái PENDING: nếu process chết lúc chờ receipt,
    // tx vẫn còn dấu vết để đối soát chứ không biến mất.
    const saved = await store.saveTxn({
      chain,
      operation: 'mint',
      txHash: pending.txHash,
      status: pending.status,
      fromWallet: null,
      toWallet: wallet,
      amount: amount.toString(),
      reason: null,
      actorRole: role,
      actorAddress: await signer.getAddress(),
    });

    // AC#4 / p4 AC#9: chờ tới CONFIRMED/FAILED hoặc timeout THEO CHAIN
    // (hardhat-local 30s; Sepolia 90s vì block ~12s).
    const receipt = await ledger.waitReceipt(pending.txHash, receiptTimeoutFor(chain));
    await store.updateTxnStatus(saved.id, receipt.status, receipt.reason);
    await store.appendAudit({
      actorRole: role,
      action: 'token:mint',
      target: wallet,
      outcome: receipt.status === 'CONFIRMED' ? 'SUCCESS' : 'FAILURE',
      detail: `mint ${amount} WPT; tx ${receipt.txHash} ${receipt.status}`,
      chain,
    });

    if (receipt.status === 'FAILED') {
      return err('LEDGER', receipt.reason ?? 'Giao dịch mint thất bại on-chain.');
    }

    return ok({
      wallet,
      amount: amount.toString(),
      txHash: receipt.txHash,
      status: receipt.status,
      // AC#7: số dư đọc lại từ chain sau khi CONFIRMED.
      balanceAfter: (await ledger.balanceOf(wallet)).toString(),
      chain,
    });
  } catch (error) {
    return toResult(error);
  }
}

export async function readBalance(input: unknown): Promise<
  Result<{ wallet: string; balance: string; whitelisted: boolean; frozen: boolean; chain: ChainKey }>
> {
  const parsed = balanceQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet } = parsed.data;

  try {
    await authorize('balance:read', wallet, chain);
    const ledger = getLedger(chain);
    const [balance, whitelisted, frozen] = await Promise.all([
      ledger.balanceOf(wallet),
      ledger.isWhitelisted(wallet),
      ledger.isFrozen(wallet),
    ]);
    return ok({ wallet, balance: balance.toString(), whitelisted, frozen, chain });
  } catch (error) {
    return toResult(error);
  }
}

export async function listTransactions(input: unknown): Promise<Result<TxnView[]>> {
  const parsed = txnQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  try {
    await authorize('txn:read', null, parsed.data.chain ?? null);
    const rows = await getStore().listTxns(parsed.data);
    return ok(
      rows.map((row) => ({
        id: row.id,
        chain: row.chain,
        operation: row.operation,
        txHash: row.txHash,
        status: row.status,
        fromWallet: row.fromWallet,
        toWallet: row.toWallet,
        amount: row.amount,
        reason: row.reason,
        actorRole: row.actorRole,
        createdAt: row.createdAt,
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}

export async function tokenOverview(chain: ChainKey): Promise<Result<TokenOverview>> {
  try {
    await authorize('balance:read', null, chain);
    const info = await getLedger(chain).tokenInfo();
    let bankAddress: string | null = null;
    try {
      bankAddress = await getBankSigner().getAddress();
    } catch {
      // Thiếu signer không được làm sập trang chỉ-đọc.
    }
    return ok({
      name: info.name,
      symbol: info.symbol,
      decimals: info.decimals,
      totalSupply: info.totalSupply.toString(),
      chain,
      bankAddress,
    });
  } catch (error) {
    return toResult(error);
  }
}
