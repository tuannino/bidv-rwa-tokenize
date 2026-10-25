# Báo cáo bàn giao: FE-10 màn Thu hồi token

| | |
|---|---|
| Task | FE-10 |
| Nhánh | `feat/fe-10-man-thu-hoi`, từ `dev` @ `4767e01` |
| Spec | `docs/fe-10-man-thu-hoi/requirements.md`, `design.md`, `tasks.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Mã, tài liệu, ca 1 tới 17 và 12 nhóm đột biến đã thực hiện; chờ Supervisor nghiệm thu |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu phạm vi

| # | Phạm vi | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Tổng quan máy chủ, điều kiện đóng băng và trạng thái giao dịch có cấu trúc | ✅ | mục 1.1; `app/test/be-05-recall.test.ts` |
| 2 | Hàm thuần cho quyền, pha, nhãn, ngày và chặn biểu mẫu | ✅ | mục 1.2; `app/test/fe-10-recall-ui.test.ts` |
| 3 | Màn `/recall`, menu theo vai, danh mục, giao dịch và Người bán | ✅ | mục 1.3; `app/e2e/recall.spec.ts` |
| 4 | Ca 1 tới 17, Hardhat thật và 12 nhóm đột biến | ✅ | mục 2, 3 |
| 5 | Ngân sách server action giữ nguyên | ✅ | mục 4 |
| 6 | Tài liệu, trạng thái task và dọn ký tự cấm | ✅ | mục 5 |

**Kết luận:** 6 ✅, 0 🔶, 0 ❌. Không sửa hợp đồng. Có hai giới hạn bằng chứng: ca Hardhat
chạy ở tầng service nên chưa có ảnh giao diện, và máy kiểm checkpoint không đọc được spec vì
`requirements.md` không có mục "Điều kiện hoàn thành". Chi tiết ở mục 2.3 và 5.2.

### 0.2 Việc Supervisor cần xem

- Nếu cần bằng chứng thị giác cho ca 15, chạy tay màn `/recall` trên `hardhat-local` và chụp ảnh.
- Chốt đề xuất tách ca 15 thành một ca hành vi chain và một ca bằng chứng giao diện ở bản spec sau.

---

## 1. Kết quả chính

### 1.1 Máy chủ

- `minNoticeDaysFor`, `isRecallLockStale` và `freezeBlockers` là hàm dùng chung giữa quyết định
  đóng băng và tổng quan. Khoá `RECALL` quá hạn không chặn, khoá khác vẫn chặn.
- Tổng quan trả ngày máy chủ, mức báo trước tối thiểu, quyền đóng băng, trạng thái khoá và danh sách
  chặn. Đợt gần nhất đã huỷ vẫn có danh sách dự kiến.
- `getTradeContext` trả `tradeBlock` thay vì làm hỏng toàn trang khi giao dịch bị chặn; lõi đặt lệnh
  vẫn từ chối ở tầng service.

### 1.2 Quyết định giao diện

- `components/recall/gates.ts` quyết định bước, nút, xác nhận ký hiệu, nhãn pha và nội dung cảnh báo.
- `operationLabel` gom nhãn nghiệp vụ tiếng Việt cho lịch sử Nhà đầu tư và màn phát hành.
- `formatVnDate` hiển thị ngày lịch Việt Nam, không dùng đồng hồ máy khách để quyết định pha.

### 1.3 Màn hình và quyền

- `/recall` tải bằng một action, tự tải lại sau thao tác, bỏ phản hồi cũ khi đổi chain.
- Kiểm soát viên có thể mở, sửa, huỷ, đóng băng, mở đóng băng và thu hồi theo lô. Giao dịch viên
  chỉ xem cùng dữ liệu, không nhận nút ghi.
- Bảng hồ sơ giữ thứ tự máy chủ, rút gọn ví và mã giao dịch, chép ví, mở explorer khi có và hiện
  lỗi riêng. Kết quả lô dùng `aria-live="polite"`.
- `/portfolio` cảnh báo thu hồi; `/trade` vẫn tải được rồi khoá biểu mẫu; tổng quan Người bán dùng
  nhãn pha thu hồi. Menu chỉ xuất hiện cho hai vai vận hành.

## 2. Kiểm chứng

### 2.1 Bộ mặc định và build

Chạy trong `app`:

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint -- --max-warnings=0` | PASS |
| `npx vitest --run` | 62 tệp đạt, 14 bỏ qua; 1198 ca đạt, 90 bỏ qua |
| `npx next build --webpack` | PASS, 34 route, có `/recall` |

`npm run build` mặc định không dùng làm bằng chứng vì Turbopack từ chối liên kết `node_modules`
của worktree. Bản webpack hoàn chỉnh đạt; cảnh báo optional MetaMask async storage là cảnh báo nền.

### 2.2 E2E mock

`npx playwright test e2e/recall.spec.ts --project=mock` đạt 1 ca. Chạy toàn bộ project mock đạt
75 ca, bỏ qua 7 ca dành cho chain khác. Kịch bản tự dựng dữ liệu phát hành nếu chạy riêng, đếm
action của cả hai vai, kiểm giao dịch bị khoá, đóng băng, mở lại, huỷ đợt và có `afterAll` phục hồi
trạng thái nếu hỏng giữa chừng. Ca cũ ở `mint.spec.ts` được cập nhật để đòi nhãn tiếng Việt
"Phát hành" theo R17 thay vì mã thô `mint`.

