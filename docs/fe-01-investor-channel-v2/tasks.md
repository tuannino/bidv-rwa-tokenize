# FE-01 v2 — Tách kênh và trang tổng quan nhà đầu tư: tasks

Nhánh `feat/investor-channel-v2`, tạo **từ `dev`** sau khi FE-01 v1 đã merge.

Nếu v1 chưa merge vào `dev`, **dừng và báo**, không lấy nền từ nhánh v1. Xem `branching.md` mục 5.

---

## Bước 1: Thêm quyền vào kênh nhà đầu tư

- [ ] 1.1 Thêm `portfolio:read` vào `ACTIONS` trong `permissions.ts`.
- [ ] 1.2 Gán cho **chỉ** `INVESTOR`. **Không** đưa vào `READ_ONLY`, vì đó là lý do v1 thất bại.
- [ ] 1.3 Đổi guard của `(client)/layout.tsx` sang `requireAny={['portfolio:read']}`.
- [ ] 1.4 Cập nhật ghi chú trong layout: bỏ đoạn cảnh báo về `balance:read` không chặn được ai.
- [ ] 1.5 Bỏ nhãn `fixme` của test "vai BANK_ADMIN không vào được kênh nhà đầu tư", làm cho nó xanh.
- [ ] 1.6 Thêm test tương tự cho `COMPLIANCE` và `AUDITOR`.
- [ ] 1.7 Bổ sung test trong `app/test/rbac.test.ts`: chỉ `INVESTOR` có `portfolio:read`.
- [ ] 1.8 Xóa món nợ P1 về quyền vào kênh khỏi `tech-report.md` mục 1.6.C.

**Kiểm chứng:** cả ba vai ngân hàng đều bị chặn khỏi `/portfolio`.

*Commit:* `feat(rbac): quyền portfolio:read chỉ cho nhà đầu tư`

---

## Bước 2: Cookie kênh và hành động đổi kênh

- [ ] 2.1 Tạo `lib/session/channel.ts` với `server-only`, đọc cookie `bidv_channel`, mặc định `admin`.
- [ ] 2.2 Thêm `setChannel` vào `app/actions/session.ts`.
- [ ] 2.3 `setChannel` PHẢI đặt **cả hai** cookie theo bảng ở `design.md` mục QĐ-1, trong một lần gọi.
- [ ] 2.4 Giá trị lạ thì bỏ qua im lặng, giống cách `setDemoRole` đang làm.
- [ ] 2.5 Gọi `refresh()` sau khi đặt cookie.
- [ ] 2.6 Đưa kênh hiện tại ra `publicConfig()` trong `flags.ts`.

*Commit:* `feat(session): cookie kênh và hành động đổi kênh`

---

## Bước 3: Bộ chọn kênh và sửa bộ chọn vai

- [ ] 3.1 Tạo `components/layout/channel-switcher.tsx` với đúng hai lựa chọn.
- [ ] 3.2 Đổi kênh xong điều hướng: nhà đầu tư về `/portfolio`, admin về `/`.
- [ ] 3.3 Sửa `role-switcher.tsx`: bỏ lựa chọn `INVESTOR`, chỉ còn ba vai ngân hàng.
- [ ] 3.4 Rút gọn hằng `CHANNEL_HOME` còn ba vai ngân hàng.
- [ ] 3.5 Sửa `header.tsx`: luôn hiện bộ chọn kênh, **chỉ** hiện bộ chọn vai khi kênh là admin.
- [ ] 3.6 Giữ chú thích rằng đây là cơ chế demo, không phải xác thực thật.

**Kiểm chứng:** ở kênh nhà đầu tư không thấy bộ chọn vai; ở Admin console thấy cả hai bộ chọn.

*Commit:* `feat(layout): tách bộ chọn kênh và bộ chọn vai`

---

## Bước 4: Service đọc vị thế

- [ ] 4.1 Tạo `lib/bank/portfolio.service.ts` với `getPortfolio` và `getWalletTransactions`.
- [ ] 4.2 Kiểm quyền `portfolio:read` **trong service**, ghi sổ kiểm toán cho cả hai kết cục.
- [ ] 4.3 Lọc theo ví **trong service**. Truyền ví khác vào thì không trả dữ liệu của ví đó.
- [ ] 4.4 Số dư token đọc qua `ILedgerPort.balanceOf`, số liệu token qua `tokenInfo`.
- [ ] 4.5 Lịch sử giao dịch đọc qua `ITxnStore.listTxns` có lọc ví.
- [ ] 4.6 Trả số lượng và số tiền dạng **chuỗi**.
- [ ] 4.7 Nếu `paymentBalanceOf` chưa có vì BE-01 chưa merge, bỏ trường số dư VNDB và ghi nợ vào checkpoint.
- [ ] 4.8 Tạo `app/actions/portfolio.ts`, vỏ mỏng.

*Commit:* `feat(portfolio): service đọc vị thế và lịch sử của nhà đầu tư`

---

## Bước 5: Bốn hộp của trang tổng quan

