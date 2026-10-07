import 'server-only';

import { z } from 'zod';
import type { ChainKey, TxStatus } from '@bidv/shared';
import { DEMO_PAYMENT_QUICK_AMOUNTS } from '@/lib/config/issue-terms';
import { formatAmount } from '@/lib/format';
import { getLedger, receiptTimeoutFor } from '@/lib/ledger';
import { assertCanMintDemoPayment } from '@/lib/rbac/demo-payment';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { getStore } from '@/lib/store';
import { readDemoPaymentMintMax } from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import { signerAddressOrNull } from './issuance.service';
import type { TxnView } from './mint.service';
import { err, ok, type Result } from './result';
import { chainSchema, mintSchema } from './schemas';

/**
 * NẠP VNDB MÔ PHỎNG cho bản trình diễn (BE-16): Giao dịch viên phát hành VNDB vào ví nhà đầu tư hoặc
 * ví người bán, để luồng mua có tiền mà chạy.
 *
 * ⚠️ Đây là đường TẠO RA TIỀN. Nó nằm sau HAI LỚP CHẶN qua `authorize(..., assertCanMintDemoPayment)`:
 * cờ `ENABLE_DEMO_PAYMENT_MINT` trước (PoC mặc định bật; production bắt buộc đặt false), quyền
 * `demo:mint-payment` sau (chỉ `TELLER`). Bỏ một lớp là cán bộ ngân hàng tự tạo được tiền trên môi
 * trường thật. Lần bị chặn ở cả hai lớp đều vào sổ kiểm toán (`authorize` ghi `DENIED`).
 *
 * Chọn chức năng có kiểm soát thay vì nạp sẵn số dư trong dữ liệu khởi tạo: số dư nạp sẵn lệch ngay
 * khi chuyển sang mạng thử (số dư thật nằm trên chuỗi), còn chức năng này tắt được bằng một cờ.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `authorize()`. Ký: adapter tự lấy `ISigner` (LUẬT #2).
 */

/** Tên thao tác trong bảng `Txn` — một chỗ, để ghi và lọc lịch sử không lệch chữ. */
export const DEMO_PAYMENT_OPERATION = 'payment-mint';

export interface DemoPaymentResult {
  wallet: string;
  /** Chuỗi thập phân: bigint không qua được biên server -> client an toàn. */
  amount: string;
  txHash: string;
  status: TxStatus;
  /** Số dư VNDB của ví đích, đọc lại từ chuỗi sau khi xác nhận. */
  balanceAfter: string;
  chain: ChainKey;
}

export interface DemoPaymentContext {
  chain: ChainKey;
  /** Trần một lần nạp đang có hiệu lực (cấu hình), VNDB. */
  maxAmount: string;
  /** Ví thanh toán của người bán; `null` khi chưa phát hành hoặc chuỗi chưa đọc được. */
  spvWallet: string | null;
  /** Gợi ý nhanh, đã lọc bỏ mức vượt trần. */
  quickAmounts: Array<{ label: string; amount: string }>;
  /** Các lần nạp gần nhất, mới nhất trước. */
  history: TxnView[];
}

/** Ví người bán, hoặc `null` khi chuỗi chưa trả lời được (chain thật chờ SC-02). */
async function readSpvWallet(chain: ChainKey): Promise<string | null> {
  try {
    return await getLedger(chain).spvWallet();
  } catch {
    return null;
  }
}

const sameWallet = (a: string, b: string | null) => b !== null && a.toLowerCase() === b.toLowerCase();

/**
 * Nạp `amount` VNDB vào `wallet`. Trả số dư VNDB của ví sau khi nạp.
 *
 * Thứ tự: hai lớp chặn -> trần cấu hình -> ví đích hợp lệ -> gửi giao dịch. Mọi phép kiểm chạy
 * TRƯỚC khi gửi, và mọi lần bị chặn sau hai lớp đầu cũng vào sổ kiểm toán kèm ai, ví nào, bao nhiêu.
 */
