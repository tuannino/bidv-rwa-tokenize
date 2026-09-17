# Checkpoint FE-01 v2 — Kênh nhà đầu tư và trang tổng quan

| | |
|---|---|
| Nhánh | `feat/investor-channel-v2`, tạo **từ `dev`** @ `5982a4e` |
| Spec | `.kiro/specs/fe-01-investor-channel-v2/` (bản giao của Owner ở `docs/fe-01-investor-channel-v2/`) |
| Phương án | **C** — spec tự chứa trên `dev`, hút phạm vi v1, KHÔNG lấy nền từ `feat/investor-channel` |
| Kiểm chứng | `run-local-all.sh` **6/6 PASS · 0 FAIL** · e2e **21/21** · vitest **50** · hardhat **67** |

---

## 0. Vì sao là phương án C

`docs/fe-01-investor-channel-v2/tasks.md` mở đầu bằng điều kiện chặn: nhánh tạo từ `dev` **sau khi
FE-01 v1 đã merge**, chưa merge thì dừng và báo. Đã kiểm và báo Owner:

```
git merge-base --is-ancestor origin/feat/investor-channel origin/dev  -> v1 CHƯA merge
git rev-list --count origin/dev..origin/feat/investor-channel         -> 9
git diff --stat origin/dev...origin/feat/investor-channel             -> 24 files, +1875/-47
```

Owner chốt **C**. Năm task trong bản giao không thực hiện được nguyên văn, đã đổi thành "tạo mới"
hoặc bỏ — chi tiết ở `.kiro/specs/fe-01-investor-channel-v2/requirements.md` §0.

`dev` lành, dùng làm nền được:

```
git ls-tree -r --name-only dev | grep -c '^packages/'            -> > 0
git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger'   -> > 0
git ls-tree -r --name-only dev | grep -c AssetRegistry           -> 0
```

---

## 1. Kết quả chạy

### `bash scripts/run-local-all.sh`

```
########## TỔNG KẾT ##########
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
```

Chi tiết: hardhat `67 passing`, cargo `48 passed / 0 failed`, typecheck sạch, eslint
`0 errors, 1 warning` (`src/empty.ts` — nợ P2 có từ trước), vitest `50 passed (50)`
(38 cũ + 12 mới cho `portfolio.service`).

Lần chạy đầu FAIL mục contract EVM với `Error HHE22: Trying to use a non-local installation of
Hardhat`. **Không phải lỗi mã**: `packages/contracts-evm/node_modules` chưa được cài trong máy này.
Sau `npm ci` trong package đó thì 67 passing. Nêu ra vì người nghiệm thu có thể gặp lại.

### `npx playwright test`

```
Running 21 tests using 1 worker
  ✓ chain-selector.spec.ts        2 ca  (có sẵn, không đổi)
  ✓ investor-channel.spec.ts     16 ca  (mới)
  ✓ mint.spec.ts                  3 ca  (có sẵn, không đổi)
  21 passed (16.6s)
```

### Bảng hành vi thật — 4 vai × 2 kênh

Đo bằng e2e (cookie `bidv_channel` + `bidv_role`), không phải suy từ mã:

| vai | `/portfolio` (kênh nhà đầu tư) | `/mint` (kênh ngân hàng) | `/audit` |
|---|---|---|---|
| INVESTOR | ✅ vào được | ✅ **bị chặn** | ✅ bị chặn |
| BANK_ADMIN | ✅ **bị chặn** | ✅ vào được | ✅ vào được |
| COMPLIANCE | ✅ **bị chặn** | ✅ vào được | ✅ vào được |
| AUDITOR | ✅ **bị chặn** | ✅ bị chặn | ✅ vào được |

Cả ba vai ngân hàng bị chặn khỏi kênh nhà đầu tư — **đây là DoD mà FE-01 v1 không đạt được** và
phải để một test ở dạng `test.fixme`. v2 không còn test `fixme` nào.

### Bảng nguồn dữ liệu từng hộp

