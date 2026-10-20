# OP-05: Triển khai lại Sepolia lần hai và chạy trọn một vòng nghiệp vụ

| | |
|---|---|
| Nhánh | PR A `feat/op-05-runbook` từ `dev` **sau khi BE-13 và FE-08 merge** |
| Điểm | 5 phần coder (liên kết ví trong hồ sơ, runbook có cutover database và Cloudflare, ước phí, kiểm thử vòng nghiệp vụ, diễn tập) cộng thời gian chủ dự án chạy |
| Mức kiểm chứng | **Vừa** (không đổi hợp đồng; một thay đổi app nhỏ ở hồ sơ; rủi ro chính ở thứ tự vận hành) |
| Trạng thái spec | **Bản 3, ngày 20/10/2026**: chốt CH-1 đến CH-7 với chủ dự án. Bản 2 đã qua review Codex |
| Thứ tự | **BE-13** (rút vault, cấu hình khoá vault cho Kiểm soát viên) và **FE-08** (Kiểm soát viên duyệt chia) làm trước. Đóng đợt 6 |
| Căn cứ | Quyết định một chain (vault chỉ trên `evm`); SC-07 R6; DS-01 QĐ-13 bản 5, QĐ-25; SC-03; SC-06 QĐ-G; FE-05 |

## Mục tiêu

1. Chain `evm` (Sepolia) chạy bộ chín hợp đồng mới nhất; bản Cloudflare dùng **database mới cùng thế hệ** với bộ
   hợp đồng đó.
2. Chạy trọn **một vòng nghiệp vụ hoàn toàn qua giao diện app** (không thao tác chuyển tiền ngoài hệ thống, trừ bước
   nạp lợi nhuận thay cho SPV) với số dư kỳ vọng tính trước.
3. Một runbook duy nhất ghi rõ việc nào chủ dự án làm tay, việc nào coder hoặc Supervisor làm; có đường lùi.

## Các quyết định đã chốt với chủ dự án

| Mã | Chốt |
|---|---|
| CH-1 | Khoá vault: **FIXED ưu tiên, rồi PERCENT**. PERCENT mặc định 20%, Kiểm soát viên cấu hình được tỷ lệ; Kiểm soát viên đặt số cố định thì vault chuyển FIXED. Màn cấu hình làm trong **BE-13**; OP-05 cấu hình qua màn đó |
| CH-2 | Người dùng đang đăng nhập **tự thêm địa chỉ ví vào hồ sơ cá nhân**, app so ví đang kết nối với ví trong hồ sơ (QĐ-I). Cơ chế đầy đủ ghi vào `tech-report.md` là **nợ kỹ thuật**. Whitelist ví trên chuỗi là bước mặc định của ngân hàng |
| CH-3 | **Phương án A**: database Neon mới trống, database cũ giữ làm lịch sử (QĐ-A) |
| CH-4 | Rút vault qua hệ thống: **làm BE-13 trước**, OP-05 rút qua kênh Người bán |
| CH-5 | Chia lợi nhuận: **Kiểm soát viên duyệt con số của kỳ, bấm duyệt thì chia ngay** (FE-08). API keeper giữ nguyên cho tự động hoá về sau, OP-05 không dùng lịch. Cơ chế keeper ghi vào `tech-report.md` là nợ kỹ thuật (FE-08 viết) |
| CH-6 | Giữ `ENABLE_DEMO_PAYMENT_MINT=true` trên bản PoC testnet |
| CH-7 | Chặn cứng `dod-verify-sepolia.js`, không xoá |

## Hiện trạng đã đo (Supervisor, `dev` @ `15a5d9a`)

```bash
sed -n 431,460p app/src/lib/store/postgres.pool.ts
# seed Project theo (tokenSymbol, chain); chỉ cập nhật contractAddress khi issuedAt IS NULL
sed -n 304,340p app/src/lib/bank/distribution.service.ts
# người nhận chia lợi nhuận dựng từ database (lệnh COMPLETED, hồ sơ chia các kỳ trước của chain) cộng vault
sed -n 290,300p app/src/lib/bank/trade.service.ts; sed -n 51,70p app/src/lib/bank/account-profile.service.ts
# điều kiện "identity" đòi ví giao dịch thuộc hồ sơ của phiên; hồ sơ NDT001 gắn cứng ví Hardhat mẫu
grep -n "exportAbi\|writeAddresses" packages/contracts-evm/scripts/deploy.js
# deploy ghi addresses.json VÀ packages/shared/generated/*.abi.json
grep -n '"id"' app/wrangler.json
# ID Hyperdrive nằm trong repo
```

