---
inclusion: always
---

# BÁO CÁO CÔNG NGHỆ — BIDV RWA TOKENIZE (TOKEN HÓA DỰ ÁN ĐIỆN GIÓ)

> **Tài liệu sống.** Kiro bắt buộc cập nhật file này sau mỗi thay đổi mã nguồn, theo quy tắc trong `docs/tech-report-maintenance.md`.
> Đây là nguồn tham chiếu đầu tiên cho dev mới tiếp nhận source.

| Trường | Giá trị |
|---|---|
| Phiên bản tài liệu | 2.3 |
| Cập nhật lần cuối | 2026-09-23 |
| Nhánh / commit | `feat/distribution-service`, nền `dev` @ `28b62a8` — **nhánh đang chờ nghiệm thu, chưa merge vào `dev`**. Danh sách commit đầy đủ ở `docs/CHECKPOINT_BE06.md` |
| Phase đã hoàn thành | P0 (nền), P1 (mint), vòng dọn UI điện gió, P4 (mint trên Sepolia), tiếp nhận bộ test nghiệm thu P4/P7/P12, build+deploy Cloudflare (PR #12), FE-01 v2 (kênh nhà đầu tư + trang tổng quan), BE-01 (mở rộng `ILedgerPort` cho ba luồng), FE-02 (màn kết nối ví), BE-02 (nghiệp vụ lệnh mua WPT), BE-03 (xem trước điều kiện mua), BE-08 (bổ sung quyền RBAC cho ba luồng — **phục hồi** sau khi bị revert khỏi `dev`, xem `docs/CHECKPOINT_BE08.md`), BE-09 (mở rộng lược đồ dữ liệu + bốn cổng lưu trữ mới), **MC-01** (cơ chế điểm cắm — PR #21, xem 3.10), **MC-02** (khuôn checkpoint + máy kiểm — PR #22, xem 3.11), **BE-04** (giá phát hành cấu hình được + phát hành một lần — PR #25, xem 3.12 và 4.3) |
| Đang chờ nghiệm thu | **BE-06** (nghiệp vụ chia lợi nhuận — xem 4.5, checkpoint `docs/CHECKPOINT_BE06.md`) |
| Phase kế tiếp | BE-05 tất toán → BE-07 tiến trình định kỳ → FE-08/FE-09 giao diện chia lợi nhuận |
| Người cập nhật | Kiro (thực thi) — Supervisor rà soát |

**Vì sao 1.9 → 2.0 vẫn là bước `+0.1` thường, không phải `+1.0`.** Con số tròn dễ bị đọc là "đổi
lớn", nhưng đây chỉ là phép cộng: `tech-report-maintenance.md` §3 bước 5 để `+0.1` cho thay đổi
thường, và `1.9 + 0.1 = 2.0`. MC-02 **không đổi kiến trúc** — ba luật bất di không bị chạm, không
thêm tầng, không đổi luồng nghiệp vụ nào, không chạm `app/src`. Nó thêm một **cổng quy trình**
(khuôn checkpoint + máy kiểm), cùng họ với MC-01. Lần `+1.0` sẽ là lần thật sự đổi kiến trúc.

**2.0 → 2.1 (BE-03).** Thêm một hàm nghiệp vụ và một server action vào luồng mua đã có, không thêm
tầng và không đổi ba luật. Có **một đổi hành vi** cần đọc kỹ: `placeOrder` nay kiểm điều kiện
trước khi tạo bản ghi, nên một lệnh thiếu điều kiện **không còn** vào sổ lệnh rồi chuyển
`REJECTED` — chi tiết ở 4.2.

**2.1 → 2.2 (BE-04).** Ba bảng dữ liệu mới, hai cổng lưu trữ mới, một method mới ở `ILedgerPort`
(29 method, trước là 28), một luồng nghiệp vụ mới (`issue`). Vẫn `+0.1`: không thêm tầng, ba luật
bất di không bị chạm. Có **bốn đổi hành vi** cần đọc kỹ:

1. Giá phát hành nay nằm trong cơ sở dữ liệu và **đổi được lúc chạy**. Hằng số
   `WPT_ISSUE_PRICE_VND` trở thành **giá mặc định khi chưa cấu hình**, không còn là giá đang có
   hiệu lực — mọi chỗ hiển thị phải đọc qua `readIssuePriceVnd()` (xem 3.12).
2. `wptToVnd(amount)` đổi chữ ký thành `wptToVnd(amount, issuePriceVnd)`.
3. `PortfolioView.issuePriceVnd` và `TokenSummary.issuePriceVnd` đổi kiểu `number` → `string`.
4. `mintTokens` đổi tên thành `mintToInvestorDirect`. Tên server action `mintAction` **giữ nguyên**,
   nên không component nào phải sửa.

**2.2 → 2.3 (BE-06).** Một service nghiệp vụ mới, bốn server action mới, một luồng mới (`distribute`)
đi qua các cổng đã có — **không** thêm method nào vào `ILedgerPort` (vẫn 29), **không** thêm bảng dữ
liệu nào, **không** thêm tầng. Ba đổi hành vi cần đọc kỹ:

1. `CONFIG_VALUE_TYPES` có thêm kiểu `'string'` (bốn kiểu, trước là ba) cho khoá
   `distribution.dust_wallet` — một địa chỉ ví thì ba kiểu cũ không mang nổi.
2. `SEED_CONFIG_ROWS` nạp sẵn **ba** dòng, trước là hai: thêm `distribution.batch_size`.
   `distribution.dust_wallet` **cố ý không** nạp sẵn (xem 3.13).
3. `ErrorCode` có thêm ba mã của luồng chia lợi nhuận, cả ba trả HTTP 409:
   `INSUFFICIENT_PROFIT_POOL`, `NO_CIRCULATING_SUPPLY`, `PERIOD_STATE`.

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

Đối chiếu bằng `find` trước khi nộp checkpoint (`tech-report-maintenance.md` §6).

```
bidv-rwa-tokenize/
├── .kiro/
│   ├── steering/              # Quy tắc Kiro nạp mỗi phiên (always)
│   │   ├── workflow.md        # Vòng lặp Kiro ↔ Supervisor, quy tắc chống "kẹt"
│   │   ├── branching.md       # `dev` là nền duy nhất; cấm revert-rồi-merge-lại
│   │   ├── lessons.md         # Bài học tích lũy — đọc trước khi code
│   │   ├── structure.md       # Cấu trúc thư mục chuẩn
│   │   ├── tech.md            # Ràng buộc kỹ thuật
│   │   ├── frontend.md        # Chuẩn giao diện, màu BIDV
│   │   ├── solidity.md        # Chuẩn viết contract
│   │   ├── product.md         # Bối cảnh nghiệp vụ
│   │   ├── testnet.md         # Quy ước làm việc trên Sepolia
│   │   ├── make-control.md    # ★ Quy ước marker @pending/@blocked/@flow (MC-01)
│   │   └── checkpoint.md      # ★ Khuôn checkpoint: mục 0 bắt buộc, con số kèm lệnh đo (MC-02)
│   ├── specs/<feature>/       # requirements.md, design.md, tasks.md
│   └── task-status.json       # ★ Nguồn DUY NHẤT: trạng thái task + tập mã task hợp lệ
│
├── app/                       # Next.js 16 full-stack
│   ├── src/app/
│   │   ├── (admin)/           # Kênh ngân hàng: mint, kyc, assets, reconciliation
│   │   ├── (audit)/           # Kênh kiểm toán: chỉ đọc
│   │   ├── (client)/          # Kênh nhà đầu tư: portfolio, tokens/[symbol], wallet
│   │   ├── actions/           # Server Actions (bank.ts, session.ts, portfolio.ts,
│   │   │                      #   purchase.ts, config.ts, distribution.ts)
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
├── scripts/                   # Công cụ chạy từ GỐC repo (Node 20 / bash, không phụ thuộc ngoài)
│   ├── run-local-all.sh       # Chạy toàn bộ kiểm chứng cục bộ — 8 mục
│   ├── verify-arch-rules.sh   # Lớp 3: 3 luật kiến trúc + cấu trúc repo + ký hiệu token
│   ├── scan-pending.mjs       # ★ Quét marker; --check, --json, --write-report, --check-report
│   ├── gen-flow-diagram.mjs   # ★ Sinh docs/flows/<luồng>.md (Mermaid) từ marker @flow
│   ├── check-checkpoint.mjs   # ★ Kiểm khuôn checkpoint; --in-progress (MC-02)
│   └── demo-mint.mjs          # Kịch bản demo luồng mint
│
└── docs/                      # SPEC, WORKING_PROTOCOL, CHECKPOINT, REVIEW
    ├── tech-report.md         # ★ Báo cáo công nghệ (file này)
    ├── tech-report-maintenance.md  # Quy tắc cập nhật báo cáo
    ├── CHECKPOINT_TEMPLATE.md # ★ Khuôn checkpoint, có mục 0 bắt buộc (MC-02)
    └── flows/                 # ★ SINH TỰ ĐỘNG từ marker @flow — đừng sửa tay
        ├── purchase.md        #   Luồng mua WPT, 12 bước
        ├── issue.md           #   Luồng phát hành nguồn cung, 9 bước (BE-04)
        └── distribute.md      #   Luồng chia lợi nhuận, 10 bước (BE-06)
```

⚠️ **`tech-report.md` và `tech-report-maintenance.md` nằm ở `docs/`, không ở `.kiro/steering/`**
dù cả hai có `inclusion: always` ở đầu tệp. Trước MC-01 cây thư mục ở đây liệt kê chúng trong
`.kiro/steering/` — đường dẫn đó không tồn tại.

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
- **Giá tồn tại ở hai nơi thì THỨ TỰ GHI là thứ phải bảo vệ, không phải giá trị.** Cơ sở dữ liệu giữ giá để **hiển thị**, ledger giữ giá để **trừ tiền**. Đẩy xuống ledger **trước**, ghi cơ sở dữ liệu **sau**, ghi thất bại thì hoàn nguyên ledger. Không transaction nào bao được cả một lời gọi on-chain và một câu SQL, nên việc duy nhất làm được là chọn thứ tự mà hỏng giữa đường vẫn để lại trạng thái giải thích được. Đầy đủ ở 3.12.
- **Bảng mang cột `chain` thì khoá duy nhất phải có `chain` trong đó.** `Project` duy nhất theo `tokenSymbol` một mình làm toàn hệ chỉ có ĐÚNG MỘT dòng WPT trên một chuỗi, mọi chuỗi khác tra ra `null`, và nghiệp vụ từ chối "chưa có dự án" trong khi dự án rõ ràng có. Cùng lý do: dữ liệu khởi tạo theo chuỗi phải nạp cho **mọi** chuỗi mà demo chạy được, không chỉ `DEFAULT_CHAIN` — nạp một chuỗi là để bản free-tier ở `mock` chết ở đúng luồng chính.
- **Dữ liệu ĐỊNH DANH đối soát khác dữ liệu ĐẦU VÀO kiểm quyền.** `actorAddress` chỉ để đối soát, mà `mock` không ký gì nên không có địa chỉ; làm cả lượt phát hành thất bại vì thiếu một nhãn là đánh đổi sai. Bắt lỗi rồi ghi `null`. Nhưng **đừng** mở rộng cách này sang chuỗi thật, nơi thiếu signer nghĩa là giao dịch không gửi được.
- **Gọi một hàm ĐỌC mà không truyền giới hạn là chấp nhận bị cắt danh sách trong im lặng.** Mọi hàm `list*` của cổng lưu trữ mặc định `limit = 50`. Với một trang hiển thị thì đó là phân trang; với một danh sách dùng để **chia tiền** thì đó là những nhà đầu tư không bao giờ được chia, và không thông báo nào. Truyền giới hạn tường minh, và **từ chối** khi chạm ngưỡng thay vì lấy phần đầu (BE-06, `collectRecipients`).
- **Việc chia tiền cần BA trạng thái, không phải hai.** `PENDING → SENT → PAID`: giữa lúc gửi giao dịch và lúc có biên nhận, hồ sơ đã có mã giao dịch mà chưa biết kết quả. Gộp `SENT` vào `PAID` thì tiến trình chết giữa chừng để lại hồ sơ **trông như đã chi xong**, và không lần chạy lại nào xét tới nó — tiền ở lại trong ví lợi nhuận vĩnh viễn trong khi sổ nói đã trả.
- **Đọc một con số, ghi lên chuỗi, rồi ĐỌC LẠI để so — khi cổng không đọc lại được con số chuỗi đã chốt.** `ProfitDistributor` chốt số tiền chia được ngay tại lời gọi chụp ảnh và `ILedgerPort` không có hàm đọc lại nó, nên `totalAmount` trong sổ chỉ đúng nếu quỹ không đổi giữa hai thời điểm. Đọc lại rồi so biến một sai lệch âm thầm thành một lần từ chối có lý do. Cái giá là một ảnh chụp bỏ không — rẻ hơn hẳn một kỳ chia sai toàn bộ.

**Bốn bài học về TEST, học được ở BE-04:**

- **Đổi hằng số cấu hình rồi chạy lại toàn bộ test là phép kiểm rẻ và bắt được nhiều.** Ca 5 của BE-04 (đổi `WPT_ISSUE_PRICE_VND` thành 537.000 rồi thành 7) bắt **5 chỗ** gõ cứng mà đọc mắt không thấy. Ba trong số đó tệ hơn "sai số": chúng dùng một số tuyệt đối làm *"thiếu tiền"*, nên ở giá nhỏ nó thành **dư** tiền — **tình huống mà ca kiểm cần dựng đã bốc hơi**, và test đỏ không phải vì mã sai. Nhớ phục hồi rồi kiểm `git diff` **rỗng**.
- **`vi.spyOn` trên đối tượng namespace của module KHÔNG chặn được lời gọi nội bộ trong cùng module.** `assertCanConfigure` gọi `isConfigRole` như một tham chiếu lexical, nên vá từ ngoài làm ca kiểm **xanh oan** — nó không kiểm được gì mà vẫn báo đạt. Cách đúng cho một đột biến: sửa **thật** bảng dữ liệu (`CONFIG_ROLES.BANK_ADMIN = false`) rồi trả lại trong `finally`.
- **Test trên cơ sở dữ liệu không `TRUNCATE` thì mọi khoá phải duy nhất MỖI LẦN CHẠY.** Một chuỗi cố định sẽ do dòng của lượt trước chiếm giữ, và lượt hai trượt ở lời gọi *thứ nhất* với thông báo trông y như ràng buộc duy nhất đang hỏng. Phát hiện ở BE-04 khi chạy hai lượt trên một Postgres thật.
- **Đừng dựa vào thứ tự danh sách khi khoá sắp xếp có thể trùng.** Hai lần ghi cùng mốc phần nghìn giây thì thứ tự phá thế bằng uuid ngẫu nhiên, nên `history[0]` đỏ **tuỳ lần chạy**. Tra theo **nội dung**, và ghi giới hạn đó vào doc của cổng để người sau không mắc lại.

**Hai bài học về TEST, học được ở BE-06:**

- **Phép kiểm trạng thái CUỐI không bắt được đột biến về THỨ TỰ GHI, khi có khối `catch` dọn dẹp.**
  Đã đo thật: dựng đột biến "đánh dấu hồ sơ `PAID` **trước** khi gửi lô" rồi chạy lại — **cả 42 ca
  vẫn xanh**, vì `catch` sửa hồ sơ về `FAILED` nên trạng thái sau khi hàm chạy xong giống hệt bản
  đúng. Mà thiệt hại thật nằm ở **giữa** luồng: tiến trình chết đúng đó thì hồ sơ đứng lại ở `PAID`
  trong khi chưa ai nhận đồng nào. Cách bắt: cho vỏ bọc ledger một **hook chạy ngay trước khi gửi**
  (`fault.onBatch`) rồi đọc trạng thái hồ sơ tại đúng thời điểm ấy. Bài học chung: muốn kiểm thứ tự
  ghi thì phải **quan sát ở giữa**, không chỉ so ảnh trước và sau.
- **Dựng xong đột biến phải CHẠY THẬT để xác nhận nó đỏ.** Hai đột biến của BE-06 đều đã chạy: viết
  cứng kích thước lô → đỏ ngay; đánh dấu `PAID` sớm → **xanh**, và chính lần xanh đó mới lộ ra lỗ
  hổng ở trên. Viết đột biến mà không chạy là ghi vào checkpoint một bằng chứng chưa từng được kiểm.

### C. Nợ kỹ thuật đã biết (cần xử lý, đã ghi nhận)

| Mức | Vấn đề | Hướng xử lý |
|---|---|---|
| **P1** | Chưa có xác thực thật. Vai trò lấy từ cookie do client đặt được | Phase 4: SIWE + phiên thật. **Trước đó tuyệt đối không deploy public khi chưa bật bảo vệ mật khẩu** |
| **P1** | **Bộ contract trên Sepolia còn symbol `tVND` cũ.** Mã nguồn đã đổi sang `VNDB` nhưng bản đã deploy thì không đổi được — symbol nằm trong constructor | Deploy lại `VNDToken`, `ProfitDistributor`, `Redemption` (hai cái sau giữ địa chỉ VNDToken dạng `immutable`) rồi verify lại. `ProjectToken`/WPT không ảnh hưởng nên P4 vẫn đứng |
| ~~P2~~ | ~~Build Cloudflare fail ENOENT: Next sinh ra `.next/standalone/app/.next`, OpenNext đọc `.next/standalone/.next`~~ | **ĐÃ XỬ LÝ ở PR #12** (`app/scripts/flatten-standalone.mjs` + script `cf:build`). Đề nghị Supervisor xác nhận rồi xóa dòng này — theo `tech-report-maintenance.md` §8, việc thêm/xóa nợ do Supervisor quyết |
| **P2** | Docker build phụ thuộc CDN Alpine (`apk add`) → giòn ở mạng doanh nghiệp có tường lửa | Cân nhắc base `node:24-bookworm-slim` |
| **P2** | Node 20 đã hết hạn LTS từ 30/04/2026, không còn vá bảo mật | Nâng Docker image lên Node 24 (LTS đến 2028) |
| **P1** | **11 trong 16 method mới của `ILedgerPort` chưa nối được ở `evm.adapter`** — chờ contract phát hành một lần (SC-02), contract khớp lệnh (SC-03), quyết định chữ ký để `distributeBatch` mang được mã kỳ xuống adapter (**SC-05**, mã task mới — BE-06 đã chẩn đoán và ghi ngay trên marker ở `evm.adapter.ts`, xem 4.5), và quyết định cờ tất toán/NAV nối vào contract nào (SC-04). Bảng đầy đủ ở 3.1; bảng sinh tự động theo marker ở 3.10 | Hiện phát triển trên chain `mock` (đã hiện thực đủ 16/16, có 49 test). Khi contract xong thì bổ sung `evm.adapter` trong commit riêng — `docs/CHECKPOINT_BE01.md`. **Con số đo lại ở MC-01: `git grep -c "return pendingContract(" -- app/src/lib/ledger/evm.adapter.ts` → 11, không phải 10** |
| **P2** | Chưa có CI. Mọi kiểm tra chạy tay | Thêm GitHub Actions chạy `typecheck + lint + test` mỗi lần push |
| **P2** | Giấy phép **T-REX không phải giấy phép mở tiêu chuẩn** ("SEE LICENSE IN LICENSE.md") | Rà soát pháp lý **trước khi** dùng cho sản phẩm thật |
| ~~P2~~ | ~~1 cảnh báo lint ở `src/empty.ts`~~ | **ĐÃ XỬ LÝ ở MC-01 Bước 7.** Cảnh báo là `import/no-anonymous-default-export` do `export default {}`. Đo lại thì default export đó **không cần cho build**, nên xóa luôn thay vì đặt tên biến hay dùng `eslint-disable`. Nay `npx eslint .` cho **0 error, 0 warning**. Đề nghị Supervisor xác nhận rồi xóa dòng này — theo `tech-report-maintenance.md` §8 |
| **P2** *(đề nghị, Supervisor chốt mức)* | **Spec tồn tại hai bản song song và đã lệch nhau.** Đo ở MC-01: `docs/` có **8** thư mục spec, `.kiro/specs/` có **10**, trùng tên nhau **6** cặp (số còn lại chỉ tồn tại một phía). Trong 6 cặp đó, **5 cặp đã khác nhau** — `be-01-ledger-port`, `be-02-purchase-orders`, `fe-01-investor-channel-v2`, `fe-02-wallet-connect` lệch **cả ba** tệp; `mc-01-make-control` lệch `tasks.md`; chỉ `be-09-data-schema` còn giống hệt. Hai bản lệch nghĩa là "spec nói gì" phụ thuộc vào việc người đọc mở bản nào | Chọn **một** bản làm nguồn (`.kiro/specs/` là bản Kiro nạp) rồi bản kia thành con trỏ trỏ sang, hoặc xóa. Việc này Supervisor quyết vì nó đổi cách tổ chức tài liệu. Lệnh đo: `diff -rq docs/<tên> .kiro/specs/<tên>` |
| **P2** *(đề nghị, Supervisor chốt mức)* | **`app/src/empty.ts` + alias `@x402/*` trong `next.config.ts` là vá cho phụ thuộc của bên thứ ba.** `@x402/*` là `peerDependencies` **tùy chọn** của `@coinbase/cdp-sdk` nên npm không cài, nhưng mã cdp-sdk vẫn `import` chúng và cdp-sdk có trong đồ thị module của app theo chuỗi `providers.tsx → @rainbow-me/rainbowkit → @wagmi/connectors/baseAccount → @base-org/account → @coinbase/cdp-sdk`. Bỏ alias ra thì `next build` FAIL 8 lỗi *Module not found* ở 5 specifier | Đã thu gọn tối đa ở MC-01 Bước 7: `empty.ts` còn **1 export** (`toClientEvmSigner`, import tĩnh duy nhất mà build đòi), alias Turbopack còn **1 dòng wildcard**. **ĐIỀU KIỆN XÓA:** khi `cd app && npm ls @coinbase/cdp-sdk` trả về rỗng — tức wagmi/connectors không còn kéo `@base-org/account`. Lúc đó gỡ cả hai khối alias, xóa `app/src/empty.ts`, chạy lại `npm run build` + `npm run cf:build` để xác minh |
| **P1** | **Cờ `isConfig` có HAI nguồn và chỉ một nguồn được đọc.** Lớp quyền thứ hai của `setIssuePrice` đọc bảng hằng số `CONFIG_ROLES` trong mã (`app/src/lib/rbac/config-role.ts`), trong khi cột `Role.isConfig` trong cơ sở dữ liệu đã có dữ liệu (`SEED_ROLE_ROWS` nạp đủ bốn vai) mà **chưa lời gọi nào đọc**. Hệ quả: đổi cờ trong cơ sở dữ liệu không có tác dụng gì, và người vận hành không có cách nào biết — đo bằng `git grep -n "isConfig" -- app/src \| grep -v config-role` | Chờ **AU-01** (SIWE + phiên thật) và **AU-02** (vai đọc từ cơ sở dữ liệu). Khi AU-02 xong thì `isConfigRole()` đọc cột `Role.isConfig`, còn `CONFIG_ROLES` chỉ còn là dữ liệu khởi tạo. **Đừng** đọc cột đó sớm hơn: chưa có phiên thật thì vai lấy từ cookie do client đặt được, nên thêm một lần tra cơ sở dữ liệu chỉ làm chậm mà không chặn được ai |
| **P2** | **`SystemConfigHistory` không có thứ tự tuyệt đối.** Hai lần ghi trùng mốc tới từng phần nghìn giây thì thứ tự tương đối KHÔNG xác định — cả hai bản hiện thực phá thế bằng `id`, một uuid ngẫu nhiên chứ không phải thứ tự chèn. Đã gây một ca kiểm đỏ tuỳ lần chạy ở BE-04 (xem mục C phần bài học) | Thêm một cột số thứ tự tăng dần (`seq BIGSERIAL` ở Postgres, số đếm ở bản bộ nhớ) **khi làm task nào đụng tới bảng này** — không mở task riêng, vì tình huống chỉ xảy ra khi hai lần đổi tham số cách nhau dưới một phần nghìn giây. Tới lúc đó phải sửa cả `listConfigHistory` ở hai bản và bỏ cảnh báo trong doc của cổng |

### D. Cách làm việc

- **Chia commit nhỏ theo mục tiêu.** Không dồn cả phase vào một commit. Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). Mỗi commit phải ở trạng thái build được để `git bisect` và revert từng phần.
- **Quy tắc chống "kẹt":** không hiểu yêu cầu thì **dừng, không đoán** — ghi câu hỏi vào checkpoint kèm 2 cách hiểu khả dĩ. Cùng một lỗi trượt 2 vòng review thì dừng vá lẻ, tổng hợp báo Supervisor.
- **Không sửa mò quá 2 lần** cho cùng một triệu chứng.
- **Checkpoint mở đầu bằng mục 0 tóm tắt nghiệm thu**, tối đa 60 dòng, bảng đối chiếu **đủ** các điều kiện hoàn thành của `requirements.md` kèm **số mục** chứa bằng chứng. Có máy kiểm: `node scripts/check-checkpoint.mjs --in-progress`. Khuôn ở `docs/CHECKPOINT_TEMPLATE.md`, quy tắc ở `.kiro/steering/checkpoint.md`, chi tiết ở **3.11**.
- **Mọi con số dùng làm bằng chứng phải kèm lệnh đo** — trong checkpoint **và** trong spec do Supervisor viết. Con số không có lệnh đo thì không ai kiểm lại được, và điều đó đã gây thiệt hại thật ở MC-01 (spec ghi 33 tệp / 27 export / 10 method, cả ba đều sai). Số trong spec lệch số đo thật thì **dùng số đo thật** và ghi thành mục sai lệch.

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
| Base UI | Component headless — `components/ui` dựng trên bộ này | 1.5.0 | 1.8.0 | MIT |
| lucide-react | Bộ icon | 1.17.0 | 1.42.0 | ISC |
| Recharts | Biểu đồ sản lượng, lợi tức | 3.8.1 | 3.10.1 | MIT |
| next-themes | Chuyển sáng/tối | 0.4.6 | 0.4.6 | MIT |