export async function mintDemoPayment(input: unknown): Promise<Result<DemoPaymentResult>> {
  const parsed = mintSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet, amount } = parsed.data;

  try {
    const role = await authorize('demo:mint-payment', wallet, chain, assertCanMintDemoPayment);
    const actor = await currentActorId(role);
    const ledger = getLedger(chain);
    const store = getStore();
    const what = `${actor} (${role}) nạp ${amount} VNDB vào ví ${wallet}`;

    const blocked = async (code: 'PAYMENT_MINT_LIMIT' | 'NOT_WHITELISTED', reason: string) => {
      await store.appendAudit({
        actorRole: role,
        action: 'demo:mint-payment',
        target: wallet,
        outcome: 'FAILURE',
        detail: `Bị chặn (không gửi tx): ${what}. ${reason}`,
        chain,
      });
      return err<DemoPaymentResult>(code, reason);
    };

    const max = await readDemoPaymentMintMax();
    if (amount > max) {
      return blocked('PAYMENT_MINT_LIMIT', `Số tiền vượt trần một lần nạp ${formatAmount(max)} VNDB (cấu hình).`);
    }

    // Danh sách nhà đầu tư = ví đã KYC/whitelist trên chuỗi; ngoại lệ duy nhất là ví người bán.
    if (!(await ledger.isWhitelisted(wallet)) && !sameWallet(wallet, await readSpvWallet(chain))) {
      return blocked(
        'NOT_WHITELISTED',
        `Ví ${wallet} không có trong danh sách nhà đầu tư (chưa KYC/whitelist) và không phải ví người bán.`,
      );
    }

    const pending = await ledger.mintPayment(wallet, amount);
    // Lưu ngay ở PENDING: tiến trình chết lúc chờ biên nhận thì giao dịch vẫn còn dấu để đối soát.
    const saved = await store.saveTxn({
      chain,
      operation: DEMO_PAYMENT_OPERATION,
      txHash: pending.txHash,
      status: pending.status,
      fromWallet: null,
      toWallet: wallet,
      amount: amount.toString(),
      reason: null,
      actorRole: role,
      actorAddress: await signerAddressOrNull(chain),
    });

    const receipt = await ledger.waitReceipt(pending.txHash, receiptTimeoutFor(chain));
    await store.updateTxnStatus(saved.id, receipt.status, receipt.reason);
    await store.appendAudit({
      actorRole: role,
      action: 'demo:mint-payment',
      target: wallet,
      outcome: receipt.status === 'CONFIRMED' ? 'SUCCESS' : 'FAILURE',
      detail: `${what}; tx ${receipt.txHash} ${receipt.status}`,
      chain,
    });

    if (receipt.status === 'FAILED') {
      return err('LEDGER', receipt.reason ?? 'Giao dịch nạp VNDB thất bại trên chuỗi.');
    }

    return ok({
      wallet,
      amount: amount.toString(),
      txHash: receipt.txHash,
      status: receipt.status,
      balanceAfter: (await ledger.paymentBalanceOf(wallet)).toString(),
      chain,
    });
  } catch (error) {
    return toResult(error);
  }
}

const contextSchema = z.object({ chain: chainSchema });

/**
 * Dữ liệu cho màn nạp VNDB: trần, ví người bán, gợi ý nhanh, lịch sử.
 *
 * Cùng hai lớp chặn với `mintDemoPayment` nhưng KHÔNG ghi sổ kiểm toán: màn gọi hàm này mỗi lần mở
 * và sau mỗi lần nạp, ghi mỗi lần đọc sẽ nhấn chìm sổ (cùng lý do với `previewPurchase`).
 */
export async function demoPaymentContext(input: unknown): Promise<Result<DemoPaymentContext>> {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain } = parsed.data;

  try {
    assertCanMintDemoPayment(await currentRole());
    const [max, spvWallet, recent] = await Promise.all([
      readDemoPaymentMintMax(),
      readSpvWallet(chain),
      // ponytail: lọc thao tác sau khi lấy 200 giao dịch mới nhất; lần nạp cũ hơn thế không hiện.
      // Thêm bộ lọc `operation` vào `ITxnStore.listTxns` khi lịch sử cần đầy đủ.
      getStore().listTxns({ chain, limit: 200 }),
    ]);

    return ok({
      chain,
      maxAmount: max.toString(),
      spvWallet,
      quickAmounts: DEMO_PAYMENT_QUICK_AMOUNTS.filter((q) => BigInt(q.amountVnd) <= max).map((q) => ({
        label: q.label,
        amount: String(q.amountVnd),
      })),
      history: recent
        .filter((row) => row.operation === DEMO_PAYMENT_OPERATION)
        .map((row) => ({
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
    });
  } catch (error) {
    return toResult(error);
  }
}
