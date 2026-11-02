# Báo cáo bàn giao: UIUX-02 Đầu màn: ô chọn token, bỏ dòng mô tả, gợi ý trên menu; nợ kỹ thuật đa token

| | |
|---|---|
| Mã task | UIUX-02 |
| Phạm vi | **Chỉ frontend và tài liệu.** Không sửa `app/src/lib/**`, action, API, lược đồ, `packages/**`, `scripts/**` |
| Nhánh | `feat/uiux-02-dau-man`, tạo từ `dev` (`67ece1e`; nhánh `docs/ui-ux-ban-chot` chưa có trên remote) |
| Spec | `docs/uiux-02-dau-man/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | mã `a69369f`, sửa test `0a7beec`; tài liệu `c5330f2` (bản nháp) và commit tài liệu cuối trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | Bỏ dòng mô tả 23 chỗ; gợi ý menu đúng nguyên văn QĐ-8; 5 màn ngoài menu có gợi ý trên tiêu đề; `HoverHint` QĐ-9; tiêu đề Tổng quan QĐ-10; `data-chain` QĐ-11 | ✅ | mục 5; vitest ca 6 tới 10; e2e mục 2 |
| 2 | `TokenScopeSelect` QĐ-1 tới QĐ-6; 10 màn đúng vị trí (kể cả `/trade`); `/trade` không còn ô `select` riêng | ✅ | mục 5; vitest ca 1 tới 5b; e2e mục 2 |
| 3 | Số action khi mở không đổi (10 màn mục 3, 23 màn QĐ-7); `hf-01-hieu-nang.test.ts` xanh không sửa | ✅ | mục 3 |
| 4 | D1 tới D4; tệp nợ kỹ thuật trùng nguyên văn | ✅ | mục 7 (`cmp` trùng) |
| 5 | `git diff --name-only` chỉ có tệp mục 5 spec; lệnh kiểm tệp cấm rỗng | ✅ | mục 6 |
| 6 | Typecheck, lint (0 lỗi, 0 cảnh báo mới), vitest, e2e mock và hardhat; 18 đột biến bị bắt | ✅ | mục 1, 2, 4 |
| 7 | Ảnh 10 màn đang xổ, ảnh gõ lọc, ảnh gợi ý menu, ảnh màn bỏ dòng mô tả, Sáng và Tối | ✅ | mục 8 (26 ảnh) |
| 8 | Không gạch dài, chấm giữa, mũi tên trong chữ mới thêm | ✅ | mục 6 |

**Kết luận:** 8 ✅, 0 🔶, 0 ❌. Ô chọn token chỉ là giao diện: không đổi dữ liệu, không gọi action, không lưu lựa chọn.
`TokenScopeSelect` và `HoverHint` chép đúng bản Supervisor dựng trong design, không đổi dòng nào. Không thêm gói npm.

UserGuide: đã cập nhật Phần 1 mục 1.1 (dòng định hướng đa token); Phần 3 mục 3.0 (ô chọn token, gợi ý menu, tiêu
đề Tổng quan), 3.2.1 (dòng "Chain đang xem" thay bằng ô chọn token), 3.4.1, 3.5.1, 3.5.2 (số dòng tham chiếu); Phụ lục
C (L-69); Lịch sử cập nhật. Phần 2 không đổi: số action và trạng thái các màn không đổi.

### 0.2 Việc cần Owner quyết

- Không có việc chặn. Không có lời gọi đọc dữ liệu nào chỉ còn phục vụ đoạn mô tả đã xoá (mục 5.3).

---

## 1. Vitest

### 1.1 Tệp mới `app/test/uiux-02-dau-man.test.ts`

```text
$ (cd app && npx vitest --run test/uiux-02-dau-man.test.ts)
      Tests  11 passed (11)
