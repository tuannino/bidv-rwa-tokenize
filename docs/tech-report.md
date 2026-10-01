---
inclusion: always
---

# BÁO CÁO CÔNG NGHỆ — BIDV RWA TOKENIZE (TOKEN HÓA DỰ ÁN ĐIỆN GIÓ)

> **Tài liệu sống.** Kiro bắt buộc cập nhật file này sau mỗi thay đổi mã nguồn, theo quy tắc trong `docs/tech-report-maintenance.md`.
> Đây là nguồn tham chiếu đầu tiên cho dev mới tiếp nhận source.

| Trường | Giá trị |
|---|---|
| Phiên bản tài liệu | 2.7 |
| Cập nhật lần cuối | 2026-10-01 |
| Nhánh / commit | `feat/maker-checker`, nền `dev` @ `ae7e248` — **nhánh đang chờ nghiệm thu, chưa merge vào `dev`**. Danh sách commit đầy đủ ở `docs/CHECKPOINT_BE12.md` |
| Phase đã hoàn thành | P0 (nền), P1 (mint), vòng dọn UI điện gió, P4 (mint trên Sepolia), tiếp nhận bộ test nghiệm thu P4/P7/P12, build+deploy Cloudflare (PR #12), FE-01 v2 (kênh nhà đầu tư + trang tổng quan), BE-01 (mở rộng `ILedgerPort` cho ba luồng), FE-02 (màn kết nối ví), BE-02 (nghiệp vụ lệnh mua WPT), BE-03 (xem trước điều kiện mua), BE-08 (bổ sung quyền RBAC cho ba luồng — **phục hồi** sau khi bị revert khỏi `dev`, xem `docs/CHECKPOINT_BE08.md`), BE-09 (mở rộng lược đồ dữ liệu + bốn cổng lưu trữ mới), **MC-01** (cơ chế điểm cắm — PR #21, xem 3.10), **MC-02** (khuôn checkpoint + máy kiểm — PR #22, xem 3.11), **BE-04** (giá phát hành cấu hình được + phát hành một lần — PR #25, xem 3.12 và 4.3), **BE-06** (nghiệp vụ chia lợi nhuận — PR #26, xem 4.5), **BE-07** (tiến trình tự động chia lợi nhuận — PR #27, xem 3.14 và 4.5 giai đoạn 4), **OP-01** (tích hợp liên tục + cổng bảo vệ `dev` + tạm dừng Stellar ở khâu kiểm chứng — PR #28, xem 2.6 và 2.7), **FE-20** (khung bốn vai trò — PR #29, xem 1.1 và 3.15) |
| Đang chờ nghiệm thu | **BE-12** (lập–duyệt yêu cầu Mint/Burn + phát hành nhiều lần theo trần còn lại — xem 3.3, 3.4 và 4.3, checkpoint `docs/CHECKPOINT_BE12.md`) |
| Phase kế tiếp | FE-21/FE-22 màn Người bán và cặp lập–duyệt → BE-05 tất toán → FE-08/FE-09 giao diện chia lợi nhuận → IN-01/IN-02 Indexer |
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

**2.3 → 2.4 (BE-07).** Một service nghiệp vụ mới, một route handler mới, hai server action mới,
bốn khoá tham số hệ thống mới, một biến môi trường mới. **Không** thêm method nào vào `ILedgerPort`
(vẫn 29), **không** thêm bảng dữ liệu nào (dùng `KeeperRun` có từ BE-09), **không** thêm tầng,
**không** thêm quyền RBAC nào. Ba đổi hành vi cần đọc kỹ:

1. **`distributePeriod` không còn hứa chia xong cả kỳ trong một lời gọi.** Nó dừng sau
   `distribution.max_batches_per_run` lô (mặc định 5) và để `outstanding` khác 0 — một kết cục
   **bình thường**, không phải lỗi. Mọi người gọi phải gọi lại tới khi `outstanding` bằng 0. Lý do
   ở 3.14; `DistributionRunView` vì vậy có thêm trường `maxBatches`.
2. **`expireStaleOrders` của BE-02 nay có điểm vào HTTP:** `POST /api/keeper/distribution` với
   `job: "expire-orders"`. Trước đó hàm này chưa có người gọi.
3. **Biến môi trường `KEEPER_SECRET` là bắt buộc để tiến trình định kỳ chạy được.** Để trống thì
   route từ chối mọi yêu cầu (401) — không phải lỗi cấu hình im lặng, mà là mặc định đóng có chủ
   đích. Khoá ngắn hơn 32 ký tự làm app **không nạp được cấu hình**.

**2.4 → 2.5 (OP-01).** Một cổng quy trình (tích hợp liên tục), một tệp cấu hình mới, một route
handler mới, một tập lệnh mới. Vẫn `+0.1`: **không** thêm method nào vào `ILedgerPort` (vẫn 29),
**không** thêm bảng dữ liệu, **không** thêm tầng, **không** thêm quyền RBAC, **không** thêm phụ
thuộc. Ba đổi hành vi cần đọc kỹ:

1. **`scripts/run-local-all.sh` nhận tham số phần** (`--list` để xem). Chạy **không tham số thì
   hành vi giữ nguyên** như trước OP-01. `.github/workflows/ci.yml` gọi lại đúng các phần đó, nên
   thêm việc cần kiểm thì sửa script, **không** sửa tệp YAML — xem 2.7.
2. **`verify-arch-rules.sh` có thêm một phép kiểm có thể ĐỎ:** bảng quyền không được teo lại so
   với nền. Một yêu cầu hợp nhất cố ý bỏ một hành động RBAC nay phải ghi DEVIATION trong
   checkpoint. ⚠️ Trong CI dùng biến `RBAC_BASE_REF`, **không** dùng `BASE_REF` — `BASE_REF` bật
   phép kiểm "contract không được sửa" và sẽ chặn mọi task hợp đồng.
3. **Phần Soroban không còn trong khâu kiểm chứng.** `run-local-all.sh` không gọi `cargo`, và bộ
   công cụ Rust không còn là thứ phải có trong môi trường làm việc. Mã nguồn Stellar **giữ
   nguyên** — xem 2.6 để biết chỗ nào được gỡ, chỗ nào phải để yên.

**2.6 → 2.7 (BE-12).** Một bảng dữ liệu mới (`TokenRequest`), một cổng lưu trữ mới (tám cổng), hai
quyền RBAC mới (31 action), một service nghiệp vụ mới, năm server action mới, bốn mã lỗi mới.
**Không** thêm method nào vào `ILedgerPort` (vẫn 29), **không** thêm tầng, ba luật không bị chạm.
Ba đổi hành vi cần đọc kỹ:

1. **Phát hành không còn là MỘT LẦN.** `issueInitialSupply` nhận `amount` tuỳ chọn và chặn mọi lần
   vượt **trần còn lại** = `Project.totalSupply` − tổng cung trên chuỗi (mã `ISSUANCE_CAP`). Bỏ
   trống `amount` thì phát hành hết phần còn lại — lần gọi đầu như vậy cho đúng kết quả cũ. Lần
   thứ hai sau khi chạm trần nay trả `ISSUANCE_CAP`, không còn là `ORDER_STATE`. Xem 4.3.
2. **`CONTROLLER` có quyền ghi đầu tiên: `order:approve`.** Lần duyệt tác động token qua đường nội
   bộ của `lib/bank`, **không** qua `token:mint` — Kiểm soát viên vẫn không tự phát hành được.
3. **`pendingWorkCounts()` đọc cơ sở dữ liệu và thành `server-only`.** Đọc lỗi thì trả 0 kèm log,
   không ném, vì `AppLayout` gọi nó trên mọi trang.

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

**Bốn vai trò** theo tài liệu yêu cầu người sử dụng (FE-20), **dùng chung một backend**:

| Vai trò | Mã | Khu vực chính | Nội dung |
|---|---|---|---|
| Nhà đầu tư | `INVESTOR` | `(investor)` | Tổng quan, giao dịch token, quản lý lệnh, rút VNDB |
| Người bán | `SELLER` | `(seller)` | Tổng quan, danh sách giao dịch, tạo lệnh rút |
| Giao dịch viên | `TELLER` | `(ops)` + `(ops-draft)` | Bảng điều khiển, **lập lệnh**, giao dịch, chia lợi nhuận |
| Kiểm soát viên | `CONTROLLER` | `(ops)` + `(control)` | Bảng điều khiển, giao dịch, chia lợi nhuận (chỉ xem), **phê duyệt lệnh** |

Hai vai của bản trước — tuân thủ và kiểm toán — **không có trong tài liệu yêu cầu** nên FE-20 đã
gỡ. `TELLER` là vai ngân hàng cũ **đổi tên, giữ nguyên bộ quyền**; `CONTROLLER` nhận phần **chỉ
đọc** của hai vai đã gỡ, không nhận phần ghi nào.

**Bảy khu vực, mỗi khu vực một cổng** — bảng ở `app/src/lib/rbac/area-gates.ts`:

| Khu vực | Route group | Cổng (`requireAny`) | Vai vào được |
|---|---|---|---|
| Nhà đầu tư | `(investor)` | `portfolio:read` | INVESTOR |
| Người bán | `(seller)` | `seller:read` | SELLER |
| Vận hành | `(ops)` | `ops:read` | TELLER, CONTROLLER |
| Lập lệnh | `(ops-draft)` | `ops:draft:read` | TELLER |
| Phê duyệt lệnh | `(control)` | `ops:approve:read` | CONTROLLER |
| Kết nối ví | `(wallet)` | `wallet:connect` | INVESTOR, SELLER |
| Thông tin tài khoản | `(account)` | `balance:read` | cả bốn |

**Vai trò là lựa chọn tường minh, không suy ra từ quyền.** Người dùng chọn vai ở thanh trên
(cookie `bidv_channel` + `bidv_role`, đặt cùng lúc bởi `setChannel`). FE-20 nhập bộ chọn khu vực
và bộ chọn vai thành **một ô**: khu vực ↔ vai là một-một (`CHANNEL_ROLE`), nên để hai ô cùng đổi
được vai chỉ tạo đường cho hai cookie lệch nhau. Cookie **chỉ** dùng để hiển thị — phân quyền vẫn
đi qua vai + `can(role, action)`.

⚠️ Cổng của một khu vực phải là action mà **đúng tập vai cần vào** mới có. FE-01 v1 dùng
`balance:read` và guard không chặn được ai, vì quyền đó nằm trong nhóm `READ_ONLY` được spread vào
mọi vai phía ngân hàng. Xem 1.6.B. Ngoại lệ tường minh: khu vực `(account)` **cố ý** dùng
`balance:read` vì nó phải mở cho cả bốn vai.

⚠️ `(ops-draft)` và `(control)` là **hai group riêng, không lồng trong `(ops)`**, và đó là điểm
kiến trúc chứ không phải cách xếp thư mục: người lập lệnh không được là người duyệt. Hai cổng là
hai quyền khác nhau nên không có cách nào một vai giữ cả hai mà bảng quyền không ghi ra —
`app/test/four-roles-routes.test.ts` chốt lại điều đó.

⚠️ `(wallet)` dùng quyền riêng `wallet:connect` chứ không dùng `balance:read`, và không nằm trong
`(investor)`. Hai lý do đều thật: tài liệu yêu cầu cho **cả** Nhà đầu tư và Người bán mục Kết nối
ví (nên để trong `(investor)` thì Người bán bị chặn khỏi ví của mình), còn thao tác đặc quyền của
ngân hàng ký bằng khóa phía máy chủ qua `ISigner` (nên mở trang kết nối ví cho hai vai vận hành là
mời họ ký việc ngân hàng bằng ví cá nhân).


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
├── .github/workflows/
│   └── ci.yml                 # ★ Quy trình tự động: 3 việc, GỌI LẠI các phần của
│                              #   run-local-all.sh (không chép danh sách lệnh) — xem 2.7
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
│   ├── src/app/               # ★ BẢY khu vực, mỗi khu vực một cổng — xem 1.1 (FE-20)
│   │   ├── (investor)/        # portfolio, trade, orders, withdraw, tokens/[symbol]
│   │   ├── (seller)/          # seller, seller/transactions, seller/withdraw
│   │   ├── (ops)/             # / (bảng điều khiển), transactions, distribution,
│   │   │                      #   mint, kyc, assets, reconciliation, audit
│   │   ├── (ops-draft)/       # draft — CHỈ Giao dịch viên
│   │   ├── (control)/         # approvals — CHỈ Kiểm soát viên
│   │   ├── (wallet)/          # wallet — Nhà đầu tư + Người bán
│   │   ├── (account)/         # account — cả bốn vai
│   │   ├── actions/           # Server Actions (bank.ts, session.ts, portfolio.ts,
│   │   │                      #   purchase.ts, config.ts, distribution.ts)
│   │   ├── api/               # REST: mint, balance, investors, token, txns,
│   │   │                      #   purchase, keeper/distribution (BE-07, có khoá bí mật),
│   │   │                      #   version (OP-01, không cần xác thực — xem 2.7)
│   │   ├── layout.tsx, globals.css
│   │                          # ⚠️ KHÔNG còn page.tsx ở gốc: `/` chuyển vào (ops) để có
│   │                          #   cổng. Trang ngoài route-group là trang không cổng nào
│   ├── src/components/
│   │   ├── layout/            # sidebar, header, chain-selector, channel-guard,
│   │   │                      #   nav-config, app-layout, channel-switcher
│   │   │                      #   (role-switcher đã gỡ ở FE-20)
│   │   ├── investor/          # 4 hộp trang tổng quan + nhãn dữ liệu mẫu
│   │   ├── wallet/            # no-wallet-guide, wrong-chain-banner,
│   │   │                      #   wallet-status-card (dùng lại ở FE-05/09/11)
│   │   ├── pages/             # mint, kyc, assets, dashboard, reconciliation,
│   │   │                      #   investor-portfolio, investor-token-detail,
│   │   │                      #   wallet-connect, placeholder (11 trang chỗ trống)
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
│   ├── contracts-stellar/     # Soroban (Rust) — TẠM DỪNG, giữ mã (xem 2.6)
│   └── shared/                # ★ MỘT nguồn sự thật: ABI, địa chỉ, chain, types
│
├── scripts/                   # Công cụ chạy từ GỐC repo (Node 20+ / bash, không phụ thuộc ngoài)
│   ├── run-local-all.sh       # ★ NGUỒN DUY NHẤT của danh sách việc cần kiểm — 7 phần gọi
│   │                          #   riêng được (`--list`). Không tham số = bộ mặc định 5 phần
│   ├── verify-arch-rules.sh   # Lớp 3: 3 luật kiến trúc + cấu trúc repo + ký hiệu token
│   │                          #   + bảng quyền không teo lại so với nền (OP-01)
│   ├── scan-pending.mjs       # ★ Quét marker; --check, --json, --write-report, --check-report
│   ├── gen-flow-diagram.mjs   # ★ Sinh docs/flows/<luồng>.md (Mermaid) từ marker @flow
│   ├── check-checkpoint.mjs   # ★ Kiểm khuôn checkpoint; --in-progress (MC-02)
│   ├── smoke-test.mjs         # ★ Kiểm khói bản đã triển khai (OP-01) — chạy TAY
│   └── demo-mint.mjs          # Kịch bản demo luồng mint
│
└── docs/                      # SPEC, WORKING_PROTOCOL, CHECKPOINT, REVIEW
    ├── tech-report.md         # ★ Báo cáo công nghệ (file này)
    ├── tech-report-maintenance.md  # Quy tắc cập nhật báo cáo
    ├── BRANCH_PROTECTION.md   # ★ Hướng dẫn Owner bật bảo vệ nhánh `dev` (OP-01)
    ├── CHECKPOINT_TEMPLATE.md # ★ Khuôn checkpoint, có mục 0 bắt buộc (MC-02)
    └── flows/                 # ★ SINH TỰ ĐỘNG từ marker @flow — đừng sửa tay
        ├── purchase.md        #   Luồng mua WPT, 12 bước
        ├── issue.md           #   Luồng phát hành nguồn cung, 9 bước (BE-04)
        └── distribute.md      #   Luồng chia lợi nhuận, 14 bước (BE-06 1-10, BE-07 11-14)
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

**Tiến trình định kỳ (BE-07) không thuộc chế độ chạy nào — nó ở HẠ TẦNG.** Ứng dụng chỉ cung cấp
`POST /api/keeper/distribution`; việc gọi định kỳ do cron của ngân hàng, Cloudflare Cron Trigger
hay `systemd timer` lo. Cần đặt `KEEPER_SECRET` (tối thiểu 32 ký tự, sinh bằng
`openssl rand -hex 16`) và gửi qua header `Authorization: Bearer <khoá>`; để trống thì route từ
chối mọi yêu cầu. Vì sao không dựng bộ hẹn giờ trong ứng dụng: xem 3.14.

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
- **Vai trò là lựa chọn tường minh, khu vực suy ra từ vai.** Không xác định khu vực bằng quyền: một quyền đọc thuộc nhiều vai nên không nói được người dùng đang ở khu vực nào. `setChannel` đặt **cả hai** cookie (`bidv_channel` + `bidv_role`) trong một lần — hai cookie lệch nhau là người dùng gặp màn từ chối mà không hiểu vì sao. FE-20: khu vực ↔ vai là **một-một** (`CHANNEL_ROLE`), nên chỉ còn MỘT ô chọn; bộ chọn vai riêng đã gỡ, vì hai ô cùng đổi được vai chính là đường sinh ra hai cookie lệch nhau.
- **Cổng của một khu vực phải là action mà ĐÚNG tập vai cần vào mới có.** FE-01 v1 dùng `balance:read`, nằm trong `READ_ONLY` nên cả bốn vai đều có và guard không chặn được ai. Đừng "dọn dẹp" cổng khu vực nào (`portfolio:read`, `seller:read`, `wallet:connect`, `ops:draft:read`, `ops:approve:read`) vào `READ_ONLY`.
- **Cổng khu vực để ở DỮ LIỆU (`rbac/area-gates.ts`), không viết thẳng vào JSX của layout.** Layout là Server Component nên không unit-test được bằng Vitest, mà "mỗi vai chỉ vào được khu vực của mình" phải kiểm được CẢ HAI chiều. Để trong JSX thì chiều "bị chặn" chỉ kiểm được qua e2e, và trường hợp thêm khu vực mà quên cổng thì không phép kiểm nào bắt. `four-roles-routes.test.ts` còn đọc tệp layout thật để bắt ca bảng đúng mà layout nối sai cổng.
- **Hai mục lập lệnh và phê duyệt là HAI route-group riêng, không lồng nhau.** Người lập lệnh không được là người duyệt — đó là toàn bộ lý do mô hình lập–duyệt tồn tại. Hai cổng là hai quyền khác nhau nên bảng quyền buộc phải ghi ra, và có phép kiểm riêng cho bất biến "không vai nào giữ cả hai".
- **Mọi trang phải nằm TRONG một route-group.** Trang ngoài group là trang không cổng nào, mà cũng không có chỗ nào ghi rằng đó là chủ ý. `/` từng nằm ngoài như vậy; FE-20 chuyển nó vào `(ops)`. Có phép kiểm chặn `src/app/page.tsx` quay lại.
- **Menu tra theo VAI, không theo cookie khu vực.** Vai là thứ `ChannelGuard` dùng để quyết định cho vào hay không; tra theo khu vực thì một cookie đặt tay có thể bày menu Giao dịch viên cho người mang vai nhà đầu tư — menu nói một đằng, guard làm một nẻo. Cùng lý do, `AppLayout` **không** còn prop `nav`: hơn mười chỗ truyền tay là hơn mười chỗ truyền sai được, mà truyền sai thì không có gì báo.
- **`nav-config.ts` là dữ liệu thuần, `icon` là TÊN dạng chuỗi.** `AppLayout` dùng trong page (Server Component) còn `Sidebar` là `'use client'`, nên `NavSection` đi qua biên server → client. Để `icon` là component gây `Functions cannot be passed directly to Client Components` — đã xảy ra thật ở FE-01 v1. Thêm `'use client'` vào `nav-config.ts` **không** giải quyết: prop vẫn phải tuần tự hóa, và nó biến `AppLayout` thành Client Component.
- **`AppLayout` đặt trong từng page, không ở `layout.tsx` của route group.** `layout.tsx` chỉ giữ `ChannelGuard`. Đặt cả hai chỗ sẽ lồng layout hai lần.
- **Điều hướng khi đổi vai làm bằng `redirect()` trong server action, không bằng `router.push` ở client.** Đổi vai làm mất quyền của trang đang mở, `ChannelGuard` kết xuất màn từ chối mà màn đó không bọc `AppLayout` → `Header` bị unmount và `push` trong transition đã unmount sẽ mất.
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
- **`vi.spyOn` trên đối tượng namespace của module KHÔNG chặn được lời gọi nội bộ trong cùng module.** `assertCanConfigure` gọi `isConfigRole` như một tham chiếu lexical, nên vá từ ngoài làm ca kiểm **xanh oan** — nó không kiểm được gì mà vẫn báo đạt. Cách đúng cho một đột biến: sửa **thật** bảng dữ liệu (`CONFIG_ROLES.TELLER = false`) rồi trả lại trong `finally`.
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

**Hai bài học về TEST, học được ở BE-07:**

- **Test "hai tiến trình đồng thời" viết bằng `Promise.all` trơn KHÔNG dựng được tình huống đồng
  thời.** Hai lời gọi có cùng chuỗi `await` nên lời gọi đi trước có thể chạy **xong hẳn** trước khi
  lời gọi sau tới chỗ tranh chấp — và khi đó ca kiểm đo một tình huống khác hẳn tình huống nó nói
  đang đo, xanh mà vô nghĩa. Cách đúng: một **chốt hẹn** (barrier) trong vỏ bọc cổng, mở khi đủ số
  bên đã tới. Ở BE-07 chốt hẹn đặt ở `profitPoolBalance`, và phải **mở một lần rồi thông luôn** —
  đóng lại sau khi mở sẽ treo cả hai vòng vì `openPeriod` còn đọc số dư hai lần nữa.
- **Đột biến đỏ MỘT ca vẫn có thể là dấu hiệu bộ test còn lỗ.** Đột biến "bỏ trọng tài chỗ chạy" của
  BE-07 lần đầu chỉ làm **1 trong 4** ca của nhóm đỏ, vì ba ca còn lại được lớp thứ hai (ràng buộc
  duy nhất `periodKey`) đỡ hộ. Lớp thứ hai chỉ tồn tại ở tình huống **mở kỳ mới**; với kỳ **đang dở**
  thì chỗ chạy là lớp duy nhất. Thêm một ca cho đúng tình huống đó rồi chạy lại → **2 ca đỏ**. Bài
  học chung: khi đột biến đỏ ít hơn mong đợi, hỏi "ca nào đã được lớp khác đỡ hộ" thay vì kết luận
  bộ test đủ.

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
| **P1** *(đề nghị, Supervisor chốt mức)* | **Phát hiện tiền vào ví lợi nhuận bằng HỎI ĐỊNH KỲ, không bằng sự kiện on-chain** (BE-07). Hệ quả: (a) độ trễ bằng chu kỳ cron, (b) hai lần nạp giữa hai lượt hỏi bị gộp thành **một** kỳ chia, (c) không biết ai nạp và nạp lúc nào — chỉ biết số dư đã tăng. Nguyên nhân: IN-01/IN-02 (Indexer) chưa làm nên chưa đọc được sự kiện | IN-02 đổi **nguồn tín hiệu** sang sự kiện `Transfer` vào ví lợi nhuận, giữ nguyên bốn nhánh quyết định và toàn bộ phần chia. Điểm cắm đã đánh dấu `@pending IN-02` ngay trên `detectNewFunds` (`lib/bank/distribution-trigger.service.ts`) |
| **P2** *(đề nghị, Supervisor chốt mức)* | **`KeeperRun` không có cột tóm tắt.** Lược đồ chỉ có `status` + `error`, nên "số lô đã chia, số ví còn lại" của mỗi vòng chỉ vào được cột `error` — mà cột đó tên là `error`, nhồi tóm tắt thành công vào sẽ làm mọi truy vấn "vòng nào có lỗi" trả về cả vòng chạy đúng. BE-07 vì vậy để `error` chỉ mang thông báo khi thất bại, còn tóm tắt mỗi vòng ghi vào **sổ kiểm toán** | Nếu Owner muốn tóm tắt nằm trong `KeeperRun`: thêm cột `summary String?` vào `KeeperRun`, `IKeeperStore.finishRun`, hai bản hiện thực và `store-constraints.test.ts`. Chưa làm vì vượt phạm vi Tác động của BE-07 |
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
| Soroban SDK | Contract Stellar — **TẠM DỪNG, không thuộc khâu kiểm chứng** (xem 2.6) | 26 | 27.0.6 | Apache-2.0 |

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
| Vitest | Unit test — **517 test / 19 tệp** (`cd app && npm test`) | 3.2.4 | 5.0.0 | MIT |
| Playwright | E2E — **30 test / 4 tệp** (`cd app && npx playwright test --list`) | 1.63.0 | 1.63.0 | Apache-2.0 |
| ESLint | Kiểm tra mã nguồn | 9.x | 10.10.0 | MIT |
| Docker / Compose | 3 service: chain, db, web | — | 29.7.1 | Apache-2.0 |
| @opennextjs/cloudflare | Đưa Next.js lên Workers | 1.14.0 | 1.20.6 | MIT |
| Wrangler | CLI triển khai Workers | đi kèm | 4.129.1 | MIT/Apache-2.0 |
| GitHub Actions | Tích hợp liên tục — 3 việc, cổng bảo vệ `dev` (xem 2.7) | `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7` | cùng bản | MIT |

## 2.6. Stellar tạm dừng ở khâu kiểm chứng (OP-01)

**Mã nguồn Stellar giữ nguyên. Chỉ khâu kiểm chứng và khâu chuẩn bị môi trường bỏ nó ra.**

| Giữ nguyên trong repo | Đã gỡ khỏi khâu kiểm chứng |
|---|---|
| `packages/contracts-stellar/` (8 tệp Rust) | Nhánh gọi `cargo test` trong `scripts/run-local-all.sh` |
| `app/src/lib/ledger/stellar.adapter.ts` | Phép kiểm `@stellar/stellar-sdk` trong `scripts/verify-arch-rules.sh` |
| Giá trị `stellar` trong `packages/shared/src/chains.ts`, trong kiểu dữ liệu và sổ đăng ký chuỗi | Ba mục spec `p4-mint-stellar` / `p7-profit-distribution-stellar` / `p12-redemption-stellar` trong phần kiểm cấu trúc của cùng tệp đó |
| Trạng thái `unsupported-chain` ở màn kết nối ví (xem 3.9) và kiểm thử của nó | Yêu cầu bắt buộc cài Rust trong steering |

**Không ai phải cài Rust để làm việc trên dự án này.** `bash scripts/run-local-all.sh` in một dòng
thông báo phần Soroban đang tạm dừng; dòng đó **không** tính vào PASS/FAIL và không đổi mã thoát.
Có dòng đó để người chạy biết phần Soroban vắng mặt là chủ đích, không phải script quên gọi.

**Vì sao giữ mã thay vì xoá.** Kiến trúc đa chuỗi là thứ ba luật bất di bảo vệ (xem 1.2). Gỡ
`stellar` khỏi danh sách chuỗi và khỏi kiểu dữ liệu là bỏ đúng phần mà `ILedgerPort` tồn tại để
bảo vệ: ngày nối lại, việc phải làm sẽ là *thêm một adapter*, không phải *dựng lại khả năng đa
chuỗi*. Cái giá của việc giữ: mỗi method mới thêm vào `ILedgerPort` vẫn phải hiện thực ở
`stellar.adapter.ts` — ném `LedgerNotImplementedError` kèm gợi ý nêu đúng thứ đang thiếu.

**Hai phép kiểm CÒN LẠI nhắc Stellar, đừng gỡ nhầm:**

| Phép kiểm | Vì sao giữ |
|---|---|
| Contract ID Stellar (`C...` 56 ký tự) hardcode trong `app/src` | Đây là luật "một nguồn sự thật", không phải phép kiểm chuỗi Stellar. Nó vẫn phát biểu được điều đúng ngay hôm nay |
| `packages/contracts-stellar/contracts/**/*.rs` trong phép so contract với `BASE_REF` | Đây chính là thứ **bảo vệ** mã nguồn Stellar khỏi bị sửa. Gỡ nó đi là mở đường cho việc mà mục này cấm |

**Nối lại khi nào.** Owner quyết. Lúc đó: thêm lại nhánh `cargo test` vào `run-local-all.sh`,
thêm lại phép kiểm `@stellar/stellar-sdk` (cùng khuôn với phép kiểm viem/ethers), thêm lại ba mục
spec, và bỏ ghi chú tạm dừng ở `.kiro/steering/tech.md` + `structure.md`. Trong lúc chưa nối:
**không mở task Stellar mới.**

## 2.7. Tích hợp liên tục và cổng bảo vệ nhánh `dev` (OP-01)

### Một nguồn danh sách việc, hai nơi chạy

`scripts/run-local-all.sh` là **nguồn duy nhất** của danh sách việc cần kiểm. Nó chia thành các
phần gọi riêng được, và `.github/workflows/ci.yml` **gọi lại đúng các phần đó**:

```bash
bash scripts/run-local-all.sh --list        # in danh sách phần, dấu * = thuộc bộ mặc định
```

| Phần | Nội dung | Ở việc CI nào |
|---|---|---|
| `arch` | 3 luật kiến trúc, cấu trúc repo, ký hiệu token, **bảng quyền không teo lại** | A |
| `markers` | `scan-pending.mjs --check` | A |
| `checkpoint` | `check-checkpoint.mjs --in-progress` | A |
| `contracts` | `npx hardhat test` | B |
| `app` | typecheck, ESLint, Vitest | A |
| `build` | `npm run build` — **cần mạng** (`next/font/google`) | C |
| `e2e` | `npx playwright test` | C |

Bộ mặc định (chạy `bash scripts/run-local-all.sh` không tham số) = `arch markers checkpoint
contracts app`, tức **giữ nguyên** hành vi có từ trước OP-01. `build` và `e2e` cố ý ở ngoài: cả
hai nặng, và `build` không chạy được ở nơi bị chặn ra ngoài.

**Vì sao không chép danh sách lệnh vào tệp YAML.** Chép là tạo ra hai danh sách phải tự tay giữ
khớp nhau, và chúng sẽ lệch. Lúc đó nơi chạy tự động và nơi chạy tay kiểm hai thứ khác nhau, mà
không ai biết cho tới khi một lỗi lọt qua đúng khe đó.

### Ba việc, và việc nào là cổng

| Việc | Tên trong `ci.yml` | Là cổng bắt buộc? |
|---|---|---|
| A — ứng dụng | `A - ung dung (cong bat buoc)` | **Có** |
| B — hợp đồng EVM | `B - hop dong EVM (cong bat buoc)` | **Có** |
| C — phần nặng | `C - phan nang (KHONG chan hop nhat)` | Chưa — xem dưới |

Kích hoạt khi **đẩy lên `dev`** và khi **mở yêu cầu hợp nhất vào `dev`**. Ba việc chạy song song.
Không dùng secret nào, `permissions: contents: read`.

⚠️ **Tên việc viết KHÔNG DẤU có chủ đích.** Tên đó là **khoá** trong danh sách phép kiểm bắt buộc
của bảo vệ nhánh. Lệch một ký tự thì GitHub nhận nó như một phép kiểm chưa từng báo về, và mọi
yêu cầu hợp nhất treo vĩnh viễn ở "Expected — Waiting for status to be reported". Đổi tên việc thì
phải cập nhật cấu hình bảo vệ nhánh trong cùng lần.

**Việc C không chặn hợp nhất, nhưng KHÔNG dùng `continue-on-error`.** Nó hiện đỏ đúng như thật;
việc "không chặn" thực hiện bằng cách chỉ đưa A và B vào danh sách phép kiểm bắt buộc. Lý do chọn
cách này: `continue-on-error` biến việc C thành dấu XANH trong khi nó vừa đỏ, và một cổng nói dối
còn tệ hơn không có cổng. Điều kiện siết và cách bật: `docs/BRANCH_PROTECTION.md`.

### Bảng quyền không được teo lại

Phép kiểm ở `verify-arch-rules.sh` mục LUẬT 3: số hành động trong `ACTIONS` **không được ít hơn**
bản trên nền, và **không hành động nào của bản nền được biến mất** (bắt cả trường hợp đổi tên, vốn
giữ nguyên số đếm nhưng vẫn làm mất một quyền).

| | |
|---|---|
| Nền để so | `RBAC_BASE_REF`; không đặt thì lấy `origin/dev` rồi `dev` |
| Nền trong CI | Yêu cầu hợp nhất: nhánh đích. Đẩy thẳng lên `dev`: **commit trước lần đẩy** — `origin/dev` sau lần đẩy chính là commit đang kiểm, tự so với chính mình thì luôn xanh |
| Không tìm được nền | WARN, **không đỏ**: đỏ ở đó là đỏ vì cách lấy mã nguồn, không vì mã nguồn |
| Đếm bằng gì | `node` nhúng trong script, không phải `grep -c`: khối `ACTIONS` có chú thích khối chứa dấu ngoặc và tên hành động trong dấu nháy ngược |

**Vì sao cần.** Dự án đã mất toàn bộ phần quyền của BE-08 khỏi `dev` một lần, và **không phép kiểm
nào hiện có bắt được**: mã vẫn biên dịch, mọi test vẫn xanh — một bảng quyền thiếu hành động chỉ
nghĩa là ít người được làm việc hơn, và không test nào phát biểu "phải có đúng N hành động".

⚠️ **Trong CI dùng tên biến `RBAC_BASE_REF`, KHÔNG dùng `BASE_REF`.** `BASE_REF` là biến bật phép
kiểm "contract không được sửa so với nền" ở cùng tệp; đặt nó trong CI sẽ làm **đỏ mọi yêu cầu hợp
nhất có sửa contract**, tức chặn đúng các task SC-0x.

### Đường dẫn đọc phiên bản và kiểm khói

| | |
|---|---|
| `GET /api/version` | Trả `{ ok, data: { commit, branch, buildTime, source } }`. **Không cần xác thực** có chủ đích: đây là thứ phải trả lời được TRƯỚC khi đăng nhập được. Chỉ đọc ba biến môi trường; không chạm cơ sở dữ liệu, chuỗi, hay biến bí mật |
| `app/src/lib/config/build-info.ts` | Nơi DUY NHẤT đọc `BUILD_COMMIT_SHA` / `BUILD_BRANCH` / `BUILD_TIME`. Tách khỏi `env.ts` vì `serverEnv()` **ném lỗi** khi cấu hình sai, còn `/api/version` phải trả lời được **kể cả lúc** cấu hình đang sai |
| Trường `source` | Nói từng trường là `env` hay `fallback`. Cần vì `commit: "local"` một mình không phân biệt được "đang chạy cục bộ" với "quy trình triển khai quên truyền biến" — hai chuyện xử lý khác nhau hoàn toàn |
| `export const dynamic = 'force-dynamic'` | Tường minh. Một `/api/version` bị đóng băng vào bản dựng vẫn trả 200 kèm mã commit CŨ, tức kiểm khói báo xanh cho đúng thứ nó phải phát hiện |
| `scripts/smoke-test.mjs <địa-chỉ>` | Gọi `/api/version` và `/api/token?chain=mock`. **Chạy tay, chưa gắn vào triển khai.** Mã thoát: `0` đạt · `1` có phép kiểm đỏ · `2` gọi sai |

Vì sao kiểm khói cần **hai** phép kiểm: `/api/version` không chạm gì ngoài `process.env` nên nó
vẫn xanh khi tầng nghiệp vụ hỏng hoàn toàn; `/api/token` đi qua service và cổng ledger. Mặc định
`chain=mock` để phép kiểm đỏ thì đỏ vì **ứng dụng**, không vì hạ tầng chưa lên. Chỉ gọi `GET`:
kiểm khói chạy trên môi trường thật, một phép kiểm có ghi sẽ để lại dữ liệu rác trong sổ sách mỗi
lần triển khai.

### Lưu ý khi phát triển

- **Thêm việc cần kiểm thì sửa `run-local-all.sh`, không sửa `ci.yml`.** Thêm hàm `part_<tên>` và
  thêm tên vào `ALL_PARTS`; thuộc cổng bắt buộc thì thêm cả vào `DEFAULT_PARTS`. `ci.yml` chỉ đổi
  khi **danh sách phần của một việc** đổi.
- **Tên phần sai thì script thoát `2`, không phải `1`.** Phân biệt "gọi sai" với "có mục đỏ": gõ
  sai tên phần mà trả `0` thì CI xanh oan, mà trả `1` thì bị đọc là test đỏ.
- **Năm chỗ lưu đệm** (phụ thuộc `app`, phụ thuộc `contracts-evm`, trình biên dịch Solidity, trình
  duyệt Playwright, `.next/cache`). Lượt chạy có đệm trình duyệt vẫn cần bước `playwright
  install-deps` riêng: đệm giữ **thư mục** trình duyệt chứ không giữ gói `.deb`, thiếu bước đó thì
  trình duyệt đủ file mà không khởi động được.
- **Không nội suy `${{ }}` vào thân `run:`.** Truyền qua `env:` của bước. Nội suy thẳng vào shell
  là một lỗ chèn lệnh, kể cả khi giá trị hiện tại vô hại.
- **`NODE_VERSION` đang là `22`.** `.kiro/steering/tech.md` ghi "Node pinning: `.nvmrc` = 20" nhưng
  repo **không có** `.nvmrc` và không có `engines.node`, nên con số 20 chưa từng có hiệu lực. Đo
  thật: `vite`, `@vitejs/plugin-react`, `yargs` đòi `^20.19.0 || >=22.12.0`. Chọn 22 để nơi chạy
  tự động giống nơi đã đo toàn bộ bằng chứng. Việc chốt con số là **câu hỏi mở gửi Owner**.

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Thêm một loại kiểm mới vào cổng | `run-local-all.sh`: hàm `part_*` + `ALL_PARTS` + `DEFAULT_PARTS`. Rồi thêm tên phần vào dòng lệnh của việc tương ứng trong `ci.yml` |
| Siết việc C thành cổng bắt buộc | Chỉ là cấu hình kho mã — thêm tên việc vào danh sách phép kiểm bắt buộc, và đổi tên việc trong `ci.yml` cho khỏi nói sai. `docs/BRANCH_PROTECTION.md` mục 5 |
| Gắn kiểm khói vào một bước triển khai | Gọi `node scripts/smoke-test.mjs <địa-chỉ> --expect-commit=$(git rev-parse HEAD)` sau khi triển khai xong. Task này **không** dựng bước triển khai |
| Thêm trường vào `/api/version` | `build-info.ts` (nơi duy nhất đọc env), rồi `app/test/build-info.test.ts`. Route handler không tự đọc `process.env` |

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
| `permissions.ts` | Bảng dữ liệu thuần: 4 role × 31 action |
| `can.ts` | `can(role, action)` + `assertCan()` + `permissionsOf()` — **điểm kiểm quyền duy nhất** |
| `session.ts` | `currentRole()` — đọc vai trò hiện tại từ cookie `bidv_role`; `currentActorId(role)` (BE-12) — mã tài khoản người thao tác, `DEMO_ACTOR` hoặc mã mẫu của vai (`SAMPLE_ACCOUNTS`), AU-01 sẽ thay bằng phiên đăng nhập |
| `demo-payment.ts` | Chốt chặn **hai lớp** riêng cho `demo:mint-payment`: `canMintDemoPayment()`, `assertCanMintDemoPayment()`, `DemoPaymentMintDisabledError` |
| `config-role.ts` | Chốt chặn **hai lớp** cho việc đổi tham số hệ thống (BE-04): `CONFIG_ROLES`, `isConfigRole()`, `assertCanConfigure()`, `NotConfigRoleError`. Thứ tự là **RBAC trước, `isConfig` sau** — ngược `demo-payment.ts`, vì lớp thứ hai ở đây gắn với TỪNG VAI nên phải biết vai nào rồi mới trả lời được |
| `area-gates.ts` | `AREAS`, `AREA_GATES`, `AREA_LABELS` — cổng vào từng khu vực giao diện (FE-20). Dữ liệu thuần, **không** nằm trong JSX của layout: layout là Server Component nên không unit-test được, mà DoD đòi kiểm chặn cả hai chiều |

**Ma trận quyền (đủ 31 action, tên đúng như trong `ACTIONS`):**

Cột "Nguồn" nói action do phase nào khai: **BE-08** (bổ sung quyền cho ba luồng), **BE-02**
(nghiệp vụ lệnh mua), **FE-20** (cổng khu vực giao diện), **BE-12** (lập–duyệt). Action không ghi nguồn là có từ P1.

| Action | INVESTOR | SELLER | TELLER | CONTROLLER | Nguồn |
|---|:--:|:--:|:--:|:--:|:--:|
| `token:mint` | ❌ | ❌ | ✅ | ❌ | — |
| `token:burn` | ❌ | ❌ | ✅ | ❌ | — |
| `token:freeze` | ❌ | ❌ | ✅ | ❌ | — |
| `token:clawback` | ❌ | ❌ | ✅ | ❌ | — |
| `investor:whitelist` | ❌ | ❌ | ✅ | ❌ | — |
| `kyc:approve` | ❌ | ❌ | ✅ | ❌ | — |
| `token:transfer` | ✅ | ❌ | ❌ | ❌ | — |
| `order:place` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `order:execute` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `order:expire` | ❌ | ❌ | ✅ | ❌ | BE-02 |
| `distribution:snapshot` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `distribution:execute` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `settlement:initiate` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `settlement:set-nav` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `settlement:confirm` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `treasury:manage` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `demo:mint-payment` | ❌ | ❌ | ✅ **+ cờ** | ❌ | BE-08 |
| `balance:read` | ✅ | ✅ | ✅ | ✅ | — |
| `txn:read` | ✅ | ✅ | ✅ | ✅ | — |
| `audit:read` | ❌ | ❌ | ✅ | ✅ | — |
| `order:read` | ✅ | ✅ | ✅ | ✅ | BE-02 |
| `order:read:all` | ❌ | ❌ | ✅ | ✅ | BE-02 |
| `reconcile:read` | ❌ | ❌ | ✅ | ✅ | BE-08 |
| `portfolio:read` | ✅ | ❌ | ❌ | ❌ | — |
| `seller:read` | ❌ | ✅ | ❌ | ❌ | FE-20 |
| `wallet:connect` | ✅ | ✅ | ❌ | ❌ | FE-20 |
| `ops:read` | ❌ | ❌ | ✅ | ✅ | FE-20 |
| `ops:draft:read` | ❌ | ❌ | ✅ | ❌ | FE-20 |
| `ops:approve:read` | ❌ | ❌ | ❌ | ✅ | FE-20 |
| `order:draft` | ❌ | ❌ | ✅ | ❌ | BE-12 |
| `order:approve` | ❌ | ❌ | ❌ | ✅ | BE-12 |

**5 cổng khu vực FE-20 thêm vào** — `seller:read`, `wallet:connect`, `ops:read`,
`ops:draft:read`, `ops:approve:read` — là **quyền HIỂN THỊ**, mỗi cái trả lời đúng một câu: "vai
này có được MỞ khu vực đó không". Hậu tố `:read` là cố ý, để khi BE-12 khai quyền nghiệp vụ thật
(`order:draft`, `order:approve`) thì không trùng tên và không ai nhầm hai thứ với nhau.

⚠️ `ops:draft:read` và `ops:approve:read` **không được cùng ở một vai**. Đó là bất biến của mô
hình lập–duyệt, và `app/test/four-roles-routes.test.ts` có phép kiểm riêng cho nó — đọc từng dòng
bảng quyền thì loại lỗi này rất khó thấy.

⚠️ `order:draft` và `order:approve` (BE-12) **không vai nào có cả hai** — `rbac.test.ts` kiểm cho
mọi vai. Có quyền duyệt vẫn chưa đủ: người lập không duyệt được yêu cầu của chính mình, phép so
theo **mã tài khoản** nằm trong `token-request.service.ts`, vì bảng quyền chỉ biết vai.

⚠️ `TELLER` là vai ngân hàng cũ **đổi tên, giữ nguyên bộ quyền**. BE-12 **thêm** `order:draft` nhưng
**không gỡ** `token:mint` / `token:burn` trực tiếp — gỡ là đổi hành vi màn `/mint` và luồng FE-07,
ngoài phạm vi BE-12. Có bắt mọi lần Mint/Burn đi qua lập–duyệt hay không là câu hỏi mở cho Owner
(`docs/CHECKPOINT_BE12.md`).

⚠️ `CONTROLLER` **không** nhận phần ghi của vai tuân thủ cũ (`investor:whitelist`, `kyc:approve`,
`token:freeze`) dù vai đó đã gỡ. Kiểm soát viên duyệt việc của Giao dịch viên; cho nó tự làm mấy
việc đó là gộp người làm với người duyệt vào một chỗ. Ba hành động đó vẫn có chủ ở `TELLER` nên
không quyền nào thành **vô chủ** — có test riêng cho điều này, vì một hành động vô chủ thì bảng vẫn
khai, số đếm không giảm nên `verify-arch-rules.sh` vẫn xanh, mà không ai làm được việc đó nữa.


**10 hành động BE-08 thêm vào** — `order:place`, `order:execute`, `distribution:snapshot`,
`distribution:execute`, `settlement:initiate`, `settlement:set-nav`, `settlement:confirm`,
`treasury:manage`, `demo:mint-payment`, `reconcile:read` — là **chỗ đặt guard** cho ba luồng khớp
lệnh / chia lợi nhuận / tất toán. Trong đó **năm** hành động đã có nghiệp vụ dùng thật:
`order:place` và `order:execute` (BE-02, xem 4.2), `treasury:manage` (BE-04, xem 3.12),
`distribution:snapshot` và `distribution:execute` (BE-06, xem 4.5). Năm hành động còn lại —
`order:expire` (BE-07), ba `settlement:*` (BE-05), `demo:mint-payment` — **chưa có nghiệp vụ gọi**.

⚠️ **`distribution:execute` cố ý KHÔNG cấp cho `CONTROLLER`**, dù vai đó giám sát dòng tiền: cùng một
người vừa giám sát vừa chuyển tiền thì lớp kiểm soát thứ hai không còn. `previewDistribution` cũng
hỏi đúng quyền này chứ không phải một quyền đọc — nó là bản xem trước của chính hành động chi trả,
nên ai xem trước được thì cũng phải là người được phép chia. Đọc trạng thái kỳ thì khác: đó là
`reconcile:read`, nên `CONTROLLER` vào được khu vực theo dõi mà không chạm được hàm chi trả.

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

- `order:place` và `settlement:confirm` **cố tình không** cấp cho `TELLER`. Hai việc đó là quyết
  định của nhà đầu tư; ngân hàng đặt lệnh hoặc xác nhận hoàn vốn thay thì mất dấu ai đã đồng ý, và
  sổ kiểm toán không còn dùng được để đối chiếu trách nhiệm.
- `CONTROLLER` **không** có `order:execute`, `distribution:execute`, `settlement:set-nav`. Kiểm soát
  giám sát dòng tiền chứ không tự thực hiện: cùng một người vừa giám sát vừa chuyển tiền là mất lớp
  kiểm soát thứ hai.
- `settlement:*` chứ không phải `token:redeem`, vì luồng chốt là ngân hàng điều phối và đốt token,
  không phải nhà đầu tư tự đổi. Hành động đốt **tái dùng** `token:burn` đã có.
- `reconcile:read` nằm trong nhóm `READ_ONLY` nên ba vai ngân hàng tự nhận được; `INVESTOR` không
  spread nhóm đó nên tự động không có. Đúng ý định: báo cáo đối soát là dữ liệu toàn hệ.

⚠️ **`demo:mint-payment` cần HAI lớp, quyền RBAC một mình KHÔNG đủ.** Bảng quyền là mã nguồn, nên
chỉ cần ai gán nhầm vai `TELLER` trên môi trường thật là chức năng tự phát hành tiền mở ra. Lớp
thứ hai là cờ `ENABLE_DEMO_PAYMENT_MINT` (mặc định **tắt**, xem 3.6), nằm ở cấu hình triển khai nên
hai lớp không cùng hỏng vì một sai sót. Điểm kiểm duy nhất là `demo-payment.ts`, thứ tự **cờ trước,
quyền sau** — cờ tắt thì từ chối luôn, không đọc vai, nhờ vậy thông báo nói đúng nguyên nhân và
không có đường nào để vai trò "bù" cho cờ. Đừng gọi `can(role, 'demo:mint-payment')` trực tiếp.

⚠️ **`demo-payment.ts` KHÔNG được export từ `rbac/index.ts`.** Barrel đó là client-safe (component
dùng `can()` để ẩn/hiện nút), còn file này `server-only` vì phải đọc env. Đưa vào barrel là làm mọi
component `import ... from '@/lib/rbac'` fail build.

**Lưu ý:** `can(role: unknown, ...)` nhận `unknown` có chủ ý để dữ liệu ngoài vào an toàn; role lạ **quy về `FALLBACK_ROLE`** = `SELLER` (bộ quyền nhỏ nhất), không cho qua. Đây là nguyên tắc đóng, giữ nguyên khi mở rộng. FE-20 đổi từ vai kiểm toán cũ sang `SELLER` vì đó là vai duy nhất vừa sạch quyền ghi vừa **không** đọc được dữ liệu toàn hệ; quy một cookie gõ sai về `CONTROLLER` là biến một lỗi chính tả thành quyền xem sổ kiểm toán.

⚠️ **`READ_ONLY` là bẫy.** Hằng private
`READ_ONLY = ['balance:read','txn:read','audit:read','order:read','order:read:all','reconcile:read']`
được spread vào `TELLER` và `CONTROLLER`. Quyền nào đặt vào đó thì **cả hai vai vận hành tự
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
| `issuance.service.ts` | **Phát hành NHIỀU LẦN** vào ví SPV, mỗi lần không vượt **trần còn lại** (BE-04, nhiều lần từ BE-12). Trần đọc từ bảng `Project`, tổng cung đọc từ chuỗi. `executeIssuance` là lõi KHÔNG kiểm quyền, dùng chung cho phát hành trực tiếp và lần duyệt yêu cầu Mint; `trackTxn` là thứ tự "lưu giao dịch chờ → đợi biên nhận" dùng chung với Burn | `issueInitialSupply()`, `getIssuanceStatus()`, `executeIssuance()`, `remainingIssuanceCap()`, `trackTxn()` |
| `token-request.service.ts` | **Lập–duyệt yêu cầu Mint/Burn** (BE-12). Lập chỉ ghi `PENDING`; duyệt kiểm lại toàn bộ điều kiện, chiếm quyền `PENDING → EXECUTING` bằng `UPDATE` có điều kiện rồi mới gửi giao dịch; chặn người lập tự duyệt/từ chối — xem 4.3 | `previewTokenRequest()`, `createTokenRequest()`, `approveTokenRequest()`, `rejectTokenRequest()`, `listTokenRequests()`, `countPendingWork()` |
| `config.service.ts` | Tham số hệ thống: đổi giá phát hành (BE-04). Thứ tự **đẩy xuống ledger trước, ghi cơ sở dữ liệu sau** — xem 3.12 | `getIssuePrice()`, `setIssuePrice()` |
| `portfolio.service.ts` | Vị thế nhà đầu tư (chỉ đọc) | `getPortfolio()`, `getWalletTransactions()`, `getTokenSummary()` |
| `purchase.service.ts` | Nghiệp vụ lệnh mua WPT (BE-02) + xem trước điều kiện (BE-03) | `previewPurchase()`, `placeOrder()`, `executeOrder()`, `listOrders()`, `expireStaleOrders()` |
| `distribution.service.ts` | **Chia lợi nhuận** theo tỷ lệ nắm giữ tại ảnh chụp (BE-06). Danh sách người nhận dựng từ **cơ sở dữ liệu**, không từ chuỗi — xem 4.5. ⚠️ BE-07: `distributePeriod` nay dừng sau `distribution.max_batches_per_run` lô, nên **`outstanding` khác 0 là kết cục bình thường** và người gọi phải gọi lại | `openPeriod()`, `previewDistribution()`, `distributePeriod()`, `getDistributionPeriod()` |
| `distribution-trigger.service.ts` | **Tiến trình tự động chia** (BE-07): phát hiện ví lợi nhuận nhận tiền rồi chia, không cần người bấm. Gọi lại nghiệp vụ của `distribution.service.ts`, **không** tự chia — xem 3.14 | `runDistributionCycle()`, `listDistributionRuns()`, hằng `DISTRIBUTION_JOB_NAME` |
| `purchase.state.ts` | Mô hình trạng thái lệnh mua — dữ liệu, không phải logic. `ORDER_STATUSES` **re-export** từ `store/order.store.port.ts`, không khai lại | `ORDER_TRANSITIONS`, `canTransitionOrder()`, `EXECUTABLE_ORDER_STATUSES`, `findPaidPendingDeliveryStatuses()` |
| `issuance.ts` | Quy đổi WPT → VND theo giá phát hành. **Không giữ hằng số giá**: re-export `WPT_ISSUE_PRICE_VND` từ `lib/config/issue-terms.ts` (xem 3.6). ⚠️ BE-04 đổi chữ ký thành `wptToVnd(amount, issuePriceVnd)` — nhận giá làm **tham số** để tệp này giữ được tính thuần và **không** phải thành `server-only` | `wptToVnd()`, re-export `WPT_ISSUE_PRICE_VND` |
| `audit.service.ts` | Đọc sổ kiểm toán | `listAuditLog()` |
| `result.ts` | Kiểu `Result<T>` + `ok`/`err` + `httpStatusFor` | Chuẩn hóa lỗi |
| `schemas.ts` | Schema Zod dùng chung FE/BE | `mintSchema`, `placeOrderSchema`, `previewPurchaseSchema` (**bút danh của `placeOrderSchema`**, không khai lại), `executeOrderSchema`, `orderQuerySchema`, `issueInitialSupplySchema` (BE-04; BE-12 thêm `amount` tuỳ chọn — số lượng LẦN NÀY, trần vẫn chỉ đọc từ bảng dự án), `createTokenRequestSchema` / `approveTokenRequestSchema` / `rejectTokenRequestSchema` / `tokenRequestQuerySchema` (BE-12 — Burn **cố ý không có trường ví**: luôn đốt ở ví SPV chuỗi đã ghi), `openPeriodSchema` / `distributionPeriodSchema` / `distributionPeriodQuerySchema` (BE-06 — **cố ý không có trường kích thước lô**), `distributionCycleSchema` / `keeperRunQuerySchema` (BE-07 — `distributionCycleSchema` **chỉ có `chain`**: tiến trình tự phát hiện phải làm gì, nhận mã kỳ từ input là quay về luồng bấm tay), `amountSchema`, `walletSchema` |

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

**Tám cổng lưu trữ, mỗi cổng một nghiệp vụ** (BE-09 năm cổng, BE-04 thêm hai, BE-12 thêm một). Hai hiện thực cho
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
| `store/token-request.store.port.ts` | `ITokenRequestStore` — yêu cầu Mint/Burn (BE-12). Năm trạng thái `PENDING → EXECUTING → COMPLETED \| FAILED`, `PENDING → REJECTED`; bảng `TOKEN_REQUEST_TRANSITIONS` chặn chuyển ngược chiều ở **cả hai bản** trước khi chạm dữ liệu. Tự ghi `decidedAt` / `completedAt` | `createRequest`, `findRequest`, `transitionRequest`, `attachRequestTxHash`, `listRequests`, `countRequests` |
| `store/seed-data.ts` | **MỘT nguồn dữ liệu khởi tạo cho CẢ HAI bản lưu trữ** (BE-04). Không con số nào gõ tay ở đây: giá/tổng cung/ngưỡng nhập từ `lib/config/issue-terms.ts`, danh sách vai được đổi cấu hình suy từ `lib/rbac/config-role.ts` | `SEED_CONFIG_ROWS`, `SEED_PROJECTS`, `SEED_PROJECT_CHAINS`, `SEED_ROLE_ROWS` |
| `store/config-values.ts` | Đọc tham số đã cấu hình, **lùi về mặc định trong mã** khi bảng trống. Đặt ở tầng lưu trữ vì có HAI người đọc ở hai tầng: `lib/bank` và **factory `getLedger`** — để ở `lib/bank` thì tầng cổng phải nhập tầng nghiệp vụ, tức ngược chiều phụ thuộc. Bảng khoá đầy đủ ở 3.13 | `readIssuePriceVnd`, `readPriceChangeThreshold`, `readDistributionBatchSize`, `readDistributionDustWallet` |
| `store/store.errors.ts` | Lớp lỗi + phép kiểm **dùng chung cho cả hai bản** | `UniqueConstraintError`, `ForeignKeyError`, `InvalidStatusError`, `StoreUsageError`, `assertStatus`, `assertAmount`, `assertSnapshotId`, `assertBulkSize`, `assertNoDuplicateWallet`, `mapPgConstraintError`, `UNIQUE_CONSTRAINTS`, `FOREIGN_KEYS` |
| `store/memory.state.ts` | Một khoá `globalThis` cho state của MỌI bản bộ nhớ | `memoryState`, `resetMemoryStores` |
| `store/memory.{store,order,distribution,settlement,keeper,config,project,token-request}.store.ts` | Bản RAM cho free-tier. Hai bản BE-04 nạp dữ liệu khởi tạo từ `seed-data.ts` | |
| `store/postgres.pool.ts` | Pool `pg` + `ensureSchema` + **nạp dữ liệu khởi tạo** (BE-04, `ON CONFLICT DO NOTHING` nên chạy lại không ghi đè giá ngân hàng đã đặt) | `pgQuery`, `pgTransaction` |
| `store/postgres.{store,order,distribution,settlement,keeper,config,project,token-request}.store.ts` | Bản Postgres, `pg` thuần, query tham số hoá | |
| `store/index.ts` | Factory theo `USE_MOCK_DB` | `getStore`, `getOrderStore`, `getDistributionStore`, `getSettlementStore`, `getKeeperStore`, `getConfigStore`, `getProjectStore`, `getTokenRequestStore`, `resetStoreCache`, `resetMemoryStore` |
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
| `TokenRequest` | `txHash` | một mã giao dịch gắn cho hai yêu cầu Mint/Burn. Chống hai lần duyệt **không** dựa vào ràng buộc này mà vào `UPDATE ... WHERE status = 'PENDING'` |
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
| `config/env.ts` | Nơi duy nhất đọc `process.env` **của cấu hình nghiệp vụ**, validate bằng Zod | Có `import 'server-only'` — hàng rào cứng. `serverEnv()` **ném lỗi** khi cấu hình không hợp lệ |
| `config/build-info.ts` | Nơi duy nhất đọc `BUILD_COMMIT_SHA` / `BUILD_BRANCH` / `BUILD_TIME` (OP-01) | Tách khỏi `env.ts` **có chủ đích**: `/api/version` là nơi đầu tiên người ta gọi khi nghi bản triển khai có vấn đề, nên nó phải trả lời được **kể cả lúc** `serverEnv()` đang ném lỗi. Ba biến này không có giá trị nào không hợp lệ nên không có gì để validate. Xem 2.7 |
| `config/flags.ts` | Tính cấu hình công khai ở server | Quyết định chain nào chọn được; `demoPaymentMint` tính bằng đúng hàm mà server dùng để chặn |
| `config/issue-terms.ts` | **Nguồn duy nhất của điều khoản phát hành** và của **mặc định mọi tham số hệ thống**: `WPT_ISSUE_PRICE_VND`, `WPT_TOTAL_SUPPLY`, `WPT_PRICE_CHANGE_THRESHOLD`, `DISTRIBUTION_BATCH_SIZE`, `DISTRIBUTION_MAX_BATCHES_PER_RUN`, `DISTRIBUTION_MIN_NEW_BALANCE`, `DISTRIBUTION_STUCK_AFTER_RUNS`, `CONFIG_KEYS`, `WPT_TOKEN_SYMBOL` | Hai điều **cố ý**, đừng "dọn" mất: (1) **không có `import` nào** — tệp lá thì không thể tạo vòng phụ thuộc, mà `mock.adapter.ts` đọc hằng số này ở phạm vi module nên một vòng sẽ cho ra giá `undefined`/`0` và biến khớp lệnh thành "mua không mất tiền"; (2) **không có `server-only`** — đây là hằng số hiển thị được, chặn phía client sẽ chặn luôn `wptToVnd`. ⚠️ Từ BE-04 ba hằng số này là **giá trị MẶC ĐỊNH KHI CHƯA CẤU HÌNH**, không còn là giá trị đang có hiệu lực: đọc giá đang dùng bằng `readIssuePriceVnd()` (3.12) |
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
| `DEMO_ACTOR` (BE-12) | trống | Mã tài khoản giả lập ghi vào người lập / người duyệt. Trống = mã mẫu của vai (`SAMPLE_ACCOUNTS` ở `lib/session/channel.ts`). **Không phải xác thực** — AU-01 thay |

**Bí mật trong `env.ts` (không phải cờ):**

| Biến | Mặc định | Ý nghĩa |
|---|:--:|---|
| `SERVER_SIGNER_PRIVATE_KEY` (+ bản theo chain) | — | Khoá ký của ví ngân hàng. Đọc qua `signerPrivateKeyFor(chain)` |
| `KEEPER_SECRET` (BE-07) | **trống = đóng** | Khoá của `POST /api/keeper/distribution`. Tối thiểu **32** ký tự; ngắn hơn thì app **không nạp được cấu hình**. Đọc qua `keeperSecretMatches(token)` |

⚠️ **`KEEPER_SECRET` trống nghĩa là route TỪ CHỐI MỌI yêu cầu (401), không phải mở.** Lời gọi đó
chuyển tiền cho nhà đầu tư, nên hỏng theo chiều mở ở đây là ai biết đường dẫn cũng kích hoạt được
một lượt chia. Giá trị khoá chỉ đọc ở **một chỗ** — `keeperSecretMatches` trong `env.ts`, cùng khuôn
với `signerPrivateKeyFor` — nên route handler không bao giờ cầm chuỗi khoá và một lần `console.log`
bất cẩn ở tầng vận chuyển không in được nó ra nhật ký. Phép so sánh đi hết độ dài chuỗi, không thoát
ra ở ký tự khác đầu tiên: thời gian trả lời mà phụ thuộc nội dung thì dò dần được cả khoá.

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
| `scripts/smoke-test.mjs` | Kiểm khói một bản **đã triển khai** (OP-01) | Không thuộc cơ chế marker; liệt kê ở đây vì cùng ở `scripts/`. Chạy **tay** — xem 2.7 |

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

**34 điểm cắm · 12 điểm chặn**, nhóm theo task đang chờ.

| Task | Loại | Vị trí | Đã sẵn gì (cắm) / thiếu gì (chặn) |
|---|---|---|---|
| `AU-01` | cắm | `app/src/app/actions/session.ts:34` | setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở |
| `BE-05` | cắm | `app/src/lib/store/index.ts:189` | cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ |
| `BE-13` | cắm | `app/src/components/pages/seller-withdraw.tsx:73` | biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút |
| `FE-05` | cắm | `app/src/app/(investor)/trade/page.tsx:4` | đường dẫn /trade, cổng portfolio:read và mục menu "Giao dịch token" đã chạy; previewPurchaseAction và placeOrderAction cũng đã xong đầu cuối — FE-05 chỉ thay phần thân trang này |
| `FE-05` | cắm | `app/src/app/actions/purchase.ts:33` | đã sẵn đầu cuối ở `previewPurchase`: kiểm quyền `order:place`, báo giá, chạy ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy, trả `canPlaceOrder` + `blockers` + `howToFix` cho từng phép kiểm. Màn mua WPT chỉ cần gọi và hiển thị. FE-05 PHẢI chống gọi dồn: hàm này gọi được sau mỗi ký tự người dùng gõ vào ô số lượng, nên màn hình phải hoãn lời gọi và bỏ phản hồi đã cũ — service KHÔNG có bộ nhớ đệm, và cũng không nên có |
| `FE-05` | cắm | `app/src/app/actions/purchase.ts:41` | đã sẵn đầu cuối ở `placeOrder`: validate Zod, kiểm quyền `order:place` (vai INVESTOR), kiểm điều kiện trước khi tạo bản ghi, CHỐT số VNDB tại thời điểm đặt, lưu lệnh `PLACED`, ghi sổ kiểm toán. Màn mua WPT chỉ cần gọi và hiển thị `Result` |
| `FE-05` | cắm | `app/src/lib/bank/purchase.service.ts:125` | đã sẵn đầu cuối: validate Zod dùng chung schema với đặt lệnh, kiểm quyền qua RBAC, báo giá qua ILedgerPort, và ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy. FE-05 chỉ cần gọi rồi hiển thị `blockers` và `howToFix`, KHÔNG viết lại phép kiểm nào ở client, và PHẢI chống gọi dồn khi người dùng gõ số lượng vì mỗi ký tự là một lời gọi |
| `FE-05` | cắm | `app/src/lib/signer/wallet.signer.ts:10` | đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ |
| `FE-06` | cắm | `app/src/app/(investor)/orders/page.tsx:4` | đường dẫn /orders, cổng portfolio:read và mục menu "Quản lý lệnh" đã chạy; listOrdersAction cũng đã xong đầu cuối — FE-06 chỉ thay phần thân trang này |
| `FE-06` | cắm | `app/src/app/(ops)/transactions/page.tsx:4` | đường dẫn /transactions, cổng ops:read (cả hai vai vận hành) và mục menu "Giao dịch" đã chạy; executeOrderAction và listOrdersAction cũng đã xong đầu cuối — FE-06 chỉ thay phần thân |
| `FE-06` | cắm | `app/src/app/actions/purchase.ts:49` | đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai TELLER), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận |
| `FE-06` | cắm | `app/src/app/actions/purchase.ts:57` | đã sẵn đầu cuối ở `listOrders`: phân biệt `order:read` với `order:read:all`, nên "vai nào xem được sổ lệnh nào" là việc của RBAC chứ không phải của màn hình |
| `FE-07` | cắm | `app/src/app/actions/bank.ts:38` | đã sẵn đầu cuối ở `issueInitialSupply`: phát hành NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án, KHÔNG nhận từ input; `amount` tuỳ chọn chỉ chọn số lượng trong trần, bỏ trống = phát hành hết phần còn lại), kiểm quyền `token:mint`, lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi |
| `FE-07` | cắm | `app/src/app/actions/bank.ts:46` | đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một |
| `FE-07` | cắm | `app/src/app/actions/config.ts:18` | đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo |
| `FE-07` | cắm | `app/src/app/actions/config.ts:25` | đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư |
| `FE-08` | cắm | `app/src/app/(ops)/distribution/page.tsx:4` | đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:33` | đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:41` | đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:49` | đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:79` | đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem |
| `FE-08` | cắm | `app/src/app/actions/distribution.ts:86` | vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được |
| `FE-08` | cắm | `app/src/lib/bank/distribution-trigger.service.ts:739` | đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng |
| `FE-09` | cắm | `app/src/app/actions/distribution.ts:57` | đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ |
| `FE-22` | cắm | `app/src/app/(control)/approvals/page.tsx:4` | đường dẫn /approvals, cổng ops:approve:read (chặn Giao dịch viên) và mục menu "Phê duyệt lệnh" kèm số việc chờ đã chạy — FE-22 chỉ thay phần thân |
| `FE-22` | cắm | `app/src/app/(ops-draft)/draft/page.tsx:4` | đường dẫn /draft, cổng ops:draft:read (chặn Kiểm soát viên) và mục menu "Lập lệnh" kèm số việc chờ đã chạy — FE-22 chỉ thay phần thân |
| `FE-22` | cắm | `app/src/app/actions/token-request.ts:19` | previewTokenRequestAction đã sẵn: trả khối kiểm tra đủ mọi điều kiện (quyền lập, dự án, trần còn lại, ví đích, yêu cầu đang chờ; Burn: phần chưa phân phối, token lưu hành) kèm trạng thái từng dòng, không ghi gì — màn Lập lệnh chỉ cần hiển thị |
| `FE-22` | cắm | `app/src/app/actions/token-request.ts:24` | createTokenRequestAction đã sẵn: validate Zod, kiểm quyền order:draft, kiểm lại điều kiện, ghi yêu cầu PENDING (chưa tác động token) và sổ kiểm toán; trượt thì trả REQUEST_CHECK với fieldErrors khoá theo mã điều kiện |
| `FE-22` | cắm | `app/src/app/actions/token-request.ts:29` | approveTokenRequestAction đã sẵn: kiểm quyền order:approve, chặn người lập tự duyệt, kiểm lại toàn bộ điều kiện lúc duyệt, chiếm quyền bằng UPDATE có điều kiện rồi thực hiện trên ví SPV và ghi mã giao dịch |
| `FE-22` | cắm | `app/src/app/actions/token-request.ts:34` | rejectTokenRequestAction đã sẵn: bắt buộc lý do, kiểm quyền order:approve, chặn tự từ chối, chuyển REJECTED không tác động token, ghi sổ kể cả lần bị chặn |
| `FE-22` | cắm | `app/src/app/actions/token-request.ts:39` | listTokenRequestsAction đã sẵn: lọc theo chuỗi, loại, trạng thái, mới nhất trước; mở cho hai vai vận hành qua ops:read |
| `FE-23` | cắm | `app/src/app/(investor)/withdraw/page.tsx:4` | đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend |
| `FE-24` | cắm | `app/src/app/(account)/account/page.tsx:4` | đường dẫn /account, cổng balance:read (cả bốn vai) và mục menu "Thông tin tài khoản" của cả bốn vai đã chạy — FE-24 chỉ thay phần thân trang này |
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