## Quyết định thiết kế

### QĐ-A. Database mới cho thế hệ hợp đồng mới

- Database cũ: dự án WPT/`evm` đã phát hành nên seed không ghi lại địa chỉ token mới; người nhận chia lợi nhuận và
  lịch sử lệnh của hai thế hệ hợp đồng sẽ trộn vào nhau. Vì vậy dùng database mới trống, database cũ giữ nguyên làm
  lịch sử, không câu lệnh ghi hay xoá nào trên đó.
- Hyperdrive mới trỏ vào database mới, **tắt query cache**; ID mới đi **cùng PR với address book mới** (QĐ-B). Không
  sửa origin của Hyperdrive cũ tại chỗ (Worker cũ sẽ seed địa chỉ cũ vào database mới).
- Theo hướng dẫn Cloudflare cho Neon: dùng chuỗi kết nối **trực tiếp** (bỏ chọn connection pooling trong Neon), vì
  Hyperdrive tự giữ pool; dùng `pg` như mã hiện có.
- Hệ quả chấp nhận: dữ liệu demo chain `mock` trên database mới bắt đầu lại.

### QĐ-B. Ba giai đoạn PR và đường lùi

| PR | Ai mở | Nội dung | OP-05 sau merge |
|---|---|---|---|
| A | Coder | Liên kết ví trong hồ sơ, công cụ, runbook, kiểm thử, diễn tập | `inProgress` |
| B | Chủ dự án | Chỉ `addresses.json` (khoá `evm`), `packages/shared/generated/*`, ID Hyperdrive trong `app/wrangler.json` | `inProgress` |
| C | Chủ dự án (Supervisor soạn nội dung) | `CHECKPOINT_OP05.md` phần chạy thật (đã lọc bí mật), trạng thái `done` | `done` |

- PR B phải merge trước vòng nghiệp vụ vì Cloudflare dựng từ `dev`.
- Trước khi PR B merge: người dùng không bị ảnh hưởng. Sau khi PR B merge mà hỏng: revert PR B, Workers Builds dựng
  lại bản cũ với Hyperdrive cũ; database cũ còn nguyên.

### QĐ-C. Runbook một mạch, ghi rõ ai làm

Viết lại `docs/TESTNET_SEPOLIA.md`; lịch sử OP-04 thu về một đoạn trỏ tới `CHECKPOINT_OP04*.md`. Ba tên địa chỉ:
`SPV_PAYMENT_VAULT` (hợp đồng vault), `PAYOUT_WALLET` (ví nhận tiền khi Người bán rút, `0x5a5B...c4fd`),
`INVESTOR_WALLET` (ví MetaMask Nhà đầu tư, `0xB3a5...d033`). Cột "Ai" dùng: **Sếp** (chủ dự án, thao tác tay, giữ
khoá và tài khoản), **SV** (Supervisor, chỉ đọc và soát), **App** (thao tác trên giao diện, ghi vai).

