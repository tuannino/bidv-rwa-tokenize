# Triển khai & Hosting (demo theo lượt)

Mục tiêu: **default free-tier** (rẻ, bật/tắt nhanh, demo theo lượt), nhưng **một codebase chạy được cả 2** chế độ. Chỉ đổi feature-flag/biến môi trường, không sửa code.

## Hai chế độ

| | FREE-TIER (default) | VPS (đầy đủ) |
|---|---|---|
| Web | Cloudflare Workers (`@opennextjs/cloudflare`) | Docker (`docker compose`) |
| DB | Supabase / Neon (Postgres free) | Postgres container |
| Chain | `mock` (mặc định) hoặc `evm` testnet (Sepolia + RPC free) | `hardhat-local` node thật |
| Lệnh | `npm run build` + deploy (wrangler) | `docker compose up` |
| Dùng khi | demo public nhanh, không cần chain thật | demo đầy đủ mọi luồng, có hardhat |

## Ràng buộc Cloudflare (kích thước Worker)
- **Hiện tại (từ 2026-09-04):** giới hạn **64 MiB KHÔNG nén** cho mọi gói (kể cả Free). Giới hạn nén cũ (Free 3 MiB / Paid 10 MiB) **đã bỏ**.
- Thay đổi mới + docs đang cập nhật → **vẫn build gọn để chắc:**
  - Không bundle hardhat, ethers, artifact contract, thư viện node-only vào bundle edge.
  - Dùng **viem** (nhẹ) ở phía web; ABI chỉ giữ hàm cần dùng.
  - Đồ nặng/tooling để ở `packages/contracts-*` (dùng lúc build), không ship vào worker.
  - Kiểm trước khi deploy: `wrangler deploy --dry-run` xem "Total Upload".

## Quy tắc thiết kế để chạy được cả 2
1. Luồng demo public KHÔNG phụ thuộc cứng hardhat node thường trú (free-tier không chạy node).
2. Chain + tích hợp chọn qua feature-flag/registry, không hard-code.
3. Bí mật (RPC key, server signer) qua biến môi trường; không commit.

## Nếu chọn có phí (cân bằng chi phí)
- VPS nhỏ bật-theo-lượt (bật lúc demo, tắt sau) hoặc Cloudflare/Supabase gói trả phí khi vượt free. Vì demo theo lượt, ưu tiên bật/tắt hơn là always-live.
