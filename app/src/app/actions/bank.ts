'use server';

import type { ChainKey } from '@bidv/shared';
import { getIssuanceStatus, issueInitialSupply } from '@/lib/bank/issuance.service';
import {
  listTransactions,
  mintToInvestorDirect,
  onboardInvestor,
  readBalance,
  tokenOverview,
} from '@/lib/bank/mint.service';

/**
 * Server actions cho UI — vỏ mỏng quanh `mint.service` và `issuance.service`.
 *
 * ⚠️ Server action gọi được bằng POST trực tiếp, không chỉ qua UI
 * (node_modules/next/dist/docs/.../07-mutating-data.md). Vì vậy kiểm quyền nằm
 * TRONG service, không nằm ở component gọi nó.
 */

export async function onboardInvestorAction(input: unknown) {
  return onboardInvestor(input);
}

/**
 * Giữ TÊN `mintAction` dù service phía dưới đã đổi thành `mintToInvestorDirect`.
 *
 * Đổi cả tên action sẽ buộc sửa mọi component đang gọi, mà những chỗ đó không liên quan gì tới
 * việc phân biệt hai lối phát hành. Chỗ cần nói rõ "đây là đường nền cho bản trình diễn" là
 * service, và nó đã nói.
 */
export async function mintAction(input: unknown) {
  return mintToInvestorDirect(input);
}

/**
 * @flow issue:1 | nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service
 * @pending FE-07 | đã sẵn đầu cuối ở `issueInitialSupply`: phát hành NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án, KHÔNG nhận từ input; `amount` tuỳ chọn chỉ chọn số lượng trong trần, bỏ trống = phát hành hết phần còn lại), kiểm quyền `token:mint`, lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
 */
export async function issueInitialSupplyAction(input: unknown) {
  return issueInitialSupply(input);
}

/**
 * @flow issue:8 | nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service
 * @pending FE-07 | đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
 */
export async function issuanceStatusAction(input: unknown) {
  return getIssuanceStatus(input);
}

export async function readBalanceAction(input: unknown) {
  return readBalance(input);
}

export async function listTransactionsAction(input: unknown) {
  return listTransactions(input);
}

export async function tokenOverviewAction(chain: ChainKey) {
  return tokenOverview(chain);
}
