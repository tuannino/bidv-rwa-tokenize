# FE-01 v2 — Kênh nhà đầu tư và trang tổng quan: requirements

| | |
|---|---|
| Mã task | FE-01 v2 |
| Nhóm | Giao diện |
| Ưu tiên | P0 |
| Nhánh | `feat/investor-channel-v2`, tạo **từ `dev`** @ `5982a4e` |
| Bản giao của Owner | `docs/fe-01-investor-channel-v2/` (tham chiếu tính năng) |
| Tham chiếu kỹ thuật | nhánh `feat/investor-channel` (v1, **chưa merge**) + `docs/CHECKPOINT_FE01.md` trên nhánh đó |

## 0. Vì sao spec này khác bản Owner giao — PHƯƠNG ÁN C

Bản giao ở `docs/fe-01-investor-channel-v2/tasks.md` mở đầu bằng điều kiện: nhánh tạo từ `dev`
**sau khi FE-01 v1 đã merge**, nếu chưa merge thì dừng và báo. Đã kiểm và báo Owner:

```
git merge-base --is-ancestor origin/feat/investor-channel origin/dev  -> v1 CHƯA merge
git rev-list --count origin/dev..origin/feat/investor-channel         -> 9
git diff --stat origin/dev...origin/feat/investor-channel             -> 24 files, +1875/-47
```

Owner chốt **phương án C**: spec tự chứa trên `dev`, hút luôn phạm vi v1, **không** lấy nền từ
nhánh v1. Hệ quả với bản giao:

| Mục trong bản giao | Xử lý ở spec này |
|---|---|
| "Đổi guard của `(client)/layout.tsx`" | Đổi thành **tạo mới** — `dev` chưa có route group `(client)` |
| "Bỏ nhãn `fixme` của test v1" | Đổi thành **viết mới** `investor-channel.spec.ts` — `dev` chưa có file này |
| "Rút gọn hằng `CHANNEL_HOME`" | Đổi thành **tạo mới** — `dev` chưa có hằng này |
| "Xóa nợ P1 khỏi `tech-report.md` 1.6.C" | **Bỏ** — nợ đó do v1 thêm, `dev` có 0 lần `balance:read` trong tech-report |
| "Thay trang chỗ trống `/portfolio`" | Đổi thành **tạo mới** — chưa có trang chỗ trống nào |

Phần **tính năng** (R1–R9 dưới đây) giữ nguyên ý bản giao.

## 1. Yêu cầu chức năng

### R1 — Bộ chọn kênh

- **R1.1** PHẢI có bộ chọn kênh ở thanh trên với đúng hai lựa chọn: "Nhà đầu tư", "Admin console".
- **R1.2** Lựa chọn PHẢI được lưu giữa các lần tải trang.
- **R1.3** Đổi sang kênh Nhà đầu tư PHẢI điều hướng về `/portfolio`.
- **R1.4** Đổi sang kênh Admin console PHẢI điều hướng về `/`.
- **R1.5** Bộ chọn kênh PHẢI hiển thị ở **cả hai** kênh.

### R2 — Bộ chọn vai chỉ dành cho Admin console

- **R2.1** Bộ chọn vai PHẢI chỉ hiển thị khi đang ở kênh Admin console.
- **R2.2** Bộ chọn vai PHẢI chỉ còn ba lựa chọn: `BANK_ADMIN`, `COMPLIANCE`, `AUDITOR`.
- **R2.3** Ở kênh Nhà đầu tư, hệ thống PHẢI đặt vai `INVESTOR` và ẩn bộ chọn vai.
- **R2.4** Đổi kênh sang Admin console khi vai đang là `INVESTOR` PHẢI đặt vai về `BANK_ADMIN`.
- **R2.5** Giao diện PHẢI hiển thị vai **đang thực sự có hiệu lực** (đọc từ cookie), không phải giá
  trị mặc định từ biến môi trường. Đây là lỗi đang tồn tại trên `dev`, xem §3.

### R3 — Quyền vào kênh nhà đầu tư

- **R3.1** PHẢI thêm action mới `portfolio:read`.
- **R3.2** `portfolio:read` PHẢI chỉ cấp cho `INVESTOR`, KHÔNG cấp cho ba vai còn lại, và **KHÔNG**
  đưa vào nhóm `READ_ONLY`.
