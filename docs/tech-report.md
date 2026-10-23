---
inclusion: always
---

# BÁO CÁO CÔNG NGHỆ — BIDV RWA TOKENIZE (TOKEN HÓA DỰ ÁN ĐIỆN GIÓ)

> **Tài liệu sống.** Kiro bắt buộc cập nhật file này sau mỗi thay đổi mã nguồn, theo quy tắc trong `docs/tech-report-maintenance.md`.
> Đây là nguồn tham chiếu đầu tiên cho dev mới tiếp nhận source.

| Trường | Giá trị |
|---|---|
| Phiên bản tài liệu | 4.23 |
| Cập nhật lần cuối | 2026-10-24 |
| Nhánh / commit | `feat/in-01-indexer`, từ `dev` @ `2fbdde8`; spec `docs/in-01-indexer/` bản 2 |
| Phase đã hoàn thành | P0 (nền), P1 (mint), vòng dọn UI điện gió, P4 (mint trên Sepolia), tiếp nhận bộ test nghiệm thu P4/P7/P12, build+deploy Cloudflare (PR #12), FE-01 v2 (kênh nhà đầu tư + trang tổng quan), BE-01 (mở rộng `ILedgerPort` cho ba luồng), FE-02 (màn kết nối ví), BE-02 (nghiệp vụ lệnh mua WPT), BE-03 (xem trước điều kiện mua), BE-08 (bổ sung quyền RBAC cho ba luồng — **phục hồi** sau khi bị revert khỏi `dev`, xem `docs/CHECKPOINT_BE08.md`), BE-09 (mở rộng lược đồ dữ liệu + bốn cổng lưu trữ mới), **MC-01** (cơ chế điểm cắm — PR #21, xem 3.10), **MC-02** (khuôn checkpoint + máy kiểm — PR #22, xem 3.11), **BE-04** (giá phát hành cấu hình được + phát hành một lần — PR #25, xem 3.12 và 4.3), **BE-06** (nghiệp vụ chia lợi nhuận — PR #26, xem 4.5), **BE-07** (tiến trình tự động chia lợi nhuận — PR #27, xem 3.14 và 4.5 giai đoạn 4), **OP-01** (tích hợp liên tục + cổng bảo vệ `dev` + tạm dừng Stellar ở khâu kiểm chứng — PR #28, xem 2.6 và 2.7), **FE-20** (khung bốn vai trò — PR #29, xem 1.1 và 3.15), **BE-12** (lập–duyệt yêu cầu Mint/Burn + phát hành nhiều lần — PR #30, xem 3.3, 3.4 và 4.3), **FE-21** (ba màn Người bán — PR #31), **FE-22** (màn Lập lệnh, Phê duyệt lệnh — PR #32), **BE-14** (chiều bán token + năm bước quyết toán — PR #33), **FE-25** (màn Giao dịch token, Quản lý lệnh — PR #34), **BE-16** (nạp VNDB mô phỏng), **FE-06** (màn Giao dịch vận hành — PR #36), **FE-24** (Thông tin tài khoản + demo trọn luồng — PR #38), **OP-02 v3** (PR #39), **BE-17** (tự khớp mua/bán — PR #40), **OP-03** (hardhat một lệnh — PR #41), **SC-02** (khóa phát hành theo ví SPV), **OP-07** (mock ledger lưu bền — PR #50), **FE-27** (phạm vi chain — xem 3.22), **SC-07** (vault thanh toán SPV và luật khoá on-chain — xem 3.23), **SC-03** (khớp lệnh nguyên tử EVM — PR #57, xem 4.2), **SC-06** (quỹ chia một chiều, gộp SC-05 — PR #58, xem 3.24), **FE-05** (ký permit khi đặt lệnh trên chain thật — PR #59, xem 3.25) |
| Hoàn thành mới ở bản này | **IN-01**: Indexer gọn cho sự kiện vault/WPT và danh sách mọi ví từng chuyển WPT (xem 3.30) |
| Đang thực hiện | Không có sau khi bàn giao IN-01; chờ Supervisor nghiệm thu và Sếp quyết định merge |
| Phase kế tiếp | IN-02 dùng sự kiện Indexer để phát hiện tiền vào quỹ; đồng bộ Indexer theo lịch là nợ kỹ thuật |
| Người cập nhật | Codex (IN-01). Supervisor rà soát |

**4.22 lên 4.23 (IN-01): Indexer gọn theo nhu cầu.** Hai bảng `ChainEvent` và `IndexerCursor`
lưu sự kiện đã đủ xác nhận của vault/WPT theo scope có anchor block triển khai. Năm hàm lịch sử EVM
đọc bảng cộng phần đuôi live; `listTokenWallets` giữ cả ví số dư 0 và cấp nguồn thứ tư cho chia theo
snapshot. Lease có owner fence, CAS cursor và gia hạn từng đoạn. Xem 3.30 và `CHECKPOINT_IN01.md`.

**4.21 lên 4.22 (OP-05 PR A): chuẩn bị Sepolia lần hai.** Người dùng tự liên kết ví vào hồ sơ theo chain
(bảng `ProfileWallet`, `linkProfileWalletAction`, khối "Ví liên kết" trên `/account`); `previewTrade` tra hồ sơ
theo chain, `evm` không có ví mặc định; nợ kỹ thuật ở 3.28 và 1.6.C. `fund-sepolia.js` mô phỏng thật cả vòng
trình diễn và in bảng ước phí theo thao tác, ví gửi; bỏ thao tác `cycle`, `mint`, `burn` cũ.
`dod-verify-sepolia.js` thoát lỗi trên bộ có vault (CH-7). Runbook `docs/TESTNET_SEPOLIA.md` viết lại một mạch
bước 0 đến 14 kèm cutover database Neon và Hyperdrive mới (`docs/DEPLOYMENT.md`), kiểm chỉ đọc
`scripts/op05-db-check.sql`. Không sửa hợp đồng.

**4.20 lên 4.21 (FE-08): Kiểm soát viên duyệt rồi mới chia.** Quyền `distribution:approve` chỉ
`CONTROLLER`; ba action ghi (duyệt, duyệt lại số thực tế, tiếp tục) thay bốn action mở, xem trước, chia,
chạy vòng. Kỳ chia lưu bền kết luận duyệt, người duyệt, số duyệt và `activeChain` (mỗi chain tối đa một
kỳ hoạt động); `KeeperRun` thêm nguồn kích hoạt. Số trên chuỗi khác số duyệt thì dừng ở
`AMOUNT_CHANGED`. Lõi chia chặn kỳ chưa `APPROVED` và chỉ gửi lô khi kỳ vault `DONE`. Keeper không bao
giờ mở kỳ. Màn `/distribution` đủ quỹ, dự kiến, duyệt, kỳ hoạt động, lịch sử. Mock có địa chỉ quỹ chia
logic. Không sửa hợp đồng. Chi tiết ở 3.27, bốn dòng nợ QĐ-H ở 1.6.C.

**4.19 lên 4.20 (BE-13): Người bán rút VNDB từ vault, Kiểm soát viên cấu hình khoá.** RBAC đóng cho
vai lạ (bỏ `FALLBACK_ROLE`), ba quyền mới `vault:configure`, `vault:withdraw`, `vault:reconcile`. Cấu
hình khoá trên `/vault` gửi giao dịch theo bảng chuyển tiếp (FIXED ưu tiên PERCENT), lịch sử mọi lần
thay đổi đọc từ sự kiện trên chuỗi. Lệnh rút giữ khoá vận hành bền theo chain, không bao giờ tự gửi
lại; ca không xác định chuyển `NEEDS_REVIEW` cho Kiểm soát viên. Chain mock có vault mô phỏng cùng
công thức khoá với hợp đồng. Gỡ hạn mức và phí rút kiểu FE-21. Không sửa hợp đồng. Chi tiết ở 3.26.

**4.18 lên 4.19 (FE-05): ký permit khi đặt lệnh trên chain thật.** Máy chủ dựng typed data ERC-2612
đúng số của lệnh (`preparePermit`, domain đọc từ `eip712Domain()` và kiểm khuôn), ví nhà đầu tư ký,
`placeOrder` kiểm chữ ký theo tám bước rồi lưu chữ ký cùng lệnh; quyết toán và phục hồi gọi
`buyWithPermit`/`sellWithPermit` khi chữ ký còn dùng được. Cổng công khai trên chain thật không còn
đường đặt lệnh không chữ ký; mock không đổi. Kèm hai sửa nền: phép kiểm "lược đồ sẵn sàng" của pool
Postgres nay kiểm cả cột `ADDED_COLUMNS`, và adapter EVM xếp hàng gửi giao dịch theo ví ký. Chi tiết ở
3.25 và 4.2.

**4.17 lên 4.18 (SC-06): quỹ chia một chiều (gộp SC-05).** `ProfitDistributor` có sổ dự trữ `totalReserved`, tạo
kỳ từ phần chưa phân bổ bằng nhãn dùng một lần (`createDistributionFromPool`, `distributionIdOfPeriod`)
và `closeDistribution` thay `sweepDust`: không còn đường rút, phần chưa trả về quỹ cho kỳ sau. Ứng dụng
mở kỳ có giữ chỗ `OPENING` và phục hồi, chia theo `distributionId`, chia cả vào vault (ví SPV), đối
soát "đã trả" từ chuỗi, kỳ `EXPIRED`/`CLOSED`, đẩy số đã dành cho kỳ vào `closePeriod` của vault đúng
một lần; BE-07 căn cứ phần chưa phân bổ. Mã kỳ mới có tiền tố chain. Chi tiết ở 3.24 và 4.5.

**4.16 → 4.17 (SC-03).** `OrderSettlement` khớp mua/bán WPT nguyên tử hai chân qua vault,
chống gửi trùng bằng `orderRef`, hỗ trợ ERC-2612 permit và giữ giá có hiệu lực trên chuỗi. Adapter
EVM đã nối đủ mua/bán, allowance hai token và đối soát sự kiện; đường BE-17 tra chuỗi trước khi ghi
thất bại và có đúng một cạnh phục hồi `EXECUTING` thiếu `txHash` về `CHECKING`. Xem 4.2.

**SC-10 — vá quỹ kỳ.** `ProfitDistributor` lưu `claimDeadline` bất biến và `closed` theo kỳ;
claim/lô vào kỳ đóng hoặc hết hạn revert, kiểm tổng chi không vượt quỹ trước trả. Sweep đóng được
cả kỳ đã chi hết, chỉ chuyển/phát DustSwept nếu có phần dư. `claimWindow` chỉ áp cho kỳ mới.
Error `DistributionClosed` đặt trong interface namespace để cùng tồn tại với event cùng tên trong
ABI; không thêm thư viện hoặc thay chữ ký hàm. Bộ cũ và các ca SC-10 xanh; xem `docs/CHECKPOINT_SC10.md`.

**SC-10 — callback cưỡng chế.** Forced transfer, batch và agent burn tiếp tục bỏ qua kiểm tra
chuyển nhưng vẫn báo `transferred`/`destroyed`; thiếu compliance revert rõ. HolderCountModule chỉ
cho kiểm thử, gắn trước mint và chỉ nhận callback từ compliance đã cấu hình.

**SC-10 — CH-1 đã duyệt.** WPT có `cap` immutable theo constructor (đơn vị nhỏ nhất), chặn mọi
mint nếu tổng cung mới vượt cap; burn rồi chỉ được mint bù trong trần, không reset cờ SC-02.
Cấu hình 20.000.000 WPT ở `shared/src/token-parameters.json` là nguồn chung cho app, scripts và
fixture (deploy hiện dùng decimals 0). Cập nhật deploy, ước phí và verify; không có setter cap.

Bổ sung CI SC-09: `evm-issuance.test.ts` đọc artifact `RejectAllModule` bằng `readFile` khi
chạy hàm deploy trong ca Hardhat, không import JSON lúc nạp tệp. Job A không biên dịch hợp đồng
vẫn typecheck và thu thập được các ca bỏ qua. Không thay adapter, ABI hoặc logic hợp đồng.

**4.13 → 4.14 (SC-09).** WPT chuyển sang bề mặt ERC-3643 PoC tương thích selector T-REX v4.1.6:
`IdentityRegistry`, `ModularCompliance` và module cho phép mặc định; hỗ trợ đóng băng toàn phần/một
phần, cưỡng chế và action sau dịch chuyển. Luật ví SPV/snapshot cũ được giữ; WPT và VNDB có ERC-2612
`permit`. Adapter giữ nguyên ngôn ngữ nghiệp vụ nhưng whitelist đi qua registry, `canTransfer` đọc
đủ tám điều kiện và chặn bộ địa chỉ trước SC-09. Bộ chính giữ OpenZeppelin 5.6.1, nhắm EVM Cancun;
hỗ trợ Besu để ngỏ cho task sau.

**4.12 → 4.13 (FE-27).** Mọi phép đọc đã có nguồn chain ở giao diện mang chain trong khoá tải và
bỏ phản hồi cũ; Lập lệnh, Duyệt và số việc chờ lọc tại service/store thay vì chỉ hiện cột chain.
Yêu cầu mở trực tiếp ở chain khác không thể duyệt. Giá phát hành tách thành khoá
`wpt.issue_price_vnd.<chain>`, được seed cho toàn bộ `CHAIN_ORDER`; đổi giá một chain không đổi chain
khác. Bảng rà soát toàn bộ màn và bằng chứng đổi `mock`/`hardhat-local` ở `CHECKPOINT_FE27.md`.

**4.11 → 4.12 (OP-07).** Chain mock không còn nằm ngoài ranh giới lưu bền khi Worker dùng
`USE_MOCK_DB=false`: toàn bộ 17 trường state được mã hoá vào một dòng JSONB/chain trong
`MockLedgerState`; transaction khoá dòng bằng `SELECT ... FOR UPDATE`, nên kiểm-và-ghi của phát hành,
mua/bán, snapshot và chia lợi nhuận nguyên tử giữa nhiều tiến trình. `USE_MOCK_DB=true` vẫn dùng RAM
và không mở kết nối PostgreSQL; lỗi DB ở chế độ `false` không fallback. `Txn` tiếp tục chỉ là lịch sử.
Runbook yêu cầu tắt Hyperdrive query cache và reset toàn bộ Neon một lần sau merge; Owner xác nhận cache
đã tắt ngày 14/10, còn reset và kiểm hai trình duyệt thực hiện sau merge.

**4.10 → 4.11 (OP-06, giảm CPU Postgres trên Workers Free).** `pgQuery` dùng chung một
`pg.Client` theo `getCloudflareContext().ctx`; hai request không dùng chung I/O và transaction giữ
Client riêng. Worker để runtime dọn edge connection khi invocation kết thúc, đúng vòng đời
Hyperdrive; Node/Vitest/Docker vẫn mở/đóng theo từng lời gọi. Cold start kiểm catalog + dữ liệu seed
bằng hai query trên Client request, chỉ mở transaction/DDL/seed khi thiếu. Local đo `/draft` giảm
8→4 connection, duyệt Mint 15→3, token-info giữ 1; sau 30 lượt và dừng Worker còn 0 connection.
Tắt `ENABLE_READ_DIAGNOSTICS`; chờ Owner đo CPU P50/P90 và lỗi 1102 trên deploy để đóng task.

**4.9 → 4.10 (OP-06, lưu log và phân loại lỗi đọc).** Wrangler bật observability/logs,
invocation logs và persist, lấy mẫu 1 để tra cứu lại theo mã. Client phân biệt máy chủ trả lỗi,
quá thời gian chờ và mất kết nối; giữ HTTP/cf-ray nếu đã nhận response headers. Lỗi HTML từ
Cloudflare được báo như lỗi máy chủ, không hiển thị body HTML hay nhầm thành lỗi mạng. Giữ kiểm
quyền ở service, hủy lượt cũ và nút thử lại; chưa xác nhận timeout production hết.

**4.8 → 4.9 (OP-06, VĐ-45).** Postgres chỉ cache trạng thái khởi tạo đã hoàn tất theo chuỗi
kết nối, không cache Promise/I/O đang chạy. Lượt chưa có thành công dùng Client riêng; lỗi muộn
không xóa thành công của lượt khác. Giữ transaction, khóa tư vấn và seed. `db.schema.verify` đo
trọn lượt khởi tạo thực tế, không phát log verify cho cache hit. Kiểm thử giả lập pg giữ A chưa xong,
B vẫn đọc được; khôi phục Promise chung làm ca này đỏ. Đây là giảm rủi ro lan lỗi giữa request;
tại mốc 4.9 cờ nhật ký còn bật để lấy số đo, đến 4.11 đã tắt sau khi hoàn tất chẩn đoán.

**4.7 → 4.8 (OP-06, xử lý timeout đọc WPT).** Lập lệnh dùng GET `api/token-info` thay Server Action để không đợi hàng chờ đọc khác. Giữ quyền/schema ở service, trả no-store và mã tra cứu. Helper client hủy fetch khi đổi nội dung, phân biệt timeout/lỗi mạng, có thử lại không làm mất biểu mẫu. Dùng chung một phép đọc SPV trong cùng lượt lấy chỉ tiêu để tránh RPC lặp. `diagnostics/read-trace.ts` dùng AsyncLocalStorage chỉ cho metadata log, không giữ client I/O; đo connect/schema/query/close và RPC theo request. `ENABLE_READ_DIAGNOSTICS` mặc định tắt, bật tạm trong Wrangler cho debug. Không log URL/SQL/payload/error.message. Chưa xác nhận lỗi production hết trước khi deploy/đo lại. ESLint bỏ cache sinh `.wrangler` để không quét bundle Worker local.

**4.6 → 4.7 (OP-06).** Bản Cloudflare chuyển dữ liệu nghiệp vụ từ RAM theo isolate sang PostgreSQL
qua Hyperdrive. Worker lấy binding `HYPERDRIVE`, Node/Docker lùi về `DATABASE_URL`; mỗi lời gọi mở và
đóng một `pg.Client`, không giữ I/O toàn cục. `init.sql` được nhúng từng byte lúc build. Dự án chưa
phát hành được seed cập nhật địa chỉ contract; dự án đã có `issuedAt` bất biến. Khi chuỗi đã phát hành
nhưng DB mới chưa có mốc, service tự đối soát có audit rồi tiếp tục `mint`, không chặn vĩnh viễn.
Worker local với Postgres 16 + Hardhat đã giữ yêu cầu qua lần tắt/bật Wrangler. Bộ ràng buộc Postgres
tăng từ 1,04 s lên 2,33 s (2,24×); vượt ngưỡng 2×, Owner đã chấp nhận ngày 09/10 và yêu cầu ghi rõ.

**4.4 → 4.5 (OP-04).** Máy Owner dùng HTTP(S) proxy; curl/Hardhat đọc Sepolia được nhưng Node fetch trực tiếp timeout. Thêm `npm run start:proxy` nạp `app/scripts/local-proxy.mjs`, dùng `EnvHttpProxyAgent` và giữ NO_PROXY/loopback. Khai báo trực tiếp devDependency `undici` 7.29.1 đã có trong lock, chỉ dùng công cụ khởi động local; không nhập vào mã Worker. Không thay EVM adapter hay retry/timeout nghiệp vụ.

**4.3 → 4.4 (OP-04).** Khắc phục màn Lập lệnh báo chưa có WPT trên `evm`: biến server `ENABLE_SEPOLIA_DEMO_PROJECT` mặc định tắt, bật riêng cho demo đã deploy. `app/src/lib/store/configured-seed-data.ts` cấp cùng dữ liệu DRAFT cho memory và Postgres, lấy địa chỉ qua shared; Postgres giữ `ON CONFLICT DO NOTHING`, không ghi đè trạng thái đã phát hành. `config/env.ts` là nơi duy nhất đọc cờ; `seed-data.ts` vẫn thuần. Không đổi luật lập–duyệt hay tự gửi giao dịch. Runbook Sepolia bổ sung cờ cho local và Worker.

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
   hiệu lực — mọi chỗ hiển thị phải đọc qua `readIssuePriceVnd(chain)` (xem 3.12).
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

**2.8 → 2.9 (FE-22).** Hai màn giao diện (Lập lệnh, Phê duyệt lệnh) + màn chi tiết yêu cầu, một
quyền RBAC mới (`demo:mint-token`, nay **32** action), một cờ môi trường mới (`ENABLE_DEMO_TOKEN_MINT`),
bốn phép đọc mới ở `token-request.service`. **Không** thêm method nào vào `ILedgerPort` (vẫn 29),
**không** thêm tầng, ba luật không bị chạm. Một đổi hành vi cần đọc kỹ:

1. **Giao dịch viên KHÔNG còn `token:mint` / `token:burn`.** Tạo và huỷ token chỉ còn qua lập–duyệt.
   Hai đường tạo trực tiếp có sẵn (`mintToInvestorDirect`, `issueInitialSupply`) nay là **đường dữ
   liệu thử**, sau hai lớp chặn `demo:mint-token` + `ENABLE_DEMO_TOKEN_MINT` (mặc định **tắt**). Môi
   trường chưa bật cờ thì màn `/mint`, `POST /api/mint`, `npm run demo:mint` nhận **403** — đó là
   hành vi đúng. Xem 3.3 và 4.1.

**2.9 → 3.0 (BE-14).** `+0.1` thường như lần 1.9 → 2.0, không phải đổi kiến trúc. Chiều bán đi chung bảng lệnh, chung bảy trạng thái và chung bộ kiểm với
chiều mua. Một method mới ở `ILedgerPort` (`executeSale`, **30** method), năm cột mới ở bảng
`PurchaseOrder` (`side` + bốn mốc bước), một tệp nghiệp vụ mới (`settlement-steps.ts`), một hàm
nghiệp vụ mới (`orderDailyStats`), hai mã lỗi mới. **Không** thêm action RBAC
nào (vẫn 32), **không** thêm tầng, ba luật không bị chạm. Bốn đổi hành vi cần đọc kỹ:

1. **`SELLER` có `order:read:all`** — Người bán xem toàn bộ sổ lệnh (spec việc 12). Vì `SELLER` là
   `FALLBACK_ROLE`, **vai lạ nay cũng đọc được sổ lệnh toàn hệ** (vẫn không có quyền ghi nào, vẫn
   không đọc sổ kiểm toán hay báo cáo đối soát). Owner đã chọn giữ fallback, lý do ở 3.3.
2. **`OrderView` có thêm `side`, `steps`, `settlement`**; `OrderExecutionView` có thêm
   `paymentBalanceAfter`. Thêm trường, không đổi trường cũ.
3. **`runPurchaseChecks` đổi tên thành `runOrderChecks`** và nhận `side`. Chiều mua chạy đúng bốn
   phép như cũ; `PURCHASE_CHECK_IDS` đổi thành `ORDER_CHECK_IDS` (thêm `holding`,
   `sellerLiquidity`). Không chỗ nào ngoài `purchase.service.ts` dùng tên cũ.
4. **`ensureSchema` nâng bảng `PurchaseOrder` cũ** bằng `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT
   EXISTS` chạy TRƯỚC `init.sql`, dòng cũ mang `side = 'BUY'`. Lệnh hoàn tất trước BE-14 không có
   `completedAt` nên không vào số liệu theo ngày.
5. **Kênh Người bán (FE-21) tách hai chiều.** `getSellerOverview().today.sell` hết là `null`, ô
   mua chỉ đếm lệnh mua, mốc "trong ngày" là `completedAt` thay cho `updatedAt`;
   `listSellerTransactions` có loại `SELL` và lọc loại thật. Xem 3.16.

**3.0 sang 3.1 (FE-25).** Ba màn giao diện của Nhà đầu tư (Giao dịch token, Quản lý lệnh, chi tiết lệnh)
thay hai trang chỗ trống, một service đọc mới (`trade.service.ts`), ba server action mới
(`app/actions/trade.ts`). **Không** thêm method `ILedgerPort` (vẫn 30), **không** thêm action RBAC
(vẫn 32), **không** thêm bảng, ba luật không bị chạm. Hai điều cần đọc kỹ:

1. **BE-17 đã thay hành vi cũ:** gửi lệnh từ `/trade` tự kiểm và tự quyết toán ngay trong cùng lời
   gọi. `order:execute` vẫn chỉ thuộc Giao dịch viên nhưng nay là đường can thiệp cho lệnh kẹt;
   `POST /api/purchase` có `orderId` cũng chỉ đi vào đường can thiệp này.
2. **FE-24 đã đóng hai khoảng trống dữ liệu của FE-25:** tuổi thọ còn lại, lợi tức và phí giao dịch
   đọc qua `readTokenTerms()`; điều kiện rủi ro đọc hạng rủi ro + AML của hồ sơ rồi mới dùng bộ kiểm
   số dư BE-14. Xem 3.18 và 3.21.

**3.1 sang 3.2 (BE-16).** Một method mới ở `ILedgerPort` (`mintPayment`, **31** method), một service
mới (`demo-payment.service.ts`), hai server action, một màn mới trong khu vực vận hành, một khoá tham
số mới (`demo.payment_mint_max_vnd`, nạp sẵn). **Không** thêm action RBAC (vẫn 32): quyền
`demo:mint-payment` và cờ `ENABLE_DEMO_PAYMENT_MINT` đã có từ BE-08, nay mới có nghiệp vụ gọi. Ba luật
không bị chạm. Hai điều cần đọc kỹ:

1. **Đây là đường tạo ra tiền**, sau hai lớp chặn cờ trước, quyền sau; mục menu và trang chỉ mở khi
   chính hàm hai lớp đó cho phép. Xem 3.19.
2. **Bản mock của `mintPayment` cộng kèm mức ủy quyền** bằng số vừa nạp — lệch `VNDToken.mint` có
   chủ ý, Owner chốt, để lệnh mua sau khi nạp qua được phép kiểm ủy quyền. Xem 3.1.

**3.2 sang 3.3 (FE-06).** Thay trang chỗ trống `/transactions` bằng một màn dùng chung cho hai vai
vận hành, thêm chi tiết `/transactions/[id]`, phép đọc phân trang thật ở store và service
`ops-transactions.service.ts`. **Không** thêm method `ILedgerPort`, action RBAC hay bảng dữ liệu; ba
luật không bị chạm. Bước nghiệp vụ lấy nguyên từ ánh xạ năm bước BE-14. Từ BE-17, `TELLER` chỉ thấy
hành động can thiệp cho lệnh kẹt an toàn; `CONTROLLER` chỉ xem; `INVESTOR` và `SELLER` bị chặn ở cả
layout lẫn service.

**3.3 sang 3.4 (FE-24).** Thay trang chỗ trống `/account` bằng màn chỉ đọc dùng chung bốn vai, thêm
nguồn hồ sơ mẫu cho đúng tài khoản phiên, ba khoá cấu hình token và nối hồ sơ KYC/rủi ro vào khối
kiểm tra trước lệnh. **Không** thêm method `ILedgerPort`, action RBAC, bảng dữ liệu hay phụ thuộc; ba
luật không bị chạm. Hồ sơ hiện là nguồn mẫu server-only cho PoC; AU-01 thay thân nguồn bằng phiên và
kho người dùng thật mà giữ nguyên view-model. Xem 3.18 và 3.21.

**3.4 sang 3.5 (bổ sung bàn giao demo).** Đồng bộ mặc định mọi cách chạy về `mock`, vai `TELLER`,
memory DB và bật nạp VNDB demo; trình duyệt sạch không còn rơi về `SELLER` khi gặp `DEMO_ROLE` cũ
không hợp lệ. Quy tắc RBAC fail-closed vẫn giữ nguyên: `FALLBACK_ROLE=SELLER` tiếp tục áp dụng cho
mọi phép `can()` nhận vai lạ; chỉ lựa chọn vai của **phiên PoC** lùi về vai của
`DEFAULT_CHANNEL=teller`. Đường mint WPT trực tiếp vẫn mặc định tắt để luồng chính luôn đi qua
Giao dịch viên lập → Kiểm soát viên duyệt. Production phải ghi đè cờ nạp VNDB thành `false`.

**3.5 sang 3.6 (BE-17).** Lệnh mua/bán hợp lệ tự quyết toán ngay sau khi đặt; giao diện gửi UUID
`clientRequestId` dùng lại khi retry và kho lưu trữ chặn trùng theo `(investorWallet,
clientRequestId)`. Không thêm vai, quyền, trạng thái hay method ledger. Đường tay giữ
`order:execute` cho `TELLER`, nhưng tách ba nhánh an toàn: `CHECKING` được gửi, `EXECUTING` có
`txHash` chỉ đối soát receipt. Từ SC-03, `EXECUTING` thiếu `txHash` tra dấu `orderRef` trên chain:
đã quyết toán thì chốt `COMPLETED`; chưa quyết toán thì cập nhật có điều kiện về `CHECKING`, chạy
lại toàn bộ bộ kiểm rồi mới tranh quyền gửi. Kết quả chưa rõ hoặc RPC lỗi giữ nguyên trạng thái.
Đây là cạnh quay lại duy nhất của máy trạng thái và chỉ dùng trên chain có khóa chống trùng. Xem 4.2.

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
│   │   │                      #   mint, kyc, assets, reconciliation, audit,
│   │   │                      #   demo-payment (BE-16, chỉ khi cờ bật)
│   │   ├── (ops-draft)/       # draft — màn Lập lệnh, CHỈ Giao dịch viên (FE-22)
│   │   ├── (control)/         # approvals, approvals/[id] — màn Phê duyệt lệnh và chi tiết,
│   │   │                      #   CHỈ Kiểm soát viên (FE-22)
│   │   ├── (wallet)/          # wallet — Nhà đầu tư + Người bán
│   │   ├── (account)/         # account — cả bốn vai
│   │   ├── actions/           # Server Actions (bank.ts, session.ts, portfolio.ts,
│   │   │                      #   purchase.ts, config.ts, distribution.ts,
│   │   │                      #   token-request.ts, seller.ts, trade.ts,
│   │   │                      #   demo-payment.ts)
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
│   │   ├── trading/           # FE-25/FE-06: tiến trình, nội dung chi tiết dùng chung, gates.ts
│   │   ├── maker-checker/     # FE-22: khối thông tin token, khối kiểm tra, bảng yêu cầu,
│   │   │                      #   nhãn trạng thái, thẻ số liệu, gates.ts (logic thuần) — 3.17
│   │   ├── pages/             # mint, kyc, assets, dashboard, reconciliation,
│   │   │                      #   investor-portfolio, investor-token-detail,
│   │   │                      #   wallet-connect, seller-overview, seller-transactions,
│   │   │                      #   seller-withdraw (FE-21), draft, approvals,
│   │   │                      #   approval-detail (FE-22), investor-trade, investor-orders,
│   │   │                      #   investor-order-detail (FE-25), demo-payment (BE-16),
│   │   │                      #   ops-transactions + ops-order-detail (FE-06), account-info (FE-24),
│   │   │                      #   placeholder (2 trang: FE-08, FE-23)
│   │   └── ui/                # shadcn/ui primitives
│   ├── scripts/local-proxy.mjs # OP-04: bootstrap fetch qua proxy, chỉ Node local
│   ├── src/lib/               # ★ LÕI — xem Phần 3
│   │   └── config/issue-price-key.ts # FE-27: khoá giá phát hành ghép theo chain
│   │   └── diagnostics/read-trace.ts # OP-06: thời gian DB/RPC theo request
│   │   └── indexer/event-index.ts # IN-01: đồng bộ cache sự kiện + đọc bảng và live tail
│   │   └── store/configured-seed-data.ts # OP-04: đăng ký Sepolia khi bật cờ
│   ├── e2e/                   # Playwright
│   ├── test/                  # Vitest
│   ├── prisma/                # schema.prisma + init.sql
│   └── Dockerfile
│
├── packages/
│   ├── contracts-evm/         # Hardhat 2.x, Solidity 0.8.28, OZ 5
│   │   ├── contracts/
│   │   │   ├── tokens/ProjectToken.sol      # WPT — ERC-3643 PoC + snapshot + ERC-2612
│   │   │   ├── tokens/VNDToken.sol          # VNDB — token chi trả + ERC-2612
│   │   │   ├── identity/IdentityRegistry.sol # Sổ danh tính rút gọn
│   │   │   ├── compliance/ModularCompliance.sol # Bộ luật giao dịch ghép module
│   │   │   ├── compliance/modules/AllowAllModule.sol # Module mặc định
│   │   │   ├── ProfitDistributor.sol        # Chia lợi tức theo snapshot
│   │   │   ├── ProfitDistributorOracle.sol  # Bản nối EnergyOracle
│   │   │   ├── Redemption.sol               # Hoàn vốn WPT → VNDB
│   │   │   ├── oracle/EnergyOracle.sol      # Sản lượng điện → doanh thu
│   │   │   └── extensions/ERC20Snapshotable.sol
│   │   ├── scripts/           # deploy.js, demo-cycle.js, demo-oracle.js,
│   │   │                      #   fund-sepolia.js, preflight-sepolia.js, verify-deployment.js,
│   │   │                      #   dod-verify-sepolia.js (nghiệm thu DoD lớp 2),
│   │   │                      #   local-state.js + seed-local.js (evm-local.sh gọi, OP-03)
│   │   ├── test/              # full-cycle, oracle-cycle và SC-09
│   │   │                      #   + spec-p4/p7/p12 theo acceptance criteria (96 test)
│   │   └── trex/              # ERC-3643 thật — TOOLCHAIN RIÊNG, KHÔNG trộn
│   ├── contracts-stellar/     # Soroban (Rust) — TẠM DỪNG, giữ mã (xem 2.6)
│   └── shared/                # ★ MỘT nguồn sự thật: ABI, địa chỉ, chain, types
│
├── scripts/                   # Công cụ chạy từ GỐC repo (Node 20+ / bash, không phụ thuộc ngoài)
│   ├── run-local-all.sh       # ★ NGUỒN DUY NHẤT của danh sách việc cần kiểm — 8 phần gọi
│   │                          #   riêng được (`--list`). Không tham số = bộ mặc định 5 phần
│   ├── verify-arch-rules.sh   # Lớp 3: 3 luật kiến trúc + cấu trúc repo + ký hiệu token
│   │                          #   + bảng quyền không teo lại so với nền (OP-01)
│   ├── scan-pending.mjs       # ★ Quét marker; --check, --json, --write-report, --check-report
│   ├── gen-flow-diagram.mjs   # ★ Sinh docs/flows/<luồng>.md (Mermaid) từ marker @flow
│   ├── check-checkpoint.mjs   # ★ Kiểm khuôn checkpoint; --in-progress (MC-02)
│   ├── smoke-test.mjs         # ★ Kiểm khói bản đã triển khai (OP-01) — chạy TAY
│   ├── evm-local.sh           # ★ Chuỗi hardhat cục bộ: up / down / reset (OP-03), xem docs/EVM_LOCAL.md
│   └── demo-mint.mjs          # Kịch bản demo luồng mint
│
└── docs/                      # SPEC, WORKING_PROTOCOL, CHECKPOINT, REVIEW
    ├── tech-report.md         # ★ Báo cáo công nghệ (file này)
    ├── tech-report-maintenance.md  # Quy tắc cập nhật báo cáo
    ├── CHECKPOINT_OP02.md    # Bằng chứng local + bàn giao deploy cho Owner
    ├── op-02-demo-unblock/    # Spec hiện hành OP-02 (bản v2)
    ├── GIAO_VIEC_DOT_5.md     # Phạm vi và thứ tự đợt 5
    ├── EVM_LOCAL.md           # Chạy app và đầu cuối trên chuỗi hardhat cục bộ (OP-03)
    ├── guide.md               # ★ Hướng dẫn demo trọn luồng Mint/Burn + mua/bán trên mock
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

OP-06 giữ `ENABLE_READ_DIAGNOSTICS=false` ở Wrangler và env mặc định. Chỉ bật tạm khi điều tra một
lượt GET token-info có mã tra cứu, rồi tắt lại; không import module trace vào client.

| Chế độ | Lệnh | Chain | DB | Dùng khi |
|---|---|---|---|---|
| Đầy đủ | `docker compose up` | hardhat-local | Postgres 16 | Phát triển, demo nội bộ |
| Free-tier | Deploy Cloudflare | `evm` (Sepolia) | Neon qua Hyperdrive | Demo public có dữ liệu bền |
| Chuỗi cục bộ (OP-03) | `bash scripts/evm-local.sh up` rồi `cd app && npm run dev` | hardhat-local | memory | Phát triển hợp đồng/adapter, đầu cuối trên chuỗi. Sau `reset` phải khởi động lại app. Xem `docs/EVM_LOCAL.md` |

Máy local có HTTP(S) proxy dùng `npm run start:proxy` thay `npm start`; bootstrap Node giữ NO_PROXY và bỏ qua loopback, không áp dụng cho Worker.

Demo Sepolia đã deploy (OP-04) bật `ENABLE_SEPOLIA_DEMO_PROJECT=true` trước khi khởi tạo DB. Cờ chỉ thêm dòng WPT DRAFT với địa chỉ shared, không tự phát hành; xem `docs/TESTNET_SEPOLIA.md`.

Free-tier OP-06/OP-07 dùng `USE_MOCK_DB=false` và binding Hyperdrive trong `app/wrangler.json`; các biến
runtime không bí mật cũng lấy từ tệp này. `NEXT_PUBLIC_*` vẫn là biến build. Secret RPC/signer chỉ
đặt trên Worker. Với cờ này, chain `mock` dùng bảng `MockLedgerState` và bền qua isolate; Hyperdrive
phải tắt query cache để giữ read-after-write. Chain thật vẫn lấy state từ chain tương ứng.

Bản PoC mặc định `mock` + memory DB + vai `TELLER` và bật `ENABLE_DEMO_PAYMENT_MINT`, nên một bản
clone/deploy không có biến môi trường vẫn demo được trọn luồng maker–checker và mua token.
`ENABLE_DEMO_TOKEN_MINT` luôn mặc định **tắt** vì đường này bỏ qua bước duyệt; Docker Compose cũng
giữ tắt. Máy chủ e2e bật riêng cờ đó để kiểm đường dữ liệu thử. Production bắt buộc ghi đè
`ENABLE_DEMO_PAYMENT_MINT=false` và thay vai giả lập bằng phiên xác thực. Danh sách đầy đủ ở **3.6**.

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
| Kiểm "không có X" (`toHaveCount(0)`) ngay sau khi mở trang | Xanh ăn may khi khối dữ liệu chưa tải. Đợi mốc "đã tải" rồi mới kiểm vắng mặt (OP-03, xem `lessons.md`) |
| Giả định API Next.js theo bản cũ | Next.js 16 có breaking change. Đọc `node_modules/next/dist/docs/` và `app/AGENTS.md` **trước khi** sửa `app/` |
| Màn tự tải dữ liệu bằng nhiều server action trong `useEffect` | Next xếp hàng server action **nối tiếp**: 4 action là 4 lượt Worker chờ nhau (HF-01 đo 2,0 đến 4,1 giây ở `/seller/withdraw`). Mỗi màn gọi tối đa **một** action khi mở; việc đi liền nhau thì gộp vào một action |
| Client gọi lại dữ liệu mà Server Component đã đọc sẵn | Dùng số từ server; chỉ gọi action khi tham số khác bản server đã đọc (ví dụ menu chỉ gọi số việc chờ khi chain khác chain mặc định, HF-01) |
| `Link` trong menu để prefetch mặc định | Mỗi prefetch là một lần kết xuất server có truy vấn DB. Menu đặt `prefetch={false}` (HF-01, kiểm ở `test/hf-01-hieu-nang.test.ts`) |
| Nhiều lời đọc RPC rời trong một `Promise.all` | Một lượt Worker chỉ mở 6 kết nối ra ngoài cùng lúc. Client đọc EVM gom lô JSON-RPC (`batchSize` 20); client ghi không gom (HF-01) |
| Đọc sự kiện (`eth_getLogs`) qua RPC chính, một lần từ block triển khai tới `latest` | Alchemy gói miễn phí chỉ cho 10 block mỗi lần, RPC công khai 50.000. Đọc sự kiện qua `logReader()` (`RPC_EVM_LOGS`, mặc định RPC công khai) và `scanLogs` theo đoạn `EVM_LOG_BLOCK_CHUNK`; số block mới nhất đọc với `cacheTime: 0`, đoạn cuối tới `latest` (HF-03, `test/hf-03-doc-log-evm.test.ts`) |
| Đối soát giao dịch vừa gửi chỉ bằng quét log | RPC đọc log có thể đi sau RPC ghi: sự kiện chưa thấy không có nghĩa là chưa có. `findVaultPeriodClose(ref, hintTxHash)` đọc biên nhận của mã đã lưu qua RPC chính; CONFLICT chỉ giữ khi sự kiện đúng mã kỳ khác số (HF-04, sự cố OP-05 bước 13.7) |
| Coi biên nhận `PENDING` (hết giờ chờ) là xong, hoặc là thất bại | Hết giờ chờ không chứng minh gì: giao dịch vẫn có thể vào block sau. Đã có `txHash` mà chưa có biên nhận thì giữ `EXECUTING` kèm mã, không ghi mốc nghiệp vụ, không ghi sổ SUCCESS; chỉ biên nhận thật mới chốt `COMPLETED`/`FAILED`. Chốt sau xác nhận phải nguyên tử với sổ (`finalizeTokenRequest`, một transaction), và đối soát không bao giờ gửi lại (HF-05: yêu cầu Mint/Burn, lệnh mua bán qua cờ `receiptUnknown`) |
| Revert một PR rồi merge lại nhánh đó để "lấy code về" | Git **không** phục hồi: merge chỉ so sánh với merge-base nên phần đã revert biến mất vĩnh viễn. Đó là lý do `dev` từng mất sạch `packages/` và `app/src/lib/`. Cách đúng duy nhất: `git revert <sha-của-commit-revert>`. Không merge lại, không cherry-pick — `branching.md` §6 |
| Lấy nền từ nhánh phụ, hoặc tự chọn nền khác khi `dev` hỏng | Nền duy nhất được phép là `dev`. `dev` hỏng thì DỪNG và hỏi Owner — `branching.md` §1, §5 |
| Rebase nhánh mới lên nhánh khác khi nhánh nền chứa commit phá hoại | `git rebase <đích>` sẽ kéo theo cả commit của nhánh nền; kỹ thuật đúng là `git rebase --onto <đích> <nền> <nhánh>`. Nhưng **chỉ dùng sau khi Owner đồng ý** đổi nền |
| Commit trực tiếp lên `dev` | Cấm, kể cả sửa một dòng tài liệu. Mở nhánh `docs/<tên>` từ `dev` rồi để Owner merge — `branching.md` §10. Ngoại lệ do Owner chỉ định thì phải nói rõ và ghi lại (§12) |
| Thêm method liệt kê người nắm giữ vào `ILedgerPort` | ERC-20 chỉ lưu **bảng số dư theo địa chỉ**, không lưu danh sách địa chỉ — không lời gọi nào đọc ra danh sách từ chuỗi. Danh sách ví lấy từ cơ sở dữ liệu, về sau từ Indexer. Đừng quét sự kiện trong adapter (xem 3.1) |
| Nối method vào contract có ngữ nghĩa "gần gần" khi contract đúng chưa có | Tệ hơn chưa nối: cho ra hệ thống chạy được nhưng làm ngược, và không ai phát hiện tới lúc chạy thật. Ném `LedgerNotImplementedError` với gợi ý nêu đúng thứ đang thiếu, rồi ghi câu hỏi mở |
| Đọc `data.errorName` trước `reason` khi bóc revert của viem | Mất sạch lý do: `require(cond, "chuoi")` cho `errorName = 'Error'`, chuỗi thật ở `reason`. Thứ tự đúng `reason` → `data.errorName` → `signature` (xem 3.1) |
| ABI tối giản chỉ có `function` và `event` | Thiếu mục `error` thì viem không giải mã custom error OZ v5, chỉ ra 4 byte selector (xem 3.7) |
| Phép kiểm "lược đồ đã sẵn sàng" chỉ đếm bảng, chỉ mục, ràng buộc | Database đang chạy đủ những thứ đó nhưng thiếu cột thêm sau thì bị coi là sẵn sàng, `ALTER` không bao giờ chạy (đo ở FE-05 ca 12, ảnh hưởng cả 6 cột SC-06). Mọi cột trong `ADDED_COLUMNS` phải nằm trong phép kiểm (`schemaObjectsReady`) |
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
- **SC-06: khi cổng ĐỌC LẠI được con số chuỗi đã chốt thì đọc lại thay vì tự tính.** Mở kỳ chia nay đọc kỳ trên chuỗi theo nhãn (`findDistribution`) và ghi đúng số hợp đồng đã chốt; phép "đọc trước, đọc lại để so" dưới đây chỉ còn là bài học lịch sử của BE-06.
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
| **P1** | **`ENABLE_DEMO_PAYMENT_MINT` mặc định bật cho bản trình diễn.** Đây là quyết định của chủ dự án ngày **07/10/2026**, không phải sơ suất | Trước triển khai thật: đặt `ENABLE_DEMO_PAYMENT_MINT=false` và gỡ màn **Nạp VNDB (trình diễn)**; không dùng tiền mô phỏng cho nghiệp vụ thật |
| **P2** | **Chưa có tiến trình quét lệnh mua/bán kẹt.** BE-17/SC-03 cung cấp đường can thiệp an toàn cho GDV; nếu không có người mở màn thì lệnh kẹt không tự được phát hiện | Gom vào tiến trình định kỳ đã có của **BE-07**: quét `CHECKING`/`EXECUTING`, gọi đúng đường can thiệp. SC-03 đã cho phép phục hồi `EXECUTING` thiếu `txHash` sau khi tra khóa chống trùng trên chain; không tự viết một đường gửi lại riêng |
| **P2** | **Lệnh kẹt ở `PLACED` không can thiệp được.** Đường can thiệp của BE-17 chỉ nhận lệnh `CHECKING`/`EXECUTING`; lệnh dừng ở `PLACED` (tự quyết toán lỗi ngay sau khi tạo, nay có dòng `console.error` kèm mã lệnh từ OP-03) chỉ được `expireStaleOrders` dọn sang Hết hạn khi quá hạn | Gắn vào task đụng tới tiến trình quét lệnh kẹt ở dòng trên: cho đường can thiệp nhận cả `PLACED`, hoặc tự quyết toán lại một lần trước khi để hết hạn |
| ~~P2~~ | ~~**Khoảng trống giữa phát giao dịch và lưu `txHash`.** Tiến trình chết sau khi adapter gửi nhưng trước `attachOrderTxHash` để lại `EXECUTING` không mã~~ | **ĐÃ XỬ LÝ ở SC-03:** `orderRef` được chốt trong vault; tra `isOrderSettled` rồi sự kiện `OrderSettled`. Đã quyết toán thì chốt từ chain; chưa thì cập nhật có điều kiện về `CHECKING` và chạy lại bộ kiểm. `SETTLED_TX_UNKNOWN`/lỗi RPC giữ nguyên, không ghi thất bại |
| **P2** | Bốn màn Nhà đầu tư (`trade`, `orders` và hai màn chi tiết) chép lặp `chain === 'mock' ? mockWallet : address`. Khi hoàn thiện Mock ở `d45b596`, việc chép lặp làm sót hai màn chi tiết; OP-02 v3 vá đủ bằng cùng khuôn | Gom đoạn phân giải ví về một hook dùng chung khi task tiếp theo đụng nhóm màn này; không mở task riêng và không gom trong OP-02 |
| ~~P2~~ | ~~Build Cloudflare fail ENOENT: Next sinh ra `.next/standalone/app/.next`, OpenNext đọc `.next/standalone/.next`~~ | **ĐÃ XỬ LÝ ở PR #12** (`app/scripts/flatten-standalone.mjs` + script `cf:build`). Đề nghị Supervisor xác nhận rồi xóa dòng này — theo `tech-report-maintenance.md` §8, việc thêm/xóa nợ do Supervisor quyết |
| **P2** *(đề nghị, Supervisor chốt mức)* | **Hàng đợi gửi giao dịch của adapter EVM chỉ trong một tiến trình** (FE-05). Hai instance serverless cùng ví ký vẫn có thể lấy trùng nonce giao dịch | Hàng đợi ở tầng custody (Phase 5, Fireblocks) hoặc chọn nonce có khoá dùng chung |
| **P1** | **Màn còn tải bằng nhiều action nối tiếp khi mở** (HF-01 đo bằng `grep -c "Action(" src/components/pages/*.tsx`): `/vault` gọi 3 action khi mở (tổng quan, lịch sử cấu hình quét sự kiện từ block triển khai, lệnh cần xem xét); `investor-trade` gọi 2 đến 3 | Task PERF-01: mỗi màn một action khi mở hoặc Server Component đọc sẵn; lịch sử cấu hình có mốc block lưu sẵn thay vì quét từ block triển khai mỗi lần |
| **P2** | **Khởi động nguội Worker khoảng 1,1 đến 1,5 giây** (HF-01 đo bằng `wrangler dev` cục bộ, bản 14/10 và bản `dd00e12` như nhau); gói `handler.mjs` 17 MB | Thu gọn gói: tách thư viện chỉ dùng ở client, bỏ mã chain không bật; đo lại sau mỗi lần |
| **P2** *(đề nghị, Supervisor chốt mức)* | **Màn giao dịch trên chain thật coi "chưa có cờ tất toán" là chưa tất toán** (FE-05, chủ dự án chốt 20/10/2026): `isSettlementMode` của EVM còn chờ SC-04, xem trước và bối cảnh màn giao dịch dựa vào trạng thái dự án | Gỡ khi SC-04 quyết cờ tất toán; `settlementModeOrUnknown` ở `trade.service.ts` là chỗ duy nhất cần sửa |
| **P2** | Docker build phụ thuộc CDN Alpine (`apk add`) → giòn ở mạng doanh nghiệp có tường lửa | Cân nhắc base `node:24-bookworm-slim` |
| **P2** | Node 20 đã hết hạn LTS từ 30/04/2026, không còn vá bảo mật | Nâng Docker image lên Node 24 (LTS đến 2028) |
| **P1** | **4 method của `ILedgerPort` chưa nối được ở `evm.adapter`**: bốn method tất toán/NAV chờ SC-04. Khớp lệnh (SC-03) và chia lợi nhuận (SC-06, gộp SC-05) đã chạy thật | Phát hành/đốt, mua/bán và chia lợi nhuận đã chạy trên Hardhat; tất toán còn chờ SC-04. `git grep -c "return pendingContract(" -- app/src/lib/ledger/evm.adapter.ts` sang 4 |
| **P1** *(đề nghị, Supervisor chốt mức)* | **Phát hiện tiền vào ví lợi nhuận bằng HỎI ĐỊNH KỲ, không bằng sự kiện on-chain** (BE-07). Hệ quả: (a) độ trễ bằng chu kỳ cron, (b) hai lần nạp giữa hai lượt hỏi bị gộp thành **một** kỳ chia, (c) không biết ai nạp và nạp lúc nào — chỉ biết số dư đã tăng. Nguyên nhân: IN-01/IN-02 (Indexer) chưa làm nên chưa đọc được sự kiện | IN-02 đổi **nguồn tín hiệu** sang sự kiện `Transfer` vào ví lợi nhuận, giữ nguyên bốn nhánh quyết định và toàn bộ phần chia. Điểm cắm đã đánh dấu `@pending IN-02` ngay trên `decideCycle` (`lib/bank/distribution-trigger.service.ts`; FE-08 đổi tên từ `detectNewFunds`) |
| **P2** *(đề nghị, Supervisor chốt mức)* | **`KeeperRun` không có cột tóm tắt.** Lược đồ chỉ có `status` + `error`, nên "số lô đã chia, số ví còn lại" của mỗi vòng chỉ vào được cột `error` — mà cột đó tên là `error`, nhồi tóm tắt thành công vào sẽ làm mọi truy vấn "vòng nào có lỗi" trả về cả vòng chạy đúng. BE-07 vì vậy để `error` chỉ mang thông báo khi thất bại, còn tóm tắt mỗi vòng ghi vào **sổ kiểm toán** | Nếu Owner muốn tóm tắt nằm trong `KeeperRun`: thêm cột `summary String?` vào `KeeperRun`, `IKeeperStore.finishRun`, hai bản hiện thực và `store-constraints.test.ts`. Chưa làm vì vượt phạm vi Tác động của BE-07 |
| **P2** | Giấy phép **T-REX không phải giấy phép mở tiêu chuẩn** ("SEE LICENSE IN LICENSE.md") | Rà soát pháp lý **trước khi** dùng cho sản phẩm thật |
| ~~P2~~ | ~~1 cảnh báo lint ở `src/empty.ts`~~ | **ĐÃ XỬ LÝ ở MC-01 Bước 7.** Cảnh báo là `import/no-anonymous-default-export` do `export default {}`. Đo lại thì default export đó **không cần cho build**, nên xóa luôn thay vì đặt tên biến hay dùng `eslint-disable`. Nay `npx eslint .` cho **0 error, 0 warning**. Đề nghị Supervisor xác nhận rồi xóa dòng này — theo `tech-report-maintenance.md` §8 |
| **P2** *(đề nghị, Supervisor chốt mức)* | **`app/src/empty.ts` + alias `@x402/*` trong `next.config.ts` là vá cho phụ thuộc của bên thứ ba.** `@x402/*` là `peerDependencies` **tùy chọn** của `@coinbase/cdp-sdk` nên npm không cài, nhưng mã cdp-sdk vẫn `import` chúng và cdp-sdk có trong đồ thị module của app theo chuỗi `providers.tsx → @rainbow-me/rainbowkit → @wagmi/connectors/baseAccount → @base-org/account → @coinbase/cdp-sdk`. Bỏ alias ra thì `next build` FAIL 8 lỗi *Module not found* ở 5 specifier | Đã thu gọn tối đa ở MC-01 Bước 7: `empty.ts` còn **1 export** (`toClientEvmSigner`, import tĩnh duy nhất mà build đòi), alias Turbopack còn **1 dòng wildcard**. **ĐIỀU KIỆN XÓA:** khi `cd app && npm ls @coinbase/cdp-sdk` trả về rỗng — tức wagmi/connectors không còn kéo `@base-org/account`. Lúc đó gỡ cả hai khối alias, xóa `app/src/empty.ts`, chạy lại `npm run build` + `npm run cf:build` để xác minh |
| **P1** | **Cờ `isConfig` có HAI nguồn và chỉ một nguồn được đọc.** Lớp quyền thứ hai của `setIssuePrice` đọc bảng hằng số `CONFIG_ROLES` trong mã (`app/src/lib/rbac/config-role.ts`), trong khi cột `Role.isConfig` trong cơ sở dữ liệu đã có dữ liệu (`SEED_ROLE_ROWS` nạp đủ bốn vai) mà **chưa lời gọi nào đọc**. Hệ quả: đổi cờ trong cơ sở dữ liệu không có tác dụng gì, và người vận hành không có cách nào biết — đo bằng `git grep -n "isConfig" -- app/src \| grep -v config-role` | Chờ **AU-01** (SIWE + phiên thật) và **AU-02** (vai đọc từ cơ sở dữ liệu). Khi AU-02 xong thì `isConfigRole()` đọc cột `Role.isConfig`, còn `CONFIG_ROLES` chỉ còn là dữ liệu khởi tạo. **Đừng** đọc cột đó sớm hơn: chưa có phiên thật thì vai lấy từ cookie do client đặt được, nên thêm một lần tra cơ sở dữ liệu chỉ làm chậm mà không chặn được ai |
| **P2** | **`SystemConfigHistory` không có thứ tự tuyệt đối.** Hai lần ghi trùng mốc tới từng phần nghìn giây thì thứ tự tương đối KHÔNG xác định — cả hai bản hiện thực phá thế bằng `id`, một uuid ngẫu nhiên chứ không phải thứ tự chèn. Đã gây một ca kiểm đỏ tuỳ lần chạy ở BE-04 (xem mục C phần bài học) | Thêm một cột số thứ tự tăng dần (`seq BIGSERIAL` ở Postgres, số đếm ở bản bộ nhớ) **khi làm task nào đụng tới bảng này** — không mở task riêng, vì tình huống chỉ xảy ra khi hai lần đổi tham số cách nhau dưới một phần nghìn giây. Tới lúc đó phải sửa cả `listConfigHistory` ở hai bản và bỏ cảnh báo trong doc của cổng |
| **P1** *(đề nghị, Supervisor chốt mức)* | **Rút vault "đúng một lần" chưa chứng minh được trên chuỗi** (BE-13 QĐ-J). Sự kiện `Withdrawn` không mang mã lệnh; mất mã giao dịch thì phải người xem (`NEEDS_REVIEW`). App chỉ cam kết không tự gửi lại | Khi có đợt sửa hợp đồng (trước production): `withdraw(requestRef, expectedPayout, amount)`, sự kiện có `requestRef`, `processedWithdrawals`, kiểm ví nhận ngay lúc thực thi |
| **P1** | **Mã một lần của lệnh rút chỉ kiểm dạng sáu chữ số** (BE-13 CH-2, URD cho phép trong PoC) | AU-01 |
| **P1** *(đề nghị, Supervisor chốt mức)* | **Rút bằng script ngoài app** (BE-13 QĐ-J): `vault-admin.js` vẫn rút và đổi cấu hình được nếu có khoá; thay đổi cấu hình hiện "ngoài app" trong lịch sử, lệnh rút bằng script làm đối soát của app phải chuyển người xem | Gỡ vai rút khỏi ví dùng cho script khi có Fireblocks (IN-04) |
| **P1** | **Token chỉ là token thử** (BE-13 QĐ-J): rút không qua duyệt, mã một lần giả; chỉ chấp nhận được với tiền thử | AU-01, mã một lần thật trước khi dùng tiền thật |
| **P2** *(đề nghị, Supervisor chốt mức)* | **Keeper không tự mở kỳ** (FE-08 QĐ-H): chỉ tiếp tục kỳ Kiểm soát viên đã duyệt; PoC không có lịch gọi; keeper chạy dưới vai mặc định của bản demo nên `TELLER` còn `distribution:snapshot` và `distribution:execute` (không còn action nào dùng, lõi chia vẫn chặn kỳ chưa duyệt) | Vai hệ thống riêng cho keeper, bộ lập lịch, chính sách tự mở kỳ dưới hạn mức |
| **P2** *(đề nghị, Supervisor chốt mức)* | **Lệnh treo không tự hết hạn** (FE-08 QĐ-H): không có lịch gọi nên `expire-orders` không chạy trong PoC | Cùng bộ lập lịch ở dòng trên |
| **P1** *(đề nghị, Supervisor chốt mức)* | **Số kỳ trên chuỗi có thể khác số Kiểm soát viên duyệt** (FE-08 QĐ-H): `createDistributionFromPool` lấy toàn bộ phần chưa phân bổ lúc thực thi; app dừng ở `AMOUNT_CHANGED`, không chốt vault, không trả, bắt duyệt lại số thực tế | Đợt sửa hợp đồng: `openDistribution` nhận số tiền kỳ vọng, sai thì revert |
| **P1** *(đề nghị, Supervisor chốt mức)* | **Một người duyệt, chỉ duyệt tổng số** (FE-08 QĐ-G, QĐ-H): Kiểm soát viên duyệt tổng VNDB của kỳ, không duyệt danh sách hay tỷ lệ; PoC một chữ ký | Quy trình ngân hàng khi lên production (nhiều cấp duyệt, chốt ảnh chụp danh sách trước khi duyệt) |
| **P1** | **Ví liên kết trong hồ sơ không chứng minh quyền sở hữu** (OP-05 QĐ-I, CH-2; xem 3.28): người dùng tự gắn ví vào hồ sơ của mình, không ký thông điệp; hồ sơ, KYC, rủi ro là dữ liệu mẫu trong mã; phiên là cookie. Chỉ chấp nhận được với tiền thử | AU-01: đăng nhập thật, ký thông điệp chứng minh sở hữu ví trước khi ghi, hồ sơ từ hệ thống KYC, ngân hàng xác nhận ánh xạ ví cùng lúc whitelist |
| **P2** | **Indexer chỉ đồng bộ theo nhu cầu**, nên lần mở đầu sau deploy/dựng lại có thể chậm và tạo tải RPC dài | Bổ sung Cron Trigger/tiến trình theo lịch khi lên production; PoC làm nóng bằng ba lần mở `/vault` |
| **P1** | **Indexer không xử lý reorg sâu hơn `INDEXER_CONFIRMATIONS`**; cache có thể giữ log nhánh bị bỏ | Chỉ khi Sếp quyết: xoá `ChainEvent` và `IndexerCursor` của đúng chain theo runbook rồi dựng lại |
| **P2** | **Danh sách ví WPT giới hạn 5.000, chưa phân trang** | Thêm phân trang trước khi số ví từng chuyển token chạm giới hạn; hiện `truncated` chặn chia thiếu |

### D. Cách làm việc

- **Chia commit nhỏ theo mục tiêu.** Không dồn cả phase vào một commit. Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). Mỗi commit phải ở trạng thái build được để `git bisect` và revert từng phần.
- **Quy tắc chống "kẹt":** không hiểu yêu cầu thì **dừng, không đoán** — ghi câu hỏi vào checkpoint kèm 2 cách hiểu khả dĩ. Cùng một lỗi trượt 2 vòng review thì dừng vá lẻ, tổng hợp báo Supervisor.
- **Không sửa mò quá 2 lần** cho cùng một triệu chứng.
- **Vitest xanh KHÔNG có nghĩa là typecheck xanh** (FE-22). Vitest chỉ dịch bỏ kiểu, không kiểm kiểu, nên một tệp test đọc `result.data` khi chưa thu hẹp `result.ok` vẫn chạy xanh mà `npm run typecheck` đỏ. Chạy `npx tsc --noEmit` trước mỗi commit có sửa test, không chỉ trước khi nộp.
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
| undici (dev, công cụ local) | `EnvHttpProxyAgent` cho `start:proxy`, không import vào app/Worker | 7.29.1 | 7.29.1 (lock hiện tại) | MIT |
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
| T-REX (ERC-3643) | Nguồn chuẩn chữ ký cho bề mặt ERC-3643 PoC; bộ đầy đủ vẫn tách riêng | 4.1.6 | 4.1.6 | ⚠️ Riêng |
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
| Playwright | E2E trên bản build — project `mock` **54 test / 7 tệp** (`cd app && npx playwright test --list`), project `hardhat` **13 test / 2 tệp** (`E2E_CHAIN=hardhat-local npx playwright test --list`) | 1.63.0 | 1.63.0 | Apache-2.0 |
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
| `e2e` | `npx playwright test` trên bản build `.next` của phần `build` (`next start`), chain `mock`, KHÔNG có nút hardhat | C |
| `evm` | Dựng bản build riêng `.next-hardhat` (chain mặc định nhúng lúc dựng), `evm-local.sh reset`, project `hardhat`, rồi dọn app và nút kể cả khi đỏ (OP-03) | C, sau `build e2e` |

