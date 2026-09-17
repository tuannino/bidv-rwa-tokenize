# BE-01 — Mở rộng ILedgerPort: tasks

Nhánh `feat/ledger-port-3flows`, tạo **từ `dev`**.

**Làm một mình task này, merge vào `dev` trước khi mở nhánh khác.** Đây là mắt nghẽn: bảy màn hình và sáu service đều chờ. Nhiều nhánh cùng sửa interface sẽ gây xung đột hàng loạt, đúng kiểu đã xảy ra với `dev` trước đây.

---

## Bước 1: Tách và định nghĩa interface

- [ ] 1.1 Tách `ILedgerPort` thành 7 interface theo nghiệp vụ trong cùng tệp, hợp lại bằng kế thừa kiểu theo `design.md` mục QĐ-1.
- [ ] 1.2 Xác nhận `ILedgerPort` giữ nguyên tên và **không chỗ nào phải sửa lời gọi hiện tại**.
- [ ] 1.3 Thêm kiểu `TransferCheck`.
- [ ] 1.4 Thêm 17 chữ ký method theo `design.md` mục 2.
- [ ] 1.5 Xác nhận không kiểu nào của `viem` xuất hiện trong chữ ký.
- [ ] 1.6 `npm run typecheck` phải đỏ ở ba adapter (chưa hiện thực). Đó là dấu hiệu đúng.

*Commit:* `refactor(ledger): tách ILedgerPort theo nghiệp vụ và thêm chữ ký cho ba luồng`

## Bước 2: Adapter Stellar

- [ ] 2.1 Hiện thực mọi method mới, ném `LedgerNotImplementedError` với gợi ý rõ ràng.
- [ ] 2.2 **Không** trả giá trị giả, kể cả 0 hay mảng rỗng.

*Commit:* `feat(ledger): stellar adapter ném lỗi rõ ràng cho method mới`

## Bước 3: Adapter mock, hiện thực đầy đủ

- [ ] 3.1 Hiện thực 17 method trong bộ nhớ.
- [ ] 3.2 Giữ **đủ** ràng buộc theo bảng ở `design.md` mục 3, không bỏ ca nào.
- [ ] 3.3 `takeSnapshot` lưu bản chụp số dư tại thời điểm gọi, `balanceOfAt` đọc từ bản chụp đó.
- [ ] 3.4 Mã snapshot không tồn tại thì từ chối với lý do rõ ràng.
- [ ] 3.5 Dùng `assertPositiveAmount` cho mọi method nhận số lượng.

*Commit:* `feat(ledger): mock adapter hiện thực đầy đủ ba luồng`

## Bước 4: Test mock ledger

- [ ] 4.1 Mở rộng `app/test/mock-ledger.test.ts` theo **từng dòng** bảng ở `design.md` mục 3.
- [ ] 4.2 Test riêng: khớp lệnh thất bại thì **không** thay đổi số dư của bên nào.
- [ ] 4.3 Test riêng: mua WPT sau khi chốt quyền thì `balanceOfAt` ở mã snapshot cũ không đổi.
- [ ] 4.4 Test riêng: đang tất toán thì chuyển nhượng bị chặn, đốt vẫn chạy.

*Commit:* `test(ledger): phủ toàn bộ ràng buộc của mock adapter`

## Bước 5: Bổ sung `packages/shared`

- [ ] 5.1 Thêm mô tả giao diện hợp đồng khớp lệnh và ví chia lợi nhuận vào `src/abi/`.
- [ ] 5.2 Thêm địa chỉ hợp đồng mới vào `addresses.ts`, giữ quy tắc biến môi trường thắng tệp.
- [ ] 5.3 Không sao chép mô tả giao diện sang bất kỳ nơi nào khác.

*Commit:* `feat(shared): giao diện và địa chỉ hợp đồng mới`

## Bước 6: Adapter EVM

**Nếu SC-02 và SC-03 chưa merge vào `dev`:** bỏ qua bước này, để `evm.adapter` ném `LedgerNotImplementedError` tạm thời, ghi rõ vào checkpoint là nợ chờ hợp đồng, rồi chuyển sang bước 7. Xem `design.md` mục 5.

- [ ] 6.1 Hiện thực 17 method bằng `viem`.
- [ ] 6.2 Mọi method ghi đều **mô phỏng trước khi gửi**.
- [ ] 6.3 Bổ sung mã lỗi mới vào hàm `fail()` để dịch thành câu tiếng Việt đọc được.
- [ ] 6.4 `takeSnapshot` đọc mã snapshot từ sự kiện hợp đồng phát ra, **không** tự tăng số đếm.
- [ ] 6.5 Chuẩn hóa địa chỉ bằng `normalizeEvmAddress` có sẵn.
- [ ] 6.6 Thử trên `hardhat-local` với hợp đồng đã triển khai.

*Commit:* `feat(ledger): evm adapter hiện thực ba luồng`

## Bước 7: Kiểm chứng và tài liệu

- [ ] 7.1 `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` phải rỗng.
- [ ] 7.2 `npm run typecheck` sạch.
- [ ] 7.3 `bash scripts/run-local-all.sh` xanh toàn bộ.
- [ ] 7.4 Cập nhật `tech-report.md` mục 3.1: bảng method của `ILedgerPort`, ghi rõ 7 nhóm.
- [ ] 7.5 Ghi vào mục bài học: vì sao không có method liệt kê người nắm giữ.

*Commit:* `docs: cập nhật báo cáo công nghệ cho ILedgerPort mở rộng`

---

## Việc KHÔNG được làm

- **Không thêm method liệt kê người nắm giữ.** Chuỗi không cung cấp được. Thấy cần thì ghi câu hỏi mở, đừng tự hiện thực bằng cách quét sự kiện trong adapter.
- Không tự chia lô bên trong `distributeBatch`. Tầng nghiệp vụ quyết định.
- Không gọi nguồn tỷ giá trong `quotePurchase`. VNDB quy đổi 1:1.
- Không để kiểu của `viem` lọt ra chữ ký interface.
- Không sửa `assertPositiveAmount`, `LedgerError`, `DEFAULT_RECEIPT_TIMEOUT_MS`.
- Không để `mock.adapter` dễ tính hơn hợp đồng thật.
- Không viết logic nghiệp vụ. Service thuộc BE-02 đến BE-07.

## Checkpoint

`docs/CHECKPOINT_BE01.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn.
2. Bảng 17 method: đã hiện thực ở adapter nào, adapter nào còn nợ và vì sao.
3. Bảng ràng buộc mock: từng dòng ở `design.md` mục 3 đã có test hay chưa.
4. Deviation, câu hỏi mở, sai lệch phát hiện được.