**Đã gỡ ở MC-01 Bước 7 — Radix UI (5 gói).** `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-select`, `react-slot`, `react-tooltip`. `components/ui` đã chuyển hẳn sang Base UI nên không tệp nào trong `app/src`, `app/test`, `app/e2e` còn nhập `@radix-ui`; cũng không gói nào khác trong cây phụ thuộc khai `@radix-ui` làm `dependencies` hay `peerDependencies`. Gỡ 5 gói trực tiếp làm `node_modules/@radix-ui` rỗng hoàn toàn (32 → 0 thư mục) và `.open-next` nhỏ đi 2,7 MB.

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
| React Hook Form | Biểu mẫu — **CHƯA DÙNG, giữ cho FE-05** | 7.77.0 | 7.87.0 | MIT |
| @hookform/resolvers | Nối React Hook Form với schema Zod — **CHƯA DÙNG, giữ cho FE-05** | 5.4.0 | 5.4.0 | MIT |

**Hai gói biểu mẫu chưa có tệp nào nhập.** Owner đã chốt GIỮ vì FE-05 (màn đặt lệnh mua WPT) sẽ dùng, kèm Zod để một schema dùng chung cho server action và form. Đây là chỗ duy nhất ghi việc đó: cơ chế marker `@pending` **không phủ được** `package.json` — `scripts/scan-pending.mjs` chỉ quét tệp mã trong `app/src`, `app/test`, `app/e2e`, `packages/*/src`, `packages/*/contracts`, `scripts` với đuôi `.ts/.tsx/.js/.mjs/.sol/.rs/.sh`, và JSON thì không có chú thích. Nếu FE-05 bị bỏ hoặc đổi cách làm form thì gỡ cả hai gói.

## 2.5. Kiểm thử và hạ tầng

| Công nghệ | Mục đích | Bản dùng | Mới nhất | License |
|---|---|---|---|---|
| Vitest | Unit test — **309 test / 13 tệp** (`cd app && npm test`) | 3.2.4 | 5.0.0 | MIT |
| Playwright | E2E — **30 test / 4 tệp** (`cd app && npx playwright test --list`) | 1.63.0 | 1.63.0 | Apache-2.0 |
| ESLint | Kiểm tra mã nguồn | 9.x | 10.10.0 | MIT |
| Docker / Compose | 3 service: chain, db, web | — | 29.7.1 | Apache-2.0 |
| @opennextjs/cloudflare | Đưa Next.js lên Workers | 1.14.0 | 1.20.6 | MIT |
| Wrangler | CLI triển khai Workers | đi kèm | 4.129.1 | MIT/Apache-2.0 |

---

# PHẦN 3. BẢN ĐỒ CODE

## 3.1. `app/src/lib/ledger/` — cổng blockchain (Luật #1)

| File | Vai trò |
|---|---|
| `ledger.port.ts` | Định nghĩa `ILedgerPort` — hợp đồng mà mọi chain phải tuân theo (272 dòng) |
| `index.ts` | Factory `getLedger(chain, signer)` — map chain → adapter |
| `evm.adapter.ts` | Hiện thực EVM bằng viem (599 dòng) |
| `mock.adapter.ts` | Ledger trong RAM, không cần chain (607 dòng) |
| `stellar.adapter.ts` | Stub Soroban, mọi hàm ném lỗi rõ ràng (138 dòng) |
| `address.ts` | `normalizeEvmAddress()` — chuẩn hóa và kiểm checksum EIP-55 |

### `ILedgerPort` — 7 nhóm, 29 method

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
| 12 | | `spvWallet` | ✅ | ⏳ | ⏳ | contract phát hành một lần (SC-02) |
| 13 | `ILedgerPurchase` | `quotePurchase` | ✅ | ⏳ | ⏳ | contract khớp lệnh (SC-03) |
| 14 | | `setPurchasePrice` (BE-04) | ✅ | ⏳ | ⏳ | contract khớp lệnh (SC-03) |
| 15 | | `paymentBalanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 16 | | `paymentAllowanceOf` | ✅ | ⏳ | ⏳ | địa chỉ contract khớp lệnh (SC-03) |
| 17 | | `executePurchase` | ✅ | ⏳ | ⏳ | contract khớp lệnh (SC-03) |
| 18 | `ILedgerSnapshot` | `takeSnapshot` | ✅ | ✅ | ⏳ | Phase 7 |
| 19 | | `balanceOfAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 20 | | `totalSupplyAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 21 | `ILedgerDistribution` | `profitPoolBalance` | ✅ | ✅ | ⏳ | Phase 7 |
| 22 | | `distributeBatch` | ✅ | ⏳ | ⏳ | chữ ký chưa mang được mã kỳ để tra `distributionId` (SC-05) |
| 23 | `ILedgerSettlement` | `setSettlementMode` | ✅ | ⏳ | ⏳ | quyết định cờ tất toán nằm ở contract nào (SC-04) |
| 24 | | `isSettlementMode` | ✅ | ⏳ | ⏳ | quyết định cờ tất toán nằm ở contract nào (SC-04) |
| 25 | | `setNavRate` | ✅ | ⏳ | ⏳ | quyết định NAV có phải `Redemption.rate` (SC-04) |
| 26 | | `navRate` | ✅ | ⏳ | ⏳ | quyết định NAV có phải `Redemption.rate` (SC-04) |
| 27 | `ILedgerRead` | `balanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 28 | | `tokenInfo` | ✅ | ✅ | ⏳ | Phase 7 |
| 29 | | `waitReceipt` | ✅ | ✅ | ⏳ | Phase 7 |

**Bốn method tất toán (23–26) chặn vì một QUYẾT ĐỊNH, không vì một contract chưa có.** Cả
`Redemption` lẫn `ProjectToken` đã deploy; thiếu là câu trả lời cho "cờ *đang tất toán* nằm ở
đâu" và "NAV có phải `Redemption.rate` hay không". Owner đã mở mã task **SC-04** cho quyết định
đó, nên marker trong `evm.adapter.ts` ghi `@blocked SC-04` — xem bảng sinh tự động ở 3.10. Đừng
nối tạm vào `Redemption.paused`: nó **ngược hướng** với "bật giai đoạn tất toán".

