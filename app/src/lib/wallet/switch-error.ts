/**
 * Bóc lỗi của `switchChain` thành câu tiếng Việt cán bộ ngân hàng đọc được — LOGIC THUẦN.
 *
 * Vì sao phải bóc theo tầng `cause` chứ không đọc `error.message`:
 * wagmi bọc lỗi gốc của ví vào lớp ngoài của nó, nên thông tin nhận dạng (`name`, `code`)
 * nằm ở tầng trong, còn `message` tầng ngoài là văn bản kỹ thuật dài dòng bằng tiếng Anh.
 * Đọc sai tầng thì mọi trường hợp đều ra một câu vô nghĩa — đúng loại lỗi đã ghi trong
 * `lessons.md` ở phần bóc revert của viem.
 *
 * Hai mã đáng phân biệt:
 *   - 4001 `UserRejectedRequestError` — người dùng bấm Từ chối. KHÔNG phải lỗi hệ thống,
 *     không được hiện như sự cố (R3.4).
 *   - 4902 — ví chưa biết chain này. wagmi tự chuyển sang `wallet_addEthereumChain`, nên
 *     nếu mã này lọt ra tới đây thì việc thêm chain cũng đã thất bại.
 */

const USER_REJECTED_CODE = 4001;
const CHAIN_NOT_ADDED_CODE = 4902;

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  cause?: unknown;
  shortMessage?: unknown;
  message?: unknown;
}

/** Đi từ lỗi ngoài vào trong. Chặn ở 10 tầng để một chuỗi `cause` vòng lại không treo. */
function chainOf(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current !== null && typeof current === 'object'; depth += 1) {
    chain.push(current as ErrorLike);
    current = (current as ErrorLike).cause;
  }
  return chain;
}

/** Người dùng đã từ chối yêu cầu chuyển/thêm chain hay chưa. */
export function isUserRejection(error: unknown): boolean {
  return chainOf(error).some(
    (level) => level.name === 'UserRejectedRequestError' || level.code === USER_REJECTED_CODE,
  );
}

/**
 * Câu giải thích cho người dùng. `targetLabel` là tên chain đích, để câu chữ nói rõ đang
 * bàn về mạng nào thay vì "chain đích".
 */
export function describeSwitchError(error: unknown, targetLabel: string): string {
  if (isUserRejection(error)) {
    return `Bạn đã từ chối chuyển mạng. Vẫn cần chuyển ví sang ${targetLabel} mới thực hiện được giao dịch.`;
  }

  const levels = chainOf(error);

  if (levels.some((level) => level.code === CHAIN_NOT_ADDED_CODE)) {
    return `Ví chưa có mạng ${targetLabel} và cũng chưa thêm được. Hãy thêm mạng này trong phần cài đặt của ví rồi thử lại.`;
  }

  if (levels.some((level) => level.name === 'ProviderNotFoundError')) {
    return 'Không tìm thấy ví trong trình duyệt. Hãy cài ví rồi tải lại trang.';
  }

  if (levels.some((level) => level.name === 'SwitchChainNotSupportedError')) {
    return `Ví đang dùng không cho phép ứng dụng đổi mạng. Hãy tự chuyển sang ${targetLabel} trong ví.`;
  }

  /**
   * Còn lại: lấy `shortMessage` của tầng trong cùng có nó. viem đặt câu ngắn gọn ở đó,
   * `message` thì kèm cả gợi ý gỡ lỗi dài mấy dòng — dán nguyên vào giao diện là bất nhã.
   */
  const shortMessage = levels
    .map((level) => level.shortMessage)
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .at(-1);

  return shortMessage
    ? `Không chuyển được sang ${targetLabel}: ${shortMessage}`
    : `Không chuyển được sang ${targetLabel}. Hãy tự chuyển mạng trong ví rồi tải lại trang.`;
}