Bộ mặc định (chạy `bash scripts/run-local-all.sh` không tham số) = `arch markers checkpoint
contracts app`, tức **giữ nguyên** hành vi có từ trước OP-01. `build`, `e2e` và `evm` cố ý ở
ngoài: cả ba nặng, và `build`/`evm` không chạy được ở nơi bị chặn ra ngoài.

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
| `app/src/lib/config/build-info.ts` | Nơi đọc metadata khi chạy; `config/build-env.ts` đọc cùng ba biến trong lúc dựng để nhúng metadata công khai qua `next.config.env`. Tách khỏi `env.ts` vì `serverEnv()` **ném lỗi** khi cấu hình sai, còn `/api/version` phải trả lời được **kể cả lúc** cấu hình đang sai |
| Trường `source` | Nói từng trường là `env` hay `fallback`. Cần vì `commit: "local"` một mình không phân biệt được "đang chạy cục bộ" với "quy trình triển khai quên truyền biến" — hai chuyện xử lý khác nhau hoàn toàn |
| `export const dynamic = 'force-dynamic'` | Tường minh. Một `/api/version` bị đóng băng vào bản dựng vẫn trả 200 kèm mã commit CŨ, tức kiểm khói báo xanh cho đúng thứ nó phải phát hiện |
| `scripts/smoke-test.mjs <địa-chỉ>` | Gọi `/api/version` và `/api/token?chain=mock`. **Chạy tay, chưa gắn vào triển khai.** Mã thoát: `0` đạt · `1` có phép kiểm đỏ · `2` gọi sai |

Vì sao kiểm khói cần **hai** phép kiểm: `/api/version` không chạm gì ngoài `process.env` nên nó
vẫn xanh khi tầng nghiệp vụ hỏng hoàn toàn; `/api/token` đi qua service và cổng ledger. Mặc định
`chain=mock` để phép kiểm đỏ thì đỏ vì **ứng dụng**, không vì hạ tầng chưa lên. Chỉ gọi `GET`:
kiểm khói chạy trên môi trường thật, một phép kiểm có ghi sẽ để lại dữ liệu rác trong sổ sách mỗi
lần triển khai.

**OP-02 — metadata của bản Cloudflare.** `npm run cf:build` cấp `BUILD_COMMIT_SHA`,
`BUILD_BRANCH`, `BUILD_TIME` từ Git/UTC nếu nơi dựng chưa cấp. `config/build-env.ts` chỉ đọc ba
biến công khai này và `next.config.ts` nhúng chúng vào bundle; Worker không phải cấu hình lại
metadata lúc chạy. Không thêm secret vào `next.config.env`. `/api/version` vẫn chạy theo request,
nhưng metadata đã nhúng mô tả đúng commit đã dựng. Khi mở rộng metadata: sửa `config/build-env.ts`,
`build-info.ts` và lệnh dựng cùng nhau, rồi chạy `scripts/smoke-test.mjs --expect-commit` trên bản dựng.
Chạy `npm run dev` không cấp biến vẫn dùng fallback như trước.

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
| Thêm trường vào `/api/version` | `build-info.ts` và `build-env.ts` (đọc metadata runtime/build), rồi `app/test/build-info.test.ts`. Route handler không tự đọc `process.env` |

---

# PHẦN 3. BẢN ĐỒ CODE

## 3.1. `app/src/lib/ledger/` — cổng blockchain (Luật #1)

| File | Vai trò |
|---|---|
| `ledger.port.ts` | Định nghĩa `ILedgerPort` — hợp đồng mà mọi chain phải tuân theo (481 dòng) |
| `index.ts` | Factory `getLedger(chain, signer)` — map chain → adapter |
| `evm.adapter.ts` | Hiện thực EVM bằng viem (1.237 dòng) |
| `mock.adapter.ts` | Ledger mock trong RAM hoặc lưu bền qua state store (873 dòng) |
| `stellar.adapter.ts` | Stub Soroban; riêng vault trả trạng thái chưa triển khai, các hàm khác ném lỗi rõ ràng (200 dòng) |
| `address.ts` | `normalizeEvmAddress()` — chuẩn hóa và kiểm checksum EIP-55 |

