import type { Role } from '@/lib/rbac';
import { CHANNEL_HOME, ROLE_CHANNEL } from '@/lib/session/channel';

/**
 * IN-04 F1: trang mặc định của vai đang có hiệu lực, cho nút "Về trang của vai hiện tại" ở màn chặn
 * vai. Suy từ hai bảng có sẵn, không liệt kê lại.
 */
export const roleHomeHref = (role: Role): string => CHANNEL_HOME[ROLE_CHANNEL[role]];