| Hộp | Số liệu | Nguồn | Nhãn |
|---|---|---|---|
| Tài sản đã đầu tư | số dư WPT | `ILedgerPort.balanceOf` | `on-chain` |
| | giá trị quy đổi | số dư × giá phát hành (`issuance.ts`) | ghi rõ "theo giá phát hành" |
| | trạng thái KYC / đóng băng | `ILedgerPort.isWhitelisted` / `isFrozen` | `on-chain` |
| | số dư VNDB | **ẩn** — chưa có phương thức đọc | nêu tường minh là chờ BE-01 |
| Trạng thái phát hành | ký hiệu, tổng cung | `ILedgerPort.tokenInfo` | `on-chain` |
| | giá phát hành | hằng cấu hình | ghi rõ không phải giá thị trường |
| | tên dự án, trạng thái vận hành | `MOCK_PROJECTS` | **dữ liệu mẫu** |
| Giao dịch gần đây | danh sách | `ITxnStore.listTxns` lọc theo ví | `on-chain` |
| Danh sách token | 3 dự án | `MOCK_PROJECTS` | **dữ liệu mẫu** (trừ dự án `onChain`) |
| | số nhà đầu tư nắm giữ | `MOCK_WIND_STATS` | **dữ liệu mẫu** |

Không con số nào trộn thật với mẫu. Cặp *thật × tham số cấu hình* (số dư × giá phát hành) được ghi
nhãn theo bản chất, không gọi là định giá.

### 3 LUẬT kiến trúc

```
LUẬT 1  viem/ethers ngoài lib/          -> 0 kết quả
LUẬT 2  SERVER_SIGNER_PRIVATE_KEY       -> đúng 2 file: lib/signer/server.signer.ts, lib/config/env.ts
LUẬT 3  so sánh role cứng ngoài rbac    -> 0 kết quả
lib/bank/ đọc cookie kênh               -> 0 kết quả (đúng: kênh không phải cơ sở phân quyền)
```

---

## 2. Đối chiếu DoD

| DoD | Đạt? | Ghi chú |
|---|:--:|---|
| Bộ chọn kênh 2 lựa chọn, điều hướng đúng, lưu qua lần tải | ✅ | cookie `bidv_channel`; e2e 2 ca |
| Bộ chọn vai chỉ ở Admin console, còn 3 vai ngân hàng | ✅ | e2e kiểm `option` = 3 và không còn "Nhà đầu tư" |
| Giao diện hiển thị đúng vai đang có hiệu lực | ✅ | `publicConfig()` đọc cookie; e2e kiểm sidebar in `vai trò BANK_ADMIN` |
| Ba vai ngân hàng đều bị chặn khỏi `/portfolio` | ✅ | 3 ca e2e + 12 ca unit |
| Chỉ INVESTOR có `portfolio:read` | ✅ | `rbac.test.ts` 2 ca mới |
| Menu kênh ngân hàng giữ nguyên 6 mục | ✅ | đối chiếu máy `(href,label,shortcut)` với `dev`: **giống hệt 6/6** |
| Không trùng đường dẫn giữa ba kênh | ✅ | đối chiếu máy sau khi bóc route group: không trùng |
| Trang tổng quan đủ 4 hộp | ✅ | e2e kiểm 4 tiêu đề |
| Số dư WPT đọc từ chuỗi | ✅ | unit: mint 250 → `balance === '250'`, `totalSupply === '250'` |
| Lịch sử chỉ của ví được yêu cầu | ✅ | unit: 2 ví, ví A không thấy giao dịch ví B |
| Mọi số liệu mẫu có nhãn | ✅ | `MockBadge` dùng chung; e2e kiểm có nhãn |
| Chi tiết mở được từ danh sách; mã sai → không tìm thấy | ✅ | e2e: click → `/tokens/WPT-QTR3`; mã sai → **404** |
| `run-local-all.sh` xanh toàn bộ | ✅ | 6/6 PASS |
| Nợ P1 về quyền vào kênh đã xóa khỏi báo cáo | — | **không áp dụng**: nợ đó do v1 thêm, `dev` chưa có (0 lần `balance:read` trong `tech-report.md`) |

---

## 3. Cách chạy

```bash
cd app
npm run dev                      # rồi đổi kênh ở thanh trên
npx playwright test              # 21/21
npm test                         # 50/50
cd .. && bash scripts/run-local-all.sh
```

Kiểm số dư đọc thật từ chuỗi: ở kênh Admin console mint thêm WPT cho một ví, đổi sang kênh nhà đầu
tư với ví đó đang kết nối, tải lại `/portfolio` — số dư phải tăng đúng.

---

## 4. DEVIATION so với bản giao của Owner

1. **Phương án C** — đã nêu ở §0, Owner chốt.
2. **Hộp đổi tên `market-status-box` → `issuance-status-box`.** Bản giao gọi là "trạng thái thị
   trường", nhưng chính bản giao (`design.md` §4) cấm hiển thị giá giao dịch vì chưa có thị trường
   thứ cấp. Giữ tên "thị trường" cho một hộp không có số liệu thị trường là mời người xem hiểu sai.