### `ILedgerPort` — 8 nhóm, 47 method

Từ BE-01, `ILedgerPort` được tách thành các interface con theo nghiệp vụ trong cùng
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
| 10 | | `mintInitialSupply` | ✅ | ✅ | ⏳ | Phase 7 |
| 11 | | `isInitialSupplyMinted` | ✅ | ✅ | ⏳ | Phase 7 |
| 12 | | `spvWallet` | ✅ | ✅ | ⏳ | Phase 7 |
| 13 | `ILedgerPurchase` | `quotePurchase` | ✅ | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 14 | | `setPurchasePrice` (BE-04) | ✅ | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 15 | | `paymentBalanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 16 | | `paymentAllowanceOf` | ✅ | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 17 | | `wptAllowanceOf` (SC-03) | ✅ (luôn đủ) | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 18 | | `findOrderSettlement` (SC-03) | ✅ | ✅ | ⏳ | Soroban chưa có sự kiện quyết toán |
| 18a | | `latestBlockTimestamp` (FE-05) | ✅ (giờ máy chủ) | ✅ | ⏳ | đọc ledger mới nhất của Soroban |
| 18b | | `permitDomain(token)` (FE-05) | ⏳ (không áp dụng) | ✅ | ⏳ | ủy quyền bằng chữ ký cho token Soroban |
| 18c | | `permitNonce(token, owner)` (FE-05) | ⏳ (không áp dụng) | ✅ | ⏳ | như trên |
| 19 | | `mintPayment` (BE-16) | ✅ | ✅ | ⏳ | Phase 7 (token VNDB bản Soroban) |
| 20 | | `executePurchase` (FE-05: kèm `permit` thì `buyWithPermit`) | ✅ (bỏ qua `permit`) | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 21 | | `executeSale` (BE-14; FE-05: kèm `permit` thì `sellWithPermit`) | ✅ (bỏ qua `permit`) | ✅ | ⏳ | Soroban chưa có contract khớp lệnh |
| 22 | `ILedgerSnapshot` | `takeSnapshot` | ✅ | ✅ | ⏳ | Phase 7 |
| 23 | | `balanceOfAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 24 | | `totalSupplyAt` | ✅ | ✅ | ⏳ | Phase 7 |
| 25 | `ILedgerDistribution` | `profitPoolBalance` | ✅ | ✅ | ⏳ | Phase 7 |
| 26 | | `distributeBatch(distributionId, wallets)` | ✅ | ✅ | ⏳ | SC-06 (gộp SC-05): mang mã kỳ trên chuỗi |
| 26a | | `unallocatedProfit` (SC-06) | ✅ | ✅ | ⏳ | căn cứ mở kỳ và ngưỡng BE-07 |
| 26b | | `reservedProfit` (SC-06) | ✅ | ✅ | ⏳ | phát hiện quỹ hụt |
| 26c | | `openDistribution(periodKey)` (SC-06) | ✅ | ✅ | ⏳ | trả mã giao dịch ngay (PENDING) |
| 26d | | `findDistribution(periodKey)` (SC-06) | ✅ | ✅ | ⏳ | tra theo nhãn, không quét sự kiện |
| 26e | | `distributionState` (SC-06) | ✅ | ✅ | ⏳ | `expired` theo đồng hồ chuỗi |
| 26f | | `isDistributionPaid` (SC-06) | ✅ | ✅ | ⏳ | căn cứ "đã trả" (QĐ-14) |
| 26g | | `closeDistribution` (SC-06) | ✅ | ✅ | ⏳ | không chuyển tiền |
| 27 | `ILedgerSettlement` | `setSettlementMode` | ✅ | ⏳ | ⏳ | quyết định cờ tất toán nằm ở contract nào (SC-04) |
| 28 | | `isSettlementMode` | ✅ | ⏳ | ⏳ | quyết định cờ tất toán nằm ở contract nào (SC-04) |
| 29 | | `setNavRate` | ✅ | ⏳ | ⏳ | quyết định NAV có phải `Redemption.rate` (SC-04) |
| 30 | | `navRate` | ✅ | ⏳ | ⏳ | quyết định NAV có phải `Redemption.rate` (SC-04) |
| 31 | `ILedgerVault` | `vaultStatus` | ✅ (vault mô phỏng, BE-13) | ✅ | ✅ (trả `null`) | SC-07; mock có vault logic `MOCK_VAULT_ADDRESS` từ BE-13 |
| 32 | | `vaultPeriodCloses` | ✅ | ✅ | ✅ (mảng rỗng) | EVM quét từ `deployBlock`, không quét block 0; mock đọc sự kiện bền trong state |
| 32a | | `closeVaultPeriod` (SC-06) | ✅ (BE-13) | ✅ | ⏳ | đẩy số đã chia vào vault, cần `CONFIG_ROLE` |
| 32b | | `findVaultPeriodClose` (SC-06) | ✅ | ✅ | ✅ (`null`) | lọc `PeriodClosed` theo `periodRef` indexed |
| 32c | | `setVaultPercentRate`, `setVaultFixedLock`, `setVaultLockMode`, `setVaultPayoutWallet` (BE-13) | ✅ | ✅ | ⏳ | trả PENDING; `setVaultLockMode` không nhận `UNSET` |
| 32d | | `withdrawFromVault(amount)` (BE-13) | ✅ | ✅ | ⏳ | tiền về `payoutWallet` của vault, cần `WITHDRAWER_ROLE` |
| 32e | | `findVaultWithdrawals({ fromBlock, to, amount })` (BE-13) | ✅ | ✅ | ⏳ | sự kiện ứng viên khi mất mã giao dịch |
| 32f | | `vaultWithdrawalReceipt(txHash)` (BE-13) | ✅ | ✅ | ⏳ | biên nhận kèm `Withdrawn` của chính vault; chưa có thì `null` |
| 32g | | `vaultConfigEvents({ fromBlock })` (BE-13 QĐ-C1) | ✅ | ✅ | ✅ (mảng rỗng) | bốn sự kiện cấu hình từ `deployBlock` |
| 33 | `ILedgerRead` | `balanceOf` | ✅ | ✅ | ⏳ | Phase 7 |
| 34 | | `tokenInfo` | ✅ | ✅ | ⏳ | Phase 7 |
| 35 | | `waitReceipt` | ✅ | ✅ | ⏳ | Phase 7 |
| 35a | | `latestBlockNumber` (BE-13) | ✅ (bộ đếm `nonce`) | ✅ (`cacheTime: 0`) | ⏳ | mốc `claimedBlock` của lệnh rút |

**Bốn method tất toán (27–30) chặn vì một QUYẾT ĐỊNH, không vì một contract chưa có.** Cả
`Redemption` lẫn `ProjectToken` đã deploy; thiếu là câu trả lời cho "cờ *đang tất toán* nằm ở
đâu" và "NAV có phải `Redemption.rate` hay không". Owner đã mở mã task **SC-04** cho quyết định
đó, nên marker trong `evm.adapter.ts` ghi `@blocked SC-04` — xem bảng sinh tự động ở 3.10. Đừng
nối tạm vào `Redemption.paused`: nó **ngược hướng** với "bật giai đoạn tất toán".

**`executeSale` thêm ở BE-14, và KHÔNG kèm hàm báo giá bán riêng.** Số VNDB nhà đầu tư nhận khi bán
= số lượng × **cùng** giá mà `quotePurchase` đọc — giá do ngân hàng cấu hình, một nguồn cho hai
chiều. Thêm `quoteSale` là thêm nguồn giá thứ hai và hai nguồn sẽ lệch nhau. Mock kiểm đủ (WPT của
nhà đầu tư, VNDB của ví SPV, KYC, đóng băng, tất toán) TRƯỚC khi ghi bốn bút toán; **không** kiểm uỷ
quyền WPT qua `wptAllowanceOf` trước khi hỏi thanh khoản VNDB của vault. Mock cố ý trả mức tối đa
vì không mô phỏng bước approve; EVM đọc allowance WPT cấp cho `OrderSettlement`.

**FE-05 thêm ba method đọc và trường `SettlementOrder.permit`.** `permitDomain` trả nguyên văn
`eip712Domain()` (ERC-5267) của VNDToken (`payment`) hoặc ProjectToken (`project`), CHƯA kiểm; tầng
nghiệp vụ kiểm khuôn ở `lib/bank/permit.ts`. `latestBlockTimestamp` cho thời hạn chữ ký theo đồng hồ
chuỗi. Có `permit` thì adapter EVM gọi biến thể `WithPermit` (hàm `settlementCall`), không có thì
`buy`/`sell`. Adapter EVM nay **xếp hàng mô phỏng và gửi** theo cặp (chain, ví ký) trong một tiến
trình (`inSendQueue`): hai lệnh đồng thời từ cùng ví máy chủ không còn lấy trùng nonce giao dịch, và
lời gọi sau mô phỏng trên trạng thái đã có giao dịch trước nên nhận đúng lỗi nghiệp vụ. Lỗi
`ERC20InsufficientAllowance` do token ném bên trong `OrderSettlement` được nhận diện theo selector
`0xfb8f41b2` (ABI khớp lệnh không giải được tên của nó).

**`mintPayment` thêm ở BE-16** cho chức năng nạp VNDB của bản trình diễn — đường tạo ra tiền, chỉ
`lib/bank/demo-payment.service.ts` được gọi (sau hai lớp chặn, xem 3.19). Chain thật gọi `VNDToken.mint`
(đã có trong ABI) và cần ví vận hành giữ `MINTER_ROLE`; thiếu vai thì adapter dịch custom error
`AccessControlUnauthorizedAccount` thành câu nêu đúng **ví, vai và địa chỉ hợp đồng**, thay cho câu
chung "thiếu role" của bảng dịch. ⚠️ **Bản mock cộng kèm mức ủy quyền** cho hợp đồng khớp lệnh bằng số
vừa nạp: `VNDToken.mint` không làm vậy, trên chuỗi thật nhà đầu tư tự `approve` hoặc dùng `permit`
bằng ví. Đây là lệch contract **có chủ ý**, vì mock không mô phỏng chữ ký token; FE-05 sẽ cung cấp
đường ký permit cho EVM.
`evm.adapter` có thêm `writeOn()` — ghi lên một contract bất kỳ trong `packages/shared`, `write()` nay
là `writeOn` trên `ProjectToken`.

`spvWallet` thêm ở **BE-02**. Lý do: QĐ-2 của luồng mua buộc kiểm "ví thanh toán SPV còn đủ
WPT" **trước khi** gửi giao dịch, mà phép kiểm đó là `balanceOf(<ví SPV>)` — cần một địa chỉ.
`executePurchase` biết ví đó nhưng không nói ra, nên tầng nghiệp vụ không có đường lấy được:
hoặc thêm method này, hoặc bỏ hẳn một trong bốn phép kiểm. Khác hẳn `holdersAt` đã bị từ
chối ở dưới — chuỗi **trả lời được** địa chỉ ví SPV, còn danh sách người nắm giữ thì không.

Kiểu đi kèm: `TransferCheck` (`{ allowed: true } | { allowed: false; reason: string }`),
`SnapshotResult` (`{ tx, snapshotId }`) và `ChainDistribution` (SC-06: kỳ đọc từ chuỗi, kèm địa chỉ
hợp đồng chia và cờ `expired` theo đồng hồ chuỗi). `LedgerError.reverted` (SC-06) phân biệt hợp đồng
**chắc chắn từ chối** với lỗi chưa xác định (RPC, hết thời gian chờ); mock đặt `true` cho mọi lần từ
chối theo luật.

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
- `mock.adapter` phải **nghiêm ngặt ngang contract thật**. Bảng ràng buộc bắt buộc ở `docs/be-01-ledger-port/design.md` mục 3; 61 test ở `test/mock-ledger.test.ts` phủ từng dòng (BE-14 thêm ba ca cho `executeSale`, BE-16 bốn ca cho `mintPayment` ở ba bản).
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
| `server.signer.ts` | Tài khoản ký ngân hàng | Chain thật đọc khóa qua `config/env.ts` và vẫn ném `SignerUnavailableError` nếu thiếu. OP-02: riêng `mock` trả tài khoản json-rpc cố định làm nhãn audit, không có private key và không ký/gửi giao dịch thật |
| `wallet.signer.ts` | Ví người dùng qua EIP-1193 | Không phụ thuộc React, nhận provider từ ngoài |
| `wallet-permit.ts` (FE-05) | `signPermitWithWallet(provider, typedData)`: ký typed data permit do máy chủ chuẩn bị bằng `createWalletSigner` (account `json-rpc`, ví giữ khoá, phương thức `eth_signTypedData_v4`) | Dùng được phía trình duyệt (không nhập `index.ts`, nơi có mã máy chủ). Chặn trước khi mở ví nếu ví đang chọn khác ví đặt lệnh |
| `fireblocks.signer.stub.ts` | Chỗ cắm Phase 5 | **Ném lỗi, cấm fallback về khóa server** |
| `index.ts` | `getBankSigner()` chọn custody theo `SIGNER_KIND`, có cache | |

**Cách mở rộng (Phase 5):** thay nội dung `fireblocks.signer.stub.ts`, khai báo trong `index.ts`. Tầng nghiệp vụ **không đổi một dòng**.

## 3.3. `app/src/lib/rbac/` — cổng phân quyền (Luật #3)

| File | Vai trò |
|---|---|
| `permissions.ts` | Bảng dữ liệu thuần: 4 role × 32 action |
| `can.ts` | `can(role, action)` + `assertCan()` + `permissionsOf()` — **điểm kiểm quyền duy nhất** |
| `session.ts` | `currentRole()` — đọc vai trò hiện tại từ cookie `bidv_role`; `currentActorId(role)` (BE-12) — mã tài khoản người thao tác, `DEMO_ACTOR` hoặc mã mẫu của vai (`SAMPLE_ACCOUNTS`), AU-01 sẽ thay bằng phiên đăng nhập |
| `demo-payment.ts` | Chốt chặn **hai lớp** cho hai chức năng chỉ môi trường thử, chung một khuôn kiểm (`DemoGate`): `demo:mint-payment` — `canMintDemoPayment()`, `assertCanMintDemoPayment()`, `DemoPaymentMintDisabledError`; `demo:mint-token` (FE-22) — `canMintDemoToken()`, `assertCanMintDemoToken()`, `DemoTokenMintDisabledError`. Tên tệp giữ từ BE-08 để không đổi chỗ nhập |
| `config-role.ts` | Chốt chặn **hai lớp** cho việc đổi tham số hệ thống (BE-04): `CONFIG_ROLES`, `isConfigRole()`, `assertCanConfigure()`, `NotConfigRoleError`. Thứ tự là **RBAC trước, `isConfig` sau** — ngược `demo-payment.ts`, vì lớp thứ hai ở đây gắn với TỪNG VAI nên phải biết vai nào rồi mới trả lời được |
| `area-gates.ts` | `AREAS`, `AREA_GATES`, `AREA_LABELS` — cổng vào từng khu vực giao diện (FE-20). Dữ liệu thuần, **không** nằm trong JSX của layout: layout là Server Component nên không unit-test được, mà DoD đòi kiểm chặn cả hai chiều |

**Ma trận quyền (đủ 32 action, tên đúng như trong `ACTIONS`):**

Cột "Nguồn" nói action do phase nào khai: **BE-08** (bổ sung quyền cho ba luồng), **BE-02**
(nghiệp vụ lệnh mua), **FE-20** (cổng khu vực giao diện), **BE-12** (lập–duyệt), **FE-22** (đóng đường
đi vòng). Action không ghi nguồn là có từ P1.

| Action | INVESTOR | SELLER | TELLER | CONTROLLER | Nguồn |
|---|:--:|:--:|:--:|:--:|:--:|
| `token:mint` | ❌ | ❌ | ❌ | ❌ | — (FE-22 gỡ khỏi TELLER) |
| `token:burn` | ❌ | ❌ | ❌ | ❌ | — (FE-22 gỡ khỏi TELLER) |
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
| `distribution:approve` | ❌ | ❌ | ❌ | ✅ | FE-08 (duyệt tổng số của kỳ rồi chia; 3.27) |
| `settlement:initiate` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `settlement:set-nav` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `settlement:confirm` | ✅ | ❌ | ❌ | ❌ | BE-08 |
| `treasury:manage` | ❌ | ❌ | ✅ | ❌ | BE-08 |
| `demo:mint-payment` | ❌ | ❌ | ✅ **+ cờ** | ❌ | BE-08 |
| `demo:mint-token` | ❌ | ❌ | ✅ **+ cờ** | ❌ | FE-22 |
| `balance:read` | ✅ | ✅ | ✅ | ✅ | — |
| `txn:read` | ✅ | ✅ | ✅ | ✅ | — |
| `audit:read` | ❌ | ❌ | ✅ | ✅ | — |
| `order:read` | ✅ | ✅ | ✅ | ✅ | BE-02 |
| `order:read:all` | ❌ | ✅ | ✅ | ✅ | BE-02, SELLER từ BE-14 |
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

⚠️ **`token:mint` / `token:burn` KHÔNG vai nào có (FE-22).** Trước FE-22 `TELLER` giữ hai quyền này
nên tự tạo và huỷ token được mà không qua Kiểm soát viên — lập–duyệt của BE-12 thành hình thức. Hai
tên **vẫn ở trong `ACTIONS`**: chúng là tên hành động trong sổ kiểm toán của lần thực hiện sau khi
duyệt, và gỡ khỏi `ACTIONS` là làm bảng quyền "teo lại" mà `verify-arch-rules.sh` chặn. Cấp lại cho
bất kỳ vai nào là mở lại đường đi vòng; `rbac.test.ts` ca 9 của FE-22 đỏ khi điều đó xảy ra, và mốc
`PERMISSIONS_BEFORE_BE08` ghi hai cặp này vào `INTENTIONALLY_REMOVED` thay vì im lặng bỏ qua.

⚠️ **`demo:mint-token` (FE-22) cùng mô hình HAI LỚP với `demo:mint-payment`**: quyền + cờ
`ENABLE_DEMO_TOKEN_MINT` (mặc định **tắt**). Đây là chốt chặn của **mọi** đường tạo token trực tiếp
còn lại — `mintToInvestorDirect` (màn `/mint`, `POST /api/mint`) và `issueInitialSupply` — qua
`authorize('demo:mint-token', …, assertCanMintDemoToken)` nên lần bị chặn vì cờ cũng vào sổ kiểm toán.
Hai cờ độc lập: bật cờ VNDB không mở đường tạo WPT.

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
`distribution:snapshot` và `distribution:execute` (BE-06, xem 4.5), `demo:mint-payment` (BE-16, xem
3.19). Bốn hành động còn lại — `order:expire` (BE-07), ba `settlement:*` (BE-05) — **chưa có nghiệp vụ
gọi**. BE-16 cũng chốt bằng test rằng **chỉ `TELLER`** giữ `demo:mint-payment` và `demo:mint-token`:
Người bán là pháp nhân ngoài ngân hàng, không có lý do tạo ra tiền.

**FE-08 đổi người bấm chia:** Kiểm soát viên DUYỆT tổng số của kỳ bằng `distribution:approve`, và
lần duyệt đúng số mới mở kỳ, chốt vault, chia; bốn action dùng `distribution:snapshot`/`execute` đã
gỡ, lõi chia từ chối kỳ chưa `APPROVED` bất kể vai gọi. Đoạn dưới mô tả lý do của BE-08, vẫn đúng cho
`distribution:execute` (Kiểm soát viên không gọi trực tiếp hàm chi trả).

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
  không phải nhà đầu tư tự đổi. Hành động đốt **từng định tái dùng** `token:burn` — từ FE-22 không vai
  nào có quyền đó, nên BE-05 phải đốt qua lập–duyệt hoặc khai quyền riêng (câu hỏi mở CH-3 ở
  `docs/CHECKPOINT_FE22.md`).
- `reconcile:read` nằm trong nhóm `READ_ONLY` nên ba vai ngân hàng tự nhận được; `INVESTOR` không
  spread nhóm đó nên tự động không có. Đúng ý định: báo cáo đối soát là dữ liệu toàn hệ.

⚠️ **`demo:mint-payment` cần HAI lớp, quyền RBAC một mình KHÔNG đủ.** Bảng quyền là mã nguồn, nên
chỉ cần ai gán nhầm vai `TELLER` trên môi trường thật là chức năng tự phát hành tiền mở ra. Lớp
thứ hai là cờ `ENABLE_DEMO_PAYMENT_MINT` (bản PoC mặc định **bật**, production phải đặt `false`,
xem 3.6), nằm ở cấu hình triển khai nên có thể đóng độc lập với bảng quyền. Điểm kiểm duy nhất là
`demo-payment.ts`, thứ tự **cờ trước,
quyền sau** — cờ tắt thì từ chối luôn, không đọc vai, nhờ vậy thông báo nói đúng nguyên nhân và
không có đường nào để vai trò "bù" cho cờ. Đừng gọi `can(role, 'demo:mint-payment')` trực tiếp.

⚠️ **`demo-payment.ts` KHÔNG được export từ `rbac/index.ts`.** Barrel đó là client-safe (component
dùng `can()` để ẩn/hiện nút), còn file này `server-only` vì phải đọc env. Đưa vào barrel là làm mọi
component `import ... from '@/lib/rbac'` fail build.

**Lưu ý (BE-13 QĐ-A):** `can(role: unknown, ...)` nhận `unknown` có chủ ý để dữ liệu ngoài vào an toàn; vai lạ **không có quyền nào**: `can` trả `false`, `permissionsOf` trả rỗng, `assertCan` ném `ForbiddenError` ghi vai là `UNKNOWN` (`UNKNOWN_ROLE`, kiểu `RoleOrUnknown`). `FALLBACK_ROLE` đã gỡ: trước BE-13 vai lạ mượn quyền của `SELLER`, mà từ BE-14 `SELLER` đọc được sổ lệnh toàn hệ và từ BE-13 có quyền ghi `vault:withdraw`. Cùng nguyên tắc ở `config-role.ts` và `demo-payment.ts`. `currentRole()` KHÔNG đổi: cookie thiếu hoặc hỏng vẫn lấy vai mặc định của bản demo (đó là lựa chọn vai của phiên PoC, không phải phép kiểm quyền).

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
| `authorize.ts` | Guard + quy lỗi **dùng chung mọi nghiệp vụ**. FE-22: `authorize()` nhận tham số thứ tư `check` (mặc định `assertCan`) cho quyền cần thêm lớp chặn ngoài bảng quyền — lần bị chặn vì cờ vẫn vào sổ kiểm toán | `authorize()`, `toResult()` |
| `mint.service.ts` | KYC/whitelist + mint LẺ. ⚠️ `mintToInvestorDirect` (BE-04 đổi tên từ `mintTokens`) là **đường dữ liệu thử**, không phải luồng phát hành chính: nó mint thẳng cho từng ví nên làm **phình tổng cung** mỗi lần gọi. Từ FE-22 nằm sau hai lớp chặn `demo:mint-token` + `ENABLE_DEMO_TOKEN_MINT` | `onboardInvestor()`, `mintToInvestorDirect()`, `readBalance()`, `listTransactions()`, `tokenOverview()` |
| `issuance.service.ts` | **Phát hành NHIỀU LẦN** vào ví SPV, mỗi lần không vượt **trần còn lại** (BE-04, nhiều lần từ BE-12). Trần đọc từ bảng `Project`, tổng cung đọc từ chuỗi. `executeIssuance` là lõi KHÔNG kiểm quyền, chỉ hai nơi gọi: lần duyệt yêu cầu Mint và `issueInitialSupply` — từ FE-22 là **đường dữ liệu thử** sau hai lớp chặn `demo:mint-token` + cờ (ca 10 của FE-22 quét mã để giữ điều này); `trackTxn` là thứ tự "lưu giao dịch chờ → đợi biên nhận" dùng chung với Burn | `issueInitialSupply()`, `getIssuanceStatus()`, `executeIssuance()`, `remainingIssuanceCap()`, `readSupplyMetrics()` (FE-21 — năm chỉ tiêu nguồn cung tính **một chỗ**, dùng chung cho màn Người bán, khối kiểm tra Burn và khối thông tin token của FE-22), `trackTxn()` |
| `token-request.service.ts` | **Lập–duyệt yêu cầu Mint/Burn** (BE-12). Lập chỉ ghi `PENDING`; duyệt kiểm lại toàn bộ điều kiện, chiếm quyền `PENDING → EXECUTING` bằng `UPDATE` có điều kiện rồi mới gửi giao dịch; chặn người lập tự duyệt/từ chối — xem 4.3. FE-22 thêm các phép đọc cho hai màn. FE-27 bắt mọi phép list/detail/stats và badge menu nhận chain; mở URL yêu cầu thuộc chain khác trả `REQUEST_CHECK` trước khi có thể duyệt/từ chối | `previewTokenRequest()`, `createTokenRequest()`, `approveTokenRequest()`, `rejectTokenRequest()`, `listTokenRequests()`, `getPendingWork()`, `getTokenInfo()`, `getDraftStats()`, `getApprovalStats()`, `getTokenRequestDetail()`, `startOfVietnamDay()` |
| `config.service.ts` | Tham số hệ thống: đổi giá phát hành (BE-04). FE-27 tách mỗi chain một giá; vẫn giữ thứ tự **đẩy xuống ledger trước, ghi cơ sở dữ liệu sau** — xem 3.12 | `getIssuePrice()`, `setIssuePrice()` |
| `seller.service.ts` | **Kênh Người bán, chỉ đọc** (FE-21). Cổng `seller:read` kiểm lại trong service. Dữ liệu "của mình" = sổ lệnh và số dư của ví SPV — xem 3.16 | `getSellerOverview()`, `listSellerTransactions()` |
| `withdraw-limit.ts` | Báo giá một lần rút, hàm **thuần**; từ BE-13 phần được rút là `withdrawable` của vault, không phí, số nhận bằng số rút | `quoteWithdraw()` |
| `portfolio.service.ts` | Vị thế nhà đầu tư (chỉ đọc) | `getPortfolio()`, `getWalletTransactions()`, `getTokenSummary()` |
| `purchase.service.ts` | Nghiệp vụ lệnh mua WPT (BE-02) + xem trước điều kiện (BE-03) + chiều bán (BE-14) + **tự quyết toán, chống trùng và can thiệp an toàn** (BE-17) + **chữ ký permit trên chain thật** (FE-05). Hai chiều và hai đường quyết toán dùng chung `runOrderChecks`/`settleStoredOrder` — xem 4.2 và 3.25 | `previewPurchase()`, `preparePermit()`, `placeOrder()`, `executeOrder()`, `listOrders()`, `orderDailyStats()`, `expireStaleOrders()` |
| `permit.ts` (FE-05) | Domain permit đọc từ chuỗi và kiểm khuôn; dựng typed data theo chiều lệnh; kiểm và tách chữ ký. Một nơi dựng typed data cho cả lúc chuẩn bị lẫn lúc kiểm | `readPermitDomain()`, `assertSupportedPermitDomain()`, `buildOrderPermitTypedData()`, `verifyOrderPermitSignature()`, `splitPermitSignature()`, `isPermitChain()` |
| `settlement-steps.ts` | **Năm bước quyết toán** (BE-14): ánh xạ bảy trạng thái sang năm bước hiển thị kèm mốc thời gian, và bốn bút toán của bước quyết toán (tất cả hoặc không gì). Hàm thuần, không `server-only` — xem 4.2 | `toSettlementSteps()`, `toSettlementView()`, `SETTLEMENT_STEP_IDS`, `SETTLEMENT_RULE` |
| `trade.service.ts` | **Phép đọc cho hai màn Nhà đầu tư** (FE-25), chỉ đọc, `assertCan`: bối cảnh giao dịch (token, số dư, giá, trần mua và bán), năm điều kiện trước lệnh (FE-24: định danh + rủi ro đọc hồ sơ đúng tài khoản, rồi mới dùng bộ kiểm thanh khoản), chi tiết lệnh kèm nhật ký kiểm toán, xem 3.18 | `getTradeContext()`, `previewTrade()`, `getOrderDetail()`, `TRADE_CONDITION_KEYS` |
| `account-profile.service.ts` | **Nguồn hồ sơ mẫu bốn vai và phép đọc hồ sơ của chính phiên** (FE-24). Khớp đồng thời mã người dùng + vai; không nhận mã hồ sơ từ client. Hồ sơ khách hàng có KYC/rủi ro/AML/hạn mức/ví; hồ sơ cán bộ không có các trường đầu tư. AU-01 thay nguồn mẫu bằng kho người dùng thật | `getOwnAccountProfile()`, `findOwnAccountProfile()`, `findInvestorProfileByWallet()` |
| `ops-transactions.service.ts` | **Phép đọc màn Giao dịch vận hành** (FE-06/BE-17): guard `ops:read`, lọc + đếm + phân trang ở store, bước hiện tại từ `OrderView.steps`; `intervention` phân biệt tiếp tục, đối soát receipt và đối soát tay; chi tiết đi qua guard vận hành rồi dùng lại view-model FE-25 | `listOpsOrders()`, `getOpsOrderDetail()` |
| `demo-payment.service.ts` | **Nạp VNDB mô phỏng** (BE-16) — đường TẠO RA TIỀN cho bản trình diễn. Hai lớp chặn qua `authorize(..., assertCanMintDemoPayment)` (cờ trước, quyền sau, lần bị chặn ghi `DENIED`); trần một lần nạp đọc từ cấu hình; chỉ nạp cho ví đã KYC/whitelist hoặc ví người bán; ghi `Txn` (`payment-mint`) và sổ kiểm toán cả lần bị chặn. Xem 3.19 | `mintDemoPayment()`, `demoPaymentContext()`, `DEMO_PAYMENT_OPERATION` |
| `distribution.service.ts` | **Chia lợi nhuận** theo tỷ lệ nắm giữ tại ảnh chụp (BE-06). Danh sách người nhận dựng từ **cơ sở dữ liệu**, không từ chuỗi — xem 4.5. ⚠️ BE-07: `distributePeriod` nay dừng sau `distribution.max_batches_per_run` lô, nên **`outstanding` khác 0 là kết cục bình thường** và người gọi phải gọi lại | `openPeriod()`, `previewDistribution()`, `distributePeriod()`, `getDistributionPeriod()` |
| `distribution-trigger.service.ts` | **Tiến trình tự động chia** (BE-07): phát hiện ví lợi nhuận nhận tiền rồi chia, không cần người bấm. Gọi lại nghiệp vụ của `distribution.service.ts`, **không** tự chia — xem 3.14 | `runDistributionCycle()`, `listDistributionRuns()`, hằng `DISTRIBUTION_JOB_NAME` |
| `purchase.state.ts` | Mô hình trạng thái lệnh mua **và bán** — dữ liệu, không phải logic. `ORDER_STATUSES`, `ORDER_SIDES` re-export từ store; BE-17 thêm tập trạng thái can thiệp, không thêm trạng thái mới | `ORDER_TRANSITIONS`, `canTransitionOrder()`, `INTERVENTION_ORDER_STATUSES`, `findPaidPendingDeliveryStatuses()` |
| `issuance.ts` | Quy đổi WPT → VND theo giá phát hành. **Không giữ hằng số giá**: re-export `WPT_ISSUE_PRICE_VND` từ `lib/config/issue-terms.ts` (xem 3.6). ⚠️ BE-04 đổi chữ ký thành `wptToVnd(amount, issuePriceVnd)` — nhận giá làm **tham số** để tệp này giữ được tính thuần và **không** phải thành `server-only` | `wptToVnd()`, re-export `WPT_ISSUE_PRICE_VND` |
| `audit.service.ts` | Đọc sổ kiểm toán | `listAuditLog()` |
| `result.ts` | Kiểu `Result<T>` + `ok`/`err` + `httpStatusFor` | Chuẩn hóa lỗi |
| `schemas.ts` | Schema Zod dùng chung FE/BE | `mintSchema`, `placeOrderSchema`, `previewPurchaseSchema` (**bút danh của `placeOrderSchema`**, không khai lại), `executeOrderSchema`, `orderQuerySchema`, `orderDailyStatsSchema`, `issueInitialSupplySchema`, `createTokenRequestSchema`; FE-27 bắt `approveTokenRequestSchema` / `rejectTokenRequestSchema` / `tokenRequestQuerySchema` / `tokenRequestDetailSchema` mang chain để service không suy chain từ bản ghi hoặc giao diện; cùng các schema token/distribution/keeper và `amountSchema`, `walletSchema` |

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

**BE-14: lệnh bán dùng CHUNG bảng trạng thái này**, phân biệt bằng cột `side` (`BUY` | `SELL`, mặc
định `BUY`). Không đổi tên trạng thái nào trong cơ sở dữ liệu; tên hiển thị năm bước ánh xạ ở
`settlement-steps.ts` — bảng ánh xạ ở 4.2.

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
- BE-17 phân biệt audit bằng **hành động**, không bịa thêm vai hệ thống: đường tự động ghi
  `order:auto-execute` với vai đã đặt lệnh; đường có Giao dịch viên bấm ghi `order:intervene` với vai
  phiên hiện tại. `Txn.actorRole` cũng phản ánh đúng tác nhân của từng đường.
