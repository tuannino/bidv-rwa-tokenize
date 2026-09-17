---
inclusion: always
---

# BÁO CÁO CÔNG NGHỆ — BIDV RWA TOKENIZE (TOKEN HÓA DỰ ÁN ĐIỆN GIÓ)

> **Tài liệu sống.** Kiro bắt buộc cập nhật file này sau mỗi thay đổi mã nguồn, theo quy tắc trong `.kiro/steering/tech-report-maintenance.md`.
> Đây là nguồn tham chiếu đầu tiên cho dev mới tiếp nhận source.

| Trường | Giá trị |
|---|---|
| Phiên bản tài liệu | 1.6 |
| Cập nhật lần cuối | 2026-09-17 |
| Nhánh / commit | `feat/rbac-actions` |
| Phase đã hoàn thành | P0 (nền), P1 (mint), vòng dọn UI điện gió, P4 (mint trên Sepolia), tiếp nhận bộ test nghiệm thu P4/P7/P12, build+deploy Cloudflare (PR #12), FE-01 v2 (kênh nhà đầu tư + trang tổng quan), BE-01 (mở rộng `ILedgerPort` cho ba luồng), FE-02 (màn kết nối ví), BE-08 (bổ sung quyền RBAC cho ba luồng) |
| Phase kế tiếp | P7 Distribution → P12 Redemption |
| Người cập nhật | Kiro (thực thi) — Supervisor rà soát |

## Quy ước ký hiệu token (BẮT BUỘC dùng thống nhất)

| Ký hiệu | Tên đầy đủ | Contract | Vai trò |
|---|---|---|---|
| **WPT** | Wind Project Token | `tokens/ProjectToken.sol` | Token đại diện phần vốn dự án điện gió, cấp cho nhà đầu tư đã định danh |
| **VNDB** | Vietnam Dong Bank token | `tokens/VNDToken.sol` | Token tiền tệ dùng chi trả lợi tức và hoàn vốn |

⚠️ **Ký hiệu cũ đã bỏ:** `SPT` (nay là **WPT**), `tVND` (nay là **VNDB**). Không dùng lại ký hiệu cũ ở bất kỳ đâu: mã nguồn, giao diện, tài liệu, tên biến, chuỗi hiển thị, test.

---

# PHẦN 1. MÔ TẢ CHUNG HỆ THỐNG

## 1.1. Mục tiêu

Hệ thống mô phỏng nghiệp vụ ngân hàng token hóa tài sản thực (RWA) cho một dự án điện gió: ngân hàng phát hành token dự án (**WPT**) cho nhà đầu tư đã định danh, chia lợi tức theo sản lượng điện bằng **VNDB**, và hoàn vốn khi nhà đầu tư muốn thoát.

Ba kênh người dùng tách theo vai trò nhưng **dùng chung một backend**:

| Kênh | Route group | Vai trò | Quyền vào kênh (`requireAny`) | Nội dung |
|---|---|---|---|---|
| Ngân hàng | `(admin)` | BANK_ADMIN, COMPLIANCE | `token:mint`, `investor:whitelist` | Mint, KYC, whitelist, freeze, clawback |
| Nhà đầu tư | `(client)` | INVESTOR | `portfolio:read` | Xem vị thế WPT, trạng thái phát hành, lịch sử giao dịch, chi tiết dự án |
| Kiểm toán | `(audit)` | AUDITOR | `audit:read` | **Chỉ đọc** sổ kiểm toán |

**Kênh là lựa chọn tường minh, không suy ra từ quyền.** Người dùng chọn kênh ở thanh trên
(cookie `bidv_channel`), và kênh quyết định vai: kênh nhà đầu tư ép vai `INVESTOR` và ẩn bộ chọn
vai; kênh Admin console cho chọn giữa ba vai ngân hàng. Cookie kênh **chỉ** dùng để hiển thị —
phân quyền vẫn đi qua vai + `can(role, action)`.

⚠️ Quyền vào kênh nhà đầu tư phải là một action **chỉ INVESTOR có**. FE-01 v1 dùng `balance:read`
và guard không chặn được ai, vì quyền đó nằm trong nhóm `READ_ONLY` được spread vào cả ba vai
ngân hàng. Xem 1.6.B.

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
│   │   ├── (client)/          # Kênh nhà đầu tư: portfolio, tokens/[symbol], wallet
│   │   ├── actions/           # Server Actions (bank.ts, session.ts, portfolio.ts)
│   │   ├── api/               # REST: mint, balance, investors, token, txns
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── src/components/
│   │   ├── layout/            # sidebar, header, chain-selector, channel-guard,
│   │   │                      #   nav-config, channel-switcher, role-switcher
│   │   ├── investor/          # 4 hộp trang tổng quan + nhãn dữ liệu mẫu
│   │   ├── wallet/            # no-wallet-guide, wrong-chain-banner,
│   │   │                      #   wallet-status-card (dùng lại ở FE-05/09/11)
│   │   ├── pages/             # mint, kyc, assets, dashboard, reconciliation,
│   │   │                      #   investor-portfolio, investor-token-detail,
│   │   │                      #   wallet-connect
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
│   │   ├── scripts/           # deploy.js, demo-cycle.js, demo-oracle.js,
│   │   │                      #   preflight-sepolia.js, verify-deployment.js,
│   │   │                      #   dod-verify-sepolia.js (nghiệm thu DoD lớp 2)
│   │   ├── test/              # full-cycle, oracle-cycle (13 test)
│   │   │                      #   + spec-p4/p7/p12 theo acceptance criteria (54 test)
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

Cả hai chế độ đều để `ENABLE_DEMO_PAYMENT_MINT` **tắt**; chỉ bật trên môi trường thử của người phát
triển. Danh sách đầy đủ các cờ ở **3.6**.

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
| Revert một PR rồi merge lại nhánh đó để "lấy code về" | Git **không** phục hồi: merge chỉ so sánh với merge-base nên phần đã revert biến mất vĩnh viễn. Đó là lý do `dev` từng mất sạch `packages/` và `app/src/lib/`. Cách đúng duy nhất: `git revert <sha-của-commit-revert>`. Không merge lại, không cherry-pick — `branching.md` §6 |
| Lấy nền từ nhánh phụ, hoặc tự chọn nền khác khi `dev` hỏng | Nền duy nhất được phép là `dev`. `dev` hỏng thì DỪNG và hỏi Owner — `branching.md` §1, §5 |
| Rebase nhánh mới lên nhánh khác khi nhánh nền chứa commit phá hoại | `git rebase <đích>` sẽ kéo theo cả commit của nhánh nền; kỹ thuật đúng là `git rebase --onto <đích> <nền> <nhánh>`. Nhưng **chỉ dùng sau khi Owner đồng ý** đổi nền |
| Commit trực tiếp lên `dev` | Cấm, kể cả sửa một dòng tài liệu. Mở nhánh `docs/<tên>` từ `dev` rồi để Owner merge — `branching.md` §10. Ngoại lệ do Owner chỉ định thì phải nói rõ và ghi lại (§12) |
| Thêm method liệt kê người nắm giữ vào `ILedgerPort` | ERC-20 chỉ lưu **bảng số dư theo địa chỉ**, không lưu danh sách địa chỉ — không lời gọi nào đọc ra danh sách từ chuỗi. Danh sách ví lấy từ cơ sở dữ liệu, về sau từ Indexer. Đừng quét sự kiện trong adapter (xem 3.1) |
| Nối method vào contract có ngữ nghĩa "gần gần" khi contract đúng chưa có | Tệ hơn chưa nối: cho ra hệ thống chạy được nhưng làm ngược, và không ai phát hiện tới lúc chạy thật. Ném `LedgerNotImplementedError` với gợi ý nêu đúng thứ đang thiếu, rồi ghi câu hỏi mở |
| Đọc `data.errorName` trước `reason` khi bóc revert của viem | Mất sạch lý do: `require(cond, "chuoi")` cho `errorName = 'Error'`, chuỗi thật ở `reason`. Thứ tự đúng `reason` → `data.errorName` → `signature` (xem 3.1) |
| ABI tối giản chỉ có `function` và `event` | Thiếu mục `error` thì viem không giải mã custom error OZ v5, chỉ ra 4 byte selector (xem 3.7) |
| Lấy mã snapshot bằng cách tự tăng số đếm hoặc gọi `getCurrentSnapshotId()` sau khi gửi tx | Tx snapshot của người khác chen vào giữa hai lời gọi là ta lấy về mã của họ — sai âm thầm, rồi chia lợi nhuận theo ảnh chụp sai. Nguồn duy nhất: event `Snapshot` trong receipt |

### B. Quyết định thiết kế có chủ ý (đừng "sửa" nhầm)

- **Dùng `pg` thuần, không dùng Prisma Client.** Prisma Client nặng ~22 MB (có query engine nhị phân) sẽ phá giới hạn bundle Worker; `pg` chỉ ~0.5 MB. Prisma vẫn giữ để **sinh lược đồ** (`schema.prisma` → `init.sql`), nên không có hai nguồn DDL.
- **Trả `Result<T>` thay vì `throw`.** Next.js che thông báo lỗi ở production, và kết quả phải tuần tự hóa được qua biên server → client (không `bigint`, không `Error`).
- **Số lượng token truyền dưới dạng chuỗi.** `number` của JS mất chính xác từ 2^53; `bigint` không qua được biên serialize.
- **Stub luôn ném lỗi, không bao giờ trả giá trị giả.** `fireblocks.signer.stub.ts` không được âm thầm quay về khóa server — đó là lỗ hổng bảo mật.
- **Mock nghiêm ngặt ngang bản thật.** `mock.adapter.ts` vẫn chặn khi chưa KYC / bị băng / đang tạm dừng, và từ BE-01 giữ thêm: phát hành lần hai bị từ chối, khớp lệnh kiểm số dư/ủy quyền/tồn WPT của ví SPV, tất toán chặn chuyển nhượng nhưng cho đốt, quỹ lợi nhuận thiếu tiền thì từ chối trước khi chuyển cho ai. Nếu mock dễ tính hơn contract thật thì sẽ sinh loại lỗi "chạy mock được, lên chain thật hỏng". Hai chỗ dễ sai nhất: giá bán mặc định để 0 làm khớp lệnh thành "mua không mất tiền"; kiểm tra rải rác giữa các bước thay đổi trạng thái làm thất bại để lại trạng thái nửa vời — **mọi kiểm tra phải chạy trước mọi thay đổi trạng thái**.
- **Test ca từ chối phải kiểm luôn "trạng thái không đổi".** Chỉ kiểm "có ném lỗi" thì bỏ sót đúng thứ nguy hiểm nhất: lỗi vẫn ném mà số dư đã bị trừ.
- **Kiểu của hàm `never` ghi trên BIẾN, không trên hàm mũi nhọn.** `const reject: (a: string, b: string) => never = ...` thì TypeScript mới thu hẹp kiểu sau lời gọi; viết `const reject = (...): never =>` thì sau `if (!x) reject(...)` biến `x` vẫn còn `| undefined`.
- **`import 'server-only'` trong `config/env.ts`.** Đây là hàng rào cứng: nếu Client Component lỡ import, build sẽ fail ngay thay vì rò khóa ra bundle trình duyệt.
- **`brand.ts` là ngoại lệ hex màu duy nhất.** Logo và modal ví cần màu cố định không đổi theo theme. Ngoài file này, mọi màu phải dùng biến CSS.
- **`chain-store` không persist, mặc định `null`.** Để lần render đầu khớp server, tránh lỗi hydration mismatch.
- **Kênh là lựa chọn tường minh, vai suy ra từ kênh.** Không xác định kênh bằng quyền: một quyền đọc thuộc nhiều vai nên không nói được người dùng đang ở kênh nào. `setChannel` đặt **cả hai** cookie (`bidv_channel` + `bidv_role`) trong một lần — hai cookie lệch nhau là người dùng gặp màn từ chối mà không hiểu vì sao.
- **Quyền vào kênh nhà đầu tư phải là action riêng của INVESTOR.** FE-01 v1 dùng `balance:read`, nằm trong `READ_ONLY` nên cả bốn vai đều có và guard không chặn được ai. Đừng "dọn dẹp" `portfolio:read` vào `READ_ONLY`.
- **`nav-config.ts` là dữ liệu thuần, `icon` là TÊN dạng chuỗi.** `AppLayout` dùng trong page (Server Component) còn `Sidebar` là `'use client'`, nên `NavSection` đi qua biên server → client. Để `icon` là component gây `Functions cannot be passed directly to Client Components` — đã xảy ra thật ở FE-01 v1. Thêm `'use client'` vào `nav-config.ts` **không** giải quyết: prop vẫn phải tuần tự hóa, và nó biến `AppLayout` thành Client Component.
- **`AppLayout` đặt trong từng page, không ở `layout.tsx` của route group.** `layout.tsx` chỉ giữ `ChannelGuard`. Đặt cả hai chỗ sẽ lồng layout hai lần.
- **Điều hướng khi đổi kênh làm bằng `redirect()` trong server action, không bằng `router.push` ở client.** Đổi kênh làm vai mất quyền của trang đang mở, `ChannelGuard` kết xuất màn từ chối mà màn đó không bọc `AppLayout` → `Header` bị unmount và `push` trong transition đã unmount sẽ mất.
- **`publicConfig()` là async và đọc cookie.** Trước đây trả `role` từ `env.demoRole` nên giao diện hiển thị sai vai sau khi đổi vai (kể cả gate nút trong `mint.tsx`). Hệ quả có chủ ý: root layout thành động, `/` không còn prerender tĩnh.
- **Nhãn dữ liệu mẫu là một component dùng chung** (`components/investor/mock-badge.tsx`). Nhãn lúc "mock" lúc "demo" lúc không có thì người xem là ngân hàng không biết con số nào tin được.
- **Trạng thái ví quyết định ở MỘT hàm thuần, `mock` xét trước mọi phép kiểm ví.** `resolveWalletStatus()` trong `lib/wallet/wallet-status.ts` không phụ thuộc React lẫn wagmi nên test được ở vitest môi trường `node`. Thứ tự ưu tiên là phần dễ làm sai nhất — bảng đầy đủ ở 3.9. Đừng thêm điều kiện `if` về ví vào component: đó là lúc bắt đầu có nguồn sự thật thứ hai.
- **`useAccount().chainId` mới là chain của ví, `useChainId()` thì không.** `useChainId()` lùi về chain đầu tiên trong cấu hình khi chưa kết nối, nên dùng nó để so sánh sẽ kết luận "đã khớp chain" trong lúc chưa có ví nào.
- **Dò ví bằng external store, không đọc `window.ethereum` một lần lúc mount.** Ví theo EIP-6963 công bố không đồng bộ: ngay sau khi tải trang có thể chưa thấy gì, một nhịp sau mới có. Thêm chốt an toàn: đã `isConnected` thì không kết luận "chưa cài ví" dù phép dò không thấy.
- **State lỗi mang theo khoá tình huống, không phải `string | null` trơn.** Không có khoá thì thông báo sống dai hơn tình huống sinh ra nó — người dùng tự đổi mạng trong ví rồi mà câu "Bạn đã từ chối chuyển mạng" vẫn còn. Có khoá thì "còn hiệu lực" là thứ suy ra, và tránh luôn `setState` trong effect mà React Compiler chặn.
- **`explorerTxUrl`/`explorerAddressUrl` trả `null` cho chain không có explorer.** UI phải ẩn liên kết. Trỏ tx của `hardhat-local` sang explorer công khai sẽ ra trang "not found" — tệ hơn là không có liên kết.

### C. Nợ kỹ thuật đã biết (cần xử lý, đã ghi nhận)

| Mức | Vấn đề | Hướng xử lý |
|---|---|---|
| **P1** | Chưa có xác thực thật. Vai trò lấy từ cookie do client đặt được | Phase 4: SIWE + phiên thật. **Trước đó tuyệt đối không deploy public khi chưa bật bảo vệ mật khẩu** |
| **P1** | **Bộ contract trên Sepolia còn symbol `tVND` cũ.** Mã nguồn đã đổi sang `VNDB` nhưng bản đã deploy thì không đổi được — symbol nằm trong constructor | Deploy lại `VNDToken`, `ProfitDistributor`, `Redemption` (hai cái sau giữ địa chỉ VNDToken dạng `immutable`) rồi verify lại. `ProjectToken`/WPT không ảnh hưởng nên P4 vẫn đứng |
| ~~P2~~ | ~~Build Cloudflare fail ENOENT: Next sinh ra `.next/standalone/app/.next`, OpenNext đọc `.next/standalone/.next`~~ | **ĐÃ XỬ LÝ ở PR #12** (`app/scripts/flatten-standalone.mjs` + script `cf:build`). Đề nghị Supervisor xác nhận rồi xóa dòng này — theo `tech-report-maintenance.md` §8, việc thêm/xóa nợ do Supervisor quyết |
| **P2** | Docker build phụ thuộc CDN Alpine (`apk add`) → giòn ở mạng doanh nghiệp có tường lửa | Cân nhắc base `node:24-bookworm-slim` |
| **P2** | Node 20 đã hết hạn LTS từ 30/04/2026, không còn vá bảo mật | Nâng Docker image lên Node 24 (LTS đến 2028) |
| **P1** | **10 trong 16 method mới của `ILedgerPort` chưa nối được ở `evm.adapter`** — chờ contract phát hành một lần (SC-02), contract khớp lệnh (SC-03), mapping `snapshotId`→`distributionId` (BE-06), và xác nhận cờ tất toán/NAV nối vào contract nào. Bảng đầy đủ ở 3.1 | Hiện phát triển trên chain `mock` (đã hiện thực đủ 16/16, có 48 test). Khi contract xong thì bổ sung `evm.adapter` trong commit riêng — `docs/CHECKPOINT_BE01.md` |
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
| Vitest | Unit test (36 test) | 3.2.4 | 5.0.0 | MIT |
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
| `ledger.port.ts` | Định nghĩa `ILedgerPort` — hợp đồng mà mọi chain phải tuân theo (250 dòng) |
| `index.ts` | Factory `getLedger(chain, signer)` — map chain → adapter |
| `evm.adapter.ts` | Hiện thực EVM bằng viem (570 dòng) |
| `mock.adapter.ts` | Ledger trong RAM, không cần chain (592 dòng) |
| `stellar.adapter.ts` | Stub Soroban, mọi hàm ném lỗi rõ ràng (135 dòng) |
| `address.ts` | `normalizeEvmAddress()` — chuẩn hóa và kiểm checksum EIP-55 |

### `ILedgerPort` — 7 nhóm, 27 method

Từ BE-01, `ILedgerPort` được **tách thành 7 interface con theo nghiệp vụ** trong cùng
`ledger.port.ts`, rồi hợp lại bằng kế thừa kiểu. Tên `ILedgerPort` giữ nguyên và vẫn là
thứ duy nhất tầng nghiệp vụ nhìn thấy, nên không lời gọi nào phải sửa khi tách.

Cột adapter: ✅ đã hiện thực · ⏳ ném `LedgerNotImplementedError` (chờ thứ ghi ở cột cuối).

| # | Interface | Method | mock | evm | stellar | Chờ gì |
|---|---|---|---|---|---|---|
| 1 | `ILedgerCompliance` | `whitelist` | ✅ | ✅ | ⏳ | Phase 7 |
| 2 | | `isWhitelisted` | ✅ | ✅ | ⏳ | Phase 7 |
| 3 | | `freeze` | ✅ | ✅ | ⏳ | Phase 7 |
| 4 | | `isFrozen` | ✅ | ✅ | ⏳ | Phase 7 |
| 5 | | `canTransfer` | ✅ | ✅ | ⏳ | Phase 7 |
| 6 | `ILedgerIssuance` | `mint` | ✅ | ✅ | ⏳ | Phase 7 |
| 7 | | `burn` | ✅ | ✅ | ⏳ | Phase 7 |
| 8 | | `transfer` | ✅ | ✅ | ⏳ | Phase 7 |
| 9 | | `forcedTransfer` | ✅ | ✅ | ⏳ | Phase 7 |
| 10 | | `mintInitialSupply` | ✅ | ⏳ | ⏳ | contract phát hành một lần (SC-02) |
| 11 | | `isInitialSupplyMinted` | ✅ | ⏳ | ⏳ | contract phát hành một lần (SC-02) |
| 12 | `ILedgerPurchase` | `quotePurchase` | ✅ | ⏳ | ⏳ | contract khớp lệnh (SC-03) |
| 13 | | `paymentBalanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 14 | | `paymentAllowanceOf` | ✅ | ⏳ | ⏳ | địa chỉ contract khớp lệnh (SC-03) |
| 15 | | `executePurchase` | ✅ | ⏳ | ⏳ | contract khớp lệnh (SC-03) |
| 16 | `ILedgerSnapshot` | `takeSnapshot` | ✅ | ✅ | ⏳ | Phase 7 |
| 17 | | `balanceOfAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 18 | | `totalSupplyAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 19 | `ILedgerDistribution` | `profitPoolBalance` | ✅ | ✅ | ⏳ | Phase 7 |
| 20 | | `distributeBatch` | ✅ | ⏳ | ⏳ | mapping `snapshotId`→`distributionId` (BE-06) |
| 21 | `ILedgerSettlement` | `setSettlementMode` | ✅ | ⏳ | ⏳ | xác nhận cờ tất toán nối vào contract nào |
| 22 | | `isSettlementMode` | ✅ | ⏳ | ⏳ | xác nhận cờ tất toán nối vào contract nào |
| 23 | | `setNavRate` | ✅ | ⏳ | ⏳ | xác nhận NAV có phải `Redemption.rate` |
| 24 | | `navRate` | ✅ | ⏳ | ⏳ | xác nhận NAV có phải `Redemption.rate` |
| 25 | `ILedgerRead` | `balanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 26 | | `tokenInfo` | ✅ | ✅ | ⏳ | Phase 7 |
| 27 | | `waitReceipt` | ✅ | ✅ | ⏳ | Phase 7 |

Kiểu đi kèm: `TransferCheck` (`{ allowed: true } | { allowed: false; reason: string }`) và
`SnapshotResult` (`{ tx, snapshotId }`).

**KHÔNG có method liệt kê người nắm giữ, và đó là quyết định có chủ đích.** ERC-20 chỉ lưu
bảng số dư theo địa chỉ, không lưu danh sách địa chỉ, nên không lời gọi nào đọc ra danh
sách từ chuỗi. Danh sách ví cần chia lợi nhuận / cần tất toán lấy từ cơ sở dữ liệu (lệnh
mua đã hoàn tất, vị thế nhà đầu tư), về sau từ Indexer, rồi truyền vào `distributeBatch`.
Đừng thêm `holdersAt` rồi hiện thực bằng cách quét sự kiện trong adapter — quét sự kiện là
việc của Indexer; làm trong adapter thì chậm, không phân trang được, và sai ngay khi RPC
giới hạn khoảng block.

**Lưu ý khi phát triển:**
- `evm.adapter` luôn `simulateContract` **trước** khi `writeContract`. Giữ nguyên thói quen này: vi phạm tuân thủ báo lỗi ngay, không đốt gas vào giao dịch chắc chắn revert.
- Hàm `fail()` + bảng `REVERT_MESSAGES` bóc revert reason của contract thành câu tiếng Việt đọc được. Thêm lỗi mới thì bổ sung vào bảng đó.
  Thứ tự đọc là `reason` → `data.errorName` → `signature`, **không** được đảo: với `require(cond, "chuoi")` viem đặt `data.errorName = 'Error'` và để chuỗi thật ở `reason`, nên ưu tiên `errorName` sẽ biến mọi lỗi tuân thủ thành đúng một câu "Contract từ chối: Error".
- `LedgerError` mang thông báo cho người dùng cuối, không phải log kỹ thuật.
- `takeSnapshot` là method ghi **duy nhất tự chờ receipt**: mã snapshot chỉ có trong event `Snapshot`, nên trả `PENDING` là vô nghĩa. Không tự tăng số đếm, cũng không gọi `getCurrentSnapshotId()` sau khi gửi — tx snapshot của người khác có thể chen vào giữa hai lời gọi.
- `mock.adapter` phải **nghiêm ngặt ngang contract thật**. Bảng ràng buộc bắt buộc ở `docs/be-01-ledger-port/design.md` mục 3; 48 test ở `test/mock-ledger.test.ts` phủ từng dòng.
- `seedMockLedger()` chỉ dành cho test/demo: VNDB, mức ủy quyền và quỹ lợi nhuận do hệ thống khác sinh ra, `ILedgerPort` chỉ đọc. **Không** gọi từ nghiệp vụ.

**Cách mở rộng:**
1. Thêm method mới → khai báo ở `ledger.port.ts` trước, trong đúng interface con theo nghiệp vụ.
2. Hiện thực ở **cả ba** adapter (stellar có thể ném "chưa hỗ trợ", kèm gợi ý nêu rõ thứ đang thiếu).
3. Bổ sung test ở `test/mock-ledger.test.ts`.
4. **Không bao giờ** thêm method chỉ cho một adapter rồi ép kiểu ở nơi gọi.
5. Chưa có contract thì **ném lỗi**, đừng nối tạm vào một contract có ngữ nghĩa gần gần: `Redemption.paused` chẳng hạn ngược hướng với "bật giai đoạn tất toán", nối vào sẽ ra hệ thống chạy được nhưng làm ngược.

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
| `permissions.ts` | Bảng dữ liệu thuần: 4 role × 21 action |
| `can.ts` | `can(role, action)` + `assertCan()` + `permissionsOf()` — **điểm kiểm quyền duy nhất** |
| `session.ts` | `currentRole()` — đọc vai trò hiện tại từ cookie `bidv_role` |
| `demo-payment.ts` | Chốt chặn **hai lớp** riêng cho `demo:mint-payment`: `canMintDemoPayment()`, `assertCanMintDemoPayment()`, `DemoPaymentMintDisabledError` |

**Ma trận quyền (đủ 21 action, tên đúng như trong `ACTIONS`):**

| Action | BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR |
|---|:--:|:--:|:--:|:--:|
| `token:mint` | ✅ | ❌ | ❌ | ❌ |
| `token:burn` | ✅ | ❌ | ❌ | ❌ |
| `token:clawback` | ✅ | ❌ | ❌ | ❌ |
| `token:freeze` | ✅ | ✅ | ❌ | ❌ |
| `investor:whitelist` | ✅ | ✅ | ❌ | ❌ |
| `kyc:approve` | ✅ | ✅ | ❌ | ❌ |
| `token:transfer` | ❌ | ❌ | ✅ | ❌ |
| `order:place` | ❌ | ❌ | ✅ | ❌ |
| `order:execute` | ✅ | ❌ | ❌ | ❌ |
| `distribution:snapshot` | ✅ | ❌ | ❌ | ❌ |
| `distribution:execute` | ✅ | ❌ | ❌ | ❌ |
| `settlement:initiate` | ✅ | ❌ | ❌ | ❌ |
| `settlement:set-nav` | ✅ | ❌ | ❌ | ❌ |
| `settlement:confirm` | ❌ | ❌ | ✅ | ❌ |
| `treasury:manage` | ✅ | ❌ | ❌ | ❌ |
| `demo:mint-payment` | ✅ **+ cờ** | ❌ | ❌ | ❌ |
| `portfolio:read` | ❌ | ❌ | ✅ | ❌ |
| `balance:read` | ✅ | ✅ | ✅ | ✅ |
| `txn:read` | ✅ | ✅ | ✅ | ✅ |
| `audit:read` | ✅ | ✅ | ❌ | ✅ |
| `reconcile:read` | ✅ | ✅ | ❌ | ✅ |

Chín action từ `order:place` đến `demo:mint-payment`, cộng `reconcile:read` — **10 hành động BE-08
thêm vào** — là **chỗ đặt guard** cho ba luồng khớp lệnh / chia lợi nhuận / tất toán. Nghiệp vụ dùng
chúng thuộc BE-02..BE-07, **chưa xây**.

**Vì sao ma trận chia như vậy** — đây là phân định trách nhiệm, không phải cấp quyền cho đủ:

- `order:place` và `settlement:confirm` **cố tình không** cấp cho `BANK_ADMIN`. Hai việc đó là quyết
  định của nhà đầu tư; ngân hàng đặt lệnh hoặc xác nhận hoàn vốn thay thì mất dấu ai đã đồng ý, và
  sổ kiểm toán không còn dùng được để đối chiếu trách nhiệm.
- `COMPLIANCE` **không** có `order:execute`, `distribution:execute`, `settlement:set-nav`. Tuân thủ
  giám sát dòng tiền chứ không tự thực hiện: cùng một người vừa giám sát vừa chuyển tiền là mất lớp
  kiểm soát thứ hai.
- `settlement:*` chứ không phải `token:redeem`, vì luồng chốt là ngân hàng điều phối và đốt token,
  không phải nhà đầu tư tự đổi. Hành động đốt **tái dùng** `token:burn` đã có.
- `reconcile:read` nằm trong nhóm `READ_ONLY` nên ba vai ngân hàng tự nhận được; `INVESTOR` không
  spread nhóm đó nên tự động không có. Đúng ý định: báo cáo đối soát là dữ liệu toàn hệ.

⚠️ **`demo:mint-payment` cần HAI lớp, quyền RBAC một mình KHÔNG đủ.** Bảng quyền là mã nguồn, nên
chỉ cần ai gán nhầm vai `BANK_ADMIN` trên môi trường thật là chức năng tự phát hành tiền mở ra. Lớp
thứ hai là cờ `ENABLE_DEMO_PAYMENT_MINT` (mặc định **tắt**, xem 3.6), nằm ở cấu hình triển khai nên
hai lớp không cùng hỏng vì một sai sót. Điểm kiểm duy nhất là `demo-payment.ts`, thứ tự **cờ trước,
quyền sau** — cờ tắt thì từ chối luôn, không đọc vai, nhờ vậy thông báo nói đúng nguyên nhân và
không có đường nào để vai trò "bù" cho cờ. Đừng gọi `can(role, 'demo:mint-payment')` trực tiếp.

⚠️ **`demo-payment.ts` KHÔNG được export từ `rbac/index.ts`.** Barrel đó là client-safe (component
dùng `can()` để ẩn/hiện nút), còn file này `server-only` vì phải đọc env. Đưa vào barrel là làm mọi
component `import ... from '@/lib/rbac'` fail build.

**Lưu ý:** `can(role: unknown, ...)` nhận `unknown` có chủ ý để dữ liệu ngoài vào an toàn; role lạ **quy về AUDITOR** (quyền thấp nhất), không cho qua. Đây là nguyên tắc đóng, giữ nguyên khi mở rộng.

⚠️ **`READ_ONLY` là bẫy.** Hằng private
`READ_ONLY = ['balance:read','txn:read','audit:read','reconcile:read']` được spread vào BANK_ADMIN,
COMPLIANCE và AUDITOR. Quyền nào đặt vào đó thì **ba vai ngân hàng tự động có**, nên không dùng làm
cổng vào kênh nhà đầu tư được. `portfolio:read` cố tình khai riêng cho INVESTOR, và có test chốt lại
điều này (`app/test/rbac.test.ts`).

**Cách mở rộng:** thêm action mới → khai báo trong `permissions.ts` → thêm một dòng vào bảng
`NEW_ACTIONS` của `app/test/rbac.test.ts` → dùng `assertCan()` ở service. Không viết logic quyền ở
nơi khác.

Bước thêm test **không phải hình thức**: `rbac.test.ts` có một test đối chiếu `ACTIONS` với bảng
`NEW_ACTIONS`, nên thêm action mà quên test là **đỏ ngay**, không chờ người review nhớ ra. Cùng file
còn giữ mốc `PERMISSIONS_BEFORE_BE08` để một lần sắp xếp lại `ROLE_PERMISSIONS` không lặng lẽ gỡ
quyền của vai nào.

⚠️ **`session.ts` là nợ kỹ thuật P1.** PoC chưa có xác thực thật, cookie do client đặt được. Phase 4 phải thay bằng phiên có chữ ký.

## 3.4. `app/src/lib/bank/` — tầng nghiệp vụ

| File | Vai trò | Hàm chính |
|---|---|---|
| `authorize.ts` | Guard + quy lỗi **dùng chung mọi nghiệp vụ** | `authorize()`, `toResult()` |
| `mint.service.ts` | Nghiệp vụ phát hành | `onboardInvestor()`, `mintTokens()`, `readBalance()`, `listTransactions()`, `tokenOverview()` |
| `portfolio.service.ts` | Vị thế nhà đầu tư (chỉ đọc) | `getPortfolio()`, `getWalletTransactions()`, `getTokenSummary()` |
| `issuance.ts` | Điều khoản phát hành | `WPT_ISSUE_PRICE_VND`, `wptToVnd()` |
| `audit.service.ts` | Đọc sổ kiểm toán | `listAuditLog()` |
| `result.ts` | Kiểu `Result<T>` + `ok`/`err` + `httpStatusFor` | Chuẩn hóa lỗi |
| `schemas.ts` | Schema Zod dùng chung FE/BE | `mintSchema`, `amountSchema`, `walletSchema` |

**Lưu ý khi phát triển:**
- `authorize()` ghi audit cho **cả hai kết cục** ALLOWED và DENIED. Giữ nguyên: kênh kiểm toán cần thấy cả những lần bị chặn.
- `authorize()`/`toResult()` nằm ở `authorize.ts`, **không** sao chép vào service mới: hai đường ghi audit song song sẽ lệch nhau ở lần sửa đầu tiên, và sổ kiểm toán thiếu bản ghi thì không dùng được để đối chiếu trách nhiệm.
- Hàm đọc dữ liệu theo ví phải để `wallet` **bắt buộc** trong schema. `ITxnStore.listTxns` không truyền `wallet` sẽ trả giao dịch của **mọi** ví; để optional là mở đường cho một lời gọi thiếu tham số làm rò dữ liệu ví khác ra giao diện nhà đầu tư.
- Giá phát hành là **tham số cấu hình** (`issuance.ts`), không phải dữ liệu mẫu và không phải giá thị trường. Nhờ vậy `số dư thật × giá phát hành` không trộn số thật với số bịa.
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
| `config/flags.ts` | Tính cấu hình công khai ở server | Quyết định chain nào chọn được; `demoPaymentMint` tính bằng đúng hàm mà server dùng để chặn |
| `config/config-context.tsx` | Truyền cấu hình xuống client | Client không tự đọc env |
| `chains/registry.ts` | Map ChainKey → cấu hình viem, tự `defineChain` | Không import `viem/chains` để tránh phình bundle |
| `chains/chain-store.ts` | Zustand giữ chain đang chọn | Không persist, mặc định `null` chống hydration mismatch |
| `chains/use-selected-chain.ts` | Chain đang dùng = lựa chọn người dùng, chưa chọn thì lấy mặc định server | Lựa chọn không còn dùng được thì **lặng lẽ** lùi về mặc định — chỗ gọi phải tự kiểm `selectable` trước khi bày nút đổi chain |

**Cờ tính năng trong `env.ts`:**

| Cờ | Mặc định | Ý nghĩa |
|---|:--:|---|
| `USE_MOCK_KYC`, `USE_MOCK_ORACLE`, `USE_MOCK_COREBANK` | `true` | Dùng provider mock để mint chạy ngay, không cần tích hợp thật |
| `USE_MOCK_DB` | `true` | `true` = Txn/audit trong RAM (free-tier); `false` = Postgres qua `DATABASE_URL` |
| `ENABLE_DEMO_PAYMENT_MINT` | **`false`** | Cho cán bộ ngân hàng tự phát hành VNDB vào ví chỉ định — **chỉ môi trường thử** |

⚠️ **`ENABLE_DEMO_PAYMENT_MINT` mặc định tắt và đó là mặc định duy nhất đúng.** Bật trên môi trường
thật là cho phép cán bộ ngân hàng tự phát hành tiền, không đối soát nào bắt được. Cờ này **không có**
biến thể `NEXT_PUBLIC_`: nó phải do người triển khai đặt ở server, không để lộ ra bundle browser như
một thứ bật được từ phía client. Nó là **lớp chặn thứ hai** bên cạnh quyền `demo:mint-payment`; đọc
cờ ở đúng một chỗ là `lib/rbac/demo-payment.ts` (xem 3.3), đừng đọc rải rác.

Trạng thái kết nối ví ở client là chuyện khác, xem **3.9**.

## 3.7. `packages/shared/` — một nguồn sự thật

| File | Nội dung |
|---|---|
| `src/types.ts` | `ChainKey`, `ChainFamily`, `TxStatus`, `ContractName`… **Không import gì nặng** (bị kéo vào bundle edge) |
| `src/chains.ts` | Danh sách chain: `hardhat-local` (mặc định), `evm`, `stellar`, `mock`. Kèm `explorerTxUrl()` và `explorerAddressUrl()` — **trả `null`** khi chain không có explorer (`hardhat-local`, `mock`) để UI ẩn liên kết chứ không trỏ sang explorer chain khác |
| `src/abi/` | ABI tối giản cho web: `project-token.ts`, `vnd-token.ts`, `profit-distributor.ts`, `redemption.ts` |
| `generated/` | ABI đầy đủ sinh từ Hardhat — chỉ để test đối chiếu, không ship lên web |
| `src/addresses.ts` | Tra địa chỉ contract: **env thắng file**, hỗ trợ free-tier không đọc được filesystem |

⚠️ **Tuyệt đối không copy ABI hay địa chỉ contract ra ngoài package này.**

**ABI tối giản phải có cả mục `error`, không chỉ `function` và `event`.** OZ v5 revert bằng
custom error; ABI thiếu mục `error` thì viem không giải mã được và chỉ trả về 4 byte
selector, ra message kiểu `reverted with the following signature: 0xe2517d3f` — vô nghĩa
với cả người dùng lẫn người sửa lỗi.

`app/test/abi-contract-sync.test.ts` đối chiếu **cả 4** ABI tối giản với `generated/`, nên
sửa contract mà quên sửa ABI thì test đỏ ngay, không đợi lỗi "function not found" lúc chạy.

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

## 3.9. `app/src/lib/wallet/` và `lib/hooks/` — trạng thái ví ở client (FE-02)

> Đánh số 3.9 chứ không chèn vào giữa vì `tech-report-maintenance.md` đang tham chiếu
> "Phần 3.6" và "Phần 3.8"; đánh số lại sẽ làm hai tham chiếu đó trỏ sai.

Đây là **cổng vào của mọi thao tác ký ở kênh nhà đầu tư**. Ví trình duyệt CHỈ dùng cho thao
tác của nhà đầu tư; thao tác đặc quyền của ngân hàng vẫn ký bằng khóa phía máy chủ qua
`ISigner` (Luật #2).

| File | Vai trò | Lưu ý |
|---|---|---|
| `wallet/wallet-status.ts` | Logic THUẦN: `resolveWalletStatus()`, `canSignWith()`, `blockedSigningReason()`, `chainIdToSwitchTo()`, `chainKeyOfChainId()`, `chainIdLabel()` | Không React, không wagmi — nhờ vậy test được ở vitest môi trường `node`. Danh sách chain được phép (`WALLET_CHAIN_KEYS`, `ALLOWED_CHAIN_IDS`) **suy ra từ `CHAINS`**, không ghi cứng chainId |
| `wallet/injected-provider.ts` | Dò ví bằng external store cho `useSyncExternalStore` | Nghe cả `window.ethereum` và sự kiện `eip6963:announceProvider`. Ví EIP-6963 công bố **không đồng bộ** nên đọc một lần lúc mount sẽ kết luận sai là "chưa cài ví" |
| `wallet/switch-error.ts` | `isUserRejection()`, `describeSwitchError()` | Bóc lỗi theo tầng `cause`. Đọc `error.message` tầng ngoài sẽ ra văn bản kỹ thuật tiếng Anh cho mọi trường hợp |
| `wallet/format.ts` | `shortenAddress()`, `formatNativeAmount()` | Tự viết vì component **không được nhập viem**, và `useBalance().data.formatted` của wagmi đã `@deprecated`. Cắt phần thập phân, **không làm tròn lên** |
| `hooks/use-wallet-status.ts` | `useWalletStatus()` — thu thập đầu vào thật rồi gọi hàm thuần | MỘT chỗ trả lời "ví sẵn sàng ký chưa" cho FE-04/05/09/11 |
| `hooks/use-native-balance.ts` | Số dư đồng bản địa | `eth_getBalance`, **không phải lời gọi hợp đồng** nên không thuộc `ILedgerPort`. Số dư WPT/VNDB vẫn phải đi qua `ILedgerPort` |
| `hooks/use-is-mounted.ts` | `false` ở server, `true` sau hydrate | Đã có từ trước. Dùng `useSyncExternalStore`, **đừng viết lại** bằng `useEffect` + `setState` |

### Tám trạng thái và THỨ TỰ ƯU TIÊN (làm sai thứ tự sẽ hiện cảnh báo vô nghĩa)

| # | Trạng thái | Khi nào | Hiển thị |
|---|---|---|---|
| 1 | `loading` | chưa hydrate | khung chờ |
| 2 | `mock` | chain đang chọn là `mock` | "đang ở chế độ mô phỏng", **dừng, không kiểm gì nữa** |
| 3 | `unsupported-chain` | chain đang chọn không thuộc họ EVM (`stellar`) | "chưa hỗ trợ ví cho mạng này" |
| 4 | `loading` | ví đang tự kết nối lại | khung chờ |
| 5 | `no-provider` | không có ví được tiêm **và** chưa kết nối | `NoWalletGuide` |
| 6 | `disconnected` | có ví, chưa kết nối | mời kết nối |
| 7 | `wrong-chain` | chainId ngoài danh sách được phép | `WrongChainBanner` |
| 8 | `chain-mismatch` | chain được phép nhưng khác chain đang xem | `WrongChainBanner` + lối đổi chain của trang |
| 9 | `ready` | khớp hết | `WalletStatusCard` |

**Vì sao `mock` phải đứng đầu:** chế độ mô phỏng không cần ví, nên mọi cảnh báo ví ở đó đều
là nhiễu. Đây cũng là chế độ mặc định của bản triển khai miễn phí, tức là thứ đa số người xem
demo gặp đầu tiên. Cùng lý lẽ, `unsupported-chain` đứng trước `no-provider`: mời người đang
xem Stellar đi cài MetaMask là lời mời vô nghĩa.

**`canSign` chỉ đúng ở `ready` và `mock`.** Đây là thứ FE-05/09/11 dùng để bật/tắt nút ký;
mỗi màn tự ghép `useAccount` + `useChainId` + `useSwitchChain` là bắt đầu có nguồn sự thật
thứ hai và hai bên sẽ lệch nhau.

### Lưu ý khi phát triển

- **Không sửa `lib/wagmi.ts`.** File đó đã xử lý phần khó nhất: thiếu `NEXT_PUBLIC_WC_PROJECT_ID`
  thì dựng config wagmi trực tiếp với connector `injected` thay vì để RainbowKit ném lỗi ngay
  lúc nạp module và làm trắng toàn bộ ứng dụng.
- **Dùng `useAccount().chainId`, KHÔNG dùng `useChainId()`** để biết chain của ví. `useChainId()`
  lùi về chain đầu tiên trong cấu hình khi chưa kết nối, nên lấy nó làm "chain của ví" sẽ kết
  luận sai là đã khớp chain trong lúc chưa có ví nào.
- **Không tự động chuyển chain.** Chỉ chuyển khi người dùng bấm. Tự động chuyển làm ví bật hộp
  thoại mà người dùng không hiểu vì sao, và nếu họ từ chối thì rơi vào vòng lặp yêu cầu.
- **Thông số `wallet_addEthereumChain` lấy từ `packages/shared` + config wagmi**, không ghi cứng:
  `rpcUrls` lấy từ chain trong config wagmi (vì `lib/wagmi.ts` đã áp override
  `NEXT_PUBLIC_RPC_*`), `blockExplorerUrls` lấy từ `CHAINS` (vì `lib/wagmi.ts` không khai báo
  explorer).
- **Trạng thái lỗi phải mang theo khoá tình huống** (`chain đang xem | địa chỉ | chainId ví`).
  Không có khoá thì câu "Bạn đã từ chối chuyển mạng" sống dai hơn tình huống của nó: người dùng
  tự đổi mạng trong ví rồi mà cảnh báo vẫn còn, và giờ nó sai. Cùng khuôn với
  `components/investor/asset-summary.tsx`; cách này cũng tránh `setState` trong effect mà React
  Compiler chặn.
- **`getByRole('alert')` trong Playwright phải bó phạm vi vào `main`.** Toàn trang thì nó bắt
  luôn vùng thông báo rỗng mà Next.js Dev Tools chèn vào cuối `body`, làm phép kiểm "không có
  cảnh báo nào" đỏ vì lý do chẳng liên quan tới ví.

### Cách mở rộng

| Muốn thêm | Đụng vào đâu |
|---|---|
| Chain EVM mới | Thêm vào `CHAINS` (`packages/shared`) + `lib/wagmi.ts`. `WALLET_CHAIN_KEYS` tự cập nhật, **không sửa `wallet-status.ts`** |
| Cảnh báo sai mạng ở màn khác | Dùng lại `WrongChainBanner`, lấy `status`/`switchToExpected` từ `useWalletStatus()` |
| Gate nút ký ở màn mới | Đọc `canSign` + `blockedReason`, không tự kiểm chain |
| Ví do ngân hàng giữ hộ (IN-03/IN-04) | Thêm `ISigner` mới, đổi factory. Màn này không phải sửa |
| Đăng nhập bằng chữ ký ví | AU-01. **Chưa được** dùng địa chỉ ví để cấp quyền: kết nối ví không chứng minh sở hữu vì chưa có chữ ký |

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
| 2 | `rbac/permissions.ts` — quyền **đã có sẵn** từ BE-08: `settlement:confirm` (INVESTOR), `settlement:initiate` + `settlement:set-nav` (BANK_ADMIN) | **KHÔNG** thêm `token:redeem`: BE-08 đã chốt tiền tố `settlement:*` vì luồng chốt là ngân hàng điều phối và đốt, không phải nhà đầu tư tự đổi |
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
| 1 | `rbac/permissions.ts` — quyền **đã có sẵn** từ BE-08: `distribution:snapshot` + `distribution:execute` (BANK_ADMIN) | **KHÔNG** thêm `distribution:create`: BE-08 đã tách chốt quyền và chi trả thành hai hành động |
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
| — | FE-01 v2 kênh nhà đầu tư + trang tổng quan | ✅ Xong |
| — | BE-01 mở rộng `ILedgerPort` cho ba luồng (`mock` đủ 16/16, `evm` còn 10 method chờ contract) | ✅ Xong |
| — | FE-02 màn kết nối ví (`/wallet`, tám trạng thái, `canSign` dùng chung) | ✅ Xong |
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
