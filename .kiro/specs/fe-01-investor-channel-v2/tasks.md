# FE-01 v2 — Kênh nhà đầu tư và trang tổng quan: tasks

Nhánh `feat/investor-channel-v2`, tạo từ `dev` @ `5982a4e`. Phương án C: tự chứa trên `dev`,
KHÔNG lấy nền từ `feat/investor-channel`.

---

## Bước 1: Quyền vào kênh nhà đầu tư

- [ ] 1.1 Thêm `portfolio:read` vào `ACTIONS` (`permissions.ts`).
- [ ] 1.2 Cấp cho **chỉ** `INVESTOR`. **Không** đưa vào `READ_ONLY` — đó là lý do v1 thất bại.
- [ ] 1.3 Thêm ca vào `app/test/rbac.test.ts`: chỉ `INVESTOR` có `portfolio:read`; ba vai còn lại không.

*Commit:* `feat(rbac): quyền portfolio:read chỉ cho nhà đầu tư`

---

## Bước 2: Cookie kênh, và sửa vai hiển thị

- [ ] 2.1 Tạo `lib/session/channel.ts` (`server-only`): `CHANNEL_COOKIE`, `Channel`, `currentChannel()` mặc định `admin`.
- [ ] 2.2 Thêm `setChannel` vào `app/actions/session.ts`, đặt **cả hai** cookie theo bảng `design.md` QĐ-1.
- [ ] 2.3 Giá trị lạ bỏ qua im lặng; gọi `refresh()` sau khi đặt cookie.
- [ ] 2.4 `publicConfig()` thành `async`: `role` lấy từ `currentRole()` (cookie), thêm `channel`.
- [ ] 2.5 `src/app/layout.tsx`: `await publicConfig()`.

**Kiểm chứng:** đổi vai rồi tải lại, giao diện hiển thị đúng vai vừa chọn.

*Commit:* `feat(session): cookie kênh và vai hiển thị đọc từ cookie`

---

## Bước 3: Điều hướng theo kênh

- [ ] 3.1 Tạo `nav-config.ts` là **dữ liệu thuần**, `icon` là **tên dạng chuỗi** (`NavIconName`).
- [ ] 3.2 `BANK_NAV` sao y hiện trạng `sidebar.tsx`: đủ 6 mục, không đổi nhãn/phím tắt.
- [ ] 3.3 `INVESTOR_NAV`: `/portfolio` + ba mục `disabled` (`/purchase`, `/earnings`, `/settlement`).
- [ ] 3.4 `sidebar.tsx`: nhận `nav` qua props, thêm bảng `NAV_ICONS` tra tên → component.
- [ ] 3.5 Mục `disabled` KHÔNG bọc `Link`, có `aria-disabled`, kèm chú thích "sắp có".
- [ ] 3.6 `app-layout.tsx`: nhận `nav`, mặc định `BANK_NAV` để trang cũ không phải sửa.

**Kiểm chứng:** menu kênh ngân hàng không đổi một ký tự; đối chiếu máy với `dev`.

*Commit:* `feat(layout): điều hướng theo kênh, tách nav-config`

---

## Bước 4: Route group (client) + guard

- [ ] 4.1 Tạo `(client)/layout.tsx` với `ChannelGuard requireAny={['portfolio:read']}`.
- [ ] 4.2 Không tạo trang cho `/purchase`, `/earnings`, `/settlement` (nav đã `disabled`).
- [ ] 4.3 Đối chiếu máy: không trùng đường dẫn giữa ba kênh.

**Kiểm chứng:** ba vai ngân hàng vào `/portfolio` đều thấy màn từ chối.

*Commit:* `feat(client): route group kênh nhà đầu tư có guard`

---

## Bước 5: Bộ chọn kênh, sửa bộ chọn vai

- [ ] 5.1 Tạo `channel-switcher.tsx`, đúng hai lựa chọn.
- [ ] 5.2 Đổi kênh xong điều hướng: nhà đầu tư → `/portfolio`, admin → `/`.
- [ ] 5.3 `role-switcher.tsx`: bỏ `INVESTOR`, còn ba vai ngân hàng.
- [ ] 5.4 `header.tsx`: luôn hiện bộ chọn kênh; **chỉ** hiện bộ chọn vai khi `channel === 'admin'`.
- [ ] 5.5 Giữ chú thích rằng đây là cơ chế demo, không phải xác thực thật.

*Commit:* `feat(layout): tách bộ chọn kênh và bộ chọn vai`

---

## Bước 6: Service đọc vị thế

- [ ] 6.1 Tách `authorize()` và `toResult()` sang `lib/bank/authorize.ts`; `mint.service.ts` import lại.
- [ ] 6.2 Tạo `lib/bank/issuance.ts`: hằng giá phát hành, ghi rõ là điều khoản phát hành.
- [ ] 6.3 Tạo `portfolio.service.ts`: `getPortfolio`, `getWalletTransactions`.
- [ ] 6.4 Kiểm quyền `portfolio:read` **trong service**, ghi audit cả hai kết cục.
- [ ] 6.5 Lọc ví **trong service** — luôn truyền `wallet` xuống `listTxns`.
- [ ] 6.6 Trả số lượng/số tiền dạng **chuỗi**.
- [ ] 6.7 KHÔNG thêm trường số dư VNDB (chưa có phương thức đọc) — ghi nợ vào checkpoint.
- [ ] 6.8 Tạo `app/actions/portfolio.ts`, vỏ mỏng.

*Commit:* `feat(portfolio): service đọc vị thế và lịch sử của nhà đầu tư`

