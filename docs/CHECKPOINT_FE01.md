# Checkpoint FE-01 — Kênh giao diện nhà đầu tư

| | |
|---|---|
| Nhánh | `feat/investor-channel`, tạo **từ `dev`** @ `5982a4e` |
| Spec | `.kiro/specs/fe-01-investor-channel/` (bản bàn giao ở `docs/20260914_spec_FE01_FE02/`) |
| Trạng thái | ✅ 6/7 điều kiện hoàn thành đạt · ⛔ **1 điều kiện bất khả thi theo spec hiện tại** (R4.2, xem mục 4) |
| Kiểm chứng | `run-local-all.sh` 6/6 PASS · e2e 9 pass + 1 `fixme` |

## 0. Rà soát `dev` trước khi mở nhánh

Theo `branching.md` §4 và §5:

```
git fetch origin && git pull --ff-only          → 0 behind / 0 ahead
git log --oneline -1 origin/dev                 → 5982a4e Merge pull request #12 ...
packages/                                       → 71 file
app/src/lib/ledger                              → 6 file
app/src/lib/rbac                                → 4 file
docker-compose.yml                              → có
AssetRegistry.sol                               → 0 (đúng, đã xoá)
```

`dev` **lành**, dùng làm nền được. Hai nhánh trước (`test/spec-pack-p4-p7-p12`,
`docs/branching-rules-alignment`) đã merge vào `dev`, và `dev` có thêm PR #12 (Cloudflare/OpenNext).

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

Chi tiết: hardhat `67 passing`, cargo `48 passed / 0 failed`, vitest `36 passed (36)`,
typecheck sạch, eslint `0 errors, 1 warning` (`src/empty.ts`, nợ P2 có từ trước).

### `npm run test:e2e`

```
Running 10 tests using 1 worker
  ✓   1 chain-selector.spec.ts:12 › dropdown chain có đúng các chain đã chốt, KHÔNG có Polygon (668ms)
  ✓   2 chain-selector.spec.ts:28 › đổi chain rồi mint vẫn chạy, và số dư tính theo từng chain (685ms)
  ✓   3 investor-channel.spec.ts:18 › vai INVESTOR vào được kênh và thấy menu nghiệp vụ nhà đầu tư (359ms)
  ✓   4 investor-channel.spec.ts:43 › mục menu chưa khả dụng thì không điều hướng được (308ms)
  ✓   5 investor-channel.spec.ts:53 › vai INVESTOR không vào được kênh ngân hàng (292ms)
  ✓   6 investor-channel.spec.ts:61 › menu kênh ngân hàng KHÔNG chứa mục của kênh nhà đầu tư (322ms)
  -   7 investor-channel.spec.ts:90 › vai BANK_ADMIN không vào được kênh nhà đầu tư
  ✓   8 mint.spec.ts:15 › KYC + whitelist rồi mint 100 WPT thì số dư thành 100 (539ms)
  ✓   9 mint.spec.ts:47 › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng (443ms)
  ✓  10 mint.spec.ts:58 › vai trò AUDITOR không vào được kênh ngân hàng (528ms)
  1 skipped
  9 passed (8.5s)
```

Baseline trước khi sửa: `5 passed`. Sau khi sửa: 5 test cũ **vẫn xanh nguyên**, thêm 4 test mới xanh
và 1 test `fixme` (mục 4).

### Hành vi thật của guard (đo trực tiếp trên dev server, cookie `bidv_role`)

Thay cho ảnh chụp — đây là dữ liệu kiểm được, không phụ thuộc người đọc:

| vai | `/portfolio` (kênh nhà đầu tư) | `/mint` (kênh ngân hàng) |
|---|---|---|
| INVESTOR | ✅ vào được, thấy "Tổng quan nhà đầu tư" | ✅ **bị chặn** — "Không có quyền vào kênh Ngân hàng", nêu `token:mint, investor:whitelist` |
| BANK_ADMIN | ❌ **vào được** (spec đòi chặn) | ✅ vào được |
| COMPLIANCE | ❌ **vào được** (spec đòi chặn) | ✅ vào được |
| AUDITOR | ⚠️ vào được (`design.md` QĐ-1 đã lường trước) | ✅ bị chặn |