`spvWallet` thêm ở **BE-02**. Lý do: QĐ-2 của luồng mua buộc kiểm "ví thanh toán SPV còn đủ
WPT" **trước khi** gửi giao dịch, mà phép kiểm đó là `balanceOf(<ví SPV>)` — cần một địa chỉ.
`executePurchase` biết ví đó nhưng không nói ra, nên tầng nghiệp vụ không có đường lấy được:
hoặc thêm method này, hoặc bỏ hẳn một trong bốn phép kiểm. Khác hẳn `holdersAt` đã bị từ
chối ở dưới — chuỗi **trả lời được** địa chỉ ví SPV, còn danh sách người nắm giữ thì không.

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
- `mock.adapter` phải **nghiêm ngặt ngang contract thật**. Bảng ràng buộc bắt buộc ở `docs/be-01-ledger-port/design.md` mục 3; 49 test ở `test/mock-ledger.test.ts` phủ từng dòng.
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
| `permissions.ts` | Bảng dữ liệu thuần: 4 role × 24 action |
| `can.ts` | `can(role, action)` + `assertCan()` + `permissionsOf()` — **điểm kiểm quyền duy nhất** |
| `session.ts` | `currentRole()` — đọc vai trò hiện tại từ cookie `bidv_role` |
| `demo-payment.ts` | Chốt chặn **hai lớp** riêng cho `demo:mint-payment`: `canMintDemoPayment()`, `assertCanMintDemoPayment()`, `DemoPaymentMintDisabledError` |
| `config-role.ts` | Chốt chặn **hai lớp** cho việc đổi tham số hệ thống (BE-04): `CONFIG_ROLES`, `isConfigRole()`, `assertCanConfigure()`, `NotConfigRoleError`. Thứ tự là **RBAC trước, `isConfig` sau** — ngược `demo-payment.ts`, vì lớp thứ hai ở đây gắn với TỪNG VAI nên phải biết vai nào rồi mới trả lời được |

**Ma trận quyền (đủ 24 action, tên đúng như trong `ACTIONS`):**

Cột "Nguồn" nói action do phase nào khai: **BE-08** (bổ sung quyền cho ba luồng) hoặc **BE-02**
(nghiệp vụ lệnh mua). Action không ghi nguồn là có từ P1.

| Action | BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR | Nguồn |
|---|:--:|:--:|:--:|:--:|:--:|
| `token:mint` | ✅ | ❌ | ❌ | ❌ | — |
| `token:burn` | ✅ | ❌ | ❌ | ❌ | — |
| `token:clawback` | ✅ | ❌ | ❌ | ❌ | — |
| `token:freeze` | ✅ | ✅ | ❌ | ❌ | — |
| `investor:whitelist` | ✅ | ✅ | ❌ | ❌ | — |
| `kyc:approve` | ✅ | ✅ | ❌ | ❌ | — |
| `token:transfer` | ❌ | ❌ | ✅ | ❌ | — |
| `order:place` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `order:execute` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `order:expire` | ✅ | ❌ | ❌ | ❌ | BE-02 |
| `distribution:snapshot` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `distribution:execute` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `settlement:initiate` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `settlement:set-nav` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `settlement:confirm` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `treasury:manage` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `demo:mint-payment` | ✅ **+ cờ** | ❌ | ❌ | ❌ | BE-08 |
| `portfolio:read` | ❌ | ❌ | ✅ | ❌ | — |
| `balance:read` | ✅ | ✅ | ✅ | ✅ | — |
| `txn:read` | ✅ | ✅ | ✅ | ✅ | — |
| `audit:read` | ✅ | ✅ | ❌ | ✅ | — |
| `order:read` | ✅ | ✅ | ✅ | ✅ | BE-02 |
| `order:read:all` | ✅ | ✅ | ❌ | ✅ | BE-02 |
| `reconcile:read` | ✅ | ✅ | ❌ | ✅ | BE-08 |

**10 hành động BE-08 thêm vào** — `order:place`, `order:execute`, `distribution:snapshot`,
`distribution:execute`, `settlement:initiate`, `settlement:set-nav`, `settlement:confirm`,
`treasury:manage`, `demo:mint-payment`, `reconcile:read` — là **chỗ đặt guard** cho ba luồng khớp
lệnh / chia lợi nhuận / tất toán. Trong đó **năm** hành động đã có nghiệp vụ dùng thật:
`order:place` và `order:execute` (BE-02, xem 4.2), `treasury:manage` (BE-04, xem 3.12),
`distribution:snapshot` và `distribution:execute` (BE-06, xem 4.5). Năm hành động còn lại —
`order:expire` (BE-07), ba `settlement:*` (BE-05), `demo:mint-payment` — **chưa có nghiệp vụ gọi**.

⚠️ **`distribution:execute` cố ý KHÔNG cấp cho COMPLIANCE**, dù vai đó xét KYC và freeze: cùng một
người vừa giám sát vừa chuyển tiền thì lớp kiểm soát thứ hai không còn. `previewDistribution` cũng
hỏi đúng quyền này chứ không phải một quyền đọc — nó là bản xem trước của chính hành động chi trả,
nên ai xem trước được thì cũng phải là người được phép chia. Đọc trạng thái kỳ thì khác: đó là
`reconcile:read`, nên AUDITOR và COMPLIANCE vào được kênh theo dõi mà không chạm được hàm chi trả.

**BE-03 KHÔNG thêm quyền nào.** Xem trước dùng lại `order:place` — đúng quyền của việc nó xem
trước. Thêm một `order:preview` riêng sẽ cho phép cấu hình ra một vai xem được điều kiện mua mà
không đặt được lệnh, tức một quyền không tương ứng với việc nào trong nghiệp vụ.

**3 hành động BE-02 thêm vào** — `order:expire`, `order:read`, `order:read:all` — là phần sổ lệnh
mà BE-08 chưa khai: dọn lệnh treo, và phân biệt "xem lệnh của mình" với "xem lệnh của mọi ví".
`order:read:all` là thứ cho `listOrders` phân biệt R5.1 với R5.2 **mà không** cần
`if (role === 'INVESTOR')`.

⚠️ Ghi chú phạm vi trong `docs/CHECKPOINT_BE02.md` nói "năm quyền `order:*` thuộc phạm vi BE-08" —
đó là ghi chú **phạm vi thiết kế**, không phải "BE-08 đã khai đủ năm". Đối chiếu mã thật:
BE-08 khai hai (`order:place`, `order:execute`), BE-02 khai thêm ba. Bảng trên là **hợp** của hai tập.

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
`READ_ONLY = ['balance:read','txn:read','audit:read','order:read','order:read:all','reconcile:read']`
được spread vào BANK_ADMIN, COMPLIANCE và AUDITOR. Quyền nào đặt vào đó thì **ba vai ngân hàng tự
động có**, nên không dùng làm cổng vào kênh nhà đầu tư được. `portfolio:read` cố tình khai riêng cho
INVESTOR, và có test chốt lại điều này (`app/test/rbac.test.ts`).

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
| `mint.service.ts` | KYC/whitelist + mint LẺ. ⚠️ `mintToInvestorDirect` (BE-04 đổi tên từ `mintTokens`) là **đường nền cho bản trình diễn**, không phải luồng phát hành chính: nó mint thẳng cho từng ví nên làm **phình tổng cung** mỗi lần gọi. Luồng chính là `issuance.service.ts` | `onboardInvestor()`, `mintToInvestorDirect()`, `readBalance()`, `listTransactions()`, `tokenOverview()` |
| `issuance.service.ts` | **Phát hành MỘT LẦN** toàn bộ nguồn cung vào ví SPV (BE-04). Tổng cung đọc từ bảng `Project`, **không** nhận từ input | `issueInitialSupply()`, `getIssuanceStatus()` |
| `config.service.ts` | Tham số hệ thống: đổi giá phát hành (BE-04). Thứ tự **đẩy xuống ledger trước, ghi cơ sở dữ liệu sau** — xem 3.12 | `getIssuePrice()`, `setIssuePrice()` |
| `portfolio.service.ts` | Vị thế nhà đầu tư (chỉ đọc) | `getPortfolio()`, `getWalletTransactions()`, `getTokenSummary()` |
| `purchase.service.ts` | Nghiệp vụ lệnh mua WPT (BE-02) + xem trước điều kiện (BE-03) | `previewPurchase()`, `placeOrder()`, `executeOrder()`, `listOrders()`, `expireStaleOrders()` |
| `distribution.service.ts` | **Chia lợi nhuận** theo tỷ lệ nắm giữ tại ảnh chụp (BE-06). Danh sách người nhận dựng từ **cơ sở dữ liệu**, không từ chuỗi — xem 4.5 | `openPeriod()`, `previewDistribution()`, `distributePeriod()`, `getDistributionPeriod()` |
| `purchase.state.ts` | Mô hình trạng thái lệnh mua — dữ liệu, không phải logic. `ORDER_STATUSES` **re-export** từ `store/order.store.port.ts`, không khai lại | `ORDER_TRANSITIONS`, `canTransitionOrder()`, `EXECUTABLE_ORDER_STATUSES`, `findPaidPendingDeliveryStatuses()` |
| `issuance.ts` | Quy đổi WPT → VND theo giá phát hành. **Không giữ hằng số giá**: re-export `WPT_ISSUE_PRICE_VND` từ `lib/config/issue-terms.ts` (xem 3.6). ⚠️ BE-04 đổi chữ ký thành `wptToVnd(amount, issuePriceVnd)` — nhận giá làm **tham số** để tệp này giữ được tính thuần và **không** phải thành `server-only` | `wptToVnd()`, re-export `WPT_ISSUE_PRICE_VND` |
| `audit.service.ts` | Đọc sổ kiểm toán | `listAuditLog()` |
| `result.ts` | Kiểu `Result<T>` + `ok`/`err` + `httpStatusFor` | Chuẩn hóa lỗi |
| `schemas.ts` | Schema Zod dùng chung FE/BE | `mintSchema`, `placeOrderSchema`, `previewPurchaseSchema` (**bút danh của `placeOrderSchema`**, không khai lại), `executeOrderSchema`, `orderQuerySchema`, `issueInitialSupplySchema` (BE-04 — **cố ý không có trường số lượng**), `openPeriodSchema` / `distributionPeriodSchema` / `distributionPeriodQuerySchema` (BE-06 — **cố ý không có trường kích thước lô**), `amountSchema`, `walletSchema` |

### Mô hình trạng thái lệnh mua (`purchase.state.ts`)

```
PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
   │           │            │
   │           │            └──► FAILED
   │           └──► REJECTED
   └──► EXPIRED
```

| Trạng thái | Nghĩa | Đã tốn phí chưa |
|---|---|---|
| `PLACED` | Đã đặt, chưa kiểm gì | chưa |
| `CHECKING` | Đang kiểm số dư / ủy quyền / tồn WPT | chưa |
| `EXECUTING` | Đã chiếm quyền gửi giao dịch | có thể rồi |
| `COMPLETED` | Giao dịch xác nhận thành công | có |
| `REJECTED` | Không đạt điều kiện, **chưa gửi giao dịch** | chưa |
| `FAILED` | Đã chiếm `EXECUTING` rồi thất bại | có thể rồi |
| `EXPIRED` | Quá hạn chưa khớp | chưa |

**KHÔNG có trạng thái "đã trả tiền nhưng chưa nhận token", và đây là điểm an toàn cốt lõi
của luồng mua.** Chuyển VNDB và chuyển WPT nằm trong **cùng một** giao dịch on-chain, nên chỉ
có hai kết cục: cả hai xảy ra, hoặc không gì xảy ra. Một trạng thái kiểu `PAID_PENDING_TOKEN`
sẽ mô tả tình huống **không tồn tại**, và mọi mã đối soát viết cho nó là mã xử lý chuyện
tưởng tượng. `findPaidPendingDeliveryStatuses()` là chốt máy kiểm — thêm trạng thái như vậy
thì `test/purchase-state.test.ts` đỏ ngay.

`REJECTED` khác `FAILED` là **có chủ ý**: `REJECTED` nghĩa là chắc chắn chưa tốn phí, đặt lại
được ngay; `FAILED` nghĩa là có thể đã tốn phí, phải xem lý do trên chuỗi. Vì vậy sau khi đã
chiếm `EXECUTING` thì **mọi** thất bại là `FAILED` — kể cả lỗi xảy ra trước khi có mã giao
dịch, vì lúc đó không còn chứng minh được là chưa có gì lên chuỗi (lệnh gửi có thể đã thành
công mà phản hồi bị mất).

**Lưu ý khi phát triển:**
- **`purchase.service.ts` cầm HAI cổng lưu trữ, không phải một.** `getStore()` (`ITxnStore`) cho sổ giao dịch và sổ kiểm toán; `getOrderStore()` (`IOrderStore`) cho bảng lệnh mua. Đừng dựng lại một interface hợp nhất kiểu `IBankStore`: một cổng gộp buộc mọi nghiệp vụ phải cầm cả những hàm nó không dùng, và mỗi lần thêm bảng lại phải sửa cả hai bản hiện thực dù việc mới chẳng liên quan.
- **`ORDER_STATUSES` có đúng MỘT nguồn: `store/order.store.port.ts`.** `purchase.state.ts` chỉ re-export. Khai lại ở tầng nghiệp vụ là mời gọi cột `status` trong cơ sở dữ liệu lệch khỏi mô hình trạng thái ngay lần thêm trạng thái đầu tiên.
- **`purchase.state.ts` import TRỰC TIẾP `@/lib/store/order.store.port`, không qua barrel `@/lib/store`.** Barrel có `import 'server-only'`, mà `purchase.state.ts` bị `schemas.ts` kéo theo sang phía form/client — đi qua barrel là vỡ build, và lỗi hiện ra ở một file không liên quan.
- `authorize()` ghi audit cho **cả hai kết cục** ALLOWED và DENIED. Giữ nguyên: kênh kiểm toán cần thấy cả những lần bị chặn.
- `authorize()`/`toResult()` nằm ở `authorize.ts`, **không** sao chép vào service mới: hai đường ghi audit song song sẽ lệch nhau ở lần sửa đầu tiên, và sổ kiểm toán thiếu bản ghi thì không dùng được để đối chiếu trách nhiệm.
- Hàm đọc dữ liệu theo ví phải để `wallet` **bắt buộc** trong schema. `ITxnStore.listTxns` không truyền `wallet` sẽ trả giao dịch của **mọi** ví; để optional là mở đường cho một lời gọi thiếu tham số làm rò dữ liệu ví khác ra giao diện nhà đầu tư.
- Giá phát hành là **tham số cấu hình**, không phải dữ liệu mẫu và không phải giá thị trường. Nhờ vậy `số dư thật × giá phát hành` không trộn số thật với số bịa. **Hằng số nằm ở `lib/config/issue-terms.ts`, một nguồn duy nhất** — `issuance.ts` chỉ re-export, `mock.adapter.ts` nhập cùng hằng số đó. Đừng khai lại giá ở tầng nghiệp vụ hay tầng cổng: trước MC-01 có **hai** hằng số độc lập cùng ý nghĩa, đổi một chỗ thì test vẫn xanh mà giá hiển thị lệch giá khớp lệnh. `app/test/issue-price-single-source.test.ts` (15 ca) chốt việc đó, và **cố ý không hardcode con số** nên nó bắt cả trường hợp khai lại với đúng giá hôm nay.
- Luôn **lưu giao dịch PENDING trước khi chờ receipt**. Nếu tiến trình chết giữa chừng, giao dịch vẫn còn dấu vết để đối soát.
- Luôn **đọc lại trạng thái từ chain** sau khi ghi, không tin receipt.
- Ghi audit và ghi `Txn` phải dùng **vai đang thực hiện thao tác**, không phải vai đã tạo bản ghi trước đó. Nhà đầu tư đặt lệnh, ngân hàng khớp lệnh — lấy `order.actorRole` cho bản ghi `order:execute` sẽ ghi vào sổ rằng nhà đầu tư tự khớp lệnh của mình, đúng cái điều mà việc tách `order:place`/`order:execute` được dựng để ngăn.
- Chống thao tác trùng bằng **cập nhật có điều kiện ở cơ sở dữ liệu**, không bằng "đọc trạng thái rồi mới ghi". Hai lời gọi đồng thời sẽ cùng đọc thấy `CHECKING`, cùng kết luận được phép, rồi cùng gửi giao dịch — nhà đầu tư bị trừ tiền hai lần. `IOrderStore.transitionOrder` đưa điều kiện vào chính câu `UPDATE` và trả `null` khi không dòng nào khớp; người gọi **phải** dừng khi nhận `null`.
- Trong `schemas.ts`, đặt `.transform()` **trước** `.refine()` khi refine phải chuyển đổi kiểu. Zod 4 vẫn chạy các refine còn lại sau khi một check trước đó đã trượt, nên `.regex(...).refine(v => BigInt(v) > 0n)` sẽ ném `SyntaxError` **thô** với đầu vào `"1.5"`. Mà `safeParse` được gọi **ngoài** khối `try` của mọi service, nên lỗi đó không thành `Result` mã `VALIDATION` — nó nổ thẳng ra server action và production Next che thành "An error occurred". `.transform()` tạo pipe, và pipe không chạy khi vế trước đã trượt.
- Phân biệt phạm vi đọc theo **quyền**, không theo tên vai: `listOrders` hỏi `can(role, 'order:read:all')` để quyết định có được bỏ trống bộ lọc ví hay không. Vai không có quyền đó thì thiếu ví là **lỗi validate**, không phải "trả về toàn bộ sổ lệnh".
- **Hàm "xem trước" dùng `assertCan`, hàm ghi dùng `authorize`.** `authorize()` ghi một bản ghi kiểm toán cho mỗi lời gọi, nên dùng nó ở một hàm chỉ đọc mà màn hình gọi liên tục sẽ nhấn chìm sổ bằng hàng chục dòng "đã cho phép xem" — và sổ mất khả năng dùng để đối chiếu trách nhiệm. Ba hàm đang theo cách này: `previewPurchase`, `previewDistribution`, `getDistributionPeriod`. Đánh đổi đã biết: một lần xem trước **bị chặn** không để lại dấu vết; chấp nhận được vì chúng không đổi gì, đã ghi thành câu hỏi mở ở checkpoint BE-03. Với `previewDistribution` còn một lý do cứng hơn: điều kiện hoàn thành của BE-06 đòi hàm đó **không ghi gì**, kể cả một dòng audit — `test/distribution-service.test.ts` so ảnh **cả bốn bảng** trước và sau lời gọi.
- **Danh sách ví nắm giữ KHÔNG đọc được từ chuỗi.** Mọi nghiệp vụ cần một danh sách ví (chia lợi nhuận, tất toán) phải dựng từ cơ sở dữ liệu và **truyền giới hạn quét tường minh**: `listOrders`/`listPayouts` mặc định `limit = 50`, nên gọi mà không truyền giới hạn sẽ cắt danh sách ở ví thứ 51 — hệ quả không phải một trang thiếu dữ liệu mà là những nhà đầu tư **không bao giờ được chia**, không thông báo nào. Chạm ngưỡng thì **từ chối**, đừng lặng lẽ chia cho một phần người nắm giữ.

