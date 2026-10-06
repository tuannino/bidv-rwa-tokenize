# Báo cáo bàn giao: FE-24 — Thông tin tài khoản và ba chỉ tiêu token

| | |
|---|---|
| Mã task | FE-24 |
| Nhánh | `feat/account-info`, từ `dev` @ `08b8e55` (đã có FE-06 qua PR #36) |
| Spec | `docs/fe-24-account-info/{requirements,tasks}.md` |
| Tiến độ | Bước 5/5 hoàn tất; chờ Supervisor nghiệm thu, Codex không merge vào `dev` |

> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE24.md docs/fe-24-account-info/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn tài khoản đúng nội dung cho bốn vai, thay trang chỗ trống của FE-24 | ✅ | mục 3.1, 3.3 |
| 2 | Ba chỉ tiêu token lấy từ cấu hình, hiện ở cả ba nơi | ✅ | mục 3.2, 3.3 |
| 3 | Màn giao dịch token không còn dòng “Chưa có dữ liệu” | ✅ | mục 3.2 |
| 4 | Kiểm tra trước lệnh đọc định danh và rủi ro từ hồ sơ | ✅ | mục 3.1, 3.2 |
| 5 | Mỗi vai chỉ xem hồ sơ của mình | ✅ | mục 3.1, 3.3 |
| 6 | Kiểm thử đầu cuối cũ đã sửa và xanh | ✅ | mục 3.3 |
| 7 | Không còn trang chỗ trống nào trong ứng dụng | 🔶 | mục 4 DV-1 (Owner chốt không mở rộng FE-24 sang FE-08/FE-23) |
| 8 | `run-local-all.sh` xanh | ✅ | mục 7 |

**Kết luận:** 7 ✅, 1 🔶, 0 ❌.

### 0.2 Việc cần Owner quyết

Không có việc chặn nghiệm thu. Owner đã chốt DV-1: giữ hai placeholder ngoài phạm vi FE-24 và ghi
vào checkpoint/đề xuất task tiếp theo, không kéo FE-08 hay FE-23 vào nhánh này.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `63c4251` | Đưa spec vào repo, chuyển FE-24 sang đang làm |
| `51a2d57` | Thêm ba khoá cấu hình token và dùng chung ở ba màn |
| `7b9c9f4` | Thêm hồ sơ bốn vai, nối KYC/rủi ro vào pre-trade |
| `2d1b9c8` | Thay placeholder `/account` bằng màn chỉ đọc bốn vai |
| `5ef399b` | Thêm E2E tài khoản bốn vai |
| (cuối) | Báo cáo công nghệ 3.4, checkpoint, trạng thái và kết quả kiểm cuối |

```
$ git diff --stat origin/dev...HEAD | tail -1   # trước commit cuối
 22 files changed, 884 insertions(+), 82 deletions(-)
```

Hai tệp HTML không theo dõi có sẵn trong worktree không thuộc FE-24 và không được thêm vào commit.

## 2. Đối chiếu các bước trong `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-24 đang làm, marker hợp lệ | ✅ | `63c4251`; nền đồng bộ `origin/dev` trước khi tạo nhánh |
| 1 | Ba chỉ tiêu token; ca 3, 4 | ✅ | `51a2d57`, mục 3.2 |
| 2 | Hồ sơ định danh/rủi ro; pre-trade đọc nguồn mới | ✅ | `7b9c9f4`, mục 3.1 |
| 3 | Màn tài khoản; ca 1, 2, 5 | ✅ | `2d1b9c8`, mục 3.1 |
| 4 | E2E và dọn | ✅ | `5ef399b`, mục 3.3; DV-1 ở mục 4 |
| 5 | Báo cáo, trạng thái, checkpoint, kiểm cuối | ✅ | mục 6, 7 |

## 3. Cách chạy và bằng chứng

Mức kiểm chứng **Vừa** theo spec: unit/service/component, toàn bộ Vitest và toàn bộ E2E Chromium.

### 3.1 Hồ sơ và màn bốn vai

`account-profile.service.ts` giữ view-model phân biệt `CUSTOMER`/`EMPLOYEE`:

- Nhà đầu tư: cá nhân, liên hệ, KYC, ví, tài khoản, hạng rủi ro, AML, hạn mức ngày.
- Người bán: pháp nhân + người liên hệ + ví thanh toán, cùng khối tài khoản và tuân thủ.
- GDV/KSV: mã cán bộ, vai, trạng thái, liên hệ, hoạt động gần nhất; kiểu dữ liệu không có trường ví,
  KYC, rủi ro hay AML.
- `getOwnAccountProfile()` không nhận mã hồ sơ từ client. Nó đọc vai và mã người dùng trong phiên,
  rồi chỉ trả bản ghi khớp cả hai. Cặp `INVESTOR + NB001` trả lỗi thay vì lộ hồ sơ Người bán.

```
$ npx vitest run test/account-profile.test.ts test/account-info.test.ts
 Test Files  2 passed (2)
      Tests  16 passed (16)
```

Trang là Server Component; phần trình bày không có `button`, `input`, `textarea` hay `select`.

### 3.2 Cấu hình token và pre-trade

Ba khoá mới có mặc định và dòng seed chung cho memory/Postgres:

| Khoá | Mặc định |
|---|---|
| `wpt.remaining_lifetime_years` | 15 năm |
| `wpt.annual_yield_percent` | 5,8%/năm |
| `wpt.trading_fee_percent` | 0% — không tính phí |

`readTokenTerms()` đọc ba khoá một lần và lùi mặc định riêng từng giá trị hỏng. Ba nơi dùng cùng
nguồn: `/trade` qua `trade.service`, `/seller` qua `seller.service`, `/tokens/[symbol]` tại route
Server Component. Test đổi cấu hình rồi kiểm cả ba view-model thay theo.

Pre-trade chỉ đạt định danh khi ví thuộc hồ sơ của đúng phiên, hồ sơ `APPROVED` và ví nằm trong
whitelist ledger. Điều kiện rủi ro đòi AML `CLEARED`, hạng khác `HIGH`, rồi mới chạy bộ kiểm số dư và
thanh khoản BE-14. Nhờ vậy không bỏ mất chặn thiếu VNDB/ủy quyền/tồn kho đã có.

```
$ npx vitest run test/config-service.test.ts test/investor-trading.test.ts \
    test/seller-channel.test.ts test/account-profile.test.ts
 Test Files  4 passed (4)
      Tests  68 passed (68)

$ rg -n "Chưa có dữ liệu" app/src/components/pages/{investor-trade,seller-overview,investor-token-detail}.tsx
# không có kết quả
```

### 3.3 Toàn bộ kiểm thử ứng dụng và E2E

```
$ npx vitest run
 Test Files  29 passed (29)
      Tests  766 passed (766)

$ npx playwright test
  52 passed (39.1s)
```

E2E mới có 8 ca: bốn vai mở đúng hồ sơ, màn chỉ đọc; Nhà đầu tư có KYC/rủi ro/ví; Người bán có
pháp nhân/liên hệ/ví thanh toán; GDV và KSV không có hồ sơ đầu tư hay ví. Toàn bộ 44 ca cũ cũng xanh,
bao gồm ca `wallet-connect` từng lỗi trên CI của PR #36.

## 4. Deviation / giới hạn đã biết

### DV-1 — Điều kiện “không còn trang chỗ trống” lệch trạng thái kế hoạch

Đo trên source sau FE-24:

```
$ rg -l "PlaceholderPage" app/src/app | sort
app/src/app/(investor)/withdraw/page.tsx
app/src/app/(ops)/distribution/page.tsx
```

Hai trang chờ **FE-23** và **FE-08**, đều đang `planned` trong `.kiro/task-status.json`. Owner chốt
không mở rộng FE-24 sang hai task này. Vì vậy điều kiện số 7 đạt một phần; `/account` không còn
placeholder, nhưng toàn ứng dụng còn hai trang theo đúng kế hoạch hiện tại.

### DV-2 — Hồ sơ là dữ liệu mẫu của PoC

Repo chưa có AU-01 và chưa có kho người dùng chung cho bốn vai. FE-24 dùng nguồn mẫu server-only,
khớp mã tài khoản đang dùng trong bộ chọn vai. AU-01 phải thay nguồn đọc, không đổi view-model hay
cho client gửi `actorId`.

### DV-3 — Hạn mức ngày chưa tham gia quyết định giao dịch

Spec yêu cầu hiển thị hạn mức và pre-trade đọc “rủi ro”, nhưng không định nghĩa cách cộng doanh số
trong ngày. FE-24 hiển thị hạn mức, không tự biến nó thành hạn mức mỗi lệnh. Task backend sau phải
chốt phép cộng theo trạng thái/múi giờ trước khi dùng để chặn.

## 5. Đề xuất task tiếp theo để hoàn thiện Mint/Burn

Đề xuất làm **SC-02 sau khi tái đặc tả theo BE-12**, không dùng nguyên mô tả cũ “phát hành đúng một
lần toàn bộ nguồn cung”. BE-12 đã chốt phát hành nhiều lần tới trần còn lại; triển khai SC-02 cũ sẽ
làm adapter EVM và nghiệp vụ hiện tại mâu thuẫn nhau.

Phạm vi nên chốt cho SC-02 mới:

1. Hợp đồng/điểm điều phối EVM lưu ví thanh toán SPV và mốc đã phát hành lần đầu.
2. Lần đầu gọi `mintInitialSupply(to, amount)` ghi ví SPV; các lần duyệt Mint sau dùng `mint()` vào
   đúng ví đó, tới trần cấu hình của dự án.
3. Nối ba marker `@blocked SC-02` trong `evm.adapter.ts`; kiểm quyền contract cho signer vận hành.
4. Chạy maker-checker Mint và Burn thật trên hardhat-local: GDV lập → KSV duyệt → receipt → tổng cung
   và tồn kho SPV đổi; Burn giảm đúng nguồn chưa phân phối.
5. Cập nhật deploy/shared ABI/address và test chống phát hành sang ví SPV khác.

Sau SC-02, luồng Mint/Burn đã chạy ở mock hiện nay sẽ có đường EVM thật; SC-03 là bước kế tiếp cho
khớp mua/bán, không phải điều kiện để đóng riêng luồng Mint/Burn.

## 6. Tài liệu và ba luật kiến trúc

- Báo cáo công nghệ nâng 3.3 → 3.4: metadata, cây file, `bank/`, `store/`, cấu hình 15 khoá, cập nhật
  FE-25 và thêm mục 3.21 cho FE-24.
- Marker `@pending FE-24` đã gỡ; bảng điểm cắm được sinh lại tự động ở commit giao diện.
- Luật #1: pre-trade vẫn gọi chain qua `getLedger()`/`ILedgerPort`.
- Luật #2: FE-24 không thêm đường ký.
- Luật #3: khu vực dùng `AREA_GATES.account`; hồ sơ tự thân chỉ đọc phiên, không thêm so sánh vai để
  cấp quyền nghiệp vụ.

## 7. Kết quả `run-local-all.sh`

Lượt đầy đủ đầu tiên phát hiện ba so sánh literal role trong phần FE-24 mới, nên dừng ở cổng luật
kiến trúc. Đã thay phép so sánh trình bày bằng `customerType`, lập chỉ mục hồ sơ theo khoá phiên và
lọc hồ sơ nhà đầu tư bằng discriminator của view-model. Sau đó chạy kiểm tra đích (36 test xanh) rồi
chạy lại toàn bộ đúng một lần. Lượt đầy đủ cuối có mã thoát 0:

```
Đạt: 7
  PASS  LUẬT KIẾN TRÚC
  PASS  MARKER
  PASS  CHECKPOINT
  PASS  CONTRACT EVM (67 passing)
  PASS  APP - TYPECHECK
  PASS  APP - LINT
  PASS  APP - UNIT/INTEGRATION (29 tệp, 766 test)
Không đạt: 0
```

Cổng kiến trúc còn các cảnh báo không chặn:

- `SIGNER_KIND` nằm ngoài `config/` là khoản nợ có sẵn.
- Bộ quét chuỗi EVM báo hai địa chỉ ví mẫu FE-24 và hai địa chỉ demo Mint có sẵn. Hai địa chỉ FE-24
  là định danh người dùng/SPV của nguồn hồ sơ PoC, không phải địa chỉ contract; AU-01 sẽ thay chúng
  bằng dữ liệu lưu trữ. Không chuyển chúng vào registry contract vì sẽ trộn hai khái niệm khác nhau.
- Lượt cuối không có `BASE_REF`; kiểm tra riêng với `BASE_REF=origin/dev` xác nhận FE-24 không đổi
  contract.

Không có thay đổi hành vi source sau lượt đầy đủ cuối; chỉ cập nhật checkpoint, báo cáo và trạng thái
task. Playwright đầy đủ đã chạy riêng ngay trước đó: **52/52 ca xanh trong 39,1 giây**.