3. **Giá phát hành đặt ở `lib/bank/issuance.ts`, không ở `mock-data.ts`.** Bản giao xếp nó vào cột
   "cấu hình" nhưng không nói đặt đâu. Đặt vào `mock-data.ts` sẽ buộc gắn nhãn "dữ liệu mẫu", và khi
   đó `số dư thật × giá` thành *thật × mẫu*, vi phạm chính quy tắc R9.3 của bản giao.
4. **Thêm hai trường `tokenSymbol`, `onChain` vào `WindProject`.** Cần để route `/tokens/[symbol]`
   hoạt động và để phân biệt dự án đã lên chuỗi. Vẫn **một** nguồn dữ liệu, không tạo nguồn thứ hai.
5. **Không tạo trang chỗ trống cho `/purchase`, `/earnings`, `/settlement`.** Mục nav `disabled`
   không bọc `Link` nên không điều hướng được; tạo trang là tạo mã chết.
6. **`publicConfig()` chuyển sang async và đọc cookie** — ngoài phạm vi bản giao nhưng bắt buộc:
   xem §6.1.
7. **Tách `authorize()`/`toResult()` sang `lib/bank/authorize.ts`.** Bản giao nói kiểm quyền trong
   service nhưng không nói tách; sao chép sẽ tạo hai đường ghi audit song song.
8. **Thêm `role="heading" aria-level={2}`** cho tiêu đề các hộp. `CardTitle` của UI kit là `<div>`
   nên mục không có ngữ nghĩa heading. Chỉ thêm ở component mới, không đổi primitive dùng chung.

---

## 5. Câu hỏi mở

### Câu hỏi 1 (P1) — không ràng buộc được ví với phiên

Bản giao (`design.md` §6) yêu cầu "truyền ví khác vào cũng chỉ trả về của ví đang ở phiên".
**Hiện không làm được:** chưa có SIWE nên server không biết ví nào thuộc phiên; ví chỉ tồn tại ở
client qua wagmi. Chính bản giao đã xếp "xác thực bằng chữ ký ví" vào phạm vi AU-01.

Đã làm: service **luôn** lọc theo ví được yêu cầu và `wallet` là **bắt buộc** trong schema, nên
danh sách trả về không bao giờ lẫn giao dịch của ví khác (có test). Chưa làm được: chặn người dùng
*chủ động* tra ví khác.

**Đề nghị Owner xác nhận** cách hiểu này đủ cho FE-01 v2, và ghi ràng buộc ví ↔ phiên vào AU-01.

### Câu hỏi 2 (P2) — giá phát hành

`WPT_ISSUE_PRICE_VND = 100_000` là con số tôi tự chọn để luồng chạy được. Đây là **điều khoản
phát hành**, cần Owner cho số đúng theo nghiệp vụ. Nếu Owner muốn hiển thị giá thị trường thì phải
có thị trường thứ cấp — ngoài phạm vi.

### Câu hỏi 3 (P2) — số dư VNDB chờ BE-01

`ILedgerPort` chưa có phương thức đọc số dư token thanh toán. Đang **ẩn** phần này kèm câu giải
thích trên giao diện, thay vì hiện 0. Repo đã có `docs/be-01-ledger-port/` — đề nghị Owner xác nhận
BE-01 sẽ bổ sung phương thức đó, rồi FE gắn vào sau.

---

## 6. Sai lệch phát hiện được

### 6.1. `publicConfig()` trả vai từ env, không từ cookie

`flags.ts` trả `role: env.demoRole` — giá trị mặc định lúc khởi động. Hệ quả trên `dev`: đổi vai
xong `RoleSwitcher` vẫn hiển thị vai cũ, và `can(config.role, 'token:mint')` trong `mint.tsx` gate
sai nút. Là lỗi hiển thị, không phải lỗ hổng (chốt chặn thật ở `assertCan()` trong service), nhưng
bộ chọn kênh dùng cùng đường dữ liệu nên **buộc phải sửa** trong task này.

**Hệ quả có chủ ý cần Supervisor biết:** đọc cookie trong root layout làm cả cây thành động — `/` và
`/_not-found` chuyển từ `○` (tĩnh) sang `ƒ` (server-rendered on demand). Không tránh được nếu layout
phải biết vai/kênh; các trang khác vốn đã là `ƒ`.

### 6.2. Ma trận quyền trong `tech-report.md` 3.3 ghi sai tên action

Ghi `investor:kyc` và `token:whitelist`; tên thật trong `ACTIONS` là `kyc:approve` và
`investor:whitelist`. Dòng mô tả cũng ghi "4 role × 11 action" khi thực tế lúc đó là **10**. Đã sửa
thành bảng đủ 11 action với tên đúng theo mã nguồn.

