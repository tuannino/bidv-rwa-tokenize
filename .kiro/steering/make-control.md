---
inclusion: always
---

# Quy ước điểm cắm, điểm chặn và sơ đồ luồng

Backend là tầng trung gian nên nó thường **xong trước** phần giao diện và phần hợp đồng sẽ
cắm vào. Hệ quả: trong `app/src` có những hàm đã chạy được nhưng **chưa ai gọi**. Bằng công
cụ thông thường chúng trông giống mã chết, nên người vào sau dễ xóa nhầm, còn người làm task
giao diện thì không biết backend đã có sẵn gì và viết lại từ đầu.

Ba marker dưới đây làm cho mỗi chỗ như vậy **tự khai báo mình đang chờ ai**. Marker là bình
luận, nhưng có cú pháp cố định để **máy đọc được** — đó là điều kiện để script quét và test
chống marker lạc hậu hoạt động.

---

## 1. `@pending` — điểm cắm đang chờ người gọi

```
@pending <MÃ-TASK> | <đã sẵn những gì>
```

Nghĩa: **code ĐÃ CHẠY ĐƯỢC, chỉ chưa ai gọi.** Task ghi trong marker là task sẽ gọi vào.

Ví dụ thật, `app/src/app/actions/purchase.ts` — bốn server action là vỏ mỏng quanh
`purchase.service`, đã xong đầu cuối ở tầng backend từ BE-02, chờ màn hình mua WPT của FE-05:

```ts
// @pending FE-05 | placeOrderAction đã sẵn: validate Zod + kiểm quyền + ghi sổ kiểm toán, tất cả trong service
export async function placeOrderAction(input: unknown) {
  return placeOrder(input);
}
```

Phần sau dấu `|` viết cho người đọc, tự do nhưng phải nói **đã sẵn gì**, không phải "chờ
làm". Lý do: người nhận task FE-05 đọc marker là để biết mình **không cần viết lại** cái gì.
Ghi "chờ làm giao diện" thì không giúp được gì, còn ghi "đã sẵn validate + kiểm quyền + ghi
sổ" thì họ biết ngay chỉ phải gọi.

---

## 2. `@blocked` — điểm chặn, chưa chạy được

```
@blocked <MÃ-TASK> | <thiếu gì>
```

Nghĩa: **code CHƯA chạy được, đang ném lỗi.** Task ghi trong marker là task phải xong trước
thì mới nối được.

Ví dụ thật, `app/src/lib/ledger/evm.adapter.ts` — ba method chờ hợp đồng phát hành một lần
của SC-02, hiện ném `LedgerNotImplementedError`:

```ts
// @blocked SC-02 | thiếu hợp đồng phát hành một lần: ProjectToken.mint gọi được nhiều lần, không có cờ "đã phát hành"
async mintInitialSupply() {
  return pendingContract('mintInitialSupply', 'hợp đồng phát hành một lần (SC-02)');
}
```

Marker là thứ **thêm vào**, không thay thế. Giữ nguyên nội dung `LedgerNotImplementedError`:
thông báo lỗi dành cho người chạy vào lúc chạy thật, marker dành cho script quét.

---

## 3. Vì sao phải phân biệt hai loại

| Loại | Marker | Trạng thái code | Việc của task được nhắc |
|---|---|---|---|
| Chờ người cắm vào | `@pending FE-05 \| ...` | Đã chạy được | **Chỉ cần gọi** |
| Chờ phụ thuộc | `@blocked SC-02 \| ...` | Đang ném lỗi | **Phải xong trước**, rồi mới nối được |

Gộp hai loại làm một thì mất đúng thông tin cần dùng để lập kế hoạch:

- Gặp `@pending`, task sau **làm được ngay**. Ước lượng nhỏ, không phụ thuộc ai.
- Gặp `@blocked`, task sau **chưa làm được**. Xếp nó vào lịch trước khi phụ thuộc xong là
  nhận về một task bị treo giữa đường.

Dùng sai marker còn tệ hơn không có marker, vì nó trả lời sai một câu hỏi mà người đọc tin
là đã được trả lời. Chưa chắc code chạy được hay chưa thì chạy thử, đừng đoán.

---

## 4. `@flow` — vị trí trong luồng nghiệp vụ

```
@flow <tên-luồng>:<số bước> | <việc của bước này>
```

Tên luồng dùng mã ngắn, **chỉ năm tên sau**, không tự đặt thêm:

| Tên luồng | Nghiệp vụ |
|---|---|
| `purchase` | Nhà đầu tư mua WPT |
| `issue` | Ngân hàng phát hành WPT |
| `distribute` | Chia lợi nhuận theo sản lượng |
| `settle` | Tất toán / hoàn vốn |
| `onboard` | KYC và whitelist ví |

```ts
// @flow purchase:3 | nhận lệnh từ giao diện, chuyển tiếp sang service
export async function placeOrderAction(input: unknown) { ... }

// @flow purchase:4 | validate, kiểm quyền, tính giá, lưu lệnh PLACED
export async function placeOrder(input: unknown) { ... }
```

Quy tắc số bước: **bắt đầu từ 1, cách nhau 1, không trùng, không nhảy cách.** Cần chèn một
bước vào giữa thì **đánh số lại cả luồng**, tuyệt đối không dùng số thập phân (`purchase:3.5`
là sai). Lý do: số nguyên liên tiếp làm cho "thiếu bước" trở thành thứ máy phát hiện được —
có bước 4 mà không có bước 3 là dấu hiệu ai đó xóa hàm và quên sửa marker. Cho phép số thập
phân là bỏ mất phép kiểm đó.

