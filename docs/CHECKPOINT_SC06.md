# Báo cáo bàn giao: SC-06: Vault chia lợi nhuận và nối luồng chia lên EVM (gộp SC-05)

| | |
|---|---|
| Task | SC-06 (gộp SC-05, CH-4) |
| Nhánh | `feat/sc-06-chia-loi-nhuan`, làm từ `dev` @ `725f2c1` (PR #56) song song SC-03; **đã rebase lên `dev` @ `bb02cd6`** (PR #57, SC-03) |
| Spec | `docs/sc-06-chia-loi-nhuan/{requirements,tasks}.md` bản 2.1; DS-01 bản 5 |
| Mức kiểm chứng | Cao |
| Tiến độ | Mã xong; kiểm chứng chạy lại toàn bộ trên nền `bb02cd6` sau rebase; chờ Supervisor nghiệm thu PR |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Hợp đồng theo QĐ-A đến QĐ-C (ca 1 đến 9); bộ cũ theo ngoại lệ (ca 10); đột biến (ca 11) | ✅ | mục 1.1, 2, chi tiết kiểm chứng mục 1, chi tiết đột biến |
| 2 | Cổng, adapter, mock và chuyển đổi mock cũ theo QĐ-D (ca 12, 13); lưu trữ theo QĐ-E | ✅ | mục 1.2, 2, chi tiết kiểm chứng mục 7, 10 |
| 3 | Mở kỳ giữ chỗ và phục hồi (ca 15); đẩy vault đúng một lần (ca 16); chia, đối soát, vòng đời (ca 14, 17, 18); BE-07 theo phần chưa phân bổ (ca 19); mã kỳ theo chain (ca 20) | ✅ | mục 1.3, 2, chi tiết kiểm chứng mục 7, 10 |
| 4 | Triển khai theo QĐ-J; kiểm chứng chung (ca 21) | ✅ | mục 2, chi tiết kiểm chứng mục 1 đến 11 |
| 5 | `tech-report.md` mục chia lợi nhuận; DS-01 bản 5 ghi QĐ-13 cập nhật | ✅ | mục 4 |

**Kết luận:** 5 ✅, 0 🔶, 0 ❌. Đạt trên nền `bb02cd6` (đã gồm SC-03); kết quả trước rebase trên
`725f2c1` cũng đạt. Rebase và xử lý xung đột ở mục 5.

### 0.2 Việc cần Owner quyết/chạy

- Không có việc cần quyết. Việc chạy: Supervisor nghiệm thu PR; khi nghiệm thu chuyển `SC-06` và
  `SC-05` sang `done` trong `.kiro/task-status.json` (mục 3.2).

---

## 1. Kết quả chính

### 1.1 Hợp đồng

`ProfitDistributor` thành quỹ một chiều: `totalReserved`, `unallocatedBalance()`,
`createDistributionFromPool(period)` (nhãn khác rỗng, dùng một lần, lấy đúng phần chưa phân bổ),
`distributionIdOfPeriod`, `closeDistribution(id)` thay `sweepDust` (admin, sau hạn, không chuyển
tiền). `createDistribution` vẫn kéo tiền và cộng dự trữ. Không sửa hợp đồng nào khác.

### 1.2 Cổng, adapter, mock, lưu trữ

`ILedgerDistribution` thêm 7 method, `distributeBatch` nhận `distributionId`; `ILedgerVault` thêm
`closeVaultPeriod`, `findVaultPeriodClose`. Adapter EVM, mock (sổ dự trữ, nhãn, hạn nhận, đóng kỳ,
chuyển đổi trạng thái cũ) và stellar (lỗi "chưa hỗ trợ"). `DistributionPeriod` thêm 6 cột, trạng thái
`OPENING`/`EXPIRED`/`CLOSED`, hồ sơ `EXPIRED`; cổng lưu trữ thêm thao tác giữ chỗ và chuyển trạng
thái có điều kiện ở cả bộ nhớ và Postgres; `ADDED_COLUMNS` cho cơ sở dữ liệu đang chạy.

### 1.3 Nghiệp vụ

`openPeriod`/`recoverOpeningPeriod` (QĐ-F), `syncVaultClose` và `reconcileChainPeriods` (QĐ-G),
`distributePeriod` theo kỳ trên chuỗi với ví SPV, đối soát "đã trả" và vòng đời (QĐ-H), BE-07 theo
`unallocatedProfit` và phát hiện quỹ hụt (QĐ-I), mã kỳ mới bắt buộc `<chain>:` (CH-6). Script
`packages/contracts-evm/scripts/distribution-admin.js` đóng kỳ (dry-run mặc định).

## 2. Ca kiểm chứng và nơi chạy

| Ca | Nơi kiểm |
|---|---|
| 1 đến 9 | `packages/contracts-evm/test/sc-06-chia-loi-nhuan.test.js` (9 ca; ca 6 còn kiểm sau MỌI ca của tệp) |
| 10 | `sc-10-va-hop-dong` ca 1, 2, 4; `full-cycle` "Đóng kỳ"; `spec-p7` P7-22, P7-23 (mục 3.1) |
| 11 | `docs/CHECKPOINT_SC06_MUTATIONS_DETAIL.md`: 11a đến 11g đều đỏ đúng ca, hoàn nguyên sạch |
| 12 | `app/test/sc-06-distribution-evm.test.ts` hai ca đầu (nút thật) |
| 13 | `app/test/sc-06-distribution-mock.test.ts` (7 ca: ca 3, 4, 5 cùng số với EVM; chuyển đổi mock cũ) |
| 14, 15a, 16a đến d, 17, 18, 19 (EVM) | `app/test/sc-06-distribution-evm.test.ts` (nút thật; ca 18 chạy `distribution-admin.js` dry-run rồi gửi) |
| 15a đến d, 17, 18, 19, 20 (mock) | `app/test/sc-06-distribution-flow.test.ts` (13 ca) |
| 21 | chi tiết kiểm chứng mục 1 đến 11 và 13 (bộ mặc định cuối task: 7 PASS, 0 FAIL) |

Số đo chính sau rebase (đầu ra nguyên văn ở chi tiết kiểm chứng): hợp đồng 156 passing (nền
`bb02cd6` 147, +9 ca mới, đổi tên 4 ca cũ); job A 887 đạt, 43 bỏ qua, 6 phần đạt, artifacts phục
hồi; job C 4 PASS, E2E hardhat 16 đạt; `verify-deployment` "BẢN DEPLOY HỢP LỆ" với
`totalReserved = 0` và `OrderSettlement` nối đúng; nút thật chạy từng tệp: `evm-issuance` 13,
`vault` 6, `evm-order-settlement` (SC-03) 10, `sc-06-distribution-evm` 10 đều đạt; Postgres thật
224 đạt cho bốn tệp lưu trữ và luồng, toàn bộ vitest trên Postgres 964 đạt, 36 bỏ qua; không còn
điểm chặn SC-05; quét bí mật sạch. Lần chạy gộp ba tệp nút thật trong một lệnh bị đỏ 2 ca do các
tệp chạy song song trên cùng chuỗi (mục 3.3).

```text
$ git diff --unified=0 bb02cd6 -- packages/contracts-evm/test | grep -E "^\+\s*it\(" | wc -l
13
$ git diff --unified=0 bb02cd6 -- packages/contracts-evm/test | grep -E "^-\s*it\(" | wc -l
4
$ git grep -c "@blocked SC-05" bb02cd6 -- app/src
bb02cd6:app/src/lib/ledger/evm.adapter.ts:1
$ git diff --stat 725f2c1 bb02cd6 -- packages/contracts-evm/contracts/ProfitDistributor.sol packages/contracts-evm/test/sc-06-chia-loi-nhuan.test.js | wc -l
0
```

13 dòng `it(` thêm trừ 4 dòng đổi tên = 9 ca mới; 147 + 9 = 156. SC-03 không sửa
`ProfitDistributor.sol` hay tệp test SC-06, nên kết quả đột biến 11a đến 11g (chạy trước rebase) vẫn
áp dụng nguyên.

## 3. Sai lệch, lựa chọn khi làm và ca cũ phải sửa

### 3.1 Ca cũ đổi theo ngoại lệ hoặc theo ngữ nghĩa mới

| Tệp | Ca | Lý do |
|---|---|---|
| `sc-10-va-hop-dong.test.js` | ca 1, 2, 4 | QĐ-C: `closeDistribution` thay `sweepDust`; khẳng định "tiền tới ví X" thay bằng số dư không đổi, dự trữ giảm, phần chưa phân bổ tăng |
| `full-cycle.test.js` | "Quét phần dư" thành "Đóng kỳ" | như trên; treasury nhận 0 |
| `spec-p7-profit-distribution.test.js` | P7-22, P7-23 | như trên |
| `app/test/distribution-service.test.ts` | mã kỳ có tiền tố `mock:`; ca 5 "ràng buộc duy nhất" nạp thêm quỹ; ca 5 "mã kỳ khác" kỳ 2 lấy 1.000.000 thay 2.000.000 | CH-6; QĐ-A (con số 2.000.000 cũ là đúng lỗi tính trùng) |
| `app/test/distribution-trigger.test.ts` | ca 1 (quỹ 0), ca 2 (regex mã `mock:auto-`), ca 6 viết lại thành "quỹ hụt so với dự trữ", ca thiếu tiền giữa kỳ (khoá vòng `idle#`) | QĐ-I: mốc số dư không còn quyết định |
| `app/test/mock-ledger.test.ts` khối R5, `mock-ledger-state-store.test.ts` | dùng `openDistribution`/`distributionId` | chữ ký `distributeBatch` đổi (gộp SC-05) |

### 3.2 Lựa chọn khi spec để ngỏ hoặc cần thêm để làm được

- QĐ-F "xoá hoặc chuyển lỗi": **chọn xoá** bản giữ chỗ (mã kỳ dùng lại được, audit đã ghi).
- Thêm `LedgerError.reverted` để phân biệt "chắc chắn revert" với lỗi chưa xác định (QĐ-F cần), và
  `ChainDistribution.expired` đọc **đồng hồ chuỗi** (Hardhat tua được thời gian; giờ máy chủ sai).
- Cổng lưu trữ thêm `reservePeriod`, `setOpenTxHash`, `completeOpening`, `deleteOpeningPeriod`,
  `reserveVaultClose`, `transitionVaultClose`; `store-constraints.test.ts` thêm 3 ca chạy cả bộ nhớ
  và Postgres thật cho giữ chỗ đồng thời (nền của ca 15c, 16b). Ca thứ tự vault dùng chain `stellar`
  và dọn về `DONE` vì Postgres kiểm thử không xoá dữ liệu giữa các lần chạy.
- BE-07 bỏ phép kiểm "quỹ đủ cho kỳ dở" riêng (`owedOf`): phép "quỹ không hụt so với tổng dự trữ"
  bao mọi kỳ cùng lúc. `periodKeySchema` nới tới 64 ký tự và cho dấu `:`.
- Ca 7 thêm đếm năm loại bước để chắc chuỗi ngẫu nhiên đi qua đủ mô hình (không thêm ca).
- `distribution-admin.js` nhận tham số qua biến môi trường như `vault-admin.js`.
- Giới hạn còn lại (ghi ở tech-report 3.24): kỳ vault `SENT` chưa có mã giao dịch có thể bị hai tiến
  trình gửi lại, hợp đồng chặn lần hai bằng `InvalidPeriodRef`; danh sách người nhận có thể sót ví
  nhận WPT bằng chuyển trực tiếp (chờ IN-01).
- `task-status.json`: `SC-06` ở `inProgress`; `SC-05` giữ ở `planned` kèm ghi chú `_mergedTasks` để
  chuyển `done` cùng SC-06 khi nghiệm thu (không tự chuyển `done` trước nghiệm thu).

### 3.3 Môi trường sandbox

`binaries.soliditylang.org` bị chặn nên mọi lệnh Hardhat chạy với `USE_LOCAL_SOLC=1` (đường repo đã
dựng sẵn); Playwright cần liên kết `chromium_headless_shell-1243` sang bản 1194 như ghi chú bàn giao.
Lần chạy job C đầu đỏ vì thiếu trình duyệt, lần job A thứ hai đỏ vì sơ đồ `distribute` lệch số dòng
sau một lần sửa mã; đã sinh lại và chạy lại toàn bộ, kết quả trong chi tiết kiểm chứng là lần cuối.

Sau rebase, lần đầu chạy `sc-06-distribution-evm`, `vault` và `evm-order-settlement` trong MỘT lệnh
vitest bị đỏ 2 ca: vitest chạy các tệp song song trên cùng nút, ca SC-06 chuyển 600 WPT cho đúng ví
nhà đầu tư mà ca SC-03 đang đo (660 thay 60) và chia VNDB vào vault giữa lúc ca vault đo (10.000.000
thay 0). Checkpoint SC-03 và SC-07 đều chạy từng tệp một lệnh; chạy lại như vậy trên chuỗi dựng mới
thì cả bốn tệp đạt (chi tiết kiểm chứng mục 7 đến 7f, giữ cả lần đỏ). Các tệp test nút thật chia sẻ
trạng thái chuỗi nên phải chạy lần lượt.

## 4. Tài liệu

`docs/tech-report.md` bản 4.18 (SC-03 là 4.17): đầu trang, đoạn tóm tắt SC-06, bảng cổng 3.1 (44 method gồm cả SC-03, số dòng tệp ledger cập nhật sau rebase), hợp đồng
3.8, tham số 3.13 (mốc chỉ còn hiển thị), BE-07 3.14, **mục mới 3.24**, luồng 4.5, nợ P1, lộ trình
P3; mục điểm cắm và sơ đồ `distribute`, `purchase` sinh lại bằng công cụ. `docs/ds-01-kien-truc-hop-dong/design.md`
bản 5 (mục 10, QĐ-27 đến QĐ-31, QĐ-13 cập nhật). `packages/contracts-evm/README.md`: bảng hợp đồng,
số ca 156, cách dùng `distribution-admin.js`, cảnh báo không dùng `vault-admin.js close-period` khi
luồng tự động chạy.

## 5. Phối hợp với SC-03 (đã rebase)

SC-03 merge vào `dev` ở `bb02cd6` (PR #57). Nhánh rebase lên đó; xung đột thực tế và cách xử lý:

| Tệp | Xung đột thực tế | Cách xử lý |
|---|---|---|
| `ledger.port.ts`, `stellar.adapter.ts`, `ledger/index.ts`, `verify-deployment.js` | không | tự gộp |
| `evm.adapter.ts` | khối import ABI | giữ cả hai: `orderRefFromOrderId, orderSettlementAbi, profitDistributorAbi` |
| `mock.adapter.ts`, `mock-state.store.ts` | không (tự gộp) | trường lệnh đã quyết toán của SC-03 và `distributionLedger` của SC-06 cùng tồn tại; ca chuyển đổi mock cũ (ca 13) và `mock-ledger-state-store` đạt |
| `packages/contracts-evm/README.md` | bảng hợp đồng, số ca | giữ cả hai dòng; số ca 156 khớp `npx hardhat test` |
| `docs/flows/purchase.md`, mục điểm cắm tech-report | có (tệp sinh) | sinh lại bằng `gen-flow-diagram.mjs` và `scan-pending.mjs --write-report`; `--check` đạt |
| `docs/tech-report.md` | đầu trang, nợ P1, bảng 3.1, lộ trình P3 | gộp tay, bản 4.18 |

Sau rebase đã chạy lại toàn bộ mục 2 (gồm job C với hợp đồng thứ chín `OrderSettlement` và test nút
thật của SC-03); kết quả ở chi tiết kiểm chứng.
