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
const openNextConfig = {
  ...defineCloudflareConfig(),

  /**
   * Mặc định OpenNext chạy `npm run build` (xem @opennextjs/aws/build/buildNextApp.js).
   * Đổi sang `build:standalone` để chèn bước san phẳng `.next/standalone` — cần vì repo đặt
   * `outputFileTracingRoot` = gốc repo (bắt buộc, `@bidv/shared` nằm ngoài `app/`) nên Next
   * sinh `.next/standalone/app/.next/...` còn OpenNext đọc `.next/standalone/.next/...`.
   * Chi tiết trong scripts/flatten-standalone.mjs.
   *
   * ⚠️ ĐÂY LÀ ĐƯỜNG DỰ PHÒNG, KHÔNG PHẢI ĐƯỜNG CHÍNH.
   * Build Cloudflare hãy dùng `npm run cf:build`. Hook `buildCommand` này chạy đúng ở máy
   * cục bộ nhưng build trên Workers Builds vẫn báo đúng lỗi ENOENT cũ (log không có dòng
   * "[flatten-standalone]"), tức nó KHÔNG được áp dụng ở môi trường đó và chưa rõ vì sao.
   * `cf:build` tự xếp thứ tự next build -> san phẳng -> opennext --skipNextBuild, nên không
   * phụ thuộc việc hook này có được đọc hay không. Giữ lại đây để `npx @opennextjs/cloudflare build`
   * gọi trực tiếp vẫn chạy được.
   */
  buildCommand: "npm run build:standalone",
};

export default openNextConfig;
