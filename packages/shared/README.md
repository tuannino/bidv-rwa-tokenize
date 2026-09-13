# @bidv/shared

**MỘT nguồn sự thật** cho phần dùng chung giữa contracts và web. Không copy ABI/địa chỉ ra chỗ khác.

| Thư mục | Nội dung |
|---|---|
| `src/abi/` | ABI **tối giản** (chỉ hàm/event mà `ILedgerPort` cần) — giữ bundle edge nhỏ |
| `src/addresses.json` | Địa chỉ contract theo chain, **sinh tự động** bởi `packages/contracts-evm/scripts/deploy.js` |
| `src/addresses.ts` | Accessor có kiểu + cho phép override bằng biến môi trường |
| `src/chains.ts` | Dữ liệu chain: `hardhat-local` (default) · `evm` · `stellar` · `mock`. **KHÔNG Polygon** |
| `src/types.ts` | Types dùng chung (`ChainKey`, `TxResult`, ...) |

## Vì sao ABI tối giản, không dùng artifact Hardhat

Artifact Hardhat chứa bytecode + AST (hàng trăm KB/contract). Bundle vào worker edge là phình vô ích.
ABI ở đây viết tay theo đúng chữ ký contract, `as const` để viem suy kiểu.

Deploy script **kiểm tra chéo** ABI này với artifact thật; lệch chữ ký thì deploy fail sớm.

## Địa chỉ: vì sao commit được

Hardhat node khởi động lại luôn cho địa chỉ **tất định** (cùng deployer, cùng thứ tự deploy → cùng nonce).
Nên `addresses.json` cho `hardhat-local` commit được và dùng ở cả free-tier (không có filesystem).
Chain thật (`evm` testnet) thì override bằng env: `NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN`, ...
