# SC-03 — Kế hoạch thực hiện

Mỗi nhóm là một mục tiêu commit độc lập. SC-03 chỉ bắt đầu sau khi SC-02 đã merge và deploy Hardhat
được kiểm chứng.

- [ ] 0. Khởi tạo task
  - Tạo nhánh `feat/sc-03-evm-order-settlement` từ `dev` có SC-02.
  - Chuyển riêng SC-03 `planned → inProgress`; tạo checkpoint.
  - Đo 5 marker, test nền, chữ ký port và cấu hình giá/allowance hiện tại.

- [ ] 1. Hợp đồng quyết toán nguyên tử
  - Viết OrderSettlement, role, giá, quote, BUY/SELL, event và custom errors.
  - Test bốn số dư, mọi nhánh revert, race giá, reentrancy và contract không giữ tiền.
  - Commit đề xuất: `feat(sc-03): thêm hợp đồng quyết toán nguyên tử`.

- [ ] 2. Deploy, role, ABI và registry
  - Thêm contract vào deploy/verify, addresses/env override, ABI tối giản + sinh tự động.
  - Cấp role đúng; chuẩn bị allowance SPV bằng signer của SPV trong runbook test.
  - Commit đề xuất: `chore(sc-03): đồng bộ deploy và registry quyết toán`.

- [ ] 3. Mở rộng ledger port cho giá chốt và allowance
  - Thêm `expectedVndAmount` và phép đọc allowance WPT.
  - Cập nhật mock/stellar/test; mock phải chặn race giá giống contract.
  - Commit đề xuất: `refactor(sc-03): truyền giá chốt qua ledger port`.

- [ ] 4. Nối EVM adapter
  - Hiện thực 5 marker và phép đọc allowance mới.
  - Dịch custom error thành lỗi có owner/token/spender/số tiền.
  - Gỡ đúng marker SC-03, sinh lại báo cáo.
  - Commit đề xuất: `feat(sc-03): nối khớp lệnh EVM hai chiều`.

- [ ] 5. Chặn sớm ở nghiệp vụ
  - Bổ sung kiểm allowance SPV/Nhà đầu tư cho BUY và SELL.
  - Giữ giá chốt, trạng thái và năm bước của BE-14; không thêm logic giá ở UI.
  - Test thiếu từng allowance không gửi tx.
  - Commit đề xuất: `feat(sc-03): kiểm allowance trước quyết toán`.

- [ ] 6. E2E Hardhat và bàn giao
  - Chạy approve thật từ ví SPV/Nhà đầu tư, đặt BUY/SELL qua UI/service, GDV khớp.
  - Đối chiếu bốn số dư, receipt, audit, order và số liệu nguồn cung.
  - Chạy full gate, cập nhật checkpoint/tech report, chuyển SC-03 sang `done` khi đủ DoD.
  - Ghi production gate AU-01/consent; không tự bật production.
  - Tách commit kiểm thử và commit tài liệu bàn giao.