- Chống thao tác trùng bằng **cập nhật có điều kiện ở cơ sở dữ liệu**, không bằng "đọc trạng thái rồi mới ghi". Hai lời gọi đồng thời sẽ cùng đọc thấy `CHECKING`, cùng kết luận được phép, rồi cùng gửi giao dịch — nhà đầu tư bị trừ tiền hai lần. `IOrderStore.transitionOrder` đưa điều kiện vào chính câu `UPDATE` và trả `null` khi không dòng nào khớp; người gọi **phải** dừng khi nhận `null`.
- Trong `schemas.ts`, đặt `.transform()` **trước** `.refine()` khi refine phải chuyển đổi kiểu. Zod 4 vẫn chạy các refine còn lại sau khi một check trước đó đã trượt, nên `.regex(...).refine(v => BigInt(v) > 0n)` sẽ ném `SyntaxError` **thô** với đầu vào `"1.5"`. Mà `safeParse` được gọi **ngoài** khối `try` của mọi service, nên lỗi đó không thành `Result` mã `VALIDATION` — nó nổ thẳng ra server action và production Next che thành "An error occurred". `.transform()` tạo pipe, và pipe không chạy khi vế trước đã trượt.
- Phân biệt phạm vi đọc theo **quyền**, không theo tên vai: `listOrders` hỏi `can(role, 'order:read:all')` để quyết định có được bỏ trống bộ lọc ví hay không. Vai không có quyền đó thì thiếu ví là **lỗi validate**, không phải "trả về toàn bộ sổ lệnh".
- **Hàm "xem trước" dùng `assertCan`, hàm ghi dùng `authorize`.** `authorize()` ghi một bản ghi kiểm toán cho mỗi lời gọi, nên dùng nó ở một hàm chỉ đọc mà màn hình gọi liên tục sẽ nhấn chìm sổ bằng hàng chục dòng "đã cho phép xem" — và sổ mất khả năng dùng để đối chiếu trách nhiệm. Ba hàm đang theo cách này: `previewPurchase`, `previewDistribution`, `getDistributionPeriod`. Đánh đổi đã biết: một lần xem trước **bị chặn** không để lại dấu vết; chấp nhận được vì chúng không đổi gì, đã ghi thành câu hỏi mở ở checkpoint BE-03. Với `previewDistribution` còn một lý do cứng hơn: điều kiện hoàn thành của BE-06 đòi hàm đó **không ghi gì**, kể cả một dòng audit — `test/distribution-service.test.ts` so ảnh **cả bốn bảng** trước và sau lời gọi.
- **Danh sách ví nắm giữ KHÔNG đọc được từ chuỗi.** Mọi nghiệp vụ cần một danh sách ví (chia lợi nhuận, tất toán) phải dựng từ cơ sở dữ liệu và **truyền giới hạn quét tường minh**: `listOrders`/`listPayouts` mặc định `limit = 50`, nên gọi mà không truyền giới hạn sẽ cắt danh sách ở ví thứ 51 — hệ quả không phải một trang thiếu dữ liệu mà là những nhà đầu tư **không bao giờ được chia**, không thông báo nào. Chạm ngưỡng thì **từ chối**, đừng lặng lẽ chia cho một phần người nắm giữ.

**Cách mở rộng:** mỗi nghiệp vụ mới là **một file service riêng** (`redeem.service.ts`), cùng khuôn mẫu: validate → authorize → gọi port → lưu trạng thái → audit → trả `Result`. `distribution.service.ts` (BE-06) là bản mẫu gần nhất cho một luồng nhiều bước có chia lô và chạy lại được.

## 3.5. `app/src/lib/store/` và `providers/`

**Chín cổng lưu trữ, mỗi cổng một nghiệp vụ** (IN-01 thêm cổng cache sự kiện). Hai hiện thực cho
mỗi cổng, chọn bằng cùng cờ `USE_MOCK_DB`.

| File | Cổng / vai trò | Hàm chính |
|---|---|---|
| `store/store.port.ts` | `ITxnStore` — giao dịch + audit log | `saveTxn`, `updateTxnStatus`, `listTxns`, `appendAudit`, `listAudit` |
| `store/order.store.port.ts` | `IOrderStore` — lệnh mua và bán WPT (BE-14: chiều + mốc bước; FE-06: tìm gần đúng, offset, đếm cùng bộ lọc và danh sách ví nhà đầu tư cho phân trang thật) | `createOrder`, `findOrder`, `transitionOrder`, `attachOrderTxHash`, `listOrders`, `countOrders`, `listOrderInvestors`, `summarizeCompleted`, `expireOrders` |
| `store/distribution.store.port.ts` | `IDistributionStore` — kỳ chia + hồ sơ chia. **Đã có nghiệp vụ dùng thật** từ BE-06 (`lib/bank/distribution.service.ts`, xem 4.5) | `openPeriod`, `findPeriod`, `findPeriodByKey`, `listPeriods`, `setPeriodStatus`, `createPayouts`, `markPayout`, `listPayouts` |
| `store/settlement.store.port.ts` | `ISettlementStore` — đợt tất toán + hồ sơ người nắm giữ | `openRound`, `findRound`, `listRounds`, `setRoundStatus`, `createCases`, `markCase`, `listCases` |
| `store/keeper.store.port.ts` | `IKeeperStore` — mốc chạy tiến trình hẹn giờ | `startRun`, `finishRun`, `findRun`, `listRuns` |
| `store/config.store.port.ts` | `IConfigStore` — tham số hệ thống **và** lịch sử đổi tham số (BE-04). MỘT cổng cho HAI bảng: mọi lần ghi giá PHẢI kèm một dòng lịch sử, nên tách hai cổng là mở đường gọi một mà quên cái kia | `getConfig`, `setConfig`, `listConfigHistory` |
| `store/project.store.port.ts` | `IProjectStore` — dự án đã token hoá; giữ **tổng cung** của đợt phát hành (BE-04) | `createProject`, `findProject`, `markIssued`, `listProjects` |
| `store/token-request.store.port.ts` | `ITokenRequestStore` — yêu cầu Mint/Burn (BE-12). Năm trạng thái `PENDING → EXECUTING → COMPLETED \| FAILED`, `PENDING → REJECTED`; bảng `TOKEN_REQUEST_TRANSITIONS` chặn chuyển ngược chiều ở **cả hai bản** trước khi chạm dữ liệu. Tự ghi `decidedAt` / `completedAt`. FE-27 thêm chain vào `countRequests`; memory và Postgres cùng lọc tại store, không list rồi lọc ở giao diện | `createRequest`, `findRequest`, `transitionRequest`, `attachRequestTxHash`, `listRequests`, `countRequests` |
| `store/configured-seed-data.ts` | OP-04: nguồn dự án cho memory/Postgres, thêm Sepolia khi bật cờ server; địa chỉ qua shared, mặc định chỉ mock/Hardhat | `configuredProjectSeeds()` |
| `store/seed-data.ts` | **MỘT nguồn dữ liệu khởi tạo cho CẢ HAI bản lưu trữ** (BE-04). FE-27 sinh dòng giá cho mọi phần tử `CHAIN_ORDER`, không gõ lại danh sách chain; tổng cung/ngưỡng/chỉ tiêu token vẫn nhập từ `lib/config/issue-terms.ts` | `SEED_CONFIG_ROWS`, `SEED_PROJECTS`, `SEED_PROJECT_CHAINS`, `SEED_ROLE_ROWS` |
| `store/order.store.port.ts` (FE-05) | Cột `PurchaseOrder.permit` (JSONB, null với lệnh mock và lệnh cũ). Khuôn JSON cố định: địa chỉ và `r`/`s` hex chữ thường, ba số là chuỗi thập phân, `v` là số; kiểm lại bằng schema `strict` khi đọc, dòng hỏng coi như không có chữ ký và ghi lỗi không kèm nội dung | `encodeOrderPermit`, `decodeOrderPermit`, `OrderPermit` |
| `store/config-values.ts` | Đọc tham số đã cấu hình, **lùi về mặc định trong mã** khi bảng trống. FE-27 đổi giá thành `readIssuePriceVnd(chain)`; các điều khoản không theo chain vẫn dùng khoá chung. Bảng khoá đầy đủ ở 3.13 | `readIssuePriceVnd`, `readTokenTerms`, `readPriceChangeThreshold`, `readDistributionBatchSize`, `readDistributionDustWallet` |
| `store/store.errors.ts` | Lớp lỗi + phép kiểm **dùng chung cho cả hai bản** | `UniqueConstraintError`, `ForeignKeyError`, `InvalidStatusError`, `StoreUsageError`, `assertStatus`, `assertAmount`, `assertSnapshotId`, `assertBulkSize`, `assertNoDuplicateWallet`, `mapPgConstraintError`, `UNIQUE_CONSTRAINTS`, `FOREIGN_KEYS` |
| `store/memory.state.ts` | Một khoá `globalThis` cho state của MỌI bản bộ nhớ | `memoryState`, `resetMemoryStores` |
| `store/memory.{store,order,distribution,settlement,keeper,config,project,token-request}.store.ts` | Bản RAM cho demo local nhanh; không bền qua Worker isolate. Hai bản BE-04 nạp dữ liệu khởi tạo từ `seed-data.ts` | |
| `diagnostics/read-trace.ts` | OP-06: metadata trace theo request bằng AsyncLocalStorage; chỉ bước/thời gian/SQLSTATE, không log endpoint/payload | `traceRead`, `readStep` |
| `app/api/token-info/route.ts` | GET thông tin WPT, gọi service có kiểm quyền, no-store; X-Read-Id và Server-Timing | `GET` |
| `components/maker-checker/token-info-read.ts` | Fetch GET độc lập hàng chờ action, timeout/hủy lượt cũ; không gọi thao tác ghi | `fetchTokenInfo`, `TokenInfoTimeoutError`, `TOKEN_INFO_TIMEOUT_MS` |
| `store/postgres.pool.ts` | FE-05: phép kiểm "lược đồ sẵn sàng" (`schemaObjectsReady`) đếm thêm mọi cột của `ADDED_COLUMNS`; trước đó database đang chạy thiếu cột mới vẫn bị coi là sẵn sàng nên `ALTER` không chạy. OP-06: Worker dùng một `pg.Client` theo `ExecutionContext` cho các `pgQuery`; request khác và transaction dùng Client riêng. Node vẫn theo từng lời gọi. Khởi tạo nhanh chỉ kiểm catalog + seed; thiếu mới chạy transaction/DDL/seed. Chỉ cache thành công theo connection string, không cho request khác chờ Promise đang chạy. Seed chỉ cập nhật `contractAddress` khi `issuedAt IS NULL` | `pgQuery`, `pgTransaction`, `seedInitialData` |
| `store/postgres.{store,order,distribution,settlement,keeper,config,project,token-request}.store.ts` | Bản Postgres, `pg` thuần, query tham số hoá | |
| `store/chain-event.store.port.ts`, `memory.chain-event.store.ts`, `postgres.chain-event.store.ts` | IN-01: cursor/lease có owner fence; sự kiện idempotent theo scope; truy vấn lịch sử và tổng hợp ví Transfer kể cả số dư 0 | `IChainEventStore`, `createMemoryChainEventStore`, `createPostgresChainEventStore` |
| `store/index.ts` | Factory theo `USE_MOCK_DB` | `getStore`, `getOrderStore`, `getDistributionStore`, `getSettlementStore`, `getKeeperStore`, `getConfigStore`, `getProjectStore`, `getTokenRequestStore`, `resetStoreCache`, `resetMemoryStore` |
| `ledger/mock-state.store.ts` | OP-07: kiểu đủ 17 trường state, mã hoá/giải mã bigint/Map/Set/snapshot và kho RAM có rollback khi callback lỗi | `MockLedgerStateStore`, `memoryMockLedgerStateStore`, `encodeMockLedgerState`, `decodeMockLedgerState` |
| `ledger/postgres-mock-state.store.ts` | OP-07: một dòng JSONB/chain; ghi trong transaction, `SELECT ... FOR UPDATE`, tăng version; cảnh báo trên 512 KiB | `createPostgresMockLedgerStateStore` |
| `ledger/index.ts` (nhánh mock) | OP-07: cùng `USE_MOCK_DB` chọn RAM/Postgres cho ledger mock; lỗi Postgres nổi lên, không fallback. Chain thật không đổi | `getMockLedgerStateStore`, `getLedger` |
| `providers/kyc/*` | `IKycProvider` + mock (auto-approve nhưng **vẫn validate địa chỉ**) + real stub |  |

**Bảng dữ liệu và ràng buộc duy nhất** (`app/prisma/schema.prisma` là nguồn sự thật; `init.sql`
sinh ra từ nó bằng `npm run db:sql`):

| Bảng | Ràng buộc duy nhất | Chặn điều gì |
|---|---|---|
| `MockLedgerState` | `chain` (khoá chính) | hai dòng nguồn sự thật cho cùng chain mock; ghi đồng thời còn được tuần tự hoá bằng khoá dòng |
| `PurchaseOrder` | `txHash`; `(investorWallet, clientRequestId)` | một mã giao dịch gắn cho hai lệnh; hai retry cùng ví tạo hai lệnh |
| `DistributionPeriod` | `periodKey` | mở cùng một kỳ chia hai lần |
| `DistributionPayout` | `(periodId, investorWallet)` | **chia trùng** cho một nhà đầu tư trong cùng kỳ |
| `SettlementCase` | `(roundId, holderWallet)` | **chi trả hoặc đốt trùng** cho một ví trong cùng đợt |
| `KeeperRun` | `(jobName, periodKey)` | tiến trình hẹn giờ chạy trùng |
| `Project` | `(tokenSymbol, chain)` | hai dự án cùng mã token trên cùng một chuỗi |
| `TokenRequest` | `txHash` | một mã giao dịch gắn cho hai yêu cầu Mint/Burn. Chống hai lần duyệt **không** dựa vào ràng buộc này mà vào `UPDATE ... WHERE status = 'PENDING'` |
| `SettlementRound` | — | (hồ sơ từng ví mới là chỗ cần chặn) |
| `SystemConfig` | `key` là khoá chính | hai dòng cùng một tham số |
| `SystemConfigHistory` | — | (bảng chỉ ghi thêm, không có gì phải chặn trùng) |
| `ChainEvent` | `(chain, anchor, txHash, logIndex)` | ghi trùng cùng log khi retry; scope cũ không lẫn scope hiện hành |
| `IndexerCursor` | `chain` là khoá chính | hai cursor cạnh tranh trên cùng chain; lease + owner/CAS quyết định lượt được tiến |

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
| `config/build-info.ts` | Đọc `BUILD_COMMIT_SHA` / `BUILD_BRANCH` / `BUILD_TIME` khi chạy (OP-01); OP-02 thêm `config/build-env.ts` cho lúc dựng | Tách khỏi `env.ts` **có chủ đích**: `/api/version` là nơi đầu tiên người ta gọi khi nghi bản triển khai có vấn đề, nên nó phải trả lời được **kể cả lúc** `serverEnv()` đang ném lỗi. Ba biến này không có giá trị nào không hợp lệ nên không có gì để validate. Xem 2.7 |
| `config/flags.ts` | Tính cấu hình công khai ở server | Quyết định chain nào chọn được; `demoPaymentMint` và `demoTokenMint` (FE-22) tính bằng đúng hàm mà server dùng để chặn |
| `config/issue-terms.ts` | **Nguồn duy nhất của điều khoản phát hành** và của **mặc định mọi tham số hệ thống**: gồm giá/tổng cung/ngưỡng, ba chỉ tiêu token FE-24 (`WPT_REMAINING_LIFETIME_YEARS`, `WPT_ANNUAL_YIELD_PERCENT`, `WPT_TRADING_FEE_PERCENT`), nhóm phân phối, `CONFIG_KEYS`, `WPT_TOKEN_SYMBOL` | Hai điều **cố ý**, đừng "dọn" mất: (1) **không có `import` nào** — tệp lá thì không thể tạo vòng phụ thuộc, mà `mock.adapter.ts` đọc hằng số này ở phạm vi module nên một vòng sẽ cho ra giá `undefined`/`0` và biến khớp lệnh thành "mua không mất tiền"; (2) **không có `server-only`** — đây là hằng số hiển thị được, chặn phía client sẽ chặn luôn `wptToVnd`. Giá trị đang có hiệu lực phải đọc qua `config-values.ts`, không dùng thẳng mặc định |
| `config/issue-price-key.ts` | FE-27 tạo khoá vật lý `wpt.issue_price_vnd.<chain>` từ khoá logic và `ChainKey` | Dùng khoá ghép để không đổi schema/cổng cấu hình; lịch sử cấu hình tách tự nhiên theo chain. Mọi người đọc/ghi phải gọi helper, không tự nối chuỗi ở nhiều nơi |
| `config/config-context.tsx` | Truyền cấu hình xuống client | Client không tự đọc env |
| `chains/registry.ts` | Map ChainKey → cấu hình viem, tự `defineChain` | Không import `viem/chains` để tránh phình bundle |
| `chains/chain-store.ts` | Zustand giữ chain đang chọn | Không persist, mặc định `null` chống hydration mismatch |
| `chains/use-selected-chain.ts` | Chain đang dùng = lựa chọn người dùng, chưa chọn thì lấy mặc định server | Lựa chọn không còn dùng được thì **lặng lẽ** lùi về mặc định — chỗ gọi phải tự kiểm `selectable` trước khi bày nút đổi chain |

**Cờ tính năng trong `env.ts`:**

| Cờ | Mặc định | Ý nghĩa |
|---|:--:|---|
| `USE_MOCK_KYC`, `USE_MOCK_ORACLE`, `USE_MOCK_COREBANK` | `true` | Dùng provider mock để mint chạy ngay, không cần tích hợp thật |
| `USE_MOCK_DB` | `true` trong mã; `false` ở Worker | Chọn đồng thời cả workflow và ledger mock: `true` = cùng ở RAM, không mở DB; `false` = cùng ở Postgres qua Hyperdrive/`DATABASE_URL`, không fallback |
| `ENABLE_DEMO_PAYMENT_MINT` | **`true`** | Cho cán bộ ngân hàng tự phát hành VNDB vào ví chỉ định để demo trọn luồng. Production **bắt buộc** ghi đè `false` |
| `ENABLE_DEMO_TOKEN_MINT` (FE-22) | **`false`** | Cho phát hành WPT **trực tiếp**, không qua lập–duyệt (màn `/mint`, `POST /api/mint`, `issueInitialSupply`) — **chỉ môi trường thử**. Bật trên môi trường thật là mở lại đường đi vòng qua Kiểm soát viên |
| `ENABLE_READ_DIAGNOSTICS` (OP-06) | **`false`** | Log bước/thời gian đọc; Wrangler bật tạm true để debug, tắt sau khi đo |
| `ENABLE_SEPOLIA_DEMO_PROJECT` (OP-04) | **`false`** | Đăng ký WPT DRAFT trên `evm` đã deploy, không mint. Cùng dữ liệu cho memory/Postgres |
| `DEMO_ACTOR` (BE-12) | trống | Mã tài khoản giả lập ghi vào người lập / người duyệt. Trống = mã mẫu của vai (`SAMPLE_ACCOUNTS` ở `lib/session/channel.ts`). **Không phải xác thực** — AU-01 thay |

**Cấu hình Indexer (IN-01):**

| Biến | Mặc định | Ý nghĩa |
|---|:--:|---|
| `INDEXER_CONFIRMATIONS` | `12` | Số block cuối chỉ đọc live, chưa ghi cache để tránh reorg nông |
| `INDEXER_SEGMENT_BLOCKS` | `50000` | Cỡ tối đa một đoạn đồng bộ và gia hạn lease |
| `INDEXER_MAX_BLOCKS_PER_SYNC` | `200000` | Số block tối đa một lượt đọc được phép đẩy cursor |
| `INDEXER_LEASE_SECONDS` | `60` | Thời hạn lease; một đoạn phải xong dưới một nửa mốc này |

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

⚠️ **`ENABLE_DEMO_PAYMENT_MINT` mặc định bật chỉ vì codebase hiện là bản PoC demo.** Bật trên môi
trường thật là cho phép cán bộ ngân hàng tự phát hành tiền, không đối soát nào bắt được; production
phải ghi đè `false`. Cờ này **không có** biến thể `NEXT_PUBLIC_`: nó phải do người triển khai đặt ở
server, không để lộ ra bundle browser như một thứ bật được từ phía client. Nó là **lớp chặn thứ
hai** bên cạnh quyền `demo:mint-payment`; đọc cờ ở đúng một chỗ là `lib/rbac/demo-payment.ts` (xem
3.3), đừng đọc rải rác. Từ BE-16 cờ này mở màn **Nạp VNDB** (`/demo-payment`) và mục menu của nó,
xem 3.19.

Trạng thái kết nối ví ở client là chuyện khác, xem **3.9**.

## 3.7. `packages/shared/` — một nguồn sự thật

| File | Nội dung |
|---|---|
| `src/types.ts` | `ChainKey`, `ChainFamily`, `TxStatus`, `ContractName`… **Không import gì nặng** (bị kéo vào bundle edge) |
| `src/chains.ts` | Danh sách chain theo thứ tự `mock` (mặc định), `hardhat-local`, `evm`, `stellar`. Kèm `explorerTxUrl()` và `explorerAddressUrl()` — **trả `null`** khi chain không có explorer (`hardhat-local`, `mock`) để UI ẩn liên kết chứ không trỏ sang explorer chain khác |
| `src/abi/` | ABI tối giản cho web: bốn hợp đồng cũ, ba hợp đồng ERC-3643, vault và matcher khớp lệnh |
| `generated/` | ABI đầy đủ sinh từ Hardhat — chỉ để test đối chiếu, không ship lên web |
| `src/addresses.ts` | Tra địa chỉ contract: **env thắng file**, hỗ trợ free-tier không đọc được filesystem |
| `src/sample-wallets.json` | Ví của hai tài khoản khách hàng mẫu `NDT001`, `NB001` (OP-03). App đọc qua `SAMPLE_WALLETS`, `contracts-evm/scripts/seed-local.js` đọc thẳng tệp để whitelist trên chuỗi cục bộ — **một nguồn**, không chép địa chỉ lần hai |

⚠️ **Tuyệt đối không copy ABI hay địa chỉ contract ra ngoài package này.**

**ABI tối giản phải có cả mục `error`, không chỉ `function` và `event`.** OZ v5 revert bằng
custom error; ABI thiếu mục `error` thì viem không giải mã được và chỉ trả về 4 byte
selector, ra message kiểu `reverted with the following signature: 0xe2517d3f` — vô nghĩa
với cả người dùng lẫn người sửa lỗi.

`app/test/abi-contract-sync.test.ts` đối chiếu **cả 9** ABI tối giản với `generated/`, nên
sửa contract mà quên sửa ABI thì test đỏ ngay, không đợi lỗi "function not found" lúc chạy.

## 3.8. `packages/contracts-evm/contracts/`

| Contract | Vai trò | Hàm chính |
|---|---|---|
| `tokens/ProjectToken.sol` | Token dự án **WPT** theo bề mặt ERC-3643 PoC; giữ SC-02/snapshot/permit, cap immutable và callback cưỡng chế SC-10 | `mintInitialSupply`, `mint`, `burn(address,uint256)`, `setAddressFrozen`, `freezePartialTokens`, `forcedTransfer`, `permit`, `snapshot`, `cap` |
| `tokens/VNDToken.sol` | Token tiền tệ **VNDB**, có ERC-2612 | `mint`, `burn`, `permit` |
| `registry/IdentityRegistry.sol` | Sổ danh tính rút gọn, chưa ONCHAINID/claim | `registerIdentity`, `deleteIdentity`, `updateCountry`, `isVerified` |
| `compliance/ModularCompliance.sol` | Bộ luật giao dịch ghép module, chỉ token đã bind được gọi action | `bindToken`, `addModule`, `canTransfer`, `transferred`, `created`, `destroyed` |
| `compliance/AllowAllModule.sol` | Module mặc định chưa thêm giới hạn nghiệp vụ | `moduleCheck`, ba action sau giao dịch |
| `ProfitDistributor.sol` | Quỹ chia một chiều theo snapshot; deadline/closed từng kỳ (SC-10); sổ dự trữ, nhãn kỳ chống trùng, đóng kỳ trả về quỹ (SC-06) | `createDistributionFromPool`, `distributionIdOfPeriod`, `unallocatedBalance`, `totalReserved`, `createDistribution`, `previewClaim`, `claim`, `claimMany`, `distributeTo`, `closeDistribution` |
| `ProfitDistributorOracle.sol` | Bản nối oracle | `createDistributionFromOracle`, `previewDistributableFromOracle` |
| `Redemption.sol` | Hoàn vốn | `quote`, `redeem`, `fund`, `withdraw`, `setRate`, `setPaused` |
| `SpvPaymentVault.sol` | Ví thanh toán SPV; giữ WPT/VNDB, khoá tiền và giữ dấu chống trùng lệnh | `settleBuy`, `settleSell`, `isOrderSettled`, `withdraw`, `closePeriod`, `lockedAmount`, `withdrawable` |
| `OrderSettlement.sol` | Matcher mua/bán nguyên tử hai chân, giá on-chain và ERC-2612 permit | `buy`, `sell`, `buyWithPermit`, `sellWithPermit`, `setPrice`, `pause` |
| `oracle/EnergyOracle.sol` | Sản lượng điện → doanh thu | `submitReading`, `grossRevenueVnd`, `netRevenueVnd`, `distributableProfitVnd` |
| `extensions/ERC20Snapshotable.sol` | Chụp số dư tại thời điểm | `balanceOfAt`, `totalSupplyAt` |

**Lưu ý:** thư mục `trex/` dùng **toolchain riêng** (Solidity 0.8.17 + OZ 4) và chỉ làm nguồn đối
chiếu chữ ký. Contracts chính dùng Solidity 0.8.28 + OpenZeppelin 5.6.1, biên dịch EVM Cancun;
không trộn hai cây phụ thuộc. Besu chưa nằm trong phạm vi SC-09.

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
| `scripts/evm-local.sh` | Chuỗi hardhat cục bộ `up`/`down`/`reset` (OP-03) | Không thuộc cơ chế marker. **Không bao giờ triển khai đè**: lệch bytecode hoặc nút có giao dịch lạ thì dừng, báo `reset`. Xem `docs/EVM_LOCAL.md` |
| `packages/contracts-evm/scripts/fund-sepolia.js` | OP-04: `fund`, `estimateOperationGas`, `feeBudget`, `planFunding` cấp phí Sepolia | Đo gas trên bytecode cục bộ trong tiến trình Hardhat riêng, giá trần từ Sepolia, dự phòng 20%; chỉ bù phần thiếu, chặn ví mẫu và sai chain; `--dry-run` không cần khóa. Thêm thao tác thì bổ sung mô phỏng và kiểm thử; không dùng để ký trên chain khác |
| `packages/contracts-evm/scripts/preflight-sepolia.js` | OP-04/OP-05: `signerFunding` kiểm phí triển khai chín hợp đồng + liên kết registry/compliance/vault/matcher + whitelist + Mint/Mint/Burn | Ví triển khai phải trùng `SERVER_SIGNER_PRIVATE_KEY_EVM`; thiếu phí in lệnh cấp số dư yêu cầu. Không ghi hay ký Sepolia |
| `app/scripts/local-proxy.mjs` | OP-04: bootstrap Node fetch qua proxy môi trường | Nạp riêng bằng `start:proxy`, giữ NO_PROXY và luôn bypass loopback; không log endpoint, không vào bundle Worker |
| `scripts/smoke-test.mjs` | Kiểm khói một bản **đã triển khai** (OP-01/OP-04) | `--chain=evm` chỉ GET token qua EVM adapter, kiểm WPT decimals 0 và tổng cung hợp lệ. Không chứng minh SC-02 hay quyền ký; verify và Mint/Burn là kiểm riêng. Chạy **tay** — xem 2.7 và runbook Sepolia |

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

**6 điểm cắm · 4 điểm chặn**, nhóm theo task đang chờ.

| Task | Loại | Vị trí | Đã sẵn gì (cắm) / thiếu gì (chặn) |
|---|---|---|---|
| `AU-01` | cắm | `app/src/app/actions/session.ts:34` | setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở |
| `BE-05` | cắm | `app/src/lib/store/index.ts:241` | cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ |
| `FE-09` | cắm | `app/src/app/actions/distribution.ts:76` | đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ |
| `FE-09` | cắm | `app/src/lib/signer/wallet.signer.ts:10` | đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-05 đã dùng hàm này để ký permit (`wallet-permit.ts`); FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ |
| `FE-23` | cắm | `app/src/app/(investor)/withdraw/page.tsx:4` | đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend |
| `IN-02` | cắm | `app/src/lib/bank/distribution-trigger.service.ts:302` | đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:1200` | thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:1206` | thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:1211` | thiếu quyết định giá NAV có phải `Redemption.rate` hay không |
| `SC-04` | chặn | `app/src/lib/ledger/evm.adapter.ts:1217` | thiếu quyết định giá NAV có phải `Redemption.rate` hay không |

**Luồng nghiệp vụ đã gắn `@flow`** (sơ đồ cũng sinh từ marker, xem `docs/flows/`):

- `distribute` — 24 bước → `docs/flows/distribute.md`
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
| Cơ sở dữ liệu (`SystemConfig`) | `readIssuePriceVnd(chain)`, `getIssuePrice(chain)` | **GIÁ ĐÃ CẤU HÌNH**: màn `/config`, kiểm ngưỡng đổi giá; hiển thị cho khách hàng chỉ trên chain không có OrderSettlement (FE-07) |
| Ledger (`state().wptPriceVnd` ở mock, contract khớp lệnh ở chuỗi thật) | `quotePurchase`, `executePurchase` | **TRỪ TIỀN**; từ FE-07 cũng là giá hiển thị cho khách hàng trên chain có OrderSettlement |

Hai con số lệch nhau thì nhà đầu tư **thấy một giá và bị trừ theo giá khác**, và không phép kiểm
nào ở tầng nghiệp vụ bắt được — cả hai đều đúng so với nguồn của chúng. Đây là rủi ro chính của
BE-04, nên ba cơ chế dưới đây tồn tại chỉ để chặn nó.

**1. Thứ tự trong `setIssuePrice`: đẩy xuống ledger TRƯỚC, ghi cơ sở dữ liệu SAU.**

```
validate Zod                          lý do bắt buộc 5 tới 200 ký tự (FE-07)
  assertCanConfigure(role)            hai lớp: treasury:manage RỒI isConfig
  countInFlightOrders(chain)          còn lệnh PLACED, CHECKING, EXECUTING: REQUEST_STATE, không gửi gì (FE-07)
  kiểm ngưỡng đổi giá                 (trước khi chạm ledger)
  ledger.setPurchasePrice(giá mới)    ★ BƯỚC 1, rồi CHỜ BIÊN NHẬN theo chain (FE-07)
    FAILED hoặc chưa có biên nhận:    CSDL không đổi gì, sổ FAILURE, lỗi LEDGER
  configStore.setConfig(...)          ★ BƯỚC 2, chỉ khi CONFIRMED: giá + dòng lịch sử "lý do; tx 0x..."
    thất bại: ledger.setPurchasePrice(giá CŨ), chờ biên nhận hoàn nguyên
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

`getLedger(chain)` truyền `readInitialPrice: () => readIssuePriceVnd(chain)` vào `createMockLedger`. Đặt ở factory
chứ không trong `mock.adapter.ts` vì mock là **tầng cổng**: cho nó nhập `lib/store` là để tầng cổng
phụ thuộc tầng lưu trữ, và khi đó `createMockLedger` không dựng được trong test mà không có cơ sở dữ
liệu. Truyền **hàm** chứ không giá trị vì `getLedger` là hàm đồng bộ và đang được gọi ở hàng chục chỗ.

Mock nạp **một lần cho mỗi vòng đời state** (cờ `priceHydrated`), không đọc lại mỗi lần gọi: đọc lại
sẽ biến cơ sở dữ liệu thành nguồn giá thứ hai bên cạnh `state().wptPriceVnd`, và khi đó
`setPurchasePrice` mất tác dụng — đúng thứ mà bước 1 ở trên dựa vào.

**Lưu ý khi phát triển:**

- **`WPT_ISSUE_PRICE_VND` không còn là giá đang có hiệu lực.** Nó là giá mặc định khi bảng trống.
  Dùng nó để hiển thị là hiển thị sai ngay sau lần đổi giá đầu tiên.
- **Không đệm giá xuyên yêu cầu.** `readIssuePriceVnd(chain)` cố ý không có lớp đệm: đổi giá phải có hiệu
  lực ở yêu cầu tiếp theo.
- **Giá là dữ liệu theo chain.** `setIssuePrice` chỉ đẩy xuống ledger được chọn và ghi khoá
  `wpt.issue_price_vnd.<chain>`; không được dùng lại khoá chung cũ vì sẽ làm màn của chain khác đổi
  giá mà ledger của nó chưa đổi.
- **`vndAmount` của lệnh đã đặt KHÔNG tính lại theo giá mới.** Nhà đầu tư trả đúng giá đã thấy lúc
  bấm; ca kiểm là `test/config-service.test.ts` ca 3.
- **"Thành công" ở ledger là biên nhận CONFIRMED, không phải "đã gửi" (FE-07).** Trên EVM
  `setPurchasePrice` trả ngay sau khi gửi. Trước FE-07 hàm ghi database ngay lúc đó, nên giao dịch bị
  chuỗi từ chối vẫn để database và mọi màn nói giá mới. Chưa có biên nhận thì database không đổi;
  chuỗi xác nhận sau thì `getIssuePrice` báo lệch và Giao dịch viên đặt lại đúng giá đó (chuỗi nhận
  giá trùng, database ghi nhận). Ca kiểm: `config-service.test.ts` FE-07 ca 1, 2, 3.
