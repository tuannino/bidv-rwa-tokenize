# MC-01 — Make Control: điểm cắm, dọn rác, nền cho sơ đồ luồng

| | |
|---|---|
| Mã task | MC-01 |
| Nhóm | Make Control (kiểm soát quá trình làm) |
| Điểm | 8 |
| Ưu tiên | P0 |
| Phụ thuộc | không |
| Nhánh | `mc/01-make-control`, tạo **từ `dev`** |
| Làm trước | BE-03, BE-04 và mọi task BE sau đó |

## 1. Vì sao có task này

Backend là tầng trung gian, nên nó thường **xong trước** phần giao diện và phần hợp đồng sẽ cắm vào. Hiện trạng đã đúng như vậy: Supervisor quét `dev` và tìm thấy **12 hàm đã sẵn sàng nhưng chưa ai gọi**, gồm `placeOrderAction`, `executeOrderAction`, `listOrdersAction`, `expireStaleOrdersAction`, `getDistributionStore`, `getKeeperStore`, `getSettlementStore`.

Nhìn bằng công cụ thông thường thì chúng **giống mã chết**. Thực tế chúng là **điểm cắm đang chờ** FE-05, FE-06, BE-05, BE-06, BE-07. Không có cách nào phân biệt hai loại này, nên:

- Người mới vào dễ xóa nhầm vì tưởng là rác
- Người làm task FE không biết BE đã có sẵn gì, nên viết lại
- Không ai biết còn bao nhiêu điểm cắm chưa dùng

Task này dựng cơ chế để mọi điểm cắm **tự khai báo mình đang chờ ai**, và **tự báo lỗi khi bị bỏ quên**.

Kèm theo là dọn các bất đồng Supervisor đã tìm thấy khi quét, và đặt quy ước để sau này **sinh** được sơ đồ luồng thực thi thay vì vẽ tay.

## 2. Kết quả quét hiện trạng (dữ liệu thật, không phỏng đoán)

Quét trên `dev` @ `71932bb`:

| Hạng mục | Kết quả |
|---|---|
| `TODO` / `FIXME` / `HACK` / `XXX` | **0** — sạch |
| Test bị `skip` hoặc `fixme` | **0** — sạch |
| Export chỉ xuất hiện trong chính tệp nó | **27**, trong đó khoảng 12 là điểm cắm chờ |
| Marker nhắc task khác trong mã | rải rác **33 tệp**, dạng bình luận tự do, không quét được |
| Nguồn giá phát hành WPT | **2 nguồn độc lập** |
| Gói khai trong `package.json` nhưng không ai dùng | **8** |
| Ký hiệu cũ `SPT` / `tVND` trong mã | **0** ✓ (chỉ còn trong tài liệu lịch sử) |

## 3. Yêu cầu chức năng

### R1 — Quy ước marker điểm cắm

- **R1.1** Hệ thống PHẢI có một quy ước bình luận duy nhất để đánh dấu điểm cắm đang chờ task khác.
- **R1.2** Marker PHẢI nêu được: **chờ task nào**, **cắm vào đâu**, **đã sẵn những gì**.
- **R1.3** Marker PHẢI đặt ngay tại chỗ code, KHÔNG đặt trong tài liệu riêng.
- **R1.4** Quy ước PHẢI ghi vào `.kiro/steering/` để Kiro tự nạp mỗi phiên.
- **R1.5** Hệ thống PHẢI chuyển toàn bộ marker dạng bình luận tự do đang có trong 33 tệp sang quy ước mới, hoặc bỏ nếu không còn đúng.

### R2 — Script quét và bảng điểm cắm

- **R2.1** Hệ thống PHẢI có script quét toàn repo, sinh ra bảng điểm cắm đang chờ, nhóm theo task.
- **R2.2** Script PHẢI chạy được độc lập và PHẢI được gọi trong `scripts/run-local-all.sh`.
- **R2.3** Bảng PHẢI cho biết mỗi task đang chờ bao nhiêu điểm cắm và ở tệp nào.
- **R2.4** Script KHÔNG được làm `run-local-all.sh` đỏ chỉ vì còn điểm cắm. Còn điểm cắm là bình thường; đỏ chỉ khi marker sai định dạng hoặc lạc hậu.

### R3 — Test chống marker lạc hậu

- **R3.1** Hệ thống PHẢI có test báo đỏ khi một marker chờ task đã hoàn thành.
- **R3.2** Test PHẢI đọc danh sách task đã hoàn thành từ **một nguồn duy nhất**, không khai hai chỗ.
- **R3.3** Test PHẢI báo đỏ khi marker sai định dạng, ví dụ thiếu mã task hoặc mã task không tồn tại.
- **R3.4** Đây là yêu cầu quan trọng nhất của R1 đến R3: không có test này thì bảng điểm cắm sẽ đầy rác sau vài tháng và không ai còn tin nó.

### R4 — Phân biệt điểm cắm với mã chết thật

- **R4.1** Hệ thống PHẢI rà 27 export hiện chỉ xuất hiện trong chính tệp nó, phân loại thành: điểm cắm chờ task, dùng trong test, hoặc **mã chết thật**.
- **R4.2** Điểm cắm PHẢI được gắn marker theo R1.
- **R4.3** Mã chết thật PHẢI bị xóa.
- **R4.4** Hệ thống PHẢI ghi kết quả phân loại vào checkpoint để Supervisor đối chiếu.

### R5 — Hợp nhất nguồn giá phát hành

