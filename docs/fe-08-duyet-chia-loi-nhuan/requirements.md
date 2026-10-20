# FE-08: Kiểm soát viên duyệt con số kỳ rồi hệ thống mới chia lợi nhuận

| | |
|---|---|
| Nhánh | `feat/fe-08-duyet-chia` từ `dev` **sau khi BE-13 merge** (cần vault mock để mọi chain dùng cùng luồng) |
| Điểm | 8 (màn hình và API đọc phân trang 2; duyệt, duyệt lại, chốt cứng vault trước khi trả 3; một kỳ hoạt động mỗi chain, keeper chỉ tiếp tục kỳ đã duyệt 2; RBAC, tài liệu, kiểm thử chung 1) |
| Mức kiểm chứng | **Cao** (chuyển VNDB cho người nắm giữ) |
| Trạng thái spec | **Bản 2.1, ngày 21/10/2026**: chủ dự án đã chốt CH-1 đến CH-3 theo bản 2; kiểm lại hiện trạng trên nhánh BE-13 @ `32ef6e9`; thêm việc kèm sửa ngưỡng thời gian SC-06 ca 18. Bản 2 đã nhận góp ý Codex (mục cuối) |
| Thứ tự | Sau BE-13. Trước OP-05 |
| Căn cứ | Chủ dự án chốt 20/10 (OP-05 CH-5): Kiểm soát viên duyệt con số chốt của kỳ, bấm duyệt thì chia; API keeper giữ để tự động hoá về sau. SC-06 (QĐ-F đến QĐ-I); DS-01 QĐ-13 bản 5, QĐ-14. Không sửa hợp đồng |

## Mục tiêu

1. **Không đồng VNDB nào rời quỹ chia khi chưa có Kiểm soát viên duyệt đúng số đó**, dù gọi từ màn hình, server action
   hay API keeper.
2. Không trả tiền khi kỳ vault chưa chốt xong (phần khoá của Người bán luôn đồng bộ với số đã chia).
3. Màn `/distribution` hiện quỹ, dự kiến, kỳ đang chạy, lịch sử ai duyệt bao nhiêu, danh sách trả theo từng ví.

## Hiện trạng đã đo (Supervisor, nhánh BE-13 @ `32ef6e9`, ngày 21/10; đo lại trên `dev` sau khi BE-13 merge)

```bash
grep -n "export async function" app/src/app/actions/distribution.ts
# openPeriodAction, previewDistributionAction, distributePeriodAction, getDistributionPeriodAction,
# runDistributionCycleAction, listDistributionRunsAction: đều gọi được từ trình duyệt
sed -n 905,910p app/src/lib/ledger/mock.adapter.ts
# sau BE-13: mock có vault (vaultStatus không còn null), RBAC đã đóng với vai lạ
grep -n "distribution:snapshot\|distribution:execute" app/src/lib/rbac/permissions.ts
# chỉ TELLER; previewDistribution assertCan('distribution:execute') nên Kiểm soát viên không gọi được
sed -n 440,462p app/src/lib/bank/distribution.service.ts
# finishOpening gọi syncVaultClose trong try/catch, lỗi vẫn đi tiếp; đường trả tiền không kiểm vaultCloseStatus
grep -n "@@unique(\[jobName, periodKey\])" app/prisma/schema.prisma
# KeeperRun duy nhất theo (jobName, periodKey), KHÔNG theo chain
sed -n 279,281p app/src/lib/bank/distribution-trigger.service.ts
# mã kỳ tự sinh theo ngày UTC: hai tiến trình qua ranh giới ngày sinh hai mã khác nhau
grep -n "export async function getDistributionPeriod" -A40 app/src/lib/bank/distribution.service.ts | grep -n "outstanding"
# chỉ trả số đếm và tổng, không trả danh sách hồ sơ chia
sed -n 104,110p app/src/app/api/keeper/distribution/route.ts
# keeper gọi runDistributionCycle: tự phát hiện tiền mới, tự mở kỳ, tự chia
grep -n "function createDistributionFromPool" -A10 packages/contracts-evm/contracts/ProfitDistributor.sol
# hợp đồng mở kỳ bằng TOÀN BỘ phần chưa phân bổ lúc thực thi; không nhận số tiền
```

## Quyết định thiết kế

### QĐ-A. Quyền và đường gọi

- Quyền mới `distribution:approve`, chỉ `CONTROLLER`.
- Server action cho người: `approveDistributionAction`, `reapproveDistributionAction`, `continueDistributionAction`
  (`distribution:approve`); đọc: `getDistributionOverviewAction`, `listDistributionPeriodsAction`,
  `listDistributionPayoutsAction`, `listDistributionRunsAction` (hai vai vận hành, quyền đọc sẵn có như
  `reconcile:read`).