Tám khoá trong `SystemConfig`, khai ở `CONFIG_KEYS` (`lib/config/issue-terms.ts`):

| Khoá | Kiểu | Mặc định trong mã | Nạp sẵn? | Đọc bằng |
|---|---|---|---|---|
| `wpt.issue_price_vnd` | `bigint` | `WPT_ISSUE_PRICE_VND` = 100.000 | có | `readIssuePriceVnd()` |
| `wpt.price_change_threshold` | `number` | `WPT_PRICE_CHANGE_THRESHOLD` = 2 | có | `readPriceChangeThreshold()` |
| `distribution.batch_size` | `number` | `DISTRIBUTION_BATCH_SIZE` = 50 | có | `readDistributionBatchSize()` |
| `distribution.dust_wallet` | `string` | **không có** | **không** | `readDistributionDustWallet()` |
| `distribution.max_batches_per_run` | `number` | `DISTRIBUTION_MAX_BATCHES_PER_RUN` = 5 | **không** | `readDistributionMaxBatchesPerRun()` |
| `distribution.min_new_balance` | `bigint` | `DISTRIBUTION_MIN_NEW_BALANCE` = 1.000 | **không** | `readDistributionMinNewBalance()` |
| `distribution.stuck_after_runs` | `number` | `DISTRIBUTION_STUCK_AFTER_RUNS` = 3 | **không** | `readDistributionStuckAfterRuns()` |
| `distribution.last_settled_balance` | `bigint` | **0** | **không** | `readDistributionSettledBalance()` |

