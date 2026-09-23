import type { Role } from '@/lib/rbac';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ THAM SỐ HỆ THỐNG (bảng `SystemConfig`) và LỊCH SỬ ĐỔI THAM SỐ
 * (bảng `SystemConfigHistory`).
 *
 * MỘT cổng cho hai bảng, khác với quy ước "một cổng một nhóm bảng" ở BE-09 — và đó là chủ
 * đích. Hai bảng này không dùng rời nhau được: mọi lần ghi `SystemConfig` PHẢI kèm một dòng
 * lịch sử, vì giá trị cũ chỉ còn tồn tại ngay trước lần ghi đó. Tách thành hai cổng thì tầng
 * nghiệp vụ cầm hai đối tượng và có thể gọi một mà quên cái kia, tức là mất vết đúng lần đổi
 * giá mà sổ kiểm toán cần nhất.
 *
 * Cổng này chỉ LƯU TRỮ. Kiểm quyền, kiểm ngưỡng đổi giá, và thứ tự "đẩy xuống ledger trước
 * rồi mới ghi" là việc của `lib/bank/config.service.ts`.
 */

/**
 * Cách đọc cột `value`.
 *
 * `value` là `String` cho mọi kiểu vì giá phát hành là số tới 78 chữ số (uint256) nên không
 * vừa `Int`, mà `Decimal(78,0)` thì không lưu được ngưỡng hay cờ bật/tắt. Cột `type` là thứ
 * cho người đọc biết chuỗi đó phải hiểu thế nào.
 *
 * Bốn giá trị là đủ cho hiện tại và mở được về sau. Thêm kiểu mới thì thêm vào đây, cả hai bản
 * hiện thực tự chặn giá trị lạ nhờ `assertConfigValueType`.
 *
 * `string` thêm ở BE-06 cho khoá `distribution.dust_wallet` — một ĐỊA CHỈ VÍ. Ba kiểu cũ không
 * mang nổi nó: `bigint` mất tiền tố `0x` và mất chữ hoa của checksum, mà địa chỉ Stellar thì
 * không phải số. Dùng `bigint` rồi tự ghép lại `0x` ở chỗ đọc là cách chắc chắn để một địa chỉ
 * có chữ số 0 ở đầu bị đọc sai thành một ví khác — và tiền sẽ chuyển tới ví đó.
 */
export const CONFIG_VALUE_TYPES = ['bigint', 'number', 'boolean', 'string'] as const;
export type ConfigValueType = (typeof CONFIG_VALUE_TYPES)[number];

/**
 * Chốt chặn cho cột `type` kiểu `String`.
 *
 * Cùng lý do với `assertOrderStatus`: cột là `String` chứ không phải enum của Postgres, nên cơ
 * sở dữ liệu KHÔNG tự chặn giá trị lạ. Cả hai bản hiện thực gọi hàm này trước khi ghi.
 */
export const assertConfigValueType = (value: string): ConfigValueType =>
  assertStatus('SystemConfig', CONFIG_VALUE_TYPES, value);

export interface ConfigRecord {
  key: string;
  /** Giá trị dạng chuỗi; đọc theo `type`. */
  value: string;
  type: ConfigValueType;
  /** Vai đã cập nhật lần cuối — phục vụ đối soát trách nhiệm. */
  updatedBy: Role;
  updatedAt: string;
}

export interface ConfigHistoryRecord {
  id: string;
  key: string;
  /** `null` ở lần đặt ĐẦU TIÊN cho một khoá — khi đó không có giá trị cũ nào. */
  oldValue: string | null;
  newValue: string;
  changedBy: Role;
  reason: string | null;
  changedAt: string;
}

/**
 * Một lần đổi tham số: ghi giá trị mới VÀ ghi dòng lịch sử, không tách rời.
 *
 * `oldValue` KHÔNG có trong kiểu này: hiện thực tự đọc giá trị đang có rồi đưa vào dòng lịch
 * sử. Để người gọi truyền vào thì họ phải tự đọc trước, và khoảng giữa hai lời gọi là chỗ một
 * lần đổi khác chen vào — dòng lịch sử sẽ ghi một giá trị cũ không phải giá trị vừa bị thay.
 */
export interface ConfigChange {
  key: string;
  value: string;
  type: ConfigValueType;
  changedBy: Role;
  reason?: string | null;
}

export interface IConfigStore {
  readonly kind: StoreKind;

  /** `null` = chưa cấu hình. Người gọi tự quyết định giá trị mặc định. */
  getConfig(key: string): Promise<ConfigRecord | null>;

  /**
   * Ghi giá trị mới và MỘT dòng lịch sử trong cùng một lần gọi.
   *
   * Hiện thực PHẢI làm hai việc đó nguyên khối (bản Postgres dùng transaction): ghi được giá
   * mới mà mất dòng lịch sử thì sổ kiểm toán thiếu đúng lần đổi giá vừa xảy ra, còn ghi được
   * lịch sử mà không đổi được giá thì sổ nói một đằng, hệ thống chạy một nẻo.
   */
  setConfig(change: ConfigChange): Promise<ConfigRecord>;

  /**
   * Lịch sử đổi một tham số, mới nhất trước.
   *
   * ⚠️ GIỚI HẠN ĐÃ BIẾT: hai lần ghi TRÙNG mốc thời gian tới từng phần nghìn giây thì thứ tự
   * tương đối của chúng KHÔNG xác định — cả hai bản hiện thực phá thế bằng `id`, một uuid ngẫu
   * nhiên chứ không phải thứ tự chèn. Đừng viết mã (hay test) dựa vào `history[0]` là lần ghi mới
   * nhất khi hai lần ghi có thể sát nhau; tra theo nội dung, hoặc so `changedAt`.
   *
   * Không sửa bằng cột số thứ tự vì đó là đổi lược đồ cho một tình huống chỉ xảy ra khi hai lần
   * đổi giá cách nhau dưới một phần nghìn giây — chuyện không có trong thao tác của người. Đã ghi
   * thành câu hỏi mở trong checkpoint BE-04 để Owner quyết có cần thứ tự tuyệt đối hay không.
   */
  listConfigHistory(options?: { key?: string; limit?: number }): Promise<ConfigHistoryRecord[]>;
}
