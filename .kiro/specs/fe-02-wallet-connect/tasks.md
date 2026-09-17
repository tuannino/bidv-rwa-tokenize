# FE-02 — Màn kết nối ví: tasks

Nhánh `feat/wallet-connect`, tạo từ `dev` @ `bf9b856` (FE-01 v2 đã merge ở `2e1daa9`).

Spec giao việc: `docs/fe-02-wallet-connect/tasks.md`. Checkpoint: `docs/CHECKPOINT_FE02.md`.

---

## Bước 1: Hook gom trạng thái ví

- [x] 1.1 `lib/hooks/use-wallet-status.ts` theo giao diện ở `design.md` mục 1, thêm
      `blockedReason`, `switching`, `switchError` vì R3.4/R3.5 cần chỗ nói lý do.
- [x] 1.2 Thứ tự ưu tiên theo QĐ-3, `mock` đứng trước mọi phép kiểm ví.
- [x] 1.3 Dùng `useIsMounted` có sẵn. Không viết lại.
- [x] 1.4 Chain đang chọn còn rỗng: đọc qua `useSelectedChain()`, nó đã giải quyết `null` →
      mặc định của server.
- [x] 1.5 `stellar` → nhánh `unsupported-chain` (nhánh thứ **tám**, xem `design.md` QĐ-K1).
- [x] 1.6 `canSign` chỉ đúng ở `ready` và `mock` — có test riêng cho cả hai chiều.

**Kiểm chứng:** `app/test/wallet-status.test.ts` — **30 ca**, phủ đủ tám nhánh. Có một ca
chốt bằng `Set` để thêm nhánh mới mà quên phủ là đỏ ngay.

*Commit:* `0e7fcf1 feat(wallet): hook gom trạng thái kết nối ví`

---

## Bước 2: Các thành phần hiển thị

- [x] 2.1 `components/wallet/no-wallet-guide.tsx` — ba bước, nói rõ **phải tải lại trang**
      sau khi cài (chỗ hay kẹt nhất). e2e kiểm luôn là màn hình không lộ thuật ngữ
      `provider` / `injected` / `undefined`.
- [x] 2.2 `components/wallet/wrong-chain-banner.tsx` — nhận nhãn và một hàm xử lý, không tự
      quyết định gì. Có `children` để chỗ gọi thêm lối sửa thay thế.
- [x] 2.3 `components/wallet/wallet-status-card.tsx` — địa chỉ rút gọn (bản đầy đủ vẫn ở
      `title` và trong nhánh cho trình đọc màn hình), số dư native, sao chép, ngắt kết nối.
- [x] 2.4 Ẩn liên kết explorer khi chain không có: `explorerAddressUrl` trả `null` →
      `{explorerUrl && ...}`.
- [x] 2.5 Ghi nhãn số dư native là đồng trả phí của mạng, **không phải VNDB và không phải
      tiền thật**.

*Commit:* `8cca1a6 feat(wallet): thành phần hiển thị trạng thái ví`

---

## Bước 3: Chuyển và thêm chuỗi

- [x] 3.1 `switchToExpected` dùng `useSwitchChain().switchChainAsync`.
- [x] 3.2 `addEthereumChainParameter` dựng từ `CHAINS` + config wagmi. `rpcUrls` lấy từ config
      wagmi (vì `lib/wagmi.ts` đã áp override `NEXT_PUBLIC_RPC_*`), `blockExplorerUrls` lấy từ
      `CHAINS` (vì `lib/wagmi.ts` không khai báo explorer). Không ghi cứng.
- [x] 3.3 Từ chối thì bắt lỗi, ghi lý do, **dừng**. Không gọi lại.
- [x] 3.4 Không effect nào gọi `switchToExpected` — chỉ `onClick`.

**⚠️ DEVIATION về chia commit:** bước này **nằm trong commit của bước 1** (`0e7fcf1`).
`switchToExpected` là một phần của `useWalletStatus`; tách ra commit riêng sẽ cho một commit
bước 1 không build được (hook thiếu method mà interface đã khai báo). Nội dung vẫn đủ 3.1–3.4.

**Kiểm chứng ví thật:** ⚠️ chưa làm được — máy chạy không có tiện ích ví. Bảng ở
`docs/CHECKPOINT_FE02.md`.

---

## Bước 4: Trang kết nối ví

- [x] 4.1 `components/pages/wallet-connect.tsx` ghép theo bảng ở `design.md` mục 3. Dùng
      `switch` trên `status.kind` để typecheck kiểm được là đã phủ hết trạng thái.
- [x] 4.2 `app/(client)/wallet/page.tsx`. `AppLayout` đặt ở page, không ở `layout.tsx` của
      group — theo đúng hiện trạng repo.
- [x] 4.3 "Ví của tôi" vào **nhóm trên** của `INVESTOR_NAV` (không phải nhóm module: ví là cửa
      vào của mọi thao tác ký, không phải một nghiệp vụ). Phím tắt `V`, chưa ai dùng.