- **Gỡ khỏi `actions/distribution.ts`**: `openPeriodAction`, `distributePeriodAction`, `runDistributionCycleAction`,
  `previewDistributionAction`. Service giữ cho keeper và kiểm thử.
- Lõi vòng chia nhận vai và người thao tác đã kiểm làm tham số (tách khỏi bước `authorize`).
- Mọi bản ghi duyệt lưu **mã người** (`currentActorId()`), không chỉ vai.

### QĐ-B. Duyệt lưu bền trên kỳ

`DistributionPeriod` thêm cột (có trong `schema.prisma`, `init.sql`, `ADDED_COLUMNS`, `schemaObjectsReady`, hai cổng lưu
trữ):

| Cột | Ý nghĩa |
|---|---|
| `approvalStatus` | `APPROVED`, `AMOUNT_CHANGED`; `null` với kỳ trước FE-08 |
| `expectedAmount` | Số Kiểm soát viên duyệt lần đầu |
| `approvedAmount` | Số được duyệt có hiệu lực (sau duyệt lại thì bằng số trên chuỗi) |
| `approvedBy`, `approvedAt` | Người và thời điểm của lần duyệt có hiệu lực |
| `reapprovedFrom` | Số cũ nếu từng phải duyệt lại; `null` nếu không |
| `activeChain` | `String?` duy nhất: bằng `chain` khi `OPENING`, `OPEN`, `DISTRIBUTING`; `null` khi `COMPLETED`, `EXPIRED`, `CLOSED`. Mọi chuyển sang trạng thái cuối đặt `null` trong cùng câu cập nhật |

`activeChain` là trọng tài **mỗi chain tối đa một kỳ hoạt động** giữa Kiểm soát viên, keeper và nhiều Worker, kể cả khi
hai bên sinh hai mã kỳ khác nhau. Ánh xạ lỗi trùng trong `store.errors.ts`.

`KeeperRun` thêm `triggerSource`: `MANUAL` (Kiểm soát viên) hoặc `KEEPER`.

### QĐ-C. Duyệt chia

`approveDistribution({ chain, expectedAmount })`:

1. `authorize('distribution:approve')`; audit cả bốn kết cục, ghi mã người.
2. Chain phải có vault (sau BE-13: mock, `hardhat-local`, `evm`); chain khác báo "không hỗ trợ luồng chia đã duyệt",
   không gửi gì.
3. Đọc `unallocatedProfit()`; khác `expectedAmount` thì từ chối "số trong quỹ đã đổi, xem lại rồi duyệt"; dưới ngưỡng
   thì từ chối. Không gửi giao dịch.
4. Giữ chỗ kỳ `OPENING` với `activeChain = chain` (trùng thì từ chối "đang có kỳ hoạt động"), `expectedAmount`, người
   duyệt; mở kỳ trên chuỗi theo đúng đường SC-06; đọc số thực tế `actual = distributions(id).amount`.
5. `actual == expectedAmount`: `approvalStatus = APPROVED`, `approvedAmount = actual`, rồi sang QĐ-D.
6. `actual != expectedAmount` (tiền vào quỹ giữa bước 3 và lúc thực thi): `approvalStatus = AMOUNT_CHANGED`, kỳ ở
   `OPEN`, **không** chốt vault, **không** gửi lô nào. Màn hiện cả hai số và nút "Duyệt lại số thực tế".

`reapproveDistribution({ chain, periodId, amount })`: `distribution:approve`; kỳ phải `AMOUNT_CHANGED` và `amount`
bằng đúng số trên chuỗi; ghi `reapprovedFrom`, `approvedAmount`, người, thời điểm, `approvalStatus = APPROVED`; rồi sang
QĐ-D.

`continueDistribution({ chain, periodId })`: `distribution:approve`; kỳ hoạt động đã `APPROVED`; chạy QĐ-D. Kỳ
`OPENING` thì phục hồi `recoverOpeningPeriod` trước (giữ nguyên dữ liệu duyệt).

Kỳ hoạt động có `approvalStatus = null` (tạo trước FE-08) chỉ đi tiếp sau khi Kiểm soát viên duyệt bằng
`reapproveDistribution` với số trên chuỗi.

### QĐ-D. Chốt kỳ vault phải xong trước khi trả

