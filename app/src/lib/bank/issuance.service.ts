import 'server-only';

import type { ChainKey, TxStatus } from '@bidv/shared';
import { getLedger, receiptTimeoutFor } from '@/lib/ledger';
import { getBankSigner } from '@/lib/signer';
import { getProjectStore, getStore } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import { issueInitialSupplySchema } from './schemas';

/**
 * Nghiệp vụ PHÁT HÀNH NGUỒN CUNG BAN ĐẦU — một lần cho cả dự án.
 *
 * Khác `mintToInvestorDirect`: đây là hành vi MỘT LẦN đưa TOÀN BỘ nguồn cung vào ví thanh toán
 * SPV. Sau lần này, WPT đến tay nhà đầu tư qua `executeOrder` (chuyển từ ví SPV), KHÔNG mint thêm.
 *
 * ## Ba chốt chặn, theo đúng thứ tự
 *
 * 1. **Tổng cung đọc từ `Project`**, không nhận từ input. Nhận từ input thì ai gọi được server
 *    action cũng đặt được quy mô phát hành của cả dự án.
 * 2. **Khoá lạc quan ở `markIssued`**, không phải "đọc `issuedAt` rồi mới ghi". Hai lời gọi đồng
 *    thời đều thấy `null`, đều kết luận "chưa phát hành", rồi cùng gửi giao dịch mint — và nguồn
 *    cung ra gấp đôi con số đã công bố. Chuỗi cũng chặn (`isInitialSupplyMinted`), nhưng chặn ở
 *    cơ sở dữ liệu TRƯỚC thì không tốn một giao dịch chắc chắn bị revert.
 * 3. **Lưu giao dịch ở trạng thái chờ TRƯỚC khi đợi biên nhận.** Tiến trình chết lúc đang đợi thì
 *    giao dịch vẫn còn vết để đối soát, chứ không biến mất khỏi hệ thống.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #2 ký qua `getBankSigner()` · LUẬT #3 quyền qua `authorize()`.
 */

/**
 * Địa chỉ ví đang ký, `null` khi chain này không có signer.
 *
 * Vì sao không để lỗi lọt ra: `actorAddress` là DỮ LIỆU ĐỐI SOÁT trên dòng giao dịch, không phải
 * đầu vào của phép kiểm quyền nào — quyền đã do `authorize()` quyết định xong ở trên. Chuỗi `mock`
 * không ký gì cả nên không có địa chỉ để ghi, và làm cả lượt phát hành thất bại vì thiếu một nhãn
 * đối soát là đánh đổi sai: nó chặn đúng luồng chính của BE-04 ở chế độ triển khai mặc định của
 * demo công khai.
 *
 * `null` là câu trả lời có nghĩa ở đây — cột `actorAddress` vốn nullable, và `tokenOverview` trong
 * `mint.service.ts` đã xử lý cùng tình huống theo cùng cách.
 *
 * ⚠️ KHÔNG mở rộng cách này sang chuỗi thật: ở đó thiếu signer nghĩa là `mintInitialSupply` sẽ
 * thất bại ngay ở bước gửi giao dịch, trước khi tới đây.
 */
async function signerAddressOrNull(chain: ChainKey): Promise<string | null> {
  try {
    return await getBankSigner(chain).getAddress();
  } catch {
    return null;
  }
}

export interface IssueInitialSupplyView {
  chain: ChainKey;
  tokenSymbol: string;
  /** Ví thanh toán SPV đang giữ toàn bộ nguồn cung. */
  spvWallet: string;
  /** Số WPT đã phát hành, lấy từ `Project.totalSupply`. Chuỗi vì bigint không qua được biên. */
  amount: string;
  txHash: string;
  status: TxStatus;
  /** Tổng cung ĐỌC LẠI TỪ CHUỖI sau khi xong — sự thật cuối cùng, không phải con số đã gửi đi. */
  totalSupplyOnChain: string;
  issuedAt: string;
}

