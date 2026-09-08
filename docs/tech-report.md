---
inclusion: always
---

# BÁO CÁO CÔNG NGHỆ — BIDV RWA TOKENIZE (TOKEN HÓA DỰ ÁN ĐIỆN GIÓ)

> **Tài liệu sống.** Kiro bắt buộc cập nhật file này sau mỗi thay đổi mã nguồn, theo quy tắc trong `.kiro/steering/tech-report-maintenance.md`.
> Đây là nguồn tham chiếu đầu tiên cho dev mới tiếp nhận source.

| Trường | Giá trị |
|---|---|
| Phiên bản tài liệu | 1.1 |
| Cập nhật lần cuối | 2026-09-08 |
| Nhánh / commit | `iteration-2/ui-cleanup` |
| Phase đã hoàn thành | P0 (nền), P1 (mint), vòng dọn UI điện gió |
| Phase kế tiếp | P2 Redeem → P3 Distribution |
| Người cập nhật | Kiro (thực thi) — Supervisor rà soát |

## Quy ước ký hiệu token (BẮT BUỘC dùng thống nhất)

| Ký hiệu | Tên đầy đủ | Contract | Vai trò |
|---|---|---|---|
| **WPT** | Wind Project Token | `tokens/ProjectToken.sol` | Token đại diện phần vốn dự án điện gió, cấp cho nhà đầu tư đã định danh |
| **VNDB** | Tokenized VND | `tokens/VNDToken.sol` | Token tiền tệ dùng chi trả lợi tức và hoàn vốn |

⚠️ **Ký hiệu cũ đã bỏ:** `SPT` (nay là **WPT**), `tVND` (nay là **VNDB**). Không dùng lại ký hiệu cũ ở bất kỳ đâu: mã nguồn, giao diện, tài liệu, tên biến, chuỗi hiển thị, test.

---

# PHẦN 1. MÔ TẢ CHUNG HỆ THỐNG

## 1.1. Mục tiêu

Hệ thống mô phỏng nghiệp vụ ngân hàng token hóa tài sản thực (RWA) cho một dự án điện gió: ngân hàng phát hành token dự án (**WPT**) cho nhà đầu tư đã định danh, chia lợi tức theo sản lượng điện bằng **VNDB**, và hoàn vốn khi nhà đầu tư muốn thoát.

Ba kênh người dùng tách theo vai trò nhưng **dùng chung một backend**:

| Kênh | Route group | Vai trò | Quyền |
|---|---|---|---|
| Ngân hàng | `(admin)` | BANK_ADMIN, COMPLIANCE | Mint, KYC, whitelist, freeze, clawback |
| Nhà đầu tư | `(client)` | INVESTOR | Xem số dư, nhận lợi tức, hoàn vốn |
| Kiểm toán | `(audit)` | AUDITOR | **Chỉ đọc** sổ kiểm toán |

## 1.2. Nguyên tắc kiến trúc — 3 LUẬT bất di bất dịch

Đây là ràng buộc quan trọng nhất của dự án. Mọi PR đều bị Supervisor kiểm 3 luật này bằng `grep`.

| Luật | Nội dung | Kiểm chứng (phải cho kết quả rỗng) |
|---|---|---|
| **#1** | Mọi lời gọi blockchain đi qua `ILedgerPort` | `grep -rn "from 'viem'" app/src/ \| grep -v "src/lib/"` |
| **#2** | Mọi thao tác ký đi qua `ISigner` | `SERVER_SIGNER_PRIVATE_KEY` chỉ xuất hiện ở `config/env.ts` và `signer/server.signer.ts` |
| **#3** | Mọi kiểm quyền đi qua RBAC `can()` | `grep -rnE "role ===\|role ==" app/src/ \| grep -v "src/lib/rbac/"` |

**Vì sao:** ba luật này cho phép đổi chain (EVM → Stellar), đổi custody (khóa server → Fireblocks), đổi mô hình quyền mà **không phải sửa tầng nghiệp vụ**. Vi phạm một luật là hỏng khả năng mở rộng của cả hệ thống.

## 1.3. Mô hình phân tầng

```
UI (components/pages/*)          ← không được gọi chain, không được kiểm quyền
   ↓
Transport (app/actions/*, app/api/*)   ← vỏ mỏng, không chứa nghiệp vụ
   ↓
Nghiệp vụ (lib/bank/*)           ← RBAC + audit + điều phối  ★ điểm đặt guard
   ↓
Cổng trừu tượng (lib/ledger, lib/signer, lib/store, lib/providers)
   ↓
Hạ tầng (chain EVM/Stellar/mock, Postgres/memory)
```

**Quy tắc vàng:** guard quyền và ghi audit đặt ở **tầng nghiệp vụ**, không đặt ở transport. Lý do: Server Action của Next.js có thể bị gọi bằng POST trực tiếp, không chỉ qua giao diện. Nếu guard nằm ở component thì bỏ qua được.

## 1.4. Cây thư mục