- Sau khi kỳ `APPROVED`: chạy chốt kỳ vault (SC-06 QĐ-G). **Chỉ gửi lô trả khi `vaultCloseStatus === 'DONE'`.**
- `PENDING`, `SENT`: dừng ở trạng thái "đang chốt kỳ vault", lần tiếp tục sau đối soát rồi đi tiếp.
- `CONFLICT`: khoá nút chia, hiện "cần xử lý tay", không gửi lô.
- Sửa `finishOpening` và đường trả tiền tương ứng: lỗi chốt vault không còn bị nuốt rồi đi tiếp.
- Mỗi lần bấm chỉ chạy tối đa `distribution.max_batches_per_run` lô như hiện nay.

### QĐ-E. Keeper chỉ tiếp tục kỳ đã duyệt (CH-3)

- Công việc `distribution` của keeper: vẫn dọn kỳ `OPENING` và phần vault; **không bao giờ mở kỳ mới**.
  - Có kỳ hoạt động `APPROVED`: tiếp tục như QĐ-D, `triggerSource = KEEPER`.
  - Kỳ hoạt động chưa duyệt hoặc `AMOUNT_CHANGED`: không trả gì, kết cục `AWAITING_APPROVAL`.
  - Không có kỳ hoạt động mà có tiền chưa phân bổ từ ngưỡng: kết cục `AWAITING_APPROVAL`.
- Công việc `expire-orders` giữ nguyên.
- Tự mở kỳ theo ngưỡng để dành task sau (vai hệ thống, chính sách hạn mức); ghi nợ (QĐ-H).

### QĐ-F. Màn `/distribution` và API đọc

| Khối | Nội dung | Ai thấy |
|---|---|---|
| Quỹ chia | Số dư quỹ, tổng dự trữ, phần chưa phân bổ, ngưỡng | Hai vai vận hành |
| Dự kiến | Người nhận dự kiến (cùng nguồn `collectRecipients`, gồm vault), số dư WPT hiện tại, phần dự kiến bằng đúng `shareOf`; hiện ví được 0; danh sách bị cắt thì khoá nút | Hai vai vận hành |
| Duyệt | Nút "Duyệt chia `<số>` VNDB"; hộp xác nhận ghi: **"Kiểm soát viên duyệt tổng số VNDB của kỳ; danh sách và tỷ lệ chỉ là dự kiến. Quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ."** và "bấm duyệt sẽ chuyển tiền" | Chỉ `CONTROLLER` |
| Kỳ hoạt động | Mã kỳ, trạng thái, trạng thái duyệt, số duyệt và số thực tế, trạng thái chốt kỳ vault, đã trả, `outstanding`, `failed`; nút "Duyệt lại số thực tế" khi `AMOUNT_CHANGED`, "Tiếp tục chia" khi `APPROVED` còn hồ sơ phải chi; dòng "đã gửi lên chuỗi, đang đối soát" khi có giao dịch chờ | Hai vai xem; nút chỉ `CONTROLLER` |
| Lịch sử | `listDistributionPeriods` phân trang: người duyệt, thời điểm, số duyệt, số thực tế, từng duyệt lại, nguồn kích hoạt; chọn kỳ thì `listDistributionPayouts({ periodId, page, pageSize })` từng ví (gồm ví được 0), số, trạng thái, mã giao dịch, liên kết explorer chỉ trên chain thật; lịch chạy | Hai vai vận hành |

- **Chạy lâu trên Sepolia:** nút khoá khi đang chạy; trình duyệt hết thời gian chờ không tạo lần mở hay chia thứ hai
  (`activeChain` và trạng thái kỳ chặn); tải lại trang thấy đúng trạng thái và tiếp tục được từ kỳ `OPENING`, vault
  `SENT`, hồ sơ `SENT`.
- Màn không tự tính số.

### QĐ-G. Phạm vi duyệt

Kiểm soát viên duyệt **tổng số** của kỳ. Không duyệt danh sách hay tỷ lệ (ghi rõ trên hộp xác nhận, QĐ-F). Duyệt cả danh
sách cần chốt ảnh chụp trước khi duyệt, để task sau.

### QĐ-H. Nợ kỹ thuật ghi vào `tech-report.md`

| Nợ | Nội dung | Hướng trả |
|---|---|---|
| Keeper không tự mở kỳ | Chỉ tiếp tục kỳ đã duyệt; PoC không có lịch gọi; keeper chạy dưới vai mặc định của bản demo nên `TELLER` còn hai quyền chia (không còn action nào dùng) | Vai hệ thống riêng, bộ lập lịch, chính sách tự mở kỳ dưới hạn mức |
| Lệnh treo không tự hết hạn | Không có lịch nên `expire-orders` không chạy trong PoC | Cùng bộ lập lịch |
| Số kỳ có thể khác số duyệt | Hợp đồng lấy toàn bộ phần chưa phân bổ; app dừng và bắt duyệt lại | Đợt sửa hợp đồng: thêm số tiền kỳ vọng, sai thì revert |
| Một người duyệt, chỉ duyệt tổng | PoC | Quy trình ngân hàng khi lên production |

