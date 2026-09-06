# Review Phase 0/1 (từ Supervisor) + Yêu cầu vòng chỉnh sửa

## Kết luận: PASS ✅ — chất lượng cao (đã kiểm chứng độc lập)
Supervisor tự chạy lại: 3 LUẬT kiến trúc đạt; contracts 13/13; app typecheck sạch; vitest 21/21; service ghép 3 trục đúng (guard+audit trước ledger). Chưa sang **P2** — làm vòng chỉnh sửa dưới đây trước.

## Việc cần làm (vòng này)

### [Process] Chia commit nhỏ theo mục tiêu — áp dụng từ giờ
Xem mục mới trong `.kiro/steering/workflow.md`. Không dồn 1 commit lớn; mỗi mục tiêu 1 commit, message rõ (Conventional Commits), để rollback từng phần.

### [P2] Dọn dẹp (PR `chore` riêng, KHÔNG đụng logic mint)
- Bỏ link Polygon sót: `app/src/components/pages/assets.tsx:204` (`amoy.polygonscan.com`).
- Sửa 3 lỗi lint còn lại (2× `react-hooks/set-state-in-effect` ở `providers.tsx`/`header.tsx`; 1× `any` ở `open-next.config.ts`) để cổng lint xanh. Không đổi hành vi theme.

### [UI] Làm mới giao diện theo `docs/UI_REDESIGN_BRIEF.md`
- Đồng bộ toàn bộ về **điện gió** (dashboard/assets/reconciliation/mock-data đang còn vàng/BĐS/carbon).
- Bỏ **màu tím** `--chart-5` (hue 300) → teal; dùng **theme token**, bỏ hardcode màu dark (`#27272a`/`#18181b`/`zinc-700`) trên nền sáng.
- Nghiệm thu theo mục E của brief.

## KHÔNG cần làm
- Comment tiếng Việt "điện mặt trời" trong `.sol`: **giữ nguyên** (comment tiếng Việt càng tốt), không sửa.
- Workspaces/Cloudflare build (câu hỏi 1): **để sau**, làm ở mốc free-tier deploy — chưa gấp.

## Ghi nhận điểm tốt (giữ)
Guard+audit ở tầng service; tự phát hiện & sửa 3 bug repo cũ; `simulateContract` trước khi gửi tx; dùng `pg` thay Prisma Client cho gọn bundle. Deviation đều hợp lý.