### 2.3 Hardhat local

Nút Hardhat được dựng lại và chạy:

`TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-05-recall-evm.test.ts`

Kết quả: 1 ca đạt. Luồng mở đợt, đóng băng, mở lại, đóng băng lại và thu hồi tới khi đóng dự án
đã chạy trên chain thật. Tệp này không dựng trang trình duyệt nên không thể tạo ảnh giao diện hoặc
đối chiếu dòng lịch sử Nhà đầu tư bằng ảnh; E2E giao diện tương ứng đã đạt trên mock. Nếu ảnh là
điều kiện bắt buộc độc lập, Supervisor cần chạy tay hoặc bổ sung fixture ví giả cho project Hardhat.

### 2.4 Ca 1 tới 17

- Ca 1 tới 8 và 11 tới 14: `app/test/fe-10-recall-ui.test.ts`.
- Ca 9 và 10: `app/test/be-05-recall.test.ts`, cùng các ca Postgres hiện hữu.
- Ca 15: `app/test/be-05-recall-evm.test.ts`, giới hạn ảnh ghi ở mục 2.3.
- Ca 16 và 17: `app/e2e/recall.spec.ts`.

## 3. Đột biến

Mỗi đột biến được áp dụng riêng, chạy ca mục tiêu, xác nhận đỏ rồi hoàn nguyên ngay. Không giữ mã
đột biến trong worktree.

| Đột biến | Ca đỏ |
|---|---|
| Trả nút ghi khi `canManage` false | ca 2 |
| Cho mở đợt khi dự án `DRAFT` | ca 2 |
| Cho gửi đóng băng mới khi đã có `freezeRequestedAt` | ca 3 |
| Cho mở đóng băng khi `canUnfreeze` false | ca 3, 4 |
| So ký hiệu không phân biệt hoa thường | ca 5 |
| Bỏ xác nhận ở lô đầu | ca 6 |
| Bỏ nhãn `recall` | ca 7 |
| `getTradeContext` trả lỗi khi bị chặn | ca 9 |
| Bỏ điều kiện kỳ chia đang mở | ca 7, 10 |
| Coi khoá `RECALL` quá hạn là còn bận | ca 10 |
| Trả mức báo trước 0 cho EVM thường khi cờ tắt | ca 11 và ca kiểm ngày |
| Dùng sai pha trong `recallNoticeText` | ca 12 |
| Bỏ qua `tradeBlocked` ở `confirmBlockReason` | ca 13 |

Spec gọi đây là 12 đột biến, nhưng dòng `freezeBlockers` có hai biến thể độc lập. Vì vậy thực tế Em
đã chạy 13 lượt; cả 13 đều bị test bắt.

## 4. Số server action

Đo bằng Playwright từ `goto` tới `networkidle`, chỉ đếm `POST` có header `next-action`. Bản nền được
checkout riêng đúng commit `4767e01`, build bằng webpack rồi xoá thư mục tạm sau phép đo.

| Màn | Nền `4767e01` | FE-10 |
|---|---:|---:|
| `/portfolio` | 1 | 1 |
| `/trade` | 1 | 1 |
| Tổng quan Người bán | 1 | 1 |
| `/recall`, Giao dịch viên | Không có | 1 |
| `/recall`, Kiểm soát viên | Không có | 1 |

## 5. Tài liệu và lưu ý về spec

### 5.1 Đã cập nhật

- Lưu ba tệp spec dưới `docs/fe-10-man-thu-hoi/`.
- Cập nhật `USER_GUIDE.md`, `tech-report.md` lên 4.26 và `.kiro/task-status.json`.
- Dọn các ký tự cấm mà BE-05 thêm trong đúng phạm vi R20; quét phần thêm mới từ `4767e01` không còn
  U+2192, U+2014 hoặc U+00B7 ngoài khối do công cụ sinh.

### 5.2 Góp ý spec

1. Ca 15 đang ghép hai loại bằng chứng: hành vi chain ở Hardhat và ảnh UI có ví giả. Nên tách thành
   ca chain bắt buộc và ca thị giác riêng, đồng thời nêu fixture ví giả hoặc thao tác tay chuẩn.
2. Ca 16 phụ thuộc dữ liệu phát hành do suite khác tạo nếu chỉ mô tả theo thứ tự tệp. Kịch bản nên
   bắt buộc tự dựng dữ liệu; bản hiện thực đã làm như vậy bằng đường phát hành chính thức khi cần.
3. Lệnh R20 trong spec chỉ xem commit `4767e01`, không kiểm phần đang làm. Bàn giao đã quét diff từ
   `4767e01` tới worktree để bắt ký tự mới thật sự.
4. `requirements.md` thiếu mục "Điều kiện hoàn thành" với các ô checkbox, nên
   `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE10.md docs/fe-10-man-thu-hoi/requirements.md`
   trả lỗi đầu vào trước khi kiểm checkpoint. Nên thêm mục này vào mẫu spec kế tiếp.
