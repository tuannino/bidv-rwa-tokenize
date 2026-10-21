# HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block

> Mức kiểm chứng: **vừa** (cổng blockchain, chỉ đường đọc sự kiện; không đổi ghi, quyền, dữ liệu, hợp đồng).
> Nhánh `fix/hf-03-doc-log-evm` từ `dev` @ `268e5b3`. Supervisor tự làm theo chỉ định của chủ dự án ngày 21/10/2026.

## Mục tiêu

Màn `/vault` đọc được lịch sử cấu hình và lịch sử chốt kỳ trên Sepolia; vòng chia lợi nhuận (đối soát `PeriodClosed`) chạy được với RPC chính là Alchemy gói miễn phí.

## Hiện trạng đã đo

- OP-05 bước 12 trên production: hai khối lịch sử báo "JSON is not a valid request object".
- Chủ dự án gọi thẳng RPC Alchemy (21/10): `eth_getLogs` từ `0xB67DAF` tới `latest` trả `-32600 "Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range"`, cả đơn lẫn lô; khoảng 10 block thì trả dữ liệu.
- RPC công khai `ethereum-sepolia-rpc.publicnode.com`: 50.000 block đạt, 100.000 block báo `exceed maximum block range: 50000`.
- Bốn chỗ quét sự kiện trong `evm.adapter.ts`: `readPeriodCloses` (dùng bởi `findVaultPeriodClose` trong `syncVaultClose` của luồng chia, và `vaultPeriodCloses`), `findVaultWithdrawals`, `vaultConfigEvents` quét một lần từ block triển khai tới `latest`; `findOrderSettlement` đã chia đoạn.

## Việc cần làm

1. `RPC_EVM_LOGS` (tuỳ chọn) và `EVM_LOG_BLOCK_CHUNK` (mặc định 10.000) trong `config/env.ts`; `logsRpcUrlFor(chain)` ở `chains/registry.ts`: `evm` dùng `RPC_EVM_LOGS`, trống thì RPC công khai mặc định của chain; chain khác dùng RPC chính.
2. `evm.adapter.ts`: `logReader()` (client đọc sự kiện, gom lô như `reader`) và `scanLogs` chia đoạn; ba chỗ quét một lần chuyển sang `scanLogs`; `findOrderSettlement` dùng `logReader()`.
3. Kiểm thử `test/hf-03-doc-log-evm.test.ts` với máy chủ JSON-RPC giả từ chối khoảng quét quá 10 block.
4. Runbook bước 9, `.env.example`, `tech-report.md` 1.6 A.

## Điều kiện hoàn thành

- [ ] `hf-03-doc-log-evm.test.ts` ca 1 đến 3 xanh; bỏ chia đoạn hoặc đọc sự kiện qua RPC chính thì đỏ
- [ ] Nút Hardhat thật: `sc-06-distribution-evm`, `be-13-vault-evm`, `fe-08-approval-evm` xanh với `EVM_LOG_BLOCK_CHUNK=3` và mặc định
- [ ] Mô phỏng job A xanh

## Không làm

- Không lưu mốc block để khỏi quét lại từ block triển khai (nợ PERF-01).
- Không đổi đường ghi, `reader()` cho lời đọc trạng thái.