```
bidv-rwa-tokenize/
├── .kiro/
│   ├── steering/              # Quy tắc Kiro nạp mỗi phiên (always)
│   │   ├── workflow.md        # Vòng lặp Kiro ↔ Supervisor, quy tắc chống "kẹt"
│   │   ├── lessons.md         # Bài học tích lũy — đọc trước khi code
│   │   ├── structure.md       # Cấu trúc thư mục chuẩn
│   │   ├── tech.md            # Ràng buộc kỹ thuật
│   │   ├── frontend.md        # Chuẩn giao diện, màu BIDV
│   │   ├── solidity.md        # Chuẩn viết contract
│   │   ├── product.md         # Bối cảnh nghiệp vụ
│   │   ├── tech-report.md     # ★ Báo cáo công nghệ (file này)
│   │   └── tech-report-maintenance.md  # Quy tắc cập nhật báo cáo
│   └── specs/<feature>/       # requirements.md, design.md, tasks.md
│
├── app/                       # Next.js 16 full-stack
│   ├── src/app/
│   │   ├── (admin)/           # Kênh ngân hàng: mint, kyc, assets, reconciliation
│   │   ├── (audit)/           # Kênh kiểm toán: chỉ đọc
│   │   ├── actions/           # Server Actions (bank.ts, session.ts)
│   │   ├── api/               # REST: mint, balance, investors, token, txns
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── src/components/
│   │   ├── layout/            # sidebar, header, chain-selector, channel-guard
│   │   ├── pages/             # mint, kyc, assets, dashboard, reconciliation
│   │   └── ui/                # shadcn/ui primitives
│   ├── src/lib/               # ★ LÕI — xem Phần 3
│   ├── e2e/                   # Playwright
│   ├── test/                  # Vitest
│   ├── prisma/                # schema.prisma + init.sql
│   └── Dockerfile
│
├── packages/
│   ├── contracts-evm/         # Hardhat 2.x, Solidity 0.8.28, OZ 5
│   │   ├── contracts/
│   │   │   ├── tokens/ProjectToken.sol      # WPT — ERC20 + whitelist/freeze/snapshot
│   │   │   ├── tokens/VNDToken.sol          # VNDB — token chi trả
│   │   │   ├── ProfitDistributor.sol        # Chia lợi tức theo snapshot
│   │   │   ├── ProfitDistributorOracle.sol  # Bản nối EnergyOracle
│   │   │   ├── Redemption.sol               # Hoàn vốn WPT → VNDB
│   │   │   ├── oracle/EnergyOracle.sol      # Sản lượng điện → doanh thu
│   │   │   └── extensions/ERC20Snapshotable.sol
│   │   ├── scripts/           # deploy.js, demo-cycle.js, demo-oracle.js
│   │   ├── test/              # full-cycle, oracle-cycle (13 test)
│   │   └── trex/              # ERC-3643 thật — TOOLCHAIN RIÊNG, KHÔNG trộn
│   ├── contracts-stellar/     # Soroban (Rust) — phase 7
│   └── shared/                # ★ MỘT nguồn sự thật: ABI, địa chỉ, chain, types
│
└── docs/                      # SPEC, WORKING_PROTOCOL, CHECKPOINT, REVIEW
```

## 1.5. Hai chế độ chạy

| Chế độ | Lệnh | Chain | DB | Dùng khi |
|---|---|---|---|---|
| Đầy đủ | `docker compose up` | hardhat-local | Postgres 16 | Phát triển, demo nội bộ |
| Free-tier | Deploy Vercel/Cloudflare | `mock` | memory | Demo public, không cần hạ tầng |

Free-tier chỉ cần: `NEXT_PUBLIC_DEFAULT_CHAIN=mock`, `USE_MOCK_DB=true`, các cờ `USE_MOCK_*=true`.

## 1.6. GHI CHÚ CHO DEV — bài học để kế thừa

> Phần này quan trọng nhất với dev mới. Mỗi mục là một lỗi đã xảy ra thật hoặc một quyết định có lý do.

### A. Bài học kiến trúc (vi phạm là sai, không tranh luận)

| Triệu chứng sai | Nguyên tắc đúng |
|---|---|
| Gọi `viem` thẳng trong component | Luôn qua `ILedgerPort` (`lib/ledger`) |
| Nhúng private key, ký rải rác | Luôn qua `ISigner` (`lib/signer`) |
| `if (role === 'admin')` | Dùng `can(role, action)` (`lib/rbac`) |
| Copy ABI/địa chỉ contract nhiều nơi | Chỉ đặt ở `packages/shared` |
| Trộn T-REX (0.8.17/OZ4) vào contracts chính (0.8.28/OZ5) | Giữ tách toolchain, T-REX ở `trex/` riêng |
| Thêm chain Polygon | Đã loại bỏ vĩnh viễn. Chỉ `hardhat-local`, `evm`, `stellar`, `mock` |
| Dùng lại ký hiệu `SPT` hoặc `tVND` | Đã đổi thành **WPT** và **VNDB**. Không để sót ở mã, UI, test, tài liệu |
| Bundle hardhat/ethers/artifact vào web | Dùng viem + ABI tối giản; đồ nặng để ở `packages` |
| Luồng demo phụ thuộc hardhat node thường trú | Mặc định phải là `mock`, để free-tier chạy được |
| Giả định API Next.js theo bản cũ | Next.js 16 có breaking change. Đọc `node_modules/next/dist/docs/` và `app/AGENTS.md` **trước khi** sửa `app/` |