- [ ] 5.1 `components/investor/asset-summary.tsx`: số lượng token, giá trị quy đổi, số dư VNDB. Chưa kết nối ví thì mời kết nối, **không** hiện số 0.
- [ ] 5.2 `components/investor/market-status-box.tsx`: giá phát hành, tổng cung, đang lưu hành, trạng thái dự án. **Không** hiển thị biến động giá hay khối lượng giao dịch.
- [ ] 5.3 `components/investor/transaction-history-box.tsx`: danh sách giao dịch của ví, có liên kết tra cứu khi chuỗi có trình khám phá, có trạng thái rỗng.
- [ ] 5.4 `components/investor/token-list-box.tsx`: ba dự án từ `MOCK_PROJECTS`, mỗi dòng có đường dẫn chi tiết.
- [ ] 5.5 Gắn **nhãn dữ liệu mẫu** cho mọi số liệu chưa có nguồn thật, theo bảng ở `design.md` mục 3.
- [ ] 5.6 Bốn hộp tải dữ liệu độc lập, một hộp lỗi thì ba hộp còn lại vẫn hiển thị.

*Commit:* `feat(portfolio): bốn hộp của trang tổng quan nhà đầu tư`

---

## Bước 6: Trang tổng quan và trang chi tiết token

- [ ] 6.1 Tạo `components/pages/investor-portfolio.tsx` ghép bốn hộp.
- [ ] 6.2 Thay nội dung `(client)/portfolio/page.tsx`, bỏ trang chỗ trống.
- [ ] 6.3 Tạo `(client)/tokens/[symbol]/page.tsx` và `components/pages/investor-token-detail.tsx`.
- [ ] 6.4 Trang chi tiết có bốn phần theo `design.md` mục 5, tái dùng cách trình bày của màn dự án hiện có.
- [ ] 6.5 Mã token không tồn tại thì trả trang không tìm thấy.
- [ ] 6.6 Thêm mục "Danh mục đầu tư" vào `INVESTOR_NAV` nếu cần, giữ ba mục còn lại ở trạng thái chưa khả dụng.

*Commit:* `feat(portfolio): trang tổng quan và trang chi tiết dự án token`

---

## Bước 7: Kiểm thử

- [ ] 7.1 Cập nhật `app/e2e/investor-channel.spec.ts`: đổi kênh bằng bộ chọn kênh thay vì đổi vai.
- [ ] 7.2 Test: ba vai ngân hàng đều bị chặn khỏi `/portfolio`.
- [ ] 7.3 Test: ở kênh nhà đầu tư không hiển thị bộ chọn vai.
- [ ] 7.4 Test: đổi sang Admin console khi đang là nhà đầu tư thì vai thành cán bộ ngân hàng.
- [ ] 7.5 Test: trang tổng quan hiện đủ bốn hộp.
- [ ] 7.6 Test: lịch sử giao dịch chỉ của ví đang kết nối.
- [ ] 7.7 Test: bấm chi tiết ở danh sách token mở được trang chi tiết.
- [ ] 7.8 Test: mã token không tồn tại thì ra trang không tìm thấy.
- [ ] 7.9 Test đơn vị cho service: truyền ví khác không lấy được dữ liệu ví đó.
- [ ] 7.10 Chạy `bash scripts/run-local-all.sh`.

*Commit:* `test(portfolio): kiểm thử tách kênh và trang tổng quan`

---

## Bước 8: Tài liệu

- [ ] 8.1 Cập nhật `tech-report.md`: bảng kênh mục 1.1, cây thư mục mục 1.4, ma trận quyền mục 3.3, bản đồ code.
- [ ] 8.2 Xóa nợ P1 về quyền vào kênh khỏi mục 1.6.C.
- [ ] 8.3 Ghi bài học về mô hình kênh tường minh vào mục 1.6.B.
- [ ] 8.4 Cập nhật metadata.

*Commit:* `docs: cập nhật báo cáo công nghệ cho mô hình kênh v2`

---

## Việc KHÔNG được làm

- **Không dùng cookie kênh làm cơ sở phân quyền.** Cookie do người dùng đặt được. Phân quyền vẫn qua vai và RBAC.
- Không đưa `portfolio:read` vào `READ_ONLY`.
- Không đọc cookie kênh trong `lib/bank/`.
- Không hiển thị giá giao dịch, biến động giá, khối lượng giao dịch như số liệu thật. Chưa có thị trường thứ cấp.
- Không trộn số liệu thật với số liệu mẫu trong cùng một con số.
- Không tạo nguồn dữ liệu dự án thứ hai. Dùng `MOCK_PROJECTS`.
- Không nhập `viem` hoặc `ethers` vào thành phần giao diện.
- Không làm đặt lệnh mua, nhận lợi nhuận, tất toán.
- Không sửa `channel-guard.tsx`, `can.ts`, `currentRole()`.

## Câu hỏi cần Owner chốt nếu gặp

- Nếu cần cảm giác thị trường cho bản trình diễn (biến động giá, khối lượng), **ghi câu hỏi mở**, không tự thêm. Đây là số liệu không có nguồn thật.
- Nếu muốn hai dự án mẫu có số dư on-chain, phải triển khai thêm token, vượt phạm vi task này.

## Checkpoint

`docs/CHECKPOINT_FE01_V2.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn.
2. Bảng hành vi thật: bốn vai nhân hai kênh, vào được hay bị chặn.
3. Bảng nguồn dữ liệu từng hộp: thật hay mẫu, đã gắn nhãn chưa.
4. Deviation, câu hỏi mở, sai lệch phát hiện được.