⚠️ **`distribution.last_settled_balance` không phải tham số vận hành, nó là TRẠNG THÁI** do
`distribution-trigger.service.ts` tự ghi sau mỗi kỳ chia xong (xem 3.14). Nó ở cùng bảng vì bảng này
đã có sẵn lịch sử đổi giá trị, và lịch sử đó chính là vết "mốc đã chuyển từ đâu sang đâu, vì kỳ nào".
Người vận hành **không sửa tay** khoá này: đặt cao hơn thực tế thì tiền nằm lại trong ví vĩnh viễn,
đặt thấp hơn thì hệ thống mở một kỳ chia trên số tiền đã chia rồi.

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

## 3.14. Tiến trình tự động chia lợi nhuận (BE-07)

`lib/bank/distribution-trigger.service.ts` + `app/api/keeper/distribution/route.ts`.
Bản đồ luồng ở **4.5** (các bước 11–14); mục này nói **cơ chế** và **cạm bẫy**.

### Hai ràng buộc kỹ thuật quyết định toàn bộ thiết kế

**1. Hợp đồng trên chuỗi không tự chạy được.** Nhận token ERC-20 chỉ cập nhật bảng số dư, nó không
kích hoạt được mã trong hợp đồng nhận. Và cho dù SPV gọi một hàm nạp tiền tường minh, việc chuyển
tiền cho hàng trăm ví **không nằm được trong cùng một giao dịch** vì vượt giới hạn tài nguyên. Vì vậy
vẫn phải có một tiến trình **ngoài chuỗi** phát hiện và kích hoạt. "Tự động" nghĩa là **không cần
người bấm**, không phải hợp đồng tự chạy.