- **R5.1** Hệ thống PHẢI hợp nhất hai nguồn giá phát hành WPT hiện có về **một nguồn**.
- **R5.2** Hiện `lib/bank/issuance.ts` và `lib/ledger/mock.adapter.ts` giữ hai hằng số độc lập cùng ý nghĩa. Đổi một chỗ thì test vẫn xanh nhưng giá hiển thị lệch giá khớp lệnh.
- **R5.3** Hệ thống PHẢI có test chứng minh hai chỗ không thể lệch nhau nữa.
- **R5.4** Task này CHỈ hợp nhất nguồn. Việc chuyển giá vào cơ sở dữ liệu thuộc **BE-04**.

### R6 — Dọn phụ thuộc không dùng

- **R6.1** Hệ thống PHẢI rà 8 gói khai trong `package.json` mà không tệp nào dùng.
- **R6.2** Nhóm `@radix-ui/*` (5 gói): `components/ui` đã chuyển sang `@base-ui`, không tệp nào còn dùng radix. PHẢI xác minh rồi gỡ.
- **R6.3** `react-hook-form` và `@hookform/resolvers`: chưa dùng. Nếu FE-05 sẽ dùng thì **giữ và gắn marker**; nếu không thì gỡ.
- **R6.4** `react-dom`: là phụ thuộc bắt buộc của React, **KHÔNG được gỡ** dù grep không thấy.
- **R6.5** Sau khi gỡ, `npm run build` và toàn bộ test PHẢI vẫn xanh.

### R7 — Làm rõ `src/empty.ts`

- **R7.1** `src/empty.ts` là tệp giữ chỗ cho `@x402/*` và `@vercel/og`, dùng để dựng ảnh Cloudflare. Nó tạo 12 export lạ và 1 cảnh báo lint đang tồn tại.
- **R7.2** Hệ thống PHẢI xác minh `@x402/*` có thật sự cần thiết không, vì không gói nào trong `package.json` khai nó.
- **R7.3** Nếu không cần, PHẢI gỡ các alias tương ứng khỏi `next.config.ts` và thu gọn `src/empty.ts`.
- **R7.4** Nếu còn cần, PHẢI gắn marker và ghi rõ lý do vào nợ kỹ thuật, kèm điều kiện xóa.
- **R7.5** Hệ thống PHẢI xử lý cảnh báo lint còn lại, hoặc ghi rõ vì sao không xử lý được.

### R8 — Sửa dương tính giả của script lớp 3

- **R8.1** Script `verify-arch-rules.sh` đang quét ký hiệu cũ `SPT` / `tVND` trong cả `docs/`, nên báo FAIL vì các checkpoint lịch sử nhắc lại ký hiệu cũ một cách có chủ đích.
- **R8.2** Hệ thống PHẢI giới hạn phép quét vào mã nguồn và kiểm thử, loại trừ tài liệu lịch sử.
- **R8.3** Sau khi sửa, script PHẢI cho **0 FAIL** trên `dev` hiện tại.

### R9 — Nền cho sơ đồ luồng thực thi

- **R9.1** Hệ thống PHẢI có quy ước đánh dấu hàm thuộc luồng nghiệp vụ nào và ở bước thứ mấy.
- **R9.2** Quy ước PHẢI đủ để **sinh** sơ đồ luồng từ mã nguồn, không vẽ tay.
- **R9.3** Hệ thống PHẢI có script sinh sơ đồ dạng Mermaid cho **ít nhất một luồng đã hoàn thành** làm mẫu, ví dụ luồng mua WPT.
- **R9.4** Sơ đồ PHẢI cho biết luồng đi qua tệp nào, hàm nào, theo thứ tự nào.
- **R9.5** Task này chỉ cần dựng cơ chế và làm mẫu một luồng. Các luồng còn lại gắn dần khi làm task tương ứng.

### R10 — Cập nhật quy tắc và tài liệu

- **R10.1** Quy ước marker và quy ước sơ đồ luồng PHẢI ghi vào `.kiro/steering/`.
- **R10.2** `tech-report.md` PHẢI có mục điểm cắm đang chờ, và mục đó PHẢI **sinh tự động** từ script, KHÔNG gõ tay.
- **R10.3** `tech-report-maintenance.md` PHẢI bổ sung quy tắc: thêm điểm cắm thì gắn marker, dùng hết điểm cắm thì xóa marker.

## 4. Ngoài phạm vi

- Chuyển giá phát hành vào cơ sở dữ liệu (thuộc **BE-04**).
- Bảng dự án lưu tổng cung mỗi dự án (thuộc **BE-04**).
- Cột `is_config` trong bảng vai trò (thuộc **BE-04**).
- Gắn marker sơ đồ luồng cho mọi luồng (làm dần theo từng task).
- Sửa logic nghiệp vụ. Task này không đổi hành vi hệ thống.

## 5. Điều kiện hoàn thành

- [ ] Quy ước marker có trong `.kiro/steering/`, đủ ba thông tin ở R1.2.
- [ ] Toàn bộ marker tự do trong 33 tệp đã chuyển sang quy ước mới hoặc bị bỏ.
- [ ] Script quét chạy được, có trong `run-local-all.sh`, sinh bảng nhóm theo task.
- [ ] Test chống marker lạc hậu hoạt động: thử đánh dấu một task đã xong là **đỏ**.
- [ ] 27 export đã phân loại xong; mã chết thật đã xóa; điểm cắm đã gắn marker.
- [ ] Giá phát hành còn **một** nguồn, có test chống lệch.
- [ ] Gói không dùng đã gỡ; `npm run build` và test vẫn xanh.
- [ ] `src/empty.ts` đã làm rõ: gỡ hoặc gắn marker kèm điều kiện xóa.
- [ ] `verify-arch-rules.sh` cho **0 FAIL** trên `dev`.
- [ ] Sinh được sơ đồ Mermaid cho luồng mua WPT từ mã nguồn.
- [ ] `tech-report.md` có mục điểm cắm sinh tự động.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