### 6.3. Nợ P2 "Build Cloudflare fail ENOENT" đã được xử lý nhưng còn trong bảng

PR #12 (đã merge vào `dev`) đã xử lý bằng `app/scripts/flatten-standalone.mjs` + script `cf:build`.
Theo `tech-report-maintenance.md` §8 việc xóa nợ do Supervisor quyết, nên tôi **chỉ gạch ngang và
ghi chú**, không xóa. Đề nghị Supervisor xác nhận rồi xóa dòng.

Dòng nợ P2 kế tiếp ("1 cảnh báo lint ở `src/empty.ts`") ghi hướng xử lý là "sửa cùng lúc với việc gỡ
blocker `next.config.ts`" — blocker đó không còn, nên hướng xử lý này đã lỗi thời.

### 6.4. Lệnh kiểm ký hiệu token cũ cho kết quả dương tính giả

`tech-report-maintenance.md` §5 dùng `grep -rniE "\bSPT\b|tVND"` và yêu cầu rỗng. Thực tế cho **9**
kết quả, tất cả là định danh `profitVndBn` (chuỗi `profi`**`tVndB`**`n` khớp `tVND` vì pattern thiếu
ranh giới từ ở nhánh thứ hai). Đã có sẵn trên `dev` (8 chỗ trong `mock-data.ts`), không phải hồi quy
do task này.

Với pattern đúng `\bSPT\b|\btVND\b` thì **0 kết quả**. Đề nghị sửa lệnh trong tài liệu quy tắc.

### 6.5. Lint chặn `setState` đồng bộ trong effect

`react-hooks/set-state-in-effect` báo lỗi (không phải cảnh báo) với mẫu reset state ngay trong thân
`useEffect`. Đã đổi sang một ô state mang **khoá** của lần tải sinh ra nó, nên "đang tải" là thứ suy
ra chứ không phải state phải tự tay dọn. Ghi lại vì mẫu cũ rất phổ biến và sẽ còn gặp ở FE-02/05.

---

## 7. Hai lỗi đã mất thời gian truy, ghi lại để không lặp

### 7.1. `redirect()` thay vì `router.push` khi đổi kênh

Bản đầu để client `router.push` sau khi `await setChannel`. Hướng nhà đầu tư → Admin console không
điều hướng: đổi kênh làm vai mất `portfolio:read`, `ChannelGuard` kết xuất màn từ chối, mà màn đó
**không bọc `AppLayout`** → `Header` (chứa bộ chọn kênh đang giữ transition) bị unmount, và `push`
trong transition đã unmount thì mất. Đã chuyển điều hướng vào server action bằng `redirect()`.

### 7.2. E2E phải chờ hydrate trước khi tương tác

`selectOption` chạy trước khi hydrate xong: ô chọn đổi giá trị hiển thị mà **không có POST server
action nào**, cookie không đổi, test đỏ với thông báo trỏ về điều hướng. Chỉ phát hiện được khi bắt
POST ở tầng mạng. Đã thêm `waitForHydration()` dùng nút đổi theme (chỉ render sau mount) làm mốc.

Kèm một cái bẫy môi trường: máy có `http_proxy` thì phép kiểm "server sẵn sàng" của Playwright đi
qua proxy và không tới được localhost → báo `Timed out waiting 120000ms from config.webServer` dù
`next dev` lên trong ~0.2s. Đã đặt `NO_PROXY` trong `playwright.config.ts`.

---

## 8. Mục đã cập nhật trong `tech-report.md`

Metadata (1.4) · bảng kênh 1.1 (thêm cột quyền vào kênh + mô hình kênh tường minh) · cây thư mục 1.4
· 1.6.B (7 quyết định thiết kế mới) · 1.6.C (ghi chú nợ Cloudflare đã xử lý) · 3.3 (ma trận đủ 11
action, sửa tên sai, cảnh báo bẫy `READ_ONLY`) · 3.4 (thêm `authorize.ts`, `portfolio.service.ts`,
`issuance.ts` + 3 lưu ý).

## 9. Việc chưa làm, có chủ ý

- `docs/be-01-ledger-port/`, `be-02-purchase-orders/`, `be-08-rbac-actions/`,
  `be-09-data-schema/` mới xuất hiện trong thư mục làm việc nhưng **chưa commit** — không thuộc task
  này, chờ Owner chỉ định.
- Ba file `.zip` bản giao spec không commit (chỉ là vỏ đóng gói); bản giải nén đã commit.