- **Chặn đổi giá khi còn lệnh đang xử lý (FE-07).** Lệnh đã chốt `vndAmount` theo giá cũ; hợp đồng
  kiểm lại `vndb == wpt nhân price` lúc thực thi nên lệnh đó sẽ bị `PriceMismatch`. Kẽ hở còn lại:
  lệnh đặt đúng lúc giữa phép đếm và lúc chuỗi xác nhận giá mới sẽ revert và về `FAILED` thật (luật
  HF-05), không mất tiền.
- **Một nguồn giá cho khách hàng (FE-07, đóng L-02).** Màn khách hàng đọc `readEffectiveIssuePrice`
  (`lib/bank/issue-price.ts`): chain có OrderSettlement thì giá trên hợp đồng, chain khác thì giá đã
  cấu hình. Quy tắc chọn nguồn là MỘT hàm `settlesAtOnChainPrice`, dùng chung với `getIssuePrice`.
  Hàm đặt ở `lib/bank` chứ không cạnh `readIssuePriceVnd` vì `lib/ledger/index.ts` đã nhập
  `lib/store/config-values.ts`: đặt ở đó là vòng nhập và tầng lưu trữ phụ thuộc tầng chuỗi.
  `/trade` dùng lại chính lời đọc `quotePurchase(1n)` của ô "Giá" (truyền `Promise` vào). Trên mock
  (không có địa chỉ OrderSettlement) màn khách hàng hiện giá đã cấu hình, theo đúng quy tắc chung.
- **Màn `/config` "Giá và phát hành" (FE-07).** Một action khi mở `getPriceConfigOverviewAction`
  (`assertCan('ops:read')`, không ghi sổ), bốn khối có kết quả riêng, `canEdit` tính ở máy chủ. Vượt
  ngưỡng thì máy chủ trả `fieldErrors.confirmLargeChange`; màn mở hộp xác nhận thứ hai thay vì dò
  chữ trong câu báo.
- **Trong test, đừng gõ lại con số giá.** Đọc từ `WPT_ISSUE_PRICE_VND` rồi suy ra. Ca 5 của BE-04
  (đổi giá mặc định, toàn bộ test vẫn xanh) đã bắt được **5 chỗ** gõ cứng mà mắt thường không thấy —
  trong đó ba ca dùng một số tuyệt đối làm "thiếu tiền", và ở giá nhỏ nó thành **dư** tiền nên tình
  huống mà ca kiểm cần dựng đã bốc hơi.

## 3.13. Tham số hệ thống — bảng khoá và cách thêm khoá mới

Mười bảy **nhóm khoá logic** khai ở `CONFIG_KEYS` (`lib/config/issue-terms.ts`). Riêng giá phát hành
được FE-27 mở rộng thành một khoá vật lý cho mỗi chain bằng `issuePriceConfigKey(chain)`:

| Khoá | Kiểu | Mặc định trong mã | Nạp sẵn? | Đọc bằng |
|---|---|---|---|---|
| `wpt.issue_price_vnd.<chain>` (FE-27) | `bigint` | `WPT_ISSUE_PRICE_VND` = 100.000 | có, cho mọi `CHAIN_ORDER` | `readIssuePriceVnd(chain)` |
| `wpt.price_change_threshold` | `number` | `WPT_PRICE_CHANGE_THRESHOLD` = 2 | có | `readPriceChangeThreshold()` |
| `wpt.remaining_lifetime_years` (FE-24) | `number` | `WPT_REMAINING_LIFETIME_YEARS` = 15 | có | `readTokenTerms()` |
| `wpt.annual_yield_percent` (FE-24) | `number` | `WPT_ANNUAL_YIELD_PERCENT` = 5,8 | có | `readTokenTerms()` |
| `wpt.trading_fee_percent` (FE-24) | `number` | `WPT_TRADING_FEE_PERCENT` = 0 | có | `readTokenTerms()` |
| `distribution.batch_size` | `number` | `DISTRIBUTION_BATCH_SIZE` = 50 | có | `readDistributionBatchSize()` |
| `distribution.dust_wallet` | `string` | **không có** | **không** | `readDistributionDustWallet()` |
| `distribution.max_batches_per_run` | `number` | `DISTRIBUTION_MAX_BATCHES_PER_RUN` = 5 | **không** | `readDistributionMaxBatchesPerRun()` |
| `distribution.min_new_balance` | `bigint` | `DISTRIBUTION_MIN_NEW_BALANCE` = 1.000 | **không** | `readDistributionMinNewBalance()` |
| `distribution.stuck_after_runs` | `number` | `DISTRIBUTION_STUCK_AFTER_RUNS` = 3 | **không** | `readDistributionStuckAfterRuns()` |
| `distribution.last_settled_balance` | `bigint` | **0** | **không** | `readDistributionSettledBalance()` |
| ~~`seller.withdraw_limit_mode`, `seller.withdraw_limit_value`, `seller.withdraw_fee_vnd`~~ | | | | **Gỡ ở BE-13 QĐ-H**: không mã nào đọc; dòng cũ trong database để yên |
| `vault.default_percent_bps` (BE-13) | `number` (phần vạn 1 đến 10.000) | `VAULT_DEFAULT_PERCENT_BPS` = 2.000 | có | `readVaultDefaultPercentBps()`: chỉ điền sẵn ô tỷ lệ khi vault `UNSET` |
| `demo.payment_mint_max_vnd` (BE-16) | `bigint` | `DEMO_PAYMENT_MINT_MAX_VND` = 1.000.000.000 | có | `readDemoPaymentMintMax()` |
| `order.permit_ttl_seconds` (FE-05) | `number` (60 đến 86.400) | `ORDER_PERMIT_TTL_SECONDS` = 1.800 | **không** | `readOrderPermitWindow()` |
| `order.permit_min_remaining_seconds` (FE-05) | `number` (0 đến 3.600) | `ORDER_PERMIT_MIN_REMAINING_SECONDS` = 120 | **không** | `readOrderPermitWindow()` |

**Hai khoá permit đọc CÙNG nhau** (`readOrderPermitWindow`): thời gian còn lại tối thiểu không nhỏ hơn
thời hạn thì mọi chữ ký vừa ký đã bị từ chối, nên cặp giá trị như vậy lùi cả hai về mặc định thay vì
khoá toàn bộ luồng đặt lệnh trên chain thật.

**SC-06 QĐ-I:** khoá này **không còn dùng để quyết định** mở kỳ (căn cứ là `unallocatedProfit()` của
quỹ). Tiến trình vẫn ghi nó khi một kỳ xong trọn vẹn, chỉ để màn hình hiển thị lịch sử phần lẻ.

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

**SC-06:** phần dư không còn đường chuyển cho ví nào (quỹ một chiều); `distribution.dust_wallet` chỉ
còn được hiển thị. Phần dư ở lại dự trữ của kỳ và về quỹ chưa phân bổ khi đóng kỳ.

**`distribution.dust_wallet` cố ý không có mặc định và không nạp sẵn.** Mọi địa chỉ đặt sẵn đều là ví
thật của một ai đó, nên một mặc định là lệnh chuyển tiền tới ví mà không ai chọn. Chưa cấu hình thì
phần dư nằm yên trong ví lợi nhuận — trạng thái duy nhất không cần ai quyết. Hàm đọc trả về **nguyên
văn** chuỗi trong bảng, không chuẩn hoá: chuẩn hoá địa chỉ là việc của biên `lib/ledger/address.ts`, và
làm ở đây sẽ hỏng với địa chỉ Stellar (base32 **chữ hoa**).

**Nợ kỹ thuật: màn tham số hệ thống.** Từ FE-07 chỉ giá phát hành có màn sửa (`/config`). Các khoá
còn lại ở bảng trên (lợi tức, tuổi thọ, phí, tham số chia, trần nạp trình diễn) vẫn sửa bằng script
hoặc SQL; màn cho chúng là task riêng, phải giữ quy tắc "mọi tham số cấu hình có lịch sử".

## 3.14. Tiến trình tự động chia lợi nhuận (BE-07)

`lib/bank/distribution-trigger.service.ts` + `app/api/keeper/distribution/route.ts`.
Bản đồ luồng ở **4.5**; mục này nói **cơ chế** và **cạm bẫy**.

> **FE-08 QĐ-E thay vai của keeper: KHÔNG BAO GIỜ mở kỳ.** Mỗi vòng: dọn (phục hồi kỳ `OPENING`, so số
> đã duyệt, thử lại phần vault của kỳ được phép); quỹ hụt thì dừng; rồi `decideCycle`: kỳ hoạt động
> `APPROVED` thì một lượt chia qua `runApprovedPeriod` với `triggerSource = KEEPER`; kỳ chưa duyệt,
> `AMOUNT_CHANGED`, hoặc không có kỳ mà phần chưa phân bổ tới ngưỡng thì `AWAITING_APPROVAL`; kỳ còn
> `OPENING` thì `OPENING_PENDING`; vault chưa xong thì `VAULT_PENDING`/`VAULT_CONFLICT`. Mở kỳ chỉ
> bằng lần duyệt của Kiểm soát viên (3.27). Các đoạn dưới nói "mở kỳ" là cơ chế trước FE-08.

> **SC-06 QĐ-I thay căn cứ quyết định.** Mỗi vòng: (1) dọn, phục hồi kỳ `OPENING` và thử lại phần
> vault (`reconcileChainPeriods`); (2) quỹ hụt so với tổng dự trữ thì dừng với
> `INSUFFICIENT_PROFIT_POOL`; (3) còn kỳ `OPENING`/`OPEN`/`DISTRIBUTING` thì chia tiếp kỳ đó, không
> thì mở kỳ khi `unallocatedProfit() >= distribution.min_new_balance`. Kỳ `EXPIRED`/`CLOSED` không
> chặn kỳ mới (`outcome` `PERIOD_ENDED`). Mã kỳ tự sinh `<chain>:auto-<ngày>-<số>`. Hai mục "mốc số
> dư" bên dưới mô tả cơ chế cũ, nay chỉ còn ý nghĩa hiển thị; phản ví dụ vì sao mốc sai ở
> `docs/sc-06-chia-loi-nhuan/requirements.md` mục review 1.

### Hai ràng buộc kỹ thuật quyết định toàn bộ thiết kế

**1. Hợp đồng trên chuỗi không tự chạy được.** Nhận token ERC-20 chỉ cập nhật bảng số dư, nó không
kích hoạt được mã trong hợp đồng nhận. Và cho dù SPV gọi một hàm nạp tiền tường minh, việc chuyển
tiền cho hàng trăm ví **không nằm được trong cùng một giao dịch** vì vượt giới hạn tài nguyên. Vì vậy
vẫn phải có một tiến trình **ngoài chuỗi** phát hiện và kích hoạt. "Tự động" nghĩa là **không cần
người bấm**, không phải hợp đồng tự chạy.

**2. Chưa có Indexer.** Phát hiện tiền vào làm bằng cách **hỏi định kỳ** số dư ví lợi nhuận rồi so
với mốc đã xử lý. Nợ kỹ thuật đã ghi ở 1.6.C; điểm cắm `@pending IN-02` nằm ngay trên `decideCycle`.

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
| 2 | Đọc số dư ví lợi nhuận + mốc đã xử lý, quyết định (`decideCycle`, trước FE-08 là `detectNewFunds`) | **chưa** |
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
2. **Đổi nguồn tín hiệu sang sự kiện on-chain** → chỉ sửa `decideCycle`, giữ nguyên bốn nhánh
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
| `lib/nav/pending-work.ts` | `pendingWorkCounts()` — số ban đầu cho SSR ở chain mặc định; FE-27 sidebar tải lại bằng `getPendingWork(chain)` khi selector đổi; `server-only` |
| `components/layout/nav-config.ts` | `NAV_BY_ROLE` — 4 menu, mỗi menu là **danh sách nhóm** |
| `components/pages/placeholder.tsx` | `PlaceholderPage` — khuôn trang chỗ trống, hiện còn dùng ở 2 trang: `/distribution` (FE-08) và `/withdraw` (FE-23). FE-24 đã thay `/account` |
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
thì mất màn đang chạy. FE-22 quyết định cho `/mint` (xem 3.17): **chuyển** thành màn KYC + phát hành
dữ liệu thử, phát hành chính thức trỏ sang `/draft`. Ba màn còn lại ngoài phạm vi FE-22, giữ nguyên.
Có phép kiểm chốt **cả hai chiều**: mã còn, và menu không có.

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Thêm vai thứ năm | `ROLES` → `ROLE_PERMISSIONS` → `CONFIG_ROLES` → `CHANNELS` + `CHANNEL_ROLE` + `CHANNEL_HOME` → `NAV_BY_ROLE`. Bốn bảng đầu là `Record` đủ khoá nên quên chỗ nào là **lỗi biên dịch** |
| Thêm khu vực | `AREAS` + `AREA_GATES` + `AREA_LABELS`, rồi một route-group cùng tên trong `AREA_DIR` của `four-roles-routes.test.ts`. Cổng phải là quyền mà đúng tập vai đó có |
| Nối số việc chờ thật | Thay thân `pendingWorkCounts()`. Hàm đã `async` sẵn nên không phải sửa `AppLayout` |
| Thêm mục mang số việc chờ | Thêm khoá vào `PendingWorkKey`; `PendingWorkCounts` là `Record` đủ khoá nên quên nguồn số là lỗi biên dịch |
| Thay một trang chỗ trống | Sửa đúng `page.tsx` đó và **xoá marker** `@pending` trên khai báo |


## 3.16. Kênh Người bán (FE-21)

Ba màn trong khu vực `(seller)`, cổng `seller:read`. Hai màn đầu **chỉ đọc**; màn thứ ba ghi qua
nghiệp vụ rút thật của BE-13 (quyền `vault:withdraw`, xem 3.26).

| Màn | Tệp giao diện | Nguồn số |
|---|---|---|
| `/seller` Tổng quan (6 khối) | `components/pages/seller-overview.tsx` | `getSellerOverview()` |
| `/seller/transactions` | `components/pages/seller-transactions.tsx` | `listSellerTransactions()` — lọc mã lệnh/ví, loại, trạng thái, khoảng ngày; phân trang |
| `/seller/withdraw` | `components/pages/seller-withdraw.tsx` | số dư, phần khoá, phần được rút, ví nhận: `getSellerOverview()` (vault trên chuỗi); tạo lệnh, đối soát khi mở màn, bảng yêu cầu: `withdraw.service` (BE-13) |

**"Dữ liệu của mình" là ví SPV.** Mọi lệnh mua WPT đều khớp với ví thanh toán SPV, nên sổ lệnh của
Người bán là sổ lệnh của chuỗi đang chọn. Vai `SELLER` không có `order:read:all` và không cần: hai hàm
của `seller.service` kiểm `seller:read`, vai khác gọi thẳng server action nhận `FORBIDDEN`.

**Màn hình không cộng trừ số liệu nào** (yêu cầu 16). Năm chỉ tiêu nguồn cung đi qua
`readSupplyMetrics()`; phần khoá và phần được rút đọc thẳng từ vault (`lockedAmount`, `withdrawable`
do hợp đồng tính; mock dùng cùng hàm thuần `vault-lock.ts`). Riêng "số tiền nhận được" và "vượt phần
được rút" ở màn rút tính lúc gõ bằng `quoteWithdraw()`.

**BE-13 QĐ-H gỡ hạn mức và phí kiểu FE-21.** Không còn `computeWithdrawLimit`, phí trong
`quoteWithdraw`, hay nguồn `source: 'config'`; chain không có vault thì không rút được. Màn hiện "Phí
ngân hàng ngoài chuỗi: chưa áp dụng (POC)".

⚠️ **Lọc và phân trang làm trong bộ nhớ** trên tối đa 500 lệnh mới nhất (`ORDER_SCAN_LIMIT`, có
chú thích `ponytail:`). Sổ lệnh vượt mức đó thì cần thêm offset và bộ lọc ngày vào `IOrderStore`.
"Trong ngày" và lọc theo ngày tính theo giờ Việt Nam, không theo UTC.

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Thêm loại giao dịch | `SELLER_TXN_TYPES`, `SELLER_TXN_STATUSES` và một nhánh của union `SellerTxnRow` trong `listSellerTransactions()`; BE-13 đã thêm `WITHDRAW` |

## 3.17. Màn Lập lệnh và Phê duyệt lệnh (FE-22)

Giao diện của lập–duyệt BE-12. **Giao diện chỉ gọi, không tự tính**: thông tin token, khối kiểm tra,
số liệu, nhật ký và lý do khoá nút đều do `token-request.service` trả.

| Tệp | Vai trò |
|---|---|
| `components/pages/draft.tsx` | Màn **Lập lệnh** (`/draft`): hai thẻ số liệu, thẻ tạo / huỷ token (cùng một khuôn `RequestForm`), bảng "yêu cầu đã lập" |
| `components/pages/approvals.tsx` | Màn **Phê duyệt lệnh** (`/approvals`): ba thẻ số liệu, hai hàng chờ có ô tìm kiếm + lọc trạng thái |
| `components/pages/approval-detail.tsx` | Màn **chi tiết** (`/approvals/[id]`): khối hành động, thông tin token, nội dung yêu cầu, nhật ký |
| `components/maker-checker/token-info-block.tsx` | Khối thông tin token — dùng ở cả ba màn |
| `components/maker-checker/request-check-block.tsx` | Khối kiểm tra trước khi lập — hiện từng điều kiện đúng như `previewTokenRequest` trả |
| `components/maker-checker/gates.ts` | **Logic thuần** quyết định nút nào khoá và vì sao: `submitBlockReason()`, `burnSourceEffect()`, `rejectBlockReason()`, `decisionBlockReason()`, `STATUS_LABELS` (đủ năm trạng thái), `describeInvalid()` |
| `components/maker-checker/{request-table,status-badge,stat-card}.tsx` | Bảng yêu cầu, nhãn trạng thái, thẻ số liệu |
| `lib/format.ts` | `formatAmount()` (phân cách hàng nghìn, nhận **chuỗi** để không mất chính xác quá 2^53), `formatDateTime()` (`dd/mm/yyyy hh:mm:ss`, **ghim giờ Việt Nam**) |

**Lưu ý khi phát triển:**

- **Đừng tự tính điều kiện ở giao diện.** `gates.ts` chỉ đọc kết quả máy chủ trả. Khối kiểm tra và lần
  lập thật dùng chung một phép kiểm ở `evaluate()`; tính lại ở client là có hai nơi trả lời cùng một
  câu, và chúng lệch nhau ở lần đổi đầu tiên.
- **Nút khoá cho tới khi máy chủ trả lời.** Trạng thái `idle` / `loading` của khối kiểm tra cũng khoá
  nút gửi. Kết quả mang **khoá tình huống** (chuỗi JSON của nội dung gửi kèm `revision`), nên kết quả
  của nội dung cũ không mở được nút cho nội dung mới — cùng bài học "state thông báo mang khoá".
- **FE-27: khoá tình huống và mọi phép đọc đều có chain.** Hai hàng chờ, thống kê và số cạnh menu
  lọc ở store; component chỉ kết xuất state có chain khớp selector. Chi tiết mở bằng URL của chain
  khác chỉ để báo sai phạm vi, không mở nút duyệt/từ chối.
- **Số cạnh menu làm mới bằng `router.refresh()`** sau mỗi lần gửi / duyệt: số đó do `AppLayout`
  (Server Component) dựng. `refresh()` giữ nguyên state phía client.
- **Thời gian ghim `Asia/Ho_Chi_Minh`.** Trang dựng ở máy chủ UTC rồi hydrate ở trình duyệt giờ Việt
  Nam sẽ ra hai chuỗi khác nhau cho cùng một mốc. "Hôm nay" của thẻ số liệu cũng tính theo giờ Việt
  Nam (`startOfVietnamDay`, hằng `VIETNAM_UTC_OFFSET_MS` — Việt Nam không có giờ mùa hè).
- **Mã người bán** trong khối thông tin token lấy `SAMPLE_ACCOUNTS.seller`: bảng dự án chưa có cột
  người bán (PoC một người bán). Có cột thật thì đổi ở `readTokenInfo()`, không đổi giao diện.
- **Màn `/mint` cũ được CHUYỂN, không gỡ.** Phần KYC + whitelist không có chỗ nào khác thay; phần phát
  hành trực tiếp cho nhà đầu tư là thứ lập–duyệt **không** làm được (lập–duyệt chỉ phát hành vào ví
  SPV), nên nó thành đường dữ liệu thử sau hai lớp chặn, kèm liên kết sang `/draft`.

**Cách mở rộng:**

| Muốn | Đụng vào đâu |
|---|---|
| Thêm một điều kiện vào khối kiểm tra | Chỉ `evaluate()` trong `token-request.service.ts` — khối kiểm tra tự hiện dòng mới |
| Thêm loại yêu cầu thứ ba | `TOKEN_REQUEST_TYPES` → schema → `evaluate()` → `TYPE_TEXT` trong `draft.tsx` |
| Thêm trạng thái | `TOKEN_REQUEST_STATUSES` → `STATUS_LABELS` và `VARIANTS` (cả hai là `Record` đủ khoá nên quên là lỗi biên dịch) → `timelineOf()` |
| Đổi khi nào khoá nút | `gates.ts` + ca kiểm ở `test/maker-checker-ui.test.ts` |

## 3.18. Màn Giao dịch token và Quản lý lệnh của Nhà đầu tư (FE-25)

Ba màn trong khu vực `(investor)`, cổng `portfolio:read`. **Giao diện chỉ gọi, không tự tính**: trần
số lượng, năm điều kiện, tổng giá trị, năm bước quyết toán đều do máy chủ trả.

| Tệp | Vai trò |
|---|---|
| `components/pages/investor-trade.tsx` | **Giao dịch token** (`/trade`): ô chọn token, hai thẻ Mua/Bán, ô số lượng kèm dòng nhắc trần, giá chỉ để xem, tổng giá trị dự kiến, khối năm điều kiện, tóm tắt lệnh, thông tin token, hộp thoại đối chiếu lần cuối, theo dõi lệnh vừa gửi |
| `components/pages/investor-orders.tsx` | **Quản lý lệnh** (`/orders`): bộ lọc mã lệnh, chiều, trạng thái, khoảng ngày (lọc ở máy chủ); bảng tám cột sắp xếp được |
| `components/pages/investor-order-detail.tsx` | **Chi tiết lệnh** (`/orders/[id]`): lấy dữ liệu trong phạm vi ví rồi dùng `OrderDetailContent` chung với FE-06 |
| `components/trading/order-detail-content.tsx` | Nội dung chi tiết dùng chung: thông tin, tiến trình năm bước, bốn bút toán và nhật ký kiểm toán |
| `components/trading/settlement-progress.tsx` | Vẽ `steps` + `settlement` của BE-14, nêu rõ quyết toán là một bước, bốn bút toán |
| `components/trading/trade-check-block.tsx` | Vẽ năm điều kiện đúng như `previewTrade` trả |
| `components/trading/gates.ts` | **Logic thuần**: `quantityBlockReason()` (so số gõ với `caps` máy chủ trả), `confirmBlockReason()`, `orderQueryOf()`, `sortOrders()`, `unitPriceOf()`, `isSettled()` (đọc `settlement.outcome`), nhãn đủ bảy trạng thái |
| `lib/bank/trade.service.ts` + `app/actions/trade.ts` | Ba phép đọc phía máy chủ, xem 3.4 |

**Lưu ý khi phát triển:**

- **Trần số lượng tính ở máy chủ** (`quantityCaps` trong `trade.service.ts`): mua không vượt
  `số dư VNDB / giá` (làm tròn xuống) và số chưa phân phối; bán không vượt số đang giữ. Giá là
  `quotePurchase(1)`, đúng nguồn chốt số VNDB khi đặt lệnh.
- **FE-24: "Định danh" và "Rủi ro" đọc hồ sơ của đúng tài khoản.** Ví phải trùng hồ sơ của mã người
  dùng + vai trong phiên, hồ sơ KYC phải `APPROVED`, AML phải `CLEARED` và hạng rủi ro không được
  `HIGH`. Sau đó điều kiện rủi ro mới dùng tiếp kết quả `runOrderChecks` của BE-14 để giữ các chặn
  số dư, uỷ quyền, tồn kho và thanh khoản.
- **Kết quả kiểm tra mang khoá** (chiều + số lượng + chuỗi + ví): phản hồi của lần gõ trước về muộn
  không mở được nút cho số lượng mới. Lời gọi kiểm tra hoãn 400 ms (`PREVIEW_DEBOUNCE_MS`).
- **Nhật ký kiểm toán của lệnh lọc theo chuỗi chi tiết** trong 500 dòng mới nhất vì `AuditLog` chưa
  có cột mã lệnh (chú thích `ponytail:` ở `trade.service.ts`).
- **Chain thật cần ví đã kết nối** (`useAccount`). Riêng chain `mock`, route server đọc ví từ hồ sơ
  của chính phiên rồi truyền xuống bốn màn (`trade`, `orders`, chi tiết lệnh và token; OP-02 v3 bổ sung hai màn chi tiết); vì mock không ký giao dịch nên bản demo mặc định không
  cần extension. Tầng nghiệp vụ vẫn đối chiếu địa chỉ đó với hồ sơ NDT001 và lọc lệnh theo ví —
  client không được tự gửi một ví mẫu bất kỳ để vượt phạm vi tài khoản.

**Cách mở rộng:**

| Muốn | Đụng vào đâu |
|---|---|
| Đổi ba chỉ tiêu token | Sửa cấu hình qua `CONFIG_KEYS`; cả `/trade`, `/seller` và `/tokens/[symbol]` đều đọc `readTokenTerms()`, không khai lại ở component |
| Thêm điều kiện thứ sáu | `TRADE_CONDITION_KEYS` + `previewTrade()`; khối kiểm tra tự hiện dòng mới |
| Nhiều token trên một chuỗi | `getTradeContext()` hiện lấy dự án đầu tiên vì sổ lệnh và cổng chuỗi mới có một token; cần `tokenSymbol` ở lệnh và ở `ILedgerPort` trước |

---

## 3.19. Nạp VNDB mô phỏng cho bản trình diễn (BE-16)

Giao dịch viên phát hành VNDB vào ví nhà đầu tư hoặc ví người bán, để luồng mua có tiền mà chạy. Chọn
chức năng có kiểm soát thay vì nạp sẵn số dư trong dữ liệu khởi tạo: số dư nạp sẵn lệch ngay khi
chuyển sang mạng thử (số dư thật nằm trên chuỗi), còn chức năng này tắt được bằng một cờ.

| Tệp | Vai trò |
|---|---|
| `lib/bank/demo-payment.service.ts` | `mintDemoPayment()`: hai lớp chặn → trần cấu hình → ví đích hợp lệ → `ledger.mintPayment` → `Txn` + sổ kiểm toán. `demoPaymentContext()`: trần, ví người bán, gợi ý nhanh, lịch sử (chỉ đọc, không ghi sổ) |
| `app/actions/demo-payment.ts` | Hai server action vỏ mỏng |
| `app/(ops)/demo-payment/page.tsx` | Trang; chặn bằng `canMintDemoPayment(role)` — cờ tắt hoặc không phải Giao dịch viên thì vào bằng đường dẫn chỉ thấy thông báo chặn |
| `components/pages/demo-payment.tsx` | Màn: cảnh báo chỉ dùng cho bản trình diễn, ô ví đích (gợi ý ví người bán và ví đã nạp), ô số tiền, gợi ý nhanh (500 triệu cho nhà đầu tư mẫu), bảng lịch sử |
| `components/layout/nav-config.ts` | `DEMO_PAYMENT_NAV_ITEM` + `withDemoPayment(nav, show)`; `AppLayout` truyền `show = canMintDemoPayment(role)` |

**Lưu ý khi phát triển:**

- **Hai lớp chặn là bắt buộc**, cờ `ENABLE_DEMO_PAYMENT_MINT` trước (chỉ biến môi trường, không có
  bản trong cơ sở dữ liệu — người đổi được cấu hình cũng không tự bật được), quyền `demo:mint-payment`
  sau (chỉ `TELLER`). Menu, trang và service đều hỏi **cùng một hàm** của `rbac/demo-payment.ts`; đừng
  viết lại `flag && can(...)` ở chỗ nào.
- **Trần một lần nạp** (`demo.payment_mint_max_vnd`) chặn gõ nhầm số không, KHÔNG phải công tắc. Giá
  trị lạ hoặc 0 lùi về mặc định chứ không bỏ trần.
- **"Danh sách nhà đầu tư" = ví đã KYC/whitelist trên chuỗi**; ngoại lệ duy nhất là ví người bán
  (`spvWallet()`). Bảng `Investor` trong lược đồ chưa có lời gọi nào đọc nên không dùng làm nguồn.
- **Lịch sử lọc thao tác `payment-mint` trong 200 giao dịch mới nhất** (`ponytail:` ở service) vì
  `listTxns` chưa có bộ lọc thao tác. Màn đối soát `/reconciliation` hiện vẫn là dữ liệu mẫu tĩnh nên
  chưa hiện giao dịch nạp; bảng lịch sử giao dịch chung ở `/mint` thì có.
- **Mock cộng kèm mức ủy quyền** khi nạp (Owner chốt, xem 3.1). Trên chuỗi thật nhà đầu tư tự approve.

**Cách mở rộng:**

| Muốn | Đụng vào đâu |
|---|---|
| Lịch sử đầy đủ | Thêm `operation?` vào `ITxnStore.listTxns` (hai bản lưu trữ), bỏ lọc trong `demoPaymentContext()` |
| Đổi mức gợi ý nhanh | `DEMO_PAYMENT_QUICK_AMOUNTS` ở `lib/config/issue-terms.ts`; mức vượt trần tự bị lọc |
| Tắt hẳn trên môi trường thật | Không làm gì: cờ mặc định tắt. Đừng gỡ lớp cờ để "đơn giản hoá" |

---

## 3.20. Màn Giao dịch của hai vai vận hành (FE-06)

Một màn `/transactions` dùng chung cho GDV và KSV, theo quyền chứ không so tên vai. Header/sidebar
giữ nguyên khung FE-20; phần nội dung theo IV.3.3/IV.4.3: tiêu đề, bộ lọc một hàng khi đủ rộng, bảng
toàn hệ thống và phân trang. Từ BE-17, GDV chỉ có nút **Can thiệp** ở `CHECKING`, hoặc nút **Đối
soát biên nhận** ở `EXECUTING` có mã giao dịch. `EXECUTING` thiếu mã chỉ hiện cảnh báo đối soát tay,
không có nút gửi lại; KSV có thông báo chỉ xem và không kết xuất cột hành động.

| Tệp | Vai trò |
|---|---|
| `components/pages/ops-transactions.tsx` | Bộ lọc mã/ví/chiều/trạng thái/khoảng ngày, bảng, phân trang, số liệu nguồn cung và hành động khớp; sau khớp tải lại cả bảng lẫn nguồn cung |
| `lib/bank/ops-transactions.service.ts` + `app/actions/ops.ts` | Guard `ops:read`; lọc, đếm, phân trang; chọn bước hiện tại từ `steps`; cấp cờ hành động từ quyền; chi tiết dùng lại hợp đồng dữ liệu FE-25 |
| `components/pages/ops-order-detail.tsx` + `components/trading/order-detail-content.tsx` | Route `/transactions/[id]` có guard khu vực riêng nhưng dùng chung toàn bộ phần trình bày chi tiết với `/orders/[id]` |
| `store/{memory,postgres}.order.store.ts` | Hai bản cùng hỗ trợ tìm gần đúng, `offset`, `countOrders` và `listOrderInvestors`; tổng số và dòng hiện tại không lệch bộ lọc |

**Lưu ý khi phát triển:**

- Giao diện **không suy bước từ `status`**. `toOrderView()` tạo đủ năm bước; service chọn bước hiện tại
  từ chính mảng đó và trả `currentStep`.
- Cổng khu vực chưa đủ cho server action: service kiểm lại `ops:read`, `order:read`,
  `order:read:all`. Vì Người bán có `order:read:all`, thiếu `ops:read` sẽ làm lộ màn vận hành qua POST.
- Phân trang nằm ở store (`COUNT`, `LIMIT`, `OFFSET`), không lấy một mảng có trần rồi cắt ở component.
- Hai màn chi tiết dùng chung **phần trình bày**, không dùng chung guard: nhà đầu tư vẫn bị lọc theo ví,
  hai vai vận hành phải qua `ops:read`.
- `canExecute` chỉ đúng cho nhánh có thể thao tác an toàn. Không suy nó trực tiếp từ quyền
  `order:execute`: quyền là điều kiện cần, `intervention` mới mô tả việc được phép làm ở trạng thái hiện tại.

## 3.21. Màn Thông tin tài khoản và hồ sơ rủi ro (FE-24)

Route `/account` nằm trong khu vực dùng chung cả bốn vai, nhưng chỉ đọc hồ sơ khớp **đồng thời** mã
người dùng và vai của phiên. Không có mã hồ sơ trong URL hay input từ client, nên sửa payload không
thể yêu cầu hồ sơ vai khác.

