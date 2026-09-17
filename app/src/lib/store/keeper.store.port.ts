import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ MỐC CHẠY của tiến trình hẹn giờ (bảng `KeeperRun`).
 *
 * Cổng này chỉ LƯU TRỮ. Lịch chạy, tên công việc cụ thể và việc gì chạy trong mỗi lần là
 * của BE-07.
 */

/**
 *     RUNNING ──► SUCCESS
 *         └────► FAILED
 */
export const KEEPER_RUN_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export type KeeperRunStatus = (typeof KEEPER_RUN_STATUSES)[number];

/** Trạng thái kết thúc — thứ `finishRun` được phép ghi. */
export type KeeperRunTerminalStatus = Exclude<KeeperRunStatus, 'RUNNING'>;

export const assertKeeperRunStatus = (value: string): KeeperRunStatus =>
  assertStatus('KeeperRun', KEEPER_RUN_STATUSES, value);

export interface KeeperRunRecord {
  id: string;
  /** Tên công việc, ví dụ "expire-orders". */
  jobName: string;
  /** Kỳ mà lần chạy này phụ trách: kỳ chia "2026-Q1", ngày "2026-09-18", mã đợt tất toán... */
  periodKey: string;
  startedAt: string;
  finishedAt: string | null;
  status: KeeperRunStatus;
  error: string | null;
}

export interface IKeeperStore {
  readonly kind: StoreKind;

  /**
   * CHIẾM QUYỀN chạy: ghi dòng mốc ở trạng thái `RUNNING`, hoặc ném
   * `UniqueConstraintError` nếu `(jobName, periodKey)` đã có (R4.2).
   *
   * Đây là cách dùng đúng của cổng này, và thứ tự rất quan trọng: gọi `startRun` TRƯỚC khi
   * làm việc, rồi coi lỗi trùng ràng buộc là tín hiệu "bản khác đã nhận việc này" và dừng
   * lại. Đọc trước bằng `findRun` rồi mới ghi thì hai instance cùng nhận một lịch sẽ cùng
   * thấy "chưa chạy" và cùng chạy — đúng cái mà ràng buộc duy nhất được dựng để chặn.
   *
   * `findRun` chỉ để hiển thị và đối soát, KHÔNG dùng làm phép kiểm trước khi chạy.
   */
  startRun(input: { jobName: string; periodKey: string }): Promise<KeeperRunRecord>;

  /** Đóng một lần chạy. Trả `null` nếu không có dòng nào mang mã này. */
  finishRun(input: {
    id: string;
    status: KeeperRunTerminalStatus;
    error?: string | null;
  }): Promise<KeeperRunRecord | null>;

  findRun(input: { jobName: string; periodKey: string }): Promise<KeeperRunRecord | null>;

  listRuns(options?: {
    jobName?: string;
    status?: KeeperRunStatus;
    limit?: number;
  }): Promise<KeeperRunRecord[]>;
}
