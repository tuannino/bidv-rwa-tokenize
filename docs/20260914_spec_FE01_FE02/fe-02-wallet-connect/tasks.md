# FE-02 — Màn kết nối ví: tasks

Nhánh: `feat/wallet-connect`, tạo **từ `dev`** sau khi FE-01 đã merge vào `dev`.

Nếu FE-01 chưa merge, **dừng và báo**, không lấy nền từ nhánh `feat/investor-channel`. Xem `.kiro/steering/branching.md` mục 5.

---

## Bước 1: Hook gom trạng thái ví

- [ ] 1.1 Tạo `lib/hooks/use-wallet-status.ts` theo giao diện trong `design.md` mục 1.
- [ ] 1.2 Hiện thực đúng **thứ tự ưu tiên** ở `design.md` mục QĐ-3. Đặt `mock` lên trước tất cả.
- [ ] 1.3 Dùng `useIsMounted` có sẵn cho trạng thái `loading`. Không tự viết lại.
- [ ] 1.4 Xử lý trường hợp chuỗi đang chọn còn rỗng ở lần kết xuất đầu.
- [ ] 1.5 Xử lý chuỗi `stellar`: trả trạng thái chưa hỗ trợ ví, không cố kết nối.
- [ ] 1.6 `canSign` chỉ đúng khi trạng thái là `ready` hoặc `mock`.

**Kiểm chứng:** viết unit test cho hàm quyết định trạng thái, phủ đủ 7 nhánh.

*Commit:* `feat(wallet): hook gom trạng thái kết nối ví`

---

## Bước 2: Các thành phần hiển thị

- [ ] 2.1 `components/wallet/no-wallet-guide.tsx`: hướng dẫn khi chưa cài ví, tiếng Việt dễ hiểu.
- [ ] 2.2 `components/wallet/wrong-chain-banner.tsx`: dải cảnh báo sai chuỗi, nhận chuỗi hiện tại và chuỗi cần chuyển, có nút chuyển. Viết tách riêng để FE-05, FE-09, FE-11 tái dùng.
- [ ] 2.3 `components/wallet/wallet-status-card.tsx`: địa chỉ rút gọn, tên chuỗi, số dư native, nút sao chép, liên kết tra cứu, nút ngắt kết nối.
- [ ] 2.4 Ẩn liên kết tra cứu khi chuỗi không có trình khám phá, không hiện liên kết chết.
- [ ] 2.5 Ghi nhãn rõ số dư native là tiền của mạng thử, không phải VNDB.

*Commit:* `feat(wallet): thành phần hiển thị trạng thái ví`

---

## Bước 3: Chuyển chuỗi

- [ ] 3.1 Hiện thực `switchToExpected` trong hook, dùng `useSwitchChain` của wagmi.
- [ ] 3.2 Khi ví chưa biết chuỗi đích, yêu cầu ví thêm chuỗi, thông số lấy từ `CHAINS` trong `packages/shared`. **Không ghi cứng.**
- [ ] 3.3 Người dùng từ chối thì giữ nguyên cảnh báo, không lặp lại yêu cầu.
- [ ] 3.4 Không tự động chuyển chuỗi khi chưa có hành động của người dùng.

**Kiểm chứng:** thử trên ví thật với một chuỗi lạ, xác nhận có hộp thoại thêm chuỗi và từ chối không gây vòng lặp.

*Commit:* `feat(wallet): chuyển và thêm chuỗi theo yêu cầu người dùng`

---

## Bước 4: Trang kết nối ví

- [ ] 4.1 Tạo `components/pages/wallet-connect.tsx` ghép các thành phần theo bảng trạng thái ở `design.md` mục 3.
- [ ] 4.2 Tạo `app/(client)/wallet/page.tsx`.
- [ ] 4.3 Thêm mục "Ví của tôi" vào `INVESTOR_NAV`, trạng thái hoạt động.
- [ ] 4.4 Hiển thị khung chờ ở trạng thái `loading`, không để trống nhảy nội dung.

*Commit:* `feat(client): trang kết nối ví cho nhà đầu tư`

---

## Bước 5: Đổi ví và ngắt kết nối giữa phiên

- [ ] 5.1 Đổi tài khoản trong ví thì địa chỉ cập nhật ngay, không cần tải lại trang.
- [ ] 5.2 Ngắt kết nối thì trở về trạng thái chưa kết nối và xóa dữ liệu đang hiển thị.
- [ ] 5.3 Không lưu địa chỉ ví vào lưu trữ trình duyệt làm nguồn sự thật.

*Commit:* `fix(wallet): xử lý đổi ví và ngắt kết nối giữa phiên`

---

## Bước 6: Kiểm thử

- [ ] 6.1 Unit test cho hàm quyết định trạng thái, phủ 7 nhánh.
- [ ] 6.2 Thêm `app/e2e/wallet-connect.spec.ts`.
- [ ] 6.3 Ca thử: chế độ `mock` thì không đòi ví, không cảnh báo sai chuỗi.
- [ ] 6.4 Ca thử: không có ví được tiêm thì hiện hướng dẫn, không lỗi kỹ thuật.
- [ ] 6.5 Ca thử: không có lỗi lệch kết xuất trong bảng điều khiển khi tải trang.
- [ ] 6.6 Kiểm luật kiến trúc: `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` phải rỗng.
- [ ] 6.7 Chạy `bash scripts/run-local-all.sh`, xanh toàn bộ.

*Commit:* `test(wallet): kiểm thử các trạng thái kết nối ví`

---

## Bước 7: Cập nhật tài liệu

- [ ] 7.1 Cập nhật `tech-report.md`: cây thư mục, bản đồ code phần components và hooks.
- [ ] 7.2 Ghi vào mục bài học nếu gặp cạm bẫy mới về lệch kết xuất hoặc hành vi ví.
- [ ] 7.3 Cập nhật metadata đầu báo cáo.

*Commit:* `docs: cập nhật báo cáo công nghệ cho màn kết nối ví`

---

## Việc KHÔNG được làm

- Không sửa `lib/wagmi.ts`, `lib/hooks/use-is-mounted.ts`, `lib/chains/chain-store.ts`.
- Không nhập `viem` hoặc `ethers` vào thành phần giao diện.
- Không gọi hợp đồng nào. Đọc số dư WPT và VNDB thuộc FE-04.
- Không dùng địa chỉ ví để cấp quyền. Xác thực thuộc AU-01.
- Không thêm phụ thuộc mới. RainbowKit và wagmi đã có.
- Không bỏ dự phòng khi thiếu `NEXT_PUBLIC_WC_PROJECT_ID`.

## Checkpoint phải nộp

`docs/CHECKPOINT_FE02.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn.
2. Ảnh chụp **cả 7 trạng thái** ví. Trạng thái nào không dựng được thì ghi rõ lý do.
3. Bảng: đã thử trên ví nào, chuỗi nào, kết quả.
4. Deviation, câu hỏi mở, sai lệch phát hiện được.
