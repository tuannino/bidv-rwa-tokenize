# UI REDESIGN BRIEF — Đồng bộ "điện gió" + làm đẹp/tinh tế

> ⚠️ **Ghi chú lịch sử:** brief này viết khi ký hiệu token còn là **SPT**. Sau đó token được
> đổi tên thành **WPT** (Wind Power Token) — xem commit `replace SPT token to WPT token`.
> Giữ nguyên văn bản gốc của Supervisor; đọc "SPT" thành "WPT".

Mục tiêu: (1) đồng bộ toàn giao diện về **điện gió** (đang còn vàng/BĐS/carbon), (2) làm đẹp & nhất quán, sửa các chỗ màu lạc tông. **Chỉ UI** — KHÔNG đụng logic mint/audit và 3 LUẬT kiến trúc.

## A. Phát hiện (có dẫn chứng — Supervisor tự đọc code)

### A1. Nội dung vẫn là console cũ (vàng/BĐS/carbon), CHƯA điện gió
- `components/pages/assets.tsx` (dòng 17–31, 80–95, 106–108): nhãn Vàng/BĐS/Carbon, mã BGT/BRT/BCT.
- `components/pages/dashboard.tsx` (dòng 80–118): biểu đồ & thanh "Vàng/Bất động sản/Carbon".
- `components/pages/reconciliation.tsx` (dòng 8–14): filter GOLD/REAL_ESTATE/CARBON.
- `lib/mock-data.ts` (dòng 73–88): series & `MOCK_STATS` toàn gold/realEstate/carbon.
- → Chỉ có `mint` và `audit` là đã đúng điện gió.

### A2. Màu tím khó nhìn
- `app/globals.css`: `--chart-5: oklch(0.55 0.15 300)` (light) / `oklch(0.60 0.16 300)` (dark) — hue 300 (tím) chói/lạc tông trên nền xanh-vàng.

### A3. Hardcode màu dark trên nền sáng (nhìn "bẩn", hỏng light theme)
- `components/pages/dashboard.tsx`: grid `#27272a`, tooltip nền `#18181b` — cứng theo dark, không theo token.
- `components/pages/reconciliation.tsx` (dòng 30, 54, 87): `border-zinc-700`, `bg-zinc-700` trên theme sáng.

### A4. Sót Polygon
- `components/pages/assets.tsx:204`: link explorer `amoy.polygonscan.com` (dư từ UI cũ).

## B. Hệ thống thiết kế (điện gió)
Nền tảng token OKLCH sẵn có **khá tốt** (xanh BIDV hue 145 + vàng hue 82) — giữ, chỉ sửa chỗ lệch.

- **Nhận diện:** xanh BIDV (primary) + vàng đồng (accent) + thêm **teal/sky (hue ~195–210)** gợi gió/năng lượng.
- **Bảng màu chart** (thay tím): `chart-1` green (giữ) · `chart-2` gold (giữ) · `chart-3` sky-blue (giữ) · `chart-4` amber/đỏ-cam (giữ) · **`chart-5` → teal `oklch(0.60 0.10 195)`** (bỏ hue 300). Kiểm tương phản trên nền near-white.
- **Luật màu:** mọi màu qua **theme token** (`var(--chart-*)`, `var(--border)`, `var(--muted-foreground)`, `bg-card`...). Bỏ hết hex dark & `zinc-700` hardcode; tooltip/grid chart dùng token để đúng cả light/dark.
- **Nhất quán:** spacing/radius/typography theo token; card có phân cấp; icon chủ đề gió/turbine.

## C. Ánh xạ nội dung cũ → điện gió

| Trang | Bỏ (cũ) | Thay bằng (điện gió) |
|---|---|---|
| **Assets** | Vàng/BĐS/Carbon · BGT/BRT/BCT | Danh sách **dự án điện gió**: SPT (Wind Power Project Token), công suất (MW), sản lượng (MWh), trạng thái vận hành |
| **Dashboard** | biểu đồ 3 tài sản | **Tổng quan điện gió**: token đã phát hành (SPT), số NĐT whitelisted, **sản lượng luỹ kế** (EnergyOracle), **lợi tức đã chia** (VND/tVND), số kỳ chia; biểu đồ sản lượng & lợi tức theo thời gian |
| **Reconciliation** | filter tài sản | **Đối soát doanh thu điện**: sản lượng SCADA ↔ EVN ↔ on-chain theo kỳ |
| **Sidebar/Header** | nhãn cũ, "Polygon Amoy" | nhãn điện gió; đã bỏ Polygon (kiểm lại) |
| **mock-data.ts** | gold/realEstate/carbon | series sản lượng (MWh) + lợi tức (VND) + `MOCK_STATS` điện gió |

## D. Checklist theo trang
- [ ] **Assets**: thay type/nhãn/mã → dự án điện gió; bỏ link `amoy.polygonscan.com` (đổi theo chain đang chọn hoặc bỏ ở hardhat/mock); màu badge theo token.
- [ ] **Dashboard**: đổi số liệu & biểu đồ sang điện gió; grid/tooltip/legend dùng **theme token** (bỏ `#27272a`/`#18181b`); màu series theo bảng mới (không tím).
- [ ] **Reconciliation**: đổi filter & nội dung sang đối soát điện; bỏ `zinc-700` → token.
- [ ] **KYC**: rà nhãn/màu cho khớp (giữ chức năng).
- [ ] **Mint / Audit**: giữ logic, chỉ polish cho đồng bộ hệ màu.
- [ ] **globals.css**: đổi `--chart-5` (bỏ hue 300) sang teal; kiểm tương phản light/dark.
- [ ] **mock-data.ts**: thay toàn bộ dữ liệu mẫu sang điện gió.

## E. Nghiệm thu (DoD)
- `grep -rin "gold\|carbon\|bất động\|real.?estate\|BGT\|BRT\|BCT\|polygonscan" app/src` → **rỗng** (trừ comment lịch sử nếu có).
- Không còn hex dark/`zinc-700` hardcode cho nền/þgrid/tooltip trên theme sáng (dùng token).
- Không còn hue 300 (tím) trong bảng chart; biểu đồ đọc rõ trên **cả** light & dark.
- Giao diện nhất quán điện gió; mint/audit và 3 LUẬT không đổi; test cũ vẫn xanh.