/**
 * Phát hành toàn bộ nguồn cung vào ví thanh toán SPV.
 *
 * @flow issue:2 | validate, kiểm quyền token:mint, đọc tổng cung từ bảng dự án
 */
export async function issueInitialSupply(
  input: unknown,
): Promise<Result<IssueInitialSupplyView>> {
  const parsed = issueInitialSupplySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, spvWallet, tokenSymbol } = parsed.data;

  try {
    const role = await authorize('token:mint', spvWallet, chain);

    const projectStore = getProjectStore();
    const project = await projectStore.findProject({ tokenSymbol, chain });
    if (!project) {
      return err(
        'VALIDATION',
        `Chưa có dự án "${tokenSymbol}" trên chain "${chain}". ` +
          `Tổng cung phát hành lấy từ bảng dự án, nên phải tạo dự án trước khi phát hành.`,
      );
    }

    // Chặn sớm ở cơ sở dữ liệu. Chốt chặn THẬT là `markIssued` phía dưới (nguyên tử); nhánh này
    // chỉ để không tốn một giao dịch on-chain cho lần gọi thứ hai.
    if (project.issuedAt !== null) {
      return err(
        'ORDER_STATE',
        `Dự án "${tokenSymbol}" đã phát hành nguồn cung ban đầu lúc ${project.issuedAt}. ` +
          `Không phát hành lần hai — muốn thêm nguồn cung thì phải qua quy trình tăng vốn riêng.`,
      );
    }

    const ledger = getLedger(chain);
    const store = getStore();

    // Chuỗi cũng giữ cờ riêng. Hỏi luôn để bắt được trường hợp cơ sở dữ liệu và chuỗi lệch nhau
    // (ví dụ đã phát hành rồi nhưng bước ghi `issuedAt` thất bại ở lần trước).
    if (await ledger.isInitialSupplyMinted()) {
      return err(
        'ORDER_STATE',
        `Chuỗi "${chain}" báo đã phát hành nguồn cung ban đầu, trong khi bảng dự án chưa ghi mốc ` +
          `phát hành. Đối soát trước khi thử lại: chuỗi là nguồn sự thật cuối cùng.`,
      );
    }

    const amount = BigInt(project.totalSupply);

    // @flow issue:3 | gửi giao dịch phát hành toàn bộ nguồn cung vào ví SPV
    const pending = await ledger.mintInitialSupply(spvWallet, amount);

    // @flow issue:4 | lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận
    const saved = await store.saveTxn({
      chain,
      operation: 'mintInitialSupply',
      txHash: pending.txHash,
      status: pending.status,
      fromWallet: null,
      toWallet: spvWallet,
      amount: amount.toString(),
      reason: null,
      actorRole: role,
      actorAddress: await signerAddressOrNull(chain),
    });

    // @flow issue:5 | đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch
    const receipt = await ledger.waitReceipt(pending.txHash, receiptTimeoutFor(chain));
    await store.updateTxnStatus(saved.id, receipt.status, receipt.reason);

    if (receipt.status === 'FAILED') {
      await store.appendAudit({
        actorRole: role,
        action: 'token:mint',
        target: spvWallet,
        outcome: 'FAILURE',
        detail: `Phát hành ${amount} ${tokenSymbol} thất bại on-chain; tx ${receipt.txHash}`,
        chain,
      });
      // KHÔNG đánh dấu `issuedAt`: giao dịch revert nghĩa là chưa phát hành, và đánh dấu ở đây sẽ
      // khoá vĩnh viễn một dự án chưa có token nào.
      return err('LEDGER', receipt.reason ?? 'Giao dịch phát hành nguồn cung thất bại on-chain.');
    }

    // @flow issue:6 | ghi mốc phát hành vào bảng dự án bằng khoá lạc quan
    const issuedAt = new Date().toISOString();
    const marked = await projectStore.markIssued({ id: project.id, issuedAt });
    if (!marked) {
      /**
       * Giao dịch ĐÃ thành công nhưng không ghi được mốc. Không trả `ok`: trạng thái cần người
       * đối soát, và báo thành công sẽ làm không ai đi xem.
       *
       * Cũng KHÔNG thử lại: `markIssued` trả `null` nghĩa là dòng đã bị đổi bởi một lời gọi khác,
       * nên thử lại chỉ trượt tiếp. Thông báo nêu đúng mã giao dịch để tra.
       */
      await store.appendAudit({
        actorRole: role,
        action: 'token:mint',
        target: spvWallet,
        outcome: 'FAILURE',
        detail:
          `Đã phát hành ${amount} ${tokenSymbol} on-chain (tx ${receipt.txHash}) nhưng KHÔNG ghi ` +
          `được mốc phát hành vào bảng dự án — dòng đã bị đổi bởi lời gọi khác.`,
        chain,
      });
      return err(
        'ORDER_STATE',
        `Đã phát hành xong on-chain (tx ${receipt.txHash}) nhưng bảng dự án đã được một lời gọi ` +
          `khác cập nhật trước. Đối soát bảng dự án với chuỗi trước khi làm gì tiếp.`,
      );
    }

    // @flow issue:7 | đọc lại tổng cung từ chuỗi làm sự thật cuối cùng
    // Không tin con số đã gửi đi: contract mới là nơi quyết định tổng cung cuối cùng.
    const info = await ledger.tokenInfo();

    await store.appendAudit({
      actorRole: role,
      action: 'token:mint',
      target: spvWallet,
      outcome: 'SUCCESS',
      detail:
        `Phát hành một lần ${amount} ${tokenSymbol} vào ví SPV; tổng cung trên chuỗi ` +
        `${info.totalSupply}; tx ${receipt.txHash}`,
      chain,
    });

    return ok({
      chain,
      tokenSymbol,
      spvWallet,
      amount: amount.toString(),
      txHash: receipt.txHash,
      status: receipt.status,
      totalSupplyOnChain: info.totalSupply.toString(),
      issuedAt: marked.issuedAt ?? issuedAt,
    });
  } catch (error) {
    return toResult(error);
  }
}