- [x] 4.4 Khung chờ ở `loading`, kích thước gần với nội dung thật để không nhảy.

*Commit:* `184d9f9 feat(client): trang kết nối ví cho nhà đầu tư`
*Commit kèm:* `10240ad fix(layout): nhãn nút kết nối ví không còn nói "Admin"` (xem QĐ-K10)

---

## Bước 5: Đổi ví và ngắt kết nối giữa phiên

- [x] 5.1 Địa chỉ đọc trực tiếp từ `useAccount()` nên đổi tài khoản là cập nhật ngay. **Tự
      đạt, không phải viết gì.**
- [x] 5.2 Ngắt kết nối → `status` về `disconnected` → `WalletStatusCard` rời khỏi cây giao
      diện nên không còn dữ liệu cũ nào hiển thị. Ở trang Tổng quan, `asset-summary` đã có
      nhánh `!isConnected || !address` từ FE-01. **Tự đạt.**
- [x] 5.3 `git grep "localStorage\|sessionStorage\|document.cookie" app/src` → **rỗng**.
      `chain-store` cũng cố tình không persist.

Việc thật của bước này là chỗ spec giao việc không nêu: **`switchError` sống dai hơn tình
huống sinh ra nó**. Đã cho state mang khoá tình huống — xem `design.md` QĐ-K5.

*Commit:* `bebe1f1 fix(wallet): xử lý đổi ví và ngắt kết nối giữa phiên`

---

## Bước 6: Kiểm thử

- [x] 6.1 Unit test hàm quyết định: 30 ca, phủ tám nhánh.
- [x] 6.2 `app/e2e/wallet-connect.spec.ts` — 8 ca.
- [x] 6.3 Ca `mock`: không đòi ví, không cảnh báo sai mạng.
- [x] 6.4 Ca không có ví: hiện hướng dẫn kèm liên kết thật, không lộ thuật ngữ kỹ thuật.
- [x] 6.5 Ca lệch kết xuất: bắt cả `console` loại `error` và `pageerror`.
- [x] 6.6 `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` → **rỗng**.
- [x] 6.7 `bash scripts/run-local-all.sh` → **Đạt 6/6, Không đạt 0**.

Thêm hai nhóm ca spec giao việc không nêu:

- Mục "Ví của tôi" có trong menu và mở được — chốt là đường dẫn không trùng route group khác.
- Ba vai ngân hàng **không** vào được `/wallet` — chốt là `ChannelGuard` ở `layout.tsx` của
  group thật sự phủ trang thêm sau, không chỉ trên giấy.

**Phạm vi e2e dựng được:** `loading`, `mock`, `no-provider`, và `unsupported-chain` chỉ kiểm
được ở mức "option `stellar` bị disable". Bốn trạng thái `disconnected`, `wrong-chain`,
`chain-mismatch`, `ready` cần ví thật ký → kiểm tay.

*Commit:* `13fea3a test(wallet): kiểm thử các trạng thái kết nối ví`

---

## Bước 7: Cập nhật tài liệu

- [x] 7.1 `docs/tech-report.md`: metadata 1.4 → 1.5, cây thư mục 1.4, mục **3.9** mới
      (`lib/wallet/` + `lib/hooks/`, bảng tám trạng thái, lưu ý, cách mở rộng), 3.6 thêm
      `use-selected-chain.ts` + trỏ sang 3.9, 3.7 thêm `explorerAddressUrl`, lộ trình 4.5.
- [x] 7.2 `1.6.B` thêm 5 quyết định thiết kế; `.kiro/steering/lessons.md` thêm 5 bài học.
- [x] 7.3 Metadata đầu báo cáo đã cập nhật.

**Vì sao mục mới là 3.9 chứ không chèn giữa:** `tech-report-maintenance.md` đang tham chiếu
"Phần 3.6" và "Phần 3.8"; đánh số lại làm hai tham chiếu đó trỏ sai.

*Commit:* `docs: cập nhật báo cáo công nghệ cho màn kết nối ví`

---

## Việc KHÔNG được làm — kết quả kiểm

| Điều cấm | Kiểm |
|---|---|
| Không sửa `lib/wagmi.ts`, `use-is-mounted.ts`, `chain-store.ts` | `git diff dev...HEAD --name-only` → **0/3 file xuất hiện** |
| Không nhập `viem`/`ethers` vào component | grep → **rỗng** |
| Không gọi hợp đồng nào | `verify-arch-rules.sh` PASS |
| Không dùng địa chỉ ví để cấp quyền | Trang không gọi `can()` |
| Không thêm phụ thuộc mới | `package.json` / `package-lock.json` **không đổi** |
| Không bỏ dự phòng khi thiếu `NEXT_PUBLIC_WC_PROJECT_ID` | `lib/wagmi.ts` không sửa |
