# HF-02: kiểm thử FE-05 không phụ thuộc address book thật của `evm`

> Mức kiểm chứng: **thấp** (chỉ sửa kiểm thử, không đổi mã app). Nhánh `fix/hf-02-test-dia-chi-evm` từ `dev` @ `07b8f27`.
> Supervisor tự làm theo chỉ định của chủ dự án ngày 21/10/2026 ("có lỗi thì tạo hotfix").

## Mục tiêu

CI job A xanh lại sau PR B của OP-05 (PR #64).

## Hiện trạng đã đo

- CI job A của PR #64 đỏ đúng 1 ca: `test/fe-05-permit-order.test.ts` "mock, chain thiếu OrderSettlement và vai không có order:place đều bị chặn" (dòng 243), nhận `ok: true` thay vì `LEDGER`.
- Nguyên nhân: ca này coi `evm` là "chain thiếu OrderSettlement" bằng address book thật. PR #64 nạp bộ hợp đồng Sepolia có `OrderSettlement` (`0x6D98…fD27`), nên `preparePermit` đi tiếp và đọc nonce trên Sepolia thật từ kiểm thử.
- Mã app đúng; chỉ giả định của kiểm thử hết đúng.

## Việc cần làm

1. Trong `app/test/fe-05-permit-order.test.ts`: `vi.mock('@bidv/shared')` giữ nguyên mọi thứ, riêng `findContractAddress('evm', 'OrderSettlement')` trả `undefined`. Các ca khác dùng `hardhat-local` nên không bị ảnh hưởng.

## Điều kiện hoàn thành

- [ ] `fe-05-permit-order.test.ts` xanh; bỏ phần ghi đè thì ca đó đỏ lại
- [ ] Mô phỏng job A (không có artifacts) xanh

## Không làm

- Không đổi mã app, hợp đồng, địa chỉ.
- Không xử lý chuyện kiểm thử đơn vị có thể gọi mạng thật (ghi nhận ở checkpoint, để Supervisor đưa vào job D).
