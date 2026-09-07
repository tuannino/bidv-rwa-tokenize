# Báo cáo bàn giao — Vòng 2: dọn dẹp + đồng bộ UI điện gió

> Điền theo `docs/CHECKPOINT_TEMPLATE.md` (bản template giữ nguyên để dùng cho vòng sau).

| | |
|---|---|
| Branch | `iteration-2/ui-cleanup` (nhánh gốc: `phase-0-1/mint-flow`) |
| Yêu cầu | `docs/REVIEW_P0_P1.md` + `docs/UI_REDESIGN_BRIEF.md` |
| Phạm vi | **Chỉ UI + dọn dẹp.** Không đụng logic mint/audit, không đụng 3 LUẬT |

## 1. Đã làm — commit theo mục tiêu

Áp mục mới của `.kiro/steering/workflow.md`: mỗi mục tiêu một commit, Conventional Commits,
mỗi commit đều typecheck + lint + test được.

| # | Commit | Mục tiêu |
|---|---|---|
| 1 | `c663851` `docs:` | Nhận review P0/P1 + brief redesign + rule chia commit nhỏ |
| 2 | `836df5d` `chore(ui):` | Link explorer theo chain đang chọn, bỏ link Polygon sót |
| 3 | `cca84e0` `chore:` | Sửa 3 lỗi lint còn lại → cổng lint xanh |
| 4 | `ceb7b1a` `feat(ui):` | Dashboard + Assets sang chủ đề điện gió (kèm `mock-data.ts`) |
| 5 | `0a014f3` `feat(ui):` | Reconciliation → đối soát doanh thu điện (SCADA/EVN/on-chain) |
| 6 | `7fcab64` `feat(ui):` | Nhãn + icon điện gió ở sidebar, breadcrumb, trang KYC |
| 7 | `8d51b5a` `style(ui):` | Bỏ tím khỏi bảng màu chart, gom màu thương hiệu về `lib/brand.ts` |
| 8 | `2c35570` `style(ui):` | Icon riêng cho từng nguồn đối soát |

**Vì sao commit #4 gộp 3 file:** `dashboard.tsx` và `assets.tsx` đều tiêu thụ
`lib/mock-data.ts`. Đổi module dữ liệu mà không đổi cả hai trang thì nhánh không build
được — tách ra sẽ có một commit đỏ, trái yêu cầu "mỗi commit build được".

### Chi tiết đáng chú ý

**Explorer theo chain (commit 2).** Thêm `explorerBaseUrl` vào chain registry
(`packages/shared/src/chains.ts`) + helper `explorerTxUrl()`. Chain không có explorer
(`hardhat-local`, `mock`) thì hiện tx hash dạng chữ kèm tooltip giải thích, thay vì một
link chắc chắn 404. Trả `null` chứ không đoán một URL.

**3 lỗi lint (commit 3).**
- `open-next.config.ts`: bỏ `as any`. Đọc `CloudflareOverrides` trong `.d.ts` thì khoá
  `default` **không tồn tại** → tuỳ chọn `{ default: { minify: true } }` vốn không có tác
  dụng gì, `as any` chỉ che lỗi kiểu. Minify bật sẵn, tắt bằng cờ CLI. Nên gọi
  `defineCloudflareConfig()` rỗng thay vì sửa kiểu cho một option vô nghĩa.
- `providers.tsx` / `header.tsx`: thay `useEffect(() => setMounted(true), [])` bằng hook
  `useIsMounted()` dùng `useSyncExternalStore` — cách React chính thức cho "giá trị server
  khác client" (React dùng `getServerSnapshot` lúc hydrate rồi tự render lại). Hành vi theme
  không đổi, và bỏ được đoạn lặp ở hai file.

**Tương phản màu (commit 7).** Ngoài việc đổi `--chart-5` tím → teal như brief yêu cầu, tôi
đo tương phản cả 5 màu chart và phát hiện `--chart-2` (vàng) chỉ đạt **2.5:1** so với nền
card trắng — dưới ngưỡng 3:1 của WCAG 1.4.11 cho đường/vùng biểu đồ. Đường "lợi tức" 2px gần
như không thấy trên nền sáng. Đã hạ độ sáng L 0.72 → 0.60 (**giữ nguyên hue vàng 82** theo
brief). Cũng nâng nhẹ `chart-3`/`chart-4` ở dark theme cho đồng đều.

