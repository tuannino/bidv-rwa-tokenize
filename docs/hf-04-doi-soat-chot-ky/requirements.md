# HF-04: đối soát chốt kỳ vault không được thành CONFLICT vì RPC đọc log đi sau

> Mức kiểm chứng: **cao** (luồng chia lợi nhuận, tiền). Nhánh `fix/hf-04-doi-soat-chot-ky` từ `dev` @ `e2a6b98`.
> Supervisor tự làm theo chỉ định của chủ dự án ngày 21/10/2026.

## Mục tiêu

Kỳ `evm:2026-10-21-01` trên Sepolia chia được; lần sau giao dịch chốt kỳ vault của chính kỳ đó không còn bị coi là CONFLICT.

## Hiện trạng đã đo

- OP-05 bước 13.7 sau HF-03: màn báo "Kỳ vault CONFLICT, cần xử lý tay". Đọc Sepolia: `PeriodClosed(periodRef 1, distributedPrev 1.000.000)` tx `0xfc9f…2913`, khớp số kỳ; `ProfitDistributor` giữ 1.000.000 VNDB, 0 hồ sơ trả.
- Nguyên nhân (`syncVaultClose`): gửi `closePeriod` qua RPC chính, biên nhận thành công, rồi đối soát bằng quét log qua RPC đọc log (HF-03, RPC công khai) chưa thấy khối mới, trả `SENT_PENDING`. Lần gọi kế tiếp trong cùng lượt thấy `lastPeriodRef` đã tăng (`last !== ref - 1`), đối soát lại vẫn chưa thấy log, kết luận CONFLICT.
- Tái hiện được trên mock: ca HF-04 ca 1 với mã cũ cho CONFLICT/không chia.
- Màn khoá nút với mọi CONFLICT (`MANUAL_REVIEW`), nên kỳ đang kẹt không bấm tiếp tục được.

## Việc cần làm

1. `ILedgerPort.findVaultPeriodClose(periodRef, hintTxHash?)`; adapter EVM: quét log không thấy thì đọc biên nhận của `hintTxHash` qua RPC chính, lấy `PeriodClosed` đúng `periodRef` (số thật trên chuỗi).
2. `reconcileVaultClose` truyền `vaultCloseTxHash` làm gợi ý; kỳ `CONFLICT` cũng đối soát lại, chỉ về `DONE` khi sự kiện đúng mã kỳ khớp số; `syncVaultClose` gọi đối soát lại cho CONFLICT.
3. Tổng quan màn chia: kỳ CONFLICT mà sự kiện khớp số thì `nextAction = CONTINUE`; còn lại `MANUAL_REVIEW` như cũ.

## Điều kiện hoàn thành

- [ ] `fe-08-approval.test.ts` HF-04 ca 1, 2 xanh, đỏ với mã cũ; ca 5 CONFLICT thật vẫn khoá
- [ ] `hf-04-chot-ky-evm.test.ts` ca 3 xanh trên nút Hardhat (log trễ giả lập), đỏ khi bỏ đường đọc biên nhận
- [ ] Nút Hardhat: `sc-06-distribution-evm`, `fe-08-approval-evm`, `be-13-vault-evm` xanh
- [ ] Mô phỏng job A xanh

## Không làm

- Không sửa database production bằng tay; kỳ đang kẹt tự hồi phục khi Kiểm soát viên bấm tiếp tục.
- Không đổi hợp đồng, quyền, lược đồ.