**2. Chưa có Indexer.** Phát hiện tiền vào làm bằng cách **hỏi định kỳ** số dư ví lợi nhuận rồi so
với mốc đã xử lý. Nợ kỹ thuật đã ghi ở 1.6.C; điểm cắm `@pending IN-02` nằm ngay trên `detectNewFunds`.

### Mốc số dư là "số dư dự kiến còn lại", KHÔNG phải tổng đã nhận

Đây là chỗ dễ hiểu sai nhất. Chia lợi nhuận **làm giảm** số dư ví lợi nhuận:
`ProfitDistributor.distributeTo` chuyển VNDB ra khỏi hợp đồng, và `mock.adapter` làm đúng thế
(`s.profitPool -= total`). Nên một mốc kiểu "tổng tiền đã nhận luỹ tiến" sẽ lớn hơn số dư thật ngay
sau kỳ đầu tiên, và **mọi** lần so sánh về sau đều kết luận sai là "số dư giảm".

Mốc đúng là số dư ta **dự kiến** còn thấy khi không có tiền mới, tức phần dư làm tròn của kỳ vừa tất
toán: `mốc mới = period.totalAmount − run.paidAmount`.

⚠️ **Không lấy mốc bằng cách đọc lại `profitPoolBalance` sau khi chia**, dù nghe tương đương. Giữa
lúc mở kỳ và lúc chia xong, SPV có thể đã nạp thêm; đọc lại số dư sẽ đưa cả số tiền mới đó vào mốc và
nó **vĩnh viễn không được chia cho ai**. Tính từ con số của kỳ thì phần vượt quá mốc còn nguyên trong
ví và lượt sau nhận ra nó là tiền mới.

