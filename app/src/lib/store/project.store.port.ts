import type { ChainKey } from '@bidv/shared';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ DỰ ÁN ĐÃ TOKEN HOÁ (bảng `Project`).
 *
 * Đây là nơi giữ TỔNG CUNG của đợt phát hành. Trước BE-04 con số đó không tồn tại ở đâu trong
 * `app/src`, nên `issueInitialSupply` không có gì để đọc và buộc phải nhận tổng cung từ người
 * gọi — tức là từ giao diện, tức là ai gọi được cũng đặt được quy mô phát hành.
 *
 * Cổng này chỉ LƯU TRỮ. Quyết định khi nào được phát hành, gọi ledger, chờ biên nhận là việc
 * của `lib/bank/issuance.service.ts`.
 */

/**
 * Ba trạng thái của một dự án:
 *
 *     DRAFT ──► ISSUED ──► CLOSED
 *
 * `DRAFT`  chưa phát hành nguồn cung ban đầu.
 * `ISSUED` đã phát hành, đang bán / đang chia lợi nhuận.
 * `CLOSED` đã tất toán xong (BE-05 đặt).
 *
 * KHÔNG có trạng thái "đang phát hành". Phát hành là MỘT giao dịch on-chain nên chỉ có hai
 * kết cục: xong, hoặc chưa xảy ra gì. Một trạng thái trung gian ở đây mô tả tình huống không
 * tồn tại, và `issuedAt` mới là thứ trả lời "đã phát hành chưa" một cách kiểm được.
 */
export const PROJECT_STATUSES = ['DRAFT', 'ISSUED', 'CLOSED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Chốt chặn cho cột `status` kiểu `String` — cùng lý do với `assertOrderStatus`. */
export const assertProjectStatus = (value: string): ProjectStatus =>
  assertStatus('Project', PROJECT_STATUSES, value);

export interface ProjectRecord {
  id: string;
  tokenSymbol: string;
  name: string;
  /**
   * Tổng cung phát hành, dạng CHUỖI.
   *
   * Chuỗi vì `bigint` không JSON-hoá được nên không qua được biên máy chủ sang trình duyệt,
   * và `number` thì mất chính xác từ 2^53.
   */
  totalSupply: string;
  status: ProjectStatus;
  chain: ChainKey;
  contractAddress: string | null;
  /** `null` = chưa phát hành nguồn cung ban đầu. */
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewProject {
  tokenSymbol: string;
  name: string;
  totalSupply: string;
  chain: ChainKey;
  contractAddress?: string | null;
  /** Mặc định `DRAFT`. Nhận tham số để test dựng sẵn dự án đã phát hành. */
  status?: ProjectStatus;
}

export interface IProjectStore {
  readonly kind: StoreKind;

  createProject(project: NewProject): Promise<ProjectRecord>;

  /** Tra theo mã token và chain: cùng một token có thể tồn tại trên nhiều chain. */
  findProject(input: { tokenSymbol: string; chain: ChainKey }): Promise<ProjectRecord | null>;

  /**
   * Đánh dấu ĐÃ PHÁT HÀNH — chỉ thành công khi dự án còn ở `DRAFT` và `issuedAt` còn rỗng.
   *
   * Trả `null` khi KHÔNG dòng nào bị ảnh hưởng, nghĩa là dự án đã phát hành rồi (hoặc một
   * tiến trình khác vừa chiếm). Người gọi PHẢI dừng lại khi nhận `null`.
   *
   * Đây là KHOÁ LẠC QUAN, cùng cơ chế với `transitionOrder`: điều kiện nằm TRONG câu `UPDATE`
   * để cơ sở dữ liệu làm trọng tài. Đọc `issuedAt` rồi mới ghi thành hai bước thì hai lời gọi
   * đồng thời đều thấy `null`, đều kết luận "chưa phát hành", rồi cùng gửi giao dịch mint —
   * và nguồn cung ra gấp đôi con số đã công bố.
   */
  markIssued(input: {
    id: string;
    issuedAt: string;
    contractAddress?: string | null;
  }): Promise<ProjectRecord | null>;

  listProjects(options?: {
    chain?: ChainKey;
    status?: ProjectStatus;
    limit?: number;
  }): Promise<ProjectRecord[]>;
}