Menu theo kênh, đo trên cùng dev server:

| vai | nhóm menu | mục |
|---|---|---|
| INVESTOR | "Nghiệp vụ nhà đầu tư" | Tổng quan · Mua WPT · Lợi nhuận · Tất toán |
| BANK_ADMIN | "Module nghiệp vụ" | Tổng quan · Phát hành WPT · Dự án điện gió · Đối soát doanh thu · Nhà đầu tư & KYC · Sổ kiểm toán |

Không lẫn menu giữa hai kênh (R4.1 và phần menu của R4.2 đều đạt, có test số 3 và 6).

### Menu kênh ngân hàng không đổi một ký tự (điều kiện hoàn thành)

So khớp máy giữa `dev:sidebar.tsx` và `HEAD:nav-config.ts` theo `(href, label, shortcut)`:

```
dev  (sidebar.tsx):            HEAD (BANK_NAV):
  ('/', 'Tổng quan', 'E')        ('/', 'Tổng quan', 'E')
  ('/mint', 'Phát hành WPT', 'M')          ... trùng khớp toàn bộ 6 mục ...
  ('/assets', 'Dự án điện gió', 'D')
  ('/reconciliation', 'Đối soát doanh thu', 'B')
  ('/kyc', 'Nhà đầu tư & KYC', 'A')
  ('/audit', 'Sổ kiểm toán', 'K')
=> GIỐNG HỆT
```

### Không trùng đường dẫn giữa ba kênh (task 4.3)

```
/  /assets  /audit  /earnings  /kyc  /mint  /portfolio  /purchase  /reconciliation  /settlement
uniq -d → (không trùng)
```

### Không đụng file bị cấm sửa

```
git diff --name-only dev...HEAD -- app/src/components/layout/channel-guard.tsx app/src/lib/rbac/
→ (rỗng)
```
`permissions.ts` không thêm quyền nào.

## 2. Việc đã làm

| Commit | Bước | Nội dung |
|---|---|---|
| `3c45c3c` | — | Nhận spec FE-01 + FE-02 vào `.kiro/specs/` |
| `7de332a` | 1 | Tách `nav-config.ts`, `Sidebar` nhận `nav` qua props, `AppLayout` mặc định `BANK_NAV` |
| `8a02e21` | 2 | Cờ `disabled`: không bọc `Link`, hiển thị mờ, `aria-disabled`, chú thích "sắp có" |
| `1ccfde9` | 3 | `INVESTOR_NAV` theo bảng `design.md` mục 4 |
| `ad45147` | 4 | Route group `(client)`: layout + guard + 4 trang chỗ trống |
| `dd02c1c` | 5 | Đổi vai thì điều hướng về trang mặc định của kênh |
| `420664b` | 6 | `app/e2e/investor-channel.spec.ts` |
| `7b63f8c` | 7 | Cập nhật `tech-report.md` |

## 3. Lỗi tuần tự hóa đã gặp và cách xử lý

`design.md` mục 7 cảnh báo `icon` là hàm có thể vướng tuần tự hóa. **Đã xảy ra thật**, không phải
rủi ro lý thuyết — vì `AppLayout` được dùng *bên trong từng page* và các page đó là Server
Component, nên `NavSection` bắt buộc đi qua biên server → client:

```
⨯ Error: Functions cannot be passed directly to Client Components unless you explicitly
  expose it by marking it with "use server".
  {$$typeof: ..., render: function UserCheck}
                          ^^^^^^^^^^^^^^^^^^
Error: Timed out waiting 120000ms from config.webServer.
```

Đã xử lý theo cách `design.md` mục 7 **ưu tiên**: `NavItem.icon` là tên biểu tượng dạng chuỗi
(`NavIconName`), tra sang component qua bảng `NAV_ICONS` đặt trong `sidebar.tsx` (phía client).
`nav-config.ts` nhờ đó là dữ liệu thuần, không import component nào.

