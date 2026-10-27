import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger, normalizeEvmAddress } from '@/lib/ledger';
import { getKycProvider } from '@/lib/providers/kyc';
import { assertCan, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { getBankSigner } from '@/lib/signer';
import { getStore, getWalletBindingStore, UniqueConstraintError, type WalletBindingRecord } from '@/lib/store';
import { findCustomerProfile, listCustomerProfiles } from './account-profile.service';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';
import { isPublicSampleWallet, usesSampleWallets } from './wallet-owner';

/**
 * ĐỊNH DANH VÀ GẮN VÍ CHO HỒ SƠ (FIX-01 A1, A2): Giao dịch viên là bên DUY NHẤT gắn ví cho hồ sơ
 * khách hàng, và định danh trên chuỗi (whitelist) cùng một thao tác. Ví chỉ được ghi vào bảng gắn
 * khi whitelist đã có biên nhận `CONFIRMED` (hoặc đã whitelist từ trước).
 */

const bindWalletSchema = z.object({
  chain: chainSchema,
  actorId: z.string().trim().max(40),
  wallet: z.string().trim().max(80),
});

const listWalletBindingsSchema = z.object({ chain: chainSchema });

/** Số dòng tối đa của bảng "Ví đã định danh". */
export const WALLET_BINDING_LIST_LIMIT = 200;

const TAKEN_MESSAGE = 'Ví đã được định danh cho hồ sơ khác.';
const PUBLIC_SAMPLE_MESSAGE = 'Ví mẫu công khai của Hardhat không định danh được trên chain thật.';

export interface WalletBindingView {
  wallet: string;
  actorId: string;
  profileName: string;
  role: Role;
  boundBy: string;
  boundAt: string;
}

export interface CustomerProfileOption {
  actorId: string;
  fullName: string;
  role: Role;
}

export interface BindWalletView {
  binding: WalletBindingView;
  /** Mã giao dịch whitelist; `null` khi ví đã whitelist từ trước, không gửi giao dịch. */
  txHash: string | null;
  /** `false` khi ví đã gắn đúng hồ sơ này từ trước. */
  created: boolean;
}

export interface WalletBindingListView {
  rows: WalletBindingView[];
  /** Đủ `WALLET_BINDING_LIST_LIMIT` dòng: có thể còn ví cũ hơn không hiện. */
  truncated: boolean;
  /** Hồ sơ khách hàng cho ô chọn ở màn, để màn chỉ cần một action khi mở. */
  profiles: CustomerProfileOption[];
}

function toView(record: WalletBindingRecord): WalletBindingView {
  const profile = findCustomerProfile(record.actorId);
  return {
    wallet: record.wallet,
    actorId: record.actorId,
    profileName: profile?.fullName ?? record.actorId,
    role: profile?.role ?? 'INVESTOR',
    boundBy: record.boundBy,
    boundAt: record.boundAt,
  };
}

/** Ví thuộc hồ sơ khác: ví đã gắn cho hồ sơ khác, hoặc (chain thử nghiệm) là ví mẫu của hồ sơ khác. */
async function ownedByOtherProfile(chain: ChainKey, wallet: string, actorId: string): Promise<boolean> {
  const binding = await getWalletBindingStore().findByWallet(chain, wallet);
  if (binding) return binding.actorId !== actorId;
  if (!usesSampleWallets(chain)) return false;
  const key = wallet.toLowerCase();
  return listCustomerProfiles().some((profile) => profile.actorId !== actorId && profile.wallet.toLowerCase() === key);
}

/**
 * Giao dịch viên định danh ví trên chuỗi và gắn ví cho hồ sơ khách hàng (A1). Thứ tự:
 * quyền, dạng ví, hồ sơ, ví mẫu công khai, ví thuộc hồ sơ khác, KYC, whitelist chờ biên nhận, ghi gắn.
 * Mọi kết cục từ bước kiểm hồ sơ trở đi vào sổ `profile:wallet:bind`.
 */
export async function bindProfileWallet(input: unknown): Promise<Result<BindWalletView>> {
  const parsed = bindWalletSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain, actorId } = parsed.data;

  let role: Role;
  try {
    // Hai quyền như `onboardInvestor`; một lần ghi sổ cho cả hai (DENIED khi thiếu một trong hai).
    role = await authorize('investor:whitelist', parsed.data.wallet, chain, (r, action) => {
      assertCan(r, action);
      assertCan(r, 'kyc:approve');
    });
  } catch (error) {
    return toResult(error);
  }

  let wallet: string;
  try {
    wallet = normalizeEvmAddress(parsed.data.wallet);
  } catch (error) {
    return toResult(error);
  }

  const boundBy = await currentActorId(role);
  const audit = (outcome: 'SUCCESS' | 'FAILURE', detail: string) =>
    getStore().appendAudit({
      actorRole: role,
      action: 'profile:wallet:bind',
      target: wallet,
      outcome,
      detail: `hồ sơ ${actorId}, ví ${wallet}, chain ${chain}: ${detail}`,
      chain,
    });
  const fail = async (code: 'VALIDATION' | 'PROVIDER' | 'LEDGER', message: string, field?: 'actorId' | 'wallet') => {
    await audit('FAILURE', message);
    return err<BindWalletView>(code, message, field ? { [field]: [message] } : undefined);
  };

  const profile = findCustomerProfile(actorId);
  if (!profile) return fail('VALIDATION', `Không có hồ sơ khách hàng ${actorId}.`, 'actorId');
  if (!usesSampleWallets(chain) && isPublicSampleWallet(wallet)) {
    return fail('VALIDATION', PUBLIC_SAMPLE_MESSAGE, 'wallet');
  }

  try {
    if (await ownedByOtherProfile(chain, wallet, actorId)) return await fail('VALIDATION', TAKEN_MESSAGE, 'wallet');

    const kyc = await getKycProvider().verify({ wallet, fullName: profile.fullName });
    if (!kyc.approved) return await fail('PROVIDER', `KYC từ chối: ${kyc.reason ?? 'không rõ lý do'}`);

    const ledger = getLedger(chain);
    let txHash: string | null = null;
    if (!(await ledger.isWhitelisted(wallet))) {
      const pending = await ledger.whitelist(wallet);
      txHash = pending.txHash;
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
        actorAddress: await getBankSigner(chain).getAddress(),
      });
      await store.appendAudit({
        actorRole: role,
        action: 'investor:whitelist',
        target: wallet,
        outcome: receipt.status === 'CONFIRMED' ? 'SUCCESS' : 'FAILURE',
        detail: `KYC ${kyc.reference} (${kyc.provider}); tx ${receipt.txHash} ${receipt.status}`,
        chain,
      });
      // Chỉ gắn khi whitelist đã chắc chắn lên chuỗi: chưa có biên nhận cũng không gắn.
      if (receipt.status !== 'CONFIRMED') {
        return await fail(
          'LEDGER',
          receipt.status === 'PENDING'
            ? `Giao dịch định danh ${receipt.txHash} chưa có biên nhận; chưa gắn ví. Thử lại sau khi giao dịch có kết cục.`
            : `Giao dịch định danh ${receipt.txHash} thất bại${receipt.reason ? `: ${receipt.reason}` : ''}; chưa gắn ví.`,
        );
      }
    }

    let record: WalletBindingRecord;
    let created: boolean;
    try {
      ({ record, created } = await getWalletBindingStore().bind({ chain, wallet, actorId, boundBy }));
    } catch (error) {
      // Khoá chính là trọng tài khi hai lần gắn tranh nhau.
      if (error instanceof UniqueConstraintError) return await fail('VALIDATION', TAKEN_MESSAGE, 'wallet');
      throw error;
    }
    await audit(
      'SUCCESS',
      `${created ? 'đã gắn' : 'đã gắn từ trước'}; ${txHash ? `whitelist tx ${txHash}` : 'ví đã whitelist từ trước, không gửi giao dịch'}.`,
    );
    return ok({ binding: toView(record), txHash, created });
  } catch (error) {
    const result = toResult<BindWalletView>(error);
    await audit('FAILURE', result.ok ? 'Lỗi không xác định.' : result.error);
    return result;
  }
}

/**
 * Danh sách ví đã gắn trên chain (A2). Chỉ đọc database, không đọc trạng thái whitelist trên chuỗi
 * cho từng dòng; không ghi sổ kiểm toán mỗi lần mở màn.
 */
export async function listWalletBindings(input: unknown): Promise<Result<WalletBindingListView>> {
  const parsed = listWalletBindingsSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  try {
    assertCan(await currentRole(), 'investor:whitelist');
    const records = await getWalletBindingStore().list(parsed.data.chain, WALLET_BINDING_LIST_LIMIT);
    return ok({
      rows: records.map(toView),
      truncated: records.length >= WALLET_BINDING_LIST_LIMIT,
      profiles: listCustomerProfiles().map((profile) => ({
        actorId: profile.actorId,
        fullName: profile.fullName,
        role: profile.role,
      })),
    });
  } catch (error) {
    return toResult(error);
  }
}
