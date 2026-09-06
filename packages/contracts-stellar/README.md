# RWA Năng lượng tái tạo trên Stellar — Bộ hợp đồng Soroban

Workspace gồm 3 hợp đồng cho bài toán token hóa dự án điện mặt trời có chia lợi nhuận định kỳ (góc ngân hàng):

| Hợp đồng | Vai trò | Quy trình bao gồm |
|---|---|---|
| `spt_token` | Token quyền hưởng SPT (SEP-41 + quản trị + snapshot) | mint, burn, transfer, clawback, freeze/whitelist, snapshot, balance_at |
| `profit_distributor` | Chia lợi nhuận định kỳ (push) | preview_share (tính), distribute (chia) |
| `redemption` | Mua lại / hoàn vốn | redeem, set_rate, pause |
| `revenue_oracle` | Đưa doanh thu kỳ lên chuỗi | report, finalize, get, set_reporter |
| `profit_distributor_pull` | Chia lợi nhuận (pull + snapshot) cho nhiều nhà đầu tư | open_period (chốt snapshot), claim, preview_claim |

Kèm `cach_a_classic_sac.sh`: phiên bản Cách A (classic asset + SAC) để đối chiếu chi phí.

## Chạy nhanh

```bash
# Yêu cầu: Rust 1.84+, target wasm32v1-none, stellar-cli
rustup target add wasm32v1-none

# Chạy test
cargo test

# Build WASM (dùng stellar-cli, KHÔNG dùng cargo build)
stellar contract build
```

WASM đầu ra nằm ở `target/wasm32v1-none/release/*.wasm`.

Hướng dẫn cài đặt và triển khai chi tiết: xem file `20260810_huong_dan_smart_contract_stellar_rwa.md`.