## Việc kèm

- **SC-06 ca 18** (`sc-06-distribution-evm.test.ts`, quá hạn rồi đóng bằng `distribution-admin.js`) vẫn đỏ vì hết ngưỡng
  5 giây mặc định khi chạy bộ thường (đo 21/10: 5,27 giây). FE-08 sửa cùng tệp này nên đặt ngưỡng riêng (ví dụ
  `30_000`) cho ca đó; ca 15 chạy tệp này **không** kèm `--testTimeout`.
- Dùng lại mẫu của BE-13 cho `activeChain` (cột `String?` duy nhất, đặt `null` trong cùng câu cập nhật sang trạng thái
  cuối, ánh xạ lỗi trùng ở `store.errors.ts`) và ca nâng lược đồ trên database có sẵn (`be-13-postgres-upgrade.test.ts`).

## Ràng buộc

- Không sửa hợp đồng. Không đổi trạng thái kỳ chia và hồ sơ chia của SC-06; chỉ thêm cột và chốt chặn trước khi trả.
- Vùng mã: `actions/distribution.ts`, `distribution.service.ts`, `distribution-trigger.service.ts`, route keeper, lưu trữ
  kỳ chia và `KeeperRun`, RBAC, trang `/distribution` và component mới. Không chạm vault, rút (BE-13).
- Không thêm thư viện. Không triển khai Sepolia. Luật kiến trúc giữ nguyên. Checkpoint dán nguyên văn đầu ra.

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **Quyền:** chỉ `CONTROLLER` duyệt, duyệt lại, tiếp tục; `TELLER` và vai khác `FORBIDDEN`, không gửi giao dịch; bốn action cũ không còn trong `actions/distribution.ts`; hai vai vận hành đọc được tổng quan, danh sách kỳ, danh sách hồ sơ |
| 2 | **Duyệt trên nút Hardhat thật** (sau mua 100, bán 40 như bảng OP-05): duyệt 1.000.000: `APPROVED`, vault `DONE`, `DISTRIBUTED`; Nhà đầu tư nhận 60, vault nhận 999.940, `percentLocked = 200.000`; kỳ ghi `approvedBy`, `approvedAt` |
| 3 | **Số đổi trước khi duyệt:** từ chối, không gửi giao dịch, không tạo kỳ |
| 4 | **Số đổi trong lúc mở kỳ** (móc kiểm thử chen tiền): `AMOUNT_CHANGED`, không chốt vault, không lô nào, số dư Nhà đầu tư và vault không đổi; tải lại vẫn thấy `AMOUNT_CHANGED` và hai số; duyệt lại số sai bị từ chối; duyệt lại đúng số trên chuỗi thì mới chốt vault và chia; lịch sử có `reapprovedFrom` |
| 5 | **Chốt vault chưa xong:** dựng `PENDING`, `SENT`, `CONFLICT` lần lượt: không có giao dịch `distributeTo`, số dư không đổi; `CONFLICT` khoá nút; `SENT` đối soát xong thì tiếp tục được |
| 6 | **Keeper:** có tiền chưa duyệt thì `AWAITING_APPROVAL`, không mở kỳ; kỳ `AMOUNT_CHANGED` thì `AWAITING_APPROVAL`; kỳ `APPROVED` còn lô thì tiếp tục, `triggerSource = KEEPER`; `expire-orders` không đổi |
| 7 | **Cạnh tranh:** Kiểm soát viên duyệt đồng thời với keeper; hai Kiểm soát viên duyệt cùng lúc với hai số dự kiến khác nhau; hai lần duyệt sinh hai mã kỳ khác ngày UTC: mọi trường hợp tối đa một kỳ hoạt động, không ai nhận hai lần |
| 8 | **Tiếp tục và chạy lâu:** `max_batches_per_run = 1`, `batch_size = 1`, hai người nhận: lần duyệt `PARTIAL`, duyệt mới bị từ chối, tiếp tục thì `DISTRIBUTED`; dừng tiến trình ở từng khoảng hở (sau mở kỳ, sau gửi chốt vault, sau gửi lô) rồi tiếp tục: không gửi trùng |
| 9 | **Kỳ cũ chưa duyệt:** kỳ hoạt động `approvalStatus = null` không được trả cho tới khi duyệt lại |
| 10 | **Đọc:** dự kiến bằng `shareOf` trên số dư hiện tại, có ví được 0, danh sách bị cắt khoá nút; danh sách hồ sơ phân trang không thiếu ví, có ví được 0; lịch sử hiện đúng người duyệt, số duyệt, số thực tế, nguồn kích hoạt |
| 11 | **Chain không vault** (ví dụ `stellar`): nút duyệt bị vô hiệu, gọi service bị từ chối |
| 12 | **Mock** (sau BE-13): ca 2 cho cùng số; kiểm thử chia lợi nhuận mock hiện có xanh (ca phải đổi do chốt cứng vault và keeper không mở kỳ thì liệt kê) |
| 13 | **E2E** mock và hardhat: Kiểm soát viên duyệt, thấy kỳ hoàn tất và lịch sử; Giao dịch viên không thấy nút |
| 14 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ so `expectedAmount` ở bước 3, ca 3 đỏ; (b) số thực tế khác vẫn chia, ca 4 đỏ; (c) gửi lô khi vault `SENT`, ca 5 đỏ; (d) keeper mở kỳ khi chưa duyệt, ca 6 đỏ; (e) bỏ `activeChain` ở bản bộ nhớ, ca 7 đỏ; (f) cho `TELLER` duyệt, ca 1 đỏ |
| 15 | `run-local-all.sh` xanh; job A (có `trap`) xanh; **job C** xanh; kiểm thử nút thật chạy từng tệp xanh; **nâng lược đồ trên database Postgres có sẵn** xanh; quét bí mật sạch; gỡ marker `@pending FE-08`; sơ đồ `distribute` sinh lại |

