# FE-02 — Màn kết nối ví: requirements

Spec giao việc: `docs/fe-02-wallet-connect/requirements.md`.

Tài liệu này là bản Kiro làm việc — ghi **hiện trạng đã đo** và **kết quả thực tế**, để task
sau không phải đọc lại mã nguồn mới biết cái gì đã có, cái gì còn nợ.

Nhánh `feat/wallet-connect`, tạo từ `dev` @ `bf9b856`.

## 1. Mục tiêu

Nhà đầu tư kết nối ví tự quản để xem vị thế và sau này ký giao dịch mua WPT, nhận lợi nhuận,
tất toán. Đây là **cửa vào của mọi thao tác ký** ở kênh nhà đầu tư: FE-04, FE-05, FE-09,
FE-11 đều lấy câu trả lời "ví sẵn sàng ký chưa" từ task này.

## 2. Điều kiện tiên quyết đã kiểm

FE-01 phải merge vào `dev` trước khi mở nhánh này (spec giao việc, `tasks.md` dòng đầu).

```
git log --oneline origin/dev
  bf9b856 Merge pull request #14 from tuannino/feat/ledger-port-3flows   ← BE-01
  2e1daa9 Merge pull request #13 from tuannino/feat/investor-channel-v2  ← FE-01 v2
```

FE-01 v2 đã merge ở `2e1daa9`. Sức khỏe `dev` kiểm theo `branching.md` §5:

```
packages/            : 73 file   (phải > 0)  ✅
app/src/lib/ledger   : 6 file    (phải > 0)  ✅
AssetRegistry        : 0 file    (phải = 0)  ✅
```

`dev` lành, nền hợp lệ. Không phải dùng nền tạm.

## 3. Hiện trạng đã đo (không phải theo trí nhớ)

| Thành phần | Đường dẫn | Tình trạng đo được |
|---|---|---|
| Cấu hình ví | `lib/wagmi.ts` | Đã có. Chỉ đăng ký **2** chain EVM: `hardhatLocal` (31337) và `evmTestnet` (11155111), dựng từ `CHAINS`. Thiếu `NEXT_PUBLIC_WC_PROJECT_ID` thì dùng `createConfig` + connector `injected` |
| Nút kết nối | `components/layout/header.tsx` | Đã có `ConnectButton`, nhưng nhãn là `"Kết nối ví Admin"` — ngược với R7.2 |
| Chống lệch kết xuất | `lib/hooks/use-is-mounted.ts` | Đã có, dùng `useSyncExternalStore` |
| Chọn chain | `components/layout/chain-selector.tsx` | Đã có, `<select id="chain-selector">` |
| Chain đang chọn | `lib/chains/use-selected-chain.ts` | Đã có. **Lặng lẽ lùi về mặc định** khi lựa chọn không `selectable` |
| Explorer | `packages/shared/src/chains.ts` | Chỉ có `explorerTxUrl`, **chưa có** hàm tra địa chỉ |
| `useSwitchChain` | toàn repo | `git grep` → **0 kết quả**. Chưa có chỗ nào xử lý sai mạng |
| `components/wallet/` | — | **Chưa tồn tại** |
| Môi trường test component | `vitest.config.ts` | `environment: 'node'`, không có jsdom / @testing-library → **không test được component React** |

Kết luận: hạ tầng ví đã có, task này là **màn hình + xử lý tình huống lỗi**, không phải dựng
lại kết nối. Đúng như spec giao việc mục 2 nhận định.

## 4. Sai lệch phát hiện trong spec giao việc

**Union `WalletStatus` có 7 nhánh nhưng task 1.5 đòi nhánh thứ 8.** `design.md` QĐ-1 liệt kê
7 `kind`; task 1.5 yêu cầu "xử lý chuỗi `stellar`: trả trạng thái chưa hỗ trợ ví" mà không
có `kind` nào ứng với việc đó. Đã thêm `unsupported-chain`. Xem `design.md` mục 2 (QĐ-K1).

**`stellar` hiện không thể là chain đang chọn.** `reasonUnavailable('stellar')` trả "Chưa hiện
thực (adapter stub)" nên `selectable: false`, và `useSelectedChain` không bao giờ trả về nó.
Nhánh `unsupported-chain` vì vậy là **phòng xa cho khi Stellar được hiện thực** — lúc đó ví
trình duyệt vẫn không nói được Soroban. Đã ghi rõ trong e2e thay vì để người đọc tưởng đã
dựng được trạng thái này trên giao diện.

## 5. Kết quả đối chiếu điều kiện hoàn thành

| DoD (spec giao việc mục 5) | Kết quả |
|---|---|
| Kết nối/ngắt kết nối ở `hardhat-local` | ⚠️ Cần ví thật — kiểm tay, bảng ở `docs/CHECKPOINT_FE02.md` |
| Không có ví thì hiện hướng dẫn, không lỗi kỹ thuật | ✅ e2e `wallet-connect.spec.ts` |
| Sai mạng thì cảnh báo + nút chuyển hoạt động | ⚠️ Cần ví thật — kiểm tay |
| Từ chối chuyển mạng thì vẫn ở trạng thái cảnh báo | ✅ logic có unit test; ⚠️ hộp thoại thật kiểm tay |
| Đổi tài khoản trong ví thì địa chỉ cập nhật ngay | ⚠️ Cần ví thật — kiểm tay |
| Chế độ `mock` không đòi ví, không cảnh báo sai mạng | ✅ e2e |
| Không có lỗi lệch kết xuất trong bảng điều khiển | ✅ e2e (bắt `console` + `pageerror`) |
| `grep viem/ethers ngoài src/lib` rỗng | ✅ rỗng |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ Đạt 6/6, Không đạt 0 |

Bốn mục ⚠️ cần ví thật ký nên **không dựng được trong Chromium của Playwright** (không có
tiện ích ví). Logic quyết định của cả tám trạng thái đã phủ bằng unit test
(`app/test/wallet-status.test.ts`, 30 ca).
