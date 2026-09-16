# FE-02 — Màn kết nối ví: design

## 1. Quyết định thiết kế

### QĐ-1: Tái dùng `wagmi.ts` và `ConnectButton`, không dựng lại

`lib/wagmi.ts` đã xử lý đúng phần khó nhất: khi thiếu `NEXT_PUBLIC_WC_PROJECT_ID` thì dựng cấu hình wagmi trực tiếp với connector `injected`, thay vì để RainbowKit ném lỗi ngay lúc nạp module và làm trắng toàn bộ ứng dụng. **Không sửa file này.**

`ConnectButton` của RainbowKit đã có ở thanh trên. Trang kết nối ví **bổ sung** chứ không thay thế: thanh trên để kết nối nhanh ở mọi trang, trang riêng để xem chi tiết và xử lý tình huống lỗi.

### QĐ-2: Tách logic vào một hook duy nhất

Toàn bộ trạng thái kết nối gom vào `lib/hooks/use-wallet-status.ts`. Lý do: FE-04, FE-05, FE-09, FE-11 đều cần biết "ví có sẵn sàng để ký chưa". Nếu mỗi màn tự ghép `useAccount`, `useChainId`, `useSwitchChain` thì logic sẽ phân tán và lệch nhau.

```ts
type WalletStatus =
  | { kind: 'loading' }                                   // chưa gắn vào cây giao diện
  | { kind: 'mock' }                                       // chuỗi mock, không cần ví
  | { kind: 'no-provider' }                                // trình duyệt không có ví
  | { kind: 'disconnected' }
  | { kind: 'wrong-chain'; current: number; expected: number; expectedLabel: string }
  | { kind: 'chain-mismatch'; walletChain: string; appChain: string }
  | { kind: 'ready'; address: `0x${string}`; chainKey: ChainKey };

export function useWalletStatus(): {
  status: WalletStatus;
  canSign: boolean;          // chỉ đúng khi kind === 'ready' hoặc 'mock'
  switchToExpected: () => Promise<void>;
  disconnect: () => void;
};
```

`canSign` là thứ các màn sau dùng để bật hoặc tắt nút ký. Một chỗ quyết định, không rải rác.

### QĐ-3: Thứ tự ưu tiên khi xác định trạng thái

Thứ tự này quan trọng, làm sai sẽ hiện cảnh báo vô nghĩa:

```
1. chưa gắn vào cây giao diện        → loading
2. chuỗi đang chọn là mock           → mock          (dừng, không kiểm gì nữa)
3. không có ví được tiêm             → no-provider
4. chưa kết nối                      → disconnected
5. chuỗi ví không nằm trong danh sách được phép → wrong-chain
6. chuỗi ví khác chuỗi đang chọn ở ứng dụng     → chain-mismatch
7. còn lại                           → ready
```

Đặt `mock` lên trước tất cả là có chủ ý: chế độ mô phỏng không cần ví, nên không được hiện bất kỳ cảnh báo ví nào. Đây cũng là chế độ dùng cho bản triển khai miễn phí.

### QĐ-4: Thông số chuỗi lấy từ `packages/shared`

Khi yêu cầu ví thêm chuỗi, phải lấy tên, mã chuỗi, đơn vị tiền, địa chỉ nút mạng từ `CHAINS` trong `packages/shared`. **Không ghi cứng trong thành phần giao diện.** Đây là nguyên tắc một nguồn sự thật đã áp dụng cho `wagmi.ts`.

### QĐ-5: Không tự động chuyển chuỗi

Chỉ chuyển khi người dùng bấm. Tự động chuyển gây hai vấn đề: ví bật hộp thoại mà người dùng không hiểu vì sao, và nếu họ từ chối thì rơi vào vòng lặp yêu cầu.

## 2. Cấu trúc tệp

