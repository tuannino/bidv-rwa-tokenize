"use client";

import { useSyncExternalStore } from "react";

/**
 * Trạng thái khung (FE-UX-01b QĐ-3, QĐ-4). `AppLayout` là Server Component nên không giữ state;
 * thanh bên và thanh đầu là hai Client Component riêng cần cùng đọc "thanh bên thu gọn" và "ngăn
 * kéo đang mở", nên trạng thái đặt ở store mức module và đọc bằng `useSyncExternalStore`.
 *
 * - `rail`: thu gọn thanh bên (từ 1100 px). Lưu `localStorage['bidv-rail']` (`'1'` là thu gọn).
 *   Phía máy chủ coi là mở, nên lần vẽ đầu khớp HTML máy chủ, không lệch hydrate. Hiệu ứng đổi rộng
 *   chỉ bật sau lần bấm đầu (`railAnimated`), nên tải lại ở trạng thái thu gọn không trượt.
 * - `drawer`: ngăn kéo dưới 1100 px, chỉ trong bộ nhớ. Lưu ĐƯỜNG DẪN lúc mở; nơi đọc coi ngăn kéo
 *   là mở khi đường dẫn hiện tại còn trùng, nên đổi trang bằng cách nào cũng tự đóng mà không cần
 *   `setState` trong effect.
 * - `narrow`: màn dưới 1100 px (`matchMedia`). Phía máy chủ coi là màn rộng.
 */
const RAIL_KEY = "bidv-rail";

/** Nút "Mở menu" ở thanh đầu: ngăn kéo đóng thì trả tiêu điểm về đây. */
export const MENU_BUTTON_ID = "shell-menu-button";
const NARROW_QUERY = "(max-width: 1099px)";

const listeners = new Set<() => void>();
let drawerPath: string | null = null;
/** Hiệu ứng đổi rộng chỉ bật sau lần bấm thu gọn, mở rộng đầu tiên; tải lại không trượt. */
let railAnimated = false;
let media: MediaQueryList | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function narrowMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  media ??= window.matchMedia(NARROW_QUERY);
  return media;
}

function onStorage(event: StorageEvent) {
  if (event.key === RAIL_KEY) emit();
}

function onMediaChange() {
  // Lên màn rộng thì không còn ngăn kéo; đóng để lần xuống màn hẹp sau không tự bật lại.
  if (!narrowMedia()?.matches) drawerPath = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    // Sự kiện `storage` chỉ chạy ở tab KHÁC; trong cùng tab, `setRail` tự phát qua `emit`.
    window.addEventListener("storage", onStorage);
    narrowMedia()?.addEventListener("change", onMediaChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      narrowMedia()?.removeEventListener("change", onMediaChange);
    }
  };
}

function readRail(): boolean {
  try {
    return window.localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRail(collapsed: boolean) {
  railAnimated = true;
  try {
    window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
  } catch {
    // Trình duyệt chặn lưu trữ: không lưu được thì lần đọc trả "mở", thanh bên giữ mở rộng.
  }
  emit();
}

export function openDrawer(pathname: string) {
  drawerPath = pathname;
  emit();
}

export function closeDrawer() {
  if (drawerPath === null) return;
  drawerPath = null;
  emit();
}

const serverFalse = () => false;
const serverNull = () => null;

/** Thanh bên đang thu gọn (chỉ có tác dụng từ 1100 px). */
export function useRail(): boolean {
  return useSyncExternalStore(subscribe, readRail, serverFalse);
}

/** Đã có lần người dùng bấm thu gọn, mở rộng trong trang này (bật hiệu ứng đổi rộng). */
export function useRailAnimated(): boolean {
  return useSyncExternalStore(subscribe, () => railAnimated, serverFalse);
}

/** Đường dẫn lúc mở ngăn kéo, `null` khi đóng. */
export function useDrawerPath(): string | null {
  return useSyncExternalStore(subscribe, () => drawerPath, serverNull);
}

/** Màn dưới 1100 px. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => narrowMedia()?.matches ?? false, serverFalse);
}
