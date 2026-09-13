# Spec P12 - Tasks

Tiền đề: Phase 0 của P4 đã xong (contract deploy + địa chỉ chain `evm`, gồm Redemption).
Nếu chưa, dừng và báo, không tự deploy lại theo kiểu khác.

## Phase 0 - Cấu hình địa chỉ + tỷ giá

- [ ] T0.1 Nạp env `NEXT_PUBLIC_ADDR_EVM_REDEMPTION` (và `NEXT_PUBLIC_ADDR_EVM_VND_TOKEN`,
      `NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN` nếu chưa từ P4).
      DoD: `getContractAddress('evm','Redemption')` trả đúng địa chỉ.
- [ ] T0.2 Xác nhận/đặt tỷ giá redeem trên Sepolia bằng `setRate` (nếu khác mặc định deploy).
      DoD: đọc `rate` on-chain đúng giá trị mong muốn.

## Phase 1 - Nguồn sự thật + port + adapter

- [ ] T1.1 Thêm ABI tối giản `abi/redemption.ts`, export ở `abi/index.ts`; đối chiếu
      `generated/Redemption.abi.json`.
      DoD: ABI khớp chữ ký hàm thật; không có ABI ngoài shared.
- [ ] T1.2 Mở rộng `ILedgerPort` với cụm tất toán (theo design), giữ ở `app/src/lib/ledger`.
      DoD: type check pass; không import viem/ethers ngoài lib.
- [ ] T1.3 Hiện thực trong `evm.adapter.ts`: đọc địa chỉ+ABI Redemption riêng; `fundRedemption`
      = approve VND rồi fund; `redeem` cần approve WPT trước; `simulateContract` trước mỗi tx ghi.
      DoD: các method trả TxResult đúng; lỗi (chưa KYC, thiếu quỹ, paused) ra message đọc được,
      không đốt WPT khi lỗi.
- [ ] T1.4 Bổ sung `mock.adapter.ts` cho cụm tất toán để demo không cần chain.
      DoD: luồng chạy được ở chế độ mock.

## Phase 2 - RBAC + server action + UI

- [ ] T2.1 Thêm ACTIONS `redeem:configure` (BANK_ADMIN), `redeem:execute` (INVESTOR) vào
      bảng `ROLE_PERMISSIONS`. Chỉ sửa bảng.
      DoD: quyền đúng theo role; INVESTOR không có `redeem:configure`.
- [ ] T2.2 Server action: cấu hình (setRate/fund/pause) và redeem; guard `assertCan` đầu mỗi
      hàm; ghi PENDING trước khi chờ receipt.
      DoD: guard chặn đúng; giao dịch vào sổ trước khi chờ.
- [ ] T2.3 UI ngân hàng: đặt tỷ giá, nạp quỹ, xem thanh khoản, tạm dừng. UI nhà đầu tư: xem
      quote, nút approve WPT rồi nút redeem.
      DoD: thao tác được từ giao diện, hiện link Etherscan.

## Phase 3 - Kiểm chứng trên Sepolia

- [ ] T3.1 Ngân hàng nạp quỹ: mint VND, `fundRedemption(100_000_000)`.
      DoD: `redemptionLiquidity` = 100.000.000 VND on-chain.
- [ ] T3.2 Nhà đầu tư (có 100 WPT từ P4, đã KYC): `approveWptForRedemption(100)` rồi `redeem(100)`
      với rate 1.000.000.
      DoD: nhà đầu tư nhận 100.000.000 VND; số dư WPT giảm 100; tổng cung WPT giảm 100; tx
      CONFIRMED trên Sepolia.
- [ ] T3.3 Ca lỗi: redeem khi ví chưa KYC, khi thiếu thanh khoản, khi paused.
      DoD: cả ba bị từ chối với message đọc được, KHÔNG đốt WPT.
- [ ] T3.4 (Tùy chọn) `withdraw` phần VND dư về ví ngân hàng.
      DoD: số VND rút đúng, thanh khoản giảm tương ứng.

## Nghiệm thu P12

Trên chain `evm`: ngân hàng nạp quỹ + đặt tỷ giá, nhà đầu tư đổi WPT lấy VND đúng quote và
WPT bị đốt, các ca lỗi bị chặn đúng, mọi tx CONFIRMED và tra được trên Etherscan. Ba luật
kiến trúc giữ nguyên. Không sửa logic contract.

## Checkpoint

Theo `docs/CHECKPOINT_TEMPLATE.md`: DoD từng task, DEVIATION, địa chỉ Redemption trên Sepolia,
bằng chứng số dư trước/sau redeem (WPT giảm, VND tăng) kèm link tx.
