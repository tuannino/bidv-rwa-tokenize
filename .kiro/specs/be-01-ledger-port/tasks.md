# BE-01 — Mở rộng ILedgerPort: tasks

Nhánh `feat/ledger-port-3flows`, tạo từ `dev` @ `2e1daa9`.
Spec giao việc: `docs/be-01-ledger-port/tasks.md`. Checkpoint: `docs/CHECKPOINT_BE01.md`.

Làm một mình task này, merge vào `dev` trước khi mở nhánh khác — bảy màn hình và sáu
service đều chờ; nhiều nhánh cùng sửa interface sẽ gây xung đột hàng loạt.

---

## Bước 1: Tách và định nghĩa interface

- [x] 1.1 Tách `ILedgerPort` thành 7 interface theo nghiệp vụ trong cùng tệp, hợp bằng kế thừa kiểu.
- [x] 1.2 `ILedgerPort` giữ nguyên tên; **không lời gọi hiện tại nào phải sửa** — kiểm bằng typecheck: sau khi tách, lỗi duy nhất là `TS2740` ở ba adapter, không có lỗi nào ở nghiệp vụ hay component.
- [x] 1.3 Thêm kiểu `TransferCheck`. Thêm luôn `SnapshotResult` cho giá trị trả về của `takeSnapshot`.
- [x] 1.4 Thêm **16** chữ ký (spec nói 17 — đã đếm lại danh sách chữ ký ở `design.md` mục 2, xem `requirements.md` mục 3).
- [x] 1.5 Không kiểu `viem` nào trong chữ ký: `ledger.port.ts` không import `viem`.
- [x] 1.6 `npm run typecheck` đỏ ở ba adapter — đúng dấu hiệu mong đợi.

*Commit:* `bac0da3 refactor(ledger): tách ILedgerPort theo nghiệp vụ và thêm chữ ký cho ba luồng`

## Bước 2: Adapter Stellar

- [x] 2.1 16/16 method ném `LedgerNotImplementedError`, gợi ý nêu **đúng** thứ còn thiếu (contract SC-02/SC-03 bản Soroban, cơ chế snapshot, địa chỉ VNDB trên Stellar) thay vì một câu chung.
- [x] 2.2 Không giá trị giả. Riêng `canTransfer` cố ý **không** trả `{ allowed: false }`: giao diện sẽ hiểu là quy tắc tuân thủ từ chối và người dùng đi sửa hồ sơ KYC vô ích.

*Commit:* `3939665 feat(ledger): stellar adapter ném lỗi rõ ràng cho method mới`

## Bước 3: Adapter mock, hiện thực đầy đủ

- [x] 3.1 16/16 method trong bộ nhớ.
- [x] 3.2 Đủ 9/9 dòng bảng ràng buộc, không bỏ ca nào.
- [x] 3.3 `takeSnapshot` copy **sâu** bảng số dư; `balanceOfAt` đọc từ bản chụp đó.
- [x] 3.4 Mã snapshot không tồn tại → từ chối, lý do nêu mã hợp lệ hiện có (`1..N`) hoặc nhắc gọi `takeSnapshot()` nếu chưa chốt lần nào. Chặn cả mã 0, âm, không nguyên — khớp hai `require` của `_valueAt`.
- [x] 3.5 `assertPositiveAmount` ở mọi method nhận số lượng: `mintInitialSupply`, `quotePurchase`, `executePurchase`, `canTransfer`, `setNavRate`.

Thêm ngoài spec (xem `design.md` QĐ-K2…K5): chốt quỹ chia tại `takeSnapshot`, gộp ví trùng
trong lô, giá WPT mặc định 100.000 VNDB, `seedMockLedger()` cho test/demo.

*Commit:* `a196a1a feat(ledger): mock adapter hiện thực đầy đủ ba luồng`

## Bước 4: Test mock ledger

- [x] 4.1 11 → **48** test; mỗi dòng bảng `design.md` mục 3 có test riêng (bảng đối chiếu tên test ở checkpoint mục 3).
- [x] 4.2 Test riêng: khớp lệnh thất bại thì **không** bên nào đổi số dư — so sánh cả 6 đại lượng trước/sau bằng một `toEqual`.
- [x] 4.3 Test riêng: mua WPT sau khi chốt quyền thì `balanceOfAt` ở mã cũ không đổi.
- [x] 4.4 Test riêng: đang tất toán thì chuyển nhượng bị chặn, đốt vẫn chạy.
- [x] 4.5 (thêm) Đã thử **3 đột biến** trên mock để chứng minh test không rỗng: bỏ chặn tất toán → 2 đỏ; trừ VNDB trước khi kiểm tồn WPT của SPV → 2 đỏ; cho phát hành lần hai → 1 đỏ. Khôi phục nguyên trạng sau mỗi lần.

*Commit:* `397d05f test(ledger): phủ toàn bộ ràng buộc của mock adapter`

## Bước 5: Bổ sung `packages/shared`

- [x] 5.1 Ví chia lợi nhuận: thêm `profit-distributor.ts` và `redemption.ts`; bổ sung `snapshot`/`balanceOfAt`/`totalSupplyAt`/`getCurrentSnapshotId`/event `Snapshot` vào `projectTokenAbi`, `allowance` vào `vndTokenAbi`.
      **Chưa** thêm ABI hợp đồng khớp lệnh — contract chưa tồn tại nên mọi chữ ký viết ra đều là phỏng đoán, không đối chiếu được với artifact nào (deviation D3).
