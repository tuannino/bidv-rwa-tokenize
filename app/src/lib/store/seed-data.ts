import type { ChainKey } from '@bidv/shared';
import {
  CONFIG_KEYS,
  DEMO_PAYMENT_MINT_MAX_VND,
  DISTRIBUTION_BATCH_SIZE,
  WPT_ANNUAL_YIELD_PERCENT,
  WPT_ISSUE_PRICE_VND,
  WPT_PRICE_CHANGE_THRESHOLD,
  WPT_REMAINING_LIFETIME_YEARS,
  WPT_TOKEN_SYMBOL,
  WPT_TOTAL_SUPPLY,
  WPT_TRADING_FEE_PERCENT,
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
export const SEED_ACTOR_ROLE: Role = 'TELLER';

export interface SeedConfigRow {
  key: string;
  value: string;
  type: ConfigValueType;
}

/**
 * Bảy tham số nạp sẵn vào `SystemConfig` (FE-24 thêm ba điều khoản token).
 *
 * Nạp sẵn thay vì để bảng trống và dựa vào giá trị mặc định trong mã: có dòng thật thì màn hình
 * cấu hình của FE-07 hiện được "ai đặt, lúc nào" ngay từ đầu, và đường đọc cơ sở dữ liệu được
 * chạy thật trong demo chứ không chỉ chạy nhánh lùi về mặc định.
 *
 * ⚠️ `distribution.dust_wallet` CỐ Ý không có ở đây. Mọi địa chỉ đặt sẵn đều là ví thật của một
 * ai đó, nên nạp sẵn một dòng là dựng sẵn lệnh chuyển tiền tới ví mà không ai chọn. Chưa cấu hình
 * thì phần dư nằm yên trong ví lợi nhuận — xem `readDistributionDustWallet`.
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
  {
    key: CONFIG_KEYS.remainingLifetimeYears,
    value: String(WPT_REMAINING_LIFETIME_YEARS),
    type: 'number',
  },
  {
    key: CONFIG_KEYS.annualYieldPercent,
    value: String(WPT_ANNUAL_YIELD_PERCENT),
    type: 'number',
  },
  {
    key: CONFIG_KEYS.tradingFeePercent,
    value: String(WPT_TRADING_FEE_PERCENT),
    type: 'number',
  },
  {
    key: CONFIG_KEYS.distributionBatchSize,
    // `number` vì đây là số đếm ví trong một lô, không phải số tiền.
    value: String(DISTRIBUTION_BATCH_SIZE),
    type: 'number',
  },
  {
    key: CONFIG_KEYS.demoPaymentMintMaxVnd,
    // `bigint`: số tiền VNDB, đi thẳng vào phép so với số tiền nạp dạng uint256.
    value: String(DEMO_PAYMENT_MINT_MAX_VND),
    type: 'bigint',
  },
];

export interface SeedProjectRow {
  tokenSymbol: string;
  name: string;
  totalSupply: string;
  status: ProjectStatus;
  chain: ChainKey;
}

/** Tên dự án điện gió của PoC. */
const SEED_PROJECT_NAME = 'Dự án điện gió Bạc Liêu';

/**
 * Các chuỗi được nạp sẵn dòng dự án.
 *
 * HAI chuỗi, không phải một, và đây là điểm dễ làm sai nhất của dữ liệu khởi tạo. Bảng `Project`
 * duy nhất theo `(tokenSymbol, chain)` vì mỗi chuỗi có trạng thái phát hành riêng, nên một dòng
 * duy nhất trên chain mặc định sẽ làm `issueInitialSupply` từ chối với lý do "chưa có dự án" ở
 * MỌI chuỗi khác — trong khi dự án rõ ràng có.
 *
 * Nạp cả `mock` và `hardhat-local`: bản demo mặc định chạy ngay không cần node, còn luồng kiểm chứng
 * EVM cục bộ vẫn có dự án riêng khi bật Hardhat.
 *
 * `evm` KHÔNG nằm trong danh sách: đó là testnet công khai, nơi dự án phải được deploy thật kèm
 * địa chỉ hợp đồng. Nạp sẵn một dòng `DRAFT` ở đó là mời gọi phát hành lên testnet bằng dữ liệu
 * dựng sẵn mà chưa ai kiểm.
 */
export const SEED_PROJECT_CHAINS: readonly ChainKey[] = ['mock', 'hardhat-local'];

/**
 * Dự án điện gió của PoC trên từng chuỗi được nạp sẵn, trạng thái `DRAFT` (chưa phát hành).
 *
 * ⚠️ `status: 'DRAFT'` và không có `issuedAt`. Nạp sẵn một dự án ĐÃ phát hành sẽ làm
 * `issueInitialSupply` không bao giờ chạy được trong demo, mà đó chính là luồng BE-04 dựng ra.
 */
export const SEED_PROJECTS: readonly SeedProjectRow[] = SEED_PROJECT_CHAINS.map((chain) => ({
  tokenSymbol: WPT_TOKEN_SYMBOL,
  name: SEED_PROJECT_NAME,
  totalSupply: String(WPT_TOTAL_SUPPLY),
  status: 'DRAFT' as ProjectStatus,
  chain,
}));

export interface SeedRoleRow {
  name: Role;
  isConfig: boolean;
}

/**
 * Bốn vai kèm cờ `isConfig`, suy từ `CONFIG_ROLES`.
 *
 * Ghi đủ bốn vai chứ không chỉ vai có `isConfig = true`: bảng `Role` là đích mà AU-02 sẽ đọc,
 * và một bảng chỉ có một dòng `TELLER` sẽ làm AU-02 hiểu ba vai còn lại là "không tồn tại"
 * thay vì "tồn tại và không được đổi cấu hình".
 */
export const SEED_ROLE_ROWS: readonly SeedRoleRow[] = ROLES.map((name) => ({
  name,
  isConfig: CONFIG_ROLES[name],
}));

/** Kiểm nhanh khi đọc log dựng dữ liệu: đúng những vai nào được đổi cấu hình. */
export const SEED_CONFIG_ROLE_NAMES = CONFIG_ROLE_NAMES;
