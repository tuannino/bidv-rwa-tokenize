import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cấu hình @opennextjs/cloudflare cho chế độ free-tier (xem docs/DEPLOYMENT.md).
 *
 * Trước đây file này truyền `{ default: { minify: true } }` kèm `as any`. Kiểm lại
 * `CloudflareOverrides` (node_modules/@opennextjs/cloudflare/dist/api/config.d.ts):
 * KHÔNG có khoá `default` — nên tuỳ chọn đó không có tác dụng gì, `as any` chỉ che lỗi kiểu.
 * Minify vốn đã bật sẵn và tắt bằng cờ CLI `--noMinify`, không phải bằng file này.
 *
 * Chưa cần override nào (incrementalCache/tagCache/queue... dùng mặc định) nên gọi rỗng.
 */
export default defineCloudflareConfig();
