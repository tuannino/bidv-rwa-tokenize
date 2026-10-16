# @bidv/shared

**MỘT nguồn sự thật** cho phần dùng chung giữa contracts và web. Không copy ABI/địa chỉ ra chỗ khác.

| Thư mục | Nội dung |
|---|---|
| `src/abi/` | ABI **tối giản** cho token, nghiệp vụ và registry/compliance ERC-3643 — giữ bundle edge nhỏ |
| `src/addresses.json` | Địa chỉ contract theo chain, **sinh tự động** bởi `packages/contracts-evm/scripts/deploy.js` |
| `src/addresses.ts` | Accessor có kiểu + cho phép override bằng biến môi trường |
| `src/chains.ts` | Dữ liệu chain: `mock` (default) · `hardhat-local` · `evm` · `stellar`. **KHÔNG Polygon** |
| `src/types.ts` | Types dùng chung (`ChainKey`, `TxResult`, ...) |

## Vì sao ABI tối giản, không dùng artifact Hardhat

Artifact Hardhat chứa bytecode + AST (hàng trăm KB/contract). Bundle vào worker edge là phình vô ích.
ABI ở đây viết tay theo đúng chữ ký contract, `as const` để viem suy kiểu.

Deploy script sinh ABI đầy đủ vào `generated/`; `app/test/abi-contract-sync.test.ts` kiểm tra chéo
mọi chữ ký tối giản với artifact thật để lệch ABI làm đỏ CI.

## Địa chỉ: vì sao commit được

Hardhat node khởi động lại luôn cho địa chỉ **tất định** (cùng deployer, cùng thứ tự deploy → cùng nonce).
Nên `addresses.json` cho `hardhat-local` commit được và dùng ở cả free-tier (không có filesystem).
Chain thật (`evm` testnet) có thể override bằng env. Sau SC-09 phải cung cấp đồng bộ đủ bộ địa chỉ,
gồm `NEXT_PUBLIC_ADDR_EVM_IDENTITY_REGISTRY`, `NEXT_PUBLIC_ADDR_EVM_MODULAR_COMPLIANCE` và
`NEXT_PUBLIC_ADDR_EVM_ALLOW_ALL_MODULE`; thiếu registry/compliance thì adapter dừng, không gọi API cũ.
