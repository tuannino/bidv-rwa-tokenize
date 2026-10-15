import type { ChainKey } from '@bidv/shared';
import { CONFIG_KEYS } from './issue-terms';

/**
 * Khoá giá phát hành theo chain trong `SystemConfig`.
 *
 * Dùng khoá ghép thay vì thêm cột `chain`: cổng cấu hình hiện đã hỗ trợ mọi khoá chuỗi, nên cách
 * này không đổi schema/cổng lưu trữ và vẫn tách được cả giá lẫn lịch sử cấu hình của từng chain.
 */
export const issuePriceConfigKey = (chain: ChainKey): string =>
  `${CONFIG_KEYS.issuePriceVnd}.${chain}`;
