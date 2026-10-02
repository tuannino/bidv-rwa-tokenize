'use server';

import {
  approveTokenRequest,
  createTokenRequest,
  getApprovalStats,
  getDraftStats,
  getTokenInfo,
  getTokenRequestDetail,
  listTokenRequests,
  previewTokenRequest,
  rejectTokenRequest,
} from '@/lib/bank/token-request.service';

/**
 * Server actions cho lập–duyệt yêu cầu Mint / Burn (BE-12, giao diện FE-22) — vỏ mỏng quanh
 * `token-request.service`.
 *
 * KHÔNG có guard quyền ở tệp này, cùng lý do `actions/purchase.ts`: server action gọi được bằng
 * POST trực tiếp, nên kiểm quyền, chặn tự duyệt và ghi sổ kiểm toán nằm TRONG service.
 */

/** Khối kiểm tra trước khi lập: từng điều kiện kèm trạng thái, không ghi gì. */
export async function previewTokenRequestAction(input: unknown) {
  return previewTokenRequest(input);
}

/** Lập yêu cầu `PENDING` — chưa tác động token. */
export async function createTokenRequestAction(input: unknown) {
  return createTokenRequest(input);
}

/** Duyệt: kiểm lại điều kiện, chặn tự duyệt, chiếm quyền rồi thực hiện trên chuỗi. */
export async function approveTokenRequestAction(input: unknown) {
  return approveTokenRequest(input);
}

/** Từ chối: bắt buộc lý do, chặn tự từ chối. */
export async function rejectTokenRequestAction(input: unknown) {
  return rejectTokenRequest(input);
}

/** Danh sách yêu cầu; `mine: true` chỉ lấy yêu cầu của người đang đăng nhập. */
export async function listTokenRequestsAction(input: unknown) {
  return listTokenRequests(input);
}

/** Khối thông tin token theo ký hiệu (FE-22). */
export async function getTokenInfoAction(input: unknown) {
  return getTokenInfo(input);
}

/** Hai thẻ số liệu của màn Lập lệnh (FE-22). */
export async function getDraftStatsAction() {
  return getDraftStats();
}

/** Ba thẻ số liệu của màn Phê duyệt lệnh (FE-22). */
export async function getApprovalStatsAction() {
  return getApprovalStats();
}

/** Chi tiết một yêu cầu kèm nhật ký và lý do khoá nút duyệt khi người xem là người lập (FE-22). */
export async function getTokenRequestDetailAction(input: unknown) {
  return getTokenRequestDetail(input);
}