| Bước | Nội dung | Ai |
|---|---|---|
| 0 | Điều kiện vào: `dev` có BE-13, FE-08, PR A; CI xanh. Ghi SHA và phiên bản Worker đang chạy để lùi | Sếp; SV kiểm SHA |
| 1 | Ví và biến bí mật trong `.env` cục bộ (giữ bảng địa chỉ và cảnh báo ví mẫu Hardhat) | Sếp |
| 2 | Nếu đang có lịch gọi keeper ở đâu đó: tạm dừng, ghi lại | Sếp |
| 3 | Ảnh chụp chỉ đọc database **cũ** (QĐ-F mục 1), gửi đầu ra cho SV lưu làm lịch sử | Sếp chạy; SV lưu |
| 4 | Tạo database Neon mới và Hyperdrive mới (QĐ-D) | Sếp |
| 5 | Biên dịch, preflight, cấp phí theo bảng ước phí (QĐ-E) | Sếp |
| 6 | Deploy, `verify-deployment`, kiểm giá R7 trên hợp đồng | Sếp chạy; SV đọc chuỗi đối chiếu |
| 7 | Whitelist `PAYOUT_WALLET` và `INVESTOR_WALLET` (bước mặc định của ngân hàng; ví đã đăng ký thì bỏ qua) | Sếp; SV đọc `isVerified` |
| 8 | PR B (QĐ-B): kiểm diff chỉ gồm ba nhóm tệp; merge | Sếp mở và merge; SV soát diff |
| 9 | Cloudflare: secret (QĐ-G), xoá `NEXT_PUBLIC_ADDR_EVM_*`, chờ Workers Builds | Sếp |
| 10 | Kiểm khói `smoke-test.mjs --expect-commit=<SHA PR B> --chain=evm` trên URL công khai | SV (hoặc Sếp) |
| 11 | Kiểm chỉ đọc database **mới** sau lần chạy đầu (QĐ-F mục 2). Sai thì revert PR B, dừng | Sếp chạy; SV đối chiếu |
| 12 | Cấu hình vault trên màn BE-13 (QĐ-H) | App: Kiểm soát viên |
| 13 | Vòng nghiệp vụ (QĐ-H) | App và Sếp |
| 14 | Gửi đầu ra không bí mật; SV đọc chuỗi nghiệm thu, soạn PR C | Sếp gửi; SV |

### QĐ-D. Hướng dẫn tạo database và nối Cloudflare (bước 4, Sếp làm tay)

Runbook ghi đủ các thao tác dưới, mỗi thao tác kèm "phải thấy gì":

1. **Neon Console**, đúng project đang dùng: tạo database mới, ví dụ `bidv_rwa_op05`, chủ sở hữu là role ứng dụng
   đang dùng (role này cần quyền `CONNECT, CREATE` trên database và `USAGE, CREATE` trên schema `public`, như
   `DEPLOYMENT.md`). Không sao chép dữ liệu.
2. Lấy chuỗi kết nối của database mới ở **Connection Details**, **bỏ chọn connection pooling** (chuỗi trực tiếp). Chỉ
   dán vào lệnh ở bước 3 trên máy Sếp; không đưa vào repo, chat, hay biến Worker.
3. Tạo Hyperdrive, tắt cache ngay khi tạo:
   `npx wrangler hyperdrive create bidv-rwa-op05 --connection-string="<chuỗi trực tiếp>" --caching-disabled`.
   Hyperdrive kiểm kết nối trước khi tạo; lỗi thì kiểm lại role, mật khẩu, database.
4. `npx wrangler hyperdrive get <ID mới>`: caching ở trạng thái disabled. Ghi ID mới cho PR B.
5. (Tuỳ chọn, nếu muốn chạy thử cục bộ trước) chạy app cục bộ với `DATABASE_URL` trỏ database mới để lược đồ và
   seed tự áp; không bắt buộc vì Worker tự áp ở lần chạy đầu.

### QĐ-E. Ước phí theo thao tác và theo ví gửi

- `fund-sepolia.js`, `preflight-sepolia.js` đo gas trên Hardhat cục bộ như hiện có, in **bảng theo thao tác**, mỗi
  dòng ghi ví gửi. Mọi giao dịch đều do ví ký máy chủ gửi; ví tổng chỉ cấp phí; Nhà đầu tư chỉ ký typed data, **không
  tốn ETH, không được cấp ETH**.

| Thao tác (`--for`) | Số giao dịch |
|---|---|
| `deploy` | 9 constructor cộng các giao dịch liên kết và cấp vai `deploy.js` gửi (coder đếm từ mã, ghi số cụ thể) |
| `whitelist` | 2 (bỏ qua ví đã đăng ký) |
| `vault-config` | theo số giao dịch màn cấu hình BE-13 gửi cho PERCENT 20% và ví nhận (coder đo từ BE-13) |
| `mint-initial` | 1 |
| `payment-mint` | 1 |
| `trade` | 2 (`buyWithPermit`, `sellWithPermit`) |
| `profit-mint` | 1 |
| `distribute` | 3 với hai người nhận: `createDistributionFromPool`, `closePeriod`, một lô `distributeTo` |
| `withdraw` | 1 |
| `demo-cycle` | tổng từ `vault-config` đến `withdraw` |

- Bỏ thao tác và tên `cycle` cũ (Mint/Mint/Burn).

### QĐ-F. Kiểm database chỉ đọc