```
app/src/app/(client)/
  wallet/page.tsx                      (mới)  — trang kết nối ví

app/src/components/pages/
  wallet-connect.tsx                   (mới)  — thành phần chính, "use client"

app/src/components/wallet/             (mới)
  wallet-status-card.tsx                       — thẻ hiện trạng thái hiện tại
  wrong-chain-banner.tsx                       — dải cảnh báo sai chuỗi, tái dùng ở màn khác
  no-wallet-guide.tsx                          — hướng dẫn khi chưa cài ví

app/src/lib/hooks/
  use-wallet-status.ts                 (mới)  — hook gom trạng thái

app/src/components/layout/
  nav-config.ts                        (sửa)  — thêm mục "Ví của tôi" vào INVESTOR_NAV
```

## 3. Nội dung từng trạng thái

| Trạng thái | Hiển thị | Hành động |
|---|---|---|
| `loading` | Khung chờ | không |
| `mock` | Thông báo: đang ở chế độ mô phỏng, không cần ví thật | Liên kết sang bộ chọn chuỗi |
| `no-provider` | Hướng dẫn cài ví, nêu ví được hỗ trợ | Liên kết trang tải ví |
| `disconnected` | Giải thích vì sao cần kết nối | Nút kết nối |
| `wrong-chain` | Đang ở chuỗi nào, cần chuyển sang chuỗi nào | Nút chuyển chuỗi |
| `chain-mismatch` | Ví ở chuỗi A, ứng dụng đang xem chuỗi B | Nút chuyển ví, hoặc đổi chuỗi ứng dụng |
| `ready` | Địa chỉ rút gọn, tên chuỗi, số dư native | Sao chép, tra cứu, ngắt kết nối |

Chữ hiển thị viết cho cán bộ ngân hàng đọc, không dùng thuật ngữ kỹ thuật. Ví dụ dùng "Ví đang ở mạng khác" thay vì "Chain ID không khớp".

## 4. Cạm bẫy đã biết

**Lệch kết xuất giữa máy chủ và trình duyệt.** Trạng thái ví chỉ tồn tại ở trình duyệt, nên lần kết xuất đầu phải không phụ thuộc nó. Dùng `useIsMounted` có sẵn ở `lib/hooks/use-is-mounted.ts`. File đó dùng `useSyncExternalStore` thay vì `useEffect` cộng `useState` vì React Compiler chặn mẫu kia. **Đừng tự viết lại.**

**`chain-store` cố tình không lưu và mặc định rỗng** để lần kết xuất đầu khớp máy chủ. Khi đọc chuỗi đang chọn, phải xử lý được trường hợp giá trị rỗng.

**Số dư native trên `hardhat-local`** là đơn vị của mạng thử, không phải tiền thật. Ghi nhãn rõ để không ai nhầm là VNDB.

**Trình khám phá chuỗi có thể không tồn tại.** `hardhat-local` không có. Hàm tra cứu trong `packages/shared` trả về rỗng cho trường hợp này, nên phải ẩn liên kết thay vì hiện liên kết chết.

**Chuỗi `stellar` không phải họ EVM.** Ví trình duyệt hiện tại chỉ hỗ trợ EVM. Khi chuỗi đang chọn là `stellar`, hiển thị thông báo chưa hỗ trợ ví cho chuỗi này thay vì cố kết nối.

## 5. Ràng buộc kiến trúc

- Thành phần giao diện **không nhập `viem` hoặc `ethers`**. Các hook của wagmi được phép vì chúng phục vụ riêng việc kết nối ví, không phải gọi hợp đồng.
- Mọi lời gọi hợp đồng vẫn đi qua `ILedgerPort`. Task này **không** gọi hợp đồng nào.
- Không lưu địa chỉ ví vào lưu trữ trình duyệt làm nguồn sự thật. Địa chỉ luôn đọc từ ví.
- Không đụng `lib/wagmi.ts`, `lib/hooks/use-is-mounted.ts`, `lib/chains/chain-store.ts`.

## 6. Quan hệ với AU-01

Task này **chỉ kết nối ví, chưa xác thực**. Kết nối ví không chứng minh được người dùng sở hữu ví, vì chưa có chữ ký. AU-01 sẽ bổ sung đăng nhập bằng chữ ký.

Nghĩa là sau FE-02, vai trò vẫn lấy từ phiên demo, không lấy từ ví. **Không được dùng địa chỉ ví để cấp quyền trong task này.**
