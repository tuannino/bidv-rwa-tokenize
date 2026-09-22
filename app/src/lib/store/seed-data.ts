import { DEFAULT_CHAIN, type ChainKey } from '@bidv/shared';
import {
  CONFIG_KEYS,
  WPT_ISSUE_PRICE_VND,
  WPT_PRICE_CHANGE_THRESHOLD,
  WPT_TOKEN_SYMBOL,
  WPT_TOTAL_SUPPLY,
} from '@/lib/config/issue-terms';
import { CONFIG_ROLES, CONFIG_ROLE_NAMES } from '@/lib/rbac/config-role';
import { ROLES, type Role } from '@/lib/rbac';
import type { ConfigValueType } from './config.store.port';
import type { ProjectStatus } from './project.store.port';

/**
 * DỮ LIỆU KHỞI TẠO — một nguồn cho CẢ HAI bản lưu trữ.
 *
 * Vì sao một nguồn: bản bộ nhớ (mặc định, free-tier) và bản Postgres (`docker compose up`)
 * phải bắt đầu từ CÙNG một trạng thái. Viết dữ liệu khởi tạo hai lần — một lần trong mã bản bộ
 * nhớ, một lần trong SQL — là đúng loại lệch mà BE-09 QĐ-3 dựng ra để chặn: đổi giá khởi tạo ở
 * một chỗ thì demo free-tier bán một giá, demo VPS bán giá khác, và không test nào đỏ.
 *
 * ⚠️ KHÔNG con số nào khai bằng số đếm ở tệp này. Giá, tổng cung, ngưỡng đều nhập từ
 * `lib/config/issue-terms.ts`; danh sách vai được đổi cấu hình suy từ `lib/rbac/config-role.ts`.
 * Tệp này chỉ SẮP XẾP chúng thành các dòng dữ liệu.
 *
 * ⚠️ KHÔNG `import 'server-only'`: `lib/store/postgres.pool.ts` và các bản bộ nhớ đã có hàng
 * rào đó, còn tệp này là dữ liệu thuần và `app/test` nhập trực tiếp để khỏi gõ lại con số.
 */

/** Vai ghi vào `updatedBy` / `changedBy` cho dòng khởi tạo. */
export const SEED_ACTOR_ROLE: Role = 'BANK_ADMIN';

export interface SeedConfigRow {
  key: string;
  value: string;
  type: ConfigValueType;
}

/**
 * Hai tham số nạp sẵn vào `SystemConfig`.
 *
 * Nạp sẵn thay vì để bảng trống và dựa vào giá trị mặc định trong mã: có dòng thật thì màn hình
 * cấu hình của FE-07 hiện được "ai đặt, lúc nào" ngay từ đầu, và đường đọc cơ sở dữ liệu được
 * chạy thật trong demo chứ không chỉ chạy nhánh lùi về mặc định.
 */
export const SEED_CONFIG_ROWS: readonly SeedConfigRow[] = [
  {
    key: CONFIG_KEYS.issuePriceVnd,
    // `bigint` vì giá đi xuống ledger dưới dạng uint256; `String(...)` giữ nguyên chữ số.
    value: String(WPT_ISSUE_PRICE_VND),
    type: 'bigint',
  },
  {
    key: CONFIG_KEYS.priceChangeThreshold,
    // `number` vì đây là hệ số so sánh, không phải số tiền — không cần dải uint256.
    value: String(WPT_PRICE_CHANGE_THRESHOLD),
    type: 'number',
  },
];

export interface SeedProjectRow {
  tokenSymbol: string;
  name: string;
  totalSupply: string;
  status: ProjectStatus;
  chain: ChainKey;
}

/**
 * Dự án điện gió duy nhất của PoC, trạng thái `DRAFT` (chưa phát hành).
 *
 * `chain` lấy `DEFAULT_CHAIN` thay vì viết cứng một chain: chain mặc định do
 * `packages/shared` quyết định, và dựng dữ liệu khởi tạo trên một chain khác chain mặc định là
 * để người mở demo lần đầu thấy "chưa có dự án nào".
 *
 * ⚠️ `status: 'DRAFT'` và không có `issuedAt`. Nạp sẵn một dự án ĐÃ phát hành sẽ làm
 * `issueInitialSupply` không bao giờ chạy được trong demo, mà đó chính là luồng BE-04 dựng ra.
 */
export const SEED_PROJECT: SeedProjectRow = {
  tokenSymbol: WPT_TOKEN_SYMBOL,
  name: 'Dự án điện gió Bạc Liêu',
  totalSupply: String(WPT_TOTAL_SUPPLY),
  status: 'DRAFT',
  chain: DEFAULT_CHAIN,
};

export interface SeedRoleRow {
  name: Role;
  isConfig: boolean;
}

/**
 * Bốn vai kèm cờ `isConfig`, suy từ `CONFIG_ROLES`.
 *
 * Ghi đủ bốn vai chứ không chỉ vai có `isConfig = true`: bảng `Role` là đích mà AU-02 sẽ đọc,
 * và một bảng chỉ có một dòng `BANK_ADMIN` sẽ làm AU-02 hiểu ba vai còn lại là "không tồn tại"
 * thay vì "tồn tại và không được đổi cấu hình".
 */
export const SEED_ROLE_ROWS: readonly SeedRoleRow[] = ROLES.map((name) => ({
  name,
  isConfig: CONFIG_ROLES[name],
}));

/** Kiểm nhanh khi đọc log dựng dữ liệu: đúng những vai nào được đổi cấu hình. */
export const SEED_CONFIG_ROLE_NAMES = CONFIG_ROLE_NAMES;