### Chống chạy trùng: khoá ghép `<mã kỳ>#<số vòng>`

Ràng buộc duy nhất `(jobName, periodKey)` của `KeeperRun` cho một công việc chạy **đúng một lần** cho
một khoá. Dùng thẳng mã kỳ chia thì vòng thứ hai của cùng một kỳ không bao giờ chạy được — mà chia
nhiều vòng là bắt buộc vì một lượt chỉ gửi tối đa `distribution.max_batches_per_run` lô.

Ghép số vòng giải cả hai: hai vòng **đồng thời** cùng đếm ra số vòng giống nhau nên cùng xin một
khoá và ràng buộc loại một vòng; hai vòng **nối tiếp** đếm ra hai số khác nhau nên cả hai chạy được.
Vòng không có việc dùng khoá `idle#<mốc thời gian ISO>`.

⚠️ **Ràng buộc duy nhất là trọng tài, KHÔNG phải phép kiểm trong mã.** `claimRun` gọi `startRun` rồi
coi `UniqueConstraintError` là tín hiệu "một vòng khác đã nhận việc". Đọc trước bằng `findRun` rồi
mới ghi thì hai vòng đồng thời đều thấy "chưa có" và đều chạy.

### Thứ tự các bước, và vì sao không đảo được

| # | Bước | Ghi được chưa |
|---|---|---|
| 1 | Kiểm quyền `distribution:execute` | — |
| 2 | Đọc số dư ví lợi nhuận + mốc đã xử lý, quyết định (`detectNewFunds`) | **chưa** |
| 3 | Chiếm chỗ chạy (`startRun`) | từ đây mới ghi |
| 4 | Mở kỳ (nếu mới) rồi chia theo lô — **gọi lại BE-06** | có |
| 5 | Cập nhật mốc nếu kỳ xong trọn vẹn (`settleBalanceMark`) | có |
| 6 | Đóng dòng `KeeperRun` + ghi sổ kiểm toán | có |