### B. Quyết định thiết kế có chủ ý (đừng "sửa" nhầm)

- **Dùng `pg` thuần, không dùng Prisma Client.** Prisma Client nặng ~22 MB (có query engine nhị phân) sẽ phá giới hạn bundle Worker; `pg` chỉ ~0.5 MB. Prisma vẫn giữ để **sinh lược đồ** (`schema.prisma` → `init.sql`), nên không có hai nguồn DDL.
- **Trả `Result<T>` thay vì `throw`.** Next.js che thông báo lỗi ở production, và kết quả phải tuần tự hóa được qua biên server → client (không `bigint`, không `Error`).
- **Số lượng token truyền dưới dạng chuỗi.** `number` của JS mất chính xác từ 2^53; `bigint` không qua được biên serialize.
- **Stub luôn ném lỗi, không bao giờ trả giá trị giả.** `fireblocks.signer.stub.ts` không được âm thầm quay về khóa server — đó là lỗ hổng bảo mật.
- **Mock nghiêm ngặt ngang bản thật.** `mock.adapter.ts` vẫn chặn khi chưa KYC / bị băng / đang tạm dừng. Nếu mock dễ tính hơn contract thật thì sẽ sinh loại lỗi "chạy mock được, lên chain thật hỏng".
- **`import 'server-only'` trong `config/env.ts`.** Đây là hàng rào cứng: nếu Client Component lỡ import, build sẽ fail ngay thay vì rò khóa ra bundle trình duyệt.
- **`brand.ts` là ngoại lệ hex màu duy nhất.** Logo và modal ví cần màu cố định không đổi theo theme. Ngoài file này, mọi màu phải dùng biến CSS.
- **`chain-store` không persist, mặc định `null`.** Để lần render đầu khớp server, tránh lỗi hydration mismatch.

### C. Nợ kỹ thuật đã biết (cần xử lý, đã ghi nhận)