export interface IssuanceStatusView {
  chain: ChainKey;
  tokenSymbol: string;
  /** Tổng cung DỰ KIẾN theo bảng dự án — con số sẽ phát hành. */
  plannedTotalSupply: string;
  /** Tổng cung THẬT trên chuỗi. Bằng 0 khi chưa phát hành. */
  totalSupplyOnChain: string;
  issuedAt: string | null;
  /** Ví SPV theo chuỗi; `null` khi chưa phát hành. */
  spvWallet: string | null;
}

/**
 * Trạng thái phát hành: con số DỰ KIẾN (bảng dự án) đứng cạnh con số THẬT (chuỗi).
 *
 * Trả về cả hai thay vì một, vì chúng trả lời hai câu khác nhau và lệch nhau là tín hiệu cần đối
 * soát — gộp thành một con số là bỏ mất chính tín hiệu đó.
 *
 * @flow issue:9 | đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi
 */
export async function getIssuanceStatus(input: unknown): Promise<Result<IssuanceStatusView>> {
  const parsed = issueInitialSupplySchema
    .omit({ spvWallet: true })
    .safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, tokenSymbol } = parsed.data;

  try {
    await authorize('balance:read', null, chain);

    const project = await getProjectStore().findProject({ tokenSymbol, chain });
    if (!project) {
      return err('VALIDATION', `Chưa có dự án "${tokenSymbol}" trên chain "${chain}".`);
    }

    const ledger = getLedger(chain);
    const [info, spvWallet] = await Promise.all([ledger.tokenInfo(), ledger.spvWallet()]);

    return ok({
      chain,
      tokenSymbol,
      plannedTotalSupply: project.totalSupply,
      totalSupplyOnChain: info.totalSupply.toString(),
      issuedAt: project.issuedAt,
      spvWallet,
    });
  } catch (error) {
    return toResult(error);
  }
}
