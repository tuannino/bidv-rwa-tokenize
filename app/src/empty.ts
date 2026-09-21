/**
 * Tệp giữ chỗ lúc BUILD cho các module `@x402/*`.
 *
 * `@x402/*` là peerDependency TÙY CHỌN của `@coinbase/cdp-sdk` nên npm không cài, nhưng mã
 * của cdp-sdk vẫn `import` chúng và cdp-sdk có trong đồ thị module của app
 * (providers.tsx -> rainbowkit -> @wagmi/connectors -> @base-org/account -> cdp-sdk).
 * Không có tệp này thì bundler không resolve được và `next build` fail.
 * Alias khai ở `app/next.config.ts` — đọc khối chú thích ở đó, gồm cả ĐIỀU KIỆN XÓA.
 *
 * Chỉ giữ ĐÚNG những export mà build đòi. Đo bằng cách bỏ hết rồi build: Turbopack chỉ báo
 * thiếu `toClientEvmSigner` (import TĨNH duy nhất chạm tới, ở cdp-sdk/_esm/x402/account-signers.js).
 * Bốn specifier còn lại vào bằng `import()` động nên build không kiểm tên export.
 *
 * Đã bỏ 10 export cũ: toClientSvmSigner, registerExactEvmScheme, registerExactSvmScheme,
 * UptoEvmScheme, ExactEvmScheme, UptoSvmScheme, ExactSvmScheme, cdpSolanaAccountToSvmSigner,
 * class ImageResponse, và default export. Build, build:standalone, cf:build đều xanh khi
 * không có chúng. Chúng là vỏ rỗng (`() => ({})`) nên nếu luồng thanh toán x402 của
 * Base Account có chạy vào thì trước đây cũng đã không hoạt động — app này không dùng luồng đó.
 */
export const toClientEvmSigner = () => ({});
