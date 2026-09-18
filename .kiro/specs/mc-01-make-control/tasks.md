# MC-01 — Make Control: tasks

Nhánh `mc/01-make-control`, tạo **từ `dev`**.

Task này **không đổi hành vi hệ thống**. Mọi test đang xanh phải xanh nguyên, không sửa test để hợp với code mới.

---

## Bước 1: Chốt quy ước và nguồn trạng thái task

- [x] 1.1 Tạo `.kiro/steering/make-control.md` với `inclusion: always`, ghi quy ước `@pending`, `@blocked`, `@flow` theo `design.md` mục 1 và 5.
- [x] 1.2 Tạo `.kiro/task-status.json` với danh sách `done` hiện tại: FE-01, FE-02, BE-01, BE-02, BE-08, BE-09.
- [x] 1.3 Ghi vào steering: ai cập nhật tệp này và cập nhật lúc nào.

*Commit:* `feat(mc): quy ước marker điểm cắm và nguồn trạng thái task`

---

## Bước 2: Script quét marker

- [x] 2.1 Tạo `scripts/scan-pending.mjs` với ba chế độ theo `design.md` mục 2.
- [x] 2.2 Chế độ `--check` trả mã thoát khác 0 **chỉ khi** marker sai định dạng, mã task không tồn tại, hoặc chờ task đã `done`. Còn điểm cắm là bình thường.
- [x] 2.3 Cắm vào `scripts/run-local-all.sh`: chạy `--check`, in bảng ở phần tổng kết.
- [x] 2.4 Chạy thử trên `dev` hiện tại, xác nhận script đọc được marker tự do đang có hoặc báo đúng là sai định dạng.

*Commit:* `feat(mc): script quét điểm cắm`

---

## Bước 3: Chuyển marker tự do sang quy ước mới

- [x] 3.1 Rà **33 tệp** đang có bình luận nhắc task khác (danh sách trong `requirements.md` mục 2).
- [x] 3.2 Mỗi chỗ: chuyển sang `@pending` nếu code đã chạy được và chờ người gọi; `@blocked` nếu chưa chạy được.
- [x] 3.3 Bỏ marker không còn đúng, ví dụ nhắc task đã hoàn thành.
- [x] 3.4 Giữ nguyên nội dung thông báo lỗi `LedgerNotImplementedError`; marker là thứ **thêm vào**, không thay thế.
- [x] 3.5 Chạy `scan-pending.mjs`, xác nhận bảng ra đúng và không còn marker sai định dạng.

*Commit:* `refactor(mc): chuyển marker tự do sang quy ước @pending và @blocked`

---

## Bước 4: Test chống marker lạc hậu

- [x] 4.1 Tạo `app/test/pending-markers.test.ts` với 4 ca theo `design.md` mục 3.
- [x] 4.2 **Kiểm chứng bằng đột biến:** thêm tạm `BE-02` vào marker của một tệp, chạy test, phải **đỏ**. Ghi kết quả vào checkpoint rồi hoàn nguyên.
- [x] 4.3 Kiểm ca mã task không tồn tại: thử `@pending XX-99`, phải đỏ.

*Commit:* `test(mc): chống marker lạc hậu và sai định dạng`

---

## Bước 5: Phân loại 27 export

- [x] 5.1 Lấy danh sách bằng cách quét export chỉ xuất hiện trong chính tệp nó.
- [x] 5.2 Phân loại từng cái theo bảng ở `design.md` mục 6.
- [x] 5.3 Điểm cắm → gắn marker với mã task đúng.
- [x] 5.4 Dùng nội bộ → bỏ từ khóa `export`.
- [x] 5.5 Mã chết thật → **xóa**. Với `evmTestnet`, `hardhatLocal`, `getSigner`: xóa thử rồi chạy `npm run build` để xác minh, vì chúng có thể dùng gián tiếp.
- [x] 5.6 Dùng trong test → xác minh test có gọi thật, không cần marker.
- [x] 5.7 Ghi **bảng phân loại đầy đủ 27 dòng** vào checkpoint.

*Commit:* `refactor(mc): phân loại và dọn export không dùng`

---

## Bước 6: Hợp nhất nguồn giá phát hành

- [x] 6.1 Kiểm chiều phụ thuộc trước khi làm: `lib/ledger` nhập từ `lib/bank` có ngược tầng không.
- [x] 6.2 Nếu ngược tầng, đặt hằng số ở chỗ trung lập (`lib/config` hoặc `packages/shared`), cả hai cùng nhập. **Ghi lựa chọn và lý do vào checkpoint.**
- [x] 6.3 `mock.adapter.ts` nhập giá thay vì khai lại `DEFAULT_WPT_PRICE_VND`.
- [x] 6.4 Tạo `app/test/issue-price-single-source.test.ts`: đọc giá từ nguồn duy nhất, gọi `quotePurchase` trên mock, xác nhận bằng nhau.
- [x] 6.5 **Kiểm chứng bằng đột biến:** đổi giá ở nguồn duy nhất thành số khác, chạy test, phải vẫn xanh (vì cả hai cùng đổi). Rồi thử tách lại thành hai hằng số, phải đỏ.

