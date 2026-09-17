'use client';

/**
 * Dò xem trình duyệt có ví nào được tiêm vào không (R2.1).
 *
 * Viết dưới dạng external store để dùng với `useSyncExternalStore`, cùng khuôn với
 * `lib/hooks/use-is-mounted.ts`. Hai lý do:
 *
 * 1. Đọc `window.ethereum` ngay trong thân hàm kết xuất là đọc nguồn dữ liệu ngoài React —
 *    `useSyncExternalStore` là cách React chính thức cho việc này, và tránh luôn mẫu
 *    `useEffect` + `setState` mà React Compiler chặn (`react-hooks/set-state-in-effect`).
 * 2. Ví công bố theo EIP-6963 **không đồng bộ**: ngay sau khi tải trang có thể chưa thấy gì,
 *    một nhịp sau mới có. Chỉ đọc một lần lúc mount sẽ kết luận sai là "chưa cài ví".
 *
 * Cách dò: `window.ethereum` (ví kiểu cũ, và phần lớn ví hiện nay vẫn đặt) HOẶC có ví trả
 * lời sự kiện `eip6963:announceProvider` (ví mới, có thể KHÔNG đặt `window.ethereum`).
 */

/** Ví đã trả lời EIP-6963 chưa. Nâng lên `true` rồi thì không hạ xuống: ví không tự biến mất. */
let announced = false;

const listeners = new Set<() => void>();

/** Số lần `subscribe` đang hoạt động — để chỉ gắn một bộ nghe cho toàn ứng dụng. */
let subscriberCount = 0;

function handleAnnounce() {
  if (announced) return;
  announced = true;
  for (const listener of listeners) listener();
}

function readWindowEthereum(): boolean {
  if (typeof window === 'undefined') return false;
  // `ethereum` không nằm trong khai báo `Window` chuẩn. Chỉ cần biết có hay không, nên
  // `unknown` là đủ — không cần kéo kiểu EIP-1193 của viem vào đây.
  return (window as Window & { ethereum?: unknown }).ethereum !== undefined;
}

export function subscribeInjectedProvider(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (subscriberCount === 0 && typeof window !== 'undefined') {
    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    // Ví đang chờ được hỏi: phát yêu cầu để chúng công bố.
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
  subscriberCount += 1;

  return () => {
    listeners.delete(onStoreChange);
    subscriberCount -= 1;
    if (subscriberCount === 0 && typeof window !== 'undefined') {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    }
  };
}

/** Trả `boolean` (giá trị nguyên thuỷ) nên `useSyncExternalStore` không bị render vô tận. */
export function getInjectedProviderSnapshot(): boolean {
  return announced || readWindowEthereum();
}

/** Ở server luôn là `false`: lần kết xuất đầu không được phụ thuộc trạng thái ví (R6.1). */
export function getInjectedProviderServerSnapshot(): boolean {
  return false;
}