Không chọn cách "đặt `use client` ở `nav-config.ts`" vì nó không giải quyết gốc vấn đề: prop vẫn
phải tuần tự hóa khi qua biên, và nó buộc `AppLayout` thành Client Component — mất khả năng render
phía server của mọi trang đang dùng.

Đã thêm dòng bài học vào `tech-report.md` 1.6.A.

## 4. ⛔ Câu hỏi mở

### Câu hỏi 1 (P0) — R4.2 và R2.4 loại trừ nhau, không thể cùng đạt

**Yêu cầu mâu thuẫn:**
- R2.1: quyền vào kênh là `balance:read`.
- R4.2 + điều kiện hoàn thành + task 6.4: vai ngân hàng vào `/portfolio` **phải bị chặn**.
- R2.4 + "Việc KHÔNG được làm": **cấm** thêm quyền mới vào `permissions.ts`.

**Bằng chứng từ mã nguồn** (`app/src/lib/rbac/permissions.ts`):

```ts
const READ_ONLY: Action[] = ['balance:read', 'txn:read', 'audit:read'];

BANK_ADMIN: [ ...(đặc quyền), ...READ_ONLY ],
COMPLIANCE: [ 'investor:whitelist', 'kyc:approve', 'token:freeze', ...READ_ONLY ],
INVESTOR:   [ 'token:transfer', 'balance:read', 'txn:read' ],
AUDITOR:    [ ...READ_ONLY ],
```

`balance:read` có ở **cả bốn** vai. Nên `requireAny={['balance:read']}` **không chặn được ai**.
Đã đo thực tế, xem bảng ở mục 1.

