# SC-03 — Khớp lệnh mua/bán nguyên tử trên EVM

| | |
|---|---|
| Trạng thái | **Đề xuất** — thực hiện sau SC-02 |
| Nhánh đề xuất | `feat/sc-03-evm-order-settlement`, tạo từ `dev` đã có SC-02 |
| Phụ thuộc | SC-02, BE-02, BE-04, BE-14; AU-01 là cổng bắt buộc trước production công khai |
| Mức kiểm chứng | **Cao nhất** — chuyển đồng thời WPT và VNDB của khách hàng/SPV |

## 1. Mục tiêu

Tạo hợp đồng quyết toán một giao dịch để khớp cả hai chiều:

- Mua: VNDB Nhà đầu tư → SPV và WPT SPV → Nhà đầu tư.
- Bán: WPT Nhà đầu tư → SPV và VNDB SPV → Nhà đầu tư.

Bốn bút toán của mỗi lệnh phải cùng thành công hoặc cùng revert. Giá contract dùng phải là cùng giá
`quotePurchase` mà ứng dụng hiển thị và chốt vào lệnh.

## 2. Hiện trạng đã đo

- `evm.adapter.ts` còn 5 marker SC-03: `quotePurchase`, `setPurchasePrice`,
  `paymentAllowanceOf`, `executePurchase`, `executeSale`.
- `purchase.service.ts` đã chốt `vndAmount`, kiểm lại giá ngay trước khớp và có năm bước quyết toán.
- `ProjectToken`/`VNDToken` đều là ERC-20; chưa có contract làm spender/chuyển hai tài sản nguyên tử.
- Chiều mua đã kiểm allowance VNDB. Chiều bán và allowance phía SPV/WPT chưa có cổng đọc tương ứng.
- Phiên PoC hiện là cookie tự đặt; vì vậy triển khai production công khai phải chờ AU-01 hoặc một cơ
  chế chữ ký lệnh tương đương, dù contract atomic đã hoàn thành.

## 3. Yêu cầu chức năng

### R1 — Hợp đồng `OrderSettlement`

1. Constructor nhận địa chỉ WPT, VNDB, admin và giá ban đầu > 0.
2. Có `SETTLEMENT_ROLE` cho ví vận hành khớp lệnh và `PRICE_ROLE` cho cập nhật giá.
3. `quote(wptAmount)` trả `wptAmount * pricePerWpt`; chặn overflow bằng Solidity 0.8.
4. `setPrice` chặn giá 0 và phát sự kiện giá cũ/giá mới/người đổi.
5. `buy(investor, wptAmount, expectedVndAmount)` và
   `sell(investor, wptAmount, expectedVndAmount)` kiểm giá kỳ vọng trước khi chuyển.
6. Dùng `SafeERC20` + `ReentrancyGuard`; mọi chuyển nằm trong một tx.
7. Đọc SPV từ ProjectToken SC-02 tại thời điểm gọi; không lưu bản sao có thể lệch.
8. Phát sự kiện quyết toán có chiều, nhà đầu tư, SPV, WPT, VNDB và người khớp.

### R2 — Giá đã chốt không bị trượt

1. Adapter/service phải truyền `vndAmount` đã chốt ở lệnh xuống contract, không chỉ truyền WPT.
2. Nếu giá đổi sau bước kiểm cuối nhưng trước khi tx được đào, contract phải revert vì
   `expectedVndAmount` khác báo giá hiện tại.
3. Do đó cần đổi chữ ký `ILedgerPort.executePurchase/executeSale` để nhận số VNDB kỳ vọng; cập nhật
   cả mock và stellar stub, không gọi DB từ adapter.

### R3 — Allowance và chặn sớm

1. BUY cần allowance VNDB của Nhà đầu tư và allowance WPT của SPV cho OrderSettlement.
2. SELL cần allowance WPT của Nhà đầu tư và allowance VNDB của SPV cho OrderSettlement.
3. Mở rộng `ILedgerPort` bằng phép đọc allowance WPT cần thiết; `paymentAllowanceOf` dùng đúng địa
   chỉ OrderSettlement làm spender.