Chạy trong `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`, chỉ xuất số đếm và cột định danh. Tập trạng thái lấy từ mã,
ghi tệp nguồn trong runbook:

| Bảng | Chưa kết thúc | Nguồn |
|---|---|---|
| `PurchaseOrder` | không thuộc `TERMINAL_ORDER_STATUSES` | `app/src/lib/bank/purchase.state.ts` |
| `TokenRequest` | `PENDING`, `EXECUTING` | `app/src/lib/store/token-request.store.port.ts` |
| `Txn` | `PENDING` | `TxStatus` trong `schema.prisma` |
| `DistributionPeriod` | `OPENING`, `OPEN`, `DISTRIBUTING`; hoặc `vaultCloseStatus` là `PENDING`, `SENT`, `CONFLICT` | `app/src/lib/store/distribution.store.port.ts` |
| `DistributionPayout` | `PENDING`, `SENT`, `FAILED` | như trên |
| `KeeperRun` | `RUNNING` | `app/src/lib/store/keeper.store.port.ts` |
| Bảng yêu cầu rút của BE-13 | trạng thái chưa kết thúc theo BE-13 | tệp cổng lưu trữ của BE-13 |

1. **Database cũ (bước 3):** chạy cho chain `evm`, lưu làm lịch sử. Không chặn, không sửa.
2. **Database mới (bước 11):** mọi bảng trên đếm 0; `Project` WPT/`evm` có `contractAddress` bằng `ProjectToken`
   trong `addresses.json` mới và `issuedAt IS NULL`; `SystemConfig` giá `evm` (nếu có) bằng giá trên hợp đồng; bảng
   `Role` đủ dòng seed.

### QĐ-G. Biến và secret Cloudflare

Bảng hiện có cộng `KEEPER_SECRET` (Worker Secret, ít nhất 32 ký tự; giữ để API keeper không mở, dù OP-05 không gọi).
`ENABLE_DEMO_PAYMENT_MINT=true` (CH-6). Không đặt `FUNDER_PRIVATE_KEY`, `PRIVATE_KEY`, `NEXT_PUBLIC_ADDR_EVM_*`.

### QĐ-H. Cấu hình vault và vòng nghiệp vụ (bước 12, 13), toàn bộ qua app

| Lượt | Thao tác | Vai, màn |
|---|---|---|
| 12 | Đặt ví nhận `PAYOUT_WALLET`, PERCENT 20%, không đặt số cố định; kiểm màn `/vault` hiện PERCENT, 20%, khoá 0 | Kiểm soát viên, màn cấu hình BE-13 |
| 13.1 | Mint đầu 1.000.000 WPT vào vault | Giao dịch viên lập `/draft`, Kiểm soát viên duyệt `/approvals` |
| 13.2 | Liên kết `INVESTOR_WALLET` vào hồ sơ NDT001 trên chain `evm` (QĐ-I) | Nhà đầu tư, trang tài khoản |
| 13.3 | Nạp 20.000.000 VNDB demo cho `INVESTOR_WALLET` | Vai có quyền nạp demo |
| 13.4 | Mua 100 WPT bằng chữ ký `permit` | Nhà đầu tư, MetaMask, `/trade` |
| 13.5 | Bán 40 WPT bằng chữ ký `permit` | Như trên |
| 13.6 | Mint 1.000.000 VNDB vào `ProfitDistributor` (thay cho SPV chuyển lợi nhuận; **bước tay duy nhất**, ghi rõ trong runbook là thay thế của bản trình diễn) | Sếp, lệnh console |
| 13.7 | Duyệt con số 1.000.000 VNDB của kỳ, bấm duyệt thì chia | Kiểm soát viên, màn FE-08 |
| 13.8 | Rút 3.399.970 VNDB (50% phần rút được) về `PAYOUT_WALLET` | Người bán, `/seller/withdraw` (BE-13) |

Mỗi lượt ghi mã yêu cầu hoặc mã lệnh, tx hash, receipt `status = 1`, số dư sau, đối chiếu bảng dưới. Lệch thì dừng.
Đặt lệnh từng lệnh một (hàng đợi gửi của FE-05 chỉ trong một tiến trình).

### Số dư kỳ vọng

Giá 100.000 VNDB/WPT. Tổng cung lúc chia 1.000.000 WPT nên không có phần dư. Theo DS-01 QĐ-13 bản 5, `closePeriod`
nhận **toàn bộ** số đã dành cho kỳ (1.000.000 VNDB), không phải riêng phần vault nhận.