Chỉ gắn `@flow` cho luồng **đã hoàn thành đầu cuối** ở tầng backend. Gắn cho luồng còn dở
sinh ra sơ đồ mô tả thứ chưa tồn tại.

---

## 5. Ba từ khóa trên là từ khóa duy nhất

Cấm mọi biến thể: `@waiting`, `@blocked-by`, `@todo`, `@pending-on`, `TODO`, `FIXME`, `HACK`,
`XXX`.

Không phải chuyện thẩm mỹ. Script quét khớp theo từ khóa cố định, nên mỗi biến thể là một
điểm cắm **vô hình** với công cụ: không vào bảng, không bị test bắt khi lạc hậu. Cần diễn đạt
khác thì viết thêm ở phần sau dấu `|`, đừng đổi từ khóa.

Cần ghi chú không thuộc ba loại trên thì viết bình luận thường, không gắn marker.

---

## 6. Marker đặt ngay trên khai báo

Đặt marker ở dòng ngay trên `function` / `const` / method mà nó nói về. **Không** tập trung
vào một tài liệu riêng, **không** đặt ở đầu tệp cho cả tệp.

Lý do: lúc xóa marker (vì task đã xong, điểm cắm đã được dùng) thì phải thấy ngay code liên
quan để kiểm rằng nó thật sự đã được gọi. Marker nằm ở tài liệu riêng sẽ lệch mã nguồn ngay
lần refactor đầu tiên, và không ai biết nó đã lệch.

---

## 7. `.kiro/task-status.json` — nguồn duy nhất về trạng thái task

Tệp này là nguồn duy nhất cho **hai** việc:

1. Task nào đã xong (`done`) — để test bắt được marker chờ task đã hoàn thành.
2. Tập **mã task hợp lệ** — hợp của `done` + `inProgress` + `planned`. Marker ghi mã ngoài
   tập này là sai định dạng.

Bất biến: **một mã task chỉ được xuất hiện ở đúng một trong ba danh sách.** Trùng ở hai danh
sách thì trạng thái của nó không xác định, và phép kiểm "marker chờ task đã done" cho kết quả
tùy thuộc thứ tự đọc.

Dùng tệp dữ liệu thay vì đọc từ `docs/tech-report.md` vì tài liệu là văn bản tự do: phân tích
được nhưng vỡ ngay khi ai đó đổi cách diễn đạt. JSON thì máy đọc chắc chắn, và người sửa thấy
rõ mình đang đổi trạng thái task.

### Ai cập nhật, lúc nào, cái gì

| | |
|---|---|
| **Ai** | Kiro. Không phải Supervisor, không phải Owner. |
| **Lúc nào** | Trong **commit cuối của mỗi task**, cùng lúc với cập nhật `docs/tech-report.md` (theo `docs/tech-report-maintenance.md` mục 3). Không hẹn "cuối phase làm một thể". |
| **Cái gì** | (a) Chuyển mã task từ `planned` hoặc `inProgress` sang `done`. (b) **Dọn mọi marker đang chờ task đó** — `@pending` đã được gọi thì xóa marker; `@blocked` đã nối được thì xóa marker. |

Vế (b) không phải việc tùy tâm. Bỏ qua nó thì `scripts/scan-pending.mjs --check` và
`app/test/pending-markers.test.ts` báo đỏ, và `scripts/run-local-all.sh` đỏ theo. Đó là chủ
đích: nếu dọn marker chỉ là "nhớ thì làm" thì sau vài tháng bảng điểm cắm đầy rác và không ai
còn tin nó — lúc đó cả cơ chế này vô dụng.

Ngược lại, **còn điểm cắm là bình thường**, không làm đỏ bất cứ thứ gì. Đỏ chỉ khi marker sai
cú pháp, mã task không có trong `task-status.json`, hoặc marker chờ task đã `done`.

---

## 8. Công cụ

Hai script dưới đây thuộc phạm vi MC-01: `scan-pending.mjs` ở Bước 2, `gen-flow-diagram.mjs`
ở Bước 9. Nếu một lệnh báo không tìm thấy tệp thì bước tương ứng **chưa** được làm — đọc
`.kiro/specs/mc-01-make-control/tasks.md` để biết trạng thái, đừng kết luận là môi trường lỗi.

| Lệnh | Dùng khi |
|---|---|
| `node scripts/scan-pending.mjs` | In bảng điểm cắm cho người đọc, nhóm theo task |
| `node scripts/scan-pending.mjs --json` | Cho test và cho script sinh tài liệu |
| `node scripts/scan-pending.mjs --check` | Mã thoát khác 0 nếu marker sai cú pháp / sai mã task / lạc hậu |
| `node scripts/gen-flow-diagram.mjs <tên-luồng>` | Sinh sơ đồ Mermaid từ marker `@flow`, ghi ra `docs/flows/<tên-luồng>.md` |

Sơ đồ luồng **sinh từ marker, không vẽ tay**. Sinh lại được bất cứ lúc nào nên nó không lạc
hậu so với mã. Sửa tay tệp trong `docs/flows/` là sai: lần sinh sau sẽ ghi đè, và trong
khoảng thời gian trước đó thì sơ đồ nói một đằng, mã làm một nẻo.