*Commit:* `refactor(mc): hợp nhất nguồn giá phát hành WPT`

---

## Bước 7: Dọn phụ thuộc và làm rõ `src/empty.ts`

- [x] 7.1 Xác minh 5 gói `@radix-ui/*` không còn ai dùng (`components/ui` đã chuyển sang `@base-ui`), rồi gỡ.
- [x] 7.2 `react-hook-form` và `@hookform/resolvers`: hỏi xem FE-05 có dùng không. Nếu có thì giữ và gắn marker `@pending FE-05`; nếu không thì gỡ. **Không tự quyết, ghi câu hỏi mở nếu chưa rõ.**
- [x] 7.3 **KHÔNG gỡ `react-dom`.**
- [x] 7.4 Sau mỗi lần gỡ, chạy `npm run build` **và** toàn bộ test.
- [x] 7.5 Xác minh `@x402/*` có cần thiết không: không gói nào trong `package.json` khai nó.
- [x] 7.6 Nếu không cần, gỡ alias khỏi `next.config.ts` và thu gọn `src/empty.ts`. Kiểm nhánh `fix/cloudflare-opennext-build` trước khi gỡ.
- [x] 7.7 Nếu còn cần, gắn marker và ghi vào nợ kỹ thuật kèm **điều kiện xóa**.
- [x] 7.8 Xử lý cảnh báo lint còn lại, hoặc ghi rõ vì sao không xử lý được.

*Commit:* `chore(mc): dọn phụ thuộc không dùng và làm rõ src/empty.ts`

---

## Bước 8: Sửa dương tính giả của script lớp 3

- [x] 8.1 Giới hạn phép quét ký hiệu cũ `SPT` / `tVND` vào mã nguồn và kiểm thử, loại trừ `docs/`.
- [x] 8.2 Chạy `verify-arch-rules.sh`, xác nhận **0 FAIL** trên `dev` hiện tại.
- [x] 8.3 Kiểm chứng script vẫn bắt được vi phạm thật: thêm tạm `SPT` vào một tệp trong `app/src`, phải đỏ. Hoàn nguyên.

*Commit:* `fix(mc): script lớp 3 không còn dương tính giả với tài liệu lịch sử`

---

## Bước 9: Nền cho sơ đồ luồng

- [x] 9.1 Gắn `@flow purchase:<n>` cho luồng mua WPT, từ tầng vận chuyển xuống tầng nghiệp vụ và tầng cổng.
- [x] 9.2 Số bước cách nhau 1, bắt đầu từ 1, không trùng, không nhảy cách.
- [x] 9.3 Tạo `scripts/gen-flow-diagram.mjs`, sinh Mermaid theo `design.md` mục QĐ-5.
- [x] 9.4 Sinh `docs/flows/purchase.md`.
- [x] 9.5 Thêm ca kiểm vào `pending-markers.test.ts`: số bước trong cùng luồng không trùng và không nhảy cách.
- [x] 9.6 Mở sơ đồ ra xem, xác nhận nó **đọc được và đúng thứ tự thật** của luồng.

*Commit:* `feat(mc): sinh sơ đồ luồng thực thi từ marker`

---

## Bước 10: Tài liệu

- [~] 10.1 Thêm mục điểm cắm đang chờ vào `tech-report.md`, nội dung **sinh từ script**, kèm ghi chú là phần sinh tự động.
- [~] 10.2 Bổ sung `tech-report-maintenance.md`: thêm điểm cắm thì gắn marker, dùng hết thì xóa marker, hoàn thành task thì cập nhật `.kiro/task-status.json`.
- [~] 10.3 Cập nhật mục nợ kỹ thuật: xóa món đã trả, thêm món mới nếu `src/empty.ts` còn phải giữ.
- [~] 10.4 Cập nhật metadata.

*Commit:* `docs(mc): cập nhật báo cáo công nghệ và quy tắc duy trì`

---

## Việc KHÔNG được làm

- Không đổi hành vi hệ thống. Không sửa logic nghiệp vụ.
- Không sửa test đang xanh để hợp với code mới.
- Không gỡ `react-dom`.
- Không xóa export mà chưa chạy `npm run build` để xác minh.
- Không gõ tay mục điểm cắm trong `tech-report.md`. Phải sinh từ script.
- Không dùng số thập phân cho số bước `@flow`.
- Không tự quyết việc gỡ `react-hook-form` nếu chưa rõ FE-05 có dùng.
- Không gắn `@flow` cho luồng chưa hoàn thành ở tầng BE.

## Checkpoint

`docs/CHECKPOINT_MC01.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn, gồm cả bảng điểm cắm mà script in ra.
2. **Bảng phân loại đầy đủ 27 export**: mỗi dòng ghi loại và xử lý.
3. Kết quả **ba lần kiểm chứng bằng đột biến**: test marker lạc hậu, test nguồn giá, script lớp 3.
4. Lựa chọn về chỗ đặt hằng số giá và lý do.
5. Kết luận về `@x402/*` và `src/empty.ts`: gỡ hay giữ, vì sao.
6. Sơ đồ luồng mua WPT sinh được, dán vào checkpoint.
7. Deviation, câu hỏi mở, sai lệch phát hiện được.
