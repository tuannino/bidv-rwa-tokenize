import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger, type VaultLockMode } from '@/lib/ledger';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

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

export interface VaultOverviewView {
  chain: ChainKey;
  status: VaultStatusView | null;
  history: VaultPeriodCloseView[];
  /** Lỗi lịch sử không được che trạng thái hiện tại, nhất là khi address book cũ thiếu deployBlock. */
  historyError: string | null;
}

/** Trạng thái công khai của vault. Chỉ đọc, nhưng vẫn kiểm quyền ở tầng máy chủ. */
export async function getVaultOverview(input: unknown): Promise<Result<VaultOverviewView>> {
  const parsed = chainSchema.safeParse(
    typeof input === 'object' && input !== null ? (input as { chain?: unknown }).chain : undefined,
  );
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  const chain = parsed.data;

  try {
    await authorize('vault:read', null, chain);
    const ledger = getLedger(chain);
    const status = await ledger.vaultStatus();
    if (status === null) return ok({ chain, status: null, history: [], historyError: null });

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

    return ok({
      chain,
      status: {
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
      },
      history,
      historyError,
    });
  } catch (error) {
    return toResult(error);
  }
}
