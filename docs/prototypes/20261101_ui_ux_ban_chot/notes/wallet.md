# wallet.html: Ví của tôi (Kết nối ví)

- Màn thật: `/wallet` (dùng chung Nhà đầu tư và Người bán)
- Tệp đã đọc: `app/src/app/(wallet)/layout.tsx`, `app/src/app/(wallet)/wallet/page.tsx`, `app/src/components/pages/wallet-connect.tsx` (`WalletSkeleton`, `MockNotice`, `UnsupportedChainNotice`, `DisconnectedCard`, `UseWalletChainButton`, `WalletScopeNote`), `app/src/components/wallet/wallet-status-card.tsx`, `no-wallet-guide.tsx`, `wrong-chain-banner.tsx`, `app/src/lib/wallet/wallet-status.ts` (`chainIdLabel`), `app/src/lib/wallet/format.ts` (`shortenAddress`), `app/src/lib/hooks/use-native-balance.ts`, `packages/shared/src/chains.ts`.
- Breadcrumbs: Nhà đầu tư | Ví của tôi (giữ nguyên cả khi vai Người bán, đúng màn thật). Vai: investor, seller. Menu sáng: wallet.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Ví của tôi", câu mô tả | header `WalletConnectPage` | |
| Thanh "Trạng thái xem thử" (10 tab, gồm Đang đọc số dư, Lỗi số dư; mở thẳng bằng `?st=<mã>`) | `switch (status.kind)` trong `renderStatus()` | Không phải khối của màn thật; mỗi tab một nhánh |
| Tab Đã kết nối: thẻ xanh "Ví đã kết nối" + nhãn mạng | `WalletStatusCard`, `info.label` | Nhãn mẫu "EVM Testnet (Sepolia)" |
| Địa chỉ ví rút gọn, đủ ở `title` | `shortenAddress(address)` | Nhà đầu tư `0x7099…79C8`, Người bán NB001 `0x15d3…6A65` (`packages/shared/src/sample-wallets.json`) (đổi theo `UI.role`) |
| Nút Sao chép (Đã sao chép / Chưa sao chép được) | `CopyAddressButton` | Chạy thật bằng clipboard |
| Nút "Xem trên Etherscan" | `explorerAddressUrl`, `info.explorerName` | Ẩn ở hardhat-local (không có explorer) |
| Ô vàng "Số dư ETH" 0,0421 ETH + câu "Đây là đồng của … không phải VNDB và không phải tiền thật." | `useNativeBalance`, `info.nativeCurrency.symbol`, câu task 2.5 | Tab "Đang đọc số dư": "đang đọc…" có biểu tượng quay; tab "Lỗi số dư": "chưa có" và câu đỏ "Chưa đọc được số dư, có thể node của mạng này chưa chạy." (wallet-status-card.tsx:81-95, `use-native-balance.ts:39`; gạch dài của dev đổi thành dấu phẩy) |
| "Số WPT đang giữ xem ở trang Tổng quan." + nút "Ngắt kết nối" | phần cuối `WalletStatusCard`, `onDisconnect` | |
| Tab Chế độ mô phỏng | `MockNotice`: tiêu đề, mô tả có `CHAINS.mock.label`, 2 đoạn | Gạch dài đổi thành dấu phẩy |
| Tab Chưa kết nối | `DisconnectedCard`: tiêu đề, mô tả, 3 ý, nút "Kết nối ví" | 3 ý đổi chấm giữa thành biểu tượng |
| Tab Chưa có ví | `NoWalletGuide`: 3 bước, liên kết MetaMask, Rabby kèm ghi chú, câu cuối | Liên kết mở tab mới |
| Tab Sai mạng | `WrongChainBanner` với `chainIdLabel(current)` ("mạng lạ (chain ID 1)") | Nút "Chuyển ví sang EVM Testnet (Sepolia)" |
| Tab Lệch mạng | `WrongChainBanner` + `UseWalletChainButton` ("Hoặc xem trang theo Hardhat Local") | |
| Tab Mạng chưa hỗ trợ | `UnsupportedChainNotice` (Stellar (Soroban)) | |
| Tab Đang kiểm tra | `WalletSkeleton` + "Đang kiểm tra trạng thái ví…" | Câu "Đang kiểm tra trạng thái ví…" chỉ cho trình đọc màn hình (`.sr-only`), như dev (wallet-status-card.tsx:124) |
| Khung cuối "Ví ở trang này chỉ dùng cho thao tác của nhà đầu tư…" | `WalletScopeNote` | Luôn hiện; gạch dài đổi thành dấu phẩy |
| Nút "Sao chép" có `aria-label="Sao chép địa chỉ ví <địa chỉ>"` | `CopyAddressButton` (wallet-status-card.tsx:151) | Script gắn địa chỉ theo vai |

Kiểu cục bộ: `[hidden]`, `.sk` (khung chờ), `.bul`, `.nsteps` (bước đánh số), `.wl` (thẻ liên kết ví), `.addr`, nút viền trong thẻ hero dùng nền trắng mờ `rgba(255,255,255,.12)`.

## Thay đổi chỉ là trình bày
- Trạng thái sẵn sàng thành bento 7/5: thẻ hero xanh địa chỉ ví và ô vàng số dư ETH.
- Dải cảnh báo sai mạng dùng `alert bad` với nút `danger`.
- Các nhánh trạng thái gom vào thanh tab để xem.

## Thay đổi so với bản chốt (dev mới)
- Sửa theo rà soát độc lập: thêm tab Đang đọc số dư, Lỗi số dư cho ô Số dư ETH; câu "Đang kiểm tra trạng thái ví…" thành `.sr-only`; `aria-label` nút Sao chép kèm địa chỉ ví; sửa ghi chú về dấu phẩy thập phân.

## Có đụng backend: Không
Không.

## Lệch đã thấy
- Breadcrumb ghi "Nhà đầu tư | Ví của tôi" cả khi vai Người bán; mục menu tên "Kết nối ví" còn tiêu đề trang là "Ví của tôi".
- Câu `WalletScopeNote` nói "chỉ dùng cho thao tác của nhà đầu tư" và `MockNotice` nói "Mua WPT, nhận lợi nhuận…" dù Người bán cũng vào trang này.
- `formatNativeAmount` in dấu phẩy thập phân theo tiếng Việt, nên "0,0421" khớp dev.
- Mặc định Chain là mock nên màn thật sẽ hiện "Đang ở chế độ mô phỏng"; bản xem thử mở sẵn tab "Đã kết nối" để thấy trạng thái có dữ liệu.
