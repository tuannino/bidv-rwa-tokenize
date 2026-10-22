# HF-05: thiết kế

## 1. Luật "chưa có biên nhận thì chưa có kết cục"

| Biên nhận | Yêu cầu phát hành, huỷ | Lệnh mua bán |
|---|---|---|
| CONFIRMED | COMPLETED (như cũ) | COMPLETED (như cũ) |
| FAILED | FAILED (như cũ) | FAILED, qua `finalizeOrderFailure` (như cũ) |
| PENDING | **Giữ EXECUTING** + `txHash`, chờ đối soát | Tra chuỗi: thấy `OrderSettled` thì COMPLETED; không thấy thì **giữ EXECUTING** + `txHash` |
| Ném lỗi khi chờ, đã có `txHash` | Giữ EXECUTING (như cũ, nhánh `submitted`) | Như dòng PENDING |
| Ném lỗi trước khi có `txHash` | FAILED (như cũ) | FAILED (như cũ) |

Lý do: hết giờ chờ không chứng minh giao dịch hỏng. Ghi COMPLETED là nói "đã tác động token" khi chưa chắc. Ghi FAILED là nói "chưa tác động" trong khi giao dịch vẫn có thể vào block. Cả hai đều là trạng thái kết thúc, không quay lại được.

## 2. Phát hành, huỷ

```
approveTokenRequest
  PENDING sang EXECUTING (chiếm quyền, như cũ)
  executeIssuance / executeBurn: gửi giao dịch, attachRequestTxHash, trackTxn (như cũ)
  cập nhật Txn theo (chain, txHash)
    CONFIRMED: đọc tổng cung (Mint) rồi finalizeTokenRequest
    FAILED:    EXECUTING sang FAILED (như cũ)
    PENDING:   giữ EXECUTING, sổ order:approve "đã gửi, chưa có biên nhận"

reconcileTokenRequest (mới, quyền order:approve)
  yêu cầu phải EXECUTING, có txHash, đúng chain đang chọn
  waitReceipt(txHash, 1000)            ném lỗi thì coi như PENDING
  cập nhật Txn theo (chain, txHash)    không có thì tạo, không tạo trùng
    CONFIRMED: đọc tổng cung (Mint) rồi finalizeTokenRequest
               lỗi đọc hoặc lỗi transaction: giữ EXECUTING, báo đối soát lại
               finalizeTokenRequest trả null: báo đã chốt ở lượt khác
    FAILED:    một transaction: EXECUTING sang FAILED + sổ order:approve FAILURE
    PENDING:   không đổi gì
```

**`finalizeTokenRequest` (thao tác lưu trữ mới, một transaction):**

```
BEGIN
  UPDATE TokenRequest SET status='COMPLETED', txHash, updatedAt
    WHERE id=$id AND status='EXECUTING'          0 dòng: ROLLBACK, trả null
  (Mint) UPDATE Project SET issuedAt=now()
    WHERE id=$projectId AND issuedAt IS NULL     0 dòng: bình thường
  INSERT AuditLog token:mint | token:burn SUCCESS (chi tiết có tổng cung đọc trước, mã giao dịch)
  INSERT AuditLog order:approve SUCCESS
COMMIT
```

Vì sao phải nguyên tử, không chỉ đưa câu chuyển trạng thái lên trước: nếu chuyển COMPLETED trước rồi mới ghi sổ, tiến trình chết ở giữa để lại yêu cầu COMPLETED mà thiếu dòng sổ, và không lượt nào ghi bù được (lượt sau thấy COMPLETED nên dừng). Gom vào một transaction thì chỉ có hai kết cục: đủ cả, hoặc không có gì (yêu cầu còn EXECUTING, đối soát lại được).

Bản bộ nhớ: kiểm `status === 'EXECUTING'` rồi ghi ba chỗ liên tiếp, không có `await` xen giữa (JavaScript một luồng nên đoạn đồng bộ là nguyên tử).

- Sổ kiểm toán ghi trực tiếp bằng câu SQL trong transaction (cùng database), không gọi `appendAudit` qua kết nối khác.
- `@flow` marker: giữ số bước cũ. Nếu thêm bước đối soát thì cập nhật sơ đồ luồng bằng `node scripts/gen-flow-diagram.mjs issue` (và `purchase` nếu đổi marker). Bài học HF-04: quên bước này là job A đỏ.

## 3. Lệnh mua bán

Trong `sendAndSettle` (`purchase.service.ts`, bước 8 và 9), trước khi gọi `finalizeOrderFailure` cho nhánh PENDING hoặc nhánh ném lỗi khi chờ:

```
lookup = findOrderSettlement(order.id)   (chain có OrderSettlement, mock luôn có)
  SETTLED:            completeOrderFromChain (như cũ)
  SETTLED_TX_UNKNOWN: giữ nguyên, báo đối soát (như cũ)
  NOT_FOUND:          giữ EXECUTING + txHash; sổ FAILURE "chưa có biên nhận, chờ đối soát"; trả LEDGER
  tra lỗi:            giữ nguyên (như cũ)
```

Áp cho **hai nơi**: `sendAndSettle` (gửi lần đầu) và `reconcileExecutingOrder` (đối soát từ `/transactions`, nhánh ném lỗi khi chờ và nhánh biên nhận khác CONFIRMED mà không phải FAILED).

Cách làm gọn nhất: thêm vào `OrderFailure` cờ `receiptUnknown: true`. Trong `finalizeOrderFailure`, khi cờ bật và tra chuỗi không thấy thì **không** gọi `transitionOrder` sang FAILED. Nhánh FAILED thật (biên nhận revert) không bật cờ, giữ nguyên hành vi.

## 4. Màn

- `approval-detail.tsx`: thông báo theo `result.data.status`: COMPLETED màu xanh như cũ; EXECUTING màu vàng (câu ở requirements mục 3). Nút "Đối soát" đặt cạnh khối quyết định, ẩn khi không đủ điều kiện; trong lúc chạy thì khoá nút như `startWork` hiện có.
- `distribution-approval.tsx`: thêm một hàm thuần `approvedAmountLabel(period, variant)` để dùng ở cả ô và bảng, kiểm được bằng test không cần render.