- [x] 5.2 **Không có địa chỉ mới để thêm**: cả 4 contract đang tồn tại đã có đủ trong `CONTRACT_NAMES` và `addresses.json`. Quy tắc "env thắng file" giữ nguyên (`addresses.ts:45`). Deviation D2.
- [x] 5.3 Không sao chép ABI sang nơi nào khác — `verify-arch-rules.sh` PASS "Không có ABI nhúng trong app/src".
- [x] 5.4 (thêm) Mở rộng `abi-contract-sync.test.ts` từ 2 lên 4 contract, nên ABI mới cũng bị đối chiếu với artifact thật.
- [x] 5.5 (thêm) Thêm mục `error` của OZ v5 vào cả 4 ABI — thiếu thì viem chỉ trả 4 byte selector.

*Commit:* `248757a feat(shared): giao diện hợp đồng cho chốt quyền và chia lợi nhuận`
*Commit:* `40e71cf fix(shared): thêm mục error của OZ v5 vào ABI tối giản`

## Bước 6: Adapter EVM

SC-02 và SC-03 **chưa merge vào `dev`** (đã kiểm bằng `git grep`, xem `requirements.md` mục
2.2). Theo `design.md` mục 5 thì được bỏ qua bước này — nhưng đã hiện thực phần **không chờ
contract mới**, xem `design.md` QĐ-K6 và deviation D1.

- [x] 6.1 6/16 method bằng `viem`: `canTransfer`, `takeSnapshot`, `balanceOfAt`, `totalSupplyAt`, `paymentBalanceOf`, `profitPoolBalance`. 10 method còn lại ném `LedgerNotImplementedError`.
- [x] 6.2 Mọi method ghi vẫn mô phỏng trước khi gửi (`write()` không đổi hành vi).
- [x] 6.3 Thêm bảng `REVERT_MESSAGES` dịch revert thô sang tiếng Việt có dấu. **Đồng thời sửa lỗi sẵn có**: thứ tự đọc reason bị ngược làm mọi lỗi tuân thủ ra `Contract từ chối: Error` (xem `design.md` mục 5.1).
- [x] 6.4 `takeSnapshot` đọc mã từ event `Snapshot` trong receipt, không tự tăng số đếm, không gọi `getCurrentSnapshotId()` sau khi gửi (`design.md` QĐ-K1).
- [x] 6.5 Chuẩn hóa địa chỉ bằng `normalizeEvmAddress` có sẵn.
- [x] 6.6 Đã thử trên `hardhat-local` với contract đã deploy: **8/8 mục đạt**, kết quả nguyên văn ở checkpoint mục 5.2. Test tạm đã xoá (giữ lại sẽ làm `run-local-all.sh` đỏ khi không có node).

*Commit:* `251ad4c feat(ledger): evm adapter hiện thực phần không chờ hợp đồng mới`

## Bước 7: Kiểm chứng và tài liệu

- [x] 7.1 `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` rỗng.
- [x] 7.2 `npm run typecheck` sạch.
- [x] 7.3 `bash scripts/run-local-all.sh` xanh 6/6, 0 FAIL. 6 cảnh báo đều có trước BE-01.
- [x] 7.4 `docs/tech-report.md` mục 3.1: bảng 27 method / 7 nhóm + cột trạng thái từng adapter + cột "chờ gì". Thêm mục 3.7 (ABI phải có mục `error`), 1.6.A (5 dòng), 1.6.B (3 dòng), 1.6.C (nợ P1).
- [x] 7.5 `.kiro/steering/lessons.md`: 7 mục mới, gồm vì sao không có method liệt kê người nắm giữ.

*Commit:* `e73e801 docs: cập nhật báo cáo công nghệ cho ILedgerPort mở rộng`
*Commit:* `7db560b docs: checkpoint BE-01`

---

## Việc KHÔNG được làm — đã tuân thủ

- [x] Không thêm method liệt kê người nắm giữ.
- [x] Không tự chia lô trong `distributeBatch`.
- [x] Không gọi nguồn tỷ giá trong `quotePurchase`.
- [x] Không để kiểu `viem` lọt ra chữ ký interface.
- [x] Không sửa `assertPositiveAmount`, `LedgerError`, `DEFAULT_RECEIPT_TIMEOUT_MS`.
- [x] Không để `mock.adapter` dễ tính hơn contract thật.
- [x] Không viết logic nghiệp vụ — không tạo/sửa file nào trong `lib/bank/`.

## Còn nợ (sang task sau)

| Việc | Chờ | Thuộc |
|---|---|---|
| `evm`: `mintInitialSupply`, `isInitialSupplyMinted` | contract phát hành một lần | SC-02 |
| `evm`: `quotePurchase`, `paymentAllowanceOf`, `executePurchase` | contract khớp lệnh | SC-03 |
| `evm`: `setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate` | trả lời câu hỏi mở 3 và 4 | SC-02 |
| `evm`: `distributeBatch` | trả lời câu hỏi mở 2 | BE-06 |
| `stellar`: hiện thực thật | contract Soroban | Phase 7 |

Khi contract xong, bổ sung `evm.adapter` trong **commit riêng** (`design.md` mục 5 điểm 5).
Năm câu hỏi mở ở `docs/CHECKPOINT_BE01.md` mục 8.
