import 'server-only';

import type { ChainKey, TxResult, TxStatus } from '@bidv/shared';
import { getLedger, receiptTimeoutFor } from '@/lib/ledger';
import type { Role } from '@/lib/rbac';
import { getBankSigner } from '@/lib/signer';
import { getProjectStore, getStore, type ProjectRecord } from '@/lib/store';
import { assertCanMintDemoToken } from '@/lib/rbac/demo-payment';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import { issueInitialSupplySchema } from './schemas';

/**
 * Nghiệp vụ PHÁT HÀNH vào ví thanh toán SPV — NHIỀU LẦN, mỗi lần không vượt trần còn lại (BE-12).
 *
 * Trước BE-12 đây là hành vi MỘT LẦN đưa toàn bộ nguồn cung vào ví SPV. Tài liệu yêu cầu có khái
 * niệm trần phát hành và số còn được phát hành, nên chốt chặn "một lần" được thay bằng:
 *
 *     trần còn lại = Project.totalSupply − tổng cung hiện tại trên chuỗi
 *
 * ## Bốn chốt chặn, theo đúng thứ tự
 *
 * 1. **Trần đọc từ `Project`**, không nhận từ input. Input chỉ được chọn số lượng TRONG trần.
 * 2. **Tổng cung đọc từ chuỗi**, không cộng dồn trong cơ sở dữ liệu: Burn làm giảm tổng cung, và
 *    một bộ đếm riêng sẽ lệch chuỗi ngay lần Burn đầu tiên.
 * 3. **Lần đầu đi qua `mintInitialSupply`** — chuỗi ghi lại ví SPV ở lần đó, và luồng mua đọc
 *    ví SPV từ chuỗi. Các lần sau đi qua `mint` vào ĐÚNG ví SPV chuỗi đã ghi.
 * 4. **Lưu giao dịch ở trạng thái chờ TRƯỚC khi đợi biên nhận.**
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
 * ⚠️ KHÔNG mở rộng cách này sang chuỗi thật: ở đó thiếu signer nghĩa là giao dịch sẽ thất bại ngay
 * ở bước gửi, trước khi tới đây.
 */
export async function signerAddressOrNull(chain: ChainKey): Promise<string | null> {
  try {
    return await getBankSigner(chain).getAddress();
  } catch {
    return null;
  }
}

/**
 * Lưu giao dịch đã gửi ở trạng thái chờ, báo mã giao dịch cho người gọi, rồi đợi biên nhận.
 *
 * Dùng chung cho phát hành và cho Burn của `token-request.service.ts`: thứ tự "lưu trước, đợi
 * sau" là thứ giữ cho tiến trình chết giữa chừng vẫn để lại vết đối soát, và chép thứ tự đó ra
 * hai nơi là để một nơi lệch đi ở lần sửa đầu tiên.
 *
 * `onSubmitted` chạy SAU khi giao dịch có vết trong sổ và TRƯỚC khi đợi biên nhận — chỗ lần duyệt
 * yêu cầu gắn mã giao dịch vào yêu cầu.
 */
export async function trackTxn(input: {
  chain: ChainKey;
  pending: TxResult;
  operation: string;
  fromWallet: string | null;
  toWallet: string | null;
  amount: bigint;
  role: Role;
  onSubmitted?: (txHash: string) => Promise<void>;
}): Promise<TxResult> {
  const { chain, pending } = input;
  const store = getStore();

  // @flow issue:4 | lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận
  const saved = await store.saveTxn({
    chain,
    operation: input.operation,
    txHash: pending.txHash,
    status: pending.status,
    fromWallet: input.fromWallet,
    toWallet: input.toWallet,
    amount: input.amount.toString(),
    reason: null,
    actorRole: input.role,
    actorAddress: await signerAddressOrNull(chain),
  });
  await input.onSubmitted?.(pending.txHash);

  // @flow issue:5 | đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch
  const receipt = await getLedger(chain).waitReceipt(pending.txHash, receiptTimeoutFor(chain));
  await store.updateTxnStatus(saved.id, receipt.status, receipt.reason);
  return receipt;
}

/**
 * Trần còn lại = trần trong bảng dự án − tổng cung hiện tại trên chuỗi. Không âm.
 *
 * Không âm vì tổng cung vượt trần là tình huống ĐỐI SOÁT (ai đó phát hành ngoài hệ thống), không
 * phải "còn âm N token để phát hành"; người gọi so `amount > remaining` nên 0 là đủ để chặn.
 */