| Mức | Vấn đề | Hướng xử lý |
|---|---|---|
| **P1** | **Đổi tên token chưa đồng bộ toàn repo.** Mã nguồn còn ký hiệu cũ `SPT`/`tVND` ở chuỗi giao diện (`Số lượng SPT`, `Số dư SPT`), symbol contract `VNDToken` (`tVND`), và **selector trong e2e** | Đổi đồng loạt sang **WPT**/**VNDB**. Sửa cả `e2e/mint.spec.ts` vì đổi nhãn sẽ làm gãy selector. Kiểm bằng: `grep -rniE "\bSPT\b\|tVND" app/src app/e2e packages/` phải rỗng |
| **P1** | `app/package-lock.json` bị `app/.gitignore` chặn, trong khi Dockerfile dùng `npm ci` (bắt buộc có lock) → clone sạch chạy `docker compose up` sẽ fail | Bỏ dòng `package-lock.json` khỏi `app/.gitignore`, commit lock file |
| **P1** | Chưa có xác thực thật. Vai trò lấy từ cookie do client đặt được | Phase 4: SIWE + phiên thật. **Trước đó tuyệt đối không deploy public khi chưa bật bảo vệ mật khẩu** |
| **P2** | Build Cloudflare fail ENOENT: Next sinh ra `.next/standalone/app/.next`, OpenNext đọc `.next/standalone/.next` | Bật `output: "standalone"` cho đường build riêng + nối đường dẫn; **không** bật mặc định vì hỏng `next start` |
| **P2** | Docker build phụ thuộc CDN Alpine (`apk add`) → giòn ở mạng doanh nghiệp có tường lửa | Cân nhắc base `node:24-bookworm-slim` |
| **P2** | Node 20 đã hết hạn LTS từ 30/04/2026, không còn vá bảo mật | Nâng Docker image lên Node 24 (LTS đến 2028) |
| **P2** | Chưa có CI. Mọi kiểm tra chạy tay | Thêm GitHub Actions chạy `typecheck + lint + test` mỗi lần push |
| **P2** | Giấy phép **T-REX không phải giấy phép mở tiêu chuẩn** ("SEE LICENSE IN LICENSE.md") | Rà soát pháp lý **trước khi** dùng cho sản phẩm thật |
| **P2** | 1 cảnh báo lint ở `src/empty.ts` | Sửa cùng lúc với việc gỡ blocker `next.config.ts` |

### D. Cách làm việc

- **Chia commit nhỏ theo mục tiêu.** Không dồn cả phase vào một commit. Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). Mỗi commit phải ở trạng thái build được để `git bisect` và revert từng phần.
- **Quy tắc chống "kẹt":** không hiểu yêu cầu thì **dừng, không đoán** — ghi câu hỏi vào checkpoint kèm 2 cách hiểu khả dĩ. Cùng một lỗi trượt 2 vòng review thì dừng vá lẻ, tổng hợp báo Supervisor.
- **Không sửa mò quá 2 lần** cho cùng một triệu chứng.

---

# PHẦN 2. DANH MỤC CÔNG NGHỆ

> Cột "Bản dùng" = phiên bản trong dự án. Cột "Mới nhất" = bản stable trên thị trường tại 2026-09-08.

## 2.1. Nền tảng ứng dụng

| Công nghệ | Mục đích trong dự án | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| Next.js | Framework full-stack: App Router, Server Actions, API routes | 16.2.7 | 16.3.4 | MIT |
| React | Thư viện giao diện | 19.2.4 | 19.2.8 | MIT |
| TypeScript | Ngôn ngữ, bật `strict` | 5.x | 7.0.2 | Apache-2.0 |
| Node.js | Runtime server | 20 ⚠️ EOL | 26.8.1 (LTS 24) | MIT |

## 2.2. Giao diện

| Công nghệ | Mục đích | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| Tailwind CSS | Styling utility-first, theme qua biến CSS | 4.x | 4.3.3 | MIT |
| shadcn/ui | Bộ component copy vào repo | 4.10.0 | 4.21.0 | MIT |
| Radix UI | Primitive chuẩn a11y (dialog, select, tooltip…) | 1.1.16 | 1.1.23 | MIT |
| Base UI | Component headless | 1.5.0 | 1.8.0 | MIT |
| lucide-react | Bộ icon | 1.17.0 | 1.42.0 | ISC |
| Recharts | Biểu đồ sản lượng, lợi tức | 3.8.1 | 3.10.1 | MIT |
| next-themes | Chuyển sáng/tối | 0.4.6 | 0.4.6 | MIT |

## 2.3. Blockchain

| Công nghệ | Mục đích | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| viem | Thư viện EVM — **chỉ dùng trong `lib/ledger`** | 2.52.2 | 2.56.3 | MIT |
| wagmi | React hooks kết nối ví | 2.19.5 | 3.7.7 | MIT |
| RainbowKit | Giao diện chọn ví | 2.2.11 | 2.2.11 | MIT |
| Hardhat | Build/test/deploy contract | 2.29 | 3.16.0 | MIT |
| Solidity | Ngôn ngữ contract | 0.8.28 | 0.8.36 | GPL-3.0 |
| OpenZeppelin Contracts | AccessControl, SafeERC20, ReentrancyGuard | 5.6.1 | 5.6.1 | MIT |
| T-REX (ERC-3643) | Khung token chứng khoán tuân thủ — production sau | 4.1.6 | 4.1.6 | ⚠️ Riêng |
| ONCHAINID | Danh tính on-chain đi kèm ERC-3643 | 2.2.1 | 2.2.1 | ISC |
| Soroban SDK | Contract Stellar (phase 7) | 26 | 27.0.6 | Apache-2.0 |

## 2.4. Dữ liệu và trạng thái

| Công nghệ | Mục đích | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| PostgreSQL | CSDL khi chạy Docker | 16 | 18.6 | PostgreSQL License |
| Prisma | **Chỉ** sinh lược đồ → `init.sql` | 6.19.1 | 7.10.0 | Apache-2.0 |
| pg (node-postgres) | Driver thật lúc runtime (nhẹ, hợp Worker) | 8.16.3 | 8.23.0 | MIT |
| Zod | Validate dữ liệu, schema dùng chung FE/BE | 4.4.3 | 4.5.4 | MIT |
| Zustand | State client (chain đang chọn) | 5.0.14 | 5.0.15 | MIT |
| TanStack Query | Cache dữ liệu bất đồng bộ | 5.101.0 | 5.102.8 | MIT |
| React Hook Form | Biểu mẫu | 7.77.0 | 7.87.0 | MIT |

## 2.5. Kiểm thử và hạ tầng

| Công nghệ | Mục đích | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| Vitest | Unit test (21 test) | 3.2.4 | 5.0.0 | MIT |
| Playwright | E2E (5 test) | 1.63.0 | 1.63.0 | Apache-2.0 |
| ESLint | Kiểm tra mã nguồn | 9.x | 10.10.0 | MIT |
| Docker / Compose | 3 service: chain, db, web | — | 29.7.1 | Apache-2.0 |
| @opennextjs/cloudflare | Đưa Next.js lên Workers | 1.14.0 | 1.20.6 | MIT |
| Wrangler | CLI triển khai Workers | đi kèm | 4.129.1 | MIT/Apache-2.0 |

---

# PHẦN 3. BẢN ĐỒ CODE

## 3.1. `app/src/lib/ledger/` — cổng blockchain (Luật #1)

| File | Vai trò |
|---|---|
| `ledger.port.ts` | Định nghĩa `ILedgerPort` — hợp đồng mà mọi chain phải tuân theo |
| `index.ts` | Factory `getLedger(chain, signer)` — map chain → adapter |
| `evm.adapter.ts` | Hiện thực EVM bằng viem (199 dòng) |
| `mock.adapter.ts` | Ledger trong RAM, không cần chain |
| `stellar.adapter.ts` | Stub Soroban, mọi hàm ném lỗi rõ ràng |
| `address.ts` | `normalizeEvmAddress()` — chuẩn hóa và kiểm checksum EIP-55 |

**Các hàm của `ILedgerPort`:**

| Nhóm | Hàm | Ý nghĩa |
|---|---|---|
| Tuân thủ | `whitelist`, `isWhitelisted`, `freeze`, `isFrozen` | Kiểm soát ai được nắm giữ WPT |
| Phát hành | `mint`, `burn`, `transfer`, `forcedTransfer` | Tạo, hủy, chuyển, thu hồi cưỡng chế |
| Đọc | `balanceOf`, `tokenInfo`, `waitReceipt` | Truy vấn trạng thái |

**Lưu ý khi phát triển:**
- `evm.adapter` luôn `simulateContract` **trước** khi `writeContract`. Giữ nguyên thói quen này: vi phạm tuân thủ báo lỗi ngay, không đốt gas vào giao dịch chắc chắn revert.
- Hàm `fail()` bóc revert reason của contract thành câu tiếng Việt đọc được. Thêm lỗi mới thì bổ sung vào đây.
- `LedgerError` mang thông báo cho người dùng cuối, không phải log kỹ thuật.

**Cách mở rộng:**
1. Thêm method mới → khai báo ở `ledger.port.ts` trước.
2. Hiện thực ở **cả ba** adapter (stellar có thể ném "chưa hỗ trợ").
3. Bổ sung test ở `test/mock-ledger.test.ts`.
4. **Không bao giờ** thêm method chỉ cho một adapter rồi ép kiểu ở nơi gọi.

## 3.2. `app/src/lib/signer/` — cổng ký (Luật #2)

| File | Vai trò | Lưu ý |
|---|---|---|
| `signer.port.ts` | `ISigner`: `getAddress()`, `getAccount()` | Giữ tối giản |
| `server.signer.ts` | Khóa ngân hàng | **File duy nhất được đọc `SERVER_SIGNER_PRIVATE_KEY`** |
| `wallet.signer.ts` | Ví người dùng qua EIP-1193 | Không phụ thuộc React, nhận provider từ ngoài |
| `fireblocks.signer.stub.ts` | Chỗ cắm Phase 5 | **Ném lỗi, cấm fallback về khóa server** |
| `index.ts` | `getBankSigner()` chọn custody theo `SIGNER_KIND`, có cache | |

**Cách mở rộng (Phase 5):** thay nội dung `fireblocks.signer.stub.ts`, khai báo trong `index.ts`. Tầng nghiệp vụ **không đổi một dòng**.

## 3.3. `app/src/lib/rbac/` — cổng phân quyền (Luật #3)

| File | Vai trò |
|---|---|
| `permissions.ts` | Bảng dữ liệu thuần: 4 role × 11 action |
| `can.ts` | `can(role, action)` + `assertCan()` — **điểm kiểm quyền duy nhất** |
| `session.ts` | Đọc vai trò hiện tại từ cookie |

**Ma trận quyền (rút gọn):**

| Action | BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR |
|---|:--:|:--:|:--:|:--:|
| `token:mint` | ✅ | ❌ | ❌ | ❌ |
| `investor:kyc`, `token:whitelist`, `token:freeze` | ✅ | ✅ | ❌ | ❌ |
| `audit:read` | ✅ | ✅ | ❌ | ✅ |

**Lưu ý:** `can(role: unknown, ...)` nhận `unknown` có chủ ý để dữ liệu ngoài vào an toàn; role lạ **quy về AUDITOR** (quyền thấp nhất), không cho qua. Đây là nguyên tắc đóng, giữ nguyên khi mở rộng.

**Cách mở rộng:** thêm action mới → khai báo trong `permissions.ts` → dùng `assertCan()` ở service. Không viết logic quyền ở nơi khác.

⚠️ **`session.ts` là nợ kỹ thuật P1.** PoC chưa có xác thực thật, cookie do client đặt được. Phase 4 phải thay bằng phiên có chữ ký.

## 3.4. `app/src/lib/bank/` — tầng nghiệp vụ

| File | Vai trò | Hàm chính |
|---|---|---|
| `mint.service.ts` | Nghiệp vụ phát hành (324 dòng) | `onboardInvestor()`, `mintTokens()`, `authorize()` |
| `audit.service.ts` | Đọc sổ kiểm toán | Truy vấn audit log |
| `result.ts` | Kiểu `Result<T>` + `toResult()` + `httpStatusFor` | Chuẩn hóa lỗi |
| `schemas.ts` | Schema Zod dùng chung FE/BE | `mintSchema`, `amountSchema` |

**Lưu ý khi phát triển:**
- `authorize()` ghi audit cho **cả hai kết cục** ALLOWED và DENIED. Giữ nguyên: kênh kiểm toán cần thấy cả những lần bị chặn.
- Luôn **lưu giao dịch PENDING trước khi chờ receipt**. Nếu tiến trình chết giữa chừng, giao dịch vẫn còn dấu vết để đối soát.
- Luôn **đọc lại trạng thái từ chain** sau khi ghi, không tin receipt.

**Cách mở rộng:** mỗi nghiệp vụ mới là **một file service riêng** (`redeem.service.ts`, `distribution.service.ts`), cùng khuôn mẫu: validate → authorize → gọi port → lưu trạng thái → audit → trả `Result`.

## 3.5. `app/src/lib/store/` và `providers/`

| File | Vai trò |
|---|---|
| `store/store.port.ts` | `ITxnStore` — lưu giao dịch + audit log |
| `store/memory.store.ts` | Bản RAM cho free-tier; state đặt trên `globalThis` để không mất khi Next reload module |
| `store/postgres.store.ts` | Bản Postgres, dùng `pg` thuần, query tham số hóa |
| `providers/kyc/*` | `IKycProvider` + mock (auto-approve nhưng **vẫn validate địa chỉ**) + real stub |

**Cách mở rộng:** thêm provider mới (oracle, core banking) theo đúng khuôn: `*.port.ts` + `mock.provider.ts` + `real.provider.stub.ts` + `index.ts` chọn theo cờ.

## 3.6. `app/src/lib/config/` và `chains/`

| File | Vai trò | Lưu ý |
|---|---|---|
| `config/env.ts` | **Nơi duy nhất đọc `process.env` ở server**, validate bằng Zod | Có `import 'server-only'` — hàng rào cứng |
| `config/flags.ts` | Tính cấu hình công khai ở server | Quyết định chain nào chọn được |
| `config/config-context.tsx` | Truyền cấu hình xuống client | Client không tự đọc env |
| `chains/registry.ts` | Map ChainKey → cấu hình viem, tự `defineChain` | Không import `viem/chains` để tránh phình bundle |
| `chains/chain-store.ts` | Zustand giữ chain đang chọn | Không persist, mặc định `null` chống hydration mismatch |

## 3.7. `packages/shared/` — một nguồn sự thật

| File | Nội dung |
|---|---|
| `src/types.ts` | `ChainKey`, `ChainFamily`, `TxStatus`, `ContractName`… **Không import gì nặng** (bị kéo vào bundle edge) |
| `src/chains.ts` | Danh sách chain: `hardhat-local` (mặc định), `evm`, `stellar`, `mock` |
| `src/abi/` | ABI tối giản cho web |
| `generated/` | ABI đầy đủ sinh từ Hardhat |
| `src/addresses.ts` | Tra địa chỉ contract: **env thắng file**, hỗ trợ free-tier không đọc được filesystem |

⚠️ **Tuyệt đối không copy ABI hay địa chỉ contract ra ngoài package này.**

## 3.8. `packages/contracts-evm/contracts/`

| Contract | Vai trò | Hàm chính |
|---|---|---|
| `tokens/ProjectToken.sol` | Token dự án **WPT** | `mint`, `agentBurn`, `setWhitelisted`, `setFrozen`, `forcedTransfer`, `snapshot` |
| `tokens/VNDToken.sol` | Token tiền tệ **VNDB** | `mint`, `burn` |
| `ProfitDistributor.sol` | Chia lợi tức theo snapshot | `createDistribution`, `previewClaim`, `claim`, `claimMany`, `distributeTo`, `sweepDust` |
| `ProfitDistributorOracle.sol` | Bản nối oracle | `createDistributionFromOracle`, `previewDistributableFromOracle` |
| `Redemption.sol` | Hoàn vốn | `quote`, `redeem`, `fund`, `withdraw`, `setRate`, `setPaused` |
| `oracle/EnergyOracle.sol` | Sản lượng điện → doanh thu | `submitReading`, `grossRevenueVnd`, `netRevenueVnd`, `distributableProfitVnd` |
| `extensions/ERC20Snapshotable.sol` | Chụp số dư tại thời điểm | `balanceOfAt`, `totalSupplyAt` |

**Lưu ý:** thư mục `trex/` dùng **toolchain riêng** (Solidity 0.8.17 + OZ 4). Tuyệt đối không trộn với contracts chính (0.8.28 + OZ 5).

---

# PHẦN 4. BẢN ĐỒ LUỒNG

## 4.1. Luồng MINT (đã hoàn thành — P1)

**Hai lối vào, một điểm hội tụ:** UI dùng Server Action, demo runner và e2e dùng `POST /api/mint`. Cả hai gọi cùng `mintTokens()` nên guard không thể bị bỏ sót.

```
components/pages/mint.tsx
   └─ mintAction() ──→ app/actions/bank.ts        (hoặc app/api/mint/route.ts)
         └─────────────→ lib/bank/mint.service.ts :: mintTokens()
```

**Bên trong `mintTokens()`:**

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `bank/schemas.ts` → `mintSchema.safeParse` | Validate ví, amount chuỗi → bigint, > 0 |
| 2 | `rbac/session.ts` → `rbac/can.ts` → `permissions.ts` | `authorize('token:mint')` |
| 3 | `store/index.ts` | Ghi audit ALLOWED / DENIED |
| 4 | `ledger/index.ts` → `chains/registry.ts` | `getLedger(chain)` chọn adapter |
| 5 | `signer/index.ts` → `server.signer.ts` → `config/env.ts` | `getBankSigner()` |
| 6 | `ledger/evm.adapter.ts :: isWhitelisted()` | Chưa whitelist → **dừng, không gửi tx** |
| 7 | `evm.adapter.ts :: mint()` + `ledger/address.ts` | Chuẩn hóa địa chỉ → `simulateContract` → `writeContract` |
| 8 | `store/memory.store.ts` \| `postgres.store.ts` | `saveTxn` trạng thái **PENDING ngay** |
| 9 | `evm.adapter.ts :: waitReceipt()` | Chờ tối đa 30 giây |
| 10 | `store/` | `updateTxnStatus` + audit SUCCESS/FAILURE |
| 11 | `ledger :: balanceOf()` | **Đọc lại số dư WPT từ chain** |
| 12 | `bank/result.ts` | Trả `Result<MintResult>`, amount dạng chuỗi |

**Luồng phụ — onboard nhà đầu tư:** `kyc.tsx` → `onboardInvestorAction` → `onboardInvestor()` → `providers/kyc` (`verify`) → `ledger.whitelist()` → đọc lại `isWhitelisted()`.

---

## 4.2. Luồng REDEEM — hoàn vốn (P2, chưa xây)

**Nghiệp vụ:** nhà đầu tư trả lại **WPT**, nhận về **VNDB** theo tỷ giá. WPT bị **đốt**, tổng cung giảm.

**Khác biệt then chốt so với mint:** giao dịch này do **nhà đầu tư ký bằng ví của họ** (`wallet.signer.ts`), không phải khóa ngân hàng. Và cần **hai giao dịch**: `approve` rồi mới `redeem`, vì `Redemption.redeem()` gọi `burnFrom` nên phải tiêu allowance mà nhà đầu tư đã cấp.

**Đường đi dự kiến:**

```
components/pages/redeem.tsx  (kênh (client))
   └─ redeemAction() ──→ app/actions/bank.ts
         └───────────────→ lib/bank/redeem.service.ts :: redeemTokens()
```

| Bước | File / hàm cần tạo hoặc dùng | Việc |
|---|---|---|
| 1 | `bank/schemas.ts` → thêm `redeemSchema` | Validate `wptAmount` |
| 2 | `rbac/permissions.ts` → thêm action `token:redeem` (INVESTOR ✅) | Cấp quyền |
| 3 | `rbac/can.ts :: assertCan()` | Kiểm quyền + audit |
| 4 | `ledger/ledger.port.ts` → **bổ sung** `quoteRedeem()`, `redeem()`, `approve()` | Mở rộng hợp đồng port |
| 5 | `ledger/evm.adapter.ts` | Nối `Redemption.sol` qua ABI ở `packages/shared/generated/Redemption.abi.json` |
| 6 | `ledger/mock.adapter.ts` | **Bắt buộc** hiện thực song song, giữ đủ ràng buộc: `paused`, `isWhitelisted`, đủ thanh khoản VNDB |
| 7 | `signer/wallet.signer.ts` | Nhà đầu tư ký (khác mint) |
| 8 | `store/` | `saveTxn` PENDING → `waitReceipt` → cập nhật |
| 9 | `bank/result.ts` | Mã lỗi mới: `INSUFFICIENT_LIQUIDITY`, `REDEMPTION_PAUSED`, `NOT_WHITELISTED` |

**Điều kiện `Redemption.redeem()` yêu cầu (phải phản ánh đủ ở UI và mock):**
- Không ở trạng thái `paused`
- `wptAmount > 0`
- Người gọi **đã whitelist**
- Quỹ hợp đồng đủ VNDB: `payoutToken.balanceOf(this) >= quote(wptAmount)`

**Việc của ngân hàng trước đó:** gọi `fund()` nạp thanh khoản VNDB, `setRate()` đặt tỷ giá (đều cần `MANAGER_ROLE`).

**Lưu ý mở rộng:** nên thêm màn hình quản trị thanh khoản ở kênh `(admin)` (xem quỹ, nạp thêm, tạm dừng) — vì `redeem` sẽ fail hàng loạt nếu hết VNDB.

---

## 4.3. Luồng DISTRIBUTION — chia lợi tức (P3, chưa xây)

**Nghiệp vụ:** cuối kỳ, sản lượng điện được chốt → tính lợi nhuận phân phối → chụp snapshot số dư WPT → nhà đầu tư nhận VNDB theo tỷ lệ nắm giữ **tại thời điểm chốt**.

**Cơ chế snapshot là điểm quan trọng nhất:** `createDistribution()` gọi `projectToken.snapshot()` **ngay bên trong**, rồi tính phần chia theo `balanceOfAt(account, snapshotId) / totalSupplyAt(snapshotId)`. Nghĩa là ai mua bán WPT **sau** thời điểm chốt không ảnh hưởng quyền lợi kỳ đó. Dev không được tính lợi tức theo số dư hiện tại.

**Ba giai đoạn:**

### Giai đoạn 1 — chốt sản lượng (oracle)

```
providers/oracle/  (cần tạo, theo khuôn kyc)
   └─→ EnergyOracle.submitReading(periodId, kWh, ...)
        → đủ số xác nhận (requiredConfirmations) → ReadingFinalized
        → distributableProfitVnd(periodId)
```

### Giai đoạn 2 — tạo kỳ chia (ngân hàng)

```
components/pages/distribution.tsx  (kênh (admin))
   └─ createDistributionAction() ──→ app/actions/bank.ts
         └──────────────────────────→ lib/bank/distribution.service.ts
```

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `rbac/permissions.ts` → thêm `distribution:create` (BANK_ADMIN) | Cấp quyền |
| 2 | `ledger.port.ts` → thêm `createDistribution()`, `previewClaim()`, `listDistributions()` | Mở rộng port |
| 3 | `evm.adapter.ts` | Gọi `ProfitDistributor.createDistribution(amount, period)` hoặc `createDistributionFromOracle(periodId)` |
| 4 | Chuẩn bị on-chain | Ngân hàng phải `approve` VNDB cho ProfitDistributor trước (contract dùng `safeTransferFrom`) |
| 5 | `store/` + audit | Ghi kỳ chia, snapshotId, tổng tiền |

**Quyền on-chain cần có:** ProfitDistributor phải giữ `SNAPSHOT_ROLE` trên ProjectToken (vì nó gọi `snapshot()`), và người tạo phải có `DISTRIBUTOR_ROLE`. Thiếu vai trò là nguyên nhân lỗi phổ biến nhất khi triển khai.

### Giai đoạn 3 — nhận lợi tức

Hai mô hình, contract hỗ trợ cả hai:

| Mô hình | Hàm | Ai ký | Dùng khi |
|---|---|---|---|
| **Pull** — nhà đầu tư tự nhận | `claim(id)`, `claimMany(ids)` | Nhà đầu tư (`wallet.signer`) | Mặc định, phí gas do người nhận trả |
| **Push** — ngân hàng chia hộ | `distributeTo(id, accounts[])` | Ngân hàng (`server.signer`) | Nhà đầu tư không có ví hoạt động |

Tiền chưa nhận sau `claimWindow` có thể thu hồi bằng `sweepDust(id, to)`.

**Lưu ý mở rộng:**
- `distributeTo` chạy vòng lặp on-chain → cần **chia lô** để không vượt giới hạn gas. Đặt kích thước lô ở tầng service, không hardcode trong component.
- Màn hình nhà đầu tư nên gọi `previewClaim(id, account)` để hiện số tiền dự kiến trước khi ký.
- `mock.adapter.ts` phải mô phỏng cả cơ chế snapshot, nếu không sẽ không test được logic "mua sau khi chốt thì không được chia".

---

## 4.4. Chu kỳ nghiệp vụ đầy đủ

Tham chiếu `packages/contracts-evm/scripts/demo-cycle.js` — kịch bản đã chạy được ở tầng contract:

```
1. KYC + whitelist nhà đầu tư A, B
2. Ngân hàng mint WPT: A = 6.000, B = 4.000            → luồng MINT (P1 ✅)
3. Chốt kỳ Q1, nạp 300.000.000 VNDB lợi nhuận
   createDistribution → snapshot tự động                → luồng DISTRIBUTION (P3)
4. A tự claim; ngân hàng distributeTo cho B
5. A redeem 1.000 WPT → nhận VNDB, WPT bị đốt          → luồng REDEEM (P2)
```

Đây là thứ tự triển khai được khuyến nghị, và cũng là kịch bản demo cho lãnh đạo.

---

## 4.5. Lộ trình phase

| Phase | Nội dung | Trạng thái |
|---|---|---|
| P0 | Nền: cây thư mục, compose, deploy contract, `ILedgerPort` | ✅ Xong |
| P1 | **MINT** end-to-end | ✅ Xong |
| — | Dọn giao diện sang chủ đề điện gió | ✅ Xong |
| P2 | **REDEEM** (`Redemption.sol`) | ⏳ Kế tiếp |
| P3 | **DISTRIBUTION** (`ProfitDistributor` + `EnergyOracle`) | ⏳ |
| P4 | KYC/audit/RBAC thật + Postgres + xác thực SIWE | ⏳ |
| P5 | Fireblocks thay khóa server; freeze/clawback trên UI | ⏳ |
| P6 | EVM testnet | ⏳ |
| P7 | Stellar (Soroban) | ⏳ |

---

## Phụ lục — lệnh kiểm chứng nhanh

```bash
# 3 luật kiến trúc (cả 3 phải rỗng / đúng vị trí)
grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"
grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/
grep -rnE "role ===|role ==" app/src/ | grep -v "src/lib/rbac/"

# Ký hiệu token cũ không được còn sót (phải rỗng)
grep -rniE "\bSPT\b|tVND" app/src app/e2e app/test packages/ docs/

# Kiểm thử
cd app && npm run typecheck && npx eslint . && npm test && npm run test:e2e
cd packages/contracts-evm && npx hardhat test
```