| Tệp | Vai trò |
|---|---|
| `lib/bank/account-profile.service.ts` | Kiểu hồ sơ phân biệt `CUSTOMER`/`EMPLOYEE`, dữ liệu mẫu bốn tài khoản, phép đọc hồ sơ chính phiên và tra hồ sơ nhà đầu tư theo ví cho pre-trade |
| `components/pages/account-info.tsx` | Bố cục chỉ đọc. Nhà đầu tư/Người bán có thông tin liên hệ, tài khoản, KYC/rủi ro/AML/hạn mức và ví; GDV/KSV chỉ có thông tin cán bộ, không kết xuất trường đầu tư hay ví |
| `app/(account)/account/page.tsx` | Server Component gọi `getOwnAccountProfile()` rồi truyền đúng một view-model xuống phần trình bày |
| `test/account-{profile,info}.test.ts` | Chốt phạm vi dữ liệu, trường theo vai, không có điều khiển sửa |
| `e2e/account-info.spec.ts` | Mở `/account` bằng đủ bốn vai và kiểm nội dung thật trong trình duyệt |

Ba chỉ tiêu token là cấu hình ở 3.13. `readTokenTerms()` là nguồn chung cho `trade.service`,
`seller.service` và route chi tiết token; component chỉ định dạng. Mỗi khoá hỏng lùi về mặc định của
chính nó, tránh một lỗi cấu hình phí làm tuổi thọ và lợi tức cũng mất theo.

**Lưu ý khi phát triển:**

- Hồ sơ hiện là dữ liệu mẫu server-only của PoC. AU-01 thay nguồn trong `getOwnAccountProfile()` và
  hai hàm tra cứu; không chuyển cả bảng hồ sơ sang client và không thêm `actorId` do client gửi.
- Hai địa chỉ ví trong nguồn mẫu là định danh demo của Nhà đầu tư/SPV, không phải địa chỉ contract.
  AU-01 thay bằng dữ liệu lưu trữ; không đưa chúng vào registry contract chỉ để né cảnh báo chuỗi EVM.
- Định danh ở pre-trade cần **cả** hồ sơ `APPROVED` và whitelist trên ledger. Hai trạng thái trả lời
  hai câu khác nhau; bỏ một trong hai sẽ cho phép hồ sơ/chuỗi lệch nhau mà nút vẫn mở.
- Hạn mức ngày hiện chỉ được hiển thị. Chưa có nghiệp vụ cộng doanh số theo ngày, nên FE-24 không
  tự diễn giải hạn mức thành hạn mức mỗi lệnh.
- Từ OP-05: ví của hồ sơ tra **theo chain** (ví liên kết, hoặc ví mẫu chỉ trên `mock`/`hardhat-local`);
  khối "Ví liên kết" là thành phần riêng gắn ở `app/(account)/account/page.tsx`, phần chỉ đọc giữ
  nguyên. Xem 3.28 (nợ kỹ thuật).

**Cách mở rộng:** AU-01 thêm kho người dùng thật → ánh xạ bản ghi về `AccountProfileView` → giữ
`getOwnAccountProfile()` không tham số. Muốn chỉnh hồ sơ phải là luồng riêng có quyền và audit;
không thêm nút sửa vào màn này.

## 3.22. Phạm vi chain của giao diện và dữ liệu (FE-27)

Bổ sung sau review: ca từ chối yêu cầu sai chain kiểm `REQUEST_CHECK` và bản ghi vẫn `PENDING`.
Runbook Neon cấp lại `GRANT ALL` cho role ứng dụng và `GRANT USAGE` cho PUBLIC sau tạo schema;
không đổi chủ schema vì Neon có thể báo `must be able to SET ROLE`.
Ghi nhận không chặn merge: menu bên trái phát sinh thêm lượt đếm việc chờ khi chuyển trang;
chấp nhận trên gói Paid hiện tại, chỉ tối ưu khi số đo cho thấy chậm. Chưa thay đổi cơ chế đếm.

FE-27 rà toàn bộ `components/pages/` và các khối dữ liệu dùng chung; bảng theo từng màn nằm ở
`docs/CHECKPOINT_FE27.md` mục 2. Quy tắc chung cho dữ liệu bất đồng bộ đã có nguồn chain:

1. Chain là input bắt buộc từ component qua action/service/store; không tải mọi chain rồi lọc ở client.
2. Khoá tải chứa chain. Khi selector đổi, state của chain trước không được kết xuất trong lúc chờ.
3. Effect huỷ lượt cũ bằng `AbortController` hoặc cờ huỷ; callback mutation/interval cũng phải kiểm
   khoá còn hoạt động trước khi refresh.
4. URL chi tiết mang mã bản ghi không thay thế phạm vi chain: service so chain người dùng chọn với
   chain của bản ghi trước mọi thao tác ghi.

Màn tĩnh ghi rõ là dữ liệu minh hoạ/chưa nối nguồn không được biến thành service giả chỉ để có chain.
Khi task sau nối nguồn thật, nó phải áp cùng khuôn trên. Dữ liệu hồ sơ người dùng không thuộc chain;
không thêm chain vào hồ sơ chỉ để đồng nhất hình thức.

Giá phát hành là ngoại lệ cấu hình có phạm vi chain. `CONFIG_KEYS.issuePriceVnd` là tiền tố logic;
`issuePriceConfigKey(chain)` tạo khoá vật lý. Cách này giữ nguyên schema `SystemConfig`, lịch sử vẫn
tách được theo khoá, và tránh đổi giao diện store chỉ vì một nhóm cấu hình có scope khác.

## 3.23. Vault thanh toán SPV (SC-07)

`SpvPaymentVault` là ví SPV duy nhất của bộ hợp đồng mới: Mint đầu phải vào vault; không duy trì
song song phương án ví thường. Vault giữ WPT chưa bán và VNDB thu về. Từ SC-03, `deploy.js` cấp
`MATCHER_ROLE` duy nhất cho `OrderSettlement`; EOA không giữ vai này. Matcher kéo chân vào thẳng
vault rồi gọi chân ra qua `settleBuy`/`settleSell` trong cùng giao dịch.

### Công thức khoá

Với `B` là số dư VNDB hiện tại:

| Chế độ | Phần khoá |
|---|---|
| `UNSET` | `B`: mặc định an toàn, quên cấu hình thì khoá toàn bộ |
| `FIXED` | `fixedLockAmount`; có thể lớn hơn `B`, khi đó số rút được là 0 |
| `PERCENT`, trước kỳ đầu | `floor(netProceeds × percentRateBps / 10000)` |
| `PERCENT`, sau kỳ đầu | `percentLocked = floor(distributedPrev × percentRateBps / 10000)` được lưu khi `closePeriod` |

`withdrawable = max(B - lockedAmount, 0)`. Phép nhân/chia dùng `Math.mulDiv`, làm tròn xuống. Đây
**không phải** PERCENT của FE-21: FE-21 nhân tỷ lệ với số dư tại lúc rút, làm tròn lên và chặn phần
khoá bằng số dư. Vì khác ngữ nghĩa, Tổng quan Người bán dùng kiểu phân biệt `source: 'config' |
'on-chain'`; khi có vault, mọi số dư/phần khoá lấy thẳng on-chain và ví thanh toán luôn là địa chỉ
vault, kể cả trước Mint đầu. Nếu `ProjectToken.spvWallet()` đã có mà khác vault, màn hình cảnh báo.

### Vai và biên tin cậy

| Vai | Quyền |
|---|---|
| `DEFAULT_ADMIN_ROLE` | cấp/thu vai, đặt `payoutWallet` |
| `MATCHER_ROLE` | quyết toán mua/bán; là biên tin cậy đặc quyền |
| `CONFIG_ROLE` | chọn chế độ, đặt số/tỷ lệ khoá, chốt kỳ |
| `WITHDRAWER_ROLE` | rút phần VNDB được phép tới đúng `payoutWallet` |
| `PAUSER_ROLE` | tạm dừng/mở lại rút; không chặn quyết toán |

Các giả định phải giữ khi mở rộng: khoá ngân hàng có thể chạm tài sản qua vai agent/burner; admin
có thể cấp `MATCHER_ROLE`; vault tin `distributedPrev` do hệ thống ngoài chuỗi đẩy lên; matcher tự
chịu trách nhiệm chứng minh chân tiền/token vào. Trong PoC một khoá máy chủ giữ cả admin và
withdrawer. `payoutWallet` chỉ ngăn nhập nhầm đích, **không** bảo vệ khi khoá đó bị lộ: kẻ giữ khoá
có thể đổi ví nhận rồi rút. Giai đoạn sau phải tách khoá hoặc thêm đổi ví hai bước có thời gian chờ.

### Ứng dụng và lịch sử

Ở SC-07, `ILedgerVault` chỉ đọc trạng thái và sự kiện `PeriodClosed`. EVM bắt đầu quét từ `deployBlock`
trong address book; thiếu mốc thì báo rõ thay cho quét từ block 0. Stellar trả `null` và mảng rỗng.
Màn `/vault` dành cho TELLER/CONTROLLER (`vault:read`). **Từ BE-13** (3.26): cổng có thêm cấu hình,
rút và lịch sử cấu hình; mock có vault mô phỏng; Kiểm soát viên cấu hình trên `/vault`; `vault-admin.js`
(mặc định dry-run, `VAULT_ADMIN_CONFIRM=yes` để gửi) chỉ còn cho trường hợp khẩn cấp.

Giao diện công khai dành cho SC-03 được khóa ở bản spec 2.1: `projectToken()`, `paymentToken()`,
`isOrderSettled(bytes32)`, `MATCHER_ROLE()`, lỗi `OrderAlreadySettled(bytes32)` và sự kiện
`OrderSettled`; `orderRef` phải là tham số indexed đầu tiên. ABI tối giản và kiểm thử đối chiếu artifact
giữ đúng tập chữ ký/chỉ mục này.

### Điểm khôi phục phương án ví thường (K4)

Trạng thái cuối trước SC-07 là commit `3342c2e`. Tag `poc-spv-vi-thuong-20261019` đã được xác minh
trên `origin` và trỏ đúng commit đó. Tag là điểm xem/chạy lại phương án cũ, không phải nhánh phát triển
song song; code mới chỉ đi tiếp với vault. Khôi phục bằng `git checkout 3342c2e` (hoặc tag trên) và
dùng đúng bộ địa chỉ `evm` của commit đó:

| Hợp đồng | Địa chỉ Sepolia tại điểm khôi phục |
|---|---|
| ProjectToken | `0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62` |
| VNDToken | `0xd52930A54AA2F907716AD3E670eA563D4bfE80E0` |
| ProfitDistributor | `0x38a71383D50FEa0AB7CA5b952a0E63622b1657eD` |
| Redemption | `0xb8B9a2192D704A630BA694565aC474ADBd536d49` |
| IdentityRegistry | `0xA1Fb6C6831a4C1A66D6CE0090D2790Cd37a4b950` |
| ModularCompliance | `0x678Eb0FA68a497Fb84517E70CE8AD68050ADB8A7` |
| AllowAllModule | `0x3E50dd65753aB9FEE77468F31A90C943F41137C8` |

Bằng chứng của bộ này: Mint đầu `0xaa529aa41b03174d3b494eec254fb0876a7f44b1657253d18eef08e3f62f6f20`,
Burn `0x6b68b7571b93a37a738b99e9966e6cebb2b2bc0b1ee4edfaee96143f025257d8`, Mint bổ sung
`0x246804b1bc59a9d263b73a25b4f82ed1443d880c990a5c4d0f0ae2be0980f6aa` (Supervisor đọc trực tiếp
trên Sepolia ngày 19/10/2026; chi tiết block/receipt ở Phụ lục A của `CHECKPOINT_SC09.md`). Chain
`mock` vẫn dùng ví SPV thường vì BE-13 chưa mô phỏng vault.

## 3.24. Quỹ chia lợi nhuận một chiều và luồng chia trên EVM (SC-06, gộp SC-05)

Spec `docs/sc-06-chia-loi-nhuan/` bản 2.1; quyết định QĐ-27 đến QĐ-31 và QĐ-13 cập nhật ở DS-01 bản 5.

### Hợp đồng: sổ dự trữ và kỳ tạo từ quỹ

| Khái niệm | Định nghĩa |
|---|---|
| `totalReserved` | tổng `amount - claimed` của các kỳ **chưa đóng**; tạo kỳ cộng `amount`, `_claim` trừ số vừa trả, đóng kỳ trừ phần còn lại |
| `unallocatedBalance()` | `max(số dư VNDB - totalReserved, 0)`: căn cứ duy nhất để tạo kỳ mới |
| `createDistributionFromPool(period)` | `DISTRIBUTOR_ROLE`; nhãn khác rỗng, **chưa từng dùng** (`EmptyPeriod`, `DuplicatePeriod`), `amount = unallocatedBalance() > 0` (`NothingToDistribute`), không kéo tiền từ người gọi |
| `distributionIdOfPeriod(period)` | tra ngược kỳ theo nhãn, kể cả khi ứng dụng mất biên nhận |
| `closeDistribution(id)` | `DEFAULT_ADMIN_ROLE`, chỉ sau `claimDeadline`; **không chuyển tiền**, phần chưa trả về quỹ chưa phân bổ; `claimed` giữ nghĩa "đã trả" |
| `createDistribution(amount, period)` | giữ cho `ProfitDistributorOracle` và bộ cũ; cũng cộng dự trữ, không ghi bảng chống trùng |

Sau SC-06 chỉ `_claim` chuyển VNDB ra khỏi hợp đồng (ca 6 kiểm mọi `Transfer` ra khỏi quỹ đều đi kèm
`Claimed`). Bất biến: `totalReserved == tổng(amount - claimed)` của kỳ chưa đóng và `totalReserved <=
số dư`. **Giả định tin cậy:** `VNDToken.BURNER_ROLE` đốt được VNDB trong quỹ; khi đó số dư có thể dưới
dự trữ và ứng dụng dừng ở bước phát hiện quỹ hụt. Người không nhận kịp trong hạn mất phần kỳ đó (CH-1).

### Ứng dụng: mở kỳ có giữ chỗ và phục hồi (QĐ-F)

`openPeriod`: đọc trước (mã trùng, phần chưa phân bổ, tổng cung) sang **giữ chỗ** `OPENING` (ràng buộc
duy nhất `periodKey`) sang `openDistribution` sang lưu `openTxHash` **trước khi chờ** sang chờ biên nhận sang
`findDistribution(periodKey)`. Có kỳ thì `completeOpening` (cập nhật có điều kiện `OPENING -> OPEN`)
với số **đọc từ chuỗi**. Không có và chuỗi chắc chắn từ chối (`LedgerError.reverted`, hoặc biên nhận
`FAILED`) thì **xoá** bản giữ chỗ (chọn xoá thay vì thêm trạng thái lỗi: mã kỳ dùng lại được, sổ kiểm
toán đã ghi lần thất bại). Không có và chưa xác định thì **giữ** `OPENING`. `recoverOpeningPeriod` và
đầu mỗi vòng BE-07 tra theo nhãn; chưa có thì gửi lại (hợp đồng chặn trùng nhãn nên không thể ra kỳ
thứ hai). Mã kỳ mới bắt buộc tiền tố chain (`mock:2026-Q1`, CH-6); kỳ cũ không tiền tố vẫn đọc được.

### Đẩy số đã chia vào vault đúng một lần (QĐ-G, QĐ-13 cập nhật)

Ngay sau khi kỳ `OPEN` trên chain có vault: giữ chỗ `vaultPeriodRef = lastPeriodRef + 1` bằng cập
nhật có điều kiện (chỉ khi mọi kỳ đã nối chuỗi mở trước nó trên cùng chain đã `DONE`), đối soát
`PeriodClosed` của đúng mã đã lưu trước mọi lần gửi, giành quyền gửi bằng chuyển trạng thái có điều
kiện trên cặp (trạng thái, mã giao dịch). `PeriodClosed` có mà khác số, hoặc vault đã qua mã đó, là
`CONFLICT`: dừng, không gửi thêm, cần xử lý tay. Số đẩy vào là **tiền đã dành cho kỳ** (`totalAmount`,
gồm phần SPV), không phải tiền đã tới tay người nhận. Lỗi ở bước này không huỷ kỳ chia; BE-07 thử lại.
**Runbook:** `vault-admin.js close-period` không dùng khi luồng tự động đang chạy. Giới hạn còn lại:
kỳ `SENT` chưa có mã giao dịch (tiến trình chết giữa lúc giành quyền và lúc lưu mã) có thể bị hai
tiến trình cùng gửi lại; hợp đồng chặn lần thứ hai bằng `InvalidPeriodRef`.

### Chia, đối soát "đã trả" và vòng đời (QĐ-H)

`distributePeriod` đọc kỳ trên chuỗi (`distributionId`, hoặc `snapshotId` với kỳ mock cũ đã chuyển
đổi), từ chối kỳ thuộc **địa chỉ hợp đồng khác** hoặc lệch ảnh chụp. Người nhận = lệnh mua hoàn tất +
hồ sơ kỳ trước + **ví SPV** (`spvWallet()`, trên EVM là vault, CH-3). Trước mỗi lượt và trước khi ghi
`FAILED`, hồ sơ có tiền chưa `PAID` (kể cả `FAILED`) được tra `isDistributionPaid`; đã nhận thì chốt
`PAID` "đối soát từ chuỗi". Hồ sơ phần 0 ghi `PAID` không gọi chuỗi. Kỳ đã đóng trên chuỗi thành
`CLOSED`, quá hạn (theo **đồng hồ chuỗi**) thành `EXPIRED`; hồ sơ chưa trả thành `EXPIRED`, không gửi
lô, không bao giờ ghi `PAID`. Đóng kỳ bằng `distribution-admin.js` (mặc định dry-run, cần
`DISTRIBUTION_ADMIN_CONFIRM=yes`); không tự động đóng ở SC-06.

**Giới hạn danh sách người nhận:** ví nhận WPT bằng chuyển trực tiếp mà chưa từng mua hay nhận chia
có thể bị bỏ sót; phần của ví đó ở lại dự trữ tới khi kỳ đóng rồi về quỹ. Indexer (IN-01) đóng giới
hạn này.

### Mock và lưu trữ

Mock ngang hàng hợp đồng (sổ dự trữ, nhãn chống trùng, hạn nhận 180 ngày theo giờ hệ thống, đóng kỳ,
`hasClaimed`); trước SC-06 mock tính trùng phần kỳ trước còn nợ. Trạng thái mock lưu trước SC-06 được
**chuyển đổi chính xác** khi đọc: mỗi ảnh chụp có `distributable > 0` thành kỳ `distributionId =
snapshotId`, `claimed` tính lại từ tập đã trả, bộ đếm kỳ mới từ `max(snapshotId) + 1`; thiếu dữ liệu
thì `MockLedgerMigrationError` yêu cầu reset có kiểm soát theo runbook OP-07, không đoán.
`DistributionPeriod` thêm `distributorAddress`, `distributionId`, `openTxHash`, `vaultPeriodRef`,
`vaultCloseStatus`, `vaultCloseTxHash` (`init.sql` và `ADDED_COLUMNS` cho cơ sở dữ liệu đang chạy);
trạng thái kỳ thêm `OPENING`, `EXPIRED`, `CLOSED`, hồ sơ thêm `EXPIRED`.

### Triển khai

`ProfitDistributor` đổi bytecode, thứ tự triển khai không đổi nên địa chỉ hardhat-local không đổi; khoá
`evm` không đổi tới OP-05. `verify-deployment.js` kiểm `totalReserved() == 0` và đọc được
`unallocatedBalance()`.

---

# PHẦN 4. BẢN ĐỒ LUỒNG

## 3.25. Chữ ký permit khi đặt lệnh trên chain thật (FE-05)

Spec `docs/fe-05-ky-permit/` bản 2. Áp cho chain EVM thật (`hardhat-local`, `evm`; `isPermitChain`).
Mock không đổi; stellar chưa có cơ chế tương đương.

### Luồng ký hai bước (QĐ-A)

1. **Chuẩn bị:** màn `/trade` gọi `preparePermitAction` khi mở hộp xác nhận. Máy chủ
   (`preparePermit`) kiểm `order:place`, đòi `OrderSettlement` có trong address book, tính `value`
   (mua: `quotePurchase`, bán: `wptAmount`), đọc `nonces(ví)` trên token, đặt `deadline` = timestamp
   block mới nhất cộng `order.permit_ttl_seconds`, dựng typed data. `token` và `spender` KHÔNG nhận từ
   trình duyệt.
2. **Ký:** ví nhà đầu tư ký `eth_signTypedData_v4` qua `signPermitWithWallet` (LUẬT #2). Không gửi
   giao dịch, không tốn phí. Từ chối ký (4001) thì quay lại hộp xác nhận, không gửi gì.
3. **Đặt lệnh:** `placeOrderAction` kèm `permit: { value, deadline, nonce, signature }`.

Domain đọc qua `readPermitDomain`: chỉ nhận `fields = 0x0f`, `salt` bằng 0, `extensions` rỗng,
`chainId` bằng cấu hình chain, `verifyingContract` bằng địa chỉ token trong address book. Lệch điều
nào là lỗi cấu hình, không dựng typed data. Không dùng `ProjectToken.version()` (phiên bản nghiệp vụ).

### Kiểm chữ ký phía máy chủ (QĐ-D, đúng thứ tự)

| Bước | Việc | Trượt thì |
|---|---|---|
| 1 | Schema chặt của `permit` (ba số thập phân, chữ ký 65 byte); chain thật thiếu `permit` | `VALIDATION`, không tạo lệnh |
| 2 | Tính LẠI số của lệnh, so `permit.value` | "giá đã đổi hoặc số lệnh đã đổi..., ký lại" |
| 3 | Dựng lại typed data (domain từ chuỗi, `owner` là ví đặt lệnh, `nonce`/`deadline` từ payload), `verifyTypedData` | "chữ ký không khớp ví hoặc nội dung lệnh, ký lại" |
| 4 | Tra `clientRequestId` (BE-17): có rồi thì trả lệnh đó | không |
| 5 | `deadline` còn ít nhất `order.permit_min_remaining_seconds` so với block mới nhất | "chữ ký sắp hết hạn, ký lại" |
| 6 | Phân loại nonce (bảng dưới) | theo bảng |
| 7 | `runOrderChecks` với nguồn ủy quyền "chữ ký đã kiểm" | mã của phép trượt |
| 8 | Tạo lệnh, lưu `permit`, tự quyết toán (BE-17) | |

| Nonce đã ký so với nonce hiện tại | Ủy quyền hiện tại | Kết quả |
|---|---|---|
| Bằng | bất kỳ | Chữ ký chưa dùng: nhận |
| Nhỏ hơn | đủ số lệnh | Đã bị gửi trước (hoặc ủy quyền có sẵn): nhận |
| Nhỏ hơn | thiếu | "chữ ký đã được dùng, ký lại" |
| Lớn hơn | bất kỳ | "chữ ký không hợp lệ" |

### Nguồn ủy quyền của bộ kiểm (QĐ-F, QĐ-G)

`runOrderChecks` nhận `allowanceSource` do MÁY CHỦ suy ra; schema xem trước và đặt lệnh là schema
`strict` nên client gửi kèm trường lạ thì cả yêu cầu bị loại. Bốn nguồn: `actual` (mock, lệnh cũ),
`will-sign` (xem trước trên chain thật: đạt, chi tiết "sẽ cấp bằng chữ ký"), `signed` (đặt lệnh,
chữ ký đã qua bước 6), `stored` (quyết toán và phục hồi: đạt khi ủy quyền thực tế đủ **hoặc** chữ ký
đã lưu có nonce bằng nonce hiện tại và còn hạn). Chữ ký đã lưu không dùng được thì câu trượt thêm
"chữ ký ủy quyền đã hết hạn hoặc đã dùng, đặt lệnh lại để ký mới"; máy trạng thái SC-03 không đổi.

### Hệ quả nonce (QĐ-H)

`permit` **ghi đè** mức ủy quyền (không cộng thêm) và nonce dùng theo thứ tự. BE-17 quyết toán ngay
sau khi đặt nên thường không có hai chữ ký chồng nhau. Hai tab cùng ký nonce N khi ủy quyền bằng 0:
tuần tự thì lệnh 2 bị từ chối "ký lại" và không có bản ghi; đồng thời thì lệnh khớp trước tiêu chữ
ký, lệnh sau trượt ở bước kiểm trước khi gửi hoặc bị hợp đồng từ chối, kết thúc kèm thông báo ký
lại. Tiền và token chỉ chuyển một lần (đo ở ca 7 trên nút thật). Không có hàng đợi nonce ở FE-05.
Hệ quả phụ: ví đã `approve` sẵn mức lớn thì sau một lệnh có chữ ký, ủy quyền về đúng phần còn lại
của số đã ký (thường là 0), không còn mức `approve` cũ.

### Chữ ký là quyền chi nhạy cảm, chưa phải xác thực ví

- Chữ ký lưu ở cột `PurchaseOrder.permit` để phục hồi dùng lại trong thời hạn. Nó **không** vào
  `OrderView`, phản hồi API, dữ liệu gửi xuống client, sổ kiểm toán hay log (ca 10 kiểm chuỗi chữ
  ký, `r`, `s` không xuất hiện).
- Chữ ký là bằng chứng chủ ví **đồng ý cho chi đúng số đó**, KHÔNG phải xác thực ví thuộc phiên đăng
  nhập. Ràng buộc ví với phiên là việc của AU-01; trước đó `investorWallet` vẫn do người gọi gửi.
  Chữ ký cũng không xác nhận giá, chiều hay `orderRef` (biên tin cậy ở 4.2).

### Giao diện (QĐ-I) và kiểm thử đầu cuối (QĐ-J)

Hộp xác nhận nêu "Bạn sẽ ký cho phép hệ thống chi đúng <số> <VNDB|WPT> cho lệnh này, hiệu lực đến
<giờ>; không tốn phí giao dịch". Nút "Ký và đặt lệnh" qua ba trạng thái: đang chuẩn bị, đang chờ ký
trong ví, đang gửi lệnh. Ví sai mạng dùng `WrongChainBanner`, nút khoá theo `useWalletStatus().canSign`.
`clientRequestId` giữ nguyên qua các lần ký lại. E2E `app/e2e/permit-order.spec.ts` (project `hardhat`)
tiêm `window.ethereum` giả lập chỉ chuyển tiếp `eth_accounts`, `eth_chainId`, `eth_signTypedData_v4`
sang nút Hardhat; nó đứng sau `mint.spec.ts` vì cần nguồn cung trong vault.

**Chain chưa có cờ tất toán** (EVM chờ SC-04): xem trước và bối cảnh màn giao dịch coi là chưa tất
toán và dựa vào trạng thái dự án, theo chốt của chủ dự án ngày 20/10/2026 (`settlementModeOrUnknown`
ở `trade.service.ts`; xem nợ 1.6.C).

## 3.26. Rút VNDB từ vault và cấu hình khoá vault (BE-13)

Spec `docs/be-13-rut-vault/` bản 2.1. Không sửa `SpvPaymentVault`. Ba quyền mới: `vault:configure`,
`vault:reconcile` cho `CONTROLLER`; `vault:withdraw` cho `SELLER`. Vai vận hành đọc bằng `vault:read`.

### Cấu hình khoá (QĐ-C) và lịch sử (QĐ-C1)

`saveVaultConfig` (`lib/bank/vault.service.ts`, phần thuần ở `vault-config.ts`): ba ô tỷ lệ PERCENT
(lớn hơn 0, không quá 100, tối đa hai chữ số thập phân, đổi sang phần vạn bằng xử lý CHUỖI), số khoá cố
định (để trống được), ví nhận (khác 0, khác vault, đã whitelist). Có số cố định thì đích là FIXED.
Máy chủ đọc trạng thái chuỗi rồi chỉ gửi giao dịch còn khác, đúng thứ tự:

| Từ | Đến | Thứ tự |
|---|---|---|
| `UNSET` | PERCENT | `setPercentRate`, rồi `setLockMode(PERCENT)` |
| `UNSET`, PERCENT | FIXED | `setFixedLock`, rồi `setLockMode(FIXED)` (không gửi tỷ lệ) |
| FIXED | PERCENT | `setPercentRate` nếu khác, rồi `setLockMode(PERCENT)`; **không** `setFixedLock(0)` |
| giữ chế độ | | chỉ setter của giá trị đổi |

`setPayoutWallet` đứng trước, độc lập. Giá trị luôn lên chuỗi trước khi đổi chế độ, nên chế độ hiện
hành không bao giờ mang giá trị 0. Từng giao dịch: lưu `Txn` trước khi chờ (`trackTxn`), chờ xong mới
gửi bước sau, audit giá trị cũ và mới. Lỗi giữa chừng trả `LEDGER` kèm `fieldErrors.completedSteps`,
`failedStep`, `payoutChanged`; lần lưu sau đọc lại chuỗi nên chỉ gửi phần thiếu. Sau kỳ đầu,
`setPercentRate` chỉ ghi tỷ lệ chờ: màn hiện "Tỷ lệ đang áp" và "Tỷ lệ chờ áp", kế hoạch so với tỷ lệ chờ.
Vault `UNSET` thì ô tỷ lệ điền sẵn `vault.default_percent_bps`.

**Lịch sử cấu hình** (`getVaultConfigHistory`, mục "Lịch sử cấu hình" trên `/vault`): nguồn sự thật là
bốn sự kiện `LockModeChanged`, `PercentRateSet` (cờ `pending` tách tham số "tỷ lệ chờ áp"),
`FixedLockSet`, `PayoutWalletSet` qua `vaultConfigEvents`; giá trị cũ suy từ sự kiện trước cùng tham
số; người thao tác tra `Txn` theo mã giao dịch (vai và ví ký), không thấy thì "ngoài app" (ví dụ chạy
`vault-admin.js`). Người thao tác là VAI, chưa phải tài khoản: bảng `Txn` không có cột tài khoản (AU-01).

### Khoá vận hành bền theo chain (QĐ-D)

Bảng `VaultOperationLock` (khoá chính `chain`, `kind` `CONFIG`/`WITHDRAW`, `refId`, `actor`,
`acquiredAt`). Lấy bằng MỘT câu `INSERT ... ON CONFLICT DO UPDATE ... WHERE` (chỉ tiếp quản khi cả
hai là `CONFIG` và khoá cũ lấy trước mốc `now - receiptTimeoutFor(chain)`), nhả bằng `DELETE` theo
`refId`. Khoá `WITHDRAW` không tự hết hạn: nhả khi lệnh về trạng thái cuối. Biên nhận cấu hình chưa về
(hết thời gian chờ) thì giữ khoá cho lần sau tiếp quản. Bản bộ nhớ và Postgres chạy chung một hợp đồng
kiểm thử (`be-13-vault-config.test.ts`).

### Lệnh rút (QĐ-E) và xử lý `NEEDS_REVIEW` (QĐ-F)

Bảng `WithdrawRequest`: duy nhất `(chain, clientRequestId)`, `activeChain` (một lệnh chưa kết thúc mỗi
chain; về trạng thái cuối thì đặt `NULL` trong cùng câu), `txHash`. Ánh xạ lỗi trùng ở `store.errors.ts`.

    (tạo) ──► SENDING ──► SENT ──► COMPLETED
                 │          ├────► FAILED
                 │          └────► NEEDS_REVIEW ──► COMPLETED / FAILED (Kiểm soát viên)
                 ├────► FAILED        (revert khi mô phỏng, chắc chắn chưa lên chuỗi)
                 └────► NEEDS_REVIEW  (mất mã giao dịch)

`createWithdrawRequest` (`lib/bank/withdraw.service.ts`): quyền, mã một lần đúng sáu chữ số (không
lưu, không vào audit hay lỗi), tra `clientRequestId`, lấy khoá `WITHDRAW`, kiểm vault, số tiền, ví nhận,
tạm dừng, `amount <= withdrawable` đọc trên chuỗi, tạo `SENDING` với `claimedBlock`, gửi, lưu mã (`SENT`)
TRƯỚC khi chờ. `COMPLETED` chỉ khi biên nhận thành công VÀ có `Withdrawn(to = ví nhận, amount)` của
chính vault. App **không bao giờ gửi lại**. `reconcileWithdrawRequests` (vai vận hành bấm, Người bán mở
màn): `SENDING` quá thời gian chờ luôn sang `NEEDS_REVIEW` kèm sự kiện ứng viên (từ `claimedBlock`, đúng
ví nhận, số tiền, ví ký máy chủ), không tự `COMPLETED`; idempotent. `resolveWithdrawRequest`
(`vault:reconcile`): `COMPLETED` cần mã có biên nhận và sự kiện khớp, chưa gán lệnh khác, bổ sung `Txn`
nếu chưa có; `FAILED` cần lý do; gọi lại không thêm `Txn` hay audit.

### Vault mô phỏng trên mock (QĐ-G)

Địa chỉ logic `MOCK_VAULT_ADDRESS` (`packages/shared/src/mock-vault.ts`, 20 byte cuối của
`keccak256("bidv-rwa-tokenize:mock:SpvPaymentVault")`), whitelist sẵn; `NB001` là ví nhận mặc định của
Người bán. `vaultAddressFor(chain)` đưa luật R6 (Mint đầu phải vào vault) sang cả mock.
`MockLedgerState.vault` giữ đủ biến của hợp đồng cùng sự kiện rút, chốt kỳ, cấu hình bền; "block" là
bộ đếm `nonce`. Dòng JSONB cũ thiếu trường đọc ra vault `UNSET`. Công thức khoá là hàm thuần dùng chung
`lib/ledger/vault-lock.ts`; bảng số `packages/contracts-evm/test/fixtures/be13-vault-lock-table.json`
chạy trên hợp đồng thật, hàm thuần và vault mock (ca 12). Mua bán qua vault mock cộng trừ
`netProceeds`; `closeVaultPeriod` chạy thật nên SC-06 QĐ-G áp cả mock.

### Màn hình (QĐ-I)

`/seller/withdraw`: server action, mạng và ví nhận chỉ đọc, khoá nút khi chưa có ví nhận, bảng "Yêu
cầu rút của tôi". `/seller/transactions`: `SellerTxnRow` là union theo `type` (`BUY`/`SELL` mang
`OrderStatus`, `WITHDRAW` mang trạng thái rút), sắp theo thời điểm tạo rồi `id`, lọc trạng thái theo
đúng tập của loại. `/vault`: "Cấu hình khoá", "Lịch sử cấu hình", "Lệnh rút cần xem xét" kèm nút đối soát.

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Thêm tham số cấu hình vault | setter ở `ILedgerVault` (ba adapter), một dòng trong `planVaultConfig` theo đúng thứ tự giá trị trước chế độ, một tham số trong `VaultConfigParam` và `vaultConfigEvents` |
| Rút "đúng một lần chứng minh được" | Cần đợt sửa hợp đồng (nợ QĐ-J ở 1.6.C); khi đó sự kiện có `requestRef`, đối soát mới được tự kết luận |