**Cách mở rộng:** mỗi nghiệp vụ mới là **một file service riêng** (`redeem.service.ts`), cùng khuôn mẫu: validate → authorize → gọi port → lưu trạng thái → audit → trả `Result`. `distribution.service.ts` (BE-06) là bản mẫu gần nhất cho một luồng nhiều bước có chia lô và chạy lại được.

## 3.5. `app/src/lib/store/` và `providers/`

**Bảy cổng lưu trữ, mỗi cổng một nghiệp vụ** (BE-09 năm cổng, BE-04 thêm hai). Hai hiện thực cho
mỗi cổng, chọn bằng cùng cờ `USE_MOCK_DB`.

| File | Cổng / vai trò | Hàm chính |
|---|---|---|
| `store/store.port.ts` | `ITxnStore` — giao dịch + audit log | `saveTxn`, `updateTxnStatus`, `listTxns`, `appendAudit`, `listAudit` |
| `store/order.store.port.ts` | `IOrderStore` — lệnh mua WPT | `createOrder`, `findOrder`, `transitionOrder`, `attachOrderTxHash`, `listOrders`, `expireOrders` |
| `store/distribution.store.port.ts` | `IDistributionStore` — kỳ chia + hồ sơ chia. **Đã có nghiệp vụ dùng thật** từ BE-06 (`lib/bank/distribution.service.ts`, xem 4.5) | `openPeriod`, `findPeriod`, `findPeriodByKey`, `listPeriods`, `setPeriodStatus`, `createPayouts`, `markPayout`, `listPayouts` |
| `store/settlement.store.port.ts` | `ISettlementStore` — đợt tất toán + hồ sơ người nắm giữ | `openRound`, `findRound`, `listRounds`, `setRoundStatus`, `createCases`, `markCase`, `listCases` |
| `store/keeper.store.port.ts` | `IKeeperStore` — mốc chạy tiến trình hẹn giờ | `startRun`, `finishRun`, `findRun`, `listRuns` |
| `store/config.store.port.ts` | `IConfigStore` — tham số hệ thống **và** lịch sử đổi tham số (BE-04). MỘT cổng cho HAI bảng: mọi lần ghi giá PHẢI kèm một dòng lịch sử, nên tách hai cổng là mở đường gọi một mà quên cái kia | `getConfig`, `setConfig`, `listConfigHistory` |
| `store/project.store.port.ts` | `IProjectStore` — dự án đã token hoá; giữ **tổng cung** của đợt phát hành (BE-04) | `createProject`, `findProject`, `markIssued`, `listProjects` |
| `store/seed-data.ts` | **MỘT nguồn dữ liệu khởi tạo cho CẢ HAI bản lưu trữ** (BE-04). Không con số nào gõ tay ở đây: giá/tổng cung/ngưỡng nhập từ `lib/config/issue-terms.ts`, danh sách vai được đổi cấu hình suy từ `lib/rbac/config-role.ts` | `SEED_CONFIG_ROWS`, `SEED_PROJECTS`, `SEED_PROJECT_CHAINS`, `SEED_ROLE_ROWS` |
| `store/config-values.ts` | Đọc tham số đã cấu hình, **lùi về mặc định trong mã** khi bảng trống. Đặt ở tầng lưu trữ vì có HAI người đọc ở hai tầng: `lib/bank` và **factory `getLedger`** — để ở `lib/bank` thì tầng cổng phải nhập tầng nghiệp vụ, tức ngược chiều phụ thuộc. Bảng khoá đầy đủ ở 3.13 | `readIssuePriceVnd`, `readPriceChangeThreshold`, `readDistributionBatchSize`, `readDistributionDustWallet` |
| `store/store.errors.ts` | Lớp lỗi + phép kiểm **dùng chung cho cả hai bản** | `UniqueConstraintError`, `ForeignKeyError`, `InvalidStatusError`, `StoreUsageError`, `assertStatus`, `assertAmount`, `assertSnapshotId`, `assertBulkSize`, `assertNoDuplicateWallet`, `mapPgConstraintError`, `UNIQUE_CONSTRAINTS`, `FOREIGN_KEYS` |
| `store/memory.state.ts` | Một khoá `globalThis` cho state của MỌI bản bộ nhớ | `memoryState`, `resetMemoryStores` |
| `store/memory.{store,order,distribution,settlement,keeper,config,project}.store.ts` | Bản RAM cho free-tier. Hai bản BE-04 nạp dữ liệu khởi tạo từ `seed-data.ts` | |
| `store/postgres.pool.ts` | Pool `pg` + `ensureSchema` + **nạp dữ liệu khởi tạo** (BE-04, `ON CONFLICT DO NOTHING` nên chạy lại không ghi đè giá ngân hàng đã đặt) | `pgQuery`, `pgTransaction` |
| `store/postgres.{store,order,distribution,settlement,keeper,config,project}.store.ts` | Bản Postgres, `pg` thuần, query tham số hoá | |
| `store/index.ts` | Factory theo `USE_MOCK_DB` | `getStore`, `getOrderStore`, `getDistributionStore`, `getSettlementStore`, `getKeeperStore`, `getConfigStore`, `getProjectStore`, `resetStoreCache`, `resetMemoryStore` |
| `providers/kyc/*` | `IKycProvider` + mock (auto-approve nhưng **vẫn validate địa chỉ**) + real stub |  |

**Bảng dữ liệu và ràng buộc duy nhất** (`app/prisma/schema.prisma` là nguồn sự thật; `init.sql`
sinh ra từ nó bằng `npm run db:sql`):

| Bảng | Ràng buộc duy nhất | Chặn điều gì |
|---|---|---|
| `PurchaseOrder` | `txHash` | một mã giao dịch gắn cho hai lệnh mua |
| `DistributionPeriod` | `periodKey` | mở cùng một kỳ chia hai lần |
| `DistributionPayout` | `(periodId, investorWallet)` | **chia trùng** cho một nhà đầu tư trong cùng kỳ |
| `SettlementCase` | `(roundId, holderWallet)` | **chi trả hoặc đốt trùng** cho một ví trong cùng đợt |
| `KeeperRun` | `(jobName, periodKey)` | tiến trình hẹn giờ chạy trùng |
| `Project` | `(tokenSymbol, chain)` | hai dự án cùng mã token trên cùng một chuỗi |
| `SettlementRound` | — | (hồ sơ từng ví mới là chỗ cần chặn) |
| `SystemConfig` | `key` là khoá chính | hai dòng cùng một tham số |
| `SystemConfigHistory` | — | (bảng chỉ ghi thêm, không có gì phải chặn trùng) |

⚠️ **`Project` duy nhất theo `(tokenSymbol, chain)`, không phải `tokenSymbol` một mình.** Mỗi
chuỗi có trạng thái phát hành riêng: đã phát hành trên `hardhat-local` không có nghĩa là đã phát
hành trên `mock`. Duy nhất theo `tokenSymbol` thì toàn hệ chỉ có ĐÚNG MỘT dòng WPT nằm trên một
chuỗi, và mọi chuỗi khác tra ra `null` — `issueInitialSupply` từ chối với lý do "chưa có dự án"
trong khi dự án rõ ràng có. Cùng lý do đó, `SEED_PROJECT_CHAINS` nạp dòng dự án cho **cả `mock`
và chuỗi mặc định**, để bản demo free-tier phát hành được mà không cần hardhat node.

**Lưu ý khi phát triển:**

- **Ràng buộc duy nhất là ở cơ sở dữ liệu, không phải phép kiểm trước khi ghi.** Hai tiến
  trình song song đều có thể vượt qua `if (đã tồn tại) return` rồi cùng ghi. Cách dùng đúng
  của `IKeeperStore.startRun` là **gọi trước khi làm việc** và coi `UniqueConstraintError`
  là tín hiệu "bản khác đã nhận việc". `findRun` chỉ để hiển thị.
- **`transitionOrder` đặt điều kiện trạng thái TRONG câu `UPDATE`** và trả `null` khi không
  dòng nào khớp. Đọc trạng thái rồi mới ghi thì hai lời gọi đồng thời cùng thấy `CHECKING`,
  cùng kết luận được phép, rồi cùng gửi giao dịch — nhà đầu tư bị trừ tiền hai lần.
- **Bản bộ nhớ phải nghiêm ngặt NGANG bản Postgres.** Mọi phép kiểm nằm ở `store.errors.ts`
  và các `assert*Status` trong từng port, cả hai bản đều gọi. Bản bộ nhớ dễ tính hơn sẽ sinh
  loại lỗi xanh ở free-tier và đỏ khi `docker compose up`. Ba khác biệt đã được xử lý riêng:
  so mốc thời gian theo giá trị chứ không so chuỗi, kiểm số tiền là chuỗi chữ số không âm,
  và **không giới hạn số dòng** như `memory.store.ts` (Postgres không bao giờ bỏ dòng).
- **Cột trạng thái là `String`, không phải enum của Postgres.** Đánh đổi: cơ sở dữ liệu
  không tự chặn giá trị lạ, nên chốt chặn duy nhất là `assert*Status` ở tầng cổng —
  `test/store-constraints.test.ts` giữ chỗ đó.
- **`ensureSchema` áp `init.sql` theo TỪNG câu lệnh trong SAVEPOINT riêng**, bỏ qua đúng bốn
  mã lỗi "đã có rồi". Nhờ vậy một volume Postgres dựng trước BE-09 được bổ sung bảng mới,
  chứ không thiếu bảng cho tới lúc nghiệp vụ đầu tiên chạm vào.
- **Số tiền vào và ra đều là CHUỖI chữ số.** `bigint` không JSON-hoá được nên không qua được
  biên máy chủ sang trình duyệt, và `number` mất chính xác từ 2^53.
- **Không dùng Prisma Client lúc chạy** (~22MB có cả query engine nhị phân). Prisma chỉ sinh
  lược đồ; runtime là `pg` (~0.5MB, nằm trong `serverExternalPackages` mặc định của Next).

**Cách mở rộng:**

1. Thêm bảng → sửa `prisma/schema.prisma`, chạy `npm run db:sql` sinh lại `init.sql`. **Không
   sửa `init.sql` bằng tay** — hai nguồn DDL là nguồn lỗi khó tìm.
2. Thêm ràng buộc duy nhất → khai thêm một dòng vào `UNIQUE_CONSTRAINTS` (hoặc `FOREIGN_KEYS`)
   ở `store.errors.ts`, để `UniqueConstraintError` nói được cột nào trùng. Test đối chiếu bảng
   tra này với `init.sql` theo **cả hai chiều**, nên quên một chiều là đỏ ngay.
3. Thêm nghiệp vụ → thêm một cổng `*.store.port.ts` + hai hiện thực + một factory ở `index.ts`.
   **Không nhồi vào `ITxnStore`**: interface 20 hàm thì mỗi lần thêm nghiệp vụ phải sửa cả hai
   bản dù việc mới không liên quan.
4. Thêm provider mới (oracle, core banking) theo đúng khuôn: `*.port.ts` + `mock.provider.ts` +
   `real.provider.stub.ts` + `index.ts` chọn theo cờ.

## 3.6. `app/src/lib/config/` và `chains/`

| File | Vai trò | Lưu ý |
|---|---|---|
| `config/env.ts` | **Nơi duy nhất đọc `process.env` ở server**, validate bằng Zod | Có `import 'server-only'` — hàng rào cứng |
| `config/flags.ts` | Tính cấu hình công khai ở server | Quyết định chain nào chọn được; `demoPaymentMint` tính bằng đúng hàm mà server dùng để chặn |
| `config/issue-terms.ts` | **Nguồn duy nhất của điều khoản phát hành**: `WPT_ISSUE_PRICE_VND`, `WPT_TOTAL_SUPPLY`, `WPT_PRICE_CHANGE_THRESHOLD`, `CONFIG_KEYS`, `WPT_TOKEN_SYMBOL` | Hai điều **cố ý**, đừng "dọn" mất: (1) **không có `import` nào** — tệp lá thì không thể tạo vòng phụ thuộc, mà `mock.adapter.ts` đọc hằng số này ở phạm vi module nên một vòng sẽ cho ra giá `undefined`/`0` và biến khớp lệnh thành "mua không mất tiền"; (2) **không có `server-only`** — đây là hằng số hiển thị được, chặn phía client sẽ chặn luôn `wptToVnd`. ⚠️ Từ BE-04 ba hằng số này là **giá trị MẶC ĐỊNH KHI CHƯA CẤU HÌNH**, không còn là giá trị đang có hiệu lực: đọc giá đang dùng bằng `readIssuePriceVnd()` (3.12) |
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

## 3.10. Điểm cắm đang chờ — `scripts/` và cơ chế marker (MC-01)

Backend là tầng trung gian nên nó **xong trước** giao diện và trước contract sẽ cắm vào. Hệ
quả: trong `app/src` có những hàm đã chạy được nhưng **chưa ai gọi**, và những method đang ném
`LedgerNotImplementedError` vì thiếu contract. Bằng công cụ thông thường cả hai trông giống mã
chết, nên người vào sau dễ xóa nhầm, còn người làm task giao diện thì không biết backend đã có
sẵn gì và viết lại từ đầu.

MC-01 dựng cơ chế để mỗi chỗ như vậy **tự khai báo mình đang chờ ai**, và **tự báo đỏ khi bị
bỏ quên**. Ba từ khóa, đặt ngay trên khai báo, cú pháp cố định để máy đọc được:

| Marker | Nghĩa | Quy ước |
|---|---|---|
| `@pending <MÃ-TASK> \| <đã sẵn gì>` | code **đã chạy được**, chờ người gọi | steering mục 1 |
| `@blocked <MÃ-TASK> \| <thiếu gì>` | code **chưa chạy được**, đang ném lỗi | steering mục 2 |
| `@flow <tên-luồng>:<số bước> \| <việc của bước>` | vị trí trong luồng nghiệp vụ | steering mục 4 |