`design.md` QĐ-1 chỉ lường trước phần AUDITOR ("`balance:read` và `txn:read` thuộc nhóm chỉ đọc
nên AUDITOR cũng có") mà **bỏ sót BANK_ADMIN và COMPLIANCE** — hai vai này cũng spread `READ_ONLY`.

**Hai cách hiểu:**
- **A —** R4.2 là yêu cầu thật, nghĩa là FE-01 buộc phải thêm quyền, và R2.4 viết quá chặt.
- **B —** R2.4 là ràng buộc thật, nghĩa là R4.2 chưa làm được ở FE-01 và phải hoãn sang task có
  quyền sửa RBAC.

**Đề xuất: A**, và cách sửa nhỏ nhất là thêm một action `portfolio:read` chỉ cấp cho `INVESTOR`,
rồi đổi guard thành `requireAny={['portfolio:read']}`. Ba dòng trong `permissions.ts`, không đụng
`can.ts` hay `channel-guard.tsx`. Mình **chưa làm** vì tasks.md cấm tường minh.

Nếu Owner chọn **B** thì cần xác nhận: vai ngân hàng và kiểm toán vào được kênh nhà đầu tư là
**chấp nhận được tạm thời**, và bỏ dòng R4.2 khỏi điều kiện hoàn thành để DoD nhất quán.

**Trạng thái hiện tại:** đã cài đúng theo R2.1 (`balance:read`), giữ test theo dõi ở dạng
`test.fixme` trong `app/e2e/investor-channel.spec.ts` để yêu cầu không mất dấu, và ghi nợ P1 vào
`tech-report.md` 1.6.C. Bỏ `fixme` ngay khi Owner chốt.

### Câu hỏi 2 (P2) — AUDITOR vào kênh nhà đầu tư

`design.md` QĐ-1 đã nói "chấp nhận được ở giai đoạn này". Ghi lại ở đây để Owner xác nhận thành
văn, vì nó cùng gốc với câu hỏi 1: nếu chọn phương án A thì AUDITOR **cũng** bị chặn luôn, giải
quyết cả hai trong một lần.

## 5. DEVIATION

1. **Gộp bước 2 và 3 thành hai commit nhưng theo thứ tự đảo ngược ý nghĩa.** Không đảo — đã tách
   đúng ba commit `7de332a` / `8a02e21` / `1ccfde9`. Ban đầu mình commit gộp cả ba, phát hiện lệch
   `tasks.md` nên đã `git reset` và dựng lại lịch sử thành ba commit trước khi push. Nêu ra để
   Supervisor biết lịch sử đã được viết lại (nhánh **chưa** từng push nên không ảnh hưởng ai).
2. **`icon` là chuỗi, không phải `LucideIcon`** như `design.md` mục 3 khai. Đây là nhánh mà chính
   `design.md` mục 7 chỉ định khi gặp lỗi tuần tự hóa. Xem mục 3.
3. **`CHANNEL_HOME` xử lý cả bốn vai, không chỉ INVESTOR.** R5.2 chỉ đòi INVESTOR về trang mặc
   định. Nhưng nếu chỉ làm INVESTOR thì đổi từ INVESTOR sang AUDITOR vẫn đứng ở `/portfolio` và
   rơi vào màn từ chối — đúng thứ R5.2 muốn tránh. Làm cả bốn vai để hành vi nhất quán, vẫn trong
   phạm vi `role-switcher.tsx` mà `design.md` mục 2 cho phép sửa.
4. **Bốn trang chỗ trống đều dùng `AppLayout` với `nav={INVESTOR_NAV}`.** `design.md` mục 2 đặt
   `AppLayout` ở layout của group, nhưng mã hiện có đặt `AppLayout` ở **từng page** (`(admin)` và
   `(audit)` đều vậy). Mình theo hiện trạng để giữ đúng cách viết của repo. Hệ quả: `layout.tsx`
   của `(client)` chỉ chứa `ChannelGuard`, giống hệt `(admin)/layout.tsx` và `(audit)/layout.tsx`.
5. **Thêm 2 test ngoài danh sách task 6.2–6.5:** một ca kiểm mục `disabled` không điều hướng được,
   một ca kiểm chiều ngược của phân tách menu. Không thay thế ca nào.

## 6. Sai lệch phát hiện được

### 6.1. `design.md` QĐ-1 phân tích thiếu hai vai

Đã nêu ở câu hỏi 1. Đây là gốc của việc DoD không đạt được, nên đáng sửa vào spec chứ không chỉ
sửa mã.

### 6.2. `tech-report.md` mô tả kênh `(client)` như đã tồn tại từ trước

Bảng ở mục 1.1 trên `dev` đã liệt kê `| Nhà đầu tư | (client) | INVESTOR | Xem số dư, nhận lợi
tức, hoàn vốn |` trong khi thư mục `(client)` **chưa hề có**. Tài liệu mô tả thứ chưa tồn tại —
đúng loại lỗi mà `tech-report-maintenance.md` mục 5 dặn phải tránh. Đã sửa thành bảng phản ánh
đúng hiện trạng, kèm cột quyền vào kênh và cảnh báo về cổng quyền.

### 6.3. `design.md` mục 2 lệch với cách repo đặt `AppLayout`

Xem deviation 4. Không phải lỗi nghiêm trọng nhưng nên sửa spec cho khớp, tránh người sau làm
FE-04/05/09/11 đặt `AppLayout` vào layout rồi lồng hai lần.

### 6.4. `tasks.md` bước 5.1 giả định `role-switcher` có thể thiếu INVESTOR

Thực tế đã có sẵn trong `LABELS` và `ROLES`. Bước 5 chỉ còn phần R5.2 (điều hướng) là việc thật.

## 7. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Chain qua `ILedgerPort`** — FE-01 không thêm lời gọi chain nào. `verify-arch-rules.sh` PASS.
- [x] **Ký qua `ISigner`** — không chạm tầng ký.
- [x] **Quyền qua RBAC `can()`** — kênh mới dùng `ChannelGuard` → `can(role, action)`. Không thêm
      so sánh role cứng; script lớp 3 PASS mục "Không có so sánh role cứng ngoài lib/rbac".
- [x] **Kênh `(client)` không gọi hàm đặc quyền** (R4.3) — bốn trang chỗ trống chỉ render tĩnh,
      không import `actions/bank.ts` hay `lib/bank/`.