export async function remainingIssuanceCap(
  chain: ChainKey,
  project: ProjectRecord,
): Promise<{ cap: bigint; supply: bigint; remaining: bigint }> {
  const cap = BigInt(project.totalSupply);
  const { totalSupply: supply } = await getLedger(chain).tokenInfo();
  return { cap, supply, remaining: supply >= cap ? 0n : cap - supply };
}

/** Năm chỉ tiêu nguồn cung của một token. Chuỗi vì `bigint` không qua được biên. */
export interface SupplyMetrics {
  /** Trần phát hành theo bảng dự án. */
  cap: string;
  /** Số còn được phát hành: trần − tổng cung, không âm. */
  remaining: string;
  /** Tổng cung hiện tại, đọc từ chuỗi. */
  totalSupply: string;
  /** Chưa phân phối: WPT còn trong ví thanh toán SPV. 0 khi chưa phát hành. */
  undistributed: string;
  /** Đang lưu hành: tổng cung − chưa phân phối, tức WPT đã ra tay nhà đầu tư. */
  circulating: string;
}

/**
 * Năm chỉ tiêu nguồn cung, tính MỘT chỗ ở máy chủ (FE-21 yêu cầu 16).
 *
 * Màn Người bán và màn Giao dịch viên phải ra cùng con số ở cùng thời điểm, nên cả hai đọc qua
 * hàm này; giao diện chỉ hiển thị. Từ FE-22 khối kiểm tra Burn và khối thông tin token của
 * `token-request.service.ts` cũng gọi thẳng hàm này, không còn công thức thứ hai.
 */
export async function readSupplyMetrics(chain: ChainKey, project: ProjectRecord): Promise<SupplyMetrics> {
  const ledger = getLedger(chain);
  const [{ cap, supply, remaining }, spv] = await Promise.all([
    remainingIssuanceCap(chain, project),
    ledger.spvWallet(),
  ]);
  const undistributed = spv ? await ledger.balanceOf(spv) : 0n;
  return {
    cap: cap.toString(),
    remaining: remaining.toString(),
    totalSupply: supply.toString(),
    undistributed: undistributed.toString(),
    circulating: (supply - undistributed).toString(),
  };
}

export interface IssueInitialSupplyView {
  chain: ChainKey;
  tokenSymbol: string;
  /** Ví thanh toán SPV nhận phần phát hành. */
  spvWallet: string;
  /** Số WPT đã phát hành LẦN NÀY. Chuỗi vì bigint không qua được biên. */
  amount: string;
  txHash: string;
  status: TxStatus;
  /** Tổng cung ĐỌC LẠI TỪ CHUỖI sau khi xong — sự thật cuối cùng, không phải con số đã gửi đi. */
  totalSupplyOnChain: string;
  /** Trần còn lại sau lần này. */
  remainingCap: string;
  /** Mốc phát hành LẦN ĐẦU của dự án. */
  issuedAt: string;
}

/**
 * Phát hành `amount` vào ví SPV, KHÔNG kiểm quyền — người gọi đã kiểm.
 *
 * Tách khỏi `issueInitialSupply` vì có hai đường vào với hai chốt chặn khác nhau: lần duyệt yêu cầu
 * Mint chạy bằng `order:approve` của Kiểm soát viên (đường chính thức), còn `issueInitialSupply` là
 * đường dữ liệu thử sau hai lớp chặn `demo:mint-token` + cờ (FE-22). Bắt lần duyệt đi qua một quyền
 * tạo token trực tiếp thì phải cấp quyền đó cho Kiểm soát viên — tức cho họ tự phát hành không qua ai.
 *
 * ⚠️ Chỉ hai nơi được gọi hàm này: `approveTokenRequest` và `issueInitialSupply`.
 * `test/maker-checker-ui.test.ts` ca 10 quét mã nguồn để giữ điều đó.
 *
 * Trần còn lại được kiểm LẠI ở đây, ngay trước khi gửi, dù người gọi đã kiểm: đây là chốt cuối
 * cùng trước khi token ra đời, và nó không được phụ thuộc vào việc mọi người gọi đều nhớ kiểm.
 */
