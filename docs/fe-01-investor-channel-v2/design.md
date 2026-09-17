# FE-01 v2 — Tách kênh và trang tổng quan nhà đầu tư: design

## 1. Mô hình kênh và vai

### QĐ-1: Kênh là lựa chọn tường minh, vai suy ra từ kênh

Đây là thay đổi cốt lõi của v2.

```
Kênh "Nhà đầu tư"    → vai bị ép về INVESTOR, ẩn bộ chọn vai
Kênh "Admin console" → chọn vai trong ba vai ngân hàng: BANK_ADMIN, COMPLIANCE, AUDITOR
```

Lưu kênh vào một cookie riêng, độc lập với cookie vai đang có:

```
bidv_channel = 'investor' | 'admin'      (mới)
bidv_role    = BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR   (đã có, giữ nguyên)
```

Vì sao dùng hai cookie thay vì suy vai từ kênh mỗi lần đọc: cookie vai đã được `currentRole()` và toàn bộ tầng nghiệp vụ dùng, đổi cách đọc sẽ lan ra nhiều chỗ. Cookie kênh chỉ phục vụ giao diện quyết định hiển thị gì, còn phân quyền vẫn do vai và RBAC đảm nhiệm.

**Ràng buộc bất biến:** hai cookie phải luôn nhất quán. Đổi kênh là **đặt cả hai** trong một lần, không để người dùng ở kênh nhà đầu tư mà vai là cán bộ ngân hàng.

| Hành động của người dùng | `bidv_channel` | `bidv_role` |
|---|---|---|
| Chọn kênh Nhà đầu tư | `investor` | `INVESTOR` |
| Chọn kênh Admin console | `admin` | `BANK_ADMIN` nếu vai hiện tại là `INVESTOR`, ngược lại giữ nguyên |
| Đổi vai trong Admin console | không đổi | vai được chọn |

### QĐ-2: Guard vẫn dựa trên quyền, không dựa trên cookie kênh

Cookie kênh do người dùng đặt được, nên **không được dùng làm cơ sở phân quyền**. Guard của kênh nhà đầu tư vẫn dùng `ChannelGuard` với một quyền mới:

```
portfolio:read   — chỉ cấp cho INVESTOR
```

Đây là phương án A trong `CHECKPOINT_FE01.md`, đã được Owner chốt. Sửa ba dòng trong `permissions.ts`:

```ts
// thêm vào ACTIONS
'portfolio:read',

// gán: chỉ INVESTOR
INVESTOR: ['token:transfer', 'portfolio:read', 'balance:read', 'txn:read'],
```

Không đưa `portfolio:read` vào `READ_ONLY`, vì đó là lý do bản v1 thất bại.

Sau khi sửa, `requireAny={['portfolio:read']}` chặn được cả ba vai ngân hàng, và test `fixme` của v1 bỏ được nhãn.

### QĐ-3: Cookie kênh không phải nguồn sự thật cho nghiệp vụ

Tầng nghiệp vụ tiếp tục chỉ đọc vai qua `currentRole()`. Không hàm nào trong `lib/bank/` được đọc cookie kênh. Cookie kênh chỉ dùng ở tầng giao diện để quyết định hiển thị bộ chọn vai và menu nào.

## 2. Cấu trúc tệp

```
app/src/lib/rbac/permissions.ts          (sửa)  — thêm portfolio:read cho INVESTOR
app/src/lib/session/channel.ts           (mới)  — đọc kênh hiện tại, server-only
app/src/app/actions/session.ts           (sửa)  — thêm setChannel, giữ setDemoRole
app/src/lib/config/flags.ts              (sửa)  — đưa channel ra cấu hình công khai

app/src/components/layout/
  channel-switcher.tsx                   (mới)  — bộ chọn kênh, hai lựa chọn
  role-switcher.tsx                      (sửa)  — bỏ INVESTOR, chỉ hiện ở kênh admin
  header.tsx                             (sửa)  — đặt channel-switcher, ẩn role-switcher theo kênh

app/src/app/(client)/
  portfolio/page.tsx                     (sửa)  — thay trang chỗ trống
  tokens/[symbol]/page.tsx               (mới)  — trang chi tiết dự án token

app/src/components/pages/
  investor-portfolio.tsx                 (mới)  — thành phần chính của trang tổng quan
  investor-token-detail.tsx              (mới)  — thành phần trang chi tiết

app/src/components/investor/             (mới)
  asset-summary.tsx                              — R4: tài sản đã đầu tư
  market-status-box.tsx                          — R5: trạng thái thị trường
  transaction-history-box.tsx                     — R6: lịch sử giao dịch
  token-list-box.tsx                              — R7: danh sách token

app/src/lib/bank/portfolio.service.ts    (mới)  — đọc vị thế và lịch sử cho một ví
app/src/app/actions/portfolio.ts         (mới)  — server action, vỏ mỏng
```

## 3. Nguồn dữ liệu cho bốn hộp

Đây là phần dễ làm sai nhất. Quy tắc: **số liệu thật và số liệu mẫu không được trộn trong cùng một con số**, và số liệu mẫu phải có nhãn trên giao diện.