- **R3.3** Guard kênh nhà đầu tư PHẢI dùng `requireAny={['portfolio:read']}`.
- **R3.4** `BANK_ADMIN`, `COMPLIANCE`, `AUDITOR` PHẢI **bị chặn** khỏi kênh nhà đầu tư.

### R4 — Điều hướng theo kênh

- **R4.1** Sidebar PHẢI hiển thị menu theo kênh: kênh nhà đầu tư không thấy mục của kênh ngân hàng
  và ngược lại.
- **R4.2** Menu kênh ngân hàng PHẢI giữ nguyên hiện trạng `dev`: đủ 6 mục, không đổi nhãn, không
  đổi phím tắt.
- **R4.3** Mục chưa có nghiệp vụ PHẢI hiển thị ở trạng thái chưa khả dụng và KHÔNG điều hướng được.
- **R4.4** Đường dẫn của kênh nhà đầu tư KHÔNG được trùng đường dẫn của `(admin)`/`(audit)`.

### R5 — Trang tổng quan: tài sản đã đầu tư

- **R5.1** PHẢI hiển thị số lượng WPT đang giữ và giá trị quy đổi của ví đang kết nối.
- **R5.2** Số lượng token PHẢI đọc từ chuỗi qua `ILedgerPort`, KHÔNG lấy từ dữ liệu mẫu.
- **R5.3** KHI ví chưa kết nối, PHẢI hiển thị lời mời kết nối, KHÔNG hiển thị số 0.
- **R5.4** Số dư VNDB: `ILedgerPort` chưa có phương thức đọc số dư token thanh toán, nên PHẢI **ẩn**
  phần này và ghi nợ chờ BE-01, KHÔNG hiển thị số 0 và KHÔNG bịa số.

### R6 — Trang tổng quan: hộp trạng thái phát hành

- **R6.1** PHẢI hiển thị: giá phát hành, tổng cung, số đang lưu hành, trạng thái vận hành dự án.
- **R6.2** Mọi số liệu chưa có nguồn thật PHẢI có nhãn nhận biết trên giao diện.
- **R6.3** KHÔNG được hiển thị giá giao dịch, biến động giá, hay khối lượng giao dịch như số liệu
  thật — hệ thống chưa có thị trường thứ cấp.
- **R6.4** Hộp này PHẢI đặt tên theo đúng bản chất (trạng thái **phát hành/vận hành**), không đặt
  tên gợi ý là giá thị trường.

### R7 — Trang tổng quan: lịch sử giao dịch

- **R7.1** PHẢI hiển thị danh sách giao dịch gần đây của ví đang kết nối.
- **R7.2** Mỗi dòng PHẢI có: loại nghiệp vụ, số lượng, thời điểm, trạng thái, và liên kết tra cứu
  nếu chuỗi có trình khám phá.
- **R7.3** Lọc theo ví PHẢI thực hiện ở tầng nghiệp vụ. Giao diện KHÔNG được tự lọc, và kết quả trả
  về KHÔNG được chứa giao dịch của ví khác.
- **R7.4** KHI chưa có giao dịch, PHẢI hiển thị trạng thái rỗng.

### R8 — Trang tổng quan: danh sách token

- **R8.1** PHẢI hiển thị danh sách token đang được token hóa.
- **R8.2** Mỗi dòng PHẢI có: mã token, tên dự án, trạng thái dự án, số nhà đầu tư đang giữ.
- **R8.3** Mỗi dòng PHẢI có đường dẫn sang trang chi tiết.
- **R8.4** PHẢI phân biệt rõ token đã triển khai trên chuỗi và token còn ở dạng dữ liệu mẫu.

### R9 — Trang chi tiết dự án token

- **R9.1** PHẢI có trang chi tiết theo mã token, mở được từ hộp danh sách.
- **R9.2** PHẢI hiển thị: thông tin dự án, tình hình vận hành, thông tin token, vị thế nhà đầu tư.
- **R9.3** PHẢI tái dùng `MOCK_PROJECTS`, KHÔNG dựng nguồn dữ liệu dự án thứ hai.
- **R9.4** Mã token không tồn tại PHẢI ra trang không tìm thấy, không phải lỗi kỹ thuật.

### R10 — Ranh giới dữ liệu