export async function executeIssuance(input: {
  chain: ChainKey;
  project: ProjectRecord;
  spvWallet: string;
  amount: bigint;
  role: Role;
  /** Câu mở đầu cho dòng sổ kiểm toán, ví dụ mã yêu cầu đã được duyệt. */
  auditContext?: string;
  onSubmitted?: (txHash: string) => Promise<void>;
}): Promise<Result<IssueInitialSupplyView>> {
  const { chain, project, spvWallet, amount, role } = input;
  const { tokenSymbol } = project;
  const ledger = getLedger(chain);
  const store = getStore();
  const context = input.auditContext ? `${input.auditContext}: ` : '';

  const minted = await ledger.isInitialSupplyMinted();
  let issuedAt = project.issuedAt;

  // Chuỗi đã phát hành mà bảng dự án chưa ghi mốc: hai nguồn lệch nhau (ví dụ lần trước giao dịch
  // thành công rồi tiến trình chết trước khi ghi mốc, hoặc DB mới trỏ vào bộ contract đã chạy).
  // Chuỗi là nguồn sự thật cuối cùng: ghi bù mốc, nhưng chính bước đối soát KHÔNG phát hành token.
  if (minted && issuedAt === null) {
    const reconciled = await getProjectStore().markIssued({
      id: project.id,
      issuedAt: new Date().toISOString(),
    });
    if (reconciled) {
      issuedAt = reconciled.issuedAt;
      await store.appendAudit({
        actorRole: role,
        action: 'token:mint',
        target: spvWallet,
        outcome: 'SUCCESS',
        detail:
          `${context}Đối soát mốc phát hành từ chuỗi, không phát hành thêm; ` +
          `chain ${chain}, dự án ${tokenSymbol}.`,
        chain,
      });
    } else {
      // Một request khác có thể vừa ghi xong giữa phép đọc và markIssued. Đọc lại rồi đi tiếp
      // nếu mốc đã có; chỉ lỗi khi cả chuỗi và lần đọc lại vẫn không thể làm DB hội tụ.
      const current = await getProjectStore().findProject({ tokenSymbol, chain });
      if (!current?.issuedAt) {
        return err(
          'ORDER_STATE',
          `Chuỗi "${chain}" đã phát hành nhưng không ghi hoặc đọc lại được mốc phát hành của ` +
            `dự án ${tokenSymbol}. Cần kiểm tra cơ sở dữ liệu trước khi thử lại.`,
        );
      }
      issuedAt = current.issuedAt;
    }
  }

  const { remaining } = await remainingIssuanceCap(chain, project);
  if (amount > remaining) {
    return err(
      'ISSUANCE_CAP',
      `Phát hành ${amount} ${tokenSymbol} vượt trần còn lại ${remaining} ` +
        `(trần ${project.totalSupply} trong bảng dự án trừ tổng cung hiện tại trên chuỗi).`,
    );
  }

  // Các lần sau lần đầu chỉ được vào ĐÚNG ví SPV mà chuỗi đã ghi: luồng mua bán từ ví đó.
  const registeredSpv = minted ? await ledger.spvWallet() : null;
  if (registeredSpv && registeredSpv.toLowerCase() !== spvWallet.toLowerCase()) {
    return err(
      'VALIDATION',
      `Ví nhận phải là ví thanh toán SPV đã đăng ký trên chuỗi (${registeredSpv}), ` +
        `không phải ${spvWallet}.`,
    );
  }

  // @flow issue:3 | gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint
  const pending = minted
    ? await ledger.mint(spvWallet, amount)
    : await ledger.mintInitialSupply(spvWallet, amount);

  const receipt = await trackTxn({
    chain,
    pending,
    operation: minted ? 'mint' : 'mintInitialSupply',
    fromWallet: null,
    toWallet: spvWallet,
    amount,
    role,
    onSubmitted: input.onSubmitted,
  });

  if (receipt.status === 'FAILED') {
    await store.appendAudit({
      actorRole: role,
      action: 'token:mint',
      target: spvWallet,
      outcome: 'FAILURE',
      detail: `${context}Phát hành ${amount} ${tokenSymbol} thất bại on-chain; tx ${receipt.txHash}`,
      chain,
    });
    // KHÔNG đánh dấu `issuedAt`: giao dịch revert nghĩa là chưa phát hành, và đánh dấu ở đây sẽ
    // làm bảng dự án nói đã phát hành trong khi chuỗi chưa có token nào.
    return err('LEDGER', receipt.reason ?? 'Giao dịch phát hành thất bại on-chain.');
  }

  // @flow issue:6 | lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan
  if (issuedAt === null) {
    const marked = await getProjectStore().markIssued({
      id: project.id,
      issuedAt: new Date().toISOString(),
    });
    if (!marked) {
      /**
       * Giao dịch ĐÃ thành công nhưng không ghi được mốc: dòng đã bị một lời gọi khác đổi. Không
       * trả `ok` — trạng thái cần người đối soát, và báo thành công sẽ làm không ai đi xem.
       */
      await store.appendAudit({
        actorRole: role,
        action: 'token:mint',
        target: spvWallet,
        outcome: 'FAILURE',
        detail:
          `${context}Đã phát hành ${amount} ${tokenSymbol} on-chain (tx ${receipt.txHash}) nhưng ` +
          `KHÔNG ghi được mốc phát hành vào bảng dự án — dòng đã bị đổi bởi lời gọi khác.`,
        chain,
      });
      return err(
        'ORDER_STATE',
        `Đã phát hành xong on-chain (tx ${receipt.txHash}) nhưng bảng dự án đã được một lời gọi ` +
          `khác cập nhật trước. Đối soát bảng dự án với chuỗi trước khi làm gì tiếp.`,
      );
    }
    issuedAt = marked.issuedAt;
  }

  // @flow issue:7 | đọc lại tổng cung từ chuỗi làm sự thật cuối cùng
  const after = await remainingIssuanceCap(chain, project);

  await store.appendAudit({
    actorRole: role,
    action: 'token:mint',
    target: spvWallet,
    outcome: 'SUCCESS',
    detail:
      `${context}Phát hành ${amount} ${tokenSymbol} vào ví SPV; tổng cung trên chuỗi ` +
      `${after.supply}, trần còn lại ${after.remaining}; tx ${receipt.txHash}`,
    chain,
  });

  return ok({
    chain,
    tokenSymbol,
    spvWallet,
    amount: amount.toString(),
    txHash: receipt.txHash,
    status: receipt.status,
    totalSupplyOnChain: after.supply.toString(),
    remainingCap: after.remaining.toString(),
    issuedAt: issuedAt ?? new Date().toISOString(),
  });
}

