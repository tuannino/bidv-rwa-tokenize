# FE-07: thiết kế

## 1. Đổi giá

```
setIssuePrice(chain, priceVnd, reason, confirmLargeChange)
  kiểm dữ liệu (reason bắt buộc 5 tới 200 ký tự)
  kiểm quyền: treasury:manage rồi cờ cấu hình của vai (như cũ, ghi sổ cả lần bị chặn)
  đếm lệnh PLACED, CHECKING, EXECUTING trên chain (countOrders)   > 0: REQUEST_STATE, không gửi gì
  kiểm ngưỡng so với giá đã cấu hình (như cũ)
  gửi OrderSettlement.setPrice
  waitReceipt(txHash, theo chain)
    CONFIRMED: setConfig(key, giá mới, reason + "; tx " + txHash)   lỗi: hoàn nguyên giá cũ trên chuỗi, chờ biên nhận hoàn nguyên
    FAILED:    sổ FAILURE, trả LEDGER, database không đổi
    PENDING:   sổ FAILURE "đã gửi, chưa có xác nhận", trả LEDGER với câu hướng dẫn ở requirements mục 3
```

- Vì sao chặn khi còn lệnh đang xử lý: lệnh đã chốt số VNDB theo giá cũ; `OrderSettlement` kiểm lại `vndb == wpt nhân price` khi thực thi nên lệnh sẽ bị từ chối trên chuỗi. Với PoC (quyết toán tự động ngay sau khi đặt), khoảng thời gian có lệnh đang xử lý ngắn; lệnh kẹt thì xử lý ở `/transactions` trước.
- Không thêm trạng thái mới: lần đổi giá chưa có xác nhận được phát hiện lại bằng cảnh báo lệch giá có sẵn trong `getIssuePrice` (giá trên chuỗi khác giá đã cấu hình). Giao dịch viên đặt lại đúng giá đó thì ngưỡng không chặn (giá cũ trong database bằng giá trên chuỗi trước khi đổi), chuỗi nhận giá trùng, database ghi nhận.

## 2. Một nguồn giá

```
readEffectiveIssuePrice(chain, preread?)
  chain có OrderSettlement trong address book:  ledger.quotePurchase(1n)   (preread nếu người gọi đã đọc)
  ngược lại:                                     readIssuePriceVnd(chain)
```

- Đặt cạnh `readIssuePriceVnd` để người đọc mã thấy hai hàm và biết khi nào dùng hàm nào: `readIssuePriceVnd` là **giá đã cấu hình** (dùng ở màn cấu hình, kiểm ngưỡng), `readEffectiveIssuePrice` là **giá áp dụng cho lệnh** (dùng ở mọi màn khách hàng).
- Quy tắc chọn nguồn phải giống hệt `getIssuePrice` (`findContractAddress(chain, 'OrderSettlement')`). Viết một hàm dùng chung, không viết hai điều kiện rời.

## 3. Màn `/config`

- Bố cục hai cột trên màn rộng, một cột trên điện thoại: trái "Giá phát hành" và "Đổi giá"; phải "Tình trạng phát hành"; dưới "Lịch sử đổi giá" toàn bề ngang.
- Nút chính duy nhất: "Đổi giá" (chỉ khi `canEdit`).
- Số tiền căn phải, `tabular-nums`, đơn vị "VNDB" sau số. Địa chỉ ví SPV rút gọn, có nút chép.
- Sau khi đổi giá thành công: tải lại tổng quan bằng chính action mở màn (không thêm action riêng).
- Trạng thái rỗng của lịch sử: "Chưa có lần đổi giá nào. Giá đang dùng là giá mặc định của dự án."

## 4. Action tổng quan

```ts
getPriceConfigOverviewAction({ chain }): {
  price: IssuePriceView,                 // getIssuePrice
  thresholdTimes: number,                // readPriceChangeThreshold
  canEdit: boolean,                      // can(role, 'treasury:manage') && isConfigRole(role)
  issuance: { cap, supply, remaining, issuedAt, spvWallet },   // đọc như getIssuanceStatus nhưng không qua authorize
  history: ConfigHistoryRecord[],        // listConfigHistory({ key, limit: 20 })
  inFlightOrders: { placed, checking, executing },             // để màn báo trước khi người dùng gõ
}
```

Kiểm quyền `assertCan(role, 'ops:read')`. Các lời đọc chuỗi chạy song song.