- **R10.1** Mọi số liệu on-chain PHẢI đi qua `ILedgerPort`.
- **R10.2** Mọi số liệu dạng mẫu PHẢI có nhãn trên giao diện.
- **R10.3** KHÔNG được trộn số liệu thật và số liệu mẫu trong cùng một con số.
- **R10.4** Thành phần giao diện KHÔNG được nhập `viem` hoặc `ethers`.
- **R10.5** Bốn hộp PHẢI tải dữ liệu độc lập: một hộp lỗi thì ba hộp còn lại vẫn hiển thị.

## 2. Ngoài phạm vi

- Đặt lệnh mua (FE-05), nhận lợi tức (FE-09), tất toán (FE-11).
- Kết nối ví và xử lý sai mạng (FE-02). Trang tổng quan chỉ **đọc** trạng thái kết nối.
- Xác thực bằng chữ ký ví (AU-01). Xem câu hỏi mở §3.
- Thị trường thứ cấp, khớp lệnh giữa nhà đầu tư.
- Thêm phương thức đọc số dư token thanh toán vào `ILedgerPort` (BE-01).

## 3. Vấn đề đã biết trước khi làm

### 3.1. Vai hiển thị trên giao diện đang sai (đưa vào phạm vi qua R2.5)

`publicConfig()` trả `role: env.demoRole`, không đọc cookie `bidv_role`. Nên sau khi đổi vai:
`RoleSwitcher` hiển thị sai vai, và `can(config.role, 'token:mint')` trong `mint.tsx` gate sai nút.
Bộ chọn kênh sẽ sai y như vậy nếu đi theo đường đó, nên phải sửa trong task này.

Đây là lỗi hiển thị, không phải lỗ hổng phân quyền: chốt chặn thật vẫn ở `assertCan()` trong service.

### 3.2. Câu hỏi mở — không có ví gắn với phiên

Bản giao (`design.md` §6) yêu cầu "truyền ví khác vào cũng chỉ trả về của ví đang ở phiên".
Hiện **không thể**: chưa có SIWE nên server không biết ví nào thuộc phiên; ví chỉ tồn tại ở client
qua wagmi. Ràng buộc ví ↔ phiên là việc của AU-01.

Cách làm ở task này: service **luôn** lọc theo ví được yêu cầu, không bao giờ trả danh sách chưa
lọc, nên không rò giao dịch của ví khác vào danh sách. Việc chặn người dùng *chủ động* tra ví khác
cần AU-01. Ghi vào checkpoint chờ Owner xác nhận cách hiểu này.

### 3.3. Giá phát hành WPT chưa có nguồn

R6.1 cần giá phát hành, nhưng không có nguồn thật và cũng không được bịa. Xử lý: đặt làm **hằng cấu
hình** thể hiện điều khoản phát hành (như term sheet), không phải giá thị trường, và ghi nhãn đúng
bản chất. Nhờ vậy `số dư thật × giá phát hành` là *thật × tham số cấu hình*, không vi phạm R10.3.
Nếu Owner muốn giá thị trường thì cần thị trường thứ cấp — ngoài phạm vi.

## 4. Điều kiện hoàn thành

- [ ] Bộ chọn kênh có hai lựa chọn, điều hướng đúng, lưu qua lần tải trang.
- [ ] Bộ chọn vai chỉ hiện ở Admin console, chỉ còn ba vai ngân hàng.
- [ ] Giao diện hiển thị đúng vai đang có hiệu lực sau khi đổi vai (R2.5).
- [ ] Cả ba vai ngân hàng **đều bị chặn** khỏi `/portfolio`, có test.
- [ ] Chỉ `INVESTOR` có `portfolio:read`, có test đơn vị.
- [ ] Menu kênh ngân hàng giữ nguyên 6 mục, đối chiếu máy với `dev`.
- [ ] Không trùng đường dẫn giữa ba kênh, đối chiếu máy.
- [ ] Trang tổng quan có đủ bốn hộp theo R5–R8.
- [ ] Số dư WPT đọc từ chuỗi, kiểm được bằng mint thêm rồi tải lại.
- [ ] Lịch sử giao dịch chỉ của ví được yêu cầu, có test đơn vị.
- [ ] Mọi số liệu mẫu có nhãn.
- [ ] Trang chi tiết mở được từ danh sách; mã sai ra trang không tìm thấy.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
- [ ] Checkpoint `docs/CHECKPOINT_FE01_V2.md` có bảng hành vi thật 4 vai × 2 kênh.