## 3.27. Kiểm soát viên duyệt rồi mới chia lợi nhuận (FE-08)

`lib/bank/distribution-approval.service.ts` (duyệt, duyệt lại, tiếp tục, API đọc),
`distribution.service.ts` (lõi `runDistributionRound`, `decideApproval`),
`distribution-trigger.service.ts` (`runApprovedPeriod`, keeper), màn `/distribution`
(`components/pages/distribution-approval.tsx`). Bản đồ luồng ở **4.5** (`docs/flows/distribute.md`, 24 bước).

**Mục tiêu:** không đồng VNDB nào rời quỹ chia khi chưa có Kiểm soát viên duyệt đúng số đó, dù gọi từ
màn hình, server action hay keeper; không trả khi kỳ vault chưa chốt xong.

### Quyền và đường gọi (QĐ-A)

`distribution:approve` chỉ `CONTROLLER`: `approveDistributionAction`, `reapproveDistributionAction`,
`continueDistributionAction`. Đọc (`reconcile:read`, hai vai vận hành): tổng quan, lịch sử kỳ, hồ sơ trả,
lịch chạy. Bốn action cũ (`openPeriodAction`, `previewDistributionAction`, `distributePeriodAction`,
`runDistributionCycleAction`) đã gỡ; service giữ cho keeper và kiểm thử. Lõi `runDistributionRound(ctx,
periodId)` nhận vai và mã người thao tác đã kiểm; mọi bản ghi duyệt lưu mã người (`currentActorId`).

### Duyệt lưu bền trên kỳ, một kỳ hoạt động mỗi chain (QĐ-B)

| Cột | Ý nghĩa |
|---|---|
| `approvalStatus` | `APPROVED`, `AMOUNT_CHANGED`; rỗng = kỳ trước FE-08 (`expectedAmount` rỗng) hoặc kỳ vừa duyệt đang chờ so số |
| `expectedAmount`, `approvedAmount`, `reapprovedFrom` | số duyệt lần đầu, số có hiệu lực, số cũ khi duyệt lại |
| `approvedBy`, `approvedAt` | người và thời điểm của lần duyệt có hiệu lực |
| `activeChain` | duy nhất; bằng `chain` khi `OPENING`/`OPEN`/`DISTRIBUTING`, `null` khi `COMPLETED`/`EXPIRED`/`CLOSED`, đặt trong CÙNG câu cập nhật trạng thái |
| `KeeperRun.triggerSource` | `MANUAL` (Kiểm soát viên) hoặc `KEEPER` |

`activeChain` là trọng tài giữa Kiểm soát viên, keeper và nhiều Worker kể cả khi hai bên sinh hai mã
kỳ khác ngày UTC; ánh xạ lỗi trùng `DistributionPeriod_activeChain_key`. Database có sẵn được nâng ở
`ensureSchema`: thêm cột (`ADDED_COLUMNS`), dựng chỉ mục, rồi điền `activeChain` cho kỳ cũ hoạt động
SỚM NHẤT mỗi chain (`BACKFILL_STATEMENTS`; điền mọi kỳ thì chỉ mục nổ với dữ liệu có hai kỳ dở).
Bản bộ nhớ kiểm cùng ràng buộc bằng tay.

### Duyệt, duyệt lại, tiếp tục (QĐ-C)

```
approveDistribution({ chain, expectedAmount })
  authorize('distribution:approve')          bốn kết cục vào sổ kiểm toán kèm mã người
  vaultStatus() rỗng                          -> "không hỗ trợ luồng chia đã duyệt"
  unallocatedProfit() != expectedAmount       -> "số trong quỹ đã đổi, xem lại rồi duyệt" (không gửi gì)
  dưới distribution.min_new_balance, tổng cung 0, danh sách người nhận bị cắt -> từ chối
  findActivePeriod / reservePeriod(activeChain, approval)  -> "đang có kỳ hoạt động"
  driveOpening('send') -> finishOpening -> decideApproval
       totalAmount == expectedAmount -> APPROVED -> runApprovedPeriod(MANUAL)
       khác                           -> AMOUNT_CHANGED, dừng (không chốt vault, không lô)
reapproveDistribution({ periodId, amount })  amount == distributions(id).amount -> APPROVED, reapprovedFrom
continueDistribution({ periodId })           OPENING thì phục hồi trước; phải APPROVED
```

Mã kỳ của lần duyệt: `<chain>:<ngày UTC>-<số thứ tự>`, bỏ qua cả nhãn đã có trên chuỗi mà sổ không
biết (sổ bộ nhớ khởi động lại trên một nút còn kỳ cũ). Kết luận duyệt ghi khi đọc được số thực tế, nên
đường phục hồi nào hoàn tất kỳ (`continueDistribution`, keeper) cũng áp đúng kết luận.

### Chốt kỳ vault phải xong trước khi trả (QĐ-D)

Hai chốt chặn nằm TRONG lõi `runDistributionRound`, không ở người gọi: kỳ phải `APPROVED`, và
`syncVaultClose` phải `DONE` (hoặc chain không vault) TRƯỚC mọi bước khác, kể cả trước khi kỳ hết hạn
rời trạng thái hoạt động. `PENDING`/`SENT`/chờ kỳ trước: dừng, `vault` trong khung nhìn cho biết; lần
sau đối soát rồi đi tiếp. `CONFLICT`: khoá chia, màn hiện "cần xử lý tay". `finishOpening` không còn đẩy
vault rồi nuốt lỗi; lỗi chốt vault nổ ra cho người gọi. Luồng bấm tay chạy `reconcileChainPeriods`
trước lượt chia để vault của kỳ trước theo kịp (PoC không có lịch gọi keeper); kỳ hoạt động chưa
duyệt không được chốt vault.

### Màn `/distribution` (QĐ-F)

Quỹ chia, dự kiến (cùng `collectRecipients` gồm vault, `shareOf` trên số dư hiện tại, có ví được 0,
danh sách bị cắt thì khoá nút), khối duyệt chỉ `CONTROLLER` với hộp xác nhận nguyên văn QĐ-F, kỳ hoạt
động (duyệt lại số thực tế, tiếp tục chia, "đã gửi lên chuỗi, đang đối soát"), lịch sử kỳ và hồ sơ trả
phân trang (liên kết explorer chỉ trên chain thật), lịch chạy kèm nguồn. Mọi số do máy chủ trả; nút
khoá khi đang chạy; tải lại trang đọc trạng thái bền.

**Một action khi mở (theo HF-01):** màn gọi đúng `getDistributionPageAction` khi mở và khi tải lại sau
duyệt, duyệt lại, tiếp tục. Service `getDistributionPage` chạy ba phần song song (tổng quan, trang 1
lịch sử, 20 lượt chạy gần nhất), mỗi phần là một `Result` riêng và tự kiểm `reconcile:read`, nên một
phần lỗi không kéo phần khác. Chỉ khi người xem đổi trang lịch sử hoặc mở hồ sơ một kỳ thì màn mới gọi
action riêng (`listDistributionPeriodsAction`, `listDistributionPayoutsAction`). Đo bằng Playwright trên
bản build: trước 3 action, sau 1 action, 0 yêu cầu `_rsc` (vai Kiểm soát viên và Giao dịch viên). Kiểm
chặn quay lại: `fe-08-approval.test.ts` "FE-08 hiệu năng".

**Nạp quỹ trên mock:** địa chỉ logic `MOCK_PROFIT_DISTRIBUTOR_ADDRESS` (`@bidv/shared`, như vault mock
của BE-13): số dư VNDB của địa chỉ này là `profitPool`. Người trình diễn và e2e nạp quỹ bằng màn có sẵn
(whitelist ở `/mint`, nạp ở `/demo-payment`) trên cả mock và hardhat (hardhat dùng `ProfitDistributor`).

### Cách mở rộng

| Muốn | Đụng vào đâu |
|---|---|
| Keeper tự mở kỳ dưới hạn mức | Vai hệ thống riêng, nhánh mới trong `decideCycle`, vẫn qua `reservePeriod` có `approval` của chính sách (nợ QĐ-H) |
| Hợp đồng nhận số tiền kỳ vọng | Đợt sửa hợp đồng; khi đó `AMOUNT_CHANGED` không còn xảy ra, giữ cột để đọc kỳ cũ |
| Duyệt nhiều cấp hoặc duyệt danh sách | Thêm bảng lần duyệt; `setApproval` vẫn là cập nhật có điều kiện cuối cùng |

## 3.28. Ví liên kết trong hồ sơ cá nhân (OP-05 QĐ-I) ⚠️ NỢ KỸ THUẬT

Chủ dự án chốt CH-2 (OP-05): người dùng đang đăng nhập tự thêm địa chỉ ví vào hồ sơ của mình, app so ví
đang kết nối với ví trong hồ sơ. Đây là cách tạm để chạy vòng nghiệp vụ trên Sepolia với ví MetaMask thật;
**cơ chế này chưa an toàn** và được ghi vào bảng nợ 1.6.C.

**Hồ sơ mẫu gồm gì, lấy từ đâu.** `SAMPLE_ACCOUNT_PROFILES` trong `lib/bank/account-profile.service.ts`
là bốn tài khoản demo viết trong mã nguồn (`NDT001` Nhà đầu tư, `NB001` Người bán, `GDV001`, `KSV001`).
Hồ sơ khách hàng có họ tên, liên hệ, trạng thái định danh (KYC), xếp hạng rủi ro, phòng chống rửa tiền
(AML), hạn mức giao dịch ngày và một ví mẫu (Hardhat #1 và #4, ở `packages/shared/src/sample-wallets.json`).
Phiên (cookie vai và `DEMO_ACTOR`) chọn hồ sơ; không có mã hồ sơ nào nhận từ trình duyệt.

**So ví thế nào.** Điều kiện "Định danh" của `previewTrade` đạt khi đủ ba ý: ví giao dịch thuộc hồ sơ của
phiên, hồ sơ `APPROVED`, ví nằm trong whitelist trên chuỗi. "Ví thuộc hồ sơ" tra theo chain bằng
`findInvestorProfileByWallet(chain, wallet)`: ví đã liên kết trên chain đó thắng; chưa liên kết thì dùng
ví mẫu, nhưng **chỉ trên `mock` và `hardhat-local`**. Trên `evm` (và `stellar`) không có ví mặc định nên
bắt buộc liên kết. Các màn Nhà đầu tư trên `mock` (không có ví trình duyệt) lấy ví qua `ownMockWallet()`,
cùng nguồn với điều kiện trên.

**Liên kết ví mới.** Trang `/account`, khối "Ví liên kết trên chain" (chỉ vai khách hàng): ô địa chỉ,
nút "Dùng ví đang kết nối", nút Lưu, gọi `linkProfileWalletAction({ chain, wallet })`. Service kiểm quyền
`wallet:connect` (chỉ Nhà đầu tư và Người bán), lấy hồ sơ từ phiên, chuẩn hoá địa chỉ, từ chối ví mẫu
công khai của Hardhat trên chain khác `mock`/`hardhat-local` (`PUBLIC_SAMPLE_WALLETS`, cùng danh sách
`fund-sepolia.js` từ chối nạp), ghi bảng `ProfileWallet` (khoá `(actorId, chain)`, duy nhất
`(chain, walletKey)` với `walletKey` là ví viết thường: một ví chỉ thuộc một hồ sơ trên một chain) và ghi
sổ kiểm toán `profile:wallet:link` cho mọi kết cục (ai, chain, ví cũ, ví mới).

| Tệp | Vai trò |
|---|---|
| `lib/store/profile-wallet.store.port.ts`, `memory.profile-wallet.store.ts`, `postgres.profile-wallet.store.ts` | Cổng lưu trữ; `link` một câu ghi trả kèm ví cũ |
| `lib/bank/account-profile.service.ts` | `getProfileWallet`, `linkProfileWallet`, `walletOfProfile`, `findInvestorProfileByWallet(chain, wallet)`, `ownMockWallet` |
| `app/actions/account.ts` | Vỏ mỏng hai action |
| `components/pages/profile-wallet-card.tsx` | Khối giao diện; một action khi mở hoặc đổi chain |
| `test/op-05-profile-wallet{,-store}.test.ts` | Ca 3 của OP-05: theo chain, chỉ hồ sơ của mình, ví mẫu, ví trùng, audit, `previewTrade` |

**Vì sao chưa an toàn (nợ):**

- **Không chứng minh quyền sở hữu ví.** Liên kết chỉ ghi chuỗi địa chỉ; ai đăng nhập được hồ sơ thì gắn
  được ví bất kỳ chưa thuộc hồ sơ khác. Không có chữ ký thông điệp nào chứng minh người dùng giữ khoá.
- **Hồ sơ không lấy từ KYC thật.** KYC, rủi ro, AML là hằng số trong mã; phiên là cookie tự đặt được.
- **Liên kết không whitelist trên chuỗi.** Whitelist vẫn là bước mặc định của ngân hàng (CH-2); ví liên
  kết mà chưa whitelist thì điều kiện "Định danh" vẫn trượt. Ngược lại, whitelist không biết hồ sơ nào.

**Hướng trả nợ (AU-01):** đăng nhập thật thay cookie; liên kết ví đòi ký thông điệp (SIWE hoặc EIP-191)
bằng chính ví đó, máy chủ kiểm chữ ký trước khi ghi; hồ sơ, KYC, rủi ro, AML đọc từ hệ thống KYC; ánh
xạ ví với hồ sơ do ngân hàng xác nhận cùng lúc whitelist. Giữ chữ ký `findInvestorProfileByWallet(chain,
wallet)` để `previewTrade` không phải đổi.

---

## 3.29. Fireblocks: quyết định cho PoC và mô hình tham chiếu

> Chép nguyên văn từ `docs/fe-07-cau-hinh-gia/design.md` mục 5 (Supervisor soạn, FE-07).

### Quyết định PoC (Sếp chốt 23/10/2026)

- Nhà đầu tư có hai lựa chọn ví: **ví ngoài** tự giữ khoá (MetaMask, như hiện tại) và **ví Fireblocks** do ngân hàng cấp (mỗi nhà đầu tư một vault account, ẩn khỏi Console). Bỏ phương án máy chủ tự sinh ví từ một khoá gốc.
- Cơ chế ký: **Vault Accounts** (lưu ký MPC trong workspace, áp TAP). Embedded Wallets (ví không lưu ký trên thiết bị người dùng) và API Co-signer tự vận hành cấp sản xuất: nợ kỹ thuật.
- PoC **không** tách vault theo lớp nóng, ấm, lạnh; ví ngân hàng dùng một vault vận hành. Mô hình dưới là tham chiếu cho sản phẩm thật.
- FE-23 chốt theo kết quả kiểm sandbox K0: ký được permit EIP-712 từ vault thì FE-23 là "chuyển ra ví ngoài" cho nhà đầu tư dùng ví Fireblocks; không ký được thì dùng `approve` cộng Gas Station, hoặc giữ FE-23 dạng đổi VNDB ra tiền tài khoản.
- Kết quả kiểm sandbox K0 (6 câu hỏi: tạo vault qua API, gọi hàm hợp đồng, ký EIP-712, TAP, có cần Co-signer, SDK trên Workers): bổ sung vào mục này khi có.

### Mô hình tham chiếu: tách vault theo mức rủi ro của vai

| Lớp | Vault | Vai trên hợp đồng | Quy tắc TAP gợi ý |
|---|---|---|---|
| Nóng (tự động) | Vận hành | OPERATOR (khớp lệnh), DISTRIBUTOR (chia lô), AGENT trên IdentityRegistry (định danh) | Tự ký trong hạn mức, chỉ tới hợp đồng của dự án |
| Ấm (cần người duyệt) | Phát hành và ngân quỹ | MINTER, AGENT trên WPT (đốt, thu hồi, cưỡng chế), CONFIG và WITHDRAWER của vault SPV, PRICE, MINTER của VNDB | 1 đến 2 người duyệt; lập duyệt đưa xuống tầng ký |
| Lạnh (hiếm dùng) | Quản trị | DEFAULT_ADMIN của cả chín hợp đồng | Nhiều người duyệt; workspace lạnh ở bản thật |
| Khách hàng | Mỗi nhà đầu tư một vault | Không có vai | Chuyển ra ngoài chỉ tới địa chỉ cho phép, có hạn mức |

- Không dùng vault gom chung (omnibus) cho WPT của nhà đầu tư: ERC-3643 định danh từng ví; snapshot chia lợi nhuận và thu hồi tính theo ví.
- Lợi ích chính so với hiện tại (một khoá giữ mọi vai): lộ vault nóng không phát hành, đốt token hay đổi vai được.
- Chuyển sang mô hình này không sửa hợp đồng: chỉ cấp vai cho địa chỉ vault mới và thu vai khỏi khoá cũ.

### Ghi chú kiến trúc: gửi giao dịch qua Fireblocks và Indexer

- Gửi qua Fireblocks là **bất đồng bộ**: tạo giao dịch, chờ TAP và ký (có thể nhiều phút), Fireblocks phát giao dịch, rồi mới có mã giao dịch Sepolia và biên nhận.
- Hai việc tách riêng:
  - **Theo dõi giao dịch do hệ thống gửi** (mã giao dịch Fireblocks, trạng thái ký, mã giao dịch chuỗi, biên nhận): thuộc tầng ký và gửi (IN-03), cập nhật bằng webhook hoặc hỏi định kỳ, dùng lại mẫu "đang thực hiện, đối soát" của HF-05.
  - **Indexer** (IN-01): đọc sự kiện chuỗi đã xảy ra, từ mọi nguồn (kể cả thao tác ngoài ứng dụng), là nguồn sự thật cho lịch sử và danh sách người nắm giữ.
- Trạng thái hiện tại (số dư, phần rút được, giá) vẫn đọc trực tiếp bằng lời gọi chỉ đọc vì rẻ và cần mới nhất.

## 3.30. Indexer gọn cho sự kiện vault và WPT (IN-01)

Indexer là cache có thể dựng lại, không phải sổ nghiệp vụ. Mỗi lời đọc lịch sử EVM đồng bộ phần
thiếu theo nhu cầu, đọc sự kiện đã xác nhận từ Postgres rồi gộp phần đuôi chưa xác nhận từ RPC.
Trạng thái hiện tại như số dư, giá, phần được rút vẫn đọc trực tiếp từ chuỗi.

| Quyết định | Hiện thực |
|---|---|
| QĐ-IN1 | Hai bảng: `ChainEvent` chứa log đã giải mã; `IndexerCursor` chứa scope, cursor và lease |
| QĐ-IN2 | Đồng bộ theo nhu cầu; chưa có cron hay dịch vụ riêng |
| QĐ-IN3 | Chỉ lưu tới `head - INDEXER_CONFIRMATIONS`; phần đuôi đọc live và bỏ sau khi dùng |
| QĐ-IN4 | Lease trên cursor, owner fence khi trả/gia hạn, CAS `lastBlock`; commit mỗi đoạn trong một transaction |
| QĐ-IN5 | Chỉ lấy log của `SpvPaymentVault` và `ProjectToken` |
| QĐ-IN6 | Năm hàm lịch sử giữ chữ ký; thêm `ILedgerRead.listTokenWallets()` |
| QĐ-IN7 | Mock giữ state trong bộ nhớ/Postgres như trước; danh sách ví đọc bảng số dư mock |
| QĐ-IN8 | Scope `(anchor, vault, token)`; anchor là hash block triển khai, nên deploy/reset node không trộn dữ liệu cũ |

| Tệp | Vai trò |
|---|---|
| `lib/indexer/event-index.ts` | Đồng bộ theo đoạn, gộp bảng + tail, tổng hợp số dư Transfer và truncation |
| `lib/store/chain-event.store.port.ts` | Cổng độc lập với viem cho cursor, lease, sự kiện và ví token |
| `lib/store/memory.chain-event.store.ts` | Bản test/mock, có đồng hồ tiêm được để kiểm lease |
| `lib/store/postgres.chain-event.store.ts` | SQL tham số hoá, insert idempotent, transaction tiến cursor có owner/CAS |
| `lib/ledger/evm.adapter.ts` | Nguồn viem: head, scope/anchor, log hai hợp đồng và timestamp block |

`listTokenWallets()` giữ mọi ví từng gửi/nhận, kể cả số dư hiện tại bằng 0. Đây là điều kiện đúng
cho chia theo snapshot: ví giữ WPT lúc chụp rồi chuyển hết trước khi lập hồ sơ vẫn phải xuất hiện để
`balanceOfAt` quyết số tiền. Danh sách sắp theo địa chỉ chữ thường và dùng sentinel để bật
`truncated` khi vượt 5.000.

**Giới hạn và vận hành:** reorg sâu hơn 12 block không được tự sửa; lần đầu có thể cần nhiều lượt
đọc để bắt kịp; danh sách ví chưa phân trang. Quy trình xoá cache đúng chain nằm ở
`docs/DEPLOYMENT.md` và chỉ chạy khi Sếp quyết. Hướng mở rộng: thêm đồng bộ theo lịch, sau đó IN-02
dùng cùng nguồn sự kiện để phát hiện tiền vào quỹ; không biến `ChainEvent` thành sổ nghiệp vụ.

## 4.1. Luồng MINT LẺ (đã hoàn thành — P1; từ FE-22 là đường dữ liệu thử)

⚠️ **FE-22: đường này nằm sau HAI LỚP CHẶN** — quyền `demo:mint-token` và cờ `ENABLE_DEMO_TOKEN_MINT`
(mặc định tắt). Cờ tắt thì bước 2 dưới đây trả `FORBIDDEN` (403) với thông báo nêu đúng cờ.

⚠️ **Đây là ĐƯỜNG DỮ LIỆU THỬ (trước FE-22 gọi là đường nền cho bản trình diễn), không phải luồng phát hành chính.** Nó mint thẳng cho
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
| 2 | `rbac/session.ts` → `rbac/demo-payment.ts` → `permissions.ts` | `authorize('demo:mint-token', …, assertCanMintDemoToken)` — cờ trước, quyền sau (FE-22) |
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

## 4.2. Luồng MUA và BÁN WPT (BE-02/BE-03/BE-14, tự khớp ở BE-17)

**Nghiệp vụ:** nhà đầu tư xem trước xem mình đủ điều kiện chưa; đặt lệnh; hệ thống tự kiểm lại và
tự quyết toán ngay. Chiều mua chuyển VNDB (nhà đầu tư → SPV) và WPT (SPV → nhà đầu tư); chiều bán
đảo hai dòng tiền. Mỗi chiều vẫn nằm trong **cùng một** giao dịch nguyên tử.

**Ai ký:** ví **ngân hàng/SPV** qua `getBankSigner(chain)` gửi giao dịch khớp, không phải ví nhà
đầu tư — khác hẳn luồng REDEEM ở 4.3. Từ FE-05, trên chain thật nhà đầu tư **ký permit** bằng ví
(không gửi giao dịch, không cần `approve` trước) và mọi lệnh mới qua cổng công khai PHẢI kèm chữ ký;
hệ thống gửi `buyWithPermit`/`sellWithPermit`. Đường `buy`/`sell` không chữ ký chỉ còn cho lệnh cũ
khi phục hồi và cho test hợp đồng. Chi tiết luồng ký ở 3.25.

### Hợp đồng khớp lệnh SC-03

`OrderSettlement` không giữ tài sản. Nó kéo chân vào thẳng tới `SpvPaymentVault`, rồi vault trả
chân ra trong cùng giao dịch. Một chân revert thì toàn bộ thay đổi hoàn lại:

| Chiều | Chân vào do `OrderSettlement` làm | Chân ra do vault làm |
|---|---|---|
| Mua | VNDB: nhà đầu tư → vault | WPT: vault → nhà đầu tư |
| Bán | WPT: nhà đầu tư → vault | VNDB: vault → nhà đầu tư |

Giá một WPT nằm ở `OrderSettlement.price`; `vndbAmount` đã chốt trong database phải đúng
`wptAmount × price` hiện tại, nếu lệch thì lệnh revert thay vì âm thầm thu theo giá mới. Mã lệnh
UUID được đổi thuận nghịch thành `bytes32 orderRef`; dấu đã quyết toán nằm trong vault. Vì vậy gửi
lại cùng lệnh báo `OrderAlreadySettled`, và việc thay matcher không làm mất lịch sử chống trùng.

`permit` phải cấp **đúng** số của lệnh. ERC-2612 ghi đè allowance, không cộng thêm, và nonce dùng
theo thứ tự; nếu hai lệnh được ký liên tiếp nhưng khớp đảo thứ tự, chữ ký nonce sau có thể chưa dùng
được. FE-05 xử lý bằng bảng phân loại nonce và thông báo ký lại (3.25, QĐ-H).

Tạm thời trước SC-04, `pause` trên `OrderSettlement` là công tắc dừng khẩn cấp và thay cho việc chặn
khớp khi đang tất toán. Quy trình thay phiên bản: pause bản cũ → vault thu `MATCHER_ROLE` bản cũ →
deploy bản mới → vault cấp duy nhất `MATCHER_ROLE` cho bản mới; nhà đầu tư approve/permit lại địa chỉ
mới. `orderRef` cũ vẫn ở vault.

Biên tin cậy của PoC: một khóa máy chủ giữ `OPERATOR_ROLE`, `PRICE_ROLE`, `PAUSER_ROLE` và admin.
Operator chọn lệnh/nhà đầu tư/số lượng; price role có thể đổi giá bất kỳ lúc nào. Permit không xác
nhận các dữ liệu nghiệp vụ đó — bảo vệ của nhà đầu tư là giới hạn allowance và giá hiện hành trên
hợp đồng. Production phải tách vai và bảo vệ khóa theo mô hình vận hành riêng.

**Hai lối vào, một điểm hội tụ:** UI dùng Server Action, demo và e2e dùng `POST /api/purchase`.
Payload đặt lệnh có `clientRequestId`; payload có `orderId` chỉ dành cho can thiệp của Giao dịch
viên. Cả hai gọi cùng service nên guard không thể bị bỏ sót — **không** có kiểm quyền ở transport.

```
(FE-25 màn /trade, /orders; FE-06 màn /transactions và /transactions/[id])
   └─ previewTradeAction(), gọi previewPurchase() ──→ app/actions/trade.ts
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
| 3 | `purchase.service :: runOrderChecks()` | **Đúng** bộ kiểm mà `executeOrder` chạy, chỉ khác là không truyền `vndAmount` đã chốt nên phép kiểm giá không chạy. FE-05: chain thật dùng nguồn ủy quyền `will-sign`, phép kiểm ủy quyền đạt kèm chi tiết "sẽ cấp bằng chữ ký" |
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
| 1 | `bank/schemas.ts` → `placeOrderSchema.safeParse` | Validate ví, `wptAmount`, UUID `clientRequestId` và `permit` (FE-05); schema chặt |
| 1a | FE-05: `verifyPlacementPermit()`, `classifyPlacementPermit()` | Chain thật: bắt buộc `permit`, tính lại số lệnh, kiểm chữ ký, hạn và nonce theo 3.25; trượt thì `VALIDATION`, không tạo bản ghi. Mock gửi `permit` thì `VALIDATION` |
| 2 | `bank/authorize.ts` → `rbac/can.ts` → `permissions.ts` | `authorize('order:place')` — quyền của **INVESTOR** |
| 3 | `getStore() :: appendAudit()` | Ghi audit ALLOWED / DENIED |
| 4 | `ledger/index.ts :: getLedger(chain)` | Chọn adapter |
| 5 | `purchase.service :: runOrderChecks()` | **BE-03.** Không đạt → **không tạo bản ghi**, ghi audit FAILURE, trả đúng mã lỗi của phép kiểm trượt |
| 6 | `ledger :: quotePurchase(wptAmount)` *(bên trong bước 5)* | **Chốt** số VNDB phải trả tại thời điểm đặt |
| 7 | `findOrderByClientRequest()` + `createOrder()` | Retry cùng nội dung trả lệnh cũ; ràng buộc `(ví, mã)` xử lý tranh chấp; khác nội dung bị từ chối |
| 8 | `autoSettleCreatedOrder()` → `settleStoredOrder()` | Chỉ nhận **bản ghi vừa tạo**, không nhận `orderId` từ client; chạy lại bộ kiểm và quyết toán |
| 9 | `bank/result.ts` | Trả `Result<OrderView>` ở trạng thái cuối; quyết toán trượt vẫn giữ lệnh và lý do |

Bước 6 là QĐ-3 của BE-02: số VNDB **không** được tính lại khi khớp. Tính lại là âm thầm thu
một số khác với số đã báo trên màn hình lúc bấm — sai về nghiệp vụ, không phải chuyện làm tròn.
Báo giá chỉ gọi **một lần**, lấy từ giá trị `runOrderChecks` trả ra: gọi `quotePurchase` thêm
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

Đường tự động **vẫn kiểm lại** toàn bộ sau khi lưu. Kiểm trước khi tạo lệnh không thay thế được:
điều kiện có thể đổi giữa hai lần đọc, và test `DEGRADATIONS` chốt đúng các tình huống đó.

### Giai đoạn 2 — lõi tự khớp và đường can thiệp

| Bước | File / hàm | Việc |
|---|---|---|
| 1 | `autoSettleCreatedOrder(order)` | Đường tự động nhận object vừa tạo; không có API nhận mã lệnh tuỳ ý |
| 2 | `settleStoredOrder()` | `PLACED → CHECKING`, chạy `runOrderChecks`, rồi chiếm `CHECKING → EXECUTING` có điều kiện |
| 3 | `sendAndSettle()` | Gửi mua/bán, gắn `txHash`, lưu `Txn`, chờ receipt; trước mọi lần ghi thất bại phải tra `orderRef` trên chain |
| 4 | `executeOrder({ orderId })` | Đường can thiệp kiểm `order:execute`; chỉ nhận `CHECKING` hoặc `EXECUTING` |
| 5 | Can thiệp `CHECKING` | Chạy lại bộ kiểm, chiếm `EXECUTING`, **được gửi** giao dịch |
| 6 | Can thiệp `EXECUTING` có `txHash` | Tra `ITxnStore.findTxnByHash`, **chỉ chờ/đối soát receipt**, không gửi lại |
| 7 | Can thiệp `EXECUTING` thiếu `txHash` | Tra `findOrderSettlement`: đã khớp thì chốt từ chain; chưa khớp thì cập nhật có điều kiện về `CHECKING`, chạy lại bộ kiểm và tranh quyền gửi |
| 8 | Audit | `order:auto-execute` phân biệt với `order:intervene` |

Hàm chốt thất bại dùng chung xử lý bốn kết quả đối soát: `NOT_SETTLED` mới được ghi
`FAILED`/`REJECTED`; `SETTLED` chuyển `COMPLETED` bằng tx hash từ sự kiện; `SETTLED_TX_UNKNOWN` và
lỗi RPC giữ nguyên trạng thái để không tuyên bố thất bại khi tài sản có thể đã chuyển. **HF-05
(L-91):** nhánh biên nhận `PENDING` và nhánh chờ biên nhận ném lỗi (cả `sendAndSettle` lẫn
`reconcileExecutingOrder`) bật cờ `receiptUnknown`; khi đó `NOT_SETTLED` cũng **không** ghi
`FAILED`: lệnh giữ `EXECUTING` kèm mã, sổ ghi FAILURE "chưa có biên nhận, chờ đối soát", trả
`LEDGER` "Giao dịch đã gửi, chưa có xác nhận..." và đi vào đường can thiệp 6. Chỉ biên nhận
`FAILED` thật (revert) mới ghi `FAILED`. Cạnh
`EXECUTING(txHash rỗng) → CHECKING` là cạnh quay lại duy nhất của máy trạng thái, có điều kiện ở kho
lưu trữ nên hai lượt can thiệp đồng thời chỉ một lượt thắng.

**Các phép kiểm ở bước 4** (QĐ-2), dừng ở lần trượt đầu tiên, tất cả đều là hàm **đọc** nên
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

**`runOrderChecks` (tên cũ `runPurchaseChecks`) nhận THAM SỐ THUẦN `{ side, investorWallet, wptAmount, quotedVndAmount? }`, không
nhận `OrderRecord`** (đổi ở BE-03). Nhận `OrderRecord` thì phải có lệnh trong cơ sở dữ liệu mới
kiểm được, tức nhà đầu tư chỉ biết mình thiếu gì **sau** khi lệnh đã bị từ chối. Tham số thuần cho
ba đường gọi — xem trước, trước khi lưu và quyết toán — dùng **đúng một** bộ kiểm.

**Phép kiểm `price` CHỈ chạy khi có `quotedVndAmount`**, tức ở lõi quyết toán tự động hoặc can thiệp.
Xem trước và lần kiểm trước khi tạo lệnh chưa có giá cũ để so, nên bỏ phép kiểm đó là đúng: so báo giá vừa lấy
với chính nó thì phép kiểm luôn đạt, tức một phép kiểm không nói gì. Khi `price` trượt thì hàm trả
về **ngay**, không chạy bốn phép còn lại — cả bốn đều so với một con số vừa được chứng minh là lạc
hậu. Đó là lý do `price` là **cổng**, không phải một phép kiểm ngang hàng.

**Một đường kiểm duy nhất là điều được test chốt lại.** `app/test/purchase-service.test.ts` có ba
ca dùng cùng dữ liệu vào cho cả xem trước và khớp lệnh, rồi so `code` **và** `reason` của hai bên.
Ai viết đường kiểm thứ hai thì ba ca đó đỏ.

**Vị trí phép chuyển `CHECKING → EXECUTING` trong `settleStoredOrder` là điểm dễ sửa sai nhất.**
Nó phải ở **sau** bộ kiểm và **trước** lời gọi gửi giao dịch:

- Sau bộ kiểm, vì mọi lệnh trượt điều kiện mà đã chiếm `EXECUTING` thì không còn đường
  về `REJECTED` — lệnh sẽ bị đánh dấu là đã tốn phí trong khi chưa gửi gì.
- Trước khi gửi, vì đó là **toàn bộ** cơ chế chống gửi hai lần. Không có bước này thì hai lời
  gọi đồng thời cùng thấy điều kiện đạt và cùng gửi, nhà đầu tư bị trừ tiền hai lần.

### Giai đoạn 3 — truy vấn và dọn lệnh treo

| Hàm | Quyền | Ghi chú |
|---|---|---|
| `listOrders()` | `order:read`; bỏ trống bộ lọc ví cần thêm `order:read:all` | Vai không có `order:read:all` mà thiếu ví → **lỗi validate**, không phải trả toàn bộ sổ lệnh |
| `orderDailyStats()` (BE-14) | `order:read:all` (SELLER, TELLER, CONTROLLER), qua `assertCan` — màn tổng quan gọi mỗi lần mở | Đếm lệnh `COMPLETED` có `completedAt` trong ngày **theo giờ Việt Nam**, hai chiều, trả đúng bốn ô `tiles` |
| `expireStaleOrders()` | `order:expire` (TELLER) | Chỉ nhắm `PLACED`. **Không** dựng lịch ở đây — việc gọi định kỳ thuộc BE-07, và cố ý **không** mở điểm vào HTTP |

⚠️ **`expireStaleOrders` có ĐÚNG MỘT đường vào: BE-07 gọi thẳng service.** Từ MC-01 Bước 6 điều
này đúng trong mã, không chỉ trên giấy: `expireStaleOrdersAction` đã bị **xóa** theo quyết định
Owner. Trước đó câu "cố ý không mở điểm vào HTTP" ở dòng trên **mâu thuẫn với mã** — server
action cũng là một điểm vào HTTP, gọi được bằng POST trực tiếp chứ không chỉ qua giao diện. Vì
vậy `lib/bank/purchase.service.ts` có **bảy** hàm (BE-14 thêm `orderDailyStats`, gọi từ `seller.service` chứ không qua server action; FE-05 thêm `preparePermit`) mà `app/actions/purchase.ts` chỉ có **năm**
action; đó là chủ đích, có ghi lý do ngay trong khối chú thích đầu tệp đó. Đừng "bổ sung cho
đủ bộ".

### Chiều bán (BE-14)

Nhà đầu tư trả WPT về ví thanh toán người bán (SPV), nhận VNDB, trong **cùng một** giao dịch. Đi
qua **đúng** ba giai đoạn trên — cùng hàm, cùng trạng thái, cùng khoá chống gửi hai lần — chỉ khác
ba chỗ:

| Chỗ | Mua | Bán |
|---|---|---|
| Phép kiểm sau `price` | `paymentBalance` → `allowance` → `supply` → `transferable` (SPV → nhà đầu tư) | `holding` → `wptAllowance` → `sellerLiquidity` (`paymentBalanceOf(spv)`) → `transferable` (nhà đầu tư → SPV) |
| Hàm gửi giao dịch | `executePurchase` | `executeSale` |
| Sổ `Txn` | `operation: 'purchase'`, `toWallet` = nhà đầu tư | `operation: 'sale'`, `fromWallet` = nhà đầu tư |

`vndAmount` của lệnh bán là số VNDB **nhận về**, chốt lúc đặt theo `quotePurchase` — nhà đầu tư
không nhập giá ở chiều nào. Thiếu token hoặc ví người bán thiếu VNDB thì `placeOrder` không tạo bản
ghi, và nếu điều kiện tụt sau khi đặt thì `executeOrder` chuyển `REJECTED` **trước khi** gửi. Lệnh
bán làm phần chưa phân phối (`balanceOf(spv)`) tăng và phần đang lưu hành (`totalSupply − spv`) giảm
đúng bằng số lượng bán, tổng cung không đổi.

Câu chữ sổ kiểm toán của lệnh **mua** giữ nguyên từng chữ như trước BE-14; lệnh bán có chữ "bán".

### Năm bước quyết toán (BE-14)

Mỗi `OrderView` mang `steps` (năm bước kèm mốc) và `settlement` (bốn bút toán). Ánh xạ nằm ở
`lib/bank/settlement-steps.ts`; giao diện chỉ vẽ, không tự suy từ `status`.

| Trạng thái | Tạo lệnh | Kiểm tra | Đối chiếu số dư | Quyết toán | Hoàn tất |
|---|---|---|---|---|---|
| `PLACED` | xong | chờ | chờ | chờ | chờ |
| `CHECKING` | xong | đang làm | chờ | chờ | chờ |
| `EXECUTING` | xong | xong | xong | đang làm | chờ |
| `COMPLETED` | xong | xong | xong | xong | xong |
| `REJECTED`, `EXPIRED` | xong | trượt | chờ | chờ | chờ |
| `FAILED` | xong | xong | xong | trượt | chờ |

Mốc: `createdAt`, `checkingAt` (vào `CHECKING`), `reconciledAt` (chiếm `EXECUTING`), `settlingAt`
(gắn mã giao dịch), `completedAt` (vào `COMPLETED`); bước trượt lấy `updatedAt`. Mốc ghi **trong
cùng câu lệnh** đổi trạng thái (`ORDER_STATUS_STAMPS` ở cổng lưu trữ), nên không lệch được với
`status`.

**Bước quyết toán là MỘT bước.** `settlement.atomic = true`, `entries` là đúng bốn bút toán (hai
bên × hai tài sản), `outcome` chỉ có `APPLIED` / `NONE_APPLIED` / `PENDING` — không có giá trị cho
"ghi một phần" vì tình huống đó không tồn tại. Lệnh `FAILED` trả `NONE_APPLIED`.

### Trạng thái chuỗi thật của luồng này

Trên `evm`/`hardhat-local`, `quotePurchase`, allowance VNDB/WPT, mua, bán và đối soát `orderRef`
đã chạy qua `OrderSettlement`. `previewPurchase` dùng đúng dữ liệu đó nên trả bảng điều kiện thật.
Từ FE-05, nhà đầu tư ký permit trên `/trade` và lệnh khớp bằng `buyWithPermit`/`sellWithPermit`
(kiểm trên nút Hardhat và e2e ở `docs/CHECKPOINT_FE05.md`).

⚠️ **Xem trước KHÔNG bảo đảm lệnh sẽ khớp được.** Nó chạy đúng bộ kiểm mà khớp lệnh chạy, nên hai
bên không lệch nhau vì **logic**; nhưng điều kiện đổi được giữa hai thời điểm, nên chúng vẫn lệch
nhau vì **thời gian**. Đó là giới hạn thật của mọi màn hình xem trước, không phải lỗi cần vá. Đừng
"sửa" bằng cách giữ lại kết quả xem trước rồi tin nó lúc khớp.

---

## 4.3. Luồng PHÁT HÀNH (đã hoàn thành — BE-04, nhiều lần + lập–duyệt từ BE-12, giao diện FE-22)

> **Sơ đồ sinh tự động từ marker `@flow`: `docs/flows/issue.md` (9 bước).** Đừng sửa tay tệp đó —
> sửa marker trong mã rồi chạy `node scripts/gen-flow-diagram.mjs issue`.

**Nghiệp vụ:** phát hành WPT vào **ví thanh toán SPV**, **nhiều lần**, mỗi lần không vượt **trần còn
lại** = `Project.totalSupply` − tổng cung hiện tại trên chuỗi. WPT đến tay nhà đầu tư qua
`executeOrder` (chuyển từ ví SPV). Hai đường vào, cùng một lõi — từ FE-22 chỉ đường thứ hai là
đường chính thức, đường thứ nhất là dữ liệu thử:

```
app/actions/bank.ts :: issueInitialSupplyAction()          ← dữ liệu thử: demo:mint-token + cờ
   └──→ issuance.service.ts :: issueInitialSupply() ──┐
components/pages/approval-detail.tsx (nút Chấp nhận, FE-22)
   └──→ app/actions/token-request.ts :: approveTokenRequestAction()   ← quyền order:approve
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

**Ai ký:** ví ngân hàng (`getBankSigner(chain)`), ở cả hai đường.

⚠️ **Sơ đồ `docs/flows/issue.md` vẫn vẽ đường `issueInitialSupply`** (bước 1–2), nay là đường dữ liệu
thử. Đánh số lại luồng `issue` theo đường lập–duyệt là việc của task FE-07 hoặc một task riêng — câu
hỏi mở CH-2 ở `docs/CHECKPOINT_FE22.md`. Nhãn bước 2 đã sửa cho đúng chốt chặn hiện tại. Trên chuỗi `mock` `actorAddress`
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
| Đối soát (HF-05) | `reconcileTokenRequest()` | `order:approve`; chỉ yêu cầu `EXECUTING` có `txHash`, đúng chain đang chọn. Đọc biên nhận một lần, chờ tối đa 1 giây; đồng bộ `Txn` theo `(chain, txHash)` (tạo nếu thiếu, không trùng). `CONFIRMED` thì chốt như lần duyệt; `FAILED` thì chuyển `FAILED` cùng audit trong một transaction; `PENDING` hoặc đọc lỗi thì không đổi gì. **Không bao giờ gửi giao dịch mới** |
| Đếm việc chờ | `getPendingWork(chain)` | Theo **quyền và chain**: `order:draft` đếm yêu cầu mình lập đang chờ; `order:approve` đếm yêu cầu người khác lập đang chờ |

**Vì sao năm trạng thái, không phải ba.** `EXECUTING` là đích của lần chiếm quyền — không có nó thì
phải đánh `COMPLETED` **trước** khi gửi giao dịch, và tiến trình chết giữa chừng để lại một yêu cầu
trông như xong mà token chưa đổi. `FAILED` tách "chuỗi không thực hiện được" khỏi "Kiểm soát viên
không đồng ý". Lỗi **sau** khi đã gửi giao dịch thì yêu cầu **ở nguyên `EXECUTING`** kèm mã giao
dịch cho người đối soát — không biết kết cục thì không được nói "chưa tác động".

**Sổ kiểm toán:** mọi bước ghi một dòng `order:draft` / `order:approve` (`SUCCESS`, `FAILURE` khi
điều kiện chặn, `DENIED` khi thiếu quyền hoặc tự duyệt); tác động token ghi thêm `token:mint` /
`token:burn` kèm mã yêu cầu, người lập, người duyệt.

**Chốt theo biên nhận (HF-05).** `executeIssuance` và `executeBurn` dừng ở biên nhận: `FAILED` ghi
sổ thất bại và trả lỗi; còn lại trả `{ txHash, status }`, không ghi mốc, không ghi sổ thành công.
Biên nhận `CONFIRMED`: đọc tổng cung (Mint) **trước**, rồi một thao tác lưu trữ
`finalizeTokenRequest` gom trong **một transaction** (`pgTransaction`; bản bộ nhớ là đoạn đồng bộ
không có `await`): `UPDATE ... WHERE status = 'EXECUTING'` sang `COMPLETED` (0 dòng thì dừng, trả
`null`: lượt khác đã chốt), ghi `Project.issuedAt` nếu còn rỗng, ghi `token:mint`/`token:burn` và
`order:approve` SUCCESS bằng câu SQL ngay trong transaction. Lỗi đọc tổng cung hoặc lỗi transaction
thì không ghi gì, yêu cầu giữ `EXECUTING`, báo "bấm Đối soát lại": **biên nhận `CONFIRMED` không bao giờ
dẫn tới `FAILED`**. Biên nhận `PENDING`: giữ `EXECUTING` kèm mã, audit `order:approve` SUCCESS "đã
gửi, chưa có biên nhận, cần đối soát"; màn chi tiết báo vàng và hiện nút "Đối soát" (cờ
`canReconcile` đọc cùng lần mở, không thêm action). Đường dữ liệu thử `issueInitialSupply` giữ
hành vi cũ qua `completeDirectIssuance` (bước luồng `issue:6`, `issue:7`).

