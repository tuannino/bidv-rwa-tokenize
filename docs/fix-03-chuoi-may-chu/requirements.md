# FIX-03: chuẩn hoá các chuỗi hiển thị trong `lib/` theo danh sách

| | |
|---|---|
| Nhánh | `fix/fix-03-chuoi-may-chu` từ `dev` mới nhất (sau khi Sếp merge PR #79, UIUX-02) |
| Loại | CHỈ đổi chữ hiển thị và một hằng số mẫu trong `lib/`, không đổi hành vi. Phần lớn là chuỗi máy chủ dựng; riêng `lib/format.ts` dùng chung máy chủ và trình duyệt, `lib/hooks/use-native-balance.ts` và `lib/wagmi.ts` chạy ở trình duyệt. Sếp đã duyệt theo báo cáo `20261102_bao_cao_BE_UX.md` (Project) |
| Một PR | Không push lên `dev`, không merge |
| Chạy song song | Mã nguồn tách biệt với UIUX-02 (đầu màn: ô chọn token, bỏ dòng mô tả, gợi ý trên menu), nhưng cả hai cùng sửa `docs/USER_GUIDE.md` và `.kiro/task-status.json`. Trước khi mở PR, cập nhật từ `dev` mới nhất; xung đột ở hai tệp này thì giữ đủ nội dung của cả hai task |

## 1. Mục tiêu

Các chuỗi trong `lib/` (trừ `lib/store`) mà người dùng nhìn thấy, theo đúng danh sách ở mục 3 (câu lỗi, câu từ chối, dòng sổ kiểm toán, ký hiệu ô trống) không còn gạch dài, chấm giữa, mũi tên, mũi tên ASCII (dấu trừ và dấu lớn hơn); số trong câu có dấu chấm hàng nghìn; đơn vị giá là VNDB. Gồm BE-UX-1 (chuỗi máy chủ còn ký tự cấm, số không dấu nghìn), BE-UX-2 (câu giá in số thô, đơn vị VND), BE-UX-3 (số mẫu lợi tức đã chia phi lý).

**Không đổi nghĩa câu, không đổi hành vi.** Chỉ đổi đúng các chuỗi ở mục 3.

## 2. Quyết định (Sếp chốt 02/11)

- **QĐ-1.** Ký hiệu ô trống của `formatAmount`, `formatDateTime` (`lib/format.ts:15, 39`) đổi từ gạch dài thành gạch ngắn `–` (U+2013).
- **QĐ-2.** Lợi tức đã chia mẫu: `MOCK_WIND_STATS.profitDistributedVndBn` (`lib/mock-data.ts:165`) đổi từ `86.4` thành `5.8` (6 kỳ giữ nguyên). Cách tính: lợi tức mục tiêu 5,8%/năm trên vốn 33,5 tỷ (335.000 WPT x 100.000), 6 kỳ nửa năm.
- **QĐ-3.** Đơn vị giá trong câu do máy chủ dựng là `VNDB` (màn đang dùng VNDB). Tên trường trong mã (`priceVnd`, `issuePriceVnd`...) GIỮ NGUYÊN.
- **QĐ-4.** Số trong câu ở mục 3.2 định dạng bằng `formatAmount` có sẵn (`lib/format.ts`, đã dùng trong `lib/bank`, ví dụ `token-request.service.ts:181`).
- **QĐ-5.** Mã định danh trong câu (mã lệnh, mã giao dịch, mã kỳ, mã yêu cầu) GIỮ NGUYÊN: `trade.service.ts:487` tìm dòng sổ theo mã lệnh (`entry.detail?.includes(orderId)`). Câu #28 GIỮ tiền tố `Tổng cung WPT`: `distribution.service.ts:461-462` rẽ nhánh bằng `/Tổng cung WPT/.test(error.message)`.
- **QĐ-6.** Không đổi: chuỗi lỗi lập trình ở `lib/store/*`; chú thích; mã trạng thái, tên vai lưu trong database; khoá cấu hình; dòng sổ kiểm toán CŨ đã ghi (giữ chữ cũ, dòng mới theo chữ mới).
- **QĐ-7.** Chữ cứng gạch dài nằm trong component giao diện (`components/**`, ví dụ ô trống ở `approval-detail.tsx:294-300`, câu Nạp VNDB ở `demo-payment.tsx:87`) KHÔNG thuộc task này; xử lý ở đợt làm mới giao diện. Trong thời gian chờ, màn có thể có cả `–` (từ `formatAmount`) lẫn `[gạch dài]` (chữ cứng): chấp nhận.

## 3. Danh sách chuỗi (số dòng theo `dev` @ `67ece1e`)

Ký hiệu `fa(x)` là `formatAmount(x)`. Cột "Mới" là nguyên văn phải viết (giữ nguyên phần `${...}` như cũ, trừ chỗ ghi `fa`).

### 3.1. Ký tự cấm

| # | Tệp:dòng | Cũ (phần đổi) | Mới |
|---|---|---|---|
| 1 | `lib/bank/distribution-trigger.service.ts:758` | `...KHÔNG chia gì [gạch dài] hai ` | `...KHÔNG chia gì; hai ` |
| 2 | `lib/bank/distribution.service.ts:1205` | `...lúc ${period.completedAt} [gạch dài] không còn hồ sơ nào ` | `...lúc ${period.completedAt}; không còn hồ sơ nào ` |
| 3 | `lib/bank/issuance.service.ts:526` | `...vào bảng dự án [gạch dài] dòng đã bị đổi...` | `...vào bảng dự án; dòng đã bị đổi...` |
| 4 | `lib/bank/purchase.service.ts:278` | `...trước khi tạo bản ghi [gạch dài] ${reason}` | `...trước khi tạo bản ghi: ${reason}` |
| 5 | `lib/bank/purchase.service.ts:871` | `Chưa phát hành nguồn cung ban đầu [gạch dài] không có WPT nào để bán.` | `Chưa phát hành nguồn cung ban đầu, không có WPT nào để bán.` |
| 6 | `lib/bank/purchase.service.ts:961` | `Chưa phát hành nguồn cung ban đầu [gạch dài] chưa có ví thanh toán...` | `Chưa phát hành nguồn cung ban đầu, chưa có ví thanh toán...` |
| 7 | `lib/bank/purchase.service.ts:1097` | `${...} [gạch dài] lệnh ${order.id}: ${detail}` | `${...}, lệnh ${order.id}: ${detail}` |
| 8 | `lib/bank/purchase.service.ts:1234` | `bị từ chối trước khi gửi tx [gạch dài] ${check.reason}` | `bị từ chối trước khi gửi tx: ${check.reason}` |
| 9 | `lib/bank/purchase.service.ts:1334` | `đối soát tx ${txHash} ${receipt.status} [gạch dài] ${reason}` | `đối soát tx ${txHash} ${receipt.status}: ${reason}` |
| 10 | `lib/bank/purchase.service.ts:1410` | `đối soát từ chuỗi sau lỗi cục bộ [gạch dài] ${failure.reason}` | `đối soát từ chuỗi sau lỗi cục bộ: ${failure.reason}` |
| 11 | `lib/bank/purchase.service.ts:1630` | `gửi giao dịch thất bại [gạch dài] ${reason}` | `gửi giao dịch thất bại: ${reason}` |
| 12 | `lib/bank/purchase.service.ts:1699` | `tx ${receipt.txHash} ${receipt.status} [gạch dài] ${reason}` | `tx ${receipt.txHash} ${receipt.status}: ${reason}` |
| 13 | `lib/bank/purchase.state.ts:124` | `${from} là trạng thái kết thúc [gạch dài] muốn mua tiếp...` | `${from} là trạng thái kết thúc; muốn mua tiếp...` |
| 14 | `lib/bank/token-request.service.ts:352` | `...bị chặn [gạch dài] ${describeFailed(checks)}` | `...bị chặn: ${describeFailed(checks)}` |
| 15 | `lib/bank/token-request.service.ts:418` | `...do chính mình lập [gạch dài] bị chặn.` | `...do chính mình lập, bị chặn.` |
| 16 | `lib/bank/token-request.service.ts:474` | `...vì điều kiện đã đổi [gạch dài] ${describeFailed(checks)}` | `...vì điều kiện đã đổi: ${describeFailed(checks)}` |
| 17 | `lib/bank/token-request.service.ts:1566` | `...chưa biết kết cục [gạch dài] cần đối soát.` | `...chưa biết kết cục, cần đối soát.` |
| 18 | `lib/bank/vault-config.ts:137` | `số khoá cố định ${step.previous} [mũi tên ASCII] ${step.amount} VNDB` | `số khoá cố định ${fa(step.previous)} thành ${fa(step.amount)} VNDB` |
| 19 | `lib/bank/vault-config.ts:139` | `tỷ lệ khoá ${...}% [mũi tên ASCII] ${...}%` | `tỷ lệ khoá ${...}% thành ${...}%` |
| 20 | `lib/bank/vault-config.ts:141` | `chế độ khoá ${step.previous} [mũi tên ASCII] ${step.mode}` | `chế độ khoá ${step.previous} thành ${step.mode}` |
| 21 | `lib/config/flags.ts:70` | `Chưa hiện thực (adapter stub) [gạch dài] để Phase 7.` | `Chưa hiện thực (adapter stub), để Phase 7.` |
| 22 | `lib/config/flags.ts:73` | `Thiếu RPC [gạch dài] đặt NEXT_PUBLIC_RPC_HARDHAT.` | `Thiếu RPC, đặt NEXT_PUBLIC_RPC_HARDHAT.` |
| 23 | `lib/config/flags.ts:76` | `Thiếu RPC testnet [gạch dài] đặt NEXT_PUBLIC_RPC_EVM (Phase 6).` | `Thiếu RPC testnet, đặt NEXT_PUBLIC_RPC_EVM (Phase 6).` |
| 24 | `lib/format.ts:15` | `'[gạch dài]'` | `'–'` (QĐ-1) |
| 25 | `lib/format.ts:39` | `'[gạch dài]'` | `'–'` (QĐ-1) |
| 26 | `lib/hooks/use-native-balance.ts:39` | `Chưa đọc được số dư [gạch dài] có thể node...` | `Chưa đọc được số dư, có thể node...` |
| 27 | `lib/ledger/address.ts:34` | `Checksum EIP-55 không khớp [gạch dài] thường là...` | `Checksum EIP-55 không khớp, thường là...` |
| 28 | `lib/ledger/evm.adapter.ts:123` | `...tại thời điểm chốt bằng 0 [gạch dài] không có quyền để chia.` | `...tại thời điểm chốt bằng 0, không có quyền để chia.` |
| 29 | `lib/ledger/evm.adapter.ts:135` | `Chuyển VNDB thất bại [gạch dài] thường là...` | `Chuyển VNDB thất bại, thường là...` |
| 30 | `lib/ledger/evm.adapter.ts:147` | `...của ví nhà đầu tư không đủ [gạch dài] chủ ví phải...` | `...của ví nhà đầu tư không đủ; chủ ví phải...` |
| 31 | `lib/ledger/mock.adapter.ts:323` | `Chưa chốt quyền lần nào [gạch dài] gọi takeSnapshot() trước.` | `Chưa chốt quyền lần nào, gọi takeSnapshot() trước.` |
| 32 | `lib/ledger/mock.adapter.ts:663` | `Chưa phát hành nguồn cung ban đầu [gạch dài] không có WPT...` | `Chưa phát hành nguồn cung ban đầu, không có WPT...` |
| 33 | `lib/ledger/mock.adapter.ts:720` | `Chưa phát hành nguồn cung ban đầu [gạch dài] chưa có ví...` | `Chưa phát hành nguồn cung ban đầu, chưa có ví...` |
| 34 | `lib/ledger/mock.adapter.ts:854` | `Danh sách ví trống [gạch dài] tầng nghiệp vụ...` | `Danh sách ví trống; tầng nghiệp vụ...` |
| 35 | `lib/mock-data.ts:25` | `Trên bờ [chấm giữa] Cao nguyên` | `Trên bờ, Cao nguyên` |
| 36 | `lib/mock-data.ts:26` | `Trên bờ [chấm giữa] Ven biển` | `Trên bờ, Ven biển` |
| 37 | `lib/rbac/demo-payment.ts:62` | `...(ENABLE_DEMO_TOKEN_MINT=false) [gạch dài] chức năng chỉ dành cho ` | `...(ENABLE_DEMO_TOKEN_MINT=false), chức năng chỉ dành cho ` |
| 38 | `lib/wagmi.ts:47` | `BIDV RWA [gạch dài] Điện gió` | `BIDV RWA Điện gió` |

### 3.2. Số không dấu nghìn, đơn vị VND

| # | Tệp:dòng | Mới |
|---|---|---|
| 39 | `lib/bank/config.service.ts:61` | `'Giá phải là số nguyên không dấu, đơn vị VNDB.'` |
| 40 | `lib/bank/config.service.ts:230-231` | `` `Giá mới ${fa(priceVnd)} VNDB lệch quá ${threshold} lần so với giá đang có hiệu lực ` + `${fa(previous)} VNDB. Kiểm lại số chữ số; nếu đúng ý thì gửi lại kèm xác nhận đổi giá lớn.` `` |
| 41 | `lib/bank/config.service.ts:250` | `` `Đổi giá ${fa(previous)} thành ${fa(priceVnd)} VNDB: đã gửi, chưa có xác nhận; tx ${tx.txHash}` `` |
| 42 | `lib/bank/config.service.ts:251` | `` `Đổi giá ${fa(previous)} thành ${fa(priceVnd)} VNDB bị chuỗi từ chối; tx ${tx.txHash}` `` (giữ phần nối phía sau như cũ) |
| 43 | `lib/bank/config.service.ts:325` | `` `Giá phát hành ${fa(previous)} thành ${fa(priceVnd)} VNDB; tx ${tx.txHash}; lý do: ${reason}` `` |
| 44 | `lib/bank/distribution-approval.service.ts:259-260` | `` `Kỳ "${period.periodKey}" lấy ${fa(period.totalAmount)} VNDB trên chuỗi, khác số đã duyệt ` + `${fa(period.expectedAmount)} VNDB (tiền vào quỹ...` `` (phần sau giữ nguyên) |
| 45 | `lib/bank/distribution-approval.service.ts:321` | `` `Phần chưa phân bổ ${fa(expected)} VNDB dưới ngưỡng ${fa(threshold)} VNDB (distribution.min_new_balance).` `` |
| 46 | `lib/bank/distribution-approval.service.ts:562` | `` `Số trên chuỗi ${fa(period.totalAmount)} VNDB khác số đã duyệt ${fa(period.expectedAmount)} VNDB. Không chia cho tới khi duyệt lại số thực tế.` `` |

### 3.3. Hằng số mẫu

| # | Tệp:dòng | Mới |
|---|---|---|
| 47 | `lib/mock-data.ts:165` | `profitDistributedVndBn: 5.8,` (QĐ-2) |

### 3.4. Cùng loại với 3.2, trong cùng ba tệp (số thô, đơn vị VND)

Để một màn không lẫn số có dấu nghìn với số thô. Giữ nguyên câu, chỉ bọc `fa` quanh số và đổi `VND` thành `VNDB`:

| # | Tệp:dòng | Đổi |
|---|---|---|
| 48 | `lib/bank/config.service.ts:287` | `${previous} VND` thành `${fa(previous)} VNDB` |
| 49 | `lib/bank/config.service.ts:293` | `${previous} VND` thành `${fa(previous)} VNDB` |
| 50 | `lib/bank/config.service.ts:295` | `${priceVnd} VND`, `${previous} VND` thành `${fa(priceVnd)} VNDB`, `${fa(previous)} VNDB` |
| 51 | `lib/bank/config.service.ts:299-300` | `${priceVnd} VND`, `${previous} VND` thành `${fa(priceVnd)} VNDB`, `${fa(previous)} VNDB` |
| 52 | `lib/bank/distribution-approval.service.ts:311-312` | `${expected}`, `${unallocated}` thành `${fa(expected)}`, `${fa(unallocated)}` |
| 53 | `lib/bank/distribution-approval.service.ts:377` | `${expected}` thành `${fa(expected)}` |
| 54 | `lib/bank/distribution-approval.service.ts:445-446` | `${onChain}`, `${found.totalAmount}`, `${amount}` thành bọc `fa` |
| 55 | `lib/bank/distribution-approval.service.ts:466-467` | `${amount}`, `${found.expectedAmount}` thành bọc `fa` |
| 56 | `lib/bank/distribution-approval.service.ts:512` | `${period.totalAmount}` thành `${fa(period.totalAmount)}` |
| 57 | `lib/bank/distribution-approval.service.ts:569` | `${period.totalAmount}` thành `${fa(period.totalAmount)}` |
| 58 | `lib/bank/distribution-approval.service.ts:673` | `${unallocated}`, `${threshold}` thành bọc `fa` |
| 59 | `lib/bank/purchase.service.ts:374-375` | `${wptAmount}`, `${vndAmount}` thành bọc `fa` (mã lệnh giữ nguyên) |

Số thô ở các tệp khác của `lib/` ngoài ba tệp trên: KHÔNG thuộc task này (ghi vào checkpoint các chỗ thấy được để xử lý sau).

## 4. Phạm vi tệp

Được sửa: đúng các tệp ở mục 3, gồm thêm dòng import `formatAmount` ở tệp chưa có (`vault-config.ts`, `config.service.ts`, `distribution-approval.service.ts`); các tệp `docs/flows/*.md` mà `test/pending-markers.test.ts` báo lạc hậu (do dòng import làm lệch số dòng của marker `@flow`), sinh lại bằng `node scripts/gen-flow-diagram.mjs <tên luồng>`, không sửa tay. Danh sách tệp ở mục 3: `lib/bank/{config,distribution-approval,distribution-trigger,distribution,issuance,purchase,token-request}.service.ts`, `lib/bank/purchase.state.ts`, `lib/bank/vault-config.ts`, `lib/config/flags.ts`, `lib/format.ts`, `lib/hooks/use-native-balance.ts`, `lib/ledger/{address,evm.adapter,mock.adapter}.ts`, `lib/mock-data.ts`, `lib/rbac/demo-payment.ts`, `lib/wagmi.ts`; các tệp test có chuỗi mong đợi bị đổi (mục 5); tài liệu (mục 6).

Không được sửa: mọi dòng khác trong các tệp trên; `lib/store/**`; `app/src/components/**`; `app/src/app/**`; `app/prisma/**`; `packages/**`; `scripts/**`; `app/wrangler.json`; `.env*`. Lệnh kiểm ở tasks bước 5.

## 5. Kiểm thử

- Test có sẵn đang so khớp chuỗi cũ: chỉ đổi chuỗi mong đợi cho khớp chữ mới, KHÔNG nới điều kiện (không đổi `toBe` thành `toContain` rộng hơn, không bỏ ca). Lượt rà độc lập đã áp thử 47 thay đổi đầu (mục 3.1 tới 3.3) trên bản sao `dev` và chạy vitest bản bộ nhớ: chỉ các chỗ sau đỏ, dev chạy đủ bộ (gồm Postgres, EVM, e2e) để tìm thêm nếu có:
  - `test/maker-checker-ui.test.ts:120, 127` (ký hiệu ô trống);
  - `test/config-service.test.ts:461, 462` (`toContain('120000')` gặp "100.000 thành 120.000");
  - `test/be-13-vault-config.test.ts:232, 233`;
  - `test/pending-markers.test.ts` (sinh lại `docs/flows`, xem mục 4).
- `e2e/maker-checker.spec.ts:142` (`not.toContainText('[gạch dài]')` trên ô "Đang chờ duyệt"): ô này dùng chữ cứng `[gạch dài]` của `stat-card.tsx:10` (component, không đổi), nên bài vẫn đúng nghĩa, KHÔNG sửa.
- Vitest mới `app/test/fix-03-chuoi-may-chu.test.ts`:

| Ca | Nội dung |
|---|---|
| 1 | Quét mọi tệp `.ts`, `.tsx` trong `app/src/lib` trừ `lib/store/**` bằng `typescript.createSourceFile` (chuỗi thường, template, và từng phần chữ của template lồng; chú thích tự bị bỏ): không chuỗi nào chứa gạch dài, chấm giữa, ký tự mũi tên hoặc mũi tên ASCII. Cách làm mẫu ở tasks bước 5; trên `dev` hiện tại cách quét này ra đúng 41 chỗ, sau task phải ra 0 |
| 2 | `formatAmount(null)`, `formatAmount('')`, `formatDateTime(null)` trả `–`; `formatAmount(1500000000n)` trả `1.500.000.000` |
| 3 | `describeVaultConfigStep` với `setFixedLock` từ 0 lên 1500000000: `số khoá cố định 0 thành 1.500.000.000 VNDB`; `setPercentRate`, `setLockMode` dùng chữ "thành" |
| 4 | `config.service`: đặt giá lệch quá ngưỡng (theo ca có sẵn `test/config-service.test.ts:201`) thì câu lỗi có số dấu chấm hàng nghìn, có "VNDB" và `not.toMatch(/\bVND\b(?!B)/)` (bắt cả chữ VND đứng trước dấu chấm) |
| 5 | Câu "dưới ngưỡng" của `distribution-approval` (cả #45 và #58) có số dấu chấm hàng nghìn (dựng theo ca có sẵn `test/fe-08-approval.test.ts:334`) |
| 6 | `MOCK_WIND_STATS.profitDistributedVndBn === 5.8`, `REGION_LABELS` không có chấm giữa |
| 7 | Dòng sổ can thiệp tay (#7): lọc dòng sổ có `action === 'order:intervene'` của lệnh vừa can thiệp (dựng theo ca có sẵn `test/purchase-service.test.ts:1352`), dòng đó chứa nguyên mã lệnh và bắt đầu bằng "can thiệp tay, lệnh "; `getOrderDetail` (cách gọi như `test/investor-trading.test.ts:292`) trả cả dòng đó |

## 6. Tài liệu

- `docs/CHECKPOINT_FIX03.md`: ghi "Phạm vi: chuẩn hoá các chuỗi hiển thị trong `lib/` theo danh sách (gồm `lib/format.ts` dùng chung máy chủ và trình duyệt, `use-native-balance.ts`, `wagmi.ts` phía trình duyệt), không đổi hành vi"; bảng 59 dòng cũ và mới thực tế; danh sách test đã đổi chuỗi mong đợi (tệp:dòng, cũ, mới); kết quả kiểm; đột biến.
- `docs/USER_GUIDE.md`: một dòng ghi ô trống hiển thị `–`.
- `.kiro/task-status.json`.

## 7. Đột biến bắt buộc (ghi ca đỏ)

1. Giữ một gạch dài bất kỳ ở `lib/bank` (thử #14).
2. `formatAmount(null)` vẫn trả `[gạch dài]`.
3. Bỏ `fa` ở #18.
4. Đơn vị ở #40 còn `VND`.
5. Bỏ mã lệnh khỏi dòng sổ #7.
6. `profitDistributedVndBn` còn `86.4`.
7. Bỏ `fa` ở #58 (câu "dưới ngưỡng" của màn tổng quan chia lợi nhuận).

## 8. Điều kiện hoàn thành

- [ ] Đủ 59 thay đổi ở mục 3, đúng nguyên văn; không dòng nào khác trong `lib/` đổi (`git diff` chỉ các dòng ở mục 3 và dòng import `formatAmount`); `docs/flows` chỉ đổi do sinh lại bằng script.
- [ ] Ca 1 (quét) xanh; lệnh kiểm tệp cấm rỗng.
- [ ] Typecheck, lint, vitest (cả Postgres), e2e mock và hardhat xanh; test cũ chỉ đổi chuỗi mong đợi, không nới; 7 đột biến bị bắt.
- [ ] Số lời gọi server action khi mở màn không đổi (task không đụng giao diện; ghi một dòng xác nhận).
- [ ] Checkpoint, UserGuide, task-status.
