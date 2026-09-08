---
inclusion: fileMatch
fileMatchPattern: ["app/src/**/*.tsx", "app/src/app/globals.css"]
---
# Hệ thống thiết kế giao diện (điện gió)

Chi tiết & checklist: `docs/UI_REDESIGN_BRIEF.md`. Đây là luật rút gọn luôn áp khi sửa UI.

## Nhận diện
- Chủ đề DUY NHẤT: **điện gió**. KHÔNG còn vàng/BĐS/carbon/BGT/BRT/BCT ở bất kỳ trang nào.
- Màu lõi: **xanh BIDV** (primary, hue ~145) + **vàng đồng** (accent, hue ~82). Thêm **teal/sky** (hue ~195–210) gợi "gió/năng lượng".

## Luật màu (đang bị vi phạm — phải sửa)
- **LUÔN dùng theme token** (`var(--primary)`, `var(--chart-*)`, `var(--border)`, `var(--muted-foreground)`, `bg-card`, `text-foreground`...). **CẤM hardcode** hex dark hay `zinc-700/#18181b/#27272a` trên nền sáng — hỏng ở light theme và lạc tông.
- **Bỏ tím**: `--chart-5` hue 300 khó nhìn trên nền xanh/vàng → đổi sang **teal hue ~195** (hoặc slate trung tính), bảo đảm tương phản trên cả light/dark.
- Bảng màu chart nhất quán: green · teal · sky-blue · amber/gold · slate. Kiểm tương phản trên nền `--background` (near-white ngả xanh).

## Chất lượng
- Nhất quán spacing/radius/typography theo token có sẵn (`--radius-*`, `--font-*`). Card có phân cấp thị giác rõ.
- Biểu tượng dùng chủ đề gió/turbine/năng lượng.
- Trạng thái rỗng/loading tử tế; bảng/thẻ căn chỉnh gọn.
- Chỉ sửa UI — KHÔNG đụng logic mint/audit và 3 LUẬT kiến trúc.