**Giao diện (FE-22):** màn Lập lệnh gọi `getTokenInfoAction` → `previewTokenRequestAction` (khối
kiểm tra, mỗi lần nội dung đổi) → `createTokenRequestAction`; màn Phê duyệt lệnh gọi
`getApprovalStatsAction` + `listTokenRequestsAction`; màn chi tiết gọi `getTokenRequestDetailAction`
rồi `approveTokenRequestAction` / `rejectTokenRequestAction`, sau đó đọc lại chi tiết. Nhật ký dựng
từ các mốc của chính yêu cầu (`timelineOf`): lập là một dòng, **mỗi quyết định là một dòng** gắn nhãn
theo kết cục (hoàn tất / thất bại / đang xử lý / từ chối). Xem 3.17.

**Trạng thái EVM sau SC-02:** `evm.adapter` đã nối `mintInitialSupply`,
`isInitialSupplyMinted`, `spvWallet`; luồng lập–duyệt Mint hai lần và Burn đã chạy đầu cuối trên
Hardhat. Ngày 08/10, chủ dự án đã triển khai bộ SC-02 lên Sepolia; địa chỉ mới ở shared,
verify trạng thái đầu đạt và SPV đã whitelist. OP-04 đã chạy đủ ba giao dịch lập–duyệt local (Mint 1.000, Mint 2.000, Burn 300); RPC đối soát receipt thành công và SPV/tổng cung cuối 2.700. Bằng chứng ở `docs/CHECKPOINT_OP04_TXS.md`; còn chờ kiểm Cloudflare sau merge. Đường dữ liệu thử
phát hành trực tiếp chỉ chạy trên `mock`; mọi chain EVM phải đi qua lập–duyệt.
Adapter nhận diện bytecode cũ cả khi Hardhat trả reason `function selector was not recognized`;
kiểm lại ngày 08/10 với nút cũ từ `e4dd889` ở 8545 và nút mới ở 8645 đạt 10/10,
không bỏ qua ca tương thích. Lệnh và đầu ra nguyên văn: `docs/CHECKPOINT_SC02.md` mục 3.4.

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

## 4.5. Luồng DISTRIBUTION: chia lợi nhuận (BE-06 ✅ tầng BE; SC-06 ✅ nối EVM, PR #58)

> Sơ đồ sinh từ marker: **`docs/flows/distribute.md`** (24 bước, FE-08 đánh số lại theo đường duyệt:
> tổng quan, duyệt, mở kỳ, so số, duyệt lại, tiếp tục, lượt chia có chốt vault, keeper, các API đọc).
> Đừng sửa tay tệp đó.
> ⚠️ Số bước `@flow` đánh số **các hàm** trên đường đi; bảng trong mục này đánh số **các bước bên
> trong một hàm**. Hai hệ đánh số khác nhau, đọc chéo bằng số bước sẽ ra kết luận sai.

**Nghiệp vụ:** SPV nạp VNDB vào quỹ chia lợi nhuận sang ngân hàng mở kỳ, hợp đồng chốt ảnh chụp và lấy
đúng **phần chưa phân bổ** của quỹ sang chia cho người nắm giữ WPT, **gồm vault** (ví SPV), theo tỷ lệ tại
thời điểm chốt.

**Trạng thái:** tầng nghiệp vụ chạy đủ trên `mock` và, từ SC-06, trên Hardhat thật
(`test/sc-06-distribution-evm.test.ts`). Cơ chế quỹ một chiều, phục hồi, đẩy vault và vòng đời ở 3.24.
Từ FE-08: Kiểm soát viên duyệt đúng số trên màn `/distribution` rồi hệ thống mới mở kỳ, chốt vault và
chia; keeper chỉ tiếp tục kỳ đã duyệt (cơ chế ở **3.27**). Các giai đoạn 1 đến 3 dưới đây là service
nền; server action của chúng đã gỡ, và lõi chia từ chối kỳ chưa `APPROVED`. Màn theo dõi của nhà đầu tư
còn chờ FE-09.

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
tự tính `amount × balanceOfAt / totalSupplyAt` và tự chống chia hai lần bằng cờ đã-nhận của
từng kỳ. Hai bên lệch một đồng là sổ nói một số còn ví nhà đầu tư nhận số khác, và **không
phép kiểm nào bắt được** vì cả hai đều đúng so với nguồn của chúng. Vì vậy `shareOf()` phải
**nhân trước, chia sau** — `bigint` chia lấy phần nguyên, nên `balanceAt / totalSupplyAt` cho ra `0`
với mọi ví nắm dưới toàn bộ tổng cung và **mọi người được chia 0** trong im lặng.

### Giai đoạn 1: mở kỳ: `openPeriod()` (SC-06 QĐ-F)

```
openPeriodAction(input) ──sang lib/bank/distribution.service.ts :: openPeriod() ──sang driveOpening()
```

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `openPeriodSchema.safeParse` | mã kỳ rỗng / quá 64 ký tự / ký tự ngoài `[A-Za-z0-9._:-]` / **thiếu tiền tố chain** |
| 2 | `authorize('distribution:snapshot', ...)` | vai không có quyền → `FORBIDDEN`, ghi audit `DENIED` |
| 3 | `findPeriodByKey(periodKey)` | mã kỳ đã dùng sang `PERIOD_STATE` (đang `OPENING` thì chỉ sang `recoverOpeningPeriod`) |
| 4 | `ledger.unallocatedProfit()` | bằng 0 sang `INSUFFICIENT_PROFIT_POOL` |
| 5 | `ledger.tokenInfo().totalSupply` | bằng 0 sang `NO_CIRCULATING_SUPPLY` |
| 6 | `reservePeriod()` ở `OPENING` | ★ lần ghi đầu tiên; `UniqueConstraintError` sang `PERIOD_STATE` |
| 7 | `openDistribution(periodKey)` sang `setOpenTxHash` sang `waitReceipt` | lưu mã giao dịch **trước khi chờ** |
| 8 | `findDistribution(periodKey)` sang `completeOpening` (`OPEN`) | số tiền, ảnh chụp, tổng cung, `distributionId`, địa chỉ hợp đồng **đọc từ chuỗi** |
| 9 | đẩy số đã dành cho kỳ vào vault (QĐ-G) | lỗi không huỷ kỳ, BE-07 thử lại |

**Mọi phép kiểm đọc chạy TRƯỚC lần ghi đầu tiên**, nên mã kỳ trùng, quỹ chưa phân bổ bằng 0 hay tổng
cung bằng 0 không tốn giao dịch nào. `test/distribution-service.test.ts` chốt việc này bằng cách đòi
`balanceOfAt(_, 1)` **ném lỗi** sau mỗi lần từ chối (chưa ảnh chụp nào tồn tại).

**Phép "đọc lại quỹ để so" của BE-06 đã bỏ.** Trước SC-06, cổng không đọc lại được con số chuỗi đã
chốt; nay `findDistribution` đọc đúng kỳ theo nhãn, nên sổ ghi đúng số hợp đồng chốt dù quỹ đổi ngay
trong lúc mở.

**Mã kỳ trùng bị chặn ở BA chỗ:** lần đọc ở bước 3 (tránh tốn giao dịch), ràng buộc duy nhất ở bước 6
(trọng tài giữa hai tiến trình), và nhãn dùng một lần trên chuỗi (gửi lại không thể tạo kỳ thứ hai).

### Giai đoạn 2 — xem trước: `previewDistribution()`

Chạy `collectRecipients()` rồi `allocate()` — **đúng hai hàm** mà `distributePeriod` sẽ dùng, không có
bản thứ hai. Trả về phân bổ từng ví, `allocated`, `dust`, `dustWallet`.

Hàm này **không ghi một dòng nào**, kể cả sổ kiểm toán: nó kiểm quyền bằng `assertCan`, không
`authorize`. Ví được chia 0 **vẫn có mặt** trong danh sách với `amount: "0"` — vắng mặt nghĩa là chưa
ai xét tới ví đó, còn `"0"` là kết luận đã xét và không được chia, và người đối soát cần phân biệt.

### Giai đoạn 3 — chia theo lô: `distributePeriod()`

| Bước | Việc | Ghi chú |
|---|---|---|
| 1 | `authorize('distribution:execute', ...)` | kỳ ở `COMPLETED`/`CLOSED`/`OPENING` sang `PERIOD_STATE`; đọc kỳ trên chuỗi, khác địa chỉ hợp đồng hoặc ảnh chụp sang `PERIOD_STATE` |
| 2 | `readDistributionBatchSize()` + `readDistributionMaxBatchesPerRun()` | khoá `distribution.batch_size` (50) và `distribution.max_batches_per_run` (5) — xem 3.13 |
| 3 | `collectRecipients()` rồi `allocate()` cho ví **chưa có hồ sơ** | chạm giới hạn quét → từ chối |
| 4 | `createPayouts(...)` ở `PENDING`, chia theo `MAX_BULK_ROWS` | ★ **trước khi gửi giao dịch nào** |
| 5 | hồ sơ `amount = 0` sang `PAID` luôn, không vào lô nào; hồ sơ có tiền chưa `PAID` tra `isDistributionPaid` | chuyển 0 đồng tốn một chỗ trong lô mà không chuyển gì; đã nhận trên chuỗi sang `PAID` "đối soát từ chuỗi" |
| 5b | kỳ đã đóng hoặc quá hạn trên chuỗi sang hồ sơ chưa trả `EXPIRED`, kỳ `EXPIRED`/`CLOSED`, **không gửi lô** | không hồ sơ chưa trả nào thành `PAID` |
| 6 | kỳ `OPEN` → `DISTRIBUTING` | chỉ khi thật sự có lô để gửi |
| 7 | mỗi lô: `distributeBatch(distributionId, …)` sang `SENT` + `txHash` sang `waitReceipt` sang `PAID`, hoặc tra chuỗi từng ví rồi `PAID`/`FAILED` | lô lỗi **không** dừng các lô còn lại; **dừng sau `maxBatches` lô** (BE-07) |
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

**Ai ký:** ví ngân hàng (`server.signer` qua `getLedger(chain)`): `openDistribution`, `distributeBatch`, `closeVaultPeriod`.
Nhà đầu tư không ký gì trong luồng này — đây là mô hình **push**, ngân hàng chia hộ.

### Phần dư làm tròn

Tổng các phần nguyên nhỏ hơn hoặc bằng tổng tiền. Phần cắt ra là `dust`; nó ở lại **dự trữ của kỳ**
trên chuỗi và về quỹ chưa phân bổ khi kỳ đóng sau hạn nhận (SC-06 QĐ-28). Quỹ một chiều nên không có
đường chuyển phần dư cho ví nào; `distribution.dust_wallet` chỉ còn được hiển thị.

### Còn thiếu

| Việc | Chờ ai |
|---|---|
| Triển khai lại Sepolia với `ProfitDistributor` mới, vault và hợp đồng khớp lệnh | OP-05 |
| Quyền on-chain: `ProfitDistributor` giữ `SNAPSHOT_ROLE` trên `ProjectToken`, ví ký giữ `DISTRIBUTOR_ROLE` và `DEFAULT_ADMIN_ROLE` (đóng kỳ), và `CONFIG_ROLE` trên vault (đẩy số đã chia) | khâu triển khai: `deploy.js` đã cấp |
| Màn nhà đầu tư tự nhận (`claim`) | ngoài phạm vi SC-06 |
| ~~Giao diện duyệt, chia, theo dõi kỳ, phục hồi~~ | **FE-08 xong** (3.27); phần nhà đầu tư còn chờ FE-09 |
| ~~Thiết kế lại nghiệp vụ chia~~ | **BE-18 vào `done` ở FE-07**: nội dung đã thực hiện qua DS-01 bản 5, SC-06 và FE-08 (quỹ chia một chiều, duyệt tổng số rồi chia, chốt kỳ vault); không còn marker nào trỏ tới BE-18 |
| Phát hiện tiền vào bằng **sự kiện**; danh sách người nhận đầy đủ | IN-01, IN-02: xem 1.6.C |

### Giai đoạn 4 — tự động: `runDistributionCycle()` (BE-07)

Cơ chế đầy đủ, cạm bẫy và cách mở rộng ở **3.14**. Ở đây chỉ là đường đi.

```
cron của hạ tầng ──> POST /api/keeper/distribution   (Authorization: Bearer $KEEPER_SECRET)
        └──────────────────> lib/bank/distribution-trigger.service.ts :: runDistributionCycle()
                                   ├─ reconcileChainPeriods() phục hồi OPENING (kèm so số duyệt), vault kỳ được phép
                                   ├─ decideCycle()           FE-08: chỉ kỳ hoạt động APPROVED; còn lại AWAITING_APPROVAL
                                   ├─ runApprovedPeriod(KEEPER) chiếm `<mã kỳ>#<số vòng>`, lõi runDistributionRound
                                   ├─ settleBalanceMark()     chỉ khi outstanding = 0
                                   └─ finishRun() + appendAudit()
(FE-08: không còn nút "chạy ngay"; keeper KHÔNG BAO GIỜ mở kỳ)
```

| Bước | Việc | Chặn ở đâu |
|---|---|---|
| 1 | `distributionCycleSchema.safeParse` | chain sai dạng → `VALIDATION` |
| 2 | `authorize('distribution:execute', ...)` | vai không có quyền → `FORBIDDEN`, ghi audit `DENIED` |
| 2b | `reconcileChainPeriods()` | lỗi chỉ ghi audit, không dừng vòng |
| 3 | `profitPoolBalance()`, `reservedProfit()`, `unallocatedProfit()` | quỹ hụt so với dự trữ sang `INSUFFICIENT_PROFIT_POOL` |
| 4 | `decideCycle()` | không có phần chưa phân bổ sang `ok` `NO_NEW_FUNDS`; dưới ngưỡng sang `ok` `BELOW_MIN_NEW_BALANCE`; FE-08: có tiền hoặc kỳ chưa duyệt sang `ok` `AWAITING_APPROVAL` |
| 5 | `startRun(jobName, '<mã kỳ>#<số vòng>')` | khoá đã có chủ → `ok` `ALREADY_RUNNING`, **dừng ngay** |
| 6 | FE-08: chỉ kỳ `APPROVED` đang dở, chia tiếp với `triggerSource = KEEPER`; không mở kỳ mới | quỹ đủ đã được bảo đảm ở bước 3 |
| 7 | `distributePeriod()` | lỗi → đóng `KeeperRun` ở `FAILED`, trả lỗi của BE-06 |
| 8 | `outstanding = 0` sang `settleBalanceMark()` (chỉ hiển thị); kỳ `EXPIRED`/`CLOSED` sang `PERIOD_ENDED` | còn ví chưa nhận sang lượt sau chia tiếp |
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
| — | BE-01 mở rộng `ILedgerPort` cho ba luồng (tại thời điểm bàn giao: `mock` đủ 16/16, `evm` còn 11 method chờ; sau SC-02 còn 8) | ✅ Xong |
| — | FE-02 màn kết nối ví (`/wallet`, tám trạng thái, `canSign` dùng chung) | ✅ Xong |
| — | BE-02 nghiệp vụ lệnh mua WPT (`purchase.service` + mô hình trạng thái; chạy đủ trên mock và EVM sau SC-03) | ✅ Xong |
| — | OP-03 hardhat một lệnh, ví mẫu trên chuỗi và project E2E `hardhat` | ✅ Xong — PR #41 |
| — | SC-02 contract khóa phát hành theo ví SPV; adapter và lập–duyệt Mint/Burn chạy thật trên Hardhat | ✅ Đã merge PR #42 |
| — | OP-07 mock ledger lưu bền theo chain trên PostgreSQL/Hyperdrive | ✅ Xong — PR #50 |
| — | FE-27 giao diện, lập–duyệt và giá phát hành đồng bộ theo chain (xem 3.22) | ✅ Mã và kiểm chứng local xong; chờ Supervisor nghiệm thu |
| — | SC-09 WPT theo ERC-3643 PoC, sổ danh tính/bộ luật tách rời và ERC-2612 cho WPT/VNDB | ✅ Xong; đã đối chiếu bằng chứng Sepolia ngày 19/10/2026 |
| — | SC-07 vault thanh toán SPV, khoá VNDB on-chain, lịch sử chốt kỳ và chặn Mint đầu sai đích (xem 3.23) | ✅ Xong local; triển khai lại Sepolia thuộc OP-05 |
| — | SC-03 khớp mua/bán nguyên tử trên EVM, permit ở contract và phục hồi theo `orderRef` (xem 4.2) | ✅ Xong local; triển khai lại Sepolia thuộc OP-05 |
| — | IN-01 Indexer gọn cho sự kiện vault/WPT và danh sách ví theo Transfer (xem 3.30) | ✅ Xong mã và kiểm chứng local; chờ Supervisor nghiệm thu |
| — | MC-01 cơ chế điểm cắm: marker + script quét + sơ đồ luồng sinh từ mã + dọn phụ thuộc (xem 3.10) | ✅ Xong — PR #21 |
| — | BE-03 xem trước điều kiện mua WPT + `placeOrder` chặn lệnh rác (xem 4.2) | ✅ Xong — PR #23 |
| — | MC-02 khuôn checkpoint + máy kiểm `check-checkpoint.mjs` (xem 3.11) | ✅ Xong — PR #22 |
| — | BE-04 giá phát hành cấu hình được + phát hành nguồn cung một lần (xem 3.12, 4.3) | ✅ Xong — PR #25 |
| — | BE-06 nghiệp vụ chia lợi nhuận: chốt quyền, xem trước, chia theo lô, chạy lại (xem 4.5) | ✅ Xong — PR #26 |
| — | BE-07 tự động chia khi ví lợi nhuận nhận tiền: phát hiện, chống chạy trùng, chia nhiều lượt, cảnh báo kỳ treo, điểm vào cho cron (xem 3.14, 4.5 giai đoạn 4) | 🔶 Mã xong trên nhánh `feat/distribution-trigger`, **chưa nghiệm thu, chưa merge vào `dev`** |
| — | OP-01 tích hợp liên tục + cổng bảo vệ `dev` + tạm dừng Stellar ở khâu kiểm chứng (xem 2.6, 2.7) | 🔶 Mã xong trên nhánh `op/01-ci`, **chưa nghiệm thu, chưa merge vào `dev`** |
| — | BE-12 lập–duyệt yêu cầu Mint/Burn + phát hành nhiều lần theo trần còn lại + số việc đang chờ thật (xem 4.3) | ✅ Xong — PR #30 |
| — | FE-21 ba màn Người bán: Tổng quan, Danh sách giao dịch, Tạo lệnh rút (xem 3.16) | ✅ Xong — PR #31; phần ghi của lệnh rút chờ BE-13 |
| — | FE-22 màn Lập lệnh, Phê duyệt lệnh, chi tiết yêu cầu + đóng đường đi vòng (Giao dịch viên không còn `token:mint` / `token:burn`) (xem 3.17, 4.3) | 🔶 Mã xong trên nhánh `feat/maker-checker-ui`, **chưa nghiệm thu, chưa merge vào `dev`** |
| P2 | **REDEEM** (`Redemption.sol`) — BE-05 tất toán | ⏳ Kế tiếp |
| P3 | **DISTRIBUTION** trên chuỗi thật: `evm.adapter.distributeBatch` + `EnergyOracle` | 🔶 SC-06 nối xong trên Hardhat (nhánh `feat/sc-06-chia-loi-nhuan`, chờ nghiệm thu); Sepolia ở OP-05; `EnergyOracle` không dùng (QĐ-11) |
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
bash scripts/run-local-all.sh evm                                 # việc C, đầu cuối trên hardhat

# Chuỗi hardhat cục bộ (OP-03) — xem docs/EVM_LOCAL.md
bash scripts/evm-local.sh up | down | reset

# Bảng quyền có teo lại so với nền hay không (mặc định nền là origin/dev)
RBAC_BASE_REF=origin/dev bash scripts/verify-arch-rules.sh

# Kiểm khói một bản đang chạy (chạy TAY, chưa gắn vào triển khai)
node scripts/smoke-test.mjs http://localhost:3000
node scripts/smoke-test.mjs https://<địa-chỉ> --expect-commit=$(git rev-parse HEAD)
```