⚠️ **Bước 2 xét "có kỳ nào đang dở" TRƯỚC, rồi mới so số dư.** Bắt buộc: giữa lúc mở kỳ và lúc chia
xong, tiền ra khỏi ví lợi nhuận từng lô một, nên số dư **nhỏ hơn mốc** là chuyện bình thường. Đảo thứ
tự thì mọi kỳ chia dở đều bị kết luận "số dư giảm bất thường" và tiến trình dừng hẳn giữa lúc đang
chia đúng.

⚠️ **Bước 2 nằm trước bước 3, khác lời khuyên "gọi `startRun` trước khi làm việc" ở
`keeper.store.port.ts`.** Chủ đích: khoá chiếm chỗ mang mã kỳ nên phải biết kỳ nào trước khi xin
khoá. Không mất gì vì bước 2 **chỉ đọc** — hai vòng đồng thời cùng đọc ra cùng một kết luận, rồi cùng
xin một khoá, và ràng buộc loại một vòng **trước** khi vòng đó ghi dòng nào hay gửi giao dịch nào.

### Năm kết cục bình thường và hai bất thường

| Kết cục | `Result` | Nghĩa |
|---|---|---|
| `NO_NEW_FUNDS` | `ok` | Số dư đúng bằng mốc |
| `BELOW_MIN_NEW_BALANCE` | `ok` | Tăng nhưng chưa tới `distribution.min_new_balance` |
| `ALREADY_RUNNING` | `ok` | Một vòng khác đang giữ chỗ — hai lượt gọi trùng nhau, không phải lỗi |
| `DISTRIBUTED` | `ok` | Đã chia và kỳ hoàn tất |
| `PARTIAL` | `ok` | Đã chia một phần; lượt sau chia tiếp đúng kỳ đó |
| số dư **giảm** | `err('PERIOD_STATE')` | Tiền ra khỏi ví bằng đường không qua hệ thống |
| ví thiếu tiền cho phần còn phải chia | `err('INSUFFICIENT_PROFIT_POOL')` | Dừng trước khi gửi lô nào |

Hai bất thường trả về **lỗi** chứ không phải `ok` mang cờ, vì người gọi phải xử lý khác nhau: `ok`
thì chỉ ghi nhật ký rồi chờ lượt sau, còn lỗi thì phải báo người vận hành. Gói cả hai vào `ok` là
buộc mọi người gọi phải nhớ đọc thêm một trường nữa mới biết có chuyện. Cả hai **vẫn** để lại dòng
`KeeperRun` ở `FAILED` kèm lý do và một bản ghi kiểm toán `FAILURE`.