| Tệp | Vai trò | Lưu ý |
|---|---|---|
| `.kiro/steering/make-control.md` | Quy ước đầy đủ, nạp `always` | **Nguồn duy nhất của cú pháp.** Cấm biến thể (`@todo`, `TODO`, `FIXME`, `HACK`, `XXX`) — script khớp theo từ khóa cố định nên mỗi biến thể là một điểm cắm **vô hình** với công cụ |
| `.kiro/task-status.json` | Nguồn duy nhất về trạng thái task **và** về tập mã task hợp lệ | Bất biến: một mã ở **đúng một** trong `done`/`inProgress`/`planned`. Trùng hai chỗ thì phép kiểm "marker chờ task đã done" cho kết quả tùy thứ tự đọc, nên script báo `BAD_TASK_STATUS` chứ không im lặng |
| `scripts/scan-pending.mjs` | Quét marker, in bảng, `--check`, `--json`, và sinh mục dưới đây | Node 20, ESM thuần, **không phụ thuộc gói ngoài**. Cú pháp khai ở đây và **chỉ** ở đây |
| `scripts/gen-flow-diagram.mjs` | Sinh `docs/flows/<luồng>.md` (Mermaid) từ marker `@flow` | Nhập `scan()` từ script trên, **không quét lại mã nguồn** |
| `app/test/pending-markers.test.ts` | 20 ca chốt cơ chế: marker không lạc hậu, sơ đồ khớp marker, mục dưới đây khớp marker | Tầng 2 dựng **repo giả trong thư mục tạm** để chứng minh phép kiểm có răng, không chạm repo thật |

**Lưu ý khi phát triển:**
- **Còn điểm cắm là bình thường, không làm đỏ bất cứ thứ gì.** Điểm cắm là trạng thái công
  việc. Đỏ chỉ khi marker sai cú pháp, mã task không có trong `task-status.json`, marker chờ
  task đã `done`, mô tả chung chung, số bước `@flow` trùng/nhảy cách, hoặc tài liệu sinh ra
  đã lệch marker. Đừng thêm phép kiểm "số điểm cắm phải giảm".
- **Hoàn thành một task thì phải dọn marker chờ task đó** — `@pending` đã được gọi thì xóa
  marker, `@blocked` đã nối được thì xóa marker. Bỏ qua thì `--check` và test báo đỏ, và đó
  là chủ đích: nếu dọn marker chỉ là "nhớ thì làm" thì sau vài tháng bảng đầy rác và không ai
  còn tin nó.
- **Số bước `@flow` là số nguyên liên tiếp từ 1.** Cần chèn bước vào giữa thì **đánh số lại cả
  luồng**; số thập phân (`purchase:3.5`) là sai cú pháp. Lý do: số nguyên liên tiếp làm "thiếu
  bước" thành thứ máy phát hiện được.
- **Tài liệu sinh ra thì đừng sửa tay** — cả `docs/flows/*.md` lẫn khối bên dưới. Lần sinh sau
  ghi đè, và trong khoảng thời gian trước đó thì tài liệu nói một đằng còn mã làm một nẻo.
- **`package.json` ngoài tầm cơ chế này.** Phạm vi quét là tệp mã trong `app/src`, `app/test`,
  `app/e2e`, `packages/*/src`, `packages/*/contracts`, `scripts`; JSON không có chú thích. Phụ
  thuộc giữ cho task sau thì ghi ở Phần 2 (xem 2.4).

**Cách mở rộng:**
1. Thêm điểm cắm mới → gắn marker ngay trên khai báo, mã task phải có trong `task-status.json`.
2. Thêm luồng nghiệp vụ mới, **đã hoàn thành đầu cuối ở tầng BE** → gắn `@flow` rồi
   `node scripts/gen-flow-diagram.mjs <tên-luồng>`. Năm tên luồng là cố định
   (`purchase`, `issue`, `distribute`, `settle`, `onboard`); cần tên mới thì sửa steering và
   `FLOW_NAMES` trước, không tự đặt.
3. Sau khi sửa marker → `node scripts/scan-pending.mjs --write-report` để sinh lại khối dưới.

<!-- BEGIN:diem-cam (sinh tự động — ĐỪNG SỬA TAY) -->

> **Bảng dưới đây do `scripts/scan-pending.mjs` sinh ra từ marker `@pending` / `@blocked`
> trong mã nguồn.** Sửa tay sẽ bị ghi đè ở lần sinh sau, và trong khoảng thời gian trước đó
> thì bảng nói một đằng còn mã làm một nẻo. Muốn đổi nội dung thì sửa marker trong mã.
>
> - Sinh lại: `node scripts/scan-pending.mjs --write-report`
> - Kiểm còn khớp marker: `node scripts/scan-pending.mjs --check-report`
> - Quy ước marker: `.kiro/steering/make-control.md`

Hai loại marker trả lời hai câu hỏi khác nhau, nên **đừng gộp khi đọc bảng**:

| Loại | Trạng thái mã | Việc của task được nhắc |
|---|---|---|
| **cắm** (`@pending`) | đã chạy được, chưa ai gọi | **chỉ cần gọi** — làm được ngay |
| **chặn** (`@blocked`) | đang ném lỗi | **phải xong trước**, rồi mới nối được |

**19 điểm cắm · 12 điểm chặn**, nhóm theo task đang chờ.

| Task | Loại | Vị trí | Đã sẵn gì (cắm) / thiếu gì (chặn) |
|---|---|---|---|
| `BE-05` | cắm | `app/src/lib/store/index.ts:170` | cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ |
| `FE-05` | cắm | `app/src/app/actions/purchase.ts:33` | đã sẵn đầu cuối ở `previewPurchase`: kiểm quyền `order:place`, báo giá, chạy ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy, trả `canPlaceOrder` + `blockers` + `howToFix` cho từng phép kiểm. Màn mua WPT chỉ cần gọi và hiển thị. FE-05 PHẢI chống gọi dồn: hàm này gọi được sau mỗi ký tự người dùng gõ vào ô số lượng, nên màn hình phải hoãn lời gọi và bỏ phản hồi đã cũ — service KHÔNG có bộ nhớ đệm, và cũng không nên có |
| `FE-05` | cắm | `app/src/app/actions/purchase.ts:41` | đã sẵn đầu cuối ở `placeOrder`: validate Zod, kiểm quyền `order:place` (vai INVESTOR), kiểm điều kiện trước khi tạo bản ghi, CHỐT số VNDB tại thời điểm đặt, lưu lệnh `PLACED`, ghi sổ kiểm toán. Màn mua WPT chỉ cần gọi và hiển thị `Result` |
| `FE-05` | cắm | `app/src/lib/bank/purchase.service.ts:125` | đã sẵn đầu cuối: validate Zod dùng chung schema với đặt lệnh, kiểm quyền qua RBAC, báo giá qua ILedgerPort, và ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy. FE-05 chỉ cần gọi rồi hiển thị `blockers` và `howToFix`, KHÔNG viết lại phép kiểm nào ở client, và PHẢI chống gọi dồn khi người dùng gõ số lượng vì mỗi ký tự là một lời gọi |
| `FE-05` | cắm | `app/src/lib/signer/wallet.signer.ts:10` | đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ |
| `FE-06` | cắm | `app/src/app/actions/purchase.ts:49` | đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai BANK_ADMIN), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận |
| `FE-06` | cắm | `app/src/app/actions/purchase.ts:57` | đã sẵn đầu cuối ở `listOrders`: phân biệt `order:read` với `order:read:all`, nên "vai nào xem được sổ lệnh nào" là việc của RBAC chứ không phải của màn hình |
| `FE-07` | cắm | `app/src/app/actions/bank.ts:38` | đã sẵn đầu cuối ở `issueInitialSupply`: đọc tổng cung từ bảng dự án (KHÔNG nhận từ input, nên màn hình không có ô số lượng và không được thêm), kiểm quyền `token:mint`, chặn phát hành lần hai ở CẢ cơ sở dữ liệu lẫn chuỗi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành bằng khoá lạc quan, đọc lại tổng cung từ chuỗi. Màn phát hành chỉ cần ô ví SPV và một nút |
| `FE-07` | cắm | `app/src/app/actions/bank.ts:46` | đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG con số dự kiến trong bảng dự án và tổng cung thật trên chuỗi, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một |
| `FE-07` | cắm | `app/src/app/actions/config.ts:18` | đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo |
| `FE-07` | cắm | `app/src/app/actions/config.ts:25` | đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:33` | đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:41` | đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:49` | đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:79` | đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:86` | vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được |
| `FE-08` | cắm | `app/src/lib/bank/distribution-trigger.service.ts:739` | đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng |
| `FE-09` | cắm | `app/src/app/actions/distribution.ts:57` | đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ |
| `IN-02` | cắm | `app/src/lib/bank/distribution-trigger.service.ts:344` | đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `profitPoolBalance` rồi so với mốc `distribution.last_settled_balance`, có chặn ngưỡng tối thiểu và có phát hiện số dư giảm. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào ví lợi nhuận do Indexer đọc được, giữ nguyên bốn nhánh quyết định và nguyên phần chia ở `runDistributionCycle`. Đổi được vì mốc số dư vẫn là thứ chốt "đã xử lý tới đâu", sự kiện chỉ thay việc hỏi định kỳ |
| `SC-02` | chặn | `app/src/lib/ledger/evm.adapter.ts:375` | thiếu hợp đồng phát hành một lần: chưa contract nào lưu cờ "đã phát hành nguồn cung ban đầu" |
| `SC-02` | chặn | `app/src/lib/ledger/evm.adapter.ts:381` | thiếu hợp đồng phát hành một lần: không có cờ nào để đọc, nên không trả được true/false thật |
| `SC-02` | chặn | `app/src/lib/ledger/evm.adapter.ts:392` | thiếu hợp đồng phát hành một lần: địa chỉ ví thanh toán SPV do chính hợp đồng đó giữ |
| `SC-03` | chặn | `app/src/lib/ledger/evm.adapter.ts:401` | thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ |
| `SC-03` | chặn | `app/src/lib/ledger/evm.adapter.ts:413` | thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi |
| `SC-03` | chặn | `app/src/lib/ledger/evm.adapter.ts:432` | thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI |
| `SC-03` | chặn | `app/src/lib/ledger/evm.adapter.ts:438` | thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:574` | thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:580` | thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:585` | thiếu quyết định giá NAV có phải `Redemption.rate` hay không |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:591` | thiếu quyết định giá NAV có phải `Redemption.rate` hay không |
| `SC-05` | chặn | `app/src/lib/ledger/evm.adapter.ts:556` | thiếu quyết định chữ ký: `distributeBatch(snapshotId, wallets)` không mang mã kỳ nên adapter không tra được `distributionId`; hợp đồng `ProfitDistributor` thì đã có và đã deploy. Hai đường xử lý ghi ngay trên marker này |

**Luồng nghiệp vụ đã gắn `@flow`** (sơ đồ cũng sinh từ marker, xem `docs/flows/`):

- `distribute` — 14 bước → `docs/flows/distribute.md`
- `issue` — 9 bước → `docs/flows/issue.md`
- `purchase` — 12 bước → `docs/flows/purchase.md`

<!-- END:diem-cam -->

## 3.11. Khuôn checkpoint và máy kiểm (MC-02)

Checkpoint là thứ **duy nhất** Supervisor dựa vào để nghiệm thu, và nó phải làm hai việc mâu thuẫn
nhau: **đọc trọn trong một trang** để quyết được, và **giữ đủ vết** để lần lại sau. Độ dài thực tế
cho thấy vế thứ hai đang thắng — đo bằng `wc -l docs/CHECKPOINT_*.md | sort -n`: các checkpoint
thường **164–626** dòng, còn `CHECKPOINT_MC01.md` là **5013** dòng.

MC-02 tách hai vai: **mục 0** là bản để quyết, mục 1 trở xuống là vết.

| Tệp | Vai trò | Lưu ý |
|---|---|---|
| `docs/CHECKPOINT_TEMPLATE.md` | Khuôn, kèm **ví dụ điền sẵn** cho cả ba ký hiệu | Mục 0 đặt ngay sau bảng thông tin task; sáu mục cũ giữ nguyên phía dưới |
| `.kiro/steering/checkpoint.md` | Quy ước đầy đủ, nạp `always` | **Nguồn duy nhất của quy tắc.** Hai ngưỡng ở đây phải khớp hằng số trong script |
| `scripts/check-checkpoint.mjs` | Năm phép kiểm, `--in-progress` | Node 20, ESM thuần, **không phụ thuộc gói ngoài**, không dùng thư viện phân tích Markdown |
| `app/test/check-checkpoint.test.ts` | 21 ca chốt cơ chế | Chạy trên **tệp mẫu trong thư mục tạm**, không chạm checkpoint thật |

Ba ký hiệu trạng thái **cố định**, và script nhận dòng bảng đối chiếu theo đúng ba ký hiệu này:
`✅` đạt · `🔶` đạt một phần · `❌` không đạt.

| Mã lỗi | Khi nào đỏ |
|---|---|
| `NO_SUMMARY` | không có tiêu đề mục 0 |
| `SUMMARY_TOO_LONG` | mục 0 vượt `MAX_SUMMARY_LINES` = **60** dòng |
| `DOD_COUNT_MISMATCH` | số dòng bảng đối chiếu khác số ô `- [ ]` ở mục điều kiện hoàn thành của `requirements.md` |
| `MISSING_EVIDENCE` | có dòng mà cột bằng chứng rỗng hoặc chỉ ghi "đã làm" |
| `NOT_SPLIT` | cả tệp vượt `MAX_FILE_LINES` = **800** dòng mà chưa có tệp `_DETAIL.md` |

**Lưu ý khi phát triển:**
- **Chỉ kiểm task đang làm.** `--in-progress` đọc `.kiro/task-status.json` mục `inProgress`.
  Checkpoint của task đã `done` thì script **không chạm**: đó là vết lịch sử, và sửa lại vết lịch
  sử để vừa một quy tắc ra sau là làm sai chính thứ mà vết đó dùng để ghi. Cụ thể:
  `CHECKPOINT_MC01.md` đỏ `NOT_SPLIT` và `CHECKPOINT_BE09.md` đỏ `DOD_COUNT_MISMATCH` — cả hai là
  **dữ liệu, không phải lỗi cần vá**.
- **Ba trường hợp CỐ Ý không đỏ**, đừng "sửa" bằng cách thêm mã lỗi thứ sáu: (a) không có task nào
  đang làm; (b) task đang làm chưa viết checkpoint — báo đỏ ở đây biến `run-local-all.sh` thành đèn
  đỏ thường trực, và đèn đỏ thường trực thì bị bỏ qua, nghĩa vụ này đã có ở `branching.md` §11;
  (c) con số không kèm lệnh đo — không phân biệt được bằng máy.
- **Hai ngưỡng khai ở hai nơi và phải khớp:** hằng số đầu `check-checkpoint.mjs` và bảng ở
  `.kiro/steering/checkpoint.md` §3. Đổi thì đổi cả hai trong cùng commit.
- **Mã thoát 1 khác 2.** `1` = checkpoint sai khuôn (sửa checkpoint). `2` = không chạy được: sai
  cách gọi, không tìm ra `requirements.md`, nguồn trạng thái task hỏng (sửa cách gọi hoặc dữ liệu
  nền). Gộp hai loại thì người đọc thông báo đi sửa sai chỗ.
- **Script chỉ dọn phần cơ học.** Ghi `✅` cho việc chưa xong thì script vẫn xanh. "Script xanh"
  không phải "đã được nghiệm thu".

**Cách mở rộng:**
1. Đổi ngưỡng → sửa hằng số trong script **và** bảng trong steering, cùng commit.
2. Thêm phép kiểm mới → thêm mã lỗi trong script **và** một ca vào bảng `DOT_BIEN` của
   `app/test/check-checkpoint.test.ts`. Có ca "chốt chặn" so tập mã lỗi, nên thiếu ca là đỏ.
3. Quy ước đặt tên checkpoint mới (ngoài `CHECKPOINT_<MÃ>.md` và `CHECKPOINT_<MÃ>_<hậu tố>.md`) →
   sửa `resolveTaskFiles`. Khi nhiều tệp cùng khớp một mã task thì script **dừng**, không tự chọn.

## 3.12. Giá phát hành cấu hình được (BE-04)

Giá phát hành WPT tồn tại ở **HAI nơi**, và đó là sự thật phải hiểu trước khi sửa bất cứ gì trong
mục này:

| Nơi | Ai đọc | Dùng để |
|---|---|---|
| Cơ sở dữ liệu (`SystemConfig`) | `readIssuePriceVnd()`, `getIssuePrice()` | **HIỂN THỊ** cho nhà đầu tư |
| Ledger (`state().wptPriceVnd` ở mock, contract khớp lệnh ở chuỗi thật) | `quotePurchase`, `executePurchase` | **TRỪ TIỀN** |

Hai con số lệch nhau thì nhà đầu tư **thấy một giá và bị trừ theo giá khác**, và không phép kiểm
nào ở tầng nghiệp vụ bắt được — cả hai đều đúng so với nguồn của chúng. Đây là rủi ro chính của
BE-04, nên ba cơ chế dưới đây tồn tại chỉ để chặn nó.

**1. Thứ tự trong `setIssuePrice`: đẩy xuống ledger TRƯỚC, ghi cơ sở dữ liệu SAU.**

```
validate Zod
  → assertCanConfigure(role)          hai lớp: treasury:manage RỒI isConfig
  → kiểm ngưỡng đổi giá               (trước khi chạm ledger)
  → ledger.setPurchasePrice(giá mới)  ★ BƯỚC 1 — thất bại thì CSDL không đổi gì
  → configStore.setConfig(...)        ★ BƯỚC 2 — giá + dòng lịch sử, nguyên khối
       └─ thất bại → ledger.setPurchasePrice(giá CŨ)   hoàn nguyên