/**
 * Phát hành trực tiếp vào ví thanh toán SPV, trong trần còn lại — ĐƯỜNG DỮ LIỆU THỬ (FE-22).
 *
 * Tên giữ từ BE-04 để không đổi chữ ký server action FE-07 đang chờ; hành vi nay là NHIỀU LẦN.
 * Không truyền `amount` thì phát hành TOÀN BỘ trần còn lại — lần gọi đầu như vậy cho đúng kết
 * quả của bản một lần trước đây.
 *
 * ⚠️ Từ FE-22 hàm này nằm sau HAI LỚP CHẶN: quyền `demo:mint-token` VÀ cờ `ENABLE_DEMO_TOKEN_MINT`
 * (mặc định tắt). Phát hành chính thức là lập yêu cầu Mint rồi Kiểm soát viên duyệt
 * (`token-request.service`), và lần duyệt gọi thẳng `executeIssuance`, không qua đây.
 *
 * @flow issue:2 | validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án
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
    const role = await authorize('demo:mint-token', spvWallet, chain, assertCanMintDemoToken);

    const project = await getProjectStore().findProject({ tokenSymbol, chain });
    if (!project) {
      return err(
        'VALIDATION',
        `Chưa có dự án "${tokenSymbol}" trên chain "${chain}". ` +
          `Trần phát hành lấy từ bảng dự án, nên phải tạo dự án trước khi phát hành.`,
      );
    }

    let amount = parsed.data.amount;
    if (amount === undefined) {
      const { remaining } = await remainingIssuanceCap(chain, project);
      if (remaining === 0n) {
        return err(
          'ISSUANCE_CAP',
          `Dự án "${tokenSymbol}" đã phát hành chạm trần ${project.totalSupply}; không còn gì để phát hành.`,
        );
      }
      amount = remaining;
    }

    return await executeIssuance({ chain, project, spvWallet, amount, role });
  } catch (error) {
    return toResult(error);
  }
}

export interface IssuanceStatusView {
  chain: ChainKey;
  tokenSymbol: string;
  /** Trần phát hành theo bảng dự án. */
  plannedTotalSupply: string;
  /** Tổng cung THẬT trên chuỗi. Bằng 0 khi chưa phát hành. */
  totalSupplyOnChain: string;
  /** Số còn được phát hành: trần trong bảng dự án trừ tổng cung trên chuỗi. */
  remainingCap: string;
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

    const [cap, spvWallet] = await Promise.all([
      remainingIssuanceCap(chain, project),
      getLedger(chain).spvWallet(),
    ]);

    return ok({
      chain,
      tokenSymbol,
      plannedTotalSupply: project.totalSupply,
      totalSupplyOnChain: cap.supply.toString(),
      remainingCap: cap.remaining.toString(),
      issuedAt: project.issuedAt,
      spvWallet,
    });
  } catch (error) {
    return toResult(error);
  }
}
