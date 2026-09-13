'use client';

import { useSyncExternalStore } from 'react';

/** Không bao giờ có thay đổi để đăng ký — giá trị chỉ khác nhau giữa server và client. */
const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` khi render ở server và trong lượt hydrate, `true` sau khi đã hydrate xong.
 *
 * Dùng để bọc phần UI phụ thuộc trạng thái chỉ có ở client (vd theme đã resolve),
 * tránh hydration mismatch.
 *
 * Vì sao KHÔNG dùng `useEffect(() => setMounted(true), [])`:
 * rule `react-hooks/set-state-in-effect` (React Compiler) chặn setState đồng bộ trong
 * effect vì nó gây render dây chuyền. `useSyncExternalStore` là cách React chính thức
 * cho tình huống "giá trị server khác client": React dùng `getServerSnapshot` lúc hydrate
 * rồi tự render lại với `getSnapshot`. Hành vi quan sát được giống hệt bản cũ.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
}