| Sau lượt | WPT Nhà đầu tư | VNDB Nhà đầu tư | WPT vault | VNDB vault | `netProceeds` | `lockedAmount` | `withdrawable` |
|---|---|---|---|---|---|---|---|
| 13.1 | 0 | 0 | 1.000.000 | 0 | 0 | 0 | 0 |
| 13.3 | 0 | 20.000.000 | 1.000.000 | 0 | 0 | 0 | 0 |
| 13.4 | 100 | 10.000.000 | 999.900 | 10.000.000 | 10.000.000 | 2.000.000 | 8.000.000 |
| 13.5 | 60 | 14.000.000 | 999.940 | 6.000.000 | 6.000.000 | 1.200.000 | 4.800.000 |
| 13.7 | 60 | 14.000.060 | 999.940 | 6.999.940 | 6.000.000 | 200.000 | 6.799.940 |
| 13.8 | 60 | 14.000.060 | 999.940 | 3.599.970 | 6.000.000 | 200.000 | 3.399.970 |

- Sau 13.7: quỹ chia còn 0 VNDB chưa phân bổ; vault `lastPeriodRef = 1`, `lastDistributedPrev = 1.000.000`,
  `percentLocked = 200.000`. `PAYOUT_WALLET` nhận 3.399.970 VNDB ở 13.8 (nếu BE-13 chốt có phí thì trừ phí theo BE-13).
- Số dư ETH của `INVESTOR_WALLET` không đổi suốt vòng.

### QĐ-I. Liên kết ví trong hồ sơ cá nhân (CH-2)

- Trang tài khoản (FE-24) của vai khách hàng (Nhà đầu tư, Người bán) có mục **"Ví liên kết trên chain `<chain>`"**:
  hiện ví đang liên kết, ô sửa địa chỉ, nút "Dùng ví đang kết nối" để điền sẵn, nút Lưu. Vai nhân viên không có mục
  này.
- Server action `linkProfileWalletAction({ chain, wallet })`: người dùng lấy từ phiên (không nhận mã hồ sơ từ
  client); kiểm địa chỉ hợp lệ; trên chain thật từ chối ví mẫu Hardhat (dùng chung danh sách mà `fund-sepolia.js` đang
  từ chối); một ví chỉ liên kết với một hồ sơ trên một chain; ghi audit (ai, chain, ví cũ, ví mới).
- Lưu ở bảng mới (ví dụ `ProfileWallet`: mã hồ sơ, chain, ví, thời điểm, người sửa), khoá `(mã hồ sơ, chain)`, duy
  nhất `(chain, ví viết thường)`; có trong `init.sql`, cổng lưu trữ bộ nhớ và Postgres.
- Tra hồ sơ theo chain: ví liên kết của chain đó nếu có; không có thì ví mẫu như cũ trên `mock` và `hardhat-local`;
  trên `evm` không có ví mặc định (bắt buộc liên kết). `previewTrade` và các chỗ đang tra hồ sơ theo ví truyền chain.
- Liên kết **không** tự whitelist trên chuỗi và **không** chứng minh quyền sở hữu ví.
- **Nợ kỹ thuật ghi vào `tech-report.md`** (mục mới, gắn nhãn nợ, đưa vào bảng nợ): hồ sơ mẫu gồm những trường nào
  (họ tên, KYC, rủi ro, AML, hạn mức ngày, ví), lấy từ đâu (mã nguồn, 4 tài khoản demo), cách so ví đang kết nối với
  hồ sơ của phiên, cách liên kết ví mới; vì sao chưa an toàn (không ký chứng minh sở hữu, hồ sơ không lấy từ KYC thật);
  hướng trả nợ ở AU-01 (đăng nhập thật, ký thông điệp chứng minh sở hữu ví, hồ sơ từ hệ thống KYC).

### QĐ-J. Chặn cứng `dod-verify-sepolia.js` (CH-7)

Đầu `main`, trước khi lấy signer hay gửi giao dịch: đọc chainId, tra address book; chain đó có `SpvPaymentVault` thì
thoát mã khác 0, thông báo "bộ hợp đồng có vault, dùng runbook OP-05".

### QĐ-K. Diễn tập không làm bẩn repo

