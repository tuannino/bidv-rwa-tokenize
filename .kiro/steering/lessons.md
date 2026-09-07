---
inclusion: always
---
# Bài học tích lũy (Supervisor cập nhật dần)

> Mỗi mục: **Triệu chứng → Nguyên tắc đúng**. Kiro đọc để không lặp lỗi.

- **Gọi chain thẳng trong component** → SAI. Luôn qua `ILedgerPort` (`app/src/lib/ledger`).
- **Nhúng private key / ký rải rác** → SAI. Luôn qua `ISigner`.
- **`if (role === 'admin')` cứng** → SAI. Dùng `can(role, action)` (RBAC).
- **Giả định API Next.js theo bản cũ** → SAI. Next.js 16 khác; đọc docs trong node_modules trước.
- **Trộn T-REX (0.8.17/OZ4) vào contracts chính (0.8.28/OZ5)** → SAI. Giữ tách toolchain.
- **Copy ABI/địa chỉ contract rải rác** → SAI. Chỉ đặt ở `packages/shared`.
- **Thêm Polygon** → SAI. Đã loại bỏ; chỉ hardhat-local / evm / stellar.
- **Bundle hardhat/ethers/artifact contract vào web (edge)** → SAI, phình bundle Cloudflare. Dùng viem, ABI tối giản; đồ nặng để ở packages.
- **Luồng demo public phụ thuộc hardhat node thường trú** → SAI. Free-tier không chạy node; default phải là `mock`/`evm-testnet`.
- **Nhớ nhầm giới hạn Cloudflare** → mức hiện tại 64 MiB không nén (mọi gói, từ 2026-09-04); vẫn build gọn.