| Hộp | Dữ liệu | Nguồn | Nhãn mẫu |
|---|---|---|---|
| Tài sản đã đầu tư | số dư WPT | `ILedgerPort.balanceOf` | không, là số thật |
| | số dư VNDB | `ILedgerPort.paymentBalanceOf` nếu BE-01 đã merge, nếu chưa thì ẩn hộp con này | không |
| | giá trị quy đổi | số dư nhân giá phát hành, tỷ lệ 1:1 | không |
| Trạng thái thị trường | tổng cung, đang lưu hành | `ILedgerPort.tokenInfo` | không |
| | giá phát hành | cấu hình | không |
| | trạng thái vận hành dự án | `MOCK_PROJECTS` | **có** |
| Lịch sử giao dịch | danh sách giao dịch | `ITxnStore.listTxns` lọc theo ví | không |
| Danh sách token | 3 dự án | `MOCK_PROJECTS` | **có**, trừ dự án đã lên chuỗi |
| | số nhà đầu tư đang giữ | `MOCK_WIND_STATS` | **có** |

`mock-data.ts` đã có `MOCK_PROJECTS` với ba dự án điện gió, gồm tên, vùng, số tổ máy, trạng thái. Dùng lại, **không tạo nguồn dữ liệu thứ hai**.

### Ánh xạ dự án sang token

Hệ thống hiện chỉ triển khai **một** token trên chuỗi. Ba dự án trong dữ liệu mẫu ánh xạ như sau:

- Dự án đầu tiên gắn với token **WPT thật**: số dư, tổng cung đọc từ chuỗi.
- Hai dự án còn lại là **dữ liệu mẫu**, hiển thị nhãn "chưa triển khai trên chuỗi", không có số dư, đường dẫn chi tiết vẫn mở được.

Cách này cho thấy được hình dung nhiều dự án mà không giả số dư on-chain.

## 4. Hộp trạng thái thị trường: giới hạn phải tôn trọng

Hệ thống **chưa có thị trường thứ cấp**. Không có sàn, không có khớp lệnh giữa các nhà đầu tư, nên **không có giá giao dịch**.

Vì vậy hộp này hiển thị *trạng thái phát hành và vận hành*, không phải *giá thị trường*:

- Giá phát hành, cố định theo cấu hình
- Tổng cung và số đang lưu hành, đọc từ chuỗi
- Tỷ lệ đã phân phối cho nhà đầu tư
- Trạng thái vận hành dự án, có nhãn dữ liệu mẫu

**Không** hiển thị biến động giá theo phần trăm, khối lượng giao dịch, hay biểu đồ nến. Những thứ đó cần thị trường thật; bày ra lúc này là trình bày sai bản chất cho người xem là ngân hàng.

Nếu Owner muốn có cảm giác thị trường cho bản trình diễn, cần chốt rõ đó là dữ liệu mô phỏng và ghi nhãn đậm. Ghi thành câu hỏi mở, không tự làm.

## 5. Trang chi tiết dự án token

Đường dẫn `(client)/tokens/[symbol]`. Dùng mã token làm tham số vì nó ngắn và người dùng đọc được.

Nội dung chia bốn phần, tái dùng cách trình bày của màn dự án hiện có:

1. Thông tin dự án: tên, vùng, công suất, số tổ máy, trạng thái
2. Tình hình vận hành: sản lượng, dùng `MOCK_GENERATION_SERIES`, có nhãn mẫu
3. Thông tin token: mã, tổng cung, đang lưu hành, giá phát hành
4. Vị thế của nhà đầu tư với token này: số lượng đang giữ, giá trị quy đổi

Mã token không tồn tại thì trả trang không tìm thấy của Next, không để lỗi kỹ thuật.

## 6. Service đọc vị thế

```ts
// lib/bank/portfolio.service.ts
getPortfolio(input: { wallet: string; chain: ChainKey })
  : Promise<Result<PortfolioView>>

getWalletTransactions(input: { wallet: string; chain: ChainKey; limit?: number })
  : Promise<Result<TxnView[]>>
```

Hai điểm bắt buộc:

- Kiểm quyền `portfolio:read` **trong service**, không ở server action.
- Lọc theo ví **trong service**. Truyền ví khác vào cũng chỉ trả về của ví đang ở phiên, hoặc từ chối. Không tin giao diện tự lọc.
- Số lượng và số tiền trả ra dạng **chuỗi**.

## 7. Điểm cần chú ý

- `RoleSwitcher` hiện có hằng `CHANNEL_HOME` map vai sang trang mặc định. Sau v2, phần cho `INVESTOR` chuyển sang bộ chọn kênh, hằng này chỉ còn ba vai ngân hàng.
- `setDemoRole` hiện `return` im lặng khi vai không hợp lệ. Giữ cách đó cho `setChannel`: giá trị lạ thì bỏ qua, không ném lỗi.
- Cookie đang đặt `httpOnly: false` để giao diện đọc lại được. Giữ nguyên cho cookie kênh, và giữ nguyên ghi chú rằng đây là lỗ hổng có chủ ý sẽ đóng ở AU-01.
- `refresh()` được gọi sau khi đặt cookie để máy chủ kết xuất lại. Cookie kênh cũng cần.
- Nếu BE-01 chưa merge thì `paymentBalanceOf` chưa có. Khi đó **ẩn** phần số dư VNDB thay vì hiện số 0, và ghi vào checkpoint là nợ chờ BE-01.
- Bốn hộp nên tải dữ liệu độc lập. Một hộp lỗi thì ba hộp còn lại vẫn hiển thị, kèm thông báo lỗi cục bộ ở hộp đó.