### Lưu ý khi phát triển

- **Mọi lời gọi danh sách đều truyền giới hạn tường minh và TỪ CHỐI khi chạm ngưỡng.** `listRuns`,
  `listPeriods`, `listPayouts` đều mặc định `limit = 50`. Đếm số vòng trên danh sách bị cắt cho số
  nhỏ hơn thực tế, và hệ quả là khoá vòng trùng khoá đã có nên `startRun` trượt và **tiến trình tự
  khoá chính nó**; còn tổng còn phải chia đếm thiếu thì nó chia quá số tiền có trong ví.
- **Mã kỳ tự sinh đếm trên MỌI chuỗi**, không lọc theo chain: `periodKey` duy nhất **toàn hệ** (ràng
  buộc của cơ sở dữ liệu không có cột `chain`), nên đếm riêng từng chuỗi sẽ sinh ra mã đã có ở chuỗi
  khác. Ngày lấy theo **UTC**, không theo giờ địa phương.
- **`error` của `KeeperRun` chỉ mang thông báo khi thất bại.** Tóm tắt của vòng thành công đi vào sổ
  kiểm toán. Lý do và hướng xử lý ở 1.6.C.
- **Kiểm "ví đủ tiền" chỉ cần cho kỳ ĐANG DỞ.** Với kỳ mới, `openPeriod` chốt `totalAmount` bằng đúng
  số dư ví tại ảnh chụp và đọc lại để chắc nó không đổi, mà tổng phân bổ luôn `<= totalAmount` vì
  phép chia lấy phần nguyên.
- **Đừng dựng bộ hẹn giờ trong ứng dụng.** Trên VPS nhiều bản chạy song song thì **mỗi bản** chạy một
  bộ hẹn giờ, tức mỗi lịch nổ nhiều lần; trên free-tier serverless thì không tiến trình nào sống đủ
  lâu để lịch nổ lần nào. Hai lỗi ngược nhau, cùng một nguyên nhân.

### Cách mở rộng

1. **Thêm một công việc theo lịch** → thêm tên vào `JOBS` của
   `app/api/keeper/distribution/route.ts` + một nhánh gọi service. Không mở route công khai mới.
2. **Đổi nguồn tín hiệu sang sự kiện on-chain** → chỉ sửa `detectNewFunds`, giữ nguyên bốn nhánh
   quyết định và toàn bộ phần chia (đó là ý của marker `@pending IN-02`).
3. **Đổi ngưỡng / số lô / số vòng treo** → sửa dòng trong `SystemConfig`, **không** sửa mã.
4. **Thêm kênh nhận diện người gọi khác** (chữ ký HMAC, mTLS) → thêm hàm cạnh `keeperSecretMatches`
   trong `env.ts`. Giá trị bí mật vẫn chỉ đọc ở một tệp đó.

## 3.15. Khung bốn vai trò (FE-20)

Task **chỉ dựng khung**, không làm nghiệp vụ. Bảng vai trò và bảng khu vực ở 1.1; ma trận quyền ở
3.3. Phần này nói những tệp mới và những quyết định không đọc ra được từ hai bảng đó.

| Tệp | Vai trò |
|---|---|
| `lib/rbac/area-gates.ts` | `AREAS` (7), `AREA_GATES`, `AREA_LABELS` — cổng vào từng khu vực, **dữ liệu thuần** |
| `lib/session/channel.ts` | 4 khu vực + `CHANNEL_HOME` + `CHANNEL_ROLE` + `ROLE_CHANNEL` (suy ra) + `homeForRole()` |
| `lib/nav/pending-work.ts` | `pendingWorkCounts()` — số việc đang chờ, đếm thật từ BE-12 qua `countPendingWork()`; `server-only` |
| `components/layout/nav-config.ts` | `NAV_BY_ROLE` — 4 menu, mỗi menu là **danh sách nhóm** |
| `components/pages/placeholder.tsx` | `PlaceholderPage` — khuôn trang chỗ trống, dùng ở 11 trang |
| `test/four-roles-shell.test.ts` | Menu khớp tài liệu yêu cầu, khu vực ↔ vai, số việc chờ |
| `test/four-roles-routes.test.ts` | Đọc **cây route thật** trên đĩa rồi đối chiếu với bảng khu vực |

**`NavSection` là danh sách nhóm, không phải hai nhóm cố định.** Kiểm soát viên cần **ba** nhóm
theo tài liệu yêu cầu (Vận hành, Kiểm soát, Tài khoản); hình dạng cũ (`main` + một `moduleLabel` +
`modules`) chỉ chứa được hai, nên nhồi nhóm thứ ba vào đó là bày sai cấu trúc đã chốt.

**Số việc đang chờ: mục menu mang KHOÁ, không mang con số.** `nav-config.ts` là dữ liệu tĩnh bị
`sidebar.tsx` (`'use client'`) nhập vào, còn con số phải đọc lúc chạy. Để con số ở đó thì nó bị
đóng băng vào module. Nguồn số nằm ở tệp riêng vì BE-12 sẽ biến nó thành `server-only` — đặt chung
thì lần đó làm vỡ build của mọi component nhập `nav-config`, và triệu chứng hiện ra rất xa nguyên nhân.

⚠️ **Số 0 ở đây là khẳng định ĐÚNG, không phải chỗ trống.** Từ BE-12: `draft` = yêu cầu người này
đã lập đang chờ duyệt, `approval` = yêu cầu NGƯỜI KHÁC lập đang chờ — yêu cầu của chính mình không
phải việc chờ mình duyệt. Khác trang tổng quan nhà đầu tư, nơi số 0 lúc chưa kết nối ví là khẳng định
SAI và phải thay bằng lời mời kết nối (FE-01 R5.3).

**Trang chỗ trống là trang THẬT, không phải mục menu mờ.** Mỗi trang nói ba thứ theo thứ tự người
đọc cần: màn này sẽ làm gì, task nào thay thế, và khung đã sẵn gì (để task đó không dựng lại đường
dẫn, guard, menu). Mục menu mờ (`NavItem.disabled`) bấm không ra trang nào nên không có chỗ ghi ba
thứ đó — người dùng chỉ thấy một mục xám, người nhận task sau không có gì để đọc.

**Năm màn có từ trước tài liệu yêu cầu vẫn còn mã nhưng KHÔNG trong menu:** `/mint`, `/kyc`,
`/assets`, `/reconciliation`, `/audit`. Menu phải khớp tài liệu, mà tài liệu không có chúng; xoá mã
thì mất màn đang chạy. Trang `/draft` ghi lại việc này cho FE-22 quyết định màn nào gộp vào Lập
lệnh. Có phép kiểm chốt **cả hai chiều**: mã còn, và menu không có.

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Thêm vai thứ năm | `ROLES` → `ROLE_PERMISSIONS` → `CONFIG_ROLES` → `CHANNELS` + `CHANNEL_ROLE` + `CHANNEL_HOME` → `NAV_BY_ROLE`. Bốn bảng đầu là `Record` đủ khoá nên quên chỗ nào là **lỗi biên dịch** |
| Thêm khu vực | `AREAS` + `AREA_GATES` + `AREA_LABELS`, rồi một route-group cùng tên trong `AREA_DIR` của `four-roles-routes.test.ts`. Cổng phải là quyền mà đúng tập vai đó có |
| Nối số việc chờ thật | Thay thân `pendingWorkCounts()`. Hàm đã `async` sẵn nên không phải sửa `AppLayout` |
| Thêm mục mang số việc chờ | Thêm khoá vào `PendingWorkKey`; `PendingWorkCounts` là `Record` đủ khoá nên quên nguồn số là lỗi biên dịch |
| Thay một trang chỗ trống | Sửa đúng `page.tsx` đó và **xoá marker** `@pending` trên khai báo |


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
| 2 | `bank/authorize.ts` | `authorize('order:execute')` — quyền của **TELLER**, tách khỏi `order:place` |
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
| `expireStaleOrders()` | `order:expire` (TELLER) | Chỉ nhắm `PLACED`. **Không** dựng lịch ở đây — việc gọi định kỳ thuộc BE-07, và cố ý **không** mở điểm vào HTTP |

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

## 4.3. Luồng PHÁT HÀNH (đã hoàn thành — BE-04, nhiều lần + lập–duyệt từ BE-12)

> **Sơ đồ sinh tự động từ marker `@flow`: `docs/flows/issue.md` (9 bước).** Đừng sửa tay tệp đó —
> sửa marker trong mã rồi chạy `node scripts/gen-flow-diagram.mjs issue`.

**Nghiệp vụ:** phát hành WPT vào **ví thanh toán SPV**, **nhiều lần**, mỗi lần không vượt **trần còn
lại** = `Project.totalSupply` − tổng cung hiện tại trên chuỗi. WPT đến tay nhà đầu tư qua
`executeOrder` (chuyển từ ví SPV). Hai đường vào, cùng một lõi:

```
app/actions/bank.ts :: issueInitialSupplyAction()          ← điểm cắm FE-07, quyền token:mint
   └──→ issuance.service.ts :: issueInitialSupply() ──┐
app/actions/token-request.ts :: approveTokenRequestAction()  ← điểm cắm FE-22, quyền order:approve
   └──→ token-request.service.ts :: approveTokenRequest() ─┤
                                                           └──→ executeIssuance()  (không kiểm quyền)
```

**Bên trong `executeIssuance()`:**

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `ledger.isInitialSupplyMinted()` + `project.issuedAt` | Chuỗi đã phát hành mà bảng chưa ghi mốc → `ORDER_STATE`, **đòi đối soát** |
| 2 | `remainingIssuanceCap()` | `amount` > trần còn lại → `ISSUANCE_CAP`, **không gửi giao dịch** |
| 3 | `ledger.spvWallet()` (lần sau lần đầu) | Ví nhận khác ví SPV chuỗi đã ghi → `VALIDATION` |
| 4 | Lần đầu `ledger.mintInitialSupply()`, các lần sau `ledger.mint()` | Lần đầu là lần chuỗi ghi ví SPV, luồng mua đọc ví đó |
| 5 | `trackTxn()`: `saveTxn` chờ → `onSubmitted` → `waitReceipt` | Lưu **trước** khi đợi; `onSubmitted` là chỗ lần duyệt gắn mã giao dịch vào yêu cầu |
| 6 | Lần đầu: `projectStore.markIssued()` | Khoá lạc quan; trả `null` → `ORDER_STATE` + audit `FAILURE` |
| 7 | Đọc lại tổng cung **từ chuỗi** | Sự thật cuối cùng, trả kèm `remainingCap` |

**Ai ký:** ví ngân hàng (`getBankSigner(chain)`), ở cả hai đường. Trên chuỗi `mock` `actorAddress`
để `null` — địa chỉ đó là **dữ liệu đối soát**, không phải đầu vào của phép kiểm quyền nào.

**Trần KHÔNG đến từ input.** Input chỉ chọn số lượng LẦN NÀY; trần đọc từ bảng dự án, tổng cung đọc
từ chuỗi. **Không** cộng dồn "đã phát hành" trong cơ sở dữ liệu: Burn làm giảm tổng cung, một bộ đếm
riêng sẽ lệch chuỗi ngay lần Burn đầu tiên.

### Lập–duyệt yêu cầu Mint / Burn (BE-12)

```
PENDING ──► EXECUTING ──► COMPLETED
   │            └──► FAILED
   └──► REJECTED
```

| Bước | Hàm | Điều kiện / chặn |
|---|---|---|
| Xem trước | `previewTokenRequest()` | Trả **mọi** điều kiện kèm trạng thái, không ghi gì: quyền lập, dự án, trần còn lại, ví đích, không có Mint khác đang chờ cùng token; Burn: có ví SPV, không vượt phần chưa phân phối, `TOTAL_SUPPLY` chỉ khi không còn token lưu hành |
| Lập | `createTokenRequest()` | `order:draft`; trượt điều kiện → `REQUEST_CHECK`, `fieldErrors` khoá theo mã điều kiện. Đạt → dòng `PENDING`, **chưa tác động token** |
| Duyệt | `approveTokenRequest()` | `order:approve`; người lập = người duyệt (so **mã tài khoản**) → `SELF_APPROVAL`; **kiểm lại toàn bộ điều kiện**, đổi → `REQUEST_CHECK`, yêu cầu **giữ `PENDING`**; chiếm quyền `PENDING → EXECUTING` bằng `UPDATE` có điều kiện, `null` → `REQUEST_STATE`; rồi `executeIssuance` / đốt ở ví SPV |
| Từ chối | `rejectTokenRequest()` | Bắt buộc lý do (thiếu → `VALIDATION` + audit `FAILURE`); chặn tự từ chối; `PENDING → REJECTED`, không tác động token |
| Đếm việc chờ | `countPendingWork(role, actorId)` | Theo **quyền**: `order:draft` đếm yêu cầu mình lập đang chờ; `order:approve` đếm yêu cầu người khác lập đang chờ |

**Vì sao năm trạng thái, không phải ba.** `EXECUTING` là đích của lần chiếm quyền — không có nó thì
phải đánh `COMPLETED` **trước** khi gửi giao dịch, và tiến trình chết giữa chừng để lại một yêu cầu
trông như xong mà token chưa đổi. `FAILED` tách "chuỗi không thực hiện được" khỏi "Kiểm soát viên
không đồng ý". Lỗi **sau** khi đã gửi giao dịch thì yêu cầu **ở nguyên `EXECUTING`** kèm mã giao
dịch cho người đối soát — không biết kết cục thì không được nói "chưa tác động".

