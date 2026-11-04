# Báo cáo bàn giao: FE-UX-03c màn Vault thanh toán SPV

| | |
|---|---|
| Mã task | FE-UX-03c |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `components/ui/**`, `components/distribution/**`; không gói npm mới; không đổi câu chữ, trường, thứ tự trường, nút, điều kiện khoá, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-03c-vault`, tạo từ `release/ui-v2` (`1238a54`, sau merge PR #91 FE-UX-03b) |
| Spec | `docs/fe-ux-03c-vault/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `8c67dc1`; dời nguyên văn `892ee70`; unit test `e7c6e9c`; đổi kiểu và e2e nháp `d8f7336`; số `role` mốc `28ef87e`; UserGuide `173b603`; biểu tượng `LockKeyhole` cho JS các trang khác không tăng `3a033fb`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

Tệp mới trong `app/src/components/vault/`: `display.ts` (`amount`, `short`), `withdraw-review-item.tsx`
(`WithdrawReviewItem`).

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục trừ "Không làm", hai vai; bảng đối chiếu notes | ✅ | mục 2.2, 7 |
| 2 | Ô số liệu, thẻ trạng thái đúng QĐ-3, 11 trường đúng thứ tự; nhóm chế độ khoá đúng QĐ-4 (e2e ca 2; vai chỉ xem kiểm tay) | ✅ | mục 1.2, 2.2, 3 |
| 3 | `WithdrawReviewItem` và phần dùng chung dời đúng QĐ-5, commit riêng; dán đoạn trước và sau | ✅ | mục 2.1 |
| 4 | Khối tự viết thay theo QĐ-6; `Metric`, `FIELD`, link explorer trùng không còn | ✅ | mục 2.2, 2.5 |
| 5 | Không đổi chữ, trường, nút, điều kiện khoá (6d) | ✅ | mục 6 |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2, không đổi 28 đường dẫn; JS, CSS trong trần (byte); lỗi `/vault` 0, đường dẫn khác không tăng | ✅ | mục 4 |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, hai vai, có dữ liệu, tiến trình mock mới mỗi lượt, đúng công thức | ✅ | mục 5 |
| 10 | Lệnh rút `NEEDS_REVIEW`, `PAYOUT_REVIEW`, có và không `canResolve`, `busy`: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-03c-vault.spec.ts` đủ 3 ca, `fe-ux-03c.test.ts` đủ 2 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log (cổng trống, không `BO-DEM-ROLE`); "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip `/vault` +2.554 B (2,49 KB, trần 3 KB, đo theo byte);
các trang đo khác lệch trong khoảng nhiễu build (mục 4); CSS +134 B; action khớp 28/28 (`/vault` 3); `hydration`,
`consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role` trong `main` bằng mốc. Mức rủi ro: thấp
(dòng lệnh rút dời sang tệp mới, các nhánh kiểm bằng unit test với dữ liệu giả; luồng lưu, rút thật bằng e2e mock và
Hardhat).

UserGuide: "Chốt tại"; mục 3.5.1 thêm "Bố cục"; câu ô chọn token thêm `/vault`.

### 0.2 Việc cần Owner quyết

- Không có. Ghi chú biểu tượng thẻ Cấu hình khoá ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-03c` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới).

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
@@RUN@@
```

Log gửi kèm (không commit): `20261104_feux03c_run_local_all.log` và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới
hết: `20261104_feux03c_evm_e2e.log`. Không chạy `contracts`.

### 1.2 e2e mới `app/e2e/fe-ux-03c-vault.spec.ts` (project mock; không lưu cấu hình, không đối soát)

| Ca | Kiểm | Mốc `1238a54` | Sau |
|---|---|---|---|
| 1 | Hai vai: 4 `[data-kpi]` đúng thứ tự Số dư VNDB `au`, Số VNDB đang khoá `default`, Số dư WPT `default`, VNDB có thể rút `gold`; đọc chế độ khoá trên màn, nhãn `dt` của thẻ trạng thái đúng 5 (`UNSET`) hoặc 6 (`FIXED`, `PERCENT`) theo thứ tự | đỏ (mốc chưa có `Kpi`) | xanh |
| 2 | Vòng 1, hai vai: tải xong (`networkidle`, rồi `[data-kpi]` hiện) thì đếm `role` status, note, alert trong `main` NGAY, trước mọi tương tác (chỉ khi `UNSET`; nhánh khác ghi `bo-dem-role` và in `BO-DEM-ROLE`). Vòng 2: Kiểm soát viên `click()` "Khoá số cố định" (checked, ô tỷ lệ đếm 0, ô số cố định hiện, `label` `box-shadow: none`), `ArrowLeft` thì "Theo tỷ lệ %" checked, có tiêu điểm, `:focus-visible`, `label` có `box-shadow` khác `none`, ô tỷ lệ hiện, ô số cố định đếm 0; không bấm Lưu. Giao dịch viên: mọi radio `disabled` | đỏ ở bước vòng tiêu điểm (mốc chưa có vòng); bấm chuột, phím mũi tên đạt | xanh |
| 3 | 1440 và 390 px, hai vai, ngữ cảnh mới: `scrollWidth` không vượt bề rộng, 0 `console` loại `error`, 0 `pageerror`, 0 cảnh báo hydrate | xanh | xanh |

Số `role` mốc đo trên `1238a54` bằng chính ca 2 trong lượt e2e mock đầy đủ trên máy chủ mới (vault `UNSET`): hai vai
đều `{ status: 0, note: 1, alert: 0 }` (`note` là câu hiệu lực dưới ô của chế độ đang chọn). Bản chép tạm vào mốc bỏ
đúng một dòng chờ `[data-kpi]` (mốc chưa có `Kpi`; dữ liệu đã chờ bằng ô "Chế độ khoá" trong `openVault`); diff bản
tạm gửi kèm. Lượt đầu ca 2 in số sau vòng lặp nên không in được (dừng ở vòng tiêu điểm); đã tách đếm thành vòng 1
riêng rồi đo lại (117 ca cũ đạt, 2 ca mới đỏ như bảng trên). Log nộp kèm không có dòng `BO-DEM-ROLE`.

Kiểm tay vai chỉ xem (ảnh Giao dịch viên): nhóm chế độ mờ, con trỏ cấm, bấm không đổi chế độ (radio `disabled`).

### 1.3 Unit test mới `app/test/fe-ux-03c.test.ts` (môi trường `node`, 6 ca)

Nhóm 1 (đọc mã nguồn `vault-status.tsx`): đúng 1 `getVaultOverviewAction(`, 1 `getVaultConfigHistoryAction(`, 2
`listWithdrawReviewsAction(`, 3 `useEffect(`. Số mốc xác nhận trên `1238a54` trước khi viết: 1, 1, 2, 3.

Nhóm 2 (`renderToStaticMarkup` `WithdrawReviewItem` với `WithdrawReviewView` giả đủ kiểu, có `chain`, `purpose`,
`note`, `txHash`, `payoutTxHash`, `reason`, `candidates`):

| Trạng thái giả | Kỳ vọng (đạt) |
|---|---|
| `NEEDS_REVIEW`, có quyền chốt, không busy, 1 ứng viên | ô "Mã giao dịch xác nhận {id}", ô lý do; "Xác nhận hoàn tất", "Đánh dấu thất bại" mở; câu ứng viên có mã cắt 8 ký tự và "(block 18412)" |
| `NEEDS_REVIEW`, không ứng viên | câu ứng viên kết thúc "không có" |
| `PAYOUT_REVIEW`, có quyền chốt, có `payoutTxHash` | không "Xác nhận hoàn tất", không ô mã giao dịch; có ô lý do và "Đánh dấu thất bại"; câu "Lệnh dừng ở bước đặt ví nhận (giao dịch …)" |
| `busy` (cả hai trạng thái) | mọi nút có `disabled` |
| không có quyền chốt (cả hai trạng thái) | không `input`, không `button` |

Mọi ca: phần tử gốc có `data-request={id}`. 6 ca xanh ngay trên dòng vừa dời (`e7c6e9c`, trước khi đổi kiểu) và vẫn
xanh sau khi đổi kiểu.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
@@MUT@@

## 2. Thay đổi

### 2.1 Dời `WithdrawReviewItem` (QĐ-5)

Commit `892ee70` chỉ dời mã. Thân `rows.map` (`vault-status.tsx:275-330` @ `1238a54`) thành
`components/vault/withdraw-review-item.tsx`; `amount`, `short` (`:29`, `:31`), `FIELD` (`:48-49`) thành
`components/vault/display.ts` (thêm `export`), trang import lại. Trong trang `field`, `setField`, `resolve` giữ, chỉ
truyền xuống; `key={row.id}` ở lại chỗ gọi.

Thân dòng trước (`:275-330` @ `1238a54`, bỏ 8 dấu cách thụt) và sau (`withdraw-review-item.tsx` @ `892ee70`),
`diff` đầy đủ, chỉ có các phép thay được phép:

```diff
1c1
<     <div key={row.id} className="space-y-2 rounded-lg border border-border p-3 text-sm" data-request={row.id}>
>     <div className="space-y-2 rounded-lg border border-border p-3 text-sm" data-request={row.id}>
23,24c23,24   (và 47,48c47,48 giống hệt)
<             value={field(row.id).reason}
<             onChange={(e) => setField(row.id, 'reason', e.target.value)}
>             value={reason}
>             onChange={(e) => onChange('reason', e.target.value)}
27c27   (và 51c51 giống hệt)
<           <Button type="button" variant="outline" disabled={busy} onClick={() => void resolve(row.id, 'FAILED')}>
>           <Button type="button" variant="outline" disabled={busy} onClick={() => void onResolve('FAILED')}>
37,38c37,38
<             value={field(row.id).txHash}
<             onChange={(e) => setField(row.id, 'txHash', e.target.value)}
>             value={txHash}
>             onChange={(e) => onChange('txHash', e.target.value)}
41c41
<           <Button type="button" disabled={busy} onClick={() => void resolve(row.id, 'COMPLETED')}>
>           <Button type="button" disabled={busy} onClick={() => void onResolve('COMPLETED')}>
```

Chỗ gọi trong trang:

```tsx
            <WithdrawReviewItem
              key={row.id}
              row={row}
              canResolve={canResolve}
              busy={busy}
              txHash={field(row.id).txHash}
              reason={field(row.id).reason}
              onChange={(key, value) => setField(row.id, key, value)}
              onResolve={(outcome) => void resolve(row.id, outcome)}
            />
```

`FIELD` xoá ở commit đổi kiểu (`d8f7336`), thay bằng `fieldClass` ở cả trang (`:147`, `:159` cũ) lẫn tệp mới.

### 2.2 Màn (bố cục theo design mục 1, 2)

| Khối | Đổi |
|---|---|
| Đầu màn | `h1` và `TokenScopeSelect` cùng hàng (như `/approvals`, `/distribution`) |
| Đang tải, lỗi, chain chưa có vault | "Đang đọc trạng thái vault…" `EmptyState loading`; lỗi tải `Alert bad role="alert"`; "Chain này chưa triển khai vault thanh toán SPV" `EmptyState` (biểu tượng `Landmark`, không heading) |
| 4 ô số liệu | Lưới 4 cột từ 1100 px, 2 cột từ 640 px: "Số dư VNDB" `au lg`, "Số VNDB đang khoá", "Số dư WPT" `default`, "VNDB có thể rút" `gold`; `value={amount(...)}`, `unit` riêng ("VNDB", "WPT"); không biểu tượng trong ô |
| Trạng thái hiện tại | Thẻ (`CardTitle` là `div`, `Landmark`), 7 trường đúng thứ tự và điều kiện hiện cũ, ô nền nhạt (`Field`, thay `Metric`), lưới `grid-cols-[repeat(auto-fill,minmax(190px,1fr))]`; Chế độ khoá chữ thường; địa chỉ vault `font-code break-all` đủ ký tự; Ngày cấu hình giữ `title`; Trạng thái rút `Badge` `ok` hoặc `warn`, chữ giữ; câu tỷ lệ chờ áp `Alert info role="note"` cuối thẻ |
| Cấu hình khoá | Thẻ (`LockKeyhole`, mục 8); câu giới thiệu giữ; câu chỉ xem `Alert info` không `role`; câu đang bận `Alert info role="status"`; nhóm chế độ nút chuyển đúng design mục 2 (radio gốc `absolute inset-0 m-0 size-full appearance-none opacity-0`, `has-[:checked]:`, `has-[:focus-visible]:ring-2`, `has-[:disabled]:opacity-60`, không `shadow-*`); ô tỷ lệ, ô số cố định `fieldClass` cộng `font-code`, hậu tố "%", "VNDB" là `span aria-hidden` trong khung ô; lỗi ô, lỗi chéo giữ `p role="alert"`; câu hiệu lực giữ `role="note"`; kết quả lưu `Alert` `ok`/`bad` giữ `role`, `aria-label`, `<ol>` bước |
| Lịch sử cấu hình | Thẻ (`History`); lỗi `Alert bad role="alert"`; "Đang đọc…" `EmptyState loading`; rỗng `EmptyState`; bảng, `data-param`, phân trang giữ; mã giao dịch qua `TxHashLink` |
| Lệnh rút cần xem xét | Thẻ `default` (`TriangleAlert`), nút "Đối soát lệnh rút" `outline` có `RefreshCw`; thông báo `Alert` `ok`/`bad` giữ `role`; "Đang đọc…" `EmptyState loading`; rỗng `EmptyState`; mỗi dòng ô nền nhạt bo 18 px, số tiền đậm `tabular-nums`, mã `font-code`; ô mã giao dịch `fieldClass font-code`, ô lý do `fieldClass`; ô và nút mỗi loại một hàng từ 640 px |
| Lịch sử chốt kỳ | Thẻ (`CalendarCheck`); lỗi `Alert bad role="alert"`; rỗng `EmptyState`; bảng giữ (không thêm `aria-label`); mã giao dịch qua `TxHashLink` |

Thứ tự thẻ trong DOM giữ: Trạng thái hiện tại, Cấu hình khoá, Lịch sử cấu hình, Lệnh rút cần xem xét, Lịch sử chốt kỳ.

### 2.3 Đoạn đổi gần hook, handler, điều kiện khoá (QĐ-1, QĐ-2)

Không đổi state, ba `useEffect`, `load`, `reconcile`, `resolve`, `save` (vẫn chỉ gửi ô của chế độ đang chọn, `LEDGER`
vẫn tải lại), `field`, `setField`, `configEffectiveText`, `configValue`, `VaultConfigCard key={chain}`,
`VaultConfigHistoryCard key`, `WithdrawReviewCard key`. Các đoạn có đụng:

- Radio chế độ: `name`, `value`, `checked`, `onChange`, `disabled={disabled}` (`!canConfigure || saving`) giữ từng ký
  tự; chỉ thêm `className` cho `input`, `label`. An toàn vì cùng phần tử `input type="radio"` có `label` bọc.
- Ô tỷ lệ, ô số cố định: `id`, `value`, `onChange`/`onValueChange`, `disabled` giữ; bọc thêm `Suffixed` (một `div` và
  `span aria-hidden`), `className` đổi `FIELD` thành `fieldClass`.
- Nút Lưu: điều kiện hiện `config.canConfigure && (` và `disabled={saving}` giữ.
- Nút "Đối soát lệnh rút": `disabled={busy}`, `onClick` giữ; thêm biểu tượng `aria-hidden`.
- Phân trang lịch sử cấu hình: `data.total > data.pageSize`, `page <= 1`, `page >= pages` giữ.
- Hai bảng lịch sử: thân `map` đổi từ khối `{ const url = ...; return ... }` sang `(...)` vì `url` nay tính trong
  `TxHashLink` (cùng `explorerTxUrl(chain, txHash)`, cùng `short`, cùng chữ và lớp).
- `WithdrawReviewItem`: điều kiện `canResolve && row.status === 'PAYOUT_REVIEW'`, `canResolve && row.status !==
  'PAYOUT_REVIEW'`, `disabled={busy}`, `aria-label`, `placeholder` giữ; ô nhập đổi lớp, lưới hai cột thay bốn cột.

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy: `vault-withdraw.spec.ts` (mock trong 1.1 và riêng; Hardhat trong phần `evm`),
`uiux-02-dau-man.spec.ts`, `uiux-02-dau-man.test.ts`, `hf-01-hieu-nang.test.ts` (trong 1.1). Form "Biểu mẫu cấu hình
khoá", `radiogroup` "Chế độ khoá", nhãn "Tỷ lệ khoá (%)", "Số khoá cố định (VNDB)", nút "Lưu cấu hình khoá", vùng "Kết
quả lưu cấu hình", bảng "Lịch sử cấu hình" và `data-param`, `data-request` giữ; không thêm `aria-label` bảng; một
`h1`; `TokenScopeSelect` đúng một lần; không heading nào khác chứa "Vault thanh toán SPV"; không `Link` mới.

### 2.5 Mã dư thừa

Đã xoá: `Metric`, `FIELD`, hai link explorer viết tay (thành `TxHashLink`), `Loader2` trong khối đang tải của trang
(còn dùng ở nút Lưu). Không còn import thừa (lint đạt).

## 3. Nhóm chế độ khoá (QĐ-4, xác nhận bằng e2e và ảnh)

| Thao tác | Kết quả |
|---|---|
| Bấm chuột vào ô "Khoá số cố định" | radio đó checked, ô đổi nền `bg-primary`, không vòng tiêu điểm (`box-shadow: none`) |
| Phím mũi tên trái | chuyển và chọn "Theo tỷ lệ %", có tiêu điểm `:focus-visible`, vòng `ring-2` trên ô |
| Vai chỉ xem | radio `disabled`, ô mờ 60%, con trỏ cấm |

## 4. Đo trước và sau

Cùng máy, cùng quy trình (`measure.sh` ngoài repo): máy chủ mới cổng 3300, tạo dữ liệu bằng `maker-checker`,
`ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256 `05ec70bf…` khớp
spec, bản có `consoleErrors`, `pageErrors`; mốc cũng đo bằng bản này) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/distribution,/vault`. Tiến trình đo khác tiến trình chụp ảnh.

| Mục | Mốc `1238a54` | Sau `3a033fb` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn, `/vault` 3 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` (cộng 4 biến thể) | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | `/vault` 0, khác không tăng |
| JS gzip `/vault` (công cụ) | 456,0 KB | 458,5 KB | |
| JS gzip `/vault` theo byte | 466.979 B | 469.533 B (+2.554 B; so bản mốc build riêng 466.980 B: +2.553 B) | +3 KB (3.072 B) |
| JS gzip `/` (công cụ; byte) | 558,2 KB; 571.630 B | 558,2 KB; 571.630 B | không tăng |
| JS gzip `/distribution` | 468,3 KB; 479.558 B | 468,3 KB; 479.571 B | không tăng |
| JS gzip `/approvals` | 455,2 KB; 466.098 B | 455,2 KB; 466.091 B | không tăng |
| JS gzip `/portfolio` | 456,1 KB; 467.044 B | 456,1 KB; 467.053 B | không tăng |
| JS gzip `/trade` | 479,0 KB; 490.460 B | 478,9 KB; 490.441 B | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.324 B | 19.458 B (+134 B) | +2 KB |
| `role` trong `main` (mục 1.2, ca 2) | `note` 1, còn lại 0, hai vai | giống hệt | bằng mốc |

Byte của mốc đo trên chính bản build mốc (`1238a54`, cùng phiên). Các trang khác theo byte lệch -19 đến +13 B, cả
âm lẫn dương; công cụ đo báo bằng nhau (riêng `/trade` giảm 0,1). Đã so nội dung chunk khác nhau giữa bản mốc build
riêng và bản sau ở `/`, `/distribution`, `/portfolio` (`chunk_diff.txt` gửi kèm): chỉ đổi tên biến rút gọn, thứ tự
module, mã tham chiếu server action theo bản build; không thêm mã. Bản đầu dùng `KeyRound` làm các trang này tăng
thật khoảng 60 B (mục 8), đã sửa.

## 5. Ảnh (gửi kèm, không commit)

- 28 đường dẫn của script đo, trước (`moc/`) và sau (`sau/`), 1440 và 390, Sáng và Tối.
- Có dữ liệu, mỗi lượt một tiến trình mock MỚI cổng **3400** (`next start`, env như `playwright.config.ts`), không
  dùng lại máy chủ nào: (1) `ops-transactions.spec.ts`; (2) `vault-withdraw.spec.ts` (4 ca: định danh NB001, lưu khoá
  cố định 1 VNDB, chỉ xem, Người bán rút 1 VNDB tới `COMPLETED`); (3) `zz-distribution-approval.spec.ts` (3 ca, một
  dòng Lịch sử chốt kỳ); (4) Kiểm soát viên lưu tay chế độ tỷ lệ 20% ("Đặt tỷ lệ khoá: tỷ lệ khoá 0% thành 20%", "Đổi
  chế độ khoá: chế độ khoá FIXED thành PERCENT"): chế độ "Khoá theo tỷ lệ kỳ", "Tỷ lệ áp" 0%, câu tỷ lệ chờ áp hiện,
  lịch sử cấu hình 5 dòng, lịch sử chốt kỳ 1 dòng; chụp hai vai, 1440 và 390, Sáng và Tối; tắt. Mốc: bản build `1238a54`, tiến trình mới bật 13:43:27Z, tắt 13:44:27Z. Sau: bản build `3a033fb`, tiến trình mới bật
  14:18:11Z, tắt 14:19:12Z (04/11/2026, UTC). Hai lượt cùng kết quả bước 4; `scrollWidth` không vượt bề rộng, 0 lỗi
  console ở mọi ảnh.
- Lệnh rút 4 trạng thái (`NEEDS_REVIEW` có quyền, `PAYOUT_REVIEW` có quyền, `busy`, chỉ xem): HTML dựng bằng
  `renderToStaticMarkup` với dữ liệu giả như unit test (test tạm, xoá ngay, không commit), CSS bản build tương ứng,
  `page.setContent`, font hệ thống; trước dùng dòng @ `892ee70` và CSS bản mốc, sau dùng dòng cuối và CSS bản sau;
  Sáng và Tối, 1440 và 390.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...' vault-status.tsx components/vault/                             # rỗng
6c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' # rỗng
6d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
VNDB tới
6e $ rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' <2 nơi> | rg -v '<dòng chú thích>'   # rỗng
```

6d: "VNDB tới" là chữ dời giữa phần tử: dòng cũ `</span>: {amount(row.amount)} VNDB tới{' '}`, dòng mới đặt số tiền
và "VNDB" trong một `span` in đậm, "tới" ở ngoài; chữ hiển thị giữ nguyên ": 1.500.000 VNDB tới". Không chuỗi nào
khác mất hoặc đổi. `docs/tech-report.md` không đổi (marker không nằm trong tệp đã sửa).

## 7. Đối chiếu notes (`docs/prototypes/20261101_ui_ux_ban_chot/notes/vault.md`)

Giữ: làm theo. Đã cũ: spec hoặc mục 1 "Không làm". Bỏ: không làm, kèm lý do.

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ có tên chain | Giữ tiêu đề; câu phụ Đã cũ | test cấm câu phụ |
| Thanh "Trạng thái xem thử" | Đã cũ | chỉ có ở bản xem thử |
| "Chain này chưa triển khai vault thanh toán SPV" | Giữ | `EmptyState`, không heading |
| 11 trường đúng thứ tự | Giữ | 4 ô số liệu cộng 7 ô trong thẻ (QĐ-3) |
| Số dư VNDB ô lớn, VNDB có thể rút ô vàng | Giữ | `au lg`, `gold`; không chiếm 2 hàng (design) |
| "Lợi nhuận chia quý trước" lên hàng ô số liệu | Bỏ | mục 1 "Không làm": giữ thứ tự 11 trường |
| Thẻ không tiêu đề cho các trường còn lại | Đã cũ | QĐ-7: thẻ giữ tiêu đề "Trạng thái hiện tại" |
| Trạng thái rút nhãn màu | Giữ | `Badge` `ok`/`warn` |
| Câu tỷ lệ chờ áp | Giữ | `Alert info role="note"` |
| Cấu hình khoá, câu giới thiệu, câu chỉ xem, câu đang bận | Giữ | `Alert info` |
| Nhóm chọn chế độ dạng `.seg` `role="radio"` | Giữ dạng nút chuyển, bỏ `role="radio"` | QĐ-4 giữ radio gốc |
| Ô có hậu tố "%", "VNDB" | Giữ | hậu tố `aria-hidden`, nhãn giữ |
| Câu lỗi dưới ô, câu hiệu lực | Giữ | `role` giữ |
| Nút Lưu, kết quả và danh sách bước | Giữ | `Alert` có `<ol>` |
| Cấu hình khoá và Lệnh rút đứng cạnh nhau | Bỏ | mục 1 "Không làm": giữ thứ tự thẻ trong DOM; mỗi thẻ 12 cột |
| Thẻ Lệnh rút nền vàng | Bỏ | QĐ-7: `tone="default"` |
| Lệnh `NEEDS_REVIEW`, `PAYOUT_REVIEW`, nút Đối soát | Giữ | ô nền nhạt, nút có `RefreshCw` |
| Bảng Lịch sử cấu hình 7 cột, Lịch sử chốt kỳ | Giữ | không thêm `aria-label` cho bảng chốt kỳ |
| Biểu tượng trong ô số liệu | Bỏ | mục 1 "Không làm" (trần JS) |
| Đồng xu, đếm số | Bỏ | FE-UX-08 |
| Lệch: thời điểm hai bảng dùng `toLocaleString`; câu bước in số thô | Giữ như mã | không đổi chữ; notes đã cũ ở câu bước (nay "thành" và có dấu nghìn) |

## 8. Nợ và DEVIATION

- **Biểu tượng thẻ Cấu hình khoá:** design ghi `KeyRound`. `KeyRound` có sẵn trong khung dùng chung
  (`layout/custody-toggle.tsx`), nên khi `/vault` cũng dùng, bộ build tách nó thành module trong chunk chung và mọi
  trang tăng khoảng 60 B (đã so nội dung chunk: thêm đúng module `key-round`). QĐ-9 cấm trang khác tăng, nên dùng
  `LockKeyhole` (cùng nghĩa khoá) (`3a033fb`). Owner muốn đúng `KeyRound` thì chấp nhận khoảng +60 B ở mọi trang.
- **Đo byte bản mốc:** thư mục `.next-moc` phải nằm ngoài `app/` khi build bản nhánh: Tailwind quét thư mục build
  không có trong `.gitignore` và CSS phình 1,6 KB (đã gặp, build lại sạch; số ở mục 4 là bản sạch).
- **Tiêu điểm sau khi tải lại:** giữ hành vi hiện có (mục 1 "Không làm").

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; nút Lưu, ô chốt vẫn theo `canConfigure`, `canResolveWithdrawals` do máy chủ trả.
