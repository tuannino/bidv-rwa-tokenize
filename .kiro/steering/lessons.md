---
inclusion: always
---
# Bài học tích lũy (Supervisor cập nhật dần)

> Mỗi mục: **Triệu chứng → Nguyên tắc đúng**. Kiro đọc để không lặp lỗi.

- **Gọi chain thẳng trong component** → SAI. Luôn qua `ILedgerPort` (`app/src/lib/ledger`).
- **Nhúng private key / ký rải rác** → SAI. Luôn qua `ISigner`.
- **`if (role === 'admin')` cứng** → SAI. Dùng `can(role, action)` (RBAC).
- **Giả định API Next.js theo bản cũ** → SAI. Next.js 16 khác; đọc docs trong node_modules trước.
- **Trộn T-REX (0.8.17/OZ4) vào contracts chính (0.8.28/OZ5)** → SAI. Giữ tách toolchain.
- **Copy ABI/địa chỉ contract rải rác** → SAI. Chỉ đặt ở `packages/shared`.
- **Thêm Polygon** → SAI. Đã loại bỏ; chỉ hardhat-local / evm / stellar.
- **Bundle hardhat/ethers/artifact contract vào web (edge)** → SAI, phình bundle Cloudflare. Dùng viem, ABI tối giản; đồ nặng để ở packages.
- **Luồng demo public phụ thuộc hardhat node thường trú** → SAI. Free-tier không chạy node; default phải là `mock`/`evm-testnet`.
- **Nhớ nhầm giới hạn Cloudflare** → mức hiện tại 64 MiB không nén (mọi gói, từ 2026-09-04); vẫn build gọn.
- **Revert một PR rồi merge lại nhánh đó để "lấy code về"** → SAI. Git không phục hồi: merge chỉ so với merge-base nên phần đã revert mất vĩnh viễn. Đây là lý do `dev` từng mất sạch `packages/` và `app/src/lib/`. Cách đúng **duy nhất**: `git revert <sha-của-commit-revert>`. KHÔNG merge lại nhánh cũ, KHÔNG cherry-pick từng commit — xem `branching.md` §6.
- **Tự chọn nền khác khi `dev` hỏng** → SAI. DỪNG, ghi bằng chứng vào checkpoint mục "Câu hỏi mở", chờ Owner xác nhận (`branching.md` §5). Chỉ khi Owner cho phép mới dùng nền tạm, và phải ghi rõ món nợ rebase về `dev`.
- **`git rebase <đích>` khi nhánh nền chứa commit phá hoại** → SAI, kéo theo cả commit của nhánh nền. Kỹ thuật đúng là `git rebase --onto <đích> <nền> <nhánh>` (replay chỉ commit của mình) — nhưng **chỉ dùng sau khi Owner đã đồng ý** đổi nền, không tự quyết.
- **Tin số dòng/số chỗ trong tài liệu giao việc mà không đo lại** → SAI. Giao việc nói "còn 264 chỗ dùng SPT/tVND", đo thật chỉ còn 33 vì việc đổi SPT→WPT đã làm ở commit trước. Luôn `git grep` đếm lại trước khi lập kế hoạch.
- **Bộ test do người khác viết có thể bám vào trạng thái repo cũ** → kiểm tên crate/đường dẫn/chuỗi revert thật trước khi kết luận contract sai. Sửa test theo contract, không sửa contract theo test.
- **`docker build` fail exit 137 không phải lỗi Dockerfile** → đó là OOM killer. Kiểm bộ nhớ cấp cho runtime (`docker info | grep "Total Memory"`); colima mặc định chỉ 2 GiB, `next build` cần hơn.