**`lib/brand.ts` (commit 7).** Gom hex nhận diện BIDV về một chỗ, dùng bởi logo và accent
modal ví RainbowKit (RainbowKit nhận chuỗi màu cụ thể, không nhận `var()`). Ghi rõ đây là
**ngoại lệ duy nhất** được hardcode màu, để `grep` ra được thay vì rải rác.

## 2. Đối chiếu DoD

| DoD | Đạt? | Bằng chứng |
|---|---|---|
| `grep -rin "gold\|carbon\|bất động\|real.?estate\|BGT\|BRT\|BCT\|polygonscan" app/src` rỗng | ✅ | Xem ghi chú "gold" dưới đây |
| Không còn hex dark / `zinc-700` hardcode cho nền/grid/tooltip | ✅ | grep `#18181b\|#27272a\|zinc-\|slate-\|gray-\|neutral-` → rỗng |
| Không còn hue 300 (tím) | ✅ | grep `300)` trong `globals.css` → rỗng; đo được `--chart-5` = rgb(15,146,147) light / rgb(72,184,184) dark |
| `npm run lint` xanh | ✅ | **0 error** (còn 1 warning có sẵn ở `src/empty.ts` — file shim alias) |
| `npm run typecheck` sạch | ✅ | `tsc --noEmit` không output |
| Vitest cũ vẫn pass | ✅ | 3 file / **21 test** pass |
| E2E cũ vẫn pass | ✅ | **5/5** Playwright pass |
| Contracts vẫn xanh | ✅ | **13 passing** |
| Biểu đồ đọc rõ trên **cả** light & dark | ✅ | Đo tương phản + chụp ảnh, bảng dưới |
| Giao diện nhất quán điện gió | ✅ | 6/6 route trả 200, ảnh chụp light+dark của `/`, `/assets`, `/reconciliation` |

### Ghi chú về `gold` trong DoD grep

`grep` còn khớp `gold` ở 13 chỗ, **tất cả là màu nhận diện thương hiệu**, không phải nội dung
tài sản vàng: `--bidv-gold`, `--chart-2 /* BIDV gold */`, `BRAND.gold`. `.kiro/steering/frontend.md`
yêu cầu giữ **"vàng đồng (accent, hue ~82)"** làm màu lõi, nên đây là giữ đúng chủ ý, không phải sót.
Grep bỏ token này ra thì rỗng:

```bash
grep -rinE "carbon|bất động|real.?estate|BGT|BRT|BCT|polygonscan" app/src   # rỗng
```

### Tương phản đo được (canvas trong Chromium, tỉ lệ so với `--card`)

| | chart-1 | chart-2 | chart-3 | chart-4 | chart-5 | chữ chính |
|---|---|---|---|---|---|---|
| **light** | 8.04 | 3.99 | 4.86 | 3.97 | 3.78 | 17.71 |
| **dark** | 4.65 | 8.36 | 5.82 | 6.05 | 7.90 | 16.93 |

Cả 5 màu chart ≥ 3:1 ở cả hai theme (ngưỡng WCAG 1.4.11 cho đồ hoạ); chữ chính ≥ 4.5:1.

### 3 LUẬT kiến trúc — không đổi

```bash
git diff --stat c663851..HEAD -- app/src/lib/{ledger,signer,rbac,bank,store} \
                                 app/src/app/{api,actions}
# rỗng → vòng này không chạm một dòng nào của logic mint/audit
```

## 3. Cách chạy / kiểm thử

```bash
cd app && npm install
npm run typecheck          # sạch
npx eslint .               # 0 error
npm test                   # 21 vitest
npm run test:e2e           # 5 playwright (tự dựng dev server ở chế độ mock)
cd ../packages/contracts-evm && npx hardhat test   # 13 passing

# Xem giao diện:
cd app && npm run dev      # http://localhost:3000
# Đổi theme bằng nút ở header để kiểm biểu đồ ở cả light và dark.
```

## 4. DEVIATION so với yêu cầu

