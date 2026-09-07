---
inclusion: always
foundationalType: tech
---
# Công nghệ & LUẬT KIẾN TRÚC (bất di)

## Stack (đã chốt — không tự đổi)
- **Frontend + Backend**: Next.js 16 full-stack (App Router, server actions/API routes). KHÔNG dựng NestJS/Express riêng.
- **Web3**: wagmi v2 + viem + RainbowKit.
- **Contracts EVM**: Solidity 0.8.28, OpenZeppelin v5, Hardhat v2 (đã có, 13 test pass). T-REX kit tách riêng (0.8.17 + OZ v4) — để production.
- **Stellar**: Soroban/Rust (đã có) — phase sau.
- **DB**: PostgreSQL + Prisma.
- **Triển khai**: Docker Compose.

## ⚠️ Next.js 16 KHÔNG giống bản cũ
Có breaking changes so với training data. **Trước khi sửa `app/`, ĐỌC `node_modules/next/dist/docs/` và `app/AGENTS.md`.** Không suy diễn API cũ.

## 3 LUẬT bất di (mọi PR phải tuân)
1. **Mọi tương tác chain đi qua `ILedgerPort`** (`app/src/lib/ledger`). Cấm gọi thẳng viem/ethers trong component/route.
2. **Mọi thao tác ký đi qua `ISigner`** (`app/src/lib/signer`). Không nhúng private key rải rác.
3. **Mọi kiểm quyền đi qua RBAC** (`app/src/lib/rbac`, `can(role, action)`). Cấm `if (role === 'admin')` cứng.

## Chain & mock
- Chain chọn ở UI: `hardhat-local` (mặc định) → `evm` → `stellar`. **KHÔNG dùng Polygon** (đã loại).
- Mọi tích hợp (KYC/Oracle/CoreBank/ledger) có bản `mock` bật bằng feature flag `USE_MOCK_*`, mặc định mock để mint chạy nhanh.

## Mở rộng linh hoạt (kế thừa)
- Thêm chain = thêm 1 adapter + đăng ký factory, KHÔNG sửa nghiệp vụ.
- Thêm custody = thêm 1 `ISigner`, đổi factory.
- Thêm role/luồng = thêm dữ liệu RBAC / thêm method interface.
- Ưu tiên interface + factory + dependency injection hơn là gọi trực tiếp.

## Bảo mật
Không commit `.env`, private key, secret. Khóa dev chỉ trong `.env` (đã .gitignore).

## Bổ sung đã chốt (thêm vào stack)
- **DB/ORM:** PostgreSQL + **Prisma** (khai báo sớm cho KYC/audit/RBAC từ P4).
- **Validation:** **Zod** dùng chung cho server action + form (một schema, chống lệch FE/BE).
- **State client:** **Zustand** (chain đang chọn + feature flags).
- **Test app:** **Vitest** (unit) + **Playwright** (1 e2e mint). Contracts: Hardhat test.
- **Auth (P4):** **SIWE** (Sign-In-With-Ethereum) + session — hợp mô hình ví, khỏi user/password.
- **Node pinning:** `.nvmrc` = 20 + `engines.node` để Kiro/CI/VPS/hosting đồng nhất (Next.js 16 khó tính version).

## Hosting (default FREE-TIER, chạy được CẢ HAI)
- **Default:** deploy free-tier serverless (**Cloudflare Workers** qua `@opennextjs/cloudflare` — repo có sẵn). DB: Supabase/Neon free. Chain: **KHÔNG dựng node**; demo public dùng `mock` (mặc định) hoặc `evm` testnet + RPC free.
- **Đầy đủ (VPS):** `docker compose up` (web + db + hardhat node) — cùng một codebase, chỉ đổi feature-flag.
- **Ràng buộc kích thước (Cloudflare):** từ 2026-09-04 giới hạn là **64 MiB KHÔNG nén** cho mọi gói (trước đây Free 3 MiB nén / Paid 10 MiB nén — đã bỏ). Vì mới đổi + docs đang cập nhật, **build GỌN để chắc:** KHÔNG bundle hardhat/ethers/artifact contract/thư viện node-only vào bundle edge; dùng **viem**; ABI tối giản (chỉ hàm cần); đồ nặng để ở `packages/*` (dùng lúc build), không ship nguyên vào worker.
