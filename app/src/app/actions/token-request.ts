'use server';

import {
  approveTokenRequest,
  createTokenRequest,
  listTokenRequests,
  previewTokenRequest,
  rejectTokenRequest,
} from '@/lib/bank/token-request.service';

/**
 * Server actions cho lập–duyệt yêu cầu Mint / Burn (BE-12) — vỏ mỏng quanh
 * `token-request.service`.
 *
 * KHÔNG có guard quyền ở tệp này, cùng lý do `actions/purchase.ts`: server action gọi được bằng
 * POST trực tiếp, nên kiểm quyền, chặn tự duyệt và ghi sổ kiểm toán nằm TRONG service.
 */

// @pending FE-22 | previewTokenRequestAction đã sẵn: trả khối kiểm tra đủ mọi điều kiện (quyền lập, dự án, trần còn lại, ví đích, yêu cầu đang chờ; Burn: phần chưa phân phối, token lưu hành) kèm trạng thái từng dòng, không ghi gì — màn Lập lệnh chỉ cần hiển thị
export async function previewTokenRequestAction(input: unknown) {
  return previewTokenRequest(input);
}

// @pending FE-22 | createTokenRequestAction đã sẵn: validate Zod, kiểm quyền order:draft, kiểm lại điều kiện, ghi yêu cầu PENDING (chưa tác động token) và sổ kiểm toán; trượt thì trả REQUEST_CHECK với fieldErrors khoá theo mã điều kiện
export async function createTokenRequestAction(input: unknown) {
  return createTokenRequest(input);
}

// @pending FE-22 | approveTokenRequestAction đã sẵn: kiểm quyền order:approve, chặn người lập tự duyệt, kiểm lại toàn bộ điều kiện lúc duyệt, chiếm quyền bằng UPDATE có điều kiện rồi thực hiện trên ví SPV và ghi mã giao dịch
export async function approveTokenRequestAction(input: unknown) {
  return approveTokenRequest(input);
}

// @pending FE-22 | rejectTokenRequestAction đã sẵn: bắt buộc lý do, kiểm quyền order:approve, chặn tự từ chối, chuyển REJECTED không tác động token, ghi sổ kể cả lần bị chặn
export async function rejectTokenRequestAction(input: unknown) {
  return rejectTokenRequest(input);
}

// @pending FE-22 | listTokenRequestsAction đã sẵn: lọc theo chuỗi, loại, trạng thái, mới nhất trước; mở cho hai vai vận hành qua ops:read
export async function listTokenRequestsAction(input: unknown) {
  return listTokenRequests(input);
}