1. **Hạ `--chart-2` từ L 0.72 → 0.60 ở light theme.** Brief ghi "chart-2 gold (giữ)"; tôi giữ
   hue vàng 82 nhưng đổi độ sáng, vì đo được nó không đạt 3:1 trên nền card trắng — mà brief
   cũng yêu cầu "kiểm tương phản trên nền `--background`". Nếu Supervisor muốn giữ đúng L cũ
   thì nói, tôi revert (đổi 1 dòng).
2. **`--chart-3`/`--chart-4` ở dark theme được nâng nhẹ độ sáng** (0.60→0.65, 0.65→0.68).
   Ngoài phạm vi brief, làm cho 5 màu đồng đều về độ nổi. Nhỏ và revert được độc lập.
3. **Thêm `app/src/lib/brand.ts` và `app/src/lib/hooks/use-is-mounted.ts`** — hai file mới
   không có trong brief. Mục đích: gom ngoại lệ hardcode màu về một chỗ, và bỏ đoạn lặp
   `mounted` ở hai component.
4. **Sửa thêm `kyc.tsx`** (brief xếp là "rà nhãn/màu cho khớp"): bỏ `zinc-700`/`text-white`,
   thêm `<label>` cho ô tìm kiếm (a11y), viết lại trạng thái rỗng. Giữ nguyên chức năng.
5. **Đổi nội dung ba thẻ "nguồn dữ liệu" ở reconciliation sang icon riêng** — không có trong
   brief, nhưng brief yêu cầu "card có phân cấp thị giác rõ".
6. **Không tạo `docs/CHECKPOINT_TEMPLATE.md` mới** — template được giữ nguyên làm khuôn; báo
   cáo này là bản đã điền, đặt ở `docs/CHECKPOINT_ITERATION_2.md` (cùng cách làm với
   `docs/CHECKPOINT_P0_P1.md`).

## 5. Câu hỏi mở / chỗ chưa chắc

1. **[P2] `src/empty.ts` còn 1 warning lint** (`import/no-anonymous-default-export`). File này
   là shim để `next.config.ts` alias các package không dùng về rỗng. Sửa thì phải chạm
   `next.config.ts` — vốn là nơi đang có blocker Cloudflare mà review nói "để sau". Tôi để
   nguyên để không trộn hai việc. Cần sửa luôn không?

2. **[P2] Dữ liệu mẫu vs dữ liệu thật.** `assets`/`dashboard`/`reconciliation` vẫn là số minh
   hoạ trong `mock-data.ts` (đã ghi chú rõ trong file). Số thật của các trang này cần
   EnergyOracle + ProfitDistributor, tức Phase 3. Tôi hiểu vòng này chỉ yêu cầu **đồng bộ chủ
   đề**, chưa nối số thật — nếu hiểu sai thì đây là chỗ cần làm thêm.

3. **[P2] `--bidv-*` trong `globals.css` giờ trùng vai với `lib/brand.ts`.** Bốn token
   `--bidv-green/--bidv-gold/...` trong CSS hiện **không có ai dùng** (đã grep). Giữ hay xoá để
   tránh hai nguồn sự thật về màu thương hiệu? Tôi nghiêng về xoá, nhưng chưa làm vì nó là
   token công khai, có thể Supervisor định dùng cho việc khác.

4. **Recharts có animation vào ~1.5s.** Khi tôi chụp ảnh kiểm ở 400ms, biểu đồ trông như bị cắt
   mất đoạn cuối. Đã xác minh đây là `clipPath` animation chưa chạy xong (đo được rect width
   554/603), **không phải lỗi layout** — chụp lại sau 2.2s thì vẽ đủ. Ghi lại ở đây để lần sau
   ai chụp ảnh kiểm biểu đồ thì biết phải chờ.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`** — `grep -rn "from 'viem'" app/src | grep -v src/lib/` → rỗng.
- [x] **Mọi ký qua `ISigner`** — `SERVER_SIGNER_PRIVATE_KEY` chỉ xuất hiện ở `lib/config/env.ts`
      (khai báo) và `lib/signer/server.signer.ts` (dùng).
- [x] **Mọi kiểm quyền qua RBAC** — `grep -rn "role ===\|role ==" app/src | grep -v src/lib/rbac/` → rỗng.
- [x] **Không chạm logic mint/audit** — `git diff --stat` trên `lib/{ledger,signer,rbac,bank,store}`
      và `app/{api,actions}` là rỗng.