```

Không có transaction nào bao được cả một lời gọi on-chain và một câu lệnh SQL, nên việc duy nhất
làm được là **chọn thứ tự mà hỏng giữa đường vẫn để lại trạng thái giải thích được**. Thứ tự ngược
lại cho ra trạng thái tệ hơn cả lúc chưa có `setPurchasePrice`: người dùng nhận thông báo thất bại
và tin rằng không có gì đã đổi, trong khi ledger đã bán theo giá mới.

⚠️ Ca kiểm giữ thứ tự này là **`test/config-service.test.ts` đột biến 1**. Mọi ca đường thuận vẫn
xanh nếu ai đảo thứ tự — hai nguồn vẫn khớp khi không có lỗi. Đừng xoá ca đó.

**2. Ngưỡng đổi giá là HỆ SỐ, và phép so dùng phép NHÂN.**

`WPT_PRICE_CHANGE_THRESHOLD = 2`: giá mới quá gấp đôi hoặc dưới một nửa giá đang có hiệu lực thì bị
từ chối, trừ khi người gọi truyền `confirmLargeChange: true`. Ngưỡng này **không** nhằm chặn biến
động (giá phát hành không dao động theo thị trường) mà nhằm chặn **lỗi đánh máy** — thừa hoặc thiếu
một chữ số 0.

So bằng phép nhân, **không** phép chia: `priceVnd` và giá cũ là `bigint`, và chia `bigint` lấy phần
nguyên nên `150000n / 100000n === 1n` — mọi mức lệch dưới hai lần bị làm tròn thành "không lệch", và
phép kiểm mất tác dụng ở đúng vùng nó cần đo.

**3. Ledger mô phỏng nạp giá từ cấu hình, và việc đó nằm ở FACTORY.**

State của mock nằm trên `globalThis` nên mất khi tiến trình khởi động lại, còn giá đã cấu hình thì
nằm trong cơ sở dữ liệu và vẫn còn. Không nạp lại thì sau restart mock khớp lệnh theo **giá mặc
định** trong khi màn hình hiện giá đã cấu hình.

`getLedger(chain)` truyền `readInitialPrice: readIssuePriceVnd` vào `createMockLedger`. Đặt ở factory
chứ không trong `mock.adapter.ts` vì mock là **tầng cổng**: cho nó nhập `lib/store` là để tầng cổng
phụ thuộc tầng lưu trữ, và khi đó `createMockLedger` không dựng được trong test mà không có cơ sở dữ
liệu. Truyền **hàm** chứ không giá trị vì `getLedger` là hàm đồng bộ và đang được gọi ở hàng chục chỗ.

Mock nạp **một lần cho mỗi vòng đời state** (cờ `priceHydrated`), không đọc lại mỗi lần gọi: đọc lại
sẽ biến cơ sở dữ liệu thành nguồn giá thứ hai bên cạnh `state().wptPriceVnd`, và khi đó
`setPurchasePrice` mất tác dụng — đúng thứ mà bước 1 ở trên dựa vào.

**Lưu ý khi phát triển:**

- **`WPT_ISSUE_PRICE_VND` không còn là giá đang có hiệu lực.** Nó là giá mặc định khi bảng trống.
  Dùng nó để hiển thị là hiển thị sai ngay sau lần đổi giá đầu tiên.
- **Không đệm giá xuyên yêu cầu.** `readIssuePriceVnd()` cố ý không có lớp đệm: đổi giá phải có hiệu
  lực ở yêu cầu tiếp theo.
- **`vndAmount` của lệnh đã đặt KHÔNG tính lại theo giá mới.** Nhà đầu tư trả đúng giá đã thấy lúc
  bấm; ca kiểm là `test/config-service.test.ts` ca 3.
- **Trong test, đừng gõ lại con số giá.** Đọc từ `WPT_ISSUE_PRICE_VND` rồi suy ra. Ca 5 của BE-04
  (đổi giá mặc định, toàn bộ test vẫn xanh) đã bắt được **5 chỗ** gõ cứng mà mắt thường không thấy —
  trong đó ba ca dùng một số tuyệt đối làm "thiếu tiền", và ở giá nhỏ nó thành **dư** tiền nên tình
  huống mà ca kiểm cần dựng đã bốc hơi.

## 3.13. Tham số hệ thống — bảng khoá và cách thêm khoá mới

Bốn khoá trong `SystemConfig`, khai ở `CONFIG_KEYS` (`lib/config/issue-terms.ts`):

| Khoá | Kiểu | Mặc định trong mã | Nạp sẵn? | Đọc bằng |
|---|---|---|---|---|
| `wpt.issue_price_vnd` | `bigint` | `WPT_ISSUE_PRICE_VND` = 100.000 | có | `readIssuePriceVnd()` |
| `wpt.price_change_threshold` | `number` | `WPT_PRICE_CHANGE_THRESHOLD` = 2 | có | `readPriceChangeThreshold()` |
| `distribution.batch_size` | `number` | `DISTRIBUTION_BATCH_SIZE` = 50 | có | `readDistributionBatchSize()` |
| `distribution.dust_wallet` | `string` | **không có** | **không** | `readDistributionDustWallet()` |

**Thêm khoá mới đụng đúng hai tệp:** hằng số mặc định + một dòng ở `CONFIG_KEYS` trong
`lib/config/issue-terms.ts`, và một hàm `readXxx()` ở `lib/store/config-values.ts`. Đừng gọi
`getConfigStore().getConfig(...)` rải rác ở tầng nghiệp vụ: nhánh lùi về mặc định viết ở hai nơi sẽ
lệch nhau, và lệch ở đúng nhánh ít được chạy nhất.

⚠️ **`issue-terms.ts` không có `import` nào và không có `import 'server-only'` — đừng "dọn".** Tệp lá
thì không tạo được vòng phụ thuộc, và điều đó quan trọng vì `mock.adapter.ts` dùng hằng số này ở phạm
vi module, đúng lúc module đang khởi tạo — nơi một vòng phụ thuộc cho ra giá `undefined` và biến khớp
lệnh thành "mua không mất tiền". Không `server-only` vì đây là hằng số hiển thị được, chặn nó ở phía
client sẽ chặn luôn `wptToVnd`.

**Giá trị lạ trong bảng thì lùi về mặc định, không ném lỗi** — nhưng phải có chặn trên/chặn dưới.
`readDistributionBatchSize()` chỉ nhận số nguyên trong `[1, DISTRIBUTION_BATCH_SIZE_MAX]`: giá trị `0`
hoặc `NaN` làm vòng chia lô **không sinh ra lô nào**, nên hàm chạy xong, báo thành công, và không ai
được chia đồng nào; còn số quá lớn thì lô vượt giới hạn gas và thất bại **sau** khi đã tốn phí.

⚠️ **`DISTRIBUTION_BATCH_SIZE_MAX` và `MAX_BULK_ROWS` là hai giới hạn khác nhau, đừng gộp.** Cái đầu
chặn số ví một **giao dịch on-chain** mang được; cái sau (`lib/store/store.errors.ts`, 1000) chặn số
dòng một câu **`INSERT`** mang được. `distributePeriod` dùng cả hai, ở hai vòng lặp khác nhau. Gộp
thành một hằng số là buộc chúng phải đổi cùng nhau trong khi chúng không liên quan gì tới nhau.

**`distribution.dust_wallet` cố ý không có mặc định và không nạp sẵn.** Mọi địa chỉ đặt sẵn đều là ví
thật của một ai đó, nên một mặc định là lệnh chuyển tiền tới ví mà không ai chọn. Chưa cấu hình thì
phần dư nằm yên trong ví lợi nhuận — trạng thái duy nhất không cần ai quyết. Hàm đọc trả về **nguyên
văn** chuỗi trong bảng, không chuẩn hoá: chuẩn hoá địa chỉ là việc của biên `lib/ledger/address.ts`, và
làm ở đây sẽ hỏng với địa chỉ Stellar (base32 **chữ hoa**).

---

# PHẦN 4. BẢN ĐỒ LUỒNG

## 4.1. Luồng MINT LẺ (đã hoàn thành — P1)

⚠️ **Đây là ĐƯỜNG NỀN CHO BẢN TRÌNH DIỄN, không phải luồng phát hành chính.** Nó mint thẳng cho
từng ví nên làm **phình tổng cung** mỗi lần gọi — thứ mà mô hình đã chốt cấm. Luồng chính là phát
hành một lần vào ví SPV, xem **4.3**. Giữ lại vì đây là đường ngắn nhất để trình diễn "ví có token"
mà không cần dựng trước ví SPV, VNDB và uỷ quyền. BE-04 đổi tên hàm từ `mintTokens` thành
`mintToInvestorDirect` chính là để cái tên nói ra điều đó.

**Hai lối vào, một điểm hội tụ:** UI dùng Server Action, demo runner và e2e dùng `POST /api/mint`. Cả hai gọi cùng `mintToInvestorDirect()` nên guard không thể bị bỏ sót.

```
components/pages/mint.tsx
   └─ mintAction() ──→ app/actions/bank.ts        (hoặc app/api/mint/route.ts)
         └─────────────→ lib/bank/mint.service.ts :: mintToInvestorDirect()
```

**Bên trong `mintToInvestorDirect()`:**

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

## 4.2. Luồng MUA WPT (đã hoàn thành — BE-02, mở rộng ở BE-03)

**Nghiệp vụ:** nhà đầu tư xem trước xem mình đủ điều kiện chưa; đặt lệnh mua; hệ thống kiểm số
dư VNDB, ủy quyền và tồn WPT; nếu đạt thì chuyển VNDB (nhà đầu tư → ví thanh toán SPV) và chuyển
WPT (ví SPV → nhà đầu tư) trong **cùng một** giao dịch.

**Ai ký:** ví **ngân hàng/SPV** qua `getBankSigner(chain)`, không phải ví nhà đầu tư — khác
hẳn luồng REDEEM ở 4.3. Nhà đầu tư chỉ tham gia bằng một lần `approve` VNDB **trước đó**, từ
ví của họ, ngoài phạm vi BE-02.

**Hai lối vào, một điểm hội tụ:** UI dùng Server Action, demo và e2e dùng `POST /api/purchase`
(phân nhánh đặt/khớp bằng sự có mặt của `orderId`). Cả hai gọi cùng service nên guard không
thể bị bỏ sót — **không** có kiểm quyền nào ở hai tệp transport.

```
(FE-05/FE-06, chưa xây)
   └─ previewPurchaseAction()                    ──→ app/actions/purchase.ts
   └─ placeOrderAction() / executeOrderAction() ──→ app/actions/purchase.ts
                                                     (hoặc app/api/purchase/route.ts)
         └──────────────────────────────────────────→ lib/bank/purchase.service.ts
