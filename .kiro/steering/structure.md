---
inclusion: always
foundationalType: structure
---
# Cấu trúc thư mục (giữ SẠCH để không rối)

```
app/                      # Next.js 16 full-stack (retheme ĐIỆN GIÓ)
  src/app/                # routes + api/ (server actions ngân hàng)
  src/lib/ledger/         # ILedgerPort + evm.adapter + mock.adapter + stellar.adapter(stub) + factory
  src/lib/signer/         # wallet | server | fireblocks.stub
  src/lib/chains/         # registry: hardhat-local(default) | evm | stellar  (KHÔNG polygon)
  src/lib/providers/      # kyc | oracle | corebank — mỗi cái mock|real
  src/lib/rbac/           # roles→permissions + can()
  src/lib/config/         # env + feature flags
packages/contracts-evm/   # ProjectToken, VNDToken, ProfitDistributor, EnergyOracle, Redemption
  trex/                   # ERC-3643 thật — production sau (ĐỪNG trộn toolchain)
packages/contracts-stellar/  # Soroban (Rust) — phần mở rộng tương lai, TẠM DỪNG (xem ghi chú dưới)
packages/shared/          # ABI (generated), addresses.json, chain config, types — MỘT nguồn sự thật
docs/                     # SPEC, ARCHITECTURE, WORKING_PROTOCOL, templates
.kiro/                    # steering + specs
```

## Stellar: phần mở rộng tương lai, đang TẠM DỪNG (OP-01)
`packages/contracts-stellar/` và `app/src/lib/ledger/stellar.adapter.ts` **giữ nguyên trong
repo** — kiến trúc đa chuỗi là thứ ba luật bảo vệ, gỡ mã đi là tự bỏ khả năng đó. Nhưng phần
Soroban **không** thuộc khâu kiểm chứng nữa: `scripts/run-local-all.sh` không gọi `cargo`, và
**không ai phải cài Rust để làm việc trên dự án này**.

Hệ quả cần biết:
- Giá trị `stellar` trong `packages/shared/src/chains.ts`, trong kiểu dữ liệu và trong sổ đăng
  ký chuỗi **ở nguyên**. Đừng "dọn" nó.
- Thêm method vào `ILedgerPort` thì `stellar.adapter.ts` vẫn phải hiện thực — ném
  `LedgerNotImplementedError` kèm gợi ý nêu đúng thứ đang thiếu, đó là cách đúng.
- Không mở task Stellar mới cho tới khi Owner bỏ trạng thái tạm dừng.

## Quy ước
- ABI & địa chỉ contract CHỈ nằm ở `packages/shared` (đừng copy rải rác).
- Đặt tên rõ nghĩa; file interface đặt hậu tố `.port.ts`, adapter `.adapter.ts`.
- Mỗi thư mục một trách nhiệm; không nhét logic chain vào component.
- Đổi tên `contracts/evm_contracts` → `packages/contracts-evm`, `contracts/stellar-contracts` → `packages/contracts-stellar` (task P0). Xóa docs/README gốc lỗi thời (Polygon/AssetRegistry).

## Tách kênh theo vai trò (chung 1 backend)
Dùng route-group của Next.js, cùng gọi về server actions/API chung:
```
app/src/app/(client)/   # Nhà đầu tư
app/src/app/(admin)/    # Cán bộ ngân hàng (đặc quyền: mint/freeze/clawback)
app/src/app/(audit)/    # Kiểm toán/Regulator — CHỈ ĐỌC (audit log + read-model)
```
- Guard theo RBAC ở layout mỗi group; `(audit)` không được chạm hàm đặc quyền.
- Chừa sẵn ranh giới để sau tách `(client)`/`(audit)` thành app deploy riêng (subdomain) mà backend/`ILedgerPort` giữ nguyên.

## Deploy (2 chế độ, 1 codebase)
- Free-tier: giữ web bundle nhỏ (xem tech.md), demo default `mock`/`evm-testnet`.
- VPS: `docker compose up` đầy đủ (gồm hardhat node).
- Đừng viết luồng demo public phụ thuộc CỨNG vào hardhat node thường trú.