4. `runOrderChecks` chặn thiếu bất kỳ allowance nào **trước khi gửi tx**, nêu owner, token, spender,
   số cần và số đã cấp.
5. Deploy/runbook Hardhat chuẩn bị allowance của SPV; Nhà đầu tư phải tự approve từ ví của mình.
   Không dùng `forcedTransfer`/AGENT_ROLE để né consent.

### R4 — Adapter, deploy và registry

1. Hiện thực đủ 5 marker SC-03 và gỡ marker sau khi test xanh.
2. Thêm `OrderSettlement` vào deploy script, addresses registry, biến env override, ABI tối giản,
   ABI sinh tự động và kiểm deployment.
3. Cấp đúng role; không cấp `DEFAULT_ADMIN_ROLE` cho ví ứng dụng nếu không cần.
4. Lỗi thiếu balance/allowance/role, sai giá, KYC/freeze được dịch thành lỗi nghiệp vụ rõ.

### R5 — Nghiệm thu hai chiều

1. BUY thành công đổi đúng bốn số dư; thiếu VNDB, thiếu hai allowance hoặc thiếu tồn WPT đều không
   đổi số dư nào.
2. SELL thành công đổi đúng bốn số dư; thiếu WPT, thiếu thanh khoản SPV hoặc thiếu allowance đều
   không đổi số dư nào.
3. Giá đổi giữa đặt và khớp làm lệnh bị từ chối theo quy tắc hiện tại; race sau kiểm cuối vẫn revert
   on-chain nhờ `expectedVndAmount`.
4. UI mock hiện có và toàn bộ test mua/bán cũ vẫn xanh.
5. E2E Hardhat đi qua service/UI, không gọi thẳng contract để giả lập kết quả ứng dụng.

## 4. Cổng an toàn trước production

SC-03 hoàn thành chỉ cho phép demo Hardhat/Sepolia có kiểm soát. Trước khi public production:

- AU-01 phải thay cookie tự đặt bằng phiên xác thực và ràng buộc tài khoản với ví.
- Lệnh phải có bằng chứng consent không thể giả mạo (phiên SIWE và/hoặc chữ ký nội dung lệnh).
- Allowance phải do chủ ví cấp; không lưu khóa Nhà đầu tư/SPV trên server.
- Có quy trình thu hồi role, pause và đối soát tx lỗi.

Không đạt các cổng này thì cấu hình production không được bật chain EVM cho đặt/khớp lệnh.

## 5. Điều kiện hoàn thành

- [ ] Hợp đồng mua/bán nguyên tử và test mutation đều xanh.
- [ ] 5 marker SC-03 bằng 0; marker SC-04/05 giữ nguyên.
- [ ] Giá chốt được truyền xuống contract và race đổi giá bị chặn on-chain.
- [ ] Mọi allowance cần thiết được đọc/kiểm trước tx; không dùng forced transfer.
- [ ] Deploy/ABI/address/env/verify đồng bộ.
- [ ] E2E Hardhat mua và bán qua đúng service/UI xanh; số dư bốn phía đối chiếu đúng.
- [ ] `run-local-all.sh`, build, E2E mock xanh.
- [ ] Checkpoint ghi rõ SC-03 chưa thay thế AU-01 và chưa tự động mở production.

## 6. Không làm

- Không làm tất toán/NAV; thuộc SC-04.
- Không làm chia lợi nhuận; `distributeBatch` còn thuộc SC-05.
- Không dùng AGENT `forcedTransfer` thay cho allowance của chủ tài sản.
- Không giữ tiền trong OrderSettlement lâu hơn một tx.
- Không thêm order book on-chain; DB hiện tại vẫn giữ vòng đời và kiểm toán lệnh.