```

⚠️ **`previewPurchase` KHÔNG có đường HTTP thứ hai.** `app/api/purchase/route.ts` chỉ phục vụ
đặt/khớp/xem sổ lệnh cho kịch bản demo và e2e. Thêm một nhánh xem trước vào đó không sai về
nguyên tắc, nhưng chưa ai cần nên chưa làm — mỗi điểm vào HTTP là một thứ phải giữ đồng bộ.

**Sơ đồ sinh từ mã nguồn: `docs/flows/purchase.md`** (Mermaid, sinh bằng
`node scripts/gen-flow-diagram.mjs purchase` từ marker `@flow` — xem 3.10). Nó nói được thứ mục
này không nói: điểm cắm `@pending` nằm trên đúng hàm nào, và dừng ở đâu vì chưa có contract.

⚠️ **Hai hệ đánh số bước, KHÔNG so được với nhau — đừng đọc chéo bằng số bước.** Bảng "Giai đoạn
1/2" dưới đây đánh số **các bước bên trong một hàm** (bước 6 của Giai đoạn 1 là lời gọi
`quotePurchase` *trong* `placeOrder`). Marker `@flow` đánh số **các hàm** trên đường đi
(`purchase:5` là chính `quotePurchase`, một ô riêng của sơ đồ). Hai hệ cắt lát ở hai độ mịn khác
nhau nên "bước 5" ở hai chỗ là hai thứ khác nhau; đối chiếu phải làm bằng **tên hàm**, không bằng
số. Sơ đồ cũng **cố ý nói ít hơn** mục này: một chuỗi số nguyên không biểu diễn được nhánh phụ,
đường về, hay lựa chọn adapter lúc chạy.

### Giai đoạn 0 — xem trước điều kiện: `previewPurchase()` (BE-03)

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `bank/schemas.ts` → `previewPurchaseSchema.safeParse` | **Cùng schema với đặt lệnh**, nên không thể "xem trước nói hợp lệ, đặt lệnh từ chối vì sai dạng" |
| 2 | `rbac/session.ts :: currentRole()` → `rbac/can.ts :: assertCan()` | Quyền `order:place`. **Không** đi qua `authorize()` — xem cảnh báo dưới |
| 3 | `purchase.service :: runPurchaseChecks()` | **Đúng** bộ kiểm mà `executeOrder` chạy, chỉ khác là không truyền `vndAmount` đã chốt nên phép kiểm giá không chạy |
| 4 | `bank/result.ts` | `Result<PurchasePreviewView>`: `vndAmount`, `canPlaceOrder`, `blockers`, và `checks` — từng phép kiểm kèm `reason` / `howToFix` / `actual` / `required` |

⚠️ **Hàm này KHÔNG ghi một dòng nào vào cơ sở dữ liệu, kể cả sổ kiểm toán.** Đó là lý do nó dùng
`assertCan` thay vì `authorize()`: `authorize()` ghi một bản ghi cho **mỗi** lời gọi, mà FE-05 gọi
hàm này sau mỗi ký tự người dùng gõ vào ô số lượng — dùng `authorize()` sẽ đổ hàng chục bản ghi
"đã cho phép xem" cho một lần mua và làm sổ kiểm toán không còn dùng được để đối chiếu trách
nhiệm. LUẬT #3 vẫn giữ: quyền đi qua RBAC, không so tên vai. **Hệ quả phải biết:** một lần xem
trước **bị chặn** cũng không để lại dấu vết; câu hỏi mở về việc này ở `docs/CHECKPOINT_BE03.md`.

**`checks` là DANH SÁCH, không phải đối tượng có đủ năm khoá, và đó là chủ đích.** Bộ kiểm dừng ở
phép trượt đầu tiên, nên phép nằm sau nó **vắng mặt** — vắng nghĩa là "chưa kiểm", khác hẳn
`ok: true`. Một đối tượng đủ khoá sẽ buộc phải điền giá trị cho phép kiểm chưa chạy, và mọi giá
trị điền vào đó đều là nói sai. Vì dừng sớm nên `blockers` có **nhiều nhất một** phần tử; nó vẫn
là mảng để giao diện không phải viết lại khi thứ tự kiểm thay đổi.

**Vì sao không chạy hết cả năm phép rồi báo tất cả:** `canTransfer` kiểm lại cả số dư WPT của ví
SPV, nên chạy hết sẽ báo **hai** blocker (`supply` và `transferable`) cho **một** nguyên nhân. Thứ
tự kiểm cũng là thứ tự người dùng sửa được, nên báo một việc phải làm tại một thời điểm là đúng
hơn, không phải là nói thiếu.

### Giai đoạn 1 — đặt lệnh: `placeOrder()`

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `bank/schemas.ts` → `placeOrderSchema.safeParse` | Validate ví; `wptAmount` chuỗi → `bigint`, > 0 |
| 2 | `bank/authorize.ts` → `rbac/can.ts` → `permissions.ts` | `authorize('order:place')` — quyền của **INVESTOR** |
| 3 | `getStore() :: appendAudit()` | Ghi audit ALLOWED / DENIED |
| 4 | `ledger/index.ts :: getLedger(chain)` | Chọn adapter |
| 5 | `purchase.service :: runPurchaseChecks()` | **BE-03.** Không đạt → **không tạo bản ghi**, ghi audit FAILURE, trả đúng mã lỗi của phép kiểm trượt |
| 6 | `ledger :: quotePurchase(wptAmount)` *(bên trong bước 5)* | **Chốt** số VNDB phải trả tại thời điểm đặt |
| 7 | `getOrderStore() :: createOrder()` | Lưu lệnh ở `PLACED`, kèm `vndAmount` đã chốt |
| 8 | `getStore() :: appendAudit()` | Bản ghi SUCCESS |
| 9 | `bank/result.ts` | Trả `Result<OrderView>`, mọi con số dạng **chuỗi** |

Bước 6 là QĐ-3 của BE-02: số VNDB **không** được tính lại khi khớp. Tính lại là âm thầm thu
một số khác với số đã báo trên màn hình lúc bấm — sai về nghiệp vụ, không phải chuyện làm tròn.
Báo giá chỉ gọi **một lần**, lấy từ giá trị `runPurchaseChecks` trả ra: gọi `quotePurchase` thêm
lần nữa ở bước 7 là mở cửa cho lệnh được lưu theo một giá còn phép kiểm chạy theo giá kia.

⚠️ **Bước 5 là ĐỔI HÀNH VI so với BE-02 — đọc trước khi sửa test cũ.** Trước BE-03, một lệnh
thiếu điều kiện vẫn được **lưu** rồi chuyển `REJECTED` ở một lần gọi `executeOrder` khác. Nay nó
không vào sổ lệnh nữa. Hai hệ quả:

- Trạng thái "có lệnh trong sổ **và** `spvWallet()` trả `null`" thành **không thể đạt**: lệnh chỉ
  tồn tại khi đã phát hành nguồn cung, mà nguồn cung phát hành rồi thì không thu lại được. Ca kiểm
  thử tương ứng đã chuyển từ `executeOrder` sang `placeOrder`.
- Muốn dựng một lệnh bị `REJECTED` lúc khớp thì phải đặt lệnh khi **đủ** điều kiện rồi hạ điều
  kiện xuống — đúng tình huống có thật ngoài đời, và là cách `app/test/purchase-service.test.ts`
  đang làm (bảng `DEGRADATIONS`).

`executeOrder` **vẫn kiểm lại** toàn bộ. Kiểm ở `placeOrder` không thay thế được: điều kiện đổi
được giữa lúc đặt và lúc khớp, và đó chính là ba tình huống trong bảng `DEGRADATIONS`.

### Giai đoạn 2 — khớp lệnh: `executeOrder()`

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `getOrderStore() :: findOrder()` + `purchase.state.ts :: EXECUTABLE_ORDER_STATUSES` | Lệnh phải ở `PLACED` hoặc `CHECKING`, và đúng chain đã đặt |
| 2 | `bank/authorize.ts` | `authorize('order:execute')` — quyền của **BANK_ADMIN**, tách khỏi `order:place` |
| 3 | `orderStore :: transitionOrder(PLACED → CHECKING)` | Đã ở `CHECKING` thì giữ nguyên (tiến trình trước chết, chưa gửi gì) |
| 4 | `purchase.service :: runPurchaseChecks()` | Kiểm giá (QĐ-3) rồi **bốn phép đọc** — xem bảng dưới. Lấy phép trượt **đầu tiên** trong danh sách trả về |
| 5 | `orderStore :: transitionOrder(CHECKING → EXECUTING)` | **Cập nhật có điều kiện.** `null` = tiến trình khác đã chiếm → **dừng, không gửi** |
| 6 | `ledger :: executePurchase(investor, wptAmount)` | VNDB và WPT trong **cùng một** giao dịch |
| 7 | `orderStore :: attachOrderTxHash()` + `txnStore :: saveTxn()` | Lưu mã giao dịch **ngay khi có**, trước khi chờ |
| 8 | `ledger :: waitReceipt(txHash, receiptTimeoutFor(chain))` | 30s hardhat-local/mock, 90s Sepolia |
| 9 | `orderStore :: transitionOrder(→ COMPLETED \| FAILED)` + `txnStore :: appendAudit()` | Vai ghi sổ là vai **đang khớp** |
| 10 | `ledger :: balanceOf(investor)` | **Đọc lại số dư WPT từ chuỗi**, không tin biên nhận |
| 11 | `bank/result.ts` | Trả `Result<OrderExecutionView>` |

**Bốn phép kiểm ở bước 4** (QĐ-2), dừng ở lần trượt đầu tiên, tất cả đều là hàm **đọc** nên
không tốn phí:

| # | `id` của phép kiểm | Lời gọi | Trượt thì trả mã |
|---|---|---|---|
| 0 | `price` | `quotePurchase()` so với `vndAmount` đã chốt | `PRICE_CHANGED` |
| 1 | `paymentBalance` | `paymentBalanceOf(investor)` | `INSUFFICIENT_PAYMENT_BALANCE` |
| 2 | `allowance` | `paymentAllowanceOf(investor)` | `INSUFFICIENT_ALLOWANCE` |
| 3 | `supply` | `spvWallet()` → `balanceOf(spv)` | `INSUFFICIENT_SUPPLY` |
| 4 | `transferable` | `canTransfer(spv, investor, wptAmount)` | `LEDGER` |

Thứ tự là thứ tự người dùng sửa được: có tiền chưa → đã cho phép trừ chưa → còn hàng không →
chuyển được không. Trả lời "chưa cấp ủy quyền" cho người chưa có tiền là chỉ sai việc phải làm.
Phép kiểm giá chạy **trước** cả bốn vì cả bốn đều so với `vndAmount` đã chốt.

**`runPurchaseChecks` nhận THAM SỐ THUẦN `{ investorWallet, wptAmount, quotedVndAmount? }`, không
nhận `OrderRecord`** (đổi ở BE-03). Nhận `OrderRecord` thì phải có lệnh trong cơ sở dữ liệu mới
kiểm được, tức nhà đầu tư chỉ biết mình thiếu gì **sau** khi lệnh đã bị từ chối. Tham số thuần cho
ba đường gọi — xem trước, đặt lệnh, khớp lệnh — dùng **đúng một** bộ kiểm.

**Phép kiểm `price` CHỈ chạy khi có `quotedVndAmount`**, tức chỉ ở `executeOrder`. Xem trước và đặt
lệnh chưa có giá cũ để so, nên bỏ phép kiểm đó là đúng chứ không phải nới tay: so báo giá vừa lấy
với chính nó thì phép kiểm luôn đạt, tức một phép kiểm không nói gì. Khi `price` trượt thì hàm trả
về **ngay**, không chạy bốn phép còn lại — cả bốn đều so với một con số vừa được chứng minh là lạc
hậu. Đó là lý do `price` là **cổng**, không phải một phép kiểm ngang hàng.

**Một đường kiểm duy nhất là điều được test chốt lại.** `app/test/purchase-service.test.ts` có ba
ca dùng cùng dữ liệu vào cho cả xem trước và khớp lệnh, rồi so `code` **và** `reason` của hai bên.
Ai viết đường kiểm thứ hai thì ba ca đó đỏ.

**Vị trí bước 5 là điểm dễ sửa sai nhất của cả luồng.** Nó phải ở **sau** bốn phép kiểm và
**trước** lời gọi gửi giao dịch:

- Sau bốn phép kiểm, vì mọi lệnh trượt điều kiện mà đã chiếm `EXECUTING` thì không còn đường
  về `REJECTED` — lệnh sẽ bị đánh dấu là đã tốn phí trong khi chưa gửi gì.
- Trước khi gửi, vì đó là **toàn bộ** cơ chế chống gửi hai lần. Không có bước này thì hai lời
  gọi đồng thời cùng thấy điều kiện đạt và cùng gửi, nhà đầu tư bị trừ tiền hai lần.

### Giai đoạn 3 — truy vấn và dọn lệnh treo

| Hàm | Quyền | Ghi chú |
|---|---|---|
| `listOrders()` | `order:read`; bỏ trống bộ lọc ví cần thêm `order:read:all` | Vai không có `order:read:all` mà thiếu ví → **lỗi validate**, không phải trả toàn bộ sổ lệnh |
| `expireStaleOrders()` | `order:expire` (BANK_ADMIN) | Chỉ nhắm `PLACED`. **Không** dựng lịch ở đây — việc gọi định kỳ thuộc BE-07, và cố ý **không** mở điểm vào HTTP |

⚠️ **`expireStaleOrders` có ĐÚNG MỘT đường vào: BE-07 gọi thẳng service.** Từ MC-01 Bước 6 điều
này đúng trong mã, không chỉ trên giấy: `expireStaleOrdersAction` đã bị **xóa** theo quyết định
Owner. Trước đó câu "cố ý không mở điểm vào HTTP" ở dòng trên **mâu thuẫn với mã** — server
action cũng là một điểm vào HTTP, gọi được bằng POST trực tiếp chứ không chỉ qua giao diện. Vì
vậy `lib/bank/purchase.service.ts` có **năm** hàm mà `app/actions/purchase.ts` chỉ có **bốn**
action; đó là chủ đích, có ghi lý do ngay trong khối chú thích đầu tệp đó. Đừng "bổ sung cho
đủ bộ".

### Nợ đã biết của luồng này

Trên chain `evm`/`hardhat-local`, luồng mua **chưa chạy được**: `quotePurchase`,
`paymentAllowanceOf`, `executePurchase` và `spvWallet` đều ném `LedgerNotImplementedError` vì
hợp đồng khớp lệnh (SC-03) và hợp đồng phát hành một lần (SC-02) chưa có. Nghiệp vụ đã xong và
chạy đủ trên chain `mock`; nối chuỗi thật là việc của SC-02/SC-03, **không** phải sửa service.

`previewPurchase` thừa hưởng đúng giới hạn đó: nó gọi `quotePurchase` và `spvWallet`, nên trên
`evm`/`hardhat-local` nó trả `Result` mã `LEDGER` chứ không trả một bảng điều kiện. Đây là hành vi
đúng — báo "chưa nối chuỗi" tốt hơn là dựng một bảng điều kiện từ số liệu không có.

⚠️ **Xem trước KHÔNG bảo đảm lệnh sẽ khớp được.** Nó chạy đúng bộ kiểm mà khớp lệnh chạy, nên hai
bên không lệch nhau vì **logic**; nhưng điều kiện đổi được giữa hai thời điểm, nên chúng vẫn lệch
nhau vì **thời gian**. Đó là giới hạn thật của mọi màn hình xem trước, không phải lỗi cần vá. Đừng
"sửa" bằng cách giữ lại kết quả xem trước rồi tin nó lúc khớp.

---

## 4.3. Luồng PHÁT HÀNH NGUỒN CUNG (đã hoàn thành — BE-04)

> **Sơ đồ sinh tự động từ marker `@flow`: `docs/flows/issue.md` (9 bước).** Đừng sửa tay tệp đó —
> sửa marker trong mã rồi chạy `node scripts/gen-flow-diagram.mjs issue`.

**Nghiệp vụ:** phát hành **MỘT LẦN** toàn bộ nguồn cung WPT vào **ví thanh toán SPV**. Sau lần này,
WPT đến tay nhà đầu tư qua `executeOrder` (chuyển từ ví SPV) — **không mint thêm**.

```
app/actions/bank.ts :: issueInitialSupplyAction()        ← điểm cắm, chờ FE-07
   └──→ lib/bank/issuance.service.ts :: issueInitialSupply()
