# Báo cáo bàn giao: FIX-03 Chuẩn hoá các chuỗi hiển thị trong `lib/` theo danh sách

| | |
|---|---|
| Mã task | FIX-03 |
| Phạm vi | Chuẩn hoá các chuỗi hiển thị trong `lib/` theo danh sách (gồm `lib/format.ts` dùng chung máy chủ và trình duyệt, `use-native-balance.ts`, `wagmi.ts` phía trình duyệt), không đổi hành vi |
| Nhánh | `fix/fix-03-chuoi-may-chu`, tạo từ `dev` (`34bf33a`, sau merge PR #79 UIUX-02) |
| Spec | `docs/fix-03-chuoi-may-chu/{requirements,tasks}.md` (chép nguyên) |
| Commit | mã `8a69922`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | Đủ 59 thay đổi đúng nguyên văn; `lib/` chỉ đổi các dòng mục 3 và dòng import `formatAmount`; `docs/flows` chỉ đổi do script | ✅ | mục 2 (bảng 59 dòng); mục 5 (65 dòng sửa, 4 dòng import) |
| 2 | Ca 1 (quét) xanh; lệnh kiểm tệp cấm rỗng | ✅ | mục 1.1, 5 |
| 3 | Typecheck, lint, vitest (cả Postgres), e2e mock và hardhat xanh; test cũ chỉ đổi chuỗi mong đợi; 7 đột biến bị bắt | ✅ | mục 1, 3, 4 |
| 4 | Số server action khi mở màn không đổi | ✅ | mục 1.3 |
| 5 | Checkpoint, UserGuide, task-status | ✅ | mục 6 |

**Kết luận:** 5 ✅, 0 🔶, 0 ❌. Chỉ đổi chữ hiển thị và một hằng số mẫu; không đổi hành vi, không thêm thư viện. Bản quét
mẫu của tasks bước 5 ra 41 chỗ trên `dev`, 0 chỗ sau task.

UserGuide: đã cập nhật Phần 3 quy ước chung (ô trống hiển thị `–`); dòng "Chốt tại"; Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- **Mục #59 (`purchase.service.ts:374-375`):** spec ghi dòng 374-375, tức chỉ câu sổ kiểm toán của lệnh **mua** (dòng 375).
  Câu của lệnh **bán** ở dòng 376 (`đặt lệnh bán ... ${wptAmount} WPT, nhận ${vndAmount} VNDB`) cùng khối nhưng ngoài số
  dòng spec nên GIỮ nguyên số thô. Nếu Supervisor muốn hai câu thống nhất thì bọc `formatAmount` ở dòng 376 (một dòng).
- Số thô ở tệp khác của `lib/` (ngoài phạm vi, mục 7) để task sau.

---

## 1. Kiểm thử

### 1.1 Vitest mới `app/test/fix-03-chuoi-may-chu.test.ts`

```text
$ (cd app && npx vitest --run test/fix-03-chuoi-may-chu.test.ts)
      Tests  7 passed (7)
```

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Quét mọi tệp `.ts`, `.tsx` trong `app/src/lib` trừ `lib/store` bằng `typescript.createSourceFile` (chuỗi thường, template, từng phần chữ của template lồng, chữ JSX; chú thích tự bỏ), cùng logic bản mẫu: danh sách chỗ có ký tự cấm rỗng |
| 2 | `formatAmount(null)`, `formatAmount('')`, `formatDateTime(null)` trả `–`; `formatAmount(1500000000n)` trả `1.500.000.000` |
| 3 | `describeVaultConfigStep`: `số khoá cố định 0 thành 1.500.000.000 VNDB`, `tỷ lệ khoá 0% thành 20%`, `chế độ khoá UNSET thành PERCENT` |
| 4 | Đặt giá gấp mười (theo ca có sẵn `config-service.test.ts:201`): `VALIDATION`, câu có `Giá mới <số dấu nghìn> VNDB lệch quá` và `<giá cũ dấu nghìn> VNDB. Kiểm lại`, `not.toMatch(/\bVND\b(?!B)/)` |
| 5 | Quỹ 1.000.000, ngưỡng 2.000.000: `approveDistribution` trả đúng câu #45 `Phần chưa phân bổ 1.000.000 VNDB dưới ngưỡng 2.000.000 VNDB (distribution.min_new_balance).`; `getDistributionOverview` có câu #58 với số dấu nghìn |
| 6 | `MOCK_WIND_STATS.profitDistributedVndBn === 5.8`; `REGION_LABELS` không có chấm giữa |
| 7 | Lệnh `CHECKING` (cách `purchase-service.test.ts`), Giao dịch viên `executeOrder`: dòng sổ `order:intervene` chứa mã lệnh, bắt đầu bằng `can thiệp tay, lệnh <mã>`; `getOrderDetail` của Nhà đầu tư trả đúng dòng đó |

### 1.2 Toàn bộ

```text
$ (cd app && npm run typecheck && npm run lint)          # 0 lỗi; 1 cảnh báo có từ trước (fake-fireblocks.ts:86, IN-04)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  71 passed | 11 skipped (82)
      Tests  1460 passed | 74 skipped (1534)     # bỏ qua: tệp cần nút Hardhat
$ bash scripts/run-local-all.sh arch markers app
  PASS: 20   FAIL: 0   WARN: 3                   # 3 cảnh báo có từ trước
  => ĐẠT các phần đã chạy: arch markers app
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm
  84 passed (1.8m)                               # e2e mock
  26 passed (37.1s)                              # e2e hardhat
  => ĐẠT các phần đã chạy: build e2e evm
```

Lần chạy Postgres đầu tiên đỏ 65 ca vì máy chủ Postgres cục bộ đã tắt (`ECONNREFUSED 127.0.0.1:5432`); bật lại rồi chạy
lại thì xanh như trên. Không liên quan mã.

### 1.3 Số server action khi mở

Task không đụng giao diện. Đo lại 28 lượt màn (cách HF-01, mock, `next start`) trên nhánh này: giống hệt từng dòng bảng
"Sau" của `docs/CHECKPOINT_UIUX02.md` mục 3.

### 1.4 Test cũ đã đổi chuỗi mong đợi (không nới điều kiện)

| Tệp:dòng | Cũ | Mới |
|---|---|---|
| `test/maker-checker-ui.test.ts:120` | `toBe('[gạch dài]')` | `toBe('–')` |
| `test/maker-checker-ui.test.ts:127` | `toBe('[gạch dài]')` | `toBe('–')` |
| `test/config-service.test.ts:462-463` | `toContain(NEAR_PRICE)`, `toContain(String(WPT_ISSUE_PRICE_VND))` | `toContain(formatAmount(NEAR_PRICE))`, `toContain(formatAmount(WPT_ISSUE_PRICE_VND))` (thêm import `formatAmount` ở dòng 11) |
| `test/be-13-vault-config.test.ts:232` | `'tỷ lệ khoá 0% [mũi tên ASCII] 20%'` | `'tỷ lệ khoá 0% thành 20%'` |
| `test/be-13-vault-config.test.ts:233` | `'chế độ khoá UNSET [mũi tên ASCII] PERCENT'` | `'chế độ khoá UNSET thành PERCENT'` |

`docs/flows/distribute.md`, `docs/flows/purchase.md` sinh lại bằng `node scripts/gen-flow-diagram.mjs distribute`, `... purchase`
(dòng import làm lệch số dòng marker `@flow`); `--check` khớp cả ba luồng. `e2e/maker-checker.spec.ts:142` không sửa (spec mục 5).

## 2. 59 thay đổi (cũ và mới thực tế)

Số dòng theo `dev` @ `34bf33a`, trùng `67ece1e` (UIUX-02 không đụng `lib/`). `fa(` là viết gọn của `formatAmount(`; mã viết đủ
`formatAmount(...)`. Ký tự cấm trong cột "Cũ" ghi bằng chữ trong ngoặc vuông.

| # | Tệp:dòng | Cũ (phần đổi) | Mới (thực tế) |
|---|---|---|---|
| 1 | `lib/bank/distribution-trigger.service.ts:758` | `KHÔNG chia gì [gạch dài] hai ` | `KHÔNG chia gì; hai ` |
| 2 | `lib/bank/distribution.service.ts:1205` | `} [gạch dài] không còn hồ sơ nào` | `}; không còn hồ sơ nào` |
| 3 | `lib/bank/issuance.service.ts:526` | `vào bảng dự án [gạch dài] dòng đã bị đổi` | `vào bảng dự án; dòng đã bị đổi` |
| 4 | `lib/bank/purchase.service.ts:278` | `trước khi tạo bản ghi [gạch dài] ${` | `trước khi tạo bản ghi: ${` |
| 5 | `lib/bank/purchase.service.ts:871` | `Chưa phát hành nguồn cung ban đầu [gạch dài] không có WPT nào để bán.` | `Chưa phát hành nguồn cung ban đầu, không có WPT nào để bán.` |
| 6 | `lib/bank/purchase.service.ts:961` | `Chưa phát hành nguồn cung ban đầu [gạch dài] chưa có ví thanh toán` | `Chưa phát hành nguồn cung ban đầu, chưa có ví thanh toán` |
| 7 | `lib/bank/purchase.service.ts:1097` | `} [gạch dài] lệnh ${order.id}` | `}, lệnh ${order.id}` |
| 8 | `lib/bank/purchase.service.ts:1234` | `bị từ chối trước khi gửi tx [gạch dài] ${` | `bị từ chối trước khi gửi tx: ${` |
| 9 | `lib/bank/purchase.service.ts:1334` | `${receipt.status} [gạch dài] ${` | `${receipt.status}: ${` |
| 10 | `lib/bank/purchase.service.ts:1410` | `đối soát từ chuỗi sau lỗi cục bộ [gạch dài] ${` | `đối soát từ chuỗi sau lỗi cục bộ: ${` |
| 11 | `lib/bank/purchase.service.ts:1630` | `gửi giao dịch thất bại [gạch dài] ${` | `gửi giao dịch thất bại: ${` |
| 12 | `lib/bank/purchase.service.ts:1699` | `${receipt.status} [gạch dài] ${` | `${receipt.status}: ${` |
| 13 | `lib/bank/purchase.state.ts:124` | `là trạng thái kết thúc [gạch dài] muốn mua tiếp` | `là trạng thái kết thúc; muốn mua tiếp` |
| 14 | `lib/bank/token-request.service.ts:352` | `bị chặn [gạch dài] ${describeFailed(checks)}` | `bị chặn: ${describeFailed(checks)}` |
| 15 | `lib/bank/token-request.service.ts:418` | `do chính mình lập [gạch dài] bị chặn.` | `do chính mình lập, bị chặn.` |
| 16 | `lib/bank/token-request.service.ts:474` | `vì điều kiện đã đổi [gạch dài] ${describeFailed(checks)}` | `vì điều kiện đã đổi: ${describeFailed(checks)}` |
| 17 | `lib/bank/token-request.service.ts:1566` | `chưa biết kết cục [gạch dài] cần đối soát.` | `chưa biết kết cục, cần đối soát.` |
| 18 | `lib/bank/vault-config.ts:137` | `số khoá cố định ${step.previous} [mũi tên ASCII] ${step.amount} VNDB` | `số khoá cố định ${fa(step.previous)} thành ${fa(step.amount)} VNDB` |
| 19 | `lib/bank/vault-config.ts:139` | `% [mũi tên ASCII] ${bpsToPercent(step.bps)}%` | `% thành ${bpsToPercent(step.bps)}%` |
| 20 | `lib/bank/vault-config.ts:141` | `chế độ khoá ${step.previous} [mũi tên ASCII] ${step.mode}` | `chế độ khoá ${step.previous} thành ${step.mode}` |
| 21 | `lib/config/flags.ts:70` | `Chưa hiện thực (adapter stub) [gạch dài] để Phase 7.` | `Chưa hiện thực (adapter stub), để Phase 7.` |
| 22 | `lib/config/flags.ts:73` | `Thiếu RPC [gạch dài] đặt NEXT_PUBLIC_RPC_HARDHAT.` | `Thiếu RPC, đặt NEXT_PUBLIC_RPC_HARDHAT.` |
| 23 | `lib/config/flags.ts:76` | `Thiếu RPC testnet [gạch dài] đặt NEXT_PUBLIC_RPC_EVM (Phase 6).` | `Thiếu RPC testnet, đặt NEXT_PUBLIC_RPC_EVM (Phase 6).` |
| 24 | `lib/format.ts:15` | `return '[gạch dài]';` | `return '–';` |
| 25 | `lib/format.ts:39` | `return '[gạch dài]';` | `return '–';` |
| 26 | `lib/hooks/use-native-balance.ts:39` | `Chưa đọc được số dư [gạch dài] có thể node` | `Chưa đọc được số dư, có thể node` |
| 27 | `lib/ledger/address.ts:34` | `Checksum EIP-55 không khớp [gạch dài] thường là` | `Checksum EIP-55 không khớp, thường là` |
| 28 | `lib/ledger/evm.adapter.ts:123` | `tại thời điểm chốt bằng 0 [gạch dài] không có quyền để chia.` | `tại thời điểm chốt bằng 0, không có quyền để chia.` |
| 29 | `lib/ledger/evm.adapter.ts:135` | `Chuyển VNDB thất bại [gạch dài] thường là` | `Chuyển VNDB thất bại, thường là` |
| 30 | `lib/ledger/evm.adapter.ts:147` | `của ví nhà đầu tư không đủ [gạch dài] chủ ví phải` | `của ví nhà đầu tư không đủ; chủ ví phải` |
| 31 | `lib/ledger/mock.adapter.ts:323` | `Chưa chốt quyền lần nào [gạch dài] gọi takeSnapshot() trước.` | `Chưa chốt quyền lần nào, gọi takeSnapshot() trước.` |
| 32 | `lib/ledger/mock.adapter.ts:663` | `Chưa phát hành nguồn cung ban đầu [gạch dài] không có WPT` | `Chưa phát hành nguồn cung ban đầu, không có WPT` |
| 33 | `lib/ledger/mock.adapter.ts:720` | `Chưa phát hành nguồn cung ban đầu [gạch dài] chưa có ví` | `Chưa phát hành nguồn cung ban đầu, chưa có ví` |
| 34 | `lib/ledger/mock.adapter.ts:854` | `Danh sách ví trống [gạch dài] tầng nghiệp vụ` | `Danh sách ví trống; tầng nghiệp vụ` |
| 35 | `lib/mock-data.ts:25` | `Trên bờ [chấm giữa] Cao nguyên` | `Trên bờ, Cao nguyên` |
| 36 | `lib/mock-data.ts:26` | `Trên bờ [chấm giữa] Ven biển` | `Trên bờ, Ven biển` |
| 37 | `lib/rbac/demo-payment.ts:62` | `(ENABLE_DEMO_TOKEN_MINT=false) [gạch dài] chức năng chỉ dành cho` | `(ENABLE_DEMO_TOKEN_MINT=false), chức năng chỉ dành cho` |
| 38 | `lib/wagmi.ts:47` | `BIDV RWA [gạch dài] Điện gió` | `BIDV RWA Điện gió` |
| 39 | `lib/bank/config.service.ts:61` | `'Giá phải là số nguyên không dấu, đơn vị VND.'` | `'Giá phải là số nguyên không dấu, đơn vị VNDB.'` |
| 40 | `lib/bank/config.service.ts:230`, `lib/bank/config.service.ts:231` | ``Giá mới ${priceVnd} VND lệch quá` / ``${previous} VND. Kiểm lại số chữ số` | ``Giá mới ${fa(priceVnd)} VNDB lệch quá` / ``${fa(previous)} VNDB. Kiểm lại số chữ số` |
| 41 | `lib/bank/config.service.ts:250` | ``Đổi giá ${previous} [mũi tên ASCII] ${priceVnd} VND: đã gửi` | ``Đổi giá ${fa(previous)} thành ${fa(priceVnd)} VNDB: đã gửi` |
| 42 | `lib/bank/config.service.ts:251` | ``Đổi giá ${previous} [mũi tên ASCII] ${priceVnd} VND bị chuỗi từ chối` | ``Đổi giá ${fa(previous)} thành ${fa(priceVnd)} VNDB bị chuỗi từ chối` |
| 43 | `lib/bank/config.service.ts:325` | ``Giá phát hành ${previous} [mũi tên ASCII] ${priceVnd} VND; tx` | ``Giá phát hành ${fa(previous)} thành ${fa(priceVnd)} VNDB; tx` |
| 44 | `lib/bank/distribution-approval.service.ts:259`, `lib/bank/distribution-approval.service.ts:260` | `lấy ${period.totalAmount} VNDB trên chuỗi` / ``${period.expectedAmount} VNDB (tiền vào quỹ` | `lấy ${fa(period.totalAmount)} VNDB trên chuỗi` / ``${fa(period.expectedAmount)} VNDB (tiền vào quỹ` |
| 45 | `lib/bank/distribution-approval.service.ts:321` | ``Phần chưa phân bổ ${expected} VNDB dưới ngưỡng ${threshold} VNDB` | ``Phần chưa phân bổ ${fa(expected)} VNDB dưới ngưỡng ${fa(threshold)} VNDB` |
| 46 | `lib/bank/distribution-approval.service.ts:562` | ``Số trên chuỗi ${period.totalAmount} VNDB khác số đã duyệt ${period.expectedAmount} VNDB.` | ``Số trên chuỗi ${fa(period.totalAmount)} VNDB khác số đã duyệt ${fa(period.expectedAmount)} VNDB.` |
| 47 | `lib/mock-data.ts:165` | `profitDistributedVndBn: 86.4,` | `profitDistributedVndBn: 5.8,` |
| 48 | `lib/bank/config.service.ts:287` | `về ${previous} VND.` | `về ${fa(previous)} VNDB.` |
| 49 | `lib/bank/config.service.ts:293` | `về ${previous} VND (tx` | `về ${fa(previous)} VNDB (tx` |
| 50 | `lib/bank/config.service.ts:295` | ``đang là ${priceVnd} VND còn cơ sở dữ liệu vẫn là ${previous} VND.` | ``đang là ${fa(priceVnd)} VNDB còn cơ sở dữ liệu vẫn là ${fa(previous)} VNDB.` |
| 51 | `lib/bank/config.service.ts:299`, `lib/bank/config.service.ts:300` | `ledger đang là ${priceVnd} VND còn cơ sở` / ``dữ liệu vẫn là ${previous} VND. Phải đặt lại` | `ledger đang là ${fa(priceVnd)} VNDB còn cơ sở` / ``dữ liệu vẫn là ${fa(previous)} VNDB. Phải đặt lại` |
| 52 | `lib/bank/distribution-approval.service.ts:311`, `lib/bank/distribution-approval.service.ts:312` | `màn duyệt ${expected} VNDB` / `hiện là ${unallocated} VNDB.` | `màn duyệt ${fa(expected)} VNDB` / `hiện là ${fa(unallocated)} VNDB.` |
| 53 | `lib/bank/distribution-approval.service.ts:377` | `duyệt chia ${expected} VNDB` | `duyệt chia ${fa(expected)} VNDB` |
| 54 | `lib/bank/distribution-approval.service.ts:445`, `lib/bank/distribution-approval.service.ts:446` | `chuỗi ${onChain} VNDB, sổ` / ``${found.totalAmount} VNDB, số duyệt lại ${amount} VNDB.` | `chuỗi ${fa(onChain)} VNDB, sổ` / ``${fa(found.totalAmount)} VNDB, số duyệt lại ${fa(amount)} VNDB.` |
| 55 | `lib/bank/distribution-approval.service.ts:466`, `lib/bank/distribution-approval.service.ts:467` | `số trên chuỗi ${amount} VNDB`` / `(số duyệt trước ${found.expectedAmount} VNDB)` | `số trên chuỗi ${fa(amount)} VNDB`` / `(số duyệt trước ${fa(found.expectedAmount)} VNDB)` |
| 56 | `lib/bank/distribution-approval.service.ts:512` | `duyệt lại số ${period.totalAmount} VNDB trước.` | `duyệt lại số ${fa(period.totalAmount)} VNDB trước.` |
| 57 | `lib/bank/distribution-approval.service.ts:569` | `số trên chuỗi ${period.totalAmount} VNDB. Duyệt lại` | `số trên chuỗi ${fa(period.totalAmount)} VNDB. Duyệt lại` |
| 58 | `lib/bank/distribution-approval.service.ts:673` | ``Phần chưa phân bổ ${unallocated} VNDB dưới ngưỡng ${threshold} VNDB.`` | ``Phần chưa phân bổ ${fa(unallocated)} VNDB dưới ngưỡng ${fa(threshold)} VNDB.`` |
| 59 | `lib/bank/purchase.service.ts:375` | `${order.id}: ${wptAmount} WPT, phải trả ${vndAmount} VNDB` | `${order.id}: ${fa(wptAmount)} WPT, phải trả ${fa(vndAmount)} VNDB` |

## 3. Đột biến (7/7 bị bắt)

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Giữ gạch dài ở #14 (`token-request.service.ts:352`) | ca 1 |
| 2 | `formatAmount(null)` vẫn trả gạch dài | ca 1, ca 2 |
| 3 | Bỏ `formatAmount` ở #18 | ca 3 |
| 4 | Đơn vị ở #40 còn `VND` | ca 4 |
| 5 | Bỏ mã lệnh khỏi dòng sổ #7 | ca 7 |
| 6 | `profitDistributedVndBn` còn `86.4` | ca 6 |
| 7 | Bỏ `formatAmount` ở #58 | ca 5 |

## 4. Quét

```text
$ git diff --name-only dev... | grep -E '^app/src/(components|app)/|^app/src/lib/store/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
(rỗng)
$ (cd app && node scan-lib-strings.mjs src/lib)     # bản mẫu tasks bước 5, không commit
TONG 41                                               # trên dev
TONG 0                                                # sau task
```

## 5. Tệp đã sửa

- 18 tệp `lib/` của mục 3: 65 dòng sửa (59 mục, mục nhiều dòng tính từng dòng) và 4 dòng `import { formatAmount } from '@/lib/format';`
  (`vault-config.ts`, `config.service.ts`, `distribution-approval.service.ts`, `purchase.service.ts`; tệp cuối cần cho #59 nên thêm
  dù spec liệt kê ba tệp).
- Test: `fix-03-chuoi-may-chu.test.ts` (mới), ba tệp ở mục 1.4.
- `docs/flows/distribute.md`, `docs/flows/purchase.md` (sinh lại); tài liệu mục 6.

## 6. Tài liệu

- `docs/USER_GUIDE.md`: một dòng ở quy ước chung Phần 3 (ô trống `–`); "Chốt tại"; Lịch sử.
- `.kiro/task-status.json`: `FIX-03` vào `done`. Spec chép ở `docs/fix-03-chuoi-may-chu/`.

## 7. Số thô ngoài phạm vi (thấy được, để xử lý sau)

Câu do `lib/` dựng còn in số không dấu nghìn, ngoài ba tệp của mục 3.4:

- `lib/bank/purchase.service.ts:376` trên `dev` (377 sau task): câu sổ đặt lệnh **bán** (xem mục 0.2).
- `lib/bank/withdraw.service.ts:237-238, 406, 423, 450, 481, 489, 497, 675, 771`: số tiền lệnh rút vault.
- `lib/bank/payment-withdraw.service.ts:246, 450`: số tiền rút VNDB của Nhà đầu tư.
- `lib/bank/distribution.service.ts:299, 497-500, 540, 800-802, 1220-1223, 1402, 1456`: số tiền kỳ chia, lô chia.
- `lib/bank/distribution-trigger.service.ts:325-326, 348`: câu keeper.
- `lib/bank/mint.service.ts:235`, `lib/bank/demo-payment.service.ts:88`: dòng sổ phát hành thử, nạp VNDB.