```

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Dựng tĩnh: `input` có `id`, `role="combobox"`, `aria-expanded="false"`, giá trị `WPT`, không `disabled`; `label` "Token" trỏ đúng `id`; truyền `disabled` thì có `disabled`; `tokens=[]` giá trị rỗng, `placeholder` "Chưa có token" |
| 2 | Danh sách mặc định WPT (chọn được) rồi TCC (khoá, thẻ "(chưa hỗ trợ)", tên "Tokenized Carbon Credit") |
| 3 | `w` chỉ WPT; `tc` chỉ TCC; ` T ` ra TCC rồi WPT; `carbon`, `CARBON` chỉ TCC; `an viên` ra WPT khi có tên dự án; `zz` rỗng; `WP` và `wp` như nhau |
| 4 | 10 tệp màn mỗi tệp đúng một `<TokenScopeSelect`; `investor-trade.tsx` không còn ô `select` Token, không còn `ctx.tokens.length <= 1`, ô mới có `disabled={tradeBlocked}`; `investor-withdraw.tsx` không dùng |
| 5b | `tokenScopeReducer`: gõ `WPT`, `wpt` chỉ còn WPT; từ trạng thái đóng `move` mở và trỏ WPT, `choose` chọn và đóng; `choose` dòng TCC theo chỉ số hoặc sau khi gõ `tc` không đổi lựa chọn, danh sách vẫn mở; `sync` khoá khi đang mở thì đóng, `active = -1`, rồi `open`, `type`, `choose` trả đúng trạng thái cũ; `sync` `tokens: []` thì rỗng, chỉ còn TCC; `sync` đổi `value` thì chọn theo `value` |
| 5 | `token-scope-select.tsx` không có `localStorage`, `sessionStorage`, `document.cookie`, `fetch(`, `useRouter`, `useSearchParams`, `@/app/actions` |
| 6 | Mọi mục `NAV_BY_ROLE` (4 vai), `DEMO_PAYMENT_NAV_ITEM`, `WALLET_BINDING_NAV_ITEM` có `hint` đúng nguyên văn QĐ-8 theo vai và `href` (đủ, không thừa mục); mọi câu gợi ý (kể cả 5 câu trên tiêu đề) không rỗng, không gạch dài, chấm giữa, mũi tên |
| 7 | Nhãn `/` của GDV, KSV là "Bảng điều khiển"; `dashboard.tsx` có `h1` "Tổng quan", không còn "Tổng quan điện gió"; breadcrumb `app/(ops)/page.tsx` là "Tổng quan" |
| 8 | 23 tệp QĐ-7 không còn câu mở đầu của dòng mô tả cũ (design mục 6) |
| 9 | 4 tệp QĐ-11 có `data-chain={chain}`, `wallet-binding.tsx` không có; 5 tệp dùng `<HoverHint hint="<đúng câu>" side="bottom">` bọc `h1`; `sidebar.tsx` có `<HoverHint hint={item.hint}>` bọc `Link` |
| 10 | `hover-hint.tsx` import `@/components/ui/tooltip`, có `3000`, `aria-describedby`, `sr-only`; không `localStorage`, `fetch(`, `@/app/actions`, `setTimeout` |

### 1.2 Toàn bộ

```text
$ (cd app && npm run typecheck && npm run lint)                # 0 lỗi; 1 cảnh báo có từ trước (mục 9)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  70 passed | 11 skipped (81)
      Tests  1453 passed | 74 skipped (1527)          # bỏ qua: tệp cần nút Hardhat; hf-01-hieu-nang xanh
$ bash scripts/run-local-all.sh arch markers app
  PASS: 20   FAIL: 0   WARN: 3                        # 3 cảnh báo có từ trước (process.env, địa chỉ mẫu, BASE_REF)
  => ĐẠT các phần đã chạy: arch markers app
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm
  84 passed (1.5m)                                    # e2e mock, gồm 7 bài mới và chain-scope
  26 passed (35.0s)                                   # e2e hardhat, gồm chain-scope
  => ĐẠT các phần đã chạy: build e2e evm
```

Test có sẵn đã sửa: chỉ `e2e/chain-scope.spec.ts` (cách định vị chain, QĐ-11). Không sửa vitest có sẵn nào.

## 2. E2E mới `app/e2e/uiux-02-dau-man.spec.ts` và `chain-scope.spec.ts`

```text
$ (cd app && npx playwright test e2e/uiux-02-dau-man.spec.ts e2e/chain-scope.spec.ts)
  8 passed (25.6s)
```

| Bài | Nội dung |
|---|---|
| Mười màn | Với từng màn mục 3 theo vai: `#token-scope` hiện, giá trị `WPT`, không khoá; bấm thì `listbox` hiện, có WPT, dòng TCC `aria-disabled="true"` chứa "(chưa hỗ trợ)" |
| Thao tác ở `/vault` (KSV) | Gõ bằng `page.keyboard.type`: `WPT` chỉ WPT; `tc` chỉ TCC, bấm TCC (`force`) không chọn, danh sách mở; `zz` "Không có token khớp", Esc trả `WPT` và đóng; `w` Enter chọn WPT; `t` ra TCC rồi WPT, mũi tên xuống trỏ WPT (`aria-activedescendant`), Enter chọn; `tc` Enter không chọn, bấm ra ngoài trả `WPT` và đóng; bàn phím từ trạng thái đóng: Tab tới ô, mũi tên xuống mở và trỏ WPT, Enter chọn, tiêu điểm vẫn ở ô |
| Màn hình nhỏ 390 x 844 | Danh sách nằm trọn trong khung ngang; bấm chọn WPT được; trang không cuộn ngang |
| Gợi ý menu (KSV) | Liên kết `/^Phê duyệt lệnh/` có mô tả truy cập đúng câu QĐ-8 ngay khi tải, tên liên kết không chứa câu; sau 1 giây chưa có bong bóng, sau 3,5 giây có, đúng câu, nằm bên phải liên kết và trong khung; rời chuột thì mất |
| Tổng quan (GDV) | `h1` "Tổng quan"; menu có "Bảng điều khiển" |
| Sổ kiểm toán (GDV) | Rê lên tiêu đề 3,5 giây thì hiện đúng câu gợi ý |
| 23 màn | Trong `main` không còn câu mở đầu cũ |
| `chain-scope.spec.ts` | Chỉ đổi cách định vị chain sang `[data-chain="X"]` (QĐ-11); điều kiện không nới |

## 3. Số server action khi mở (mock, `next start`)

Đếm header `next-action` (cách HF-01). Trước: `dev` @ `67ece1e`; sau: nhánh này. Hai lần đo giống hệt nhau từng dòng.

| Màn | Vai | Trước | Sau |
|---|---|---|---|
| `/` | GDV | 0 | 0 |
| `/draft` | GDV | 3 | 3 |
| `/approvals` | KSV | 3 | 3 |
| `/config` | GDV, KSV | 1, 1 | 1, 1 |
| `/vault` | GDV, KSV | 3, 3 | 3, 3 |
| `/distribution` | GDV, KSV | 1, 1 | 1, 1 |
| `/recall` | GDV, KSV | 1, 1 | 1, 1 |
| `/trade` | NĐT | 1 | 1 |
| `/portfolio` | NĐT | 1 | 1 |
| `/orders` | NĐT | 1 | 1 |
| `/withdraw` | NĐT | 1 | 1 |
| `/seller` | NB | 1 | 1 |
| `/seller/withdraw` | NB | 2 | 2 |
| `/seller/transactions` | NB | 1 | 1 |
| `/account` | NĐT, GDV | 1, 0 | 1, 0 |
| `/wallet` | NĐT | 0 | 0 |
| `/assets` | GDV | 0 | 0 |
| `/kyc` | GDV | 0 | 0 |
| `/mint` | GDV | 1 | 1 |
| `/transactions` | GDV | 1 | 1 |
| `/reconciliation` | GDV | 0 | 0 |
| `/wallet-binding` | GDV | 1 | 1 |
| `/audit` | GDV | 0 | 0 |

`test/hf-01-hieu-nang.test.ts` xanh trong lần chạy toàn bộ, không sửa.

## 4. Đột biến (18/18 bị bắt)

Script sửa một chỗ, chạy `test/uiux-02-dau-man.test.ts`; đột biến chỉ thấy trên trình duyệt thì dựng lại bản build và
chạy e2e; xong trả nguyên tệp.

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Dòng TCC chọn được khi bấm chuột (`choose` có chỉ số bỏ kiểm khoá) | vitest 5b |
| 2 | Enter chọn được dòng khoá (`choose` không chỉ số bỏ kiểm khoá) | vitest 5b |
| 3 | Bỏ thẻ "(chưa hỗ trợ)" khi dựng dòng | e2e "mười màn" |
| 4 | Giá trị mặc định thành `TCC` | vitest 1, 5b |
| 5 | Lọc bỏ qua tên loại token | vitest 3 |
| 6 | Lọc phân biệt hoa thường | vitest 3, 5b |
| 7 | Bỏ ô chọn khỏi `vault-status.tsx` | vitest 4 |
| 8 | Giữ `disabled={ctx.tokens.length <= 1 \|\| tradeBlocked}` | vitest 4 |
| 9 | Ô luôn `disabled` | vitest 1 |
| 10 | Blur không trả chữ về token đang chọn | e2e "thao tác ở `/vault`" |
| 11 | Gợi ý hiện ngay (độ trễ 0) | vitest 10; e2e "gợi ý menu" |
| 12 | `delay` 600 | vitest 10 |
| 13 | Bỏ `aria-describedby` khỏi mục menu | e2e "gợi ý menu" |
| 14 | Câu gợi ý "Phê duyệt lệnh" khác bảng QĐ-8 (bỏ hẳn trường thì typecheck đỏ vì `hint` bắt buộc) | vitest 6 |
| 15 | Giữ lại dòng mô tả ở `vault-status.tsx` | vitest 8 |
| 16 | Bỏ `data-chain` ở `approvals.tsx` | vitest 9; e2e `chain-scope.spec.ts` |
| 17 | Lọc bỏ qua truy vấn khi chữ gõ trùng token đang chọn | vitest 5b |
| 18 | Khoá khi đang mở mà thao tác vẫn có tác dụng (bỏ `if (state.disabled) return state`) | vitest 5b |

## 5. Yêu cầu và nơi làm

### 5.1 Ô chọn token

- `app/src/components/token/token-scope-select.tsx` (mới): chép nguyên design mục 1 (component, `tokenScopeOptions`,
  `tokenScopeReducer`, `initTokenScope`, `scopeOptions`).
- Gắn `<TokenScopeSelect id="token-scope" className="w-full sm:w-72" />` thành hàng riêng ngay sau `header` (hoặc khối
  ngoài cùng chứa `h1` ở `recall.tsx`) của `draft`, `approvals`, `price-config`, `vault-status`,
  `distribution-approval`, `recall`, `investor-portfolio`, `seller-overview` (sau thẻ `</header>`, không vào hàng flex),
  `seller-withdraw`.
- `investor-trade.tsx`: thay khối `label` và `select` Token trong thẻ "Đặt lệnh" bằng ô dùng chung (`ariaLabel="Token"`,
  `tokens={ctx.tokens}`, `value={ctx.token?.tokenSymbol}`, `disabled={tradeBlocked}`). `FIELD` vẫn dùng ở hai ô khác.

### 5.2 Dòng mô tả, gợi ý, tiêu đề, `data-chain`

- Xoá 23 đoạn `<p>` theo đúng dòng spec; script kiểm trước khi xoá (dòng `h1`, đoạn bắt đầu `<p`, kết thúc `</p>`,
  một `<p>`, có câu mở đầu ở design mục 6). `mint.tsx` giữ đoạn thứ hai (khung chỉ dẫn sang Lập lệnh).
- `nav-config.ts`: `NavItem.hint: string` bắt buộc; 29 câu (6 NĐT, 5 NB, 8 GDV, 8 KSV, 2 mục ẩn) chép nguyên văn.
- `hover-hint.tsx` (mới): chép nguyên design mục 4. `sidebar.tsx`: bọc nhánh `Link` của `NavLink`; nhánh `disabled`
  và dòng `title` giữ nguyên. Bọc `h1` ở `audit/page.tsx`, `mint.tsx`, `assets.tsx`, `kyc.tsx`, `reconciliation.tsx`.
- `dashboard.tsx`: `h1` "Tổng quan"; xoá đồng hồ chỉ phục vụ mốc "Cập nhật" (`useIsMounted`, `mounted`,
  `updatedAt`). `app/(ops)/page.tsx`: breadcrumb "Tổng quan". Menu giữ "Bảng điều khiển".
- `data-chain={chain}` ở phần tử ngoài cùng của `draft`, `ops-transactions`, `approvals`, `seller-overview`.

### 5.3 Biến và lời gọi chỉ phục vụ đoạn đã xoá

Chỉ có đồng hồ phía trình duyệt ở `dashboard.tsx` (không đọc dữ liệu), đã xoá theo QĐ-7. Các giá trị khác từng in
trong dòng mô tả (`chain`, `config.mocks.kyc`, `ctx.sellEnabled`) vẫn dùng ở chỗ khác hoặc là một phần của biến dùng
chung (`config`), không xoá gì thêm. Không có lời gọi đọc dữ liệu hay action nào chỉ còn phục vụ đoạn đã xoá.

## 6. Quét

```text
$ git diff --name-only dev... | grep -E '^app/src/(lib|app/actions|app/api)/|gates\.ts$|sides\.ts$|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
(rỗng)
$ git diff dev... -- . ':!docs/uiux-02-dau-man' | python3 -c ...   # lệnh quét ký tự cấm ở tasks.md bước 6
(rỗng)
```

Tệp đổi: 31 tệp trong `app` (29 tệp `src`, `test/uiux-02-dau-man.test.ts`, hai tệp e2e) và tài liệu ở mục 7, ảnh ở
mục 8; tất cả nằm trong danh sách mục 5 của spec.

## 7. Tài liệu

- D1: `docs/20261102_NO_KY_THUAT_DA_TOKEN.md` chép từ gói spec, `cmp` trùng từng byte.
- D2: `docs/tech-report.md`: dòng `TCC` ở bảng "Quy ước ký hiệu token"; dòng **P2** đa token ở mục 1.6.C trỏ tệp D1.
- D3: `docs/USER_GUIDE.md` (xem dòng UserGuide ở mục 0.1).
- D4: checkpoint này; `.kiro/task-status.json` thêm `UIUX-02` vào `done`. Spec chép ở `docs/uiux-02-dau-man/`.

## 8. Ảnh (`docs/screenshots/uiux-02/`, mock, 1360 x 900)

Mỗi ảnh có bản `_sang` và `_toi` (26 ảnh):

- 10 màn đang xổ danh sách (thấy TCC "(chưa hỗ trợ)" chữ mờ): `20261102_lap_lenh_o_chon_token_*`,
  `phe_duyet_lenh`, `gia_va_phat_hanh`, `vault_thanh_toan`, `chia_loi_nhuan`, `thu_hoi_token`, `giao_dich_token`,
  `tong_quan_nha_dau_tu`, `tong_quan_nguoi_ban`, `tao_lenh_rut`.
- Đang gõ lọc (`t`, TCC lên trước WPT): `20261102_go_loc_token_*`.
- Gợi ý menu "Phê duyệt lệnh" đang hiện: `20261102_goi_y_menu_*`.
- Màn sau khi bỏ dòng mô tả (Tổng quan của GDV): `20261102_tong_quan_bo_dong_mo_ta_*`.

## 9. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Nhánh gốc:** `docs/ui-ux-ban-chot` không có trên remote nên tạo từ `dev` @ `67ece1e` như spec cho phép.
2. **E2E "Tab tới ô":** ô đứng ngay dưới tiêu đề, trước nó có nhiều phần tử của thanh bên và thanh trên, nên bài đặt
   tiêu điểm vào ô, Shift+Tab ra rồi Tab vào lại (đúng là đi bằng phím Tab, không bấm chuột), rồi kiểm từ trạng
   thái đóng.
3. **Đột biến 3** làm ở chỗ dựng thẻ (bỏ `span` hiện thẻ); bỏ hằng thẻ thì dòng TCC hết bị khoá, trùng đột biến 1.
4. **Đột biến 14** đổi câu thay vì bỏ trường: `hint` là trường bắt buộc nên bỏ trường thì typecheck đỏ trước cả vitest.
5. **Số dòng tham chiếu trong UserGuide** ở `nav-config.ts` và `sidebar.tsx` (đã lệch từ trước) sửa lại theo tệp mới,
   vì task này đổi chính hai tệp đó.
6. **Lint:** còn đúng một cảnh báo có từ trước (`test/helpers/fake-fireblocks.ts:86`, IN-04), không có cảnh báo mới.
7. Test ca 6 ban đầu viết ký tự cấm trực tiếp trong biểu thức kiểm; đã đổi sang mã thoát `\u` ở `0a7beec`.