```

**Bên trong `issueInitialSupply()`:**

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `issueInitialSupplySchema.safeParse` | Ví SPV sai dạng → `VALIDATION`. **Không có trường số lượng** trong schema |
| 2 | `authorize('token:mint', ...)` | Vai không có quyền → `FORBIDDEN`, ghi audit `DENIED` |
| 3 | `projectStore.findProject({tokenSymbol, chain})` | Chưa có dự án trên chuỗi đang chọn → `VALIDATION` |
| 4 | `project.issuedAt !== null` | Đã phát hành → `ORDER_STATE`, **không gửi giao dịch** |
| 5 | `ledger.isInitialSupplyMinted()` | Chuỗi đã phát hành mà bảng chưa ghi mốc → `ORDER_STATE`, **đòi đối soát** |
| 6 | `ledger.mintInitialSupply(spvWallet, amount)` | `amount` = `project.totalSupply` |
| 7 | `store.saveTxn(...)` trạng thái chờ | **Trước** khi đợi biên nhận |
| 8 | `ledger.waitReceipt(...)` + `updateTxnStatus` | `FAILED` → `LEDGER`, **không** ghi `issuedAt` |
| 9 | `projectStore.markIssued(...)` | Khoá lạc quan; trả `null` → `ORDER_STATE` + audit `FAILURE` |
| 10 | `ledger.tokenInfo()` | Đọc lại tổng cung **từ chuỗi** làm sự thật cuối cùng |

**Ai ký:** ví ngân hàng (`getBankSigner(chain)`). Trên chuỗi `mock` không có gì để ký, nên
`actorAddress` của dòng giao dịch để `null` thay vì làm cả lượt phát hành thất bại — địa chỉ đó là
**dữ liệu đối soát**, không phải đầu vào của phép kiểm quyền nào.

**Hai chốt chặn quan trọng nhất:**

1. **Tổng cung KHÔNG đến từ input.** `issueInitialSupplySchema` cố ý không có trường số lượng; nhận
   nó từ input nghĩa là ai gọi được server action cũng đặt được quy mô phát hành của cả dự án. Ca
   kiểm: `test/issuance-service.test.ts` — truyền thêm `amount: '999'` phải bị **bỏ qua**.
2. **Chống phát hành hai lần bằng khoá lạc quan, không bằng "đọc rồi ghi".** Điều kiện
   `status = 'DRAFT' AND issuedAt IS NULL` nằm **trong** câu `UPDATE` của `markIssued`. Đọc `issuedAt`
   rồi mới ghi thì hai lời gọi đồng thời đều thấy `null`, đều kết luận "chưa phát hành", rồi cùng gửi
   giao dịch mint — **nguồn cung ra gấp đôi con số đã công bố**, và không sửa được vì token đã ở trong
   ví người khác.

**Nợ đã biết của luồng này:** `evm.adapter` chưa nối được ba method `mintInitialSupply`,
`isInitialSupplyMinted`, `spvWallet` — chờ **SC-02** (contract phát hành một lần). Trên chuỗi thật
luồng này chưa chạy; trên `mock` đã chạy đầu cuối. Xem bảng điểm cắm ở 3.10.

---

## 4.4. Luồng REDEEM — hoàn vốn (P2, chưa xây)

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
| 8 | `store/` | `saveTxn` PENDING → `waitReceipt` → cập nhật. Nếu làm theo mô hình **đợt tất toán do ngân hàng điều phối** thì dùng `getSettlementStore()` của BE-09 (bốn trạng thái, duy nhất `(roundId, holderWallet)`) — xem câu hỏi mở trong `docs/CHECKPOINT_BE09.md` về việc hai mô hình `redeem` và `settlement` đang cùng tồn tại |
| 9 | `bank/result.ts` | Mã lỗi mới: `INSUFFICIENT_LIQUIDITY`, `REDEMPTION_PAUSED`, `NOT_WHITELISTED` |

**Điều kiện `Redemption.redeem()` yêu cầu (phải phản ánh đủ ở UI và mock):**
- Không ở trạng thái `paused`
- `wptAmount > 0`
- Người gọi **đã whitelist**
- Quỹ hợp đồng đủ VNDB: `payoutToken.balanceOf(this) >= quote(wptAmount)`

**Việc của ngân hàng trước đó:** gọi `fund()` nạp thanh khoản VNDB, `setRate()` đặt tỷ giá (đều cần `MANAGER_ROLE`).

**Lưu ý mở rộng:** nên thêm màn hình quản trị thanh khoản ở kênh `(admin)` (xem quỹ, nạp thêm, tạm dừng) — vì `redeem` sẽ fail hàng loạt nếu hết VNDB.

---

## 4.5. Luồng DISTRIBUTION — chia lợi nhuận (BE-06 ✅ tầng BE, chạy đủ trên `mock`)

> Sơ đồ sinh từ marker: **`docs/flows/distribute.md`** (10 bước). Đừng sửa tay tệp đó.
> ⚠️ Số bước `@flow` đánh số **các hàm** trên đường đi; bảng trong mục này đánh số **các bước bên
> trong một hàm**. Hai hệ đánh số khác nhau, đọc chéo bằng số bước sẽ ra kết luận sai.

**Nghiệp vụ:** SPV nạp VNDB vào ví chia lợi nhuận → ngân hàng chốt quyền tại một thời điểm → toàn bộ
số dư ví đó chia cho người nắm giữ WPT **theo tỷ lệ tại thời điểm chốt**.

**Trạng thái:** tầng nghiệp vụ xong đầu cuối và chạy đủ trên chain `mock` (`test/distribution-service.test.ts`,
43 ca). Trên `evm` còn chờ contract — `distributeBatch` của `evm.adapter` vẫn ném
`LedgerNotImplementedError`, xem bảng ở 3.10. **Chưa có giao diện** (FE-08, FE-09) và **chưa có tiến
trình định kỳ** (BE-07); cả ba đều có điểm cắm `@pending` trỏ tới.

### Hai điều quyết định toàn bộ thiết kế

**1. Chuỗi KHÔNG liệt kê được người nắm giữ.** ERC-20 chỉ lưu bảng số dư theo địa chỉ, không lưu
danh sách địa chỉ, nên `ILedgerPort` **cố ý không có** `holdersAt`. `collectRecipients()` dựng danh
sách từ cơ sở dữ liệu: ví có lệnh mua ở `COMPLETED`, **cộng** ví đã có hồ sơ chia ở kỳ trước của cùng
chuỗi. Nguồn thứ hai là cần thiết vì WPT còn tới tay một ví qua `transfer`, và ví đó không có lệnh
mua nào. Về sau nguồn này chuyển sang Indexer, và khi đó **chỉ** `collectRecipients` phải sửa.

**2. Số tiền từng ví do CHUỖI tính, service tính lại cùng công thức để ghi sổ.** `distributeBatch`
tự tính `distributable × balanceOfAt / totalSupplyAt` và tự chống chia hai lần bằng cờ đã-nhận của
từng ảnh chụp. Hai bên lệch một đồng là sổ nói một số còn ví nhà đầu tư nhận số khác, và **không
phép kiểm nào bắt được** vì cả hai đều đúng so với nguồn của chúng. Vì vậy `shareOf()` phải
**nhân trước, chia sau** — `bigint` chia lấy phần nguyên, nên `balanceAt / totalSupplyAt` cho ra `0`
với mọi ví nắm dưới toàn bộ tổng cung và **mọi người được chia 0** trong im lặng.

### Giai đoạn 1 — chốt quyền: `openPeriod()`

```
openPeriodAction(input) ──→ lib/bank/distribution.service.ts :: openPeriod()
```

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `openPeriodSchema.safeParse` | mã kỳ rỗng / quá 40 ký tự / có ký tự ngoài `[A-Za-z0-9._-]` |
| 2 | `authorize('distribution:snapshot', ...)` | vai không có quyền → `FORBIDDEN`, ghi audit `DENIED` |
| 3 | `findPeriodByKey(periodKey)` | mã kỳ đã dùng → `PERIOD_STATE` |
| 4 | `ledger.profitPoolBalance()` | quỹ bằng 0 → `INSUFFICIENT_PROFIT_POOL` |
| 5 | `ledger.takeSnapshot()` | ★ **lần ghi đầu tiên lên chuỗi**; `snapshotId` lấy từ sự kiện trong biên nhận |
| 6 | `profitPoolBalance()` **lần hai**, so với bước 4 | quỹ đổi giữa lúc chốt → `PERIOD_STATE`, ảnh chụp bỏ không |
| 7 | `ledger.totalSupplyAt(snapshotId)` | bằng 0 → `NO_CIRCULATING_SUPPLY` |
| 8 | `distributionStore.openPeriod(...)` | `UniqueConstraintError` → `PERIOD_STATE` |

**Ba phép kiểm đầu chạy TRƯỚC `takeSnapshot`, và đó là một quyết định, không phải thứ tự tình cờ.**
`takeSnapshot` là lần ghi lên chuỗi; một mã kỳ trùng hay quỹ rỗng không được tiêu một ảnh chụp.
`test/distribution-service.test.ts` chốt việc này bằng cách gọi `balanceOfAt(_, 1)` sau mỗi lần từ
chối và đòi nó **ném lỗi** — đảo thứ tự thì ca "vẫn từ chối, vẫn không tạo kỳ" vẫn xanh, chỉ phép
kiểm đó đỏ.

**Bước 6 bù cho một giới hạn của cổng.** Contract chốt số tiền chia được **ngay tại** lời gọi chụp
ảnh, và `ILedgerPort` không có hàm đọc lại con số đã chốt. Nên `totalAmount` ghi vào kỳ là số đọc
được **trước** khi chụp, và nó chỉ đúng khi quỹ không đổi giữa hai thời điểm. Đọc lại rồi so là cách
duy nhất phát hiện được; lệch thì **từ chối mở kỳ**, vì ghi một `totalAmount` khác con số contract đã
chốt làm **mọi** phần chia trong sổ sai lệch và không phép kiểm nào về sau bắt được. Cái giá là một
ảnh chụp bỏ không — rẻ hơn hẳn.

**Mã kỳ trùng bị chặn ở HAI chỗ, và hai chỗ trả lời hai câu hỏi khác nhau.** Lần đọc ở bước 3 tránh
tốn ảnh chụp; ràng buộc duy nhất `periodKey` ở bước 8 mới là thứ **bảo đảm** không có hai kỳ cùng mã,
vì hai tiến trình song song đều đọc thấy "chưa có" rồi cùng ghi. Bỏ ràng buộc và chỉ giữ lần đọc là
đúng cái sai mà doc của cổng cảnh báo.

### Giai đoạn 2 — xem trước: `previewDistribution()`

Chạy `collectRecipients()` rồi `allocate()` — **đúng hai hàm** mà `distributePeriod` sẽ dùng, không có
bản thứ hai. Trả về phân bổ từng ví, `allocated`, `dust`, `dustWallet`.

Hàm này **không ghi một dòng nào**, kể cả sổ kiểm toán: nó kiểm quyền bằng `assertCan`, không
`authorize`. Ví được chia 0 **vẫn có mặt** trong danh sách với `amount: "0"` — vắng mặt nghĩa là chưa
ai xét tới ví đó, còn `"0"` là kết luận đã xét và không được chia, và người đối soát cần phân biệt.

### Giai đoạn 3 — chia theo lô: `distributePeriod()`

| Bước | Việc | Ghi chú |
|---|---|---|
| 1 | `authorize('distribution:execute', ...)` | kỳ ở `COMPLETED` → `PERIOD_STATE`, không chia lần hai |
| 2 | `readDistributionBatchSize()` | khoá `distribution.batch_size`, mặc định 50 — xem 3.13 |
| 3 | `collectRecipients()` rồi `allocate()` cho ví **chưa có hồ sơ** | chạm giới hạn quét → từ chối |
| 4 | `createPayouts(...)` ở `PENDING`, chia theo `MAX_BULK_ROWS` | ★ **trước khi gửi giao dịch nào** |
| 5 | hồ sơ `amount = 0` → `PAID` luôn, không vào lô nào | chuyển 0 đồng tốn một chỗ trong lô mà không chuyển gì |
| 6 | kỳ `OPEN` → `DISTRIBUTING` | chỉ khi thật sự có lô để gửi |
| 7 | mỗi lô: `distributeBatch` → `SENT` + `txHash` → `waitReceipt` → `PAID` hoặc `FAILED` | lô lỗi **không** dừng các lô còn lại |
| 8 | hết hồ sơ khác `PAID` → kỳ `COMPLETED` + `completedAt` | `completedAt` do nghiệp vụ truyền, cổng không tự đặt |

```
PENDING ──► SENT ──► PAID
              └──► FAILED ──┐
   ▲                        │  gọi lại distributePeriod
   └────────────────────────┘  chỉ nhắm hồ sơ khác PAID
```

**`SENT` tách khỏi `PAID` là bắt buộc.** Giữa lúc gửi và lúc có biên nhận, hồ sơ đã có `txHash` mà
chưa biết kết quả. Gộp hai trạng thái thì một tiến trình chết giữa chừng để lại hồ sơ **trông như đã
chi xong**, và không lần chạy lại nào xét tới nó — tiền của người đó ở lại trong ví lợi nhuận vĩnh
viễn trong khi sổ nói đã trả.

**Chạy lại an toàn nhờ HAI lớp, và lớp quyết định nằm ở chuỗi.** Contract giữ cờ đã-nhận cho từng ảnh
chụp nên một ví đã nhận thì lời gọi sau bỏ qua nó; vì vậy gửi lại một lô mà ta không biết kết quả là
an toàn, và đó là lý do hồ sơ `SENT` được **gửi lại** thay vì bị bỏ mặc.

**Ai ký:** ví ngân hàng (`server.signer` qua `getLedger(chain)`), cả `takeSnapshot` và `distributeBatch`.
Nhà đầu tư không ký gì trong luồng này — đây là mô hình **push**, ngân hàng chia hộ.

### Phần dư làm tròn — giới hạn đã biết

Tổng các phần nguyên nhỏ hơn hoặc bằng tổng tiền, nên **không bao giờ chia vượt quỹ**. Phần cắt ra là
`dust`, và nó **nằm lại trong ví chia lợi nhuận**.

`distribution.dust_wallet` hiện chỉ **ghi nhận** đích của phần dư (trong `previewDistribution` và
trong bản ghi kiểm toán), **chưa chuyển thật**. Lý do: `distributeBatch` tự tính phần từng ví nên tầng
nghiệp vụ không có đường bảo nó trả thêm cho một ví, và hàm lấy phần dư ra — `sweepDust` của
`ProfitDistributor` — **chưa có trong `ILedgerPort`**. Cộng phần dư vào `amount` của ví chỉ định là
làm sổ ghi một số lớn hơn số chuỗi chuyển, loại lệch tệ nhất. Đã ghi thành câu hỏi mở ở
`docs/CHECKPOINT_BE06.md`.

### Còn thiếu để chạy trên chuỗi thật

| Việc | Chờ ai |
|---|---|
| `evm.adapter.distributeBatch` — chữ ký `distributeBatch(snapshotId, wallets)` **không mang mã kỳ**, nên adapter không tra được `distributionId` của `ProfitDistributor`. Hai đường xử lý ghi ngay trên marker `@blocked SC-05` ở `evm.adapter.ts` | **SC-05** (mã task mới, BE-06 đăng ký sau khi chẩn đoán) |
| Quyền on-chain: `ProfitDistributor` giữ `SNAPSHOT_ROLE` trên `ProjectToken`, người gọi giữ `DISTRIBUTOR_ROLE`; ngân hàng `approve` VNDB cho `ProfitDistributor` (contract dùng `safeTransferFrom`) | khâu triển khai — nguyên nhân lỗi phổ biến nhất |
| Chốt sản lượng từ `EnergyOracle` để suy ra số tiền chia | `providers/oracle/` chưa tạo; hiện tổng tiền lấy trực tiếp từ số dư ví lợi nhuận |
| Mô hình **pull** (`claim`, `claimMany`) để nhà đầu tư tự nhận và tự trả phí | chưa có ở `ILedgerPort`; BE-06 chỉ làm push |
| Giao diện mở kỳ / xem trước / chia, và màn theo dõi kỳ | FE-08, FE-09 |
| Gọi theo lịch | BE-07 |

---

## 4.6. Chu kỳ nghiệp vụ đầy đủ

Tham chiếu `packages/contracts-evm/scripts/demo-cycle.js` — kịch bản đã chạy được ở tầng contract:

```
1. KYC + whitelist nhà đầu tư A, B
2. Ngân hàng mint WPT: A = 6.000, B = 4.000            → luồng MINT (P1 ✅)
2'. (hoặc) A, B đặt lệnh mua rồi ngân hàng khớp lệnh   → luồng MUA WPT (BE-02 ✅ trên mock)
3. Chốt kỳ Q1, nạp 300.000.000 VNDB lợi nhuận
   openPeriod → takeSnapshot → distributePeriod         → luồng DISTRIBUTION (BE-06 ✅ trên mock)
4. Ngân hàng chia hộ theo lô (mô hình push)
   Mô hình pull (A tự claim) chưa có ở ILedgerPort
5. A redeem 1.000 WPT → nhận VNDB, WPT bị đốt          → luồng REDEEM (P2)
```

Đây là thứ tự triển khai được khuyến nghị, và cũng là kịch bản demo cho lãnh đạo.

---

## 4.7. Lộ trình phase

| Phase | Nội dung | Trạng thái |
|---|---|---|
| P0 | Nền: cây thư mục, compose, deploy contract, `ILedgerPort` | ✅ Xong |
| P1 | **MINT** end-to-end | ✅ Xong |
| — | Dọn giao diện sang chủ đề điện gió | ✅ Xong |
| — | FE-01 v2 kênh nhà đầu tư + trang tổng quan | ✅ Xong |
| — | BE-01 mở rộng `ILedgerPort` cho ba luồng (`mock` đủ 16/16, `evm` còn **11** method chờ contract/quyết định) | ✅ Xong |
| — | FE-02 màn kết nối ví (`/wallet`, tám trạng thái, `canSign` dùng chung) | ✅ Xong |
| — | BE-02 nghiệp vụ lệnh mua WPT (`purchase.service` + mô hình trạng thái; chạy đủ trên `mock`, chờ SC-02/SC-03 cho `evm`) | ✅ Xong |
| — | MC-01 cơ chế điểm cắm: marker + script quét + sơ đồ luồng sinh từ mã + dọn phụ thuộc (xem 3.10) | ✅ Xong — PR #21 |
| — | BE-03 xem trước điều kiện mua WPT + `placeOrder` chặn lệnh rác (xem 4.2) | ✅ Xong — PR #23 |
| — | MC-02 khuôn checkpoint + máy kiểm `check-checkpoint.mjs` (xem 3.11) | ✅ Xong — PR #22 |
| — | BE-04 giá phát hành cấu hình được + phát hành nguồn cung một lần (xem 3.12, 4.3) | ✅ Xong — PR #25 |
| — | BE-06 nghiệp vụ chia lợi nhuận: chốt quyền, xem trước, chia theo lô, chạy lại (xem 4.5) | 🔶 Mã xong trên nhánh `feat/distribution-service`, **chưa nghiệm thu, chưa merge vào `dev`** |
| P2 | **REDEEM** (`Redemption.sol`) — BE-05 tất toán | ⏳ Kế tiếp |
| P3 | **DISTRIBUTION** trên chuỗi thật: `evm.adapter.distributeBatch` + `EnergyOracle` | ⏳ Tầng BE đã xong ở BE-06; còn chờ SC-03 và `providers/oracle/` |
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

# Ký hiệu token cũ không được còn sót (phải rỗng).
# KHÔNG quét docs/ (tài liệu lịch sử nhắc ký hiệu cũ có chủ đích) và KHÔNG dùng -i
# (làm tVND khớp định danh hợp lệ profitVndBn). Lý do đầy đủ: tech-report-maintenance.md mục 0.
grep -rnoE "\bSPT\b|tVND" app/src/ app/e2e/ app/test/ packages/ | grep -v node_modules | grep -v target/

# Marker điểm cắm và tài liệu sinh từ marker (xem 3.10)
node scripts/scan-pending.mjs                  # bảng điểm cắm cho người đọc
node scripts/scan-pending.mjs --check          # đỏ khi marker sai/lạc hậu, KHÔNG đỏ vì còn điểm cắm
node scripts/gen-flow-diagram.mjs --check      # docs/flows/*.md còn khớp marker @flow
node scripts/scan-pending.mjs --check-report   # mục 3.10 còn khớp marker

# Khuôn checkpoint (xem 3.11)
node scripts/check-checkpoint.mjs --in-progress            # task đang làm; không có task thì bỏ qua
node scripts/check-checkpoint.mjs <checkpoint> <requirements>   # một tệp cụ thể

# Kiểm thử
cd app && npm run typecheck && npx eslint . && npm test && npm run test:e2e
cd packages/contracts-evm && npx hardhat test

# Hoặc chạy cả bộ (đã bao gồm mọi lệnh trên trừ e2e)
bash scripts/run-local-all.sh
```
