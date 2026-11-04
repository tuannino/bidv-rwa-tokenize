# FE-UX-03c: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/vault.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a, 02b, 03a, 03b.

## 1. Bố cục (1440 px; dưới 1100 px một cột)

| Khối | Bố cục |
|---|---|
| Đầu màn | `h1` "Vault thanh toán SPV" và `TokenScopeSelect` một hàng |
| Trạng thái hiện tại | Lưới 12 cột, 4 `Kpi` một hàng, mỗi ô 3 cột (từ 640 px hai cột, dưới đó một cột), theo đúng thứ tự trường: "Số dư VNDB" `au` cỡ `lg` (chữ số lớn, KHÔNG chiếm 2 hàng), "Số VNDB đang khoá", "Số dư WPT", "VNDB có thể rút" `gold`. Dưới là thẻ 12 cột (tiêu đề "Trạng thái hiện tại" giữ như hiện tại, `CardTitleIcon` `Landmark`) chứa 7 trường còn lại theo thứ tự, lưới `grid-cols-[repeat(auto-fill,minmax(190px,1fr))]`, nhãn nhỏ trên, giá trị dưới; địa chỉ `font-code break-all` hiện đủ; Trạng thái rút `Badge`; câu tỷ lệ chờ áp `Alert info` giữ `role="note"` cuối thẻ |
| Cấu hình khoá | Thẻ 12 cột, `CardTitleIcon` `KeyRound`; câu giới thiệu; câu chỉ xem `Alert info`; câu đang bận `Alert info` `role="status"`; form: nhóm chế độ dạng nút chuyển (QĐ-4) trải ngang, dưới là ô theo chế độ có hậu tố "%" hoặc "VNDB" trong khung ô, lỗi ô, câu hiệu lực; nút Lưu ở cuối; kết quả `Alert` có danh sách bước `<ol>` |
| Lịch sử cấu hình | Thẻ 12 cột, `CardTitleIcon` `History`, bảng giữ `aria-label`, `data-param`, phân trang như hiện tại, rỗng `EmptyState` |
| Lệnh rút cần xem xét | Thẻ 12 cột, `CardTitleIcon` `TriangleAlert`, nút "Đối soát lệnh rút" `outline` có biểu tượng `RefreshCw`; mỗi dòng `WithdrawReviewItem` là ô nền nhạt bo 18 px (`bg-muted/60`), số tiền đậm `tabular-nums`, mã `font-code`; ô chốt dùng `fieldClass` |
| Lịch sử chốt kỳ | Thẻ 12 cột, `CardTitleIcon` `CalendarCheck`, bảng như hiện tại (không thêm `aria-label`), mã giao dịch qua hàm link cục bộ |

## 2. Nhóm chế độ khoá (QĐ-4)

```tsx
<div role="radiogroup" aria-label="Chế độ khoá" className="inline-flex flex-wrap gap-1 rounded-full bg-muted p-1">
  {CONFIG_MODES.map((m) => (
    <label key={m.value} className="relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium
      has-[:checked]:bg-primary has-[:checked]:text-primary-foreground
      has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:opacity-60">
      <input type="radio" name={...} value={m.value} checked={...} onChange={...} disabled={...}
        className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed" />
      {m.label}
    </label>
  ))}
</div>
```

Giữ nguyên `name`, `value`, `checked`, `onChange`, `disabled`, chữ nhãn. Bấm chuột, phím mũi tên, vòng tiêu điểm do e2e ca 2 kiểm tự động; kiểm tay thêm: vai chỉ xem thì mờ và không đổi được. `label` không dùng lớp `shadow-*` (vòng tiêu điểm là `box-shadow` duy nhất, e2e dựa vào đó).

## 3. Kiểm thử mới

`app/test/fe-ux-03c.test.ts` (môi trường `node`):

1. Đọc mã nguồn `src/components/pages/vault-status.tsx`: đúng 1 `getVaultOverviewAction(`, 1 `getVaultConfigHistoryAction(`, 2 `listWithdrawReviewsAction(`, 3 `useEffect(` (dev xác nhận các số này trên mốc trước khi viết, ghi trong checkpoint).
2. Dựng `WithdrawReviewItem` bằng `renderToStaticMarkup` với dòng giả đủ kiểu `WithdrawReviewView` (gồm `chain`, `purpose`, `note`, `txHash`, `payoutTxHash`, `reason`, `candidates`):