**Sổ kiểm toán:** mọi bước ghi một dòng `order:draft` / `order:approve` (`SUCCESS`, `FAILURE` khi
điều kiện chặn, `DENIED` khi thiếu quyền hoặc tự duyệt); tác động token ghi thêm `token:mint` /
`token:burn` kèm mã yêu cầu, người lập, người duyệt.

**Nợ đã biết của luồng này:** `evm.adapter` chưa nối `mintInitialSupply`, `isInitialSupplyMinted`,
`spvWallet` — chờ **SC-02**. Trên chuỗi thật luồng này chưa chạy; trên `mock` đã chạy đầu cuối, cả
hai đường vào. Xem bảng điểm cắm ở 3.10.

---

## 4.4. Luồng REDEEM — hoàn vốn (P2, chưa xây)

**Nghiệp vụ:** nhà đầu tư trả lại **WPT**, nhận về **VNDB** theo tỷ giá. WPT bị **đốt**, tổng cung giảm.

**Khác biệt then chốt so với mint:** giao dịch này do **nhà đầu tư ký bằng ví của họ** (`wallet.signer.ts`), không phải khóa ngân hàng. Và cần **hai giao dịch**: `approve` rồi mới `redeem`, vì `Redemption.redeem()` gọi `burnFrom` nên phải tiêu allowance mà nhà đầu tư đã cấp.

**Đường đi dự kiến:**

```
components/pages/redeem.tsx  (khu vực (investor))
   └─ redeemAction() ──→ app/actions/bank.ts
         └───────────────→ lib/bank/redeem.service.ts :: redeemTokens()
```

| Bước | File / hàm cần tạo hoặc dùng | Việc |
|---|---|---|
| 1 | `bank/schemas.ts` → thêm `redeemSchema` | Validate `wptAmount` |
| 2 | `rbac/permissions.ts` — quyền **đã có sẵn** từ BE-08: `settlement:confirm` (INVESTOR), `settlement:initiate` + `settlement:set-nav` (TELLER) | **KHÔNG** thêm `token:redeem`: BE-08 đã chốt tiền tố `settlement:*` vì luồng chốt là ngân hàng điều phối và đốt, không phải nhà đầu tư tự đổi |
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

**Lưu ý mở rộng:** nên thêm màn hình quản trị thanh khoản ở khu vực `(ops)` (xem quỹ, nạp thêm, tạm dừng) — vì `redeem` sẽ fail hàng loạt nếu hết VNDB.

---

## 4.5. Luồng DISTRIBUTION — chia lợi nhuận (BE-06 ✅ tầng BE, chạy đủ trên `mock`)

> Sơ đồ sinh từ marker: **`docs/flows/distribute.md`** (14 bước — 1–10 của BE-06, 11–14 của BE-07).
> Đừng sửa tay tệp đó.
> ⚠️ Số bước `@flow` đánh số **các hàm** trên đường đi; bảng trong mục này đánh số **các bước bên
> trong một hàm**. Hai hệ đánh số khác nhau, đọc chéo bằng số bước sẽ ra kết luận sai.

**Nghiệp vụ:** SPV nạp VNDB vào ví chia lợi nhuận → ngân hàng chốt quyền tại một thời điểm → toàn bộ
số dư ví đó chia cho người nắm giữ WPT **theo tỷ lệ tại thời điểm chốt**.

**Trạng thái:** tầng nghiệp vụ xong đầu cuối và chạy đủ trên chain `mock`
(`test/distribution-service.test.ts` 43 ca, `test/distribution-trigger.test.ts` 45 ca). Trên `evm`
còn chờ contract — `distributeBatch` của `evm.adapter` vẫn ném `LedgerNotImplementedError`, xem bảng ở
3.10. **Chưa có giao diện** (FE-08, FE-09), có điểm cắm `@pending` trỏ tới.

**Hai đường vào, một nghiệp vụ.** Cán bộ ngân hàng bấm từng bước (BE-06, giai đoạn 1–3 dưới đây), hoặc
tiến trình định kỳ tự làm cả ba (BE-07, giai đoạn 4). Đường thứ hai **gọi lại** đúng các hàm của đường
thứ nhất, không có đường chia tiền thứ hai — hai đường thực thi cho cùng một việc sẽ lệch nhau ở lần
sửa đầu tiên, và lúc đó số tiền nhà đầu tư nhận được phụ thuộc việc ai bấm.

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
| 2 | `readDistributionBatchSize()` + `readDistributionMaxBatchesPerRun()` | khoá `distribution.batch_size` (50) và `distribution.max_batches_per_run` (5) — xem 3.13 |
| 3 | `collectRecipients()` rồi `allocate()` cho ví **chưa có hồ sơ** | chạm giới hạn quét → từ chối |
| 4 | `createPayouts(...)` ở `PENDING`, chia theo `MAX_BULK_ROWS` | ★ **trước khi gửi giao dịch nào** |
| 5 | hồ sơ `amount = 0` → `PAID` luôn, không vào lô nào | chuyển 0 đồng tốn một chỗ trong lô mà không chuyển gì |
| 6 | kỳ `OPEN` → `DISTRIBUTING` | chỉ khi thật sự có lô để gửi |
| 7 | mỗi lô: `distributeBatch` → `SENT` + `txHash` → `waitReceipt` → `PAID` hoặc `FAILED` | lô lỗi **không** dừng các lô còn lại; **dừng sau `maxBatches` lô** (BE-07) |
| 8 | hết hồ sơ khác `PAID` → kỳ `COMPLETED` + `completedAt` | `completedAt` do nghiệp vụ truyền, cổng không tự đặt |

⚠️ **Từ BE-07, hàm này KHÔNG hứa chia xong cả kỳ trong một lời gọi.** Nó dừng sau
`distribution.max_batches_per_run` lô và để `outstanding` khác 0 — kết cục **bình thường**, không phải
lỗi. Lý do: vòng gửi lô chờ biên nhận từng giao dịch, nên với vài nghìn ví nó vượt mọi giới hạn thời
gian của nền chạy; bị cắt giữa lượt thì phần đã gửi đã ghi hồ sơ còn phần chưa gửi không ai biết là
còn hay hết. Mọi người gọi — cán bộ bấm ở FE-08 hoặc tiến trình định kỳ — phải gọi lại tới khi
`outstanding` bằng 0.

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
| Phát hiện tiền vào bằng **sự kiện** thay vì hỏi định kỳ | IN-01, IN-02 — xem 1.6.C |

### Giai đoạn 4 — tự động: `runDistributionCycle()` (BE-07)

Cơ chế đầy đủ, cạm bẫy và cách mở rộng ở **3.14**. Ở đây chỉ là đường đi.

```
cron của hạ tầng ──→ POST /api/keeper/distribution   (Authorization: Bearer $KEEPER_SECRET)
cán bộ bấm "chạy ngay" ──→ runDistributionCycleAction()
        └──────────────────→ lib/bank/distribution-trigger.service.ts :: runDistributionCycle()
                                   ├─ detectNewFunds()        đọc số dư, so mốc đã xử lý
                                   ├─ startRun()              chiếm chỗ chạy `<mã kỳ>#<số vòng>`
                                   ├─ openPeriod()            ← giai đoạn 1, chỉ khi là kỳ mới
                                   ├─ distributePeriod()      ← giai đoạn 3, tối đa maxBatches lô
                                   ├─ settleBalanceMark()     chỉ khi outstanding = 0
                                   └─ finishRun() + appendAudit()
```

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `distributionCycleSchema.safeParse` | chain sai dạng → `VALIDATION` |
| 2 | `authorize('distribution:execute', ...)` | vai không có quyền → `FORBIDDEN`, ghi audit `DENIED` |
| 3 | `profitPoolBalance()` + `readDistributionSettledBalance()` | — (chỉ đọc) |
| 4 | `detectNewFunds()` | số dư giảm → `PERIOD_STATE`; dưới ngưỡng → `ok` `BELOW_MIN_NEW_BALANCE` |
| 5 | `startRun(jobName, '<mã kỳ>#<số vòng>')` | khoá đã có chủ → `ok` `ALREADY_RUNNING`, **dừng ngay** |
| 6 | kỳ mới: `openPeriod()`; kỳ đang dở: kiểm ví đủ tiền cho phần còn phải chia | thiếu tiền → `INSUFFICIENT_PROFIT_POOL`, **chưa gửi lô nào** |
| 7 | `distributePeriod()` | lỗi → đóng `KeeperRun` ở `FAILED`, trả lỗi của BE-06 |
| 8 | `outstanding = 0` → `settleBalanceMark()` | còn ví chưa nhận → **giữ mốc cũ**, lượt sau chia tiếp |
| 9 | `runNo >= distribution.stuck_after_runs` và còn ví chưa nhận → cảnh báo | `KeeperRun` `FAILED` + audit `FAILURE` |

**Ai ký:** vẫn là ví ngân hàng, vì bước 6–7 gọi lại đúng hàm của BE-06. Khoá `KEEPER_SECRET` **không**
ký gì; nó chỉ trả lời "người gọi có phải tiến trình định kỳ của mình hay không".

**Điểm vào này cũng chạy công việc dọn lệnh treo** (`job: "expire-orders"` → `expireStaleOrders` của
BE-02, xem 4.2). Cùng một đường vì cả hai đều là công việc theo lịch, và đường đó đã có khoá bí mật —
`api/purchase/route.ts` cố ý **không** mở điểm vào công khai cho nó.

---

## 4.6. Chu kỳ nghiệp vụ đầy đủ

Tham chiếu `packages/contracts-evm/scripts/demo-cycle.js` — kịch bản đã chạy được ở tầng contract:

```
1. KYC + whitelist nhà đầu tư A, B
2. Ngân hàng mint WPT: A = 6.000, B = 4.000            → luồng MINT (P1 ✅)
2'. (hoặc) A, B đặt lệnh mua rồi ngân hàng khớp lệnh   → luồng MUA WPT (BE-02 ✅ trên mock)
3. Chốt kỳ Q1, nạp 300.000.000 VNDB lợi nhuận
   openPeriod → takeSnapshot → distributePeriod         → luồng DISTRIBUTION (BE-06 ✅ trên mock)
3'. (hoặc) cron gọi /api/keeper/distribution, tiến trình
   tự phát hiện tiền vào rồi làm cả ba bước trên        → TỰ ĐỘNG CHIA (BE-07 ✅ trên mock)
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
| — | BE-06 nghiệp vụ chia lợi nhuận: chốt quyền, xem trước, chia theo lô, chạy lại (xem 4.5) | ✅ Xong — PR #26 |
| — | BE-07 tự động chia khi ví lợi nhuận nhận tiền: phát hiện, chống chạy trùng, chia nhiều lượt, cảnh báo kỳ treo, điểm vào cho cron (xem 3.14, 4.5 giai đoạn 4) | 🔶 Mã xong trên nhánh `feat/distribution-trigger`, **chưa nghiệm thu, chưa merge vào `dev`** |
| — | OP-01 tích hợp liên tục + cổng bảo vệ `dev` + tạm dừng Stellar ở khâu kiểm chứng (xem 2.6, 2.7) | 🔶 Mã xong trên nhánh `op/01-ci`, **chưa nghiệm thu, chưa merge vào `dev`** |
| — | BE-12 lập–duyệt yêu cầu Mint/Burn + phát hành nhiều lần theo trần còn lại + số việc đang chờ thật (xem 4.3) | 🔶 Mã xong trên nhánh `feat/maker-checker`, **chưa nghiệm thu, chưa merge vào `dev`** |
| P2 | **REDEEM** (`Redemption.sol`) — BE-05 tất toán | ⏳ Kế tiếp |
| P3 | **DISTRIBUTION** trên chuỗi thật: `evm.adapter.distributeBatch` + `EnergyOracle` | ⏳ Tầng BE đã xong ở BE-06; còn chờ SC-03 và `providers/oracle/` |
| P4 | KYC/audit/RBAC thật + Postgres + xác thực SIWE | ⏳ |
| P5 | Fireblocks thay khóa server; freeze/clawback trên UI | ⏳ |
| P6 | EVM testnet | ⏳ |
| P7 | Stellar (Soroban) | ⏸ **TẠM DỪNG** từ OP-01 — mã nguồn giữ nguyên, không thuộc khâu kiểm chứng (xem 2.6) |

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

# Chạy riêng từng phần — ĐÚNG các phần mà .github/workflows/ci.yml gọi (xem 2.7)
bash scripts/run-local-all.sh --list                              # danh sách phần
bash scripts/run-local-all.sh arch markers checkpoint app         # việc A
bash scripts/run-local-all.sh contracts                           # việc B
bash scripts/run-local-all.sh build e2e                           # việc C (cần mạng)

# Bảng quyền có teo lại so với nền hay không (mặc định nền là origin/dev)
RBAC_BASE_REF=origin/dev bash scripts/verify-arch-rules.sh

# Kiểm khói một bản đang chạy (chạy TAY, chưa gắn vào triển khai)
node scripts/smoke-test.mjs http://localhost:3000
node scripts/smoke-test.mjs https://<địa-chỉ> --expect-commit=$(git rev-parse HEAD)
```
