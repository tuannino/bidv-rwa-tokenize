# FE-UX-06a: thiết kế

Không có bản chốt riêng cho ba màn (kế hoạch 03/11: "chỉ áp hệ thiết kế"). Mẫu trình bày lấy từ các màn đã làm: hàng ô số liệu như `/seller` (05a), thẻ danh sách có thanh lọc như `/seller/transactions` (05a), trạng thái rỗng như `/withdraw` (04d). Thành phần: dùng nguyên API của FE-UX-02a đến 05a. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`; mọi `col-span` kèm tiền tố mốc.

## 1. Bố cục (1440 px)

| Màn, khối | Bố cục |
|---|---|
| Đầu màn (cả ba) | Hàng `flex flex-wrap items-start justify-between gap-4`: trái `HoverHint` bọc `h1` rồi `SampleDataNote` cùng hàng (`flex flex-wrap items-baseline gap-2`); phải nhóm nút khoá và chú thích "Chưa hỗ trợ trong PoC" (`flex flex-wrap items-center gap-2`) |
| `/assets` ô số liệu | 4 `Kpi` một hàng từ 1100 px, 2 cột từ 640 px; có biểu tượng; sắc `default`, `default`, `hl`, `leaf` |
| `/assets` danh sách | `Card`: thanh lọc hai nhóm Vùng, Trạng thái (viên nang `FilterBtn`) và chữ "{n} kết quả" canh phải; `Table` 8 cột (Mã & Tên dự án, Vùng, Công suất, WPT phát hành, Sản lượng luỹ kế, Trạng thái, Vận hành từ, TX Hash), ba cột số canh phải `tabular-nums`; rỗng `EmptyState` biểu tượng `Wind`; dòng "Hiển thị …" chữ nhỏ cuối thẻ |
| `/kyc` ô số liệu | 4 `Kpi` một hàng từ 1100 px, 2 cột từ 640 px; sắc `hl`, `default`, `gold`, `default` |
| `/kyc` danh sách | `Card`: ô tìm có biểu tượng; hai nhóm lọc Cấp KYC, Trạng thái; "0 kết quả"; `Table` chỉ tiêu đề 8 cột; `EmptyState` biểu tượng `UserCheck` với hai câu (câu sau có `/mint` dạng `font-code`); hàng cuối "Hiển thị 0–0 / 0 nhà đầu tư" bên trái, hai nút phân trang khoá bên phải |
| `/reconciliation` | 3 thẻ nguồn một hàng từ 640 px; 3 `Kpi` một hàng từ 640 px, sắc `hl`, `default`, (`gold` nếu có kỳ lệch, không thì `default`); `Card` danh sách: lọc Dự án, "{n} kỳ"; `Table` chỉ tiêu đề 7 cột; `EmptyState` biểu tượng `Scale`; dòng "Hiển thị 0–0 / 0 kỳ đối soát" |

390 px: một cột; thanh lọc xuống dòng; bảng cuộn trong `[data-slot="table-container"]`; `main` không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b). Ô màu vùng của `/assets` giữ cách tô theo biến `--chart-*` hiện có (không phải màu cứng). `Kpi` `hl`, `gold`, `leaf` đọc được ở Sáng và Tối (kiểm ảnh).
- Không thêm `role`. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác, bằng mốc (e2e ca 1).
- Chữ tiêu đề cột giữ nguyên; lớp chữ hoa (`uppercase tracking-wide`) của tiêu đề cột cũ bỏ theo kiểu `Table` chung.

## 3. Kiểm thử mới

`app/test/fe-ux-06a.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`; `AssetsPage` chắc chắn cần giả `useSelectedChain` vì `TxLink` gọi nó và `usePublicConfig` ném lỗi khi thiếu `ConfigProvider`: dùng `vi.mock('@/lib/chains/use-selected-chain', () => ({ useSelectedChain: () => ({ chain: 'mock' }) }))` (chain không có explorer nên `TxLink` ra `span`); `HoverHint`, `DropdownMenu` dự kiến dựng được, dev xác nhận ở tasks bước 3, không dựng được thì `vi.mock` đúng mô-đun đó và ghi checkpoint; đếm ô tiêu đề bảng bằng `data-slot="table-head"`, không đếm chuỗi `<th`):

1. **Mã nguồn** (ba trang và `filter-button.tsx`): ba trang không có `Action(`, `useEffect(`, `function StatCard`, `function KpiCard`, `function FilterBtn`, `const GRID`, `rounded-lg border`, `-destructive`, `\x27destructive\x27`; mỗi trang khớp đúng một lần regex `/import \{ FilterBtn \} from ["']@\/components\/ops\/filter-button["']/` (ba trang đang dùng nháy kép); `filter-button.tsx` có `export function FilterBtn` và `aria-pressed={active}`; `reconciliation.tsx` có nguyên văn `MOCK_WIND_STATS.pendingReconciliations > 0 ? 'gold' : 'default'` (hoặc cùng biểu thức với nháy kép); không lớp `col-span-` thiếu tiền tố mốc; `assets.tsx` có nguyên văn "Gia Lai, Quảng Trị, Đắk Lắk: gió mùa ổn định", "Ninh Thuận, Bình Thuận: hệ số công suất cao", "Bạc Liêu, Trà Vinh: móng trụ trong bãi bồi", và không còn U+00B7, U+2014 trên dòng nào trừ dòng chú thích (cùng quy tắc 6e).
2. **`FilterBtn`:** `active: true` cho `type="button"`, `aria-pressed="true"`, lớp `bg-primary`; `active: false` cho `aria-pressed="false"`, không lớp `bg-primary`; chữ đúng `label`.
3. **Ba trang** (dựng cả trang):

| Trang | Kỳ vọng |
|---|---|
| `AssetsPage` | 4 `[data-kpi]` đúng thứ tự nhãn Dự án điện gió, Tổng công suất đặt, WPT đã phát hành, Sản lượng luỹ kế và `data-tone` `default`, `default`, `hl`, `leaf`; 8 ô `data-slot="table-head"` đúng thứ tự chữ; số `<tr` trong `tbody` bằng `MOCK_PROJECTS.length`; mỗi dòng có chữ "CF " và chuỗi "%, ", không U+00B7; nút có `aria-label="Làm mới"` và nút chữ "Thêm dự án" đều có `disabled` và `aria-describedby="assets-poc-note"`, đúng `id` của phần tử chữ "Chưa hỗ trợ trong PoC" (chữ này đúng 1 lần); "(đang hiển thị dữ liệu mẫu)" có, nằm ngoài `<h1` |
| `KycPage` | 4 `[data-kpi]` nhãn Tổng nhà đầu tư, Đã whitelist, Chờ duyệt KYC, Đang đóng băng, `data-tone` `hl`, `default`, `gold`, `default`, giá trị đều "0"; 8 ô `data-slot="table-head"` đúng thứ tự; `[data-slot="empty-state"]` chứa "Chưa có nhà đầu tư nào trong danh sách." và câu Phase 4; phần tử đầu tiên có lớp `font-code` trong HTML có chữ "/mint"; hai nút "Trang trước", "Trang sau" có `disabled`; nút `aria-label="Làm mới"` có `disabled` và `aria-describedby="kyc-poc-note"`; "Chưa hỗ trợ trong PoC" đúng 1 lần |
| `ReconciliationPage` | 3 thẻ nguồn chữ SCADA nhà máy, Hoá đơn EVN, On-chain, "Chờ nối ở Phase 3" đúng 3 lần; 3 `[data-kpi]` nhãn Kỳ đã đối soát khớp, Sản lượng đã đối soát, Kỳ lệch chờ xử lý, `data-tone` `hl`, `default`, rồi `gold` nếu `MOCK_WIND_STATS.pendingReconciliations > 0` không thì `default`; ô Sản lượng đã đối soát có đơn vị "MWh" tách khỏi số; 7 ô `data-slot="table-head"` đúng thứ tự; `EmptyState` chứa "Chưa có kỳ nào để đối soát."; nút chữ "Làm mới dữ liệu" có `disabled` và `aria-describedby="reconciliation-poc-note"`; "Chưa hỗ trợ trong PoC" đúng 1 lần |

`app/e2e/fe-ux-06a-man-mau.spec.ts` (chỉ project mock, vai Giao dịch viên; không đổi dữ liệu). Chờ tải: `networkidle`.

| Ca | Kiểm |
|---|---|
| 1 | Ba màn ở 1440 px: đúng một `h1` trong `main` (chữ như `fix-05-tong-quan.spec.ts:52-54`); "(đang hiển thị dữ liệu mẫu)" hiện; `[data-kpi]` đúng 4, 4, 3 và cùng hàng (lệch đỉnh dưới 4 px); `/reconciliation` 3 thẻ nguồn cùng hàng; bảng nằm trong `[data-slot="table-container"]`; chữ "Chưa hỗ trợ trong PoC" hiện; đếm `role` bằng mốc. 390 px: các `[data-kpi]` một cột (cùng `x`); mọi nút `[aria-pressed]` cao không quá 32 px (viên nang một dòng) |
| 2 | Tìm nút bằng `getByRole('button', { name, exact: true })`; nhóm lọc khoanh bằng phần tử chứa chữ nhãn nhóm ("Vùng:", "Trạng thái:", "Cấp KYC:", "Dự án:") rồi tìm nút trong đó. `/assets`: nút "Làm mới" và nút "Thêm dự án" `disabled`, bấm thử (`force: true`) "Thêm dự án" rồi không có `[role="menu"]`; bấm lọc "Trên bờ, Ven biển": nút đó `aria-pressed="true"`, "Tất cả" của cùng nhóm `aria-pressed="false"`, số dòng `tbody tr` bằng số dự án vùng đó trong `MOCK_PROJECTS` (chép cứng 2, kèm chú thích nguồn); bấm "Trên bờ, Cao nguyên": 0 dòng, `[data-slot="empty-state"]` chứa "Không có dự án nào khớp bộ lọc"; bấm lại "Tất cả": đủ dòng. `/kyc`: gõ vào ô "Tìm nhà đầu tư" (theo nhãn) thì ô nhận chữ; nút lọc Cấp KYC "VIP" bấm được, `aria-pressed="true"`; nút "Làm mới" `disabled`. `/reconciliation`: nút "Làm mới dữ liệu" `disabled`; bấm lọc dự án đầu tiên, nút đó `aria-pressed="true"`. **Bàn phím** (`/assets`, tải lại màn): nhấn Tab từ đầu trang tới khi `document.activeElement` là nút lọc "Trên bờ, Ven biển" (vòng lặp có giới hạn số lần Tab, quá giới hạn thì test đỏ), nhấn Enter: nút `aria-pressed="true"`, còn 2 dòng; Tab sang "Trên bờ, Cao nguyên" rồi nhấn Space: `aria-pressed="true"`, 0 dòng, có `EmptyState`. Nút mở menu "Thêm dự án": gọi `focus()` trên nút rồi lần lượt nhấn Enter, Space, ArrowDown: không có `[role="menu"]` |
| 3 | Ba màn ở 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở mỗi màn (ngữ cảnh mới mỗi trang, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): 0 (`toBe`) |