| Trạng thái giả | Kỳ vọng |
|---|---|
| `NEEDS_REVIEW`, `canResolve: true`, `busy: false`, có 1 ứng viên | có ô "Mã giao dịch xác nhận {id}", nút "Xác nhận hoàn tất" và "Đánh dấu thất bại" mở; câu ứng viên có mã cắt 8 ký tự và số block |
| `NEEDS_REVIEW`, không ứng viên | câu ứng viên kết thúc "không có" |
| `PAYOUT_REVIEW`, `canResolve: true`, có `payoutTxHash` | KHÔNG có nút "Xác nhận hoàn tất" hay ô mã giao dịch; có ô "Lý do thất bại {id}" và nút "Đánh dấu thất bại"; câu "Lệnh dừng ở bước đặt ví nhận (giao dịch …)" |
| `busy: true` (cả hai trạng thái) | mọi nút có `disabled` |
| `canResolve: false` (cả hai trạng thái) | không có ô và nút nào |

Mọi trạng thái: phần tử gốc có `data-request={id}`.

`app/e2e/fe-ux-03c-vault.spec.ts` (chỉ chạy trên project mock; KHÔNG lưu cấu hình, không đối soát). Trên máy chủ mới, theo thứ tự tên tệp vault đang `UNSET`, danh sách rỗng; nhưng khi chạy cục bộ `reuseExistingServer` (`playwright.config.ts:92`) có thể dùng lại máy chủ cũ đã qua `vault-withdraw` (vault `FIXED`). Vì vậy ca 1 đọc chế độ từ màn, còn hằng số `role` ở ca 2 đo và ghi trên máy chủ MỚI (chú thích trong test). Ca 2 LUÔN chạy đủ phần tương tác và phân quyền; CHỈ phép đếm `role` nằm trong `if (mode === 'UNSET')`, nhánh còn lại ghi `test.info().annotations.push({ type: 'bo-dem-role', description })` VÀ `console.log('BO-DEM-ROLE ' + description)` (reporter `list` không in annotation, chỉ in stdout). KHÔNG gọi `test.skip()` (nó bỏ cả ca). CI luôn dùng máy chủ mới (`reuseExistingServer` tắt khi `CI`); log CI và log dev nộp kèm PR không được có dòng `BO-DEM-ROLE` (dev chạy khi cổng e2e trống):

| Ca | Kiểm |
|---|---|
| 1 | Kiểm soát viên và Giao dịch viên: 4 `[data-kpi]` đúng thứ tự nhãn Số dư VNDB (`au`), Số VNDB đang khoá (`default`), Số dư WPT (`default`), VNDB có thể rút (`gold`). Thẻ trạng thái: đọc chế độ khoá đang hiện trên màn; nếu "Chưa cấu hình" (`UNSET`) thì đúng 5 nhãn theo thứ tự Chế độ khoá, Lợi nhuận chia quý trước, Ngày cấu hình có hiệu lực, Địa chỉ vault, Trạng thái rút; nếu `FIXED` thì thêm "Mức khoá cố định" sau Chế độ khoá; nếu `PERCENT` thì thêm "Tỷ lệ áp" ở vị trí đó |
| 2 | Đọc `mode` từ màn như ca 1. Đếm `role` (dưới đây) NGAY sau khi tải, TRƯỚC mọi tương tác (chọn chế độ làm hiện thêm `role="note"`). Kiểm soát viên: trong `radiogroup` "Chế độ khoá", `getByLabel('Khoá số cố định').click()` (KHÔNG dùng `check()`: radio đã chọn sẵn thì `check()` không bấm, không lấy tiêu điểm) rồi `toBeChecked()`, `getByLabel('Tỷ lệ khoá (%)')` đếm 0 và `getByLabel('Số khoá cố định (VNDB)')` hiện; `label` chứa radio đó có `box-shadow` là `none` (bấm chuột không hiện vòng). Bàn phím: `page.keyboard.press('ArrowLeft')` thì radio "Theo tỷ lệ %" `toBeChecked()` và `toBeFocused()`, `evaluate((e) => e.matches(':focus-visible'))` là `true`, `label` của nó có `box-shadow` khác `none`, ô `Tỷ lệ khoá (%)` hiện và ô số cố định đếm 0; KHÔNG bấm Lưu. Giao dịch viên: các radio có `disabled`. Phép đếm: `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` sau khi tải xong (chờ `networkidle` rồi chờ `[data-kpi]` hiện), hai vai, bằng hằng số đo trên mốc như 03b |
| 3 | 1440 và 390 px, hai vai: `scrollWidth` không vượt bề rộng; không `console` loại `error`, không sự kiện `pageerror`, không cảnh báo hydrate |

Luồng lưu cấu hình, rút, lịch sử có dữ liệu do `vault-withdraw.spec.ts` phủ trên mock và Hardhat.
