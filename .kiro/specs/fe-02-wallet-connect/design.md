# FE-02 — Màn kết nối ví: design

Spec giao việc: `docs/fe-02-wallet-connect/design.md`. Tài liệu này ghi **quyết định đã thực
hiện** và những chỗ phải tự quyết vì spec giao việc không nói tới.

## 1. Quyết định từ spec giao việc — đã làm đúng

| Mã | Quyết định | Kết quả |
|---|---|---|
| QĐ-1 | Tái dùng `wagmi.ts` và `ConnectButton`, không dựng lại | `lib/wagmi.ts` **không sửa một dòng**. Trang `/wallet` bổ sung cho thanh trên, không thay thế |
| QĐ-2 | Gom logic vào một hook duy nhất | `useWalletStatus()` ở `lib/hooks/use-wallet-status.ts`. `canSign` là một chỗ quyết định cho FE-04/05/09/11 |
| QĐ-3 | Thứ tự ưu tiên cố định | Hiện thực trong `resolveWalletStatus()`; `mock` đứng trước mọi phép kiểm ví |
| QĐ-4 | Thông số chain lấy từ `packages/shared` | `addEthereumChainParameter` dựng từ `CHAINS` + config wagmi. Không ghi cứng chainId/RPC ở component |
| QĐ-5 | Không tự động chuyển chain | `switchToExpected` chỉ chạy từ `onClick`. Không có effect nào gọi nó |

Cấu trúc tệp theo `design.md` mục 2, thêm bốn tệp — xem QĐ-K2.

## 2. Quyết định Kiro phải tự đưa ra (spec giao việc không nói)

### QĐ-K1: Thêm nhánh thứ tám `unsupported-chain`

Union trong spec giao việc có 7 `kind`, nhưng task 1.5 đòi "trả trạng thái chưa hỗ trợ ví"
cho `stellar` và không `kind` nào ứng. Đã loại ba cách ghép vào nhánh có sẵn, cả ba đều nói
sai với người dùng:

- **`no-provider`** → mời người đang xem Stellar đi cài MetaMask. Cài xong vẫn không dùng được
  vì MetaMask không nói được Soroban.
- **`wrong-chain`** → nhánh này mang `expected: number`, mà Stellar không có chainId EVM.
- **`mock`** → nói "đây là chế độ mô phỏng", trong khi Stellar là chain thật chưa hiện thực.

Đặt ở **ưu tiên 3** (sau `mock`, trước `no-provider`) vì cùng tính chất với `mock`: không cần
ví, nên mọi cảnh báo ví ở đó đều là nhiễu.

### QĐ-K2: Tách logic thuần khỏi hook

`vitest.config.ts` dùng `environment: 'node'` và repo không có jsdom lẫn
`@testing-library/react`. Không tách thì "unit test cho hàm quyết định trạng thái, phủ đủ 7
nhánh" (task 1.1, 6.1) không có cách nào chạy.

Đã loại phương án **thêm jsdom + @testing-library**: tasks.md ghi rõ "Không thêm phụ thuộc
mới", và test hook cần dựng cả `WagmiProvider` + `QueryClientProvider` + `ConfigProvider` —
nhiều hạ tầng cho một hàm thuần.

```
lib/wallet/wallet-status.ts     ← thuần: resolveWalletStatus, canSignWith,
                                  blockedSigningReason, chainIdToSwitchTo
lib/wallet/injected-provider.ts ← external store dò ví
lib/wallet/switch-error.ts      ← thuần: bóc lỗi của ví
lib/wallet/format.ts            ← thuần: rút gọn địa chỉ, định dạng số dư
lib/hooks/use-wallet-status.ts  ← hook: thu thập đầu vào thật rồi gọi hàm thuần
lib/hooks/use-native-balance.ts ← hook: số dư đồng bản địa
```

### QĐ-K3: `useAccount().chainId`, không dùng `useChainId()`

Spec giao việc mục QĐ-2 nhắc `useChainId`. Đã đo và **không dùng**: `useChainId()` trả chain
"đang hoạt động" của config và lùi về chain đầu tiên trong danh sách khi chưa kết nối. Lấy giá
trị đó làm "chain của ví" thì phép so sánh cho kết quả KHỚP trong lúc chưa có ví nào —
sai âm thầm. `useAccount().chainId` là `undefined` khi chưa kết nối, tức là nói thật.

### QĐ-K4: Dò ví bằng external store, không đọc `window.ethereum` một lần

Hai lý do:

1. Ví theo **EIP-6963 công bố không đồng bộ**. Đọc một lần lúc mount có thể chưa thấy gì và
   kết luận sai là "chưa cài ví" với người đã cài.
2. Đọc `window.ethereum` trong thân hàm kết xuất là đọc nguồn dữ liệu ngoài React.
   `useSyncExternalStore` là cách chính thức, và tránh luôn `useEffect` + `setState` mà React
   Compiler chặn (`react-hooks/set-state-in-effect`).

Thêm chốt an toàn: **đã `isConnected` thì không kết luận `no-provider`** dù phép dò không
thấy — ví chỉ công bố EIP-6963 và không đặt `window.ethereum` là trường hợp thật.

### QĐ-K5: State lỗi mang theo khoá tình huống

`switchError` không phải `string | null` trơn. Nó là `{ key, message }` với
`key = chain đang xem | địa chỉ | chainId ví`, và chỉ hiển thị khi `key` khớp tình huống hiện
tại.

