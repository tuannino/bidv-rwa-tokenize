'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/rbac/session';
import { isRole } from '@/lib/rbac';

/**
 * Đổi vai trò đang giả lập (chỉ PoC, để demo RBAC chặn đúng chỗ).
 *
 * ⚠️ ĐÂY KHÔNG PHẢI XÁC THỰC. Người dùng tự đổi được vai trò của mình.
 * Phase 4 thay bằng SIWE + session có chữ ký; khi đó XOÁ hàm này.
 * Ghi rõ ở đây để không ai nhầm là cơ chế phân quyền thật.
 */
export async function setDemoRole(role: string): Promise<void> {
  if (!isRole(role)) return;

  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    httpOnly: false, // PoC: cho UI đọc lại; Phase 4 sẽ là session httpOnly có chữ ký.
    sameSite: 'lax',
    path: '/',
  });

  refresh();
}