---

## Bước 7: Bốn hộp

- [ ] 7.1 `mock-data.ts`: thêm `tokenSymbol`, `onChain` cho `WindProject`.
- [ ] 7.2 `mock-badge.tsx`: nhãn dữ liệu mẫu dùng chung.
- [ ] 7.3 `asset-summary.tsx`: số dư WPT + giá trị theo giá phát hành. Chưa kết nối ví thì mời kết nối, **không** hiện 0.
- [ ] 7.4 `issuance-status-box.tsx`: giá phát hành, tổng cung, đang lưu hành, trạng thái dự án. **Không** giá giao dịch/biến động/khối lượng.
- [ ] 7.5 `transaction-history-box.tsx`: giao dịch của ví, `explorerTxUrl` khi chuỗi có trình khám phá, có trạng thái rỗng.
- [ ] 7.6 `token-list-box.tsx`: 3 dự án, mỗi dòng có đường dẫn chi tiết, phân biệt on-chain/mẫu.
- [ ] 7.7 Gắn nhãn mẫu theo bảng `design.md` §4.
- [ ] 7.8 Mỗi hộp tự gọi server action và tự giữ trạng thái lỗi (R10.5).

*Commit:* `feat(portfolio): bốn hộp của trang tổng quan nhà đầu tư`

---

## Bước 8: Trang tổng quan và trang chi tiết

- [ ] 8.1 `investor-portfolio.tsx` ghép bốn hộp.
- [ ] 8.2 `(client)/portfolio/page.tsx` dùng `AppLayout nav={INVESTOR_NAV}`.
- [ ] 8.3 `(client)/tokens/[symbol]/page.tsx` + `investor-token-detail.tsx`.
- [ ] 8.4 Trang chi tiết bốn phần theo `design.md`, tái dùng cách trình bày của `assets.tsx`.
- [ ] 8.5 Mã token không tồn tại → `notFound()`.

*Commit:* `feat(portfolio): trang tổng quan và trang chi tiết dự án token`

---

## Bước 9: Kiểm thử

- [ ] 9.1 `app/test/portfolio-service.test.ts`: lọc ví, và vai không có quyền bị từ chối.
- [ ] 9.2 `app/e2e/investor-channel.spec.ts` viết mới: đổi kênh bằng bộ chọn kênh.
- [ ] 9.3 Test: ba vai ngân hàng đều bị chặn khỏi `/portfolio`.
- [ ] 9.4 Test: ở kênh nhà đầu tư không hiển thị bộ chọn vai.
- [ ] 9.5 Test: đổi sang Admin console khi đang là nhà đầu tư thì vai thành `BANK_ADMIN`.
- [ ] 9.6 Test: trang tổng quan hiện đủ bốn hộp.
- [ ] 9.7 Test: mở được trang chi tiết từ danh sách token.
- [ ] 9.8 Test: mã token sai ra trang không tìm thấy.
- [ ] 9.9 Test: menu hai kênh không lẫn nhau.

*Commit:* `test(portfolio): kiểm thử tách kênh và trang tổng quan`

---

## Bước 10: Tài liệu và checkpoint

- [ ] 10.1 Cập nhật `tech-report.md`: bảng kênh, cây thư mục, ma trận quyền, bản đồ code.
- [ ] 10.2 Ghi bài học: mô hình kênh tường minh, và cạm bẫy tuần tự hóa `icon`.
- [ ] 10.3 Viết `docs/CHECKPOINT_FE01_V2.md`.

*Commit:* `docs: cập nhật báo cáo công nghệ cho mô hình kênh v2`

---

## Việc KHÔNG được làm

- Không dùng cookie kênh làm cơ sở phân quyền.
- Không đưa `portfolio:read` vào `READ_ONLY`.
- Không đọc cookie kênh trong `lib/bank/`.
- Không sửa `channel-guard.tsx`, `can.ts`, `currentRole()`.
- Không hiển thị giá giao dịch, biến động giá, khối lượng giao dịch như số liệu thật.
- Không trộn số liệu thật với số liệu mẫu trong cùng một con số.
- Không tạo nguồn dữ liệu dự án thứ hai — dùng `MOCK_PROJECTS`.
- Không nhập `viem`/`ethers` vào thành phần giao diện.
- Không thêm phương thức vào `ILedgerPort` (đó là BE-01).
- Không làm đặt lệnh mua, nhận lợi tức, tất toán.
- Không đổi nhãn hay phím tắt menu kênh ngân hàng.

## Câu hỏi cần Owner chốt

1. **Ràng buộc ví ↔ phiên** (requirements §3.2): chưa có SIWE nên chỉ lọc chặt theo ví được yêu cầu,
   không chặn được người dùng chủ động tra ví khác. Xác nhận cách hiểu này đủ cho FE-01 v2.
2. **Giá phát hành** (requirements §3.3): dùng hằng cấu hình như điều khoản phát hành. Nếu muốn giá
   thị trường thì cần thị trường thứ cấp, ngoài phạm vi.
3. **Số dư VNDB**: ẩn cho tới khi BE-01 thêm phương thức đọc số dư token thanh toán.

## Checkpoint

`docs/CHECKPOINT_FE01_V2.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn.
2. Bảng hành vi thật: bốn vai × hai kênh, vào được hay bị chặn.
3. Bảng nguồn dữ liệu từng hộp: thật hay mẫu, đã gắn nhãn chưa.
4. Deviation của phương án C so với bản giao của Owner.
5. Câu hỏi mở.
