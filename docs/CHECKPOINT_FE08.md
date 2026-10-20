# Báo cáo bàn giao: FE-08: Kiểm soát viên duyệt con số kỳ rồi hệ thống mới chia lợi nhuận

| | |
|---|---|
| Task | FE-08 |
| Nhánh | `feat/fe-08-duyet-chia`, tạo từ `dev` @ `dd00e12` (PR #60, BE-13 đã merge), rebase lên `dev` @ `1eed914` (PR #62, HF-01 đã merge) |
| Spec | `docs/fe-08-duyet-chia-loi-nhuan/{requirements,tasks}.md` bản 2.1 |
| Mức kiểm chứng | Cao |
| Tiến độ | Bước 0 đến 4 xong; rebase sau HF-01 và gộp action màn chia xong (mục 6). Chờ Supervisor nghiệm thu; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | QĐ-A đến QĐ-G (ca 1 đến 13). Đột biến (ca 14). Kiểm chứng chung (ca 15) | ✅ | mục 1, 2; chi tiết kiểm chứng mục 1 đến 13; chi tiết đột biến |
| 2 | `tech-report.md` (luồng duyệt, duyệt lại, chốt cứng vault, một kỳ hoạt động mỗi chain, keeper chỉ tiếp tục, bảng nợ QĐ-H); `docs/guide.md` (bước Kiểm soát viên duyệt chia) | ✅ | mục 4 |

**Kết luận:** 2 ✅, 0 🔶, 0 ❌. Không sửa hợp đồng (chi tiết kiểm chứng mục 12). Một việc ngoài vùng mã
spec liệt kê, Sếp đã chốt khi đang làm: địa chỉ quỹ chia logic trên mock (mục 3.1). Yêu cầu của
Supervisor sau HF-01 đã xong (mục 6): rebase lên `dev` @ `1eed914`; `/distribution` mở bằng 1 action
(trước 3), 0 yêu cầu `_rsc`, ba phần kết quả và quyền riêng, có kiểm chặn quay lại.

### 0.2 Việc cần Owner quyết/chạy

- Không có việc bắt buộc. Supervisor chốt mức bốn dòng nợ QĐ-H ghi "đề nghị" ở tech-report 1.6.C và xem
  các lựa chọn khi spec để ngỏ ở mục 3.3.

---

## 1. Kết quả chính

- **Quyền và đường gọi (QĐ-A):** `distribution:approve` chỉ `CONTROLLER`. Action ghi:
  `approveDistributionAction`, `reapproveDistributionAction`, `continueDistributionAction`; action đọc:
  `getDistributionOverviewAction`, `listDistributionPeriodsAction`, `listDistributionPayoutsAction`,
  `listDistributionRunsAction`. Gỡ `openPeriodAction`, `previewDistributionAction`,
  `distributePeriodAction`, `runDistributionCycleAction`. Lõi `runDistributionRound(ctx, periodId)` nhận
  vai và mã người đã kiểm; mọi lần duyệt lưu mã người (`currentActorId`).
- **Duyệt lưu bền (QĐ-B):** `DistributionPeriod` thêm `approvalStatus`, `expectedAmount`,
  `approvedAmount`, `approvedBy`, `approvedAt`, `reapprovedFrom`, `activeChain` (duy nhất, `null` trong
  cùng câu cập nhật sang trạng thái cuối); `KeeperRun.triggerSource`. Có ở `schema.prisma`, `init.sql`,
  `ADDED_COLUMNS` (kèm điền `activeChain` cho kỳ cũ hoạt động sớm nhất mỗi chain), `schemaObjectsReady`,
  hai cổng lưu trữ, `UNIQUE_CONSTRAINTS`.
- **Duyệt chia (QĐ-C):** `approveDistribution` so số với phần chưa phân bổ, ngưỡng, giữ chỗ một kỳ hoạt
  động, mở kỳ theo đường SC-06, `decideApproval` so số thực tế: `APPROVED` thì chia, `AMOUNT_CHANGED` thì
  dừng; `reapproveDistribution` đúng số trên chuỗi; `continueDistribution` phục hồi `OPENING`.
- **Chốt cứng vault (QĐ-D):** lõi chia chặn kỳ chưa `APPROVED` và chỉ đi tiếp khi `syncVaultClose` là
  `DONE`; `finishOpening` không còn đẩy vault rồi nuốt lỗi.
- **Keeper (QĐ-E):** `decideCycle` không bao giờ mở kỳ; kỳ `APPROVED` thì `runApprovedPeriod` với
  `triggerSource = KEEPER`; còn lại `AWAITING_APPROVAL`.
- **Màn `/distribution` và API đọc (QĐ-F, QĐ-G):** quỹ, dự kiến, khối duyệt với hộp xác nhận nguyên văn,
  kỳ hoạt động, lịch sử kỳ và hồ sơ phân trang, lịch chạy kèm nguồn.
- **Việc kèm:** SC-06 ca 18 có ngưỡng riêng `{ timeout: 30_000 }`.

## 2. Ca kiểm chứng và nơi chạy

| Ca | Nơi kiểm |
|---|---|
| 1 | `app/test/fe-08-approval.test.ts` "FE-08 ca 1"; `rbac.test.ts` (FE08_ACTIONS) |
| 2 | `app/test/fe-08-approval-evm.test.ts` "ca 2" (nút Hardhat thật, mua 100 bán 40 qua `placeSignedOrder`) |
| 3 | `fe-08-approval.test.ts` "FE-08 ca 3" |
| 4 | `fe-08-approval-evm.test.ts` "ca 4" (nút thật, chen 100 VNDB vào quỹ trước giao dịch mở kỳ); `fe-08-approval.test.ts` "FE-08 ca 4" (mock) |
| 5 | `fe-08-approval-evm.test.ts` "ca 5 PENDING", "ca 5 SENT", "ca 5 CONFLICT"; bản mock ở `fe-08-approval.test.ts` |
| 6 | `fe-08-approval.test.ts` "FE-08 ca 6"; `distribution-trigger.test.ts` (keeper không mở kỳ) |
| 7 | `fe-08-approval-evm.test.ts` "ca 7" (nút thật); `fe-08-approval.test.ts` "FE-08 ca 7" (bộ nhớ); `fe-08-store.test.ts` (bộ nhớ và Postgres) |
| 8 | `fe-08-approval-evm.test.ts` hai ca "ca 8" (nút thật) |
| 9 | `fe-08-approval.test.ts` "FE-08 ca 9" |
| 10 | `fe-08-approval.test.ts` "FE-08 ca 10" |
| 11 | `fe-08-approval.test.ts` "FE-08 ca 11" |
| 12 | `fe-08-approval.test.ts` "FE-08 ca 12" (mock cho cùng số với ca 2); ca cũ phải đổi ở mục 3.2 |
| 13 | `app/e2e/zz-distribution-approval.spec.ts` (project `mock` và `hardhat`) |
| 14 | `docs/CHECKPOINT_FE08_MUTATIONS_DETAIL.md`: 14a đến 14f đều đỏ đúng ca, hoàn nguyên sạch |
| 15 | `docs/CHECKPOINT_FE08_VERIFICATION_DETAIL.md`; nâng lược đồ cả bằng `fe-08-store.test.ts` (ca 15) |

Số đo chính (đầu ra ở chi tiết kiểm chứng): hợp đồng 158 passing (không đổi); `run-local-all.sh` 7
PASS, vitest 1063 đạt, 75 bỏ qua; job A 6 phần đạt, artifacts phục hồi; job C 4 PASS, E2E hardhat 26
đạt; E2E mock 65 đạt; nút thật từng tệp: `vault` 6, `sc-06-distribution-evm` 10 (ca 18 với ngưỡng
riêng, không `--testTimeout`), `evm-order-settlement` 10, `fe-05-permit-evm` 8, `evm-issuance` 13 (1
bỏ qua), `be-13-vault-evm` 5, `fe-08-approval-evm` 8 đều đạt; database dựng theo `init.sql` của `dev`
(chưa có cột FE-08) chạy 4 tệp Postgres của nhánh 232 đạt và được nâng đủ bảy cột kỳ chia,
`KeeperRun.triggerSource`, chỉ mục `DistributionPeriod_activeChain_key`; Postgres thật toàn bộ 1159 đạt,
57 bỏ qua; quét bí mật sạch; không còn điểm chờ FE-08; hợp đồng không bị sửa so với `origin/dev`. Nền
trước khi làm (chi tiết kiểm chứng mục 13): 7 PASS, vitest 1020.

## 3. Sai lệch, lựa chọn khi làm và ca cũ phải sửa

### 3.1 Việc ngoài vùng mã, Sếp đã chốt

E2E ca 13 cần quỹ chia có tiền, nhưng app không có đường nạp quỹ (mock: quỹ chỉ là số trong bộ nhớ máy
chủ). Em hỏi, Sếp chọn: mock thêm địa chỉ quỹ chia logic `MOCK_PROFIT_DISTRIBUTOR_ADDRESS`
(`0x67C48fdA18F68acf2eD6d8A80436930Ff226948e`, 20 byte cuối của
`keccak256("bidv-rwa-tokenize:mock:ProfitDistributor")`, cùng cách dựng với vault mock BE-13) trong
`packages/shared/src/mock-vault.ts`; số dư VNDB của địa chỉ này là `profitPool` của mock
(`mock.adapter.ts`). E2E và người trình diễn nạp quỹ qua `/mint` (whitelist) và `/demo-payment` trên cả
mock và hardhat. Không đổi `demo-payment.service`.

### 3.2 Ca cũ đổi theo spec (không xoá ca nào)

| Tệp | Ca | Lý do |
|---|---|---|
| `app/test/distribution-service.test.ts` | helper `openPeriodOk` ghi duyệt đúng số ở cổng lưu trữ; ca 5 "mã kỳ khác" thành: bị từ chối khi kỳ đầu còn hoạt động, mở được khi kỳ đầu xong | QĐ-C, QĐ-B |
| `app/test/distribution-trigger.test.ts` | ca 2 viết lại (keeper `AWAITING_APPROVAL`; lần duyệt mở kỳ mã `<chain>:<ngày UTC>-NN`, chia, mốc; lần nạp sau chờ duyệt rồi kỳ `-02`); ca 3/4, 6, 7, đột biến 1, 2, quỹ thiếu: lượt đầu là lần duyệt (`MANUAL`), keeper chia tiếp; ca 3/4 kiểm thêm nguồn; ca 5 "đúng ngưỡng" thành `AWAITING_APPROVAL`; ca 9 "khoá đúng" thêm bước chờ duyệt | QĐ-E |
| `app/test/sc-06-distribution-flow.test.ts` | `openOk` ghi duyệt; ca 18 (BE-07), ca 19 (ba ca), ca 20: kỳ mới mở bằng lần duyệt; BE-13 QĐ-G: vault chốt ở lượt chia đầu, không ở lúc mở kỳ | QĐ-D, QĐ-E |
| `app/test/sc-06-distribution-evm.test.ts` (nút thật) | `openOk` ghi duyệt; ca 14, 15a: vault chốt ở lượt chia đầu; ca 16a: lỗi chốt vault nổ ra, không lô nào (trước đây bị nuốt); ca 16b: lượt chia dừng với vault `WAITING`; ca 19: keeper chờ duyệt rồi Kiểm soát viên duyệt; ca 18: ngưỡng riêng 30.000 ms; ca 16c/16d: `CONFLICT` khoá chia, kỳ sau không mở được vì kỳ `CONFLICT` còn giữ chỗ hoạt động | QĐ-D, QĐ-B, việc kèm |
| `app/test/store-constraints.test.ts` | kỳ của ca `periodKey` và ca hồ sơ chia ở `COMPLETED`; ca giữ chỗ SC-06 dùng chain chưa có kỳ hoạt động và tự dọn; ca QĐ-G đưa kỳ đầu về `COMPLETED` trước khi mở kỳ sau, đóng kỳ `stellar:<uuid>` thừa của chính nó | QĐ-B (database Postgres dùng chung) |
| `app/test/rbac.test.ts` | thêm `FE08_ACTIONS`; danh sách quyền ghi của `CONTROLLER` thêm `distribution:approve` | QĐ-A |
| `app/test/four-roles-shell.test.ts`, `app/e2e/investor-channel.spec.ts` | nhãn menu: Giao dịch viên "Chia lợi nhuận (chỉ xem)", Kiểm soát viên "Chia lợi nhuận" | QĐ-A |
| `app/playwright.config.ts` | project `hardhat` chạy thêm `zz-distribution-approval.spec.ts` | ca 13 |
| `distribution-service` ca 8, `sc-06-distribution-mock`, `mock-ledger` | không đổi, vẫn đạt | |

### 3.3 Lựa chọn khi spec để ngỏ

- **Mã kỳ của lần duyệt** `<chain>:<ngày UTC>-NN`, bỏ qua cả nhãn đã có trên chuỗi mà sổ không biết
  (sổ bộ nhớ khởi động lại trên một nút còn kỳ cũ; nếu không, hợp đồng từ chối và đường phục hồi đọc
  nhầm kỳ cũ). Trọng tài vẫn là `activeChain`.
- **Kết luận duyệt ghi lúc đọc được số thực tế** (`decideApproval` trong `finishOpening`), nên mọi đường
  hoàn tất kỳ `OPENING` (tiếp tục, keeper) đều áp đúng kết luận. Kỳ `AMOUNT_CHANGED` giữ `approvedBy`
  của lần duyệt đầu và `approvedAmount = null`; duyệt lại ghi người và thời điểm mới, `reapprovedFrom` là
  số duyệt cũ (kỳ cũ chưa từng duyệt thì `null`).
- **Chốt vault đứng trước cả nhánh kỳ hết hạn:** kỳ không rời trạng thái hoạt động khi vault chưa `DONE`.
- **Luồng bấm tay chạy `reconcileChainPeriods` trước lượt chia:** PoC không có lịch gọi keeper, vault
  của kỳ trước phải theo kịp thì kỳ này mới chốt được. Kỳ hoạt động chưa duyệt không được chốt vault.
- **Lượt chia của Kiểm soát viên cũng ghi `KeeperRun`** (`MANUAL`) cùng bộ đếm số vòng với keeper: số
  vòng là trọng tài khi Kiểm soát viên bấm tiếp tục đúng lúc keeper chạy.
- **Kết cục keeper thêm** `AWAITING_APPROVAL`, `OPENING_PENDING`, `VAULT_PENDING`, `VAULT_CONFLICT`;
  bỏ trường `periodOpened` (keeper không còn mở kỳ).
- **Điền `activeChain` khi nâng lược đồ:** chỉ kỳ cũ hoạt động SỚM NHẤT mỗi chain (dữ liệu trước FE-08
  có thể có hai kỳ dở cùng chain; điền cả hai thì chỉ mục nổ và ứng dụng không khởi động).
- **`TELLER` giữ `distribution:snapshot`/`execute`** cho keeper chạy dưới vai mặc định (đúng QĐ-H); lõi
  chia vẫn chặn kỳ chưa duyệt.
- **Tổng quan trên chain không có vault** trả `pool`, `forecast` rỗng mà không gọi hàm đọc quỹ (adapter
  Stellar chưa có), kèm lý do "không hỗ trợ luồng chia đã duyệt".
- **Duyệt lại** đòi số bằng cả `distributions(id).amount` đọc lại từ chuỗi lẫn `totalAmount` trong sổ;
  hộp xác nhận nguyên văn QĐ-F dùng cho cả duyệt lại.
- **Tiếp tục kỳ `AMOUNT_CHANGED`** trả kết cục `AMOUNT_CHANGED` (không phải lỗi) để màn chỉ đúng nút.
- **Tệp e2e tên `zz-…`** để chạy sau mọi tệp khác (cần người nắm giữ của các tệp trước).

### 3.4 Môi trường sandbox

`binaries.soliditylang.org` bị chặn nên lệnh Hardhat chạy với `USE_LOCAL_SOLC=1`; Postgres 16 cục bộ.

## 4. Tài liệu

`docs/tech-report.md` bản 4.21: đầu trang, đoạn tóm tắt FE-08, **mục mới 3.27** (quyền, cột duyệt và
`activeChain`, sơ đồ duyệt, chốt cứng vault, màn hình, nạp quỹ trên mock, cách mở rộng), bảng quyền 3.3
thêm `distribution:approve`, ghi chú FE-08 ở 3.14 (keeper không mở kỳ, `decideCycle`), mục 4.5 (trạng
thái, sơ đồ keeper, bảng "Còn thiếu"), bốn dòng nợ QĐ-H ở 1.6.C. `docs/guide.md`: mục 8 mới (SPV nạp quỹ,
Kiểm soát viên duyệt và chia, bảng trạng thái khi kỳ chưa xong), các mục sau dời số. Sơ đồ `distribute`
(24 bước) và mục điểm cắm sinh lại bằng công cụ.

## 5. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi lời gọi chuỗi qua `ILedgerPort` (service mới chỉ gọi `getLedger`; địa chỉ quỹ mock nằm trong adapter mock).
- [x] Mọi thao tác ký qua `ISigner` (mở kỳ, chốt vault, chia lô đi qua adapter EVM như SC-06).
- [x] Mọi kiểm quyền qua RBAC (`authorize('distribution:approve')`, `assertCan('reconcile:read')`; không so tên vai).

## 6. Rebase sau HF-01 và màn chia mở bằng một action

**Rebase.** `git rebase origin/dev` (`1eed914`): năm commit FE-08 lên lại, chỉ hai tệp tài liệu xung
đột, không tệp mã nào. `.kiro/task-status.json`: giữ cả hai bên (`done` có `HF-01` và `BE-13`,
`inProgress` là `FE-08`). `docs/tech-report.md`: xung đột nằm trong bảng điểm cắm sinh tự động, lấy một
bên rồi sinh lại bằng `node scripts/scan-pending.mjs --write-report`; phần chữ của HF-01 (bài học hiệu
năng ở 1.6.A, nợ P1, P2 ở 1.6.C) giữ nguyên. Sau rebase `hf-01-hieu-nang.test.ts` và `pending-markers.test.ts`
đạt.

**Gộp action.** Trước: màn gọi `getDistributionOverviewAction`, `listDistributionPeriodsAction`,
`listDistributionRunsAction` khi mở, Next xếp ba action nối tiếp nên là ba lượt Worker. Sau:
`getDistributionPageAction` (điểm luồng `distribute:1`) gọi service `getDistributionPage`, chạy
song song ba phần qua `Promise.all`, mỗi phần là một `Result` riêng (`overview`, `periods`, `runs`) và
tự kiểm `reconcile:read` như trước, lỗi bất ngờ của một phần cũng gói thành `Result` lỗi của riêng phần
đó. Dữ liệu vào sai (`distributionPageSchema`) trả `VALIDATION` cho cả lượt. Màn gọi action này khi mở và
khi tải lại sau duyệt, duyệt lại, tiếp tục; chỉ khi người xem đổi trang lịch sử hoặc mở hồ sơ một kỳ mới
gọi action riêng. Nghiệp vụ, quyền, sổ kiểm toán không đổi; ba action đọc cũ vẫn giữ cho lời gọi riêng.

**Số đo** (Playwright trên bản `next build`, `next start` chain `mock`, đếm yêu cầu có header
`next-action` và yêu cầu có `_rsc`, theo cách đo của HF-01):

```text
Trước (bản rebase, chưa gộp):
/distribution CONTROLLER {"ACTION":3,"RSC":0}
/distribution TELLER {"ACTION":3,"RSC":0}
Sau:
/distribution CONTROLLER {"ACTION":1,"RSC":0}
/distribution TELLER {"ACTION":1,"RSC":0}
```

**Kiểm chặn quay lại** (`app/test/fe-08-approval.test.ts` "FE-08 hiệu năng", 8 ca): mã màn gọi
`getDistributionPageAction(` đúng một lần, không còn `getDistributionOverviewAction`,
`listDistributionRunsAction`, chỉ hai `useEffect` có gọi action (mở màn, hồ sơ một kỳ); hai vai vận hành
nhận đủ ba phần và mỗi phần bằng đúng lần đọc riêng; `SELLER`, `INVESTOR` bị `FORBIDDEN` ở từng phần;
lịch chạy lỗi thì tổng quan và lịch sử vẫn đạt; lịch sử lỗi thì tổng quan và lịch chạy vẫn đạt; dữ liệu
vào sai trả `VALIDATION`. Đột biến: cho một phần lỗi kéo cả lượt (`if (!runs.ok) return runs;`) thì 3 ca
đỏ; thêm lại lời gọi `getDistributionOverviewAction` vào màn thì ca mã nguồn đỏ; hoàn nguyên sạch.

**Kiểm chứng gọn** (chỉ phần bị ảnh hưởng; đầu ra ở chi tiết kiểm chứng mục 14):

| Lệnh | Kết quả |
|---|---|
| `cd app && npx tsc --noEmit -p .` | exit 0 |
| `cd app && npx eslint src test` | exit 0 |
| `cd app && npx vitest run test/fe-08-approval.test.ts test/hf-01-hieu-nang.test.ts test/pending-markers.test.ts test/distribution-trigger.test.ts test/rbac.test.ts` | 5 tệp, 180 đạt |
| `cd app && npx vitest run` | 1075 đạt, 75 bỏ qua |
| `node scripts/gen-flow-diagram.mjs --check`; `node scripts/scan-pending.mjs --check-report` | khớp |
| `bash scripts/run-local-all.sh build e2e` (E2E mock, gồm `zz-distribution-approval.spec.ts`) | 2 PASS; E2E mock 65 đạt, 7 bỏ qua (3 ca màn chia đạt) |
| Đo Playwright như trên | 1 action, 0 `_rsc` |

Không chạy lại: hợp đồng (không đổi, `git diff origin/dev -- packages/contracts-evm/contracts` rỗng),
nút Hardhat thật và Postgres (service ghi, lưu trữ, adapter không đổi; thay đổi chỉ là một hàm đọc gộp
và màn hình).
