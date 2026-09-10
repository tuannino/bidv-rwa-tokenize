# Spec P12 - Design

## Contract dùng (giữ nguyên, đã pass test)

- `Redemption.sol` (AccessControl + ReentrancyGuard):
  - immutable `projectToken` (WPT), `payoutToken` (VND); state `rate` (VND/1 WPT), `paused`.
  - `setRate(newRate)` [MANAGER_ROLE], `setPaused(status)` [MANAGER_ROLE].
  - `fund(amount)` [MANAGER_ROLE] (ngân hàng approve VND trước rồi nạp quỹ).
  - `withdraw(to, amount)` [MANAGER_ROLE].
  - `quote(wptAmount)` view = wptAmount * rate.
  - `redeem(wptAmount)` (nhà đầu tư): yêu cầu whitelist, đủ thanh khoản, không paused; gọi
    `projectToken.burnFrom(msg.sender, wptAmount)` (tiêu allowance WPT nhà đầu tư cấp) rồi
    chuyển VND. Vì dùng `burnFrom`, nhà đầu tư phải `approve` WPT cho hợp đồng Redemption trước.
- `ProjectToken.burnFrom` có sẵn từ ERC20Burnable; không cần cấp thêm role cho Redemption.
- `VNDToken`: ngân hàng `mint` VND làm quỹ, `approve` cho Redemption trước khi `fund`.

Constructor `Redemption` cấp cho ví deployer (ngân hàng) cả DEFAULT_ADMIN + MANAGER, nên
ngân hàng làm được setRate/fund/withdraw/setPaused không cần cấp thêm role.

## Deploy cho testnet

`Redemption` đã nằm trong `scripts/deploy.js` (deploy cùng bộ, rate mặc định 1 WPT = 1.000.000
tVND). Nếu Phase 0 của P4 đã chạy deploy.js trên Sepolia thì Redemption đã có địa chỉ; chỉ
cần nạp env `NEXT_PUBLIC_ADDR_EVM_REDEMPTION`. Nếu muốn rate khác, đặt lại bằng `setRate`
sau deploy (không sửa contract).

## Mở rộng nguồn sự thật (packages/shared)

- `Redemption` đã có trong `CONTRACT_NAMES`. Thêm ABI tối giản `abi/redemption.ts` (setRate,
  setPaused, fund, withdraw, quote, redeem, rate, paused, sự kiện Redeemed/Funded), export ở
  `abi/index.ts`. Đối chiếu `generated/Redemption.abi.json`. Không copy ABI ra ngoài shared.
- Cần thêm ABI/thao tác `approve` của VNDToken và WPT (đã có `vndTokenAbi`; WPT approve dùng
  `projectTokenAbi`, vì ProjectToken là ERC20 chuẩn có approve).

## Mở rộng ILedgerPort (LUẬT 1)

Bổ sung cụm phương thức tất toán (trong port hiện có hoặc `IRedemptionPort` mà `getLedger`
trả cùng đối tượng). Đề xuất chữ ký:

```ts
setRedemptionRate(rate: bigint): Promise<TxResult>;          // ngân hàng
fundRedemption(amountVnd: bigint): Promise<TxResult>;        // approve VND rồi fund
setRedemptionPaused(paused: boolean): Promise<TxResult>;     // ngân hàng
quoteRedemption(wptAmount: bigint): Promise<bigint>;         // view
approveWptForRedemption(wptAmount: bigint): Promise<TxResult>; // nhà đầu tư approve WPT
redeem(wptAmount: bigint): Promise<TxResult>;                // nhà đầu tư
redemptionLiquidity(): Promise<bigint>;                      // VND balance của hợp đồng
```

Adapter EVM hiện thực: đọc địa chỉ+ABI Redemption riêng (không tái dùng biến ProjectToken
cứng). `fundRedemption` gồm hai tx: `VNDToken.approve(redemption, amount)` rồi
`redemption.fund(amount)`. `redeem` cần nhà đầu tư đã `approve` WPT cho redemption trước
(bước approveWptForRedemption), sau đó `redemption.redeem(wptAmount)`. Giữ mẫu
`simulateContract` trước mỗi tx ghi để bắt lỗi tuân thủ không tốn gas (chưa KYC, thiếu
thanh khoản, paused ra message đọc được).

Mock adapter: bổ sung bản mock cho cụm tất toán để demo không cần chain.

## RBAC (LUẬT 3)

Thêm ACTIONS vào `permissions.ts` (chỉ sửa bảng):
- `redeem:configure` (setRate/fund/withdraw/setPaused) cho BANK_ADMIN.
- `redeem:execute` (redeem) cho INVESTOR.
Server action gọi `assertCan` tương ứng đầu mỗi hàm.

## Luồng end-to-end trên testnet

1. Ngân hàng: `setRedemptionRate(1_000_000)` (nếu đổi so với deploy).
2. Ngân hàng: mint VND quỹ, `fundRedemption(100_000_000)` (approve rồi fund).
3. Nhà đầu tư (đã có WPT từ P4, đã KYC): `approveWptForRedemption(100)` rồi `redeem(100)`.
4. Kết quả: nhà đầu tư nhận 100 * rate VND, WPT của họ bị đốt, tổng cung WPT giảm.

## Ghi sổ và audit

Ghi PENDING trước khi chờ receipt. Sự kiện `Funded`, `Redeemed` dùng dựng lịch sử và đối
soát quỹ VND vào/ra.

## Rủi ro

- Nhà đầu tư quên approve WPT: `redeem` revert do thiếu allowance. UI phải dẫn bước approve
  trước redeem, hoặc gộp hai bước rõ ràng.
- Đơn vị VND (decimals 0) và rate lớn: `quote = wptAmount * rate` có thể ra số lớn; kiểm quỹ
  đủ trước khi cho redeem để không đốt WPT rồi mới phát hiện thiếu VND (contract đã kiểm, nhưng
  UI nên báo sớm).
- Nhầm thanh khoản: `redemptionLiquidity` hiển thị để ngân hàng biết còn đủ chi trả.
