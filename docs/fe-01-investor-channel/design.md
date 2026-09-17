# FE-01 — Kênh nhà đầu tư: design

## 1. Quyết định thiết kế

### QĐ-1: Dùng `balance:read` làm quyền vào kênh

`INVESTOR` hiện có ba quyền: `token:transfer`, `balance:read`, `txn:read`. Trong đó `balance:read` là quyền sát nghĩa "xem được vị thế của mình" nhất.

Lưu ý: `balance:read` và `txn:read` thuộc nhóm chỉ đọc nên **AUDITOR cũng có**. Nghĩa là vai kiểm toán cũng vào được kênh nhà đầu tư. Điều này **chấp nhận được** ở giai đoạn này vì kiểm toán chỉ đọc và không có hàm đặc quyền nào trong kênh. Nếu Owner muốn tách hẳn thì phải thêm quyền mới, việc đó vượt phạm vi task này nên ghi vào câu hỏi mở.

Không dùng `token:transfer` làm quyền vào kênh, vì nó là quyền *hành động*, không phải quyền *xem*.

### QĐ-2: Sidebar nhận cấu hình từ ngoài

Đây là thay đổi duy nhất chạm vào mã dùng chung. Cách làm:

```
components/layout/
  nav-config.ts      (mới)  — định nghĩa menu của từng kênh
  sidebar.tsx        (sửa)  — nhận items qua props, bỏ hằng số ghi cứng
  app-layout.tsx     (sửa)  — truyền tiếp items xuống Sidebar
```

`nav-config.ts` giữ hai hằng số: `BANK_NAV` và `INVESTOR_NAV`. Việc để menu ở một file riêng, không nằm trong `sidebar.tsx`, để sau này thêm kênh thứ tư không phải sửa component.

**Ràng buộc quan trọng:** `BANK_NAV` phải là bản sao đúng từng ký tự của hằng số hiện có trong `sidebar.tsx`, gồm cả phím tắt. Sai một nhãn là gãy kiểm thử đầu cuối hiện có.

### QĐ-3: Giữ nguyên `ChannelGuard`

Guard hiện tại đã đủ dùng: nhận `channel` và `requireAny`, tự đọc vai trò từ phiên. Không sửa file này. Chỉ thêm một layout mới gọi nó với tham số khác.

### QĐ-4: Mục menu chưa có trang thì vô hiệu hóa, không ẩn

Hiện thị mục kèm chú thích "sắp có" và không cho bấm. Lý do: người dùng thấy được lộ trình, và khi FE-05 hay FE-09 xong thì chỉ cần bỏ cờ vô hiệu hóa, không phải sửa cấu trúc menu.

## 2. Cấu trúc tệp

```
app/src/app/(client)/
  layout.tsx                 (mới)  — ChannelGuard + AppLayout với INVESTOR_NAV
  portfolio/page.tsx         (mới)  — trang chỗ trống, FE-04 sẽ thay
  purchase/page.tsx          (mới)  — chỗ trống, FE-05 sẽ thay
  earnings/page.tsx          (mới)  — chỗ trống, FE-09 sẽ thay
  settlement/page.tsx        (mới)  — chỗ trống, FE-11 sẽ thay

app/src/components/layout/
  nav-config.ts              (mới)
  sidebar.tsx                (sửa)  — nhận props
  app-layout.tsx             (sửa)  — truyền props
  role-switcher.tsx          (sửa)  — bổ sung INVESTOR nếu thiếu
```

## 3. Giao diện thành phần

```ts
// nav-config.ts
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  disabled?: boolean;   // mục chưa có trang
};

export type NavSection = {
  main: readonly NavItem[];      // nhóm trên, không tiêu đề
  moduleLabel: string;           // tiêu đề nhóm dưới
  modules: readonly NavItem[];
};

export const BANK_NAV: NavSection;       // sao y hiện trạng
export const INVESTOR_NAV: NavSection;   // mới
```

```ts
// sidebar.tsx
export function Sidebar({ nav }: { nav: NavSection }) { ... }

// app-layout.tsx
export function AppLayout({
  children,
  breadcrumbs,
  nav = BANK_NAV,        // mặc định giữ hành vi cũ để không phá trang hiện có
}: AppLayoutProps) { ... }
```

Đặt `nav` mặc định là `BANK_NAV` để **mọi trang hiện tại không phải sửa gì**. Đây là cách giảm rủi ro phá vỡ trang đang chạy.

## 4. Menu kênh nhà đầu tư

| Nhãn | Đường dẫn | Biểu tượng gợi ý | Phím tắt | Trạng thái |
|---|---|---|---|---|
| Tổng quan | `/portfolio` | LayoutDashboard | E | hoạt động |
| Mua WPT | `/purchase` | ShoppingCart | U | vô hiệu hóa, chờ FE-05 |
| Lợi nhuận | `/earnings` | TrendingUp | L | vô hiệu hóa, chờ FE-09 |
| Tất toán | `/settlement` | Wallet | T | vô hiệu hóa, chờ FE-11 |

Tiêu đề nhóm dưới: "Nghiệp vụ nhà đầu tư".

Biểu tượng theo đúng `frontend.md`: chủ đề gió và turbine cho phần dự án, biểu tượng nghiệp vụ cho phần giao dịch.

## 5. Xung đột đường dẫn cần tránh

Route group không tạo phân đoạn đường dẫn, nên `(client)/portfolio` và `(admin)/portfolio` sẽ **trùng đường dẫn** nếu cùng tên. Bốn đường dẫn trên đã chọn để không trùng với `(admin)`: `/`, `/mint`, `/assets`, `/reconciliation`, `/kyc`, và `(audit)`: `/audit`.

**Không** đặt trang gốc `/` trong `(client)`, vì `(admin)` đã chiếm. Mục "Tổng quan" của nhà đầu tư trỏ tới `/portfolio`.

## 6. Ảnh hưởng tới kiểm thử hiện có

Kiểm thử đầu cuối hiện tại bám vào nhãn menu của kênh ngân hàng. Nếu `BANK_NAV` sao y đúng thì **không test nào gãy**. Chạy `npm run test:e2e` trước và sau khi sửa để đối chiếu.

## 7. Điểm cần chú ý khi phát triển

- `Sidebar` là Client Component (`"use client"`), nhưng `layout.tsx` của route group là Server Component vì `ChannelGuard` bất đồng bộ. Truyền `nav` từ server xuống client được vì nó là dữ liệu tĩnh, **nhưng `icon` là hàm**. Hàm không tuần tự hóa được qua biên server sang client.
  **Cách xử lý:** đặt `nav-config.ts` có `"use client"` ở đầu, và để `AppLayout` là Client Component, hoặc truyền tên biểu tượng dạng chuỗi rồi tra trong bảng ở phía client. Ưu tiên cách thứ hai nếu gặp lỗi tuần tự hóa.
- Không đụng `channel-guard.tsx`, `permissions.ts`, `can.ts`.
- Không thêm phụ thuộc mới.