## Điều kiện hoàn thành

- [ ] QĐ-A đến QĐ-G (ca 1 đến 13). Đột biến (ca 14). Kiểm chứng chung (ca 15).
- [ ] `tech-report.md`: luồng duyệt, duyệt lại, chốt cứng vault, một kỳ hoạt động mỗi chain, keeper chỉ tiếp tục, bảng
      nợ QĐ-H. `docs/guide.md`: bước Kiểm soát viên duyệt chia.

## Câu hỏi cho chủ dự án (đổi theo góp ý Codex)

| Mã | Chốt mới | Thay đổi so với bản nháp |
|---|---|---|
| CH-1 | Giao dịch viên chỉ xem, không có action mở hoặc chia | Không đổi |
| CH-2 | Số trên chuỗi khác số đã duyệt thì **dừng, không trả gì**, Kiểm soát viên duyệt lại số thực tế (QĐ-C bước 6) | Bản nháp: vẫn chia và cảnh báo. Đổi vì duyệt một số mà chuyển số khác là mất ý nghĩa duyệt; tiền không treo vì duyệt lại được ngay trên cùng kỳ |
| CH-3 | Keeper **không tự mở kỳ**, chỉ tiếp tục kỳ đã duyệt; chưa duyệt thì `AWAITING_APPROVAL` (QĐ-E) | Bản nháp: giữ nguyên keeper. Đổi vì endpoint còn sống là đường đi vòng qua Kiểm soát viên |

## Góp ý Codex trên bản nháp 1 và cách xử lý

| Góp ý | Xử lý |
|---|---|
| Keeper đi vòng qua Kiểm soát viên | Nhận (QĐ-E, CH-3) |
| Không chia số lớn hơn số duyệt; lưu bền trạng thái duyệt | Nhận (QĐ-B, QĐ-C, CH-2) |
| Chốt vault phải xong trước khi trả; chain không vault bị chặn | Nhận (QĐ-D, QĐ-C bước 2) |
| `KeeperRun` không khoá theo chain | Nhận `activeChain` trên kỳ (QĐ-B) |
| API đọc thiếu danh sách hồ sơ; `previewDistributionAction` sai quyền | Nhận (QĐ-A, QĐ-F) |
| Ghi người duyệt cụ thể, nguồn kích hoạt | Nhận (QĐ-B) |
| Chạy lâu trên Cloudflare | Nhận (QĐ-F) |
| Phạm vi duyệt chỉ là tổng số | Nhận (QĐ-G) |

## Không làm

- Sửa hợp đồng. Bộ lập lịch, vai hệ thống cho keeper, tự mở kỳ theo ngưỡng. Lập duyệt hai người; duyệt danh sách.
- Màn nạp lợi nhuận cho SPV. Rút vault (BE-13). Triển khai Sepolia (OP-05).