## 5. Nội dung chép vào `docs/tech-report.md`: "Fireblocks: quyết định cho PoC và mô hình tham chiếu"

> Chép nguyên văn khối dưới vào tech-report (mục kiến trúc hoặc mục nợ kỹ thuật, theo cấu trúc hiện có).

### Quyết định PoC (Sếp chốt 23/10/2026)

- Nhà đầu tư có hai lựa chọn ví: **ví ngoài** tự giữ khoá (MetaMask, như hiện tại) và **ví Fireblocks** do ngân hàng cấp (mỗi nhà đầu tư một vault account, ẩn khỏi Console). Bỏ phương án máy chủ tự sinh ví từ một khoá gốc.
- Cơ chế ký: **Vault Accounts** (lưu ký MPC trong workspace, áp TAP). Embedded Wallets (ví không lưu ký trên thiết bị người dùng) và API Co-signer tự vận hành cấp sản xuất: nợ kỹ thuật.
- PoC **không** tách vault theo lớp nóng, ấm, lạnh; ví ngân hàng dùng một vault vận hành. Mô hình dưới là tham chiếu cho sản phẩm thật.
- FE-23 chốt theo kết quả kiểm sandbox K0: ký được permit EIP-712 từ vault thì FE-23 là "chuyển ra ví ngoài" cho nhà đầu tư dùng ví Fireblocks; không ký được thì dùng `approve` cộng Gas Station, hoặc giữ FE-23 dạng đổi VNDB ra tiền tài khoản.
- Kết quả kiểm sandbox K0 (6 câu hỏi: tạo vault qua API, gọi hàm hợp đồng, ký EIP-712, TAP, có cần Co-signer, SDK trên Workers): bổ sung vào mục này khi có.

### Mô hình tham chiếu: tách vault theo mức rủi ro của vai

| Lớp | Vault | Vai trên hợp đồng | Quy tắc TAP gợi ý |
|---|---|---|---|
| Nóng (tự động) | Vận hành | OPERATOR (khớp lệnh), DISTRIBUTOR (chia lô), AGENT trên IdentityRegistry (định danh) | Tự ký trong hạn mức, chỉ tới hợp đồng của dự án |
| Ấm (cần người duyệt) | Phát hành và ngân quỹ | MINTER, AGENT trên WPT (đốt, thu hồi, cưỡng chế), CONFIG và WITHDRAWER của vault SPV, PRICE, MINTER của VNDB | 1 đến 2 người duyệt; lập duyệt đưa xuống tầng ký |
| Lạnh (hiếm dùng) | Quản trị | DEFAULT_ADMIN của cả chín hợp đồng | Nhiều người duyệt; workspace lạnh ở bản thật |
| Khách hàng | Mỗi nhà đầu tư một vault | Không có vai | Chuyển ra ngoài chỉ tới địa chỉ cho phép, có hạn mức |

- Không dùng vault gom chung (omnibus) cho WPT của nhà đầu tư: ERC-3643 định danh từng ví; snapshot chia lợi nhuận và thu hồi tính theo ví.
- Lợi ích chính so với hiện tại (một khoá giữ mọi vai): lộ vault nóng không phát hành, đốt token hay đổi vai được.
- Chuyển sang mô hình này không sửa hợp đồng: chỉ cấp vai cho địa chỉ vault mới và thu vai khỏi khoá cũ.

### Ghi chú kiến trúc: gửi giao dịch qua Fireblocks và Indexer

- Gửi qua Fireblocks là **bất đồng bộ**: tạo giao dịch, chờ TAP và ký (có thể nhiều phút), Fireblocks phát giao dịch, rồi mới có mã giao dịch Sepolia và biên nhận.
- Hai việc tách riêng:
  - **Theo dõi giao dịch do hệ thống gửi** (mã giao dịch Fireblocks, trạng thái ký, mã giao dịch chuỗi, biên nhận): thuộc tầng ký và gửi (IN-03), cập nhật bằng webhook hoặc hỏi định kỳ, dùng lại mẫu "đang thực hiện, đối soát" của HF-05.
  - **Indexer** (IN-01): đọc sự kiện chuỗi đã xảy ra, từ mọi nguồn (kể cả thao tác ngoài ứng dụng), là nguồn sự thật cho lịch sử và danh sách người nắm giữ.
- Trạng thái hiện tại (số dư, phần rút được, giá) vẫn đọc trực tiếp bằng lời gọi chỉ đọc vì rẻ và cần mới nhất.
