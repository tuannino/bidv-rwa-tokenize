# withdraw.html: Rút VNDB (Nhà đầu tư)

- Màn thật: `/withdraw` (trang chờ, chưa có phần thân)
- Tệp đã đọc: `app/src/app/(investor)/withdraw/page.tsx` (ghi chú `@pending FE-23`), `app/src/components/pages/placeholder.tsx` (`PlaceholderPage`).
- Breadcrumbs: Nhà đầu tư | Rút VNDB. Vai: investor. Menu sáng: withdraw.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Rút VNDB" | `title` | |
| Badge "chờ FE-23" | `Badge` `chờ {task}` | |
| Câu "Nhà đầu tư chuyển VNDB trong ví về tài khoản ngân hàng của mình." | `purpose` | |
| Thẻ viền đứt "Màn hình chưa dựng" | Card `border-dashed`, `CardTitle` | Biểu tượng hộp thay cho Construction |
| "Khung điều hướng và kiểm quyền của trang này đã chạy. Task FE-23 chỉ thay phần thân." | đoạn đầu `CardContent` | Đặt trong khối `empty` có biểu tượng |
| Mục "Đã sẵn", 2 dòng | `ready[]` | Dạng `checks` có dấu tích |
| Thẻ vàng "Lưu ý", 2 dòng | `notes[]` | Gạch dài trong dòng thứ hai đổi thành dấu phẩy |

Kiểu cục bộ: `.notes` (danh sách có biểu tượng tròn vàng), `.sect` (nhãn mục), viền đứt bằng `var(--line)`.

## Thay đổi chỉ là trình bày
- Một thẻ hẹp ở giữa thành hai thẻ bento: "Màn hình chưa dựng" (7 cột) và "Lưu ý" (5 cột, nền vàng).
- Không thêm biểu mẫu rút tiền: màn thật chưa có.

## Có đụng backend không
Trang xem thử: Không. Nhưng chính màn thật ghi rõ nghiệp vụ rút VNDB của nhà đầu tư CHƯA có ở tầng backend (chưa có service, chưa có quyền RBAC). Khi FE-23 dựng phần thân thì bắt buộc cần task backend tương ứng; bản xem thử cố ý không vẽ biểu mẫu rút.

## Lệch đã thấy
- Menu và tài liệu gọi là "Rút VNDB" cho nhà đầu tư, nhưng `withdraw.service.ts` hiện chỉ phục vụ người bán (`vault:withdraw`); dễ nhầm là đã có nghiệp vụ.