Diễn tập trên `--network localhost` sao lưu `packages/shared/src/addresses.json` và `packages/shared/generated/`,
phục hồi bằng `trap ... EXIT` kể cả khi lỗi; kết thúc `git status --short` rỗng.

## Ràng buộc

- Không sửa hợp đồng. Thay đổi app chỉ ở QĐ-I. Không triển khai Sepolia, không giữ hay xin khoá.
- Runbook không chứa khoá, RPC có API key, chuỗi kết nối có mật khẩu, câu SQL ghi hay xoá.
- Giữ cảnh báo không gửi SepoliaETH vào ví mẫu Hardhat.
- Ca kiểm thử chạy nhiều giao dịch trên nút thật đặt ngưỡng thời gian riêng.
- Luật kiến trúc giữ nguyên. Checkpoint dán nguyên văn đầu ra lệnh đã chạy.

## Mức kiểm chứng: Vừa

| Ca | Kiểm |
|---|---|
| 1 | **Runbook:** đủ bước 0 đến 14 theo QĐ-C với cột "Ai"; hướng dẫn QĐ-D đủ năm thao tác; ba tên địa chỉ; không còn bước Mint vào ví SPV hay `cycle` cũ; có đường lùi QĐ-B |
| 2 | **Ước phí:** mỗi thao tác QĐ-E trả gas lớn hơn 0 khi mô phỏng, số giao dịch khớp bảng; `demo-cycle` bằng tổng; bảng in ví gửi; `--dry-run` không cần khoá tổng |
| 3 | **Liên kết ví:** lưu và đọc lại theo chain; phiên chỉ sửa được hồ sơ của chính mình; ví mẫu Hardhat bị từ chối trên `evm` (trên `hardhat-local` vẫn nhận, vì kiểm thử và e2e dùng ví mẫu); một ví hai hồ sơ bị từ chối; audit có dòng sửa; `previewTrade` trên chain thật qua điều kiện `identity` với ví đã liên kết và whitelist, trượt với ví chưa liên kết; `mock` giữ ví mẫu |
| 4 | **Kiểm thử vòng nghiệp vụ trên nút Hardhat** (tệp mới, chạy riêng): lượt 12 đến 13.8 bằng service của app (cấu hình vault của BE-13, Mint qua lập duyệt, liên kết ví, nạp demo, mua bán bằng permit, mint lợi nhuận, duyệt chia của FE-08, rút của BE-13); khẳng định **từng ô** bảng số dư kỳ vọng. Lệch thì báo Supervisor kèm số đo, không tự sửa bảng |
| 5 | **Chặn `dod-verify-sepolia.js`:** chạy trên `localhost` sau deploy thì thoát mã khác 0 với thông báo QĐ-J, nonce ví ký không đổi |
| 6 | **Truy vấn QĐ-F:** chạy trên Postgres cục bộ (database mới khởi tạo, và database có một bản ghi chưa kết thúc dựng thử), dán đầu ra; câu ghi bị Postgres từ chối trong transaction chỉ đọc |
| 7 | **Diễn tập QĐ-K:** dán đầu ra deploy, `verify-deployment`, whitelist hai ví, mint lợi nhuận, chặn `dod-verify-sepolia.js`; cuối cùng `git status --short` rỗng |
| 8 | `tech-report.md` có mục nợ QĐ-I đủ ý; bảng nợ có dòng tương ứng |
| 9 | `run-local-all.sh` xanh; job A (có `trap`) xanh; job C xanh; kiểm thử nút thật chạy từng tệp xanh; quét bí mật sạch |

## Điều kiện hoàn thành

- [ ] PR A: ca 1 đến 9, `CHECKPOINT_OP05.md` phần coder, mục "Kết quả chạy Sepolia" để trống.
- [ ] PR B merge; kiểm khói và kiểm database mới đạt (bước 10, 11).
- [ ] Vòng nghiệp vụ khớp bảng số dư kỳ vọng; Supervisor đọc chuỗi Sepolia xác nhận; PR C chuyển `done`.

## Không làm

- Sửa hợp đồng. Giao diện nạp lợi nhuận cho SPV (về sau). Tất toán (SC-04), Fireblocks (IN-03, IN-04), xác thực ví
  (AU-01), lịch keeper tự động.
- Hiển thị giá một nguồn (FE-07). Xoá hay sửa dữ liệu Neon cũ.