Không có khoá thì thông báo sống dai hơn tình huống sinh ra nó: người dùng từ chối chuyển
mạng, thấy câu "Bạn đã từ chối…", rồi tự đổi mạng trong ví — tình huống đã khác mà cảnh báo
vẫn còn và giờ nó sai. Đây cũng là khuôn đã dùng ở `components/investor/asset-summary.tsx`.

### QĐ-K6: Bóc lỗi của ví theo tầng `cause`

wagmi bọc lỗi gốc của ví vào lớp ngoài của nó, nên `name`/`code` nằm ở tầng trong còn
`message` tầng ngoài là văn bản kỹ thuật tiếng Anh. Đọc sai tầng thì mọi trường hợp đều ra một
câu vô nghĩa — cùng loại lỗi đã ghi trong `lessons.md` về bóc revert của viem.

Đã xác thực trong `node_modules`: viem đặt `name = 'UserRejectedRequestError'` và
`static code = 4001`; connector `injected` của wagmi tự xử mã 4902 bằng
`wallet_addEthereumChain` rồi bọc thất bại thành `UserRejectedRequestError`.

### QĐ-K7: Thêm `explorerAddressUrl` vào `packages/shared`

R1.4 cần liên kết tra **địa chỉ ví**, repo chỉ có `explorerTxUrl`. Spec giao việc mục 4 nói
"Hàm tra cứu trong `packages/shared` trả về rỗng cho trường hợp này", tức là hàm này được
mong đợi tồn tại ở đó. Trả `null` khi chain không có explorer, cùng lý lẽ với `explorerTxUrl`.

### QĐ-K8: Số dư đồng bản địa không đi qua `ILedgerPort`

`eth_getBalance` **không phải lời gọi hợp đồng**, nên không thuộc phạm vi LUẬT #1. Đã loại
phương án thêm method vào `ILedgerPort`: BE-01 vừa chốt nguyên tắc không nới interface khi
chưa cần, và số dư native không phục vụ nghiệp vụ nào — nó chỉ để người dùng biết còn tiền
trả phí hay không.

Vẫn đặt trong `lib/hooks/`, không gọi `useBalance` thẳng trong component: phần định dạng và
xử lý lỗi chỉ có một bản, và component chỉ nhận chuỗi đã sẵn sàng hiển thị.

Số dư **WPT và VNDB** vẫn phải đi qua `ILedgerPort` và thuộc FE-04 — không đọc ở task này.

### QĐ-K9: Tự viết `formatNativeAmount`

Component không được nhập viem (LUẬT #1, `verify-arch-rules.sh` kiểm), và
`useBalance().data.formatted` của wagmi đã `@deprecated`. Hàm chỉ chia chuỗi số, không cần
thư viện. **Cắt** phần thập phân chứ không làm tròn lên: làm tròn số dư lên là nói người dùng
có nhiều tiền hơn thực tế.

### QĐ-K10: Sửa nhãn `ConnectButton` ở `header.tsx`

Nhãn cũ `"Kết nối ví Admin"` mời cán bộ ngân hàng kết nối ví để làm việc của ngân hàng, đúng
ngược với R7.2 (thao tác đặc quyền ký bằng khóa phía máy chủ qua `ISigner`). Thanh trên dùng
chung cho cả ba kênh nên nhãn phải trung tính. Spec giao việc **không yêu cầu** sửa chỗ này —
đã ghi vào checkpoint mục DEVIATION.

## 3. Cạm bẫy đã biết — cách đã xử lý

| Cạm bẫy (spec giao việc mục 4) | Cách xử lý |
|---|---|
| Lệch kết xuất máy chủ ↔ trình duyệt | Dùng `useIsMounted` có sẵn, **không viết lại**. Nhánh `loading` là nhánh đầu tiên của `resolveWalletStatus` |
| `chain-store` mặc định rỗng | Đọc qua `useSelectedChain()`, nó đã giải quyết `null` → mặc định server |
| Số dư native không phải VNDB | Ghi nhãn tường minh trong `wallet-status-card.tsx` |
| Chain có thể không có explorer | `explorerAddressUrl` trả `null` → ẩn liên kết. e2e không kiểm được vì chain mặc định là `mock`; đã kiểm bằng đọc mã và unit test của `CHAINS` |
| `stellar` không phải họ EVM | Nhánh `unsupported-chain`, xem QĐ-K1 |

Cạm bẫy phát hiện thêm trong lúc làm:

**`getByRole('alert')` toàn trang trong Playwright bắt vùng thông báo rỗng của Next.js Dev
Tools.** Phép kiểm "chế độ mock không có cảnh báo nào" đỏ vì lý do chẳng liên quan tới ví.
Bó phạm vi vào `main` và kiểm thêm bằng nội dung chữ. Đã ghi vào `lessons.md`.

## 4. Ràng buộc kiến trúc — kết quả kiểm

| Ràng buộc | Kết quả |
|---|---|
| Component không nhập `viem`/`ethers` | `grep -rnE "from '(viem\|ethers)'" app/src/ \| grep -v "src/lib/"` → **rỗng** |
| Không gọi hợp đồng nào | `verify-arch-rules.sh`: "Không có lời gọi contract trực tiếp trong components/ và app/" PASS |
| Không lưu địa chỉ ví vào storage | `git grep "localStorage\|sessionStorage\|document.cookie" app/src` → **rỗng** |
| Không đụng `wagmi.ts`, `use-is-mounted.ts`, `chain-store.ts` | `git diff dev...HEAD --name-only` không có ba file này |
| Không thêm phụ thuộc mới | `app/package.json` không đổi |
| Không dùng địa chỉ ví để cấp quyền | Trang không gọi `can()`; quyền vào kênh vẫn là `portfolio:read` ở `ChannelGuard` |
