# Báo cáo bàn giao — MC-01: Make Control (điểm cắm, dọn rác, nền cho sơ đồ luồng)

| | |
|---|---|
| Task | MC-01 (Make Control, P0, 8 điểm) |
| Nhánh | `mc/01-make-control`, tạo **từ `dev`** (`71932bb`) |
| Spec | `docs/mc-01-make-control/{requirements,design,tasks}.md` + bản ở `.kiro/specs/mc-01-make-control/` (xem sai lệch SL-1 ở mục 7) |
| Tiến độ | **Bước 1–6/10 xong.** Bước 7–10 chưa làm |
| Phạm vi | Không đổi hành vi hệ thống, **trừ một ngoại lệ Owner đã chốt** (D-7 ở mục 9). Mọi test đang xanh phải xanh nguyên |

`dev` đã kiểm lành trước khi tạo nhánh, theo `branching.md` §5:

```
$ git ls-tree -r --name-only dev | grep -c '^packages/'           → 73   (phải > 0)
$ git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger'  → 6    (phải > 0)
$ git ls-tree -r --name-only dev | grep -c AssetRegistry          → 0    (phải = 0)
```

Nền của nhánh đúng là `dev`, không lấy từ nhánh phụ:

```
$ git merge-base dev HEAD
71932bbbcd27811b202e98487cc55b7bf6878619
$ git merge-base --is-ancestor dev HEAD   → 0 (HEAD chứa toàn bộ dev)
```

---

## 1. Đã làm

### Bước 1 — Chốt quy ước và nguồn trạng thái task ✅

Ba commit, chia theo đơn vị mục tiêu:

| Commit | Nội dung |
|---|---|
| `350fdfb` | `docs(mc): spec MC-01 make control (requirements, design, tasks)` — đưa spec vào lịch sử nhánh, cả `docs/` và `.kiro/specs/` |
| `cefc895` | `feat(mc): quy ước marker điểm cắm và nguồn trạng thái task` — steering + JSON trạng thái |
| *(commit này)* | `docs(mc): khung checkpoint MC-01` |

Tệp tạo mới:

| Tệp | Vai trò |
|---|---|
| `docs/mc-01-make-control/{requirements,design,tasks}.md` | Spec, bản đọc cho người |
| `.kiro/specs/mc-01-make-control/{requirements,design,tasks}.md` | Spec, bản Kiro nạp |
| `.kiro/steering/make-control.md` | Quy ước `@pending` / `@blocked` / `@flow`, `inclusion: always` |
| `.kiro/task-status.json` | Nguồn duy nhất trạng thái task + tập mã task hợp lệ |
| `docs/CHECKPOINT_MC01.md` | Tệp này |

Nội dung steering trả lời ba câu bắt buộc: marker viết thế nào (mục 1, 2, 4), ai cập nhật
`task-status.json` (mục 7 — Kiro), cập nhật lúc nào (mục 7 — commit cuối của mỗi task, cùng lúc
với `docs/tech-report.md`).

### Bước 2 — Script quét marker ✅

Ba commit, chia theo đơn vị mục tiêu:

| Commit | Nội dung |
|---|---|
| `c84ec7f` | `chore(mc): thêm mã task SC-04 và bỏ tasks.meta.json khỏi git` — thi hành hai quyết định của Owner (xem mục 11, Q1 và Q2) |
| `609deb8` | `feat(mc): script quét điểm cắm` — `scripts/scan-pending.mjs`, ba chế độ |
| *(commit này)* | `feat(mc): run-local-all gọi scan-pending --check` — cắm vào kiểm chứng cục bộ + checkpoint |

Tệp tạo mới / sửa:

| Tệp | Vai trò |
|---|---|
| `scripts/scan-pending.mjs` | Quét marker. Ba chế độ: bảng cho người đọc, `--json`, `--check` |
| `scripts/run-local-all.sh` | Thêm mục `LỚP 3 - ĐIỂM CẮM (marker)`; in bảng ở phần TỔNG KẾT |
| `.kiro/task-status.json` | Thêm `SC-04` vào `planned` → 26 mã task hợp lệ |
| `.gitignore` | Bỏ `.kiro/specs/*/tasks.meta.json` khỏi git |

Script là **nơi duy nhất** khai cú pháp marker và phép kiểm số bước luồng. Cả hai được
`export` để Bước 4 (`app/test/pending-markers.test.ts`) và Bước 9
(`scripts/gen-flow-diagram.mjs`) nhập vào dùng lại, không viết lại biểu thức chính quy.

`SC-04` (mới thêm) = *hợp đồng cờ tất toán + giá NAV*: quyết định cờ "đang tất toán" nằm ở
contract nào và `navRate` nối vào đâu. Bước 2 **chỉ thêm mã vào JSON**, chưa gắn marker —
việc gắn `@blocked SC-04` cho bốn method `setSettlementMode` / `isSettlementMode` /
`setNavRate` / `navRate` thuộc Bước 3.

### Bước 3 — Chuyển marker tự do sang quy ước mới ✅

Hai commit mã nguồn, chia theo **vùng**:

| Commit | Nội dung |
|---|---|
| `4e20eae` | `refactor(mc): marker điểm chặn cho 11 method chưa nối được ở lib/ledger` — 11 `@blocked` chia **bốn** nhóm (SC-02 ×3, SC-03 ×3, BE-06 ×1, SC-04 ×4) |
| `d1d5c13` | `refactor(mc): marker điểm cắm expireStaleOrders, dọn ghi chú lạc hậu ở lib/bank` — 1 `@pending BE-07` + 1 ghi chú nhóm D viết lại |
| *(commit này)* | `docs(mc): chốt số đo Bước 3 và bảng điểm cắm vào checkpoint` |

Tệp sửa — **ba** tệp, và **chỉ bình luận**:

| Tệp | Sửa gì |
|---|---|
| `app/src/lib/ledger/evm.adapter.ts` | 11 marker `@blocked`; khối chú thích đầu tệp thôi liệt kê mã task |
| `app/src/lib/bank/purchase.service.ts` | 1 marker `@pending BE-07` trên `expireStaleOrders` |
| `app/src/lib/bank/portfolio.service.ts` | Viết lại ghi chú lạc hậu trong `PortfolioView` (nhóm D) |

**Điều bất ngờ nhất của Bước 3: số chỗ phải gắn marker ít hơn nhiều so với mọi con số
trong tài liệu.** Spec nói 33 tệp, Bước 1 đo 43 tệp / 115 dòng, thực tế phải gắn marker
**13 chỗ trên 2 tệp**. Số đo và cách phân loại ở mục 10, SL-3.

### Bước 4 — Test chống marker lạc hậu ✅

Ba commit, chia theo đơn vị mục tiêu:

| Commit | Nội dung |
|---|---|
| `1bcd62b` | `feat(mc): phép kiểm mô tả marker chung chung (VAGUE_NOTE)` — mã lỗi thứ 8 + `@typedef` cho cấu trúc báo cáo |
| `49768e1` | `test(mc): chống marker lạc hậu và sai định dạng` — `app/test/pending-markers.test.ts`, hai tầng |
| `b65c077` | `test(mc): kiểm "điểm cắm không phải lỗi" trên repo giả thay vì repo thật` — sửa một khẳng định rỗng ruột do chính `49768e1` thêm vào, xem SL-6 |

Tệp tạo mới / sửa:

| Tệp | Sửa gì |
|---|---|
| `app/test/pending-markers.test.ts` | **Mới.** 13 ca, hai tầng. 272 → 285 test, 11 → 12 tệp test |
| `scripts/scan-pending.mjs` | Mã lỗi `VAGUE_NOTE` + `vagueNoteReason()` + `@typedef` `Marker` / `FlowStep` / `MarkerError` / `ScanReport` |

**Không** sửa test cũ nào, **không** sửa marker thật nào để test dễ xanh. Bằng chứng: 12 marker
hiện có vẫn qua `--check` với `exit=0` sau khi thêm `VAGUE_NOTE` (mục 3.6), và `git diff` trên
`app/src` giữa `dd0fac0` và HEAD là **rỗng**.

#### Vì sao phải hai tầng, không phải một

| Tầng | Kiểm gì | Trả lời câu hỏi nào |
|---|---|---|
| **1** | `scan()` trên **repo thật**: 4 ca theo `design.md` mục 3, thêm một chốt chặn bắt mọi mã lỗi còn lại | *Repo hiện tại có marker sai không?* — đây là cái **chặn thật** |
| **2** | `scan(repoGia)` trên **repo giả** dựng trong `mkdtemp`: mỗi ca một đột biến, xác nhận đúng mã lỗi | *Phép kiểm ở tầng 1 có răng không?* |

Tầng 1 hiện **xanh**. Một test luôn xanh thì không phân biệt được "cơ chế đúng" với "cơ chế
không chạy" — nó xanh trong cả hai trường hợp. Tầng 2 dựng dữ liệu sai rồi đòi `scan()` phải
báo đúng mã lỗi, nên nó xanh **chỉ khi** phép kiểm thật sự hoạt động.

Tầng 1 còn một phép kiểm chống rỗng ruột riêng: *phạm vi quét đọc được mã nguồn thật, không
rỗng*. Không có nó thì `SCAN_ROOTS` lệch đường dẫn sẽ làm cả bốn ca xanh mà không kiểm gì — kiểu
hỏng tệ nhất, vì nó trông y như "repo sạch".

#### Cách test đọc `scripts/scan-pending.mjs`: `import` trực tiếp

Tài liệu giao việc lường hai đường: `import` trực tiếp, hoặc `spawnSync('node', [...'--json'])`
nếu Vite chặn tệp ngoài `app/`. **Đã chọn `import` trực tiếp**, vì đo thật thì Vite không chặn:

```
$ cd app && npx vitest --run test/__probe-import.test.ts     # tệp thăm dò, đã xóa
 ✓ test/__probe-import.test.ts (1 test) 21ms
```

`app/vitest.config.ts` không đặt `server.fs.allow`, và `scan-pending.mjs` là ESM thuần không phụ
thuộc gói ngoài nên Vite nạp được nguyên trạng. Chọn `import` hơn `spawnSync` vì ba lẽ:

1. `scan(repoRoot)` nhận tham số gốc repo, nên tầng 2 gọi thẳng vào hàm với repo giả. Qua CLI thì
   không có cờ nào truyền gốc repo — muốn dùng `spawnSync` phải **thêm cờ mới vào CLI chỉ để phục
   vụ test**, tức đổi giao diện công cụ vì lý do kiểm thử.
2. Lỗi hiện ra là lỗi JavaScript có vết gọi, không phải một chuỗi stdout phải tự phân tích.
3. `MIN_NOTE_CHARS` và `VAGUE_PHRASES` nhập được vào **thông báo lỗi của test**, nên hướng dẫn sửa
   trong test luôn khớp ngưỡng thật. Qua `spawnSync` thì phải gõ lại ngưỡng vào test — đúng cái
   bẫy "hai bản quy ước lệch nhau" mà tài liệu giao việc cấm.

Không sao chép một biểu thức chính quy nào sang test. Toàn bộ những gì test nhập:
`scan`, `listScannedFiles`, `MIN_NOTE_CHARS`, `VAGUE_PHRASES`.

#### `VAGUE_NOTE` — định nghĩa "chung chung", và vì sao đặt trong script

Phép kiểm nằm trong `scripts/scan-pending.mjs` dưới mã lỗi `VAGUE_NOTE`, **không** nằm riêng
trong test: `--check` trong `run-local-all.sh` phải chặn được luôn, và quy ước chỉ được khai một
nơi.

Hai điều kiện, đủ một là đỏ:

| | Điều kiện | Ngưỡng |
|---|---|---|
| (a) | Mô tả (sau `trim`) ngắn hơn mức tối thiểu | `MIN_NOTE_CHARS = 15` |
| (b) | Bỏ cụm vô nghĩa + từ đệm + mã task đi thì phần còn lại quá ngắn | `MIN_INFORMATIVE_CHARS = 8` |

Điều kiện (b) là chỗ **tinh chỉnh so với đề xuất trong tài liệu giao việc**. Đề xuất gốc là "khớp
danh sách cụm vô nghĩa, chỉ khi mô tả gần như chỉ có cụm đó" nhưng không nói "gần như" là bao
nhiêu — để mơ hồ thì mỗi người cài một kiểu. Định nghĩa đã chốt: *bỏ cụm vô nghĩa đi, phần còn
lại phải còn ≥ 8 ký tự chữ-và-số.* Nhờ vậy câu dài có chứa cụm vô nghĩa ở giữa **không** bị bắt
oan:

```
$ node --input-type=module -e "import {vagueNoteReason} from '\$PWD/scripts/scan-pending.mjs'; ..."
VAGUE "chờ làm"                → mô tả chỉ 7 ký tự, dưới mức tối thiểu 15
VAGUE "chờ làm sau nhé"        → mô tả gần như chỉ gồm cụm vô nghĩa "chờ làm", "làm sau"
VAGUE "chờ task FE-05 làm sau" → mô tả gần như chỉ gồm cụm vô nghĩa "làm sau", "chờ task"
VAGUE "TBD"                    → mô tả chỉ 3 ký tự, dưới mức tối thiểu 15
VAGUE "đã sẵn hết"             → mô tả chỉ 10 ký tự, dưới mức tối thiểu 15
OK    "đã sẵn: validate Zod + kiểm quyền + ghi sổ kiểm toán"
OK    "expireStaleOrders đã sẵn validate + kiểm quyền, BE-07 sẽ làm phần gọi theo lịch"
OK    "thiếu hợp đồng phát hành một lần: chưa contract nào lưu cờ"
```

Dòng thứ bảy là ca quan trọng nhất: nó chứa "sẽ làm" mà **không** bị bắt, vì bỏ cụm đó ra thì
vẫn còn đủ nội dung. Bắt oan nó thì người viết sẽ học cách tránh từ ngữ thay vì viết mô tả tốt.

Mã task cũng bị trừ khỏi phần "còn lại": mã đã nằm ở đầu marker, nhắc lại trong mô tả không thêm
thông tin nào. Nhờ vậy `"chờ task FE-05 làm sau"` (22 ký tự, quá ngưỡng (a)) vẫn bị bắt.

**Ngưỡng có làm marker thật đỏ không: KHÔNG.** 12 marker hiện có đều qua, `--check` vẫn `exit=0`
(mục 3.6). Nên không phải nới ngưỡng, và cũng không phải kết luận marker nào tệ.

**Một khác biệt có chủ đích: `@flow` chỉ áp điều kiện (b), không áp (a).** Mô tả `@flow` là nhãn
một ô trên sơ đồ, đứng cạnh tên tệp và tên hàm nên ngắn là đúng — chính `design.md` QĐ-5 dùng
nhãn `"nhập số lượng"` (13 ký tự). Một ngưỡng bác bỏ ví dụ của chính quy ước thì ngưỡng đó sai,
không phải ví dụ sai. Cụm vô nghĩa thì vẫn bị bắt ở cả hai loại marker:

```
--- @flow (checkLength: false) ---
OK    "nhập số lượng"
VAGUE "xem sau"          → mô tả gần như chỉ gồm cụm vô nghĩa "xem sau"
OK    "nhận lệnh từ giao diện"
```

#### Chừa chỗ cho task 9.5, không phải viết lại

Task 9.5 thêm ca "số bước trong cùng luồng không trùng, không nhảy cách" (`BAD_FLOW_STEP`). Test
đã dựng để việc đó là **thêm**, không phải sửa:

- Tầng 1: phép kiểm *chốt chặn — không còn loại lỗi marker nào khác* đã bao `BAD_FLOW_STEP` ngay
  từ giờ. Mã lỗi mới thêm vào script **không** lặng lẽ nằm ngoài tầm test.
- Tầng 2: các đột biến nằm trong một **bảng dữ liệu** (`DOT_BIEN`); thêm ca = thêm một dòng.

Bước 4 **không** gắn `@flow` nào (việc của Bước 9) và **không** viết ca `BAD_FLOW_STEP` (việc của
9.5).

### Bước 5 — Phân loại export ✅

Ba commit mã nguồn, chia theo **mục tiêu** (không theo tệp):

| Commit | Nội dung |
|---|---|
| `3cdac3a` | `refactor(mc): marker điểm cắm cho server action và cổng lưu trữ` — 7 `@pending`, chỉ thêm bình luận |
| `6930b9a` | `refactor(mc): thu hẹp phạm vi export chỉ dùng nội bộ` — 4 ký hiệu bỏ `export` |
| `9ab73d5` | `refactor(mc): xóa mã chết đã xác minh bằng build` — 2 hàm bọc bị xóa |
| *(commit này)* | `docs(mc): bảng phân loại export vào checkpoint` |

Tệp sửa — **7** tệp:

| Tệp | Sửa gì |
|---|---|
| `app/src/app/actions/purchase.ts` | 3 `@pending` (FE-05, FE-06 ×2) + một khối chú thích nêu vì sao `expireStaleOrdersAction` **không** có marker |
| `app/src/lib/store/index.ts` | 3 `@pending` (BE-06, BE-05, BE-07) |
| `app/src/lib/signer/wallet.signer.ts` | 1 `@pending FE-05` trên `createWalletSigner` |
| `app/src/lib/bank/schemas.ts` | `amountSchema`, `orderIdSchema` bỏ `export` |
| `app/src/lib/wagmi.ts` | `hardhatLocal`, `evmTestnet` bỏ `export` |
| `packages/shared/src/chains.ts` | **xóa** `getChainInfo` |
| `packages/shared/src/addresses.ts` + `index.ts` | **xóa** `getDeployment`, gỡ khỏi barrel, gỡ import `DeploymentRecord` không còn dùng |

**Điều bất ngờ nhất của Bước 5: con số 27 trong spec đếm hẹp hơn một bậc so với phép đo viết
ra được — số thật là 115.** Phép đo, cách lệch, và bảng đủ 115 dòng ở mục 4. Ba dự đoán của
`design.md` mục 6 **sai**, và mỗi cái sai theo một kiểu khác nhau (mục 10, SL-7).

### Bước 6 — Hợp nhất nguồn giá phát hành ✅

Ba commit, chia theo **mục tiêu**:

| Commit | Nội dung |
|---|---|
| `f285acf` | `refactor(mc): xóa server action dọn lệnh treo theo chủ đích một đường vào` — Owner chốt Q5 phương án (a3). Đây là **đổi hành vi có chủ đích**, ghi ở D-7 mục 9 |
| `42d0a88` | `refactor(mc): hợp nhất nguồn giá phát hành WPT` — hằng số về một nguồn ở `lib/config/issue-terms.ts` |
| `c96f8f3` | `test(mc): chống lệch hai nguồn giá phát hành` — 15 ca, 285 → **300** test |
| *(commit này)* | `docs(mc): chốt kết quả Bước 6 vào checkpoint` |

Tệp sửa — **5** tệp:

| Tệp | Sửa gì |
|---|---|
| `app/src/lib/config/issue-terms.ts` | **mới** — nguồn duy nhất của `WPT_ISSUE_PRICE_VND`, mang theo khối chú thích "tham số cấu hình, không phải giá thị trường" |
| `app/src/lib/bank/issuance.ts` | nhập + re-export hằng số, giữ `wptToVnd` và cảnh báo hiển thị |
| `app/src/lib/ledger/mock.adapter.ts` | `DEFAULT_WPT_PRICE_VND = BigInt(WPT_ISSUE_PRICE_VND)`, không còn khai bằng số |
| `app/src/app/actions/purchase.ts` | xóa `expireStaleOrdersAction` + khối câu hỏi mở; thêm chú thích vì sao service có 4 hàm mà đây chỉ 3 action |
| `app/test/issue-price-single-source.test.ts` | **mới** — 15 ca: giá trị, nghiệp vụ, và **cấu trúc** |

**Giá trị không đổi: 100.000 VND / WPT.** Chỗ đặt và bằng chứng chiều phụ thuộc ở mục 6; hai đột
biến ở mục 5; kết quả chạy đầy đủ ở 3.8.

**Điều đáng chú ý nhất của Bước 6:** đột biến 1 (đổi giá ở nguồn duy nhất) làm **10 test cũ đỏ** —
`mock-ledger.test.ts` và `purchase-service.test.ts` hardcode số VNDB suy ra từ 100.000. Đó không
phải lỗi của Bước 6 và **không** được sửa (cấm chạm test đang xanh), nhưng nó là một món nợ thật:
xem SL-8 ở mục 10.

---

## 2. Đối chiếu DoD

| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 1.1 | `.kiro/steering/make-control.md` có `inclusion: always`, ghi đủ `@pending` / `@blocked` / `@flow` | ✅ | Ví dụ lấy từ mã thật trong repo, không bịa |
| 1.2 | `.kiro/task-status.json` với `done` = FE-01, FE-02, BE-01, BE-02, BE-08, BE-09 | ✅ | Bảng mã task hợp lệ ở mục 3 |
| 1.3 | Steering ghi ai cập nhật tệp này và lúc nào | ✅ | Mục 7 của steering, có bảng Ai / Lúc nào / Cái gì |
| 2.1 | `scripts/scan-pending.mjs` có ba chế độ theo `design.md` mục 2 | ✅ | Mặc định / `--json` / `--check`, thêm `--help`. Node 20, ESM thuần, không thêm phụ thuộc |
| 2.2 | `--check` khác 0 **chỉ khi** marker sai định dạng, mã task không tồn tại, hoặc chờ task đã `done`; còn điểm cắm là bình thường | ✅ | Đo thật: repo lành → `exit=0` (mục 3.4). Đột biến → `exit=1` và liệt kê đủ loại lỗi (mục 5) |
| 2.3 | Cắm vào `run-local-all.sh`: chạy `--check`, in bảng ở tổng kết | ✅ | Mục `LỚP 3 - ĐIỂM CẮM (marker)` vào `PASSED`/`FAILED`; bảng in ở TỔNG KẾT, **không** ảnh hưởng mã thoát |
| 2.4 | Chạy thử trên `dev` hiện tại, xác nhận script đọc được marker đang có hoặc báo đúng là sai định dạng | ✅ | Repo hiện **0 marker** đúng cú pháp và **0 marker** sai cú pháp — bảng rỗng tử tế, không nổ lỗi (mục 3.4). Khả năng nhận dạng chứng minh bằng đột biến |
| 3.1 | Rà các tệp đang có bình luận nhắc task khác | ✅ | Đo lại từng **dòng**, không tin con số 33 hay 43. Phân loại A/B/C/D + một nhóm thứ năm mà tài liệu giao việc không lường: mục 10, SL-3 |
| 3.2 | Chuyển sang `@pending` nếu code chạy được, `@blocked` nếu chưa | ✅ | 1 `@pending` (nhóm A) + 11 `@blocked` (nhóm B). Bảng ở mục 3.4. `expireStaleOrders` chạy được và **có test phủ** nên là `@pending`, không phải `@blocked` |
| 3.3 | Bỏ marker không còn đúng, ví dụ nhắc task đã hoàn thành | ✅ | 1 chỗ nhóm D: `portfolio.service.ts` khẳng định `ILedgerPort` thiếu `paymentBalanceOf` — **sai**, method có từ BE-01. Chi tiết ở mục 10, SL-3 |
| 3.4 | Giữ nguyên nội dung `LedgerNotImplementedError` | ✅ | Chứng minh bằng phép kiểm "không đổi mã thực thi" ở mục 3.5, phép kiểm 3: diff **rỗng** |
| 3.5 | Chạy `scan-pending.mjs`, bảng ra đúng, không còn marker sai định dạng | ✅ | Mục 3.4 (bảng) và 3.5 (`exit=0`, 7 PASS / 0 FAIL) |
| 4.1 | `app/test/pending-markers.test.ts` với 4 ca theo `design.md` mục 3 | ✅ | 4 ca có tên + 1 chốt chặn bắt mọi mã lỗi còn lại + 1 chống rỗng ruột (tầng 1), 7 ca kiểm chính phép kiểm (tầng 2) = **13 ca**. 272 → **285** test |
| 4.2 | **Đột biến:** thêm tạm `BE-02` vào marker một tệp → test phải **đỏ**; ghi kết quả rồi hoàn nguyên | ✅ | Đỏ ở **ca 3**, đúng tệp:dòng. Output nguyên văn ở mục 5. Hoàn nguyên: `git diff -- app packages scripts` **rỗng** |
| 4.3 | `@pending XX-99` → phải đỏ | ✅ | Đỏ ở **ca 2**. Thêm hai đột biến nữa cho đủ bộ 4 ca: thiếu dấu `\|` → ca 1, mô tả `chờ làm` → ca 4 |
| 5.1 | Lấy danh sách bằng cách quét export chỉ xuất hiện trong chính tệp nó | ✅ | Đo bằng TypeScript compiler API (regex bỏ sót `export {}` / `export default` / `export *`), "tham chiếu" = token định danh thật nên tên trong bình luận không tính. **Số thật 115, không phải 27** — mục 4.1. Cả 4 cạm bẫy đều bắt được ca thật, kể cả một cạm bẫy thứ tư mà tài liệu giao việc không nêu (glob `**/*.ts` bỏ sót 5 tệp, gồm `src/empty.ts`) |
| 5.2 | Phân loại từng cái theo bảng ở `design.md` mục 6 | ✅ | 9 nhóm, trong đó 3 nhóm không có trong `design.md` (D Next.js, E mặt tiền kiểu, G shadcn) và 1 nhóm của `design.md` **không tồn tại** ("dùng trong test"). Bảng đủ 115 dòng ở 4.4 |
| 5.3 | Điểm cắm → gắn marker với mã task đúng | ✅ | **7** `@pending`. Mã task tự xác minh từng cái, không chép bảng spec: 3 cái có bằng chứng tài liệu trực tiếp, 3 cái suy luận có nêu rõ là suy luận, 1 cái (`createWalletSigner`) không nằm trong danh sách spec nhưng là điểm cắm LUẬT #2 nên thêm vào |
| 5.4 | Dùng nội bộ → bỏ từ khóa `export` | ✅ | **4**: `amountSchema`, `orderIdSchema`, `hardhatLocal`, `evmTestnet`. `getSigner` **cố ý không** thu hẹp — lý do ở 4.3 và Q8 |
| 5.5 | Mã chết thật → xóa, với `evmTestnet`/`hardhatLocal`/`getSigner` phải thử `npm run build` | ✅ | **2** hàm bọc bị xóa (`getChainInfo`, `getDeployment`). Ba ký hiệu spec nêu đích danh thì **không** cái nào là mã chết: `evmTestnet`/`hardhatLocal` nằm trong mảng `chains` (cạm bẫy #2), `getSigner` được `getBankSigner` gọi. `npm run build` chạy **3 lần** (nền + sau khi bỏ export + sau khi xóa), 17/17 route mỗi lần — mục 3.7 |
| 5.6 | Dùng trong test → xác minh test có gọi thật | ✅ | **Không cái nào thuộc nhóm này.** Ba hàm `design.md` dự đoán (`resetSignerCache`, `resetChainRegistryCache`, `resetKycProviderCache`) không có test nào gọi — bằng chứng ở 4.3 → chuyển sang nhóm I + Q7 |
| 5.7 | Ghi bảng phân loại đầy đủ vào checkpoint | ✅ | Mục 4, **đủ 115 dòng**, mỗi dòng có tệp:dòng, nhóm, xử lý, bằng chứng chạy được |
| 6.1 | Kiểm chiều phụ thuộc trước khi làm: `lib/ledger` nhập từ `lib/bank` có ngược tầng không | ✅ | Đo bằng `git grep` trên chính câu lệnh `import`, hai chiều: `lib/bank` → `lib/ledger` **4 chỗ**, chiều ngược **0 chỗ**. Kết luận: ngược tầng. Output nguyên văn ở mục 6 |
| 6.2 | Nếu ngược tầng, đặt hằng số ở chỗ trung lập (`lib/config` hoặc `packages/shared`), cả hai cùng nhập; **ghi lựa chọn và lý do** | ✅ | Chọn `app/src/lib/config/issue-terms.ts`. Bốn lý do + lý do loại `packages/shared` ở mục 6. Hai điều **cố ý** ở tệp mới: không có `import` nào (tệp lá → không thể tạo vòng), không có `server-only` |
| 6.3 | `mock.adapter.ts` nhập giá thay vì khai lại `DEFAULT_WPT_PRICE_VND` | ✅ | `BigInt(WPT_ISSUE_PRICE_VND)`. Hành vi giữ nguyên: `quotePurchase` vẫn trả đúng số cũ, 49 ca `mock-ledger.test.ts` và 32 ca `purchase-service.test.ts` xanh nguyên |
| 6.4 | `app/test/issue-price-single-source.test.ts`: đọc giá từ nguồn duy nhất, gọi `quotePurchase` trên mock, xác nhận bằng nhau | ✅ | **15 ca**, CỐ Ý không hardcode 100.000. 6 lượng khác nhau (tới 123.456.789 để chắc phép tính chạy trên `bigint`), 4 ca "giá hiển thị = giá khớp lệnh", **3 ca cấu trúc** bắt được cả trường hợp khai lại với đúng con số hôm nay (đột biến 2b ở mục 5) |
| 6.5 | **Đột biến:** đổi giá ở nguồn duy nhất → vẫn xanh; tách lại thành hai hằng số → đỏ | ✅ | Đột biến 1: test nguồn giá **15/15 xanh** (và 10 test cũ đỏ vì hardcode giá — SL-8). Đột biến 2: **12/15 đỏ**. Thêm đột biến 2b: khai lại với đúng con số hôm nay → **2/15 đỏ**, đúng hai ca cấu trúc. Hoàn nguyên: `git diff -- app packages scripts` **rỗng** cả hai lần |
| 7.x | Dọn phụ thuộc, làm rõ `src/empty.ts` | ⬜ | _(chờ Bước 7)_ |
| 8.x | Script lớp 3 không dương tính giả | ⬜ | _(chờ Bước 8)_ |
| 9.x | Nền cho sơ đồ luồng | ⬜ | _(chờ Bước 9)_ |
| 10.x | Tài liệu | ⬜ | _(chờ Bước 10)_ |

---

## 3. Kết quả chạy đầy đủ

### 3.1 Bảng mã task hợp lệ — đo thật, không bịa

Lệnh và **output nguyên văn**:

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort -u
AU-01
AU-02
BE-01
BE-02
BE-03
BE-04
BE-05
BE-06
BE-07
BE-08
BE-09
BE-10
BE-11
FE-01
FE-02
FE-04
FE-05
FE-06
FE-09
FE-10
FE-11
MC-01
MC-02
SC-02
SC-03
```

**25 mã**, khớp đúng con số Supervisor đưa trong tài liệu giao việc. Không lệch.

> **Cập nhật Bước 2:** Owner đã chốt thêm `SC-04`, nên từ Bước 2 tập mã hợp lệ là **26**.
> Số đo lại ở mục 3.2 và 3.3.

Số lần xuất hiện mỗi mã (dùng để nhận ra mã gõ sai — mã chỉ xuất hiện 1 lần đáng nghi):

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort | uniq -c | sort -k2
  19 AU-01     3 AU-02    51 BE-01   119 BE-02     3 BE-03
  16 BE-04     7 BE-05    19 BE-06    21 BE-07    66 BE-08
  80 BE-09     1 BE-10     1 BE-11    43 FE-01    25 FE-02
  13 FE-04    42 FE-05     7 FE-06    13 FE-09     2 FE-10
  12 FE-11    12 MC-01     2 MC-02    40 SC-02    35 SC-03
```

`BE-10` và `BE-11` chỉ xuất hiện 1 lần nên đã kiểm từng chỗ, cả hai là mã thật chứ không phải
lỗi gõ:

```
docs/be-02-purchase-orders/requirements.md:77:- Đối soát toàn hệ (thuộc BE-11).
docs/be-02-purchase-orders/requirements.md:78:- Xử lý giao dịch treo dùng chung (thuộc BE-10).
```

### 3.2 Đối chiếu JSON với số đo — và vì sao phép đo này bị **khai tử** từ Bước 2

Đo lại ở Bước 2 thì phép đo của Bước 1 **lệch một dòng**:

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort -u > /tmp/mc01-measured.txt
$ node -e "const s=require('./.kiro/task-status.json');console.log([...s.done,...s.inProgress,...s.planned].sort().join('\n'))" > /tmp/mc01-json.txt
$ diff /tmp/mc01-measured.txt /tmp/mc01-json.txt
14d13
< BE-12
```

`BE-12` **không phải task nào cả**. Truy nguồn:

```
$ grep -rl 'BE-12' docs/ .kiro/
docs/CHECKPOINT_MC01.md
```

Đúng **một** tệp, và là chính tệp này — mọi lần xuất hiện đều nằm trong đoạn văn đang giải thích
chuyện này. (Dùng `grep -rl` thay `-rn` có lý do: số dòng đổi mỗi lần đoạn văn này được sửa, dán
số dòng vào đây là dán một con số lạc hậu ngay lúc dán.) Mã gốc sinh ra từ câu
"ví dụ `SC-04` hoặc `BE-12`" ở Q1 của Bước 1 — một **phương án giả định**; Owner chọn `SC-04`, nên
`BE-12` chưa từng tồn tại. Đã bỏ câu đó khỏi Q1, nhưng giải thích sai lệch thì buộc phải gọi tên
nó, nên `grep` vẫn thấy.

Đó chính là bằng chứng gọn nhất cho điều steering mục 7 nói: **văn bản tự do không làm nguồn
được.** Phép grep này đếm cả mã được nhắc trong câu bàn luận, phương án bị loại, và cả trong
đoạn văn giải thích chính nó — không có cách sửa nào làm nó đáng tin, vì lỗi nằm ở phương pháp.

**Xử lý:** khai tử phép đo này, không dùng làm phép kiểm nữa. Nguồn duy nhất về tập mã hợp lệ là
`.kiro/task-status.json`, và `--check` của script đọc **đúng tệp đó**, không grep tài liệu. Chiều
ngược lại — mọi mã trong JSON đều có mặt thật trong tài liệu — vẫn kiểm được và vẫn đúng:

```
$ node -e "const s=require('./.kiro/task-status.json');console.log([...s.done,...s.inProgress,...s.planned].sort().join('\n'))" | while read c; do grep -rqE "\b$c\b" docs/ .kiro/ || echo "THIẾU TRONG TÀI LIỆU: $c"; done; echo "xong"
xong
```

### 3.3 Bất biến "một mã ở đúng một danh sách"

```
$ node -e "const s=require('./.kiro/task-status.json'); const all=[...s.done,...s.inProgress,...s.planned]; const dup=all.filter((x,i)=>all.indexOf(x)!==i); if(dup.length) throw new Error('trùng: '+dup); console.log('OK', all.length, 'mã task hợp lệ'); console.log('done',s.done.length,'· inProgress',s.inProgress.length,'· planned',s.planned.length)"
OK 26 mã task hợp lệ
done 6 · inProgress 1 · planned 19
```

Phân bổ: `done` 6 · `inProgress` 1 · `planned` 19 = **26**.

Bất biến này còn được **chính script kiểm lại** mỗi lần chạy: vi phạm nó thì `--check` báo
`BAD_TASK_STATUS` và đỏ. Lý do: khi một mã nằm ở hai danh sách thì hai phép kiểm `UNKNOWN_TASK`
và `STALE_TASK` cho kết quả tùy thứ tự đọc, tức cả cơ chế mất nghĩa — im lặng bỏ qua tệ hơn đỏ.
Đã kiểm bằng nguồn giả (không chạm tệp thật):

```
$ TMP=$(mktemp -d) && mkdir -p "$TMP/.kiro"
$ printf '{"done":["BE-02"],"inProgress":["MC-01"],"planned":["BE-02","SC-04"]}' > "$TMP/.kiro/task-status.json"
$ node --input-type=module -e "import {readTaskStatus} from '\$PWD/scripts/scan-pending.mjs'; console.log(JSON.stringify(readTaskStatus('$TMP').errors,null,2))"
[
  {
    "code": "BAD_TASK_STATUS",
    "file": ".kiro/task-status.json",
    "line": 0,
    "message": "mã task BE-02 xuất hiện ở cả \"done\" và \"planned\" — bất biến của steering mục 7 là một mã ở ĐÚNG MỘT danh sách"
  }
]
```

Lần chạy này cũng chứng minh việc `import` module **không** kích hoạt CLI (không in bảng).

### 3.4 Bảng điểm cắm mà script in ra

Bảng sau Bước 3 — **dán nguyên văn**, đây là thứ Supervisor đọc đầu tiên. `[cắm]` = code đã
chạy được, chờ người gọi. `[chặn]` = code đang ném lỗi, chờ phụ thuộc xong trước.

```
$ node scripts/scan-pending.mjs
ĐIỂM CẮM ĐANG CHỜ

BE-06  (1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:520  thiếu quyết định mapping snapshotId -> distributionId; hợp đồng `ProfitDistributor` thì đã có và đã deploy

BE-07  (1 điểm cắm)
  [cắm]   app/src/lib/bank/purchase.service.ts:543  đã sẵn đầu cuối: validate Zod, kiểm quyền `order:expire`, chuyển PLACED -> EXPIRED theo mốc thời gian, ghi sổ kiểm toán khi có lệnh đổi. BE-07 chỉ cần gọi theo lịch

SC-02  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:375  thiếu hợp đồng phát hành một lần: chưa contract nào lưu cờ "đã phát hành nguồn cung ban đầu"
  [chặn]  app/src/lib/ledger/evm.adapter.ts:381  thiếu hợp đồng phát hành một lần: không có cờ nào để đọc, nên không trả được true/false thật
  [chặn]  app/src/lib/ledger/evm.adapter.ts:392  thiếu hợp đồng phát hành một lần: địa chỉ ví thanh toán SPV do chính hợp đồng đó giữ

SC-03  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:401  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:419  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:425  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:538  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:544  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:549  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:555  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

  Chưa có marker @flow nào. Sơ đồ luồng sinh từ marker, chưa gắn thì chưa sinh được.

Tổng: 1 điểm cắm · 11 điểm chặn · 0 bước luồng
```

Bảng `@flow` còn rỗng là **đúng**: gắn `@flow` là Bước 9, và Bước 3 bị cấm gắn.

`--check` vẫn **mã thoát 0** sau khi thêm 12 marker. Đây là phép kiểm quan trọng nhất của
Bước 3 theo hướng ngược: **còn điểm cắm là bình thường, không được làm đỏ**. Nếu chỗ này đỏ
thì cả cơ chế sẽ bị người sau vô hiệu hoá cho xanh, và bảng điểm cắm mất luôn giá trị.

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0
```

Hai khối dưới đây giữ từ Bước 2, khi bảng còn rỗng — để thấy script không nổ lỗi ở cả hai
đầu (không có marker nào, và có 12 marker).

```
$ node scripts/scan-pending.mjs        # bản Bước 2
ĐIỂM CẮM ĐANG CHỜ

  Chưa có điểm cắm nào: không có marker @pending / @blocked nào trong phạm vi quét.
  Đây là trạng thái bình thường, không phải lỗi — còn hay hết điểm cắm đều
  không làm `--check` đỏ. Quy ước: .kiro/steering/make-control.md

Tổng: 0 điểm cắm · 0 điểm chặn · 0 bước luồng
```

`--json` chỉ in JSON ra stdout, không lẫn thứ gì khác (test và script sinh tài liệu đọc stdout):

```
$ node scripts/scan-pending.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s);console.log('JSON hợp lệ')})"
JSON hợp lệ

$ node scripts/scan-pending.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(JSON.stringify({byTask:r.byTask,summary:r.summary},null,2))})"
{
  "byTask": {
    "BE-06": 1,
    "BE-07": 1,
    "SC-02": 3,
    "SC-03": 3,
    "SC-04": 4
  },
  "summary": {
    "pending": 1,
    "blocked": 11,
    "flows": 0,
    "errors": 0
  }
}
```

`byTask` là thứ Bước 10 sẽ đọc để sinh mục điểm cắm trong `tech-report.md`, không gõ tay.

### 3.5 Bốn phép kiểm chứng của Bước 3

#### Phép kiểm 3 — chứng minh **không đổi hành vi**

Đây là phép kiểm quan trọng nhất của Bước 3, vì ràng buộc của bước này là *chỉ sửa bình
luận*. Lệnh lọc mọi dòng thêm/bớt trong `app/src` và `packages` **không** bắt đầu bằng dấu
mở chú thích; còn lại dòng nào thì dòng đó là mã thực thi bị sửa.

```
$ git diff -U0 a1ab71e..HEAD -- 'app/src' 'packages' | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*(//|/\*|\*|#)'
(rỗng)
```

**Rỗng.** Không một dòng mã thực thi nào bị đổi, nên `pendingContract(...)` và nội dung
`LedgerNotImplementedError` giữ nguyên từng ký tự — đúng DoD 3.4.

Phép kiểm này cũng là **lý do một chỗ nhóm D KHÔNG được sửa**, xem SL-3 mục "Ba chỗ cùng nói
một điều đã sai".

#### Phép kiểm 4 — `bash scripts/run-local-all.sh` — 7 PASS, 0 FAIL

Mã thoát `0`. Giống Bước 2 từng mục, chỉ khác dòng đếm marker.

```
########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
...
TỔNG KẾT
  PASS: 20   FAIL: 0   WARN: 6
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc

########## LỚP 3 - ĐIỂM CẮM (marker) ##########
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM          (13 test hardhat)

########## LỚP 1 - SPEC TEST CONTRACT SOROBAN ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN      (profit_distributor 16 · profit_distributor_pull · redemption 14 · revenue_oracle 1 · wpt_token 16)

########## APP - TYPECHECK ##########
  => PASS: APP - TYPECHECK

########## APP - LINT ##########
/Users/anbinh/.../app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)
  => PASS: APP - LINT

########## APP - VITEST ##########
 Test Files  11 passed (11)
      Tests  272 passed (272)
  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

(bảng điểm cắm 12 dòng như mục 3.4 — run-local-all in lại ở đây)

\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet.
```

Không có mục nào FAIL, nên không có mục nào phải báo lại Supervisor. Sáu `WARN` của lớp 3 là
trạng thái nền của `dev`, không do Bước 2 hay Bước 3 gây ra (`process.env` ở
`signer/index.ts`, địa chỉ ví mẫu trong placeholder màn mint, `BASE_REF` chưa đặt, ba spec
Stellar chưa tới lượt). Cảnh báo lint duy nhất ở `app/src/empty.ts` là món thuộc Bước 7.

272 test vitest / 11 tệp, 13 test hardhat, 47 test cargo — **y nguyên** con số của Bước 2.
Không sửa test nào, không thêm test nào (Bước 4 mới làm việc đó).

Chuỗi `\n` in ra nguyên văn ở dòng cuối là **lỗi sẵn có trên `dev`**, không phải do Bước 3:
`scripts/run-local-all.sh:103` gọi `c_grn "\n  => ĐẠT..."` mà `c_grn` dùng
`printf '%s'` nên `\n` không được hiểu là dòng mới. Đã kiểm `git show 71932bb:scripts/run-local-all.sh`
cũng có nguyên dòng đó. **Không sửa ở Bước 3** vì bước này chỉ được sửa bình luận; ghi ở
SL-5 để bước nào chạm tới script thì sửa.

**Lưu ý về dương tính giả đã bắt được ngay trong Bước 2:** lần chạy `run-local-all.sh` **đầu
tiên** báo `FAIL LỚP 3 - ĐIỂM CẮM (marker)` với 2 lỗi `BAD_SYNTAX` — xem SL-4 ở mục 10. Đã sửa
gốc rễ ở script, không im lặng bỏ qua và cũng không loại trừ cả tệp cho xanh.

### 3.6 Kết quả chạy đầy đủ sau Bước 4

#### Số test: 272 → **285** (+13), không test cũ nào đỏ

```
$ cd app && npm test
 ✓ test/purchase-state.test.ts (19 tests) 5ms
 ✓ test/pending-markers.test.ts (13 tests) 17ms      ← MỚI
 ✓ test/rbac.test.ts (38 tests) 14ms
 ✓ test/env-private-key.test.ts (5 tests) 35ms
 ✓ test/wallet-status.test.ts (30 tests) 32ms
 ✓ test/evm-address-env.test.ts (5 tests) 2ms
 ✓ test/mock-ledger.test.ts (49 tests) 24ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 5ms
 ✓ test/store-constraints.test.ts (69 tests) 18ms
 ✓ test/receipt-timeout.test.ts (5 tests) 3ms
 ✓ test/portfolio-service.test.ts (12 tests) 8ms
 ✓ test/purchase-service.test.ts (32 tests) 20ms

 Test Files  12 passed (12)
      Tests  285 passed (285)
```

285 − 272 = **13**, đúng bằng số ca của tệp mới. 11 tệp cũ giữ nguyên số ca từng tệp
(19+38+5+30+5+49+8+69+5+12+32 = 272), nên **không tệp cũ nào bị sửa**.

#### `--check` vẫn `exit=0` sau khi thêm `VAGUE_NOTE`

Đây là phép kiểm quan trọng nhất theo hướng ngược của Bước 4: ngưỡng mới **không được** làm marker
thật đỏ.

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0
```

#### `bash scripts/run-local-all.sh` — 7 PASS / 0 FAIL, mã thoát 0

```
########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
  PASS: 20   FAIL: 0   WARN: 6
########## LỚP 3 - ĐIỂM CẮM (marker) ##########
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
########## LỚP 1 - SPEC TEST CONTRACT SOROBAN ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN
########## APP - TYPECHECK ##########
  => PASS: APP - TYPECHECK
########## APP - LINT ##########
  => PASS: APP - LINT
########## APP - VITEST ##########
 Test Files  12 passed (12)
      Tests  285 passed (285)
  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

Tổng: 1 điểm cắm · 11 điểm chặn · 0 bước luồng

$ echo "exit=$?"
exit=0
```

Sáu `WARN` của lớp 3 và cảnh báo lint ở `app/src/empty.ts` **y nguyên** Bước 3 — Bước 4 không
thêm cảnh báo nào. Bảng điểm cắm vẫn 12 dòng như mục 3.4: Bước 4 không thêm, không bớt, không sửa
marker thật nào.

**Từng commit riêng lẻ cũng xanh**, không chỉ trạng thái cuối. `1bcd62b` (chỉ script, chưa có tệp
test) đã chạy `run-local-all.sh` riêng và ra **7 PASS / 0 FAIL với 272 test** — đúng con số Bước 3,
tức thêm `VAGUE_NOTE` một mình không làm gì đỏ.

### 3.7 Kết quả chạy đầy đủ sau Bước 5

#### `npm run build` chạy **ba lần**, không phải một

Đây là ràng buộc riêng của Bước 5: bước này **xóa mã**, nên `typecheck` + `test` không đủ. Có thứ
chỉ `next build` phát hiện (chuỗi chain đi vào mảng cấu hình, tệp mà App Router nạp theo tên).

| Lần | Trạng thái repo | Kết quả |
|---|---|---|
| 1 — **nền** | `3cdac3a`, chỉ mới thêm bình luận | ✓ Compiled · Finished TypeScript · **17/17 route** |
| 2 — sau khi bỏ `export` | `6930b9a`, 4 ký hiệu thu hẹp | ✓ như trên, **17/17 route** |
| 3 — sau khi **xóa** | `9ab73d5`, 2 hàm bị xóa | ✓ như trên, **17/17 route** |

Lần 1 chạy **trước** mọi thay đổi có rủi ro, có mục đích: nếu `next build` hỏng vì môi trường
(ví dụ hết bộ nhớ, `exit 137`) thì phải biết **trước** khi xóa, không thì một lần build đỏ sẽ bị
đọc thành "xóa sai". Không lần nào gặp OOM; máy này dựng được bình thường.

```
$ cd app && npm run build
▲ Next.js 16.2.7 (Turbopack)
- Environments: .env.local
  Creating an optimized production build ...
✓ Compiled successfully in 5.7s
  Running TypeScript ...
  Finished TypeScript in 5.6s ...
  Collecting page data using 9 workers ...
✓ Generating static pages using 9 workers (17/17) in 282ms
  Finalizing page optimization ...
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /api/balance
├ ƒ /api/investors
├ ƒ /api/mint
├ ƒ /api/purchase
├ ƒ /api/token
├ ƒ /api/txns
├ ƒ /assets
├ ƒ /audit
├ ƒ /kyc
├ ƒ /mint
├ ƒ /portfolio
├ ƒ /reconciliation
├ ƒ /tokens/[symbol]
└ ƒ /wallet
ƒ  (Dynamic)  server-rendered on demand
```

**17/17 route sinh được là phép kiểm trực tiếp cho nhóm D** (15 export mà Next.js gọi theo quy
ước tệp): nếu Bước 5 chạm sai một `export default` nào thì route đó biến mất khỏi bảng này.

#### Số test: **285 — không đổi**

```
$ cd app && npm test
 ✓ test/purchase-state.test.ts (19 tests) 8ms
 ✓ test/pending-markers.test.ts (13 tests) 18ms
 ✓ test/rbac.test.ts (38 tests) 16ms
 ✓ test/wallet-status.test.ts (30 tests) 24ms
 ✓ test/env-private-key.test.ts (5 tests) 31ms
 ✓ test/mock-ledger.test.ts (49 tests) 31ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 6ms
 ✓ test/evm-address-env.test.ts (5 tests) 2ms
 ✓ test/store-constraints.test.ts (69 tests) 19ms
 ✓ test/receipt-timeout.test.ts (5 tests) 2ms
 ✓ test/portfolio-service.test.ts (12 tests) 8ms
 ✓ test/purchase-service.test.ts (32 tests) 21ms

 Test Files  12 passed (12)
      Tests  285 passed (285)
```

Bước 5 **không thêm test và không sửa test nào**. Số ca từng tệp y nguyên Bước 4. Đó là điều
đúng với bước này: không có hành vi mới nào để kiểm, còn bốn phép kiểm cần thiết (`typecheck`,
`eslint`, `test`, `build`) thì đều đã chạy sau mỗi thay đổi.

#### Bảng điểm cắm sau Bước 5 — dán nguyên văn

12 → **19** marker (thêm 7 `@pending`). `--check` vẫn `exit=0`: thêm điểm cắm **không** làm đỏ,
đúng như R2.4.

```
$ node scripts/scan-pending.mjs
ĐIỂM CẮM ĐANG CHỜ

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:132  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-06  (1 điểm cắm, 1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:520  thiếu quyết định mapping snapshotId -> distributionId; hợp đồng `ProfitDistributor` thì đã có và đã deploy
  [cắm]   app/src/lib/store/index.ts:122         cổng kỳ chia lợi nhuận đã sẵn ở cả hai bản (bộ nhớ + Postgres): `periodKey` duy nhất chặn mở kỳ hai lần, `(periodId, investorWallet)` duy nhất chặn chia trùng — hai ràng buộc đó là nơi giữ đúng đắn, đừng thay bằng phép kiểm trước khi ghi

BE-07  (2 điểm cắm)
  [cắm]   app/src/lib/bank/purchase.service.ts:543  đã sẵn đầu cuối: validate Zod, kiểm quyền `order:expire`, chuyển PLACED -> EXPIRED theo mốc thời gian, ghi sổ kiểm toán khi có lệnh đổi. BE-07 chỉ cần gọi theo lịch
  [cắm]   app/src/lib/store/index.ts:142            cổng lần chạy định kỳ đã sẵn ở cả hai bản (bộ nhớ + Postgres): mở lần chạy ở `RUNNING` rồi đóng sang `SUCCESS` hoặc `FAILED`, nên tiến trình hẹn giờ có chỗ ghi vết mà không phải dựng bảng mới

FE-05  (2 điểm cắm)
  [cắm]   app/src/app/actions/purchase.ts:26      đã sẵn đầu cuối ở `placeOrder`: validate Zod, kiểm quyền `order:place` (vai INVESTOR), CHỐT số VNDB tại thời điểm đặt, lưu lệnh `PLACED`, ghi sổ kiểm toán. Màn mua WPT chỉ cần gọi và hiển thị `Result`
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-06  (2 điểm cắm)
  [cắm]   app/src/app/actions/purchase.ts:33  đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai BANK_ADMIN), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận
  [cắm]   app/src/app/actions/purchase.ts:40  đã sẵn đầu cuối ở `listOrders`: phân biệt `order:read` với `order:read:all`, nên "vai nào xem được sổ lệnh nào" là việc của RBAC chứ không phải của màn hình

SC-02  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:375  thiếu hợp đồng phát hành một lần: chưa contract nào lưu cờ "đã phát hành nguồn cung ban đầu"
  [chặn]  app/src/lib/ledger/evm.adapter.ts:381  thiếu hợp đồng phát hành một lần: không có cờ nào để đọc, nên không trả được true/false thật
  [chặn]  app/src/lib/ledger/evm.adapter.ts:392  thiếu hợp đồng phát hành một lần: địa chỉ ví thanh toán SPV do chính hợp đồng đó giữ

SC-03  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:401  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:419  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:425  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:538  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:544  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:549  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:555  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

  Chưa có marker @flow nào. Sơ đồ luồng sinh từ marker, chưa gắn thì chưa sinh được.

Tổng: 8 điểm cắm · 11 điểm chặn · 0 bước luồng

$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 8 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0
```

Bảng `@flow` vẫn rỗng là **đúng**: gắn `@flow` là Bước 9, Bước 5 bị cấm gắn.

#### `bash scripts/run-local-all.sh` — 7 PASS / 0 FAIL, mã thoát 0

```
########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
  PASS: 20   FAIL: 0   WARN: 6
  => PASS có cảnh báo: luật kiến trúc
########## LỚP 3 - ĐIỂM CẮM (marker) ##########
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
########## LỚP 1 - SPEC TEST CONTRACT SOROBAN ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN
########## APP - TYPECHECK ##########
  => PASS: APP - TYPECHECK
########## APP - LINT ##########
/Users/anbinh/.../app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)
  => PASS: APP - LINT
########## APP - VITEST ##########
 Test Files  12 passed (12)
      Tests  285 passed (285)
  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

(bảng điểm cắm 19 dòng như trên — run-local-all in lại ở đây)

$ echo "exit=$?"
exit=0
```

**Sáu `WARN` của lớp 3 và cảnh báo lint duy nhất ở `app/src/empty.ts` y nguyên Bước 4.** Bước 5
là bước đầu tiên chạm mã nguồn ngoài bình luận, nên điều đáng chú ý là nó **không thêm cảnh báo
nào** — kể cả sau khi xóa hai hàm khỏi `packages/shared`, nơi `verify-arch-rules.sh` kiểm cấu
trúc repo.

### 3.8 Kết quả chạy đầy đủ sau Bước 6

```
$ cd app && npm test

 ✓ test/rbac.test.ts (38 tests) 15ms
 ✓ test/env-private-key.test.ts (5 tests) 35ms
 ✓ test/wallet-status.test.ts (30 tests) 16ms
 ✓ test/issue-price-single-source.test.ts (15 tests) 10ms
 ✓ test/mock-ledger.test.ts (49 tests) 11ms
 ✓ test/purchase-state.test.ts (19 tests) 7ms
 ✓ test/evm-address-env.test.ts (5 tests) 3ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 4ms
 ✓ test/store-constraints.test.ts (69 tests) 21ms
 ✓ test/receipt-timeout.test.ts (5 tests) 3ms
 ✓ test/portfolio-service.test.ts (12 tests) 9ms
 ✓ test/purchase-service.test.ts (32 tests) 23ms

 Test Files  13 passed (13)
      Tests  300 passed (300)
```

**285 test cũ xanh nguyên, thêm 15 ca mới.** Không ca nào của 12 tệp cũ phải sửa — kể cả
`portfolio-service.test.ts`, tệp nhập `WPT_ISSUE_PRICE_VND` từ `@/lib/bank/issuance`. Đó là lý do
`issuance.ts` **re-export** thay vì chuyển hẳn đường nhập: chuyển thì tệp test đó đỏ, và sửa nó là
chạm test đang xanh — việc bị cấm.

```
$ cd app && npm run typecheck
> tsc --noEmit
(không output = không lỗi)

$ cd app && npx eslint .
/Users/anbinh/.../app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)
```

Cảnh báo lint **vẫn đúng một cái, vẫn ở `src/empty.ts`** — Bước 6 không thêm cái nào. Cái này là
việc của Bước 7 (task 7.6/7.8).

```
$ cd app && npm run build

✓ Compiled successfully in 5.7s
  Running TypeScript ...
  Finished TypeScript in 5.7s ...
✓ Generating static pages using 9 workers (17/17) in 278ms

Route (app)
┌ ƒ /                        ├ ƒ /api/token          ├ ƒ /kyc
├ ƒ /_not-found              ├ ƒ /api/txns           ├ ƒ /mint
├ ƒ /api/balance             ├ ƒ /assets             ├ ƒ /portfolio
├ ƒ /api/investors           ├ ƒ /audit              ├ ƒ /reconciliation
├ ƒ /api/mint                                        ├ ƒ /tokens/[symbol]
├ ƒ /api/purchase                                    └ ƒ /wallet
ƒ  (Dynamic)  server-rendered on demand
```

**17/17 route.** Xóa `expireStaleOrdersAction` **không** làm mất route nào: server action không
phải một route, nó là một endpoint POST mà Next.js đăng ký theo tham chiếu từ phía client — mà
không màn hình nào tham chiếu tới nó. Đó chính là bằng chứng cho phương án (a3) của Q5.

```
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 8 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
$ echo "exit=$?"
exit=0
```

**8 điểm cắm / 11 điểm chặn — y nguyên số của Bước 5.** Đúng như dự đoán: xóa
`expireStaleOrdersAction` không làm mất marker nào, vì marker `@pending BE-07` nằm ở
`purchase.service.ts:543` (service), không ở server action. Hàm bị xóa vốn **không có** marker —
nó mang khối chú thích câu hỏi mở, và khối đó bị xóa cùng vì Owner đã trả lời.

```
$ bash scripts/run-local-all.sh

########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  @stellar/stellar-sdk không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 5 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  ... (20 PASS, 0 FAIL, 6 WARN — y nguyên Bước 5)
  PASS: 20   FAIL: 0   WARN: 6

########## TỔNG KẾT ##########
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
(bảng điểm cắm 19 dòng như trên — run-local-all in lại ở đây)
```

**7 PASS / 0 FAIL.** Sáu `WARN` của lớp 3 y nguyên Bước 4 và Bước 5.

Một điểm đáng ghi: `actions/bank.ts có 5 server action` vẫn PASS. Phép kiểm đó đếm server action
của `bank.ts`, không đếm `purchase.ts`, nên việc xóa một action ở `purchase.ts` không chạm nó.
Tức **không có phép kiểm tự động nào chốt số server action của `purchase.ts`** — chú thích ở đầu
tệp là thứ duy nhất giữ chủ đích "3 action cho 4 hàm service". Ghi ra để Supervisor biết đó là
chốt bằng văn bản, không phải chốt bằng máy.

---

## 4. Bảng phân loại đầy đủ export — số thật là **115**, không phải 27

### 4.1 Phép đo, và vì sao con số 27 không dùng được

Cách đo (chạy lại được, không phụ thuộc tệp tạm nào còn lại trong repo):

1. Lấy mọi ký hiệu `export` trong `app/src` + `packages/*/src` bằng **TypeScript compiler
   API**, không bằng regex. Regex bỏ sót `export { a, b }`, `export default`, `export * from`.
2. Với mỗi tên, tìm tệp **khác** có tham chiếu, trong đó "tham chiếu" = **token định danh
   thật**, không tính tên nằm trong bình luận hay chuỗi.
3. Bỏ qua tệp mà lần nhắc duy nhất là một dòng **re-export** của chính tên đó.

Script đo là tệp tạm ở `/tmp`, **đã xóa sau khi xong** — Bước 5 không có nhiệm vụ thêm công
cụ vào repo. Nội dung nó làm lại được bằng ba bước trên. Mỗi dòng của bảng dưới đây còn kèm
lệnh `grep` tự kiểm được.

**Cả ba cạm bẫy đều bắt được ca thật, không phải giả thiết:**

| # | Cạm bẫy | Ca thật gặp phải | Nếu bỏ qua thì kết luận sai thế nào |
|---|---|---|---|
| 1 | re-export qua barrel | `getDeployment` khai ở `addresses.ts`, re-export ở `index.ts`. Xét riêng thì **cả hai đầu đều "đang được dùng"** vì đầu này thấy đầu kia nhắc tên | Bỏ sót một mã chết thật |
| 2 | dùng gián tiếp qua mảng cấu hình | `hardhatLocal`, `evmTestnet` nằm trong `const chains = [hardhatLocal, evmTestnet]` | Kết luận oan là mã chết rồi **xóa mất hai chain của ví** |
| 3 | tên xuất hiện trong bình luận | `placeOrderAction` bị khối chú thích của `scripts/scan-pending.mjs:69` nhắc tên | Bỏ sót đúng điểm cắm quan trọng nhất |
| 4 | glob `**/*.ts` bỏ sót tệp ở thư mục gốc | Vòng đo đầu dùng `git ls-files 'app/src/**/*.ts'` → **thiếu 5 tệp**, trong đó có `app/src/empty.ts` và 4 tệp `packages/shared/src/*.ts` | Bỏ sót 15 ký hiệu, gồm cả nhóm `empty.ts` mà spec nêu đích danh |

```
$ git ls-files -- 'app/src/**/*.ts' 'app/src/**/*.tsx' 'packages/*/src/**/*.ts' | wc -l
     131
$ git ls-files -- app/src packages/shared/src | grep -E '\.tsx?$' | wc -l
     136
$ diff <(git ls-files -- 'app/src/**/*.ts' 'app/src/**/*.tsx' 'packages/*/src/**/*.ts' | sort) \
       <(git ls-files -- app/src packages/shared/src | grep -E '\.tsx?$' | sort)
59a60
> app/src/empty.ts
131a133,136
> packages/shared/src/addresses.ts
> packages/shared/src/chains.ts
> packages/shared/src/index.ts
> packages/shared/src/types.ts
```

**Số thật: 416 ký hiệu export có tên, trong đó 115 không có tệp nào bên ngoài dùng tới.**

Vì sao lệch 27 → 115: con số 27 **đếm hẹp hơn một bậc**. Nó không bao gồm ba nhóm mà phép quét
nào cũng phải gặp:

| Nhóm bị 27 bỏ ra | Số | Có phải mã chết không |
|---|---|---|
| Next.js gọi theo quy ước tệp (`export default` của `page`/`layout`, `GET`/`POST` của route) | 15 | **Không.** Xóa là xóa route |
| Thư viện giao diện sao chép vào (`components/ui/*`, shadcn) | 40 | **Không.** Xem 4.3 nhóm G |
| Kiểu/interface là mặt tiền của một hàm đã `export` trong cùng tệp | 24 | **Không.** Xem 4.3 nhóm E |

115 − 15 − 40 − 24 = **36**, và trong 36 đó có 11 ký hiệu của `app/src/empty.ts`. Còn **25** —
gần đúng con số 27 của Supervisor. Nói cách khác con số 27 **không sai về tinh thần**, nó chỉ
không phải con số đếm được lại bằng một phép đo viết ra được. Bảng dưới đây liệt kê **đủ 115
dòng** để đối chiếu từng cái.

Sai lệch nhỏ cần ghi: spec nói `src/empty.ts` có **12** export; đếm thật là **10 ký hiệu có
tên + 1 `export default {}` = 11**.

### 4.2 Việc đã làm — 13 chỗ trên 7 tệp

| Xử lý | Số | Ký hiệu |
|---|---|---|
| Gắn `@pending` | **7** | `placeOrderAction`(FE-05) · `executeOrderAction`(FE-06) · `listOrdersAction`(FE-06) · `getDistributionStore`(BE-06) · `getSettlementStore`(BE-05) · `getKeeperStore`(BE-07) · `createWalletSigner`(FE-05) |
| Bỏ từ khóa `export` | **4** | `amountSchema` · `orderIdSchema` · `hardhatLocal` · `evmTestnet` |
| **Xóa** | **2** | `getChainInfo` · `getDeployment` |
| Để nguyên, ghi câu hỏi mở | **5** | `expireStaleOrdersAction` · `tokenOverviewAction` · `resetSignerCache` · `resetChainRegistryCache` · `resetKycProviderCache` |
| Để nguyên, có lý do trong bảng | **97** | phần còn lại |

Hiệu quả đo lại được: **115 → 110** ký hiệu không có người dùng ngoài tệp.

```
$ diff <(danh sách ở 1f7757f) <(danh sách ở HEAD)
< amountSchema          (bỏ export)
< evmTestnet            (bỏ export)
< getChainInfo          (xóa)
< getDeployment         (xóa)
< hardhatLocal          (bỏ export)
< orderIdSchema         (bỏ export)
> DeploymentRecord      (MỚI vào danh sách — xem ghi chú dưới)
```

`DeploymentRecord` **mới xuất hiện** trong danh sách sau khi xóa `getDeployment`, vì hàm đó là
người dùng duy nhất của kiểu này ở ngoài `types.ts`. Nó **vẫn phải `export`**: `AddressBook`
(đang được dùng) khai `Partial<Record<ChainKey, DeploymentRecord>>`, nên kiểu này là mặt tiền
của một kiểu đã export — nhóm E. Ghi ra đây vì đó là hệ quả trực tiếp của việc xóa, không phải
phát hiện độc lập.

### 4.3 Chín nhóm phân loại

| Mã | Nhóm | Số | Xử lý |
|---|---|---|---|
| A | Điểm cắm chờ FE/BE — code chạy được, chưa ai gọi | 7 | gắn `@pending` |
| B | Dùng nội bộ trong chính tệp | 4 | bỏ `export` |
| C | Mã chết thật | 2 | **xóa** |
| D | Next.js gọi theo quy ước tệp | 15 | để nguyên |
| E | Mặt tiền kiểu/lỗi của một ký hiệu đã `export` trong cùng tệp | 25 | để nguyên |
| F | Kiểu đầu vào dùng chung FE/BE (`z.input`) | 6 | để nguyên |
| G | Thư viện giao diện sao chép vào (shadcn) | 40 | để nguyên |
| H | Giữ chỗ dựng ảnh Cloudflare (`src/empty.ts`) | 11 | **không chạm** — Bước 7 |
| I | Không xếp được | 5 | để nguyên + câu hỏi mở |

Hai nhóm không có trong bảng của `design.md` mục 6, và cả hai đều cần thiết:

- **Nhóm D và G** là hai nhóm mà cả `design.md` lẫn tài liệu giao việc đều không lường. Không
  tách chúng ra thì bảng có 55 dòng "mã chết" mà xóa dòng nào cũng làm hỏng ứng dụng.
- **Nhóm E** là phép phân biệt quan trọng nhất của Bước 5: `OrderView` không phải mã chết, nó
  là **kiểu trả về của `listOrders`**. Bỏ `export` khỏi nó thì FE-05 muốn khai một biến kiểu đó
  phải viết `Awaited<ReturnType<typeof listOrders>>`. Đó là **thu hẹp hợp đồng của module**, mà
  Bước 5 bị cấm đổi chữ ký.

**Nhóm "dùng trong test" mà `design.md` dự đoán thì KHÔNG TỒN TẠI.** `design.md` mục 6 xếp
`resetSignerCache`, `resetChainRegistryCache`, `resetKycProviderCache` vào nhóm này. Đo thật:

```
$ git grep -n 'resetSignerCache\|resetChainRegistryCache\|resetKycProviderCache' -- app packages scripts
app/src/lib/chains/registry.ts:76:export function resetChainRegistryCache(): void {
app/src/lib/providers/kyc/index.ts:24:export function resetKycProviderCache(): void {
app/src/lib/signer/index.ts:45:export function resetSignerCache(): void {
```

Chỉ có dòng khai báo. **Không test nào gọi cả ba.** Theo chỉ dẫn "không tìm được chỗ gọi thì nó
không thuộc nhóm này" → cả ba rơi sang nhóm I, xem câu hỏi mở Q7. Ba hàm cùng họ **thì có** người
gọi, nên phép đo không phải sai:

```
$ git grep -n 'resetServerEnvCache\|resetStoreCache\|resetMemoryStore' -- app/test | wc -l
      21
```

### 4.4 Bảng 115 dòng

Cột **bằng chứng** ghi lệnh chạy được. Lệnh dùng chung cho mọi dòng, thay `<TÊN>`:

```
grep -rn '\b<TÊN>\b' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.json' --include='*.md' --include='*.sh' . | grep -v node_modules | grep -v '.next/'
```

Viết tắt trong cột bằng chứng: **[chỉ-khai]** = lệnh trên chỉ ra dòng khai báo (và dòng
re-export nếu có); **[nội-bộ N]** = còn N chỗ dùng trong chính tệp đó; **[framework]** = Next.js
gọi theo tên tệp chứ không qua import.

⚠️ **Mọi số dòng trong bảng là số dòng tại `1f7757f`** (commit trước Bước 5), vì đó là trạng
thái mà phép đo chạy trên. Bảy tệp đã bị Bước 5 sửa nên số dòng hiện tại lệch vài đơn vị —
đối chiếu bằng `git show 1f7757f:<tệp>` thì khớp từng dòng.

#### Nhóm A — điểm cắm, đã gắn `@pending` (7)

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý | Bằng chứng |
|---|---|---|---|---|
| `placeOrderAction` | `app/src/app/actions/purchase.ts:25` | A | `@pending FE-05` | [chỉ-khai] + 1 dòng nhắc tên trong chú thích `scripts/scan-pending.mjs:69`. Mã task: `nav-config.ts:76` "`/purchase` chờ FE-05"; `tech-report.md:811`; quyền `order:place` = INVESTOR |
| `executeOrderAction` | `app/src/app/actions/purchase.ts:29` | A | `@pending FE-06` | [chỉ-khai]. Mã task **suy luận**: `order:execute` = BANK_ADMIN nên không thể nằm ở màn FE-05 của kênh `(client)`; `be-02/requirements.md:75` tách "đặt lệnh và theo dõi (FE-05, FE-06)" |
| `listOrdersAction` | `app/src/app/actions/purchase.ts:33` | A | `@pending FE-06` | [chỉ-khai]. Cùng suy luận: phần "theo dõi" |
| `getDistributionStore` | `app/src/lib/store/index.ts:121` | A | `@pending BE-06` | [chỉ-khai]. Mã task **có bằng chứng**: `tech-report.md:957` "`getDistributionStore().openPeriod()`" trong luồng chia lợi tức; `be-01/design.md:36`; `tech-report.md:338` mapping `snapshotId`→`distributionId` (BE-06) |
| `getSettlementStore` | `app/src/lib/store/index.ts:128` | A | `@pending BE-05` | [chỉ-khai]. Mã task **suy bằng loại trừ**: `be-01/requirements.md:73` nói BE-05 và BE-06 dựng danh sách ví "cần chia / cần tất toán"; BE-06 đã chứng minh là *chia* → BE-05 là *tất toán*. `tech-report.md:911` nối `getSettlementStore()` với luồng tất toán |
| `getKeeperStore` | `app/src/lib/store/index.ts:135` | A | `@pending BE-07` | [chỉ-khai]. Mã task **có bằng chứng**: `be-01/requirements.md:82` "tiến trình hẹn giờ (BE-07)"; `be-02/design.md:135` |
| `createWalletSigner` | `app/src/lib/signer/wallet.signer.ts:10` (+ re-export `signer/index.ts:9`) | A | `@pending FE-05` | [chỉ-khai]. LUẬT #2. Mã task: `wrong-chain-banner.tsx:26` nói FE-05/FE-09/FE-11 đều có **nút ký**; FE-05 là màn đầu tiên |

Marker đặt trên **khai báo thật** ở `wallet.signer.ts`, không đặt trên dòng re-export: dòng
re-export không khớp mẫu nào của `inferSymbol`, gắn ở đó thì `symbol` trong `--json` là `null`
và Bước 9 vẽ được ô không tên.

#### Nhóm B — dùng nội bộ, đã bỏ `export` (4)

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý | Bằng chứng |
|---|---|---|---|---|
| `amountSchema` | `app/src/lib/bank/schemas.ts:34` | B | bỏ `export` | [nội-bộ 2] — `mintSchema:52`, `placeOrderSchema:79`. Ngoài tệp: 0 |
| `orderIdSchema` | `app/src/lib/bank/schemas.ts:95` | B | bỏ `export` | [nội-bộ 1] — `executeOrderSchema:102`. Ngoài tệp: 0 |
| `hardhatLocal` | `app/src/lib/wagmi.ts:21` | B | bỏ `export` | [nội-bộ 2] — `chains:41`, `transports:63`. **Đây là cạm bẫy #2**: xóa thì mất chain của ví, `build` vẫn xanh vì `chains` rỗng kiểu vẫn hợp lệ |
| `evmTestnet` | `app/src/lib/wagmi.ts:31` | B | bỏ `export` | [nội-bộ 2] — `chains:41`, `transports:64` |

#### Nhóm C — mã chết thật, đã xóa (2)

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý | Bằng chứng |
|---|---|---|---|---|
| `getChainInfo` | `packages/shared/src/chains.ts:90` | C | **xóa** | Lệnh grep toàn repo (kể cả `docs/`) trả về **đúng một dòng**: dòng khai báo. Thân hàm là `return CHAINS[key]`, mà `CHAINS` được tra trực tiếp ở **25 dòng** (`git grep -nE 'CHAINS(\[\|\.)' -- app packages \| grep -v 'shared/src/chains.ts' \| wc -l`) |
| `getDeployment` | `packages/shared/src/addresses.ts:36` + `index.ts:9` | C | **xóa** | Lệnh grep trả về **hai dòng**: khai báo + re-export. Thân hàm là `return addressBook[chain]` (dòng 37), và `addressBook[chain]` đang dùng ngay ở dòng 45 trong `findContractAddress` |

Xác minh sau khi xóa: `npm run typecheck` · `npx eslint .` · `npm test` (285) · **`npm run build`
(17/17 route)** — xanh cả bốn, xem 3.7. Không dòng nào phải hoàn nguyên.

Một sai số nhỏ tự phát hiện: **thông điệp của commit `9ab73d5` ghi "`CHAINS[key]` dùng trực
tiếp ở 18 chỗ"**, đó là con số đếm bằng mắt từ một lần grep hẹp hơn. Đếm lại bằng lệnh viết ra
được thì là **25 dòng**. Kết luận không đổi (hàm bọc vẫn là dư), nhưng ghi ra đây vì commit đã
đẩy nên không sửa được thông điệp, và con số trong checkpoint mới là con số đúng.

#### Nhóm D — Next.js gọi theo quy ước tệp (15)

Tất cả: **để nguyên**, không marker. Bằng chứng chung: [framework] — App Router nạp theo tên
tệp và tên export quy ước, không có `import` nào trỏ tới. Xóa hoặc đổi tên = mất route.
`next build` sinh đúng **17/17** route là phép kiểm trực tiếp cho nhóm này.

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý |
|---|---|---|---|
| `Home` | `app/src/app/page.tsx:4` | D | để nguyên |
| `RootLayout` | `app/src/app/layout.tsx:19` | D | để nguyên |
| `AdminLayout` | `app/src/app/(admin)/layout.tsx:10` | D | để nguyên |
| `Assets` | `app/src/app/(admin)/assets/page.tsx:4` | D | để nguyên |
| `Kyc` | `app/src/app/(admin)/kyc/page.tsx:4` | D | để nguyên |
| `Mint` | `app/src/app/(admin)/mint/page.tsx:4` | D | để nguyên |
| `Reconciliation` | `app/src/app/(admin)/reconciliation/page.tsx:4` | D | để nguyên |
| `AuditLayout` | `app/src/app/(audit)/layout.tsx:9` | D | để nguyên |
| `AuditPage` | `app/src/app/(audit)/audit/page.tsx:18` | D | để nguyên |
| `ClientLayout` | `app/src/app/(client)/layout.tsx:16` | D | để nguyên |
| `PortfolioPage` | `app/src/app/(client)/portfolio/page.tsx:12` | D | để nguyên |
| `TokenDetailRoute` | `app/src/app/(client)/tokens/[symbol]/page.tsx:15` | D | để nguyên |
| `WalletPage` | `app/src/app/(client)/wallet/page.tsx:15` | D | để nguyên |
| `GET` | `api/balance/route.ts:5` · `api/purchase/route.ts:37` · `api/token/route.ts:6` · `api/txns/route.ts:5` | D | để nguyên |
| `POST` | `api/investors/route.ts:11` · `api/mint/route.ts:5` · `api/purchase/route.ts:23` | D | để nguyên |

#### Nhóm E — mặt tiền kiểu/lỗi của ký hiệu đã `export` trong cùng tệp (25)

Tất cả: **để nguyên**, không marker. Đây **không** phải mã chết: mỗi cái là kiểu trả về, kiểu
tham số, hoặc kiểu phần tử của một ký hiệu đang `export` trong cùng tệp. Bỏ `export` khỏi chúng
là thu hẹp hợp đồng của module — Bước 5 bị cấm đổi chữ ký.

| Ký hiệu | Tệp:dòng | Nhóm | Bằng chứng: đang là mặt tiền của |
|---|---|---|---|
| `OnboardResult` | `lib/bank/mint.service.ts:41` | E | `onboardInvestor():76` trả `Result<OnboardResult>` |
| `MintResult` | `lib/bank/mint.service.ts:50` | E | `mintTokens():136` |
| `TokenOverview` | `lib/bank/mint.service.ts:60` | E | `tokenOverview():266` |
| `OrderView` | `lib/bank/purchase.service.ts:42` | E | `placeOrder():95`, `listOrders():504` |
| `OrderExecutionView` | `lib/bank/purchase.service.ts:60` | E | `executeOrder():274` |
| `UnsupportedChainError` | `lib/chains/registry.ts:15` | E | **ném** ở `rpcUrlFor` (dòng 41) và `viemChainFor` (dòng 60). Xóa là phải đổi cả hai chỗ `throw` = đổi mã thực thi, Bước 5 cấm. Bỏ `export` là làm người gọi không `instanceof` được, và lệch với `SignerUnavailableError` / `LedgerNotImplementedError` đang export |
| `ServerEnv` | `lib/config/env.ts:101` | E | `serverEnv():137` |
| `ChainOption` | `lib/config/flags.ts:16` | E | trường `chains:27` của `PublicConfig:25` |
| `NativeBalanceView` | `lib/hooks/use-native-balance.ts:6` | E | `useNativeBalance():25` |
| `UseWalletStatusResult` | `lib/hooks/use-wallet-status.ts:24` | E | `useWalletStatus():53` |
| `MockLedgerSeed` | `lib/ledger/mock.adapter.ts:146` | E | tham số của `seedMockLedger():157` |
| `GenerationPoint` | `lib/mock-data.ts:132` | E | phần tử của `MOCK_GENERATION_SERIES:138` |
| `WalletStatusCardProps` | `components/wallet/wallet-status-card.tsx:12` | E | props của `WalletStatusCard` |
| `WrongChainBannerProps` | `components/wallet/wrong-chain-banner.tsx:6` | E | props của `WrongChainBanner` |
| `SignerKind` | `lib/signer/signer.port.ts:10` (+ barrel) | E | `ISigner.kind:13`, `SignerUnavailableError:25` — **hợp đồng LUẬT #2** |
| `ILedgerCompliance` | `lib/ledger/ledger.port.ts:49` (+ barrel) | E | thành phần của `ILedgerPort` — **hợp đồng LUẬT #1** |
| `ILedgerIssuance` | `lib/ledger/ledger.port.ts:68` (+ barrel) | E | như trên |
| `ILedgerPurchase` | `lib/ledger/ledger.port.ts:108` (+ barrel) | E | như trên |
| `ILedgerDistribution` | `lib/ledger/ledger.port.ts:158` (+ barrel) | E | như trên |
| `ILedgerRead` | `lib/ledger/ledger.port.ts:193` (+ barrel) | E | như trên |
| `NewDistributionPayout` | `lib/store/distribution.store.port.ts:105` (+ barrel) | E | trường `rows:158` của `createPayouts:156` — **hợp đồng `*.store.port.ts`** |
| `KeeperRunTerminalStatus` | `lib/store/keeper.store.port.ts:18` (+ barrel) | E | trường `status:54` — như trên |
| `ChainInfo` | `packages/shared/src/chains.ts:10` | E | `CHAINS: Record<ChainKey, ChainInfo>` |
| `ContractAddressMap` | `packages/shared/src/types.ts:35` | E | trường `contracts` của `DeploymentRecord` |
| `addressBook` | `packages/shared/src/addresses.ts:15` (+ barrel) | E | dùng ở dòng 45, trong `findContractAddress:41`. Là **dữ liệu**, không phải hàm bọc — khác `getDeployment` ở chỗ đó |

Hai ký hiệu **không** nằm trong 115 dòng nhưng liên quan, ghi để không ai tưởng bị bỏ qua:
`DeploymentRecord` (mới vào danh sách sau khi xóa `getDeployment`, xem 4.2) và `getSigner`.

**`getSigner` — `app/src/lib/signer/index.ts:25` — nhóm E, giữ `export`, không marker.**

Tài liệu giao việc yêu cầu đặc biệt cẩn thận với ký hiệu này, nên ghi rõ ba điều đo được:

1. **Nó KHÔNG phải "chưa ai gọi".** `getBankSigner:39` trong cùng tệp gọi nó ở dòng 41. Vì vậy nó không
   thuộc nhóm điểm cắm, và gắn `@pending` vào đây là **nói sai** — marker `@pending` nghĩa là
   "chưa ai gọi".
2. **Nó KHÔNG phải mã chết.** Không xóa.
3. **Vì sao cũng KHÔNG bỏ `export`,** dù xét theo định nghĩa thì nó là "dùng nội bộ":
   `getSigner(kind, chain)` là **cửa vào factory của LUẬT #2** — chỗ duy nhất chọn custody
   (`fireblocks` hay `server`). `getBankSigner` chỉ là một lối đi hẹp qua nó, đọc `kind` từ env.
   `tech.md` viết "Thêm custody = thêm 1 `ISigner`, **đổi factory**", và `workflow.md` đặt 3
   LUẬT kiến trúc thành cổng nghiệm thu bắt buộc. Thu hẹp mặt tiền của một cổng kiến trúc trong
   một bước **dọn dẹp**, để đổi lấy một dòng ít hơn trong bảng, là đánh đổi sai hướng.

   Nếu Supervisor muốn thu hẹp thì đó là một dòng sửa (`export function` → `function`) và
   `getBankSigner` vẫn chạy nguyên; nhưng tôi không tự quyết đổi mặt tiền của LUẬT #2 —
   xem Q8.

#### Nhóm F — kiểu đầu vào dùng chung FE/BE (6)

Tất cả: **để nguyên**, không marker, không bỏ `export`.

`tech.md` chốt "**Validation: Zod dùng chung cho server action + form (một schema, chống lệch
FE/BE)**". Sáu kiểu này là `z.input<typeof schema>` — chính là hình thức của cam kết đó ở phía
TypeScript, và chú thích trong mã nói thẳng mục đích: *"`z.input` để form dùng amount dạng
chuỗi; server nhận được bigint sau parse"*. Bỏ `export` là cắt đúng cái cầu nối đó.

Cũng **không** gắn `@pending`: steering mục 1 định nghĩa `@pending` là "code **đã chạy được**,
chỉ chưa ai gọi". Một kiểu không chạy và không gọi được. Dùng sai marker tệ hơn không có marker
(steering mục 3).

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý | Bằng chứng |
|---|---|---|---|---|
| `OnboardInvestorInput` | `lib/bank/schemas.ts:47` | F | để nguyên | [chỉ-khai]; `z.input<typeof onboardInvestorSchema>` |
| `MintInput` | `lib/bank/schemas.ts:55` | F | để nguyên | [chỉ-khai]; chú thích nêu rõ "để form dùng amount dạng chuỗi" |
| `PlaceOrderInput` | `lib/bank/schemas.ts:82` | F | để nguyên | [chỉ-khai]; chú thích nêu rõ "để form gửi `wptAmount` dạng chuỗi" |
| `ExecuteOrderInput` | `lib/bank/schemas.ts:104` | F | để nguyên | [chỉ-khai] |
| `OrderQueryInput` | `lib/bank/schemas.ts:120` | F | để nguyên | [chỉ-khai] |
| `ExpireOrdersInput` | `lib/bank/schemas.ts:130` | F | để nguyên | [chỉ-khai] |

#### Nhóm G — thư viện giao diện sao chép vào (40)

Tất cả: **để nguyên**, không marker, không xóa. Bằng chứng chung: [chỉ-khai] — mỗi tên xuất
hiện đúng hai chỗ trong tệp của nó (khai báo + dòng `export { ... }` ở cuối), không tệp nào
ngoài dùng.

Đây là các primitive shadcn/ui sao chép vào repo theo từng bộ. Ba lý do không xóa:

1. Chúng là **một bộ**. `Dialog` mà thiếu `DialogTitle` thì bộ đó không dùng được, mà bộ nào
   sẽ cần thì phụ thuộc FE-05/FE-06 vẽ màn gì — chưa biết.
2. Xóa lẻ từng export làm tệp **lệch bản gốc**, nên lần chạy `shadcn add` sau sẽ sinh diff giả.
3. Lợi ích bằng không: bundler đã loại bỏ cây chết, nên chúng không vào bundle sản phẩm.

Đây là **nhóm lớn nhất của cả 115 dòng (35 %)**, và không có trong bảng của `design.md`.
Xin Supervisor xác nhận, xem Q6.

| Tệp | Số | Ký hiệu | Nhóm | Xử lý |
|---|---|---|---|---|
| `components/ui/badge.tsx:52` | 1 | `badgeVariants` | G | để nguyên |
| `components/ui/button.tsx:58` | 1 | `buttonVariants` | G | để nguyên |
| `components/ui/card.tsx:98,100` | 2 | `CardFooter`, `CardAction` | G | để nguyên |
| `components/ui/dialog.tsx:150-159` | 10 | `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger` | G | để nguyên |
| `components/ui/dropdown-menu.tsx:254-267` | 11 | `DropdownMenuPortal`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` | G | để nguyên |
| `components/ui/select.tsx:191-200` | 10 | `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue` | G | để nguyên |
| `components/ui/table.tsx:111,115` | 2 | `TableFooter`, `TableCaption` | G | để nguyên |
| `components/ui/tooltip.tsx:66` | 3 | `TooltipProvider`, `TooltipTrigger`, `TooltipContent` | G | để nguyên |

#### Nhóm H — giữ chỗ dựng ảnh Cloudflare (11)

Tất cả: **KHÔNG CHẠM.** Thuộc Bước 7 (R7). Chỉ ghi vào bảng.

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý |
|---|---|---|---|
| `toClientEvmSigner` | `app/src/empty.ts:3` | H | Bước 7 |
| `toClientSvmSigner` | `app/src/empty.ts:4` | H | Bước 7 |
| `registerExactEvmScheme` | `app/src/empty.ts:5` | H | Bước 7 |
| `registerExactSvmScheme` | `app/src/empty.ts:6` | H | Bước 7 |
| `UptoEvmScheme` | `app/src/empty.ts:7` | H | Bước 7 |
| `ExactEvmScheme` | `app/src/empty.ts:8` | H | Bước 7 |
| `UptoSvmScheme` | `app/src/empty.ts:9` | H | Bước 7 |
| `ExactSvmScheme` | `app/src/empty.ts:10` | H | Bước 7 |
| `cdpSolanaAccountToSvmSigner` | `app/src/empty.ts:11` | H | Bước 7 |
| `ImageResponse` | `app/src/empty.ts:12` | H | Bước 7 |
| `export default {}` | `app/src/empty.ts:16` | H | Bước 7 — không tra được theo tên; cũng là chỗ sinh cảnh báo lint duy nhất của repo |

#### Nhóm I — không xếp được (5)

Tất cả: **để nguyên**, không marker, ghi câu hỏi mở. Không đoán.

| Ký hiệu | Tệp:dòng | Nhóm | Xử lý | Vì sao không xếp được |
|---|---|---|---|---|
| `expireStaleOrdersAction` | `app/src/app/actions/purchase.ts:37` | I | để nguyên, **Q5** | Hai tài liệu nói ngược nhau về việc có mở điểm vào HTTP hay không |
| `tokenOverviewAction` | `app/src/app/actions/bank.ts:36` | I | để nguyên, **Q5** | `TokenOverview` có `bankAddress` (hướng quản trị) nhưng màn `(admin)/assets` là trang trống chưa có mã task |
| `resetSignerCache` | `app/src/lib/signer/index.ts:45` | I | để nguyên, **Q7** | Seam kiểm thử tự khai "chỉ dùng trong test", nhưng không test nào gọi; không có mã task nào đúng nghĩa để gắn marker |
| `resetChainRegistryCache` | `app/src/lib/chains/registry.ts:76` | I | để nguyên, **Q7** | như trên |
| `resetKycProviderCache` | `app/src/lib/providers/kyc/index.ts:24` | I | để nguyên, **Q7** | như trên |

---

## 5. Kết quả các lần kiểm chứng bằng đột biến

| Phép kiểm | Đột biến | Kết quả |
|---|---|---|
| **Đột biến script quét** | 11 dòng marker trong một tệp tạm: 1 đúng, 9 sai theo 9 kiểu khác nhau, 1 ca đối chứng phải **không** bị báo → script phải đỏ và liệt kê đủ loại | ✅ **đỏ, `exit=1`, 9 lỗi / 6 mã lỗi**, ca đối chứng im lặng — xem dưới |
| **Test nguồn giá — đột biến 1** | Đổi giá ở **nguồn duy nhất** 100.000 → 123.000 → test nguồn giá phải **vẫn xanh** | ✅ **15/15 xanh**. Kèm phát hiện: 10 test cũ đỏ vì hardcode giá (SL-8) |
| **Test nguồn giá — đột biến 2** | **Tách lại thành hai hằng số** (mock khai lại `100_000n`, nguồn đổi thành 123.000) → phải **đỏ** | ✅ **12/15 đỏ** — 10 ca giá trị + 2 ca cấu trúc |
| **Test nguồn giá — đột biến 2b** | Khai lại hằng số với **đúng con số hôm nay** (giá không lệch) → phép so giá trị không thấy gì, phải còn ca nào đỏ | ✅ **2/15 đỏ**, đúng hai ca cấu trúc. Đây là lý do ba ca cấu trúc tồn tại |
| Script lớp 3 | Thêm `SPT` vào một tệp `app/src` → phải đỏ | _(chờ Bước 8)_ |

### Bốn đột biến của Bước 4 — `app/test/pending-markers.test.ts`

Cùng **một dòng** bị đột biến cả bốn lần: `app/src/lib/bank/purchase.service.ts:543`, marker
`@pending BE-07` thật trên `expireStaleOrders`. Chọn cùng một dòng có lý do: nếu bốn lần đỏ ở bốn
ca khác nhau trong khi chỉ đổi nội dung marker, thì bốn ca đó thật sự phân biệt được bốn loại lỗi
chứ không phải cùng một phép kiểm mang bốn cái tên.

| Ca | Đột biến dán vào dòng 543 | Ca đỏ | Số ca đỏ | Thông báo có chỉ đúng tệp:dòng? |
|---|---|---|---|---|
| **1** `BAD_SYNTAX` | `@pending BE-07` *(bỏ dấu `\|`)* | ✅ **ca 1** | 1/13 | ✅ `purchase.service.ts:543` |
| **2** `UNKNOWN_TASK` | `@pending XX-99 \| <mô tả cũ>` | ✅ **ca 2** | 1/13 | ✅ `purchase.service.ts:543` |
| **3** `STALE_TASK` | `@pending BE-02 \| <mô tả cũ>` | ✅ **ca 3** | 1/13 | ✅ `purchase.service.ts:543` |
| **4** `VAGUE_NOTE` | `@pending BE-07 \| chờ làm` | ✅ **ca 4** | 1/13 | ✅ `purchase.service.ts:543` |

Mỗi lần **đúng một ca đỏ**, 12 ca còn lại xanh. Đó là điều cần chứng minh: không có ca nào đỏ
theo kiểu dây chuyền, nên đọc tên ca đỏ là biết ngay loại lỗi.

#### Đột biến 1 (task 4.2 mở rộng) — ca 3, marker chờ task đã `done`

```
$ perl -i -pe 's/\@pending BE-07 \|/\@pending BE-02 |/ if $. == 543' app/src/lib/bank/purchase.service.ts
$ cd app && npm test -- pending-markers

 ❯ test/pending-markers.test.ts (13 tests | 1 failed) 13ms
   ✓ Marker điểm cắm trong repo thật > phạm vi quét đọc được mã nguồn thật, không rỗng 2ms
   ✓ Marker điểm cắm trong repo thật > ca 1 — mọi marker đúng cú pháp 0ms
   ✓ Marker điểm cắm trong repo thật > ca 2 — mã task trong marker đều tồn tại 0ms
   × Marker điểm cắm trong repo thật > ca 3 — không marker nào chờ task đã hoàn thành 3ms
     →
  [STALE_TASK] — Task đã `done` mà marker vẫn chờ nó. Đúng hai cách sửa, chọn một:
    (a) DỌN MARKER — điểm cắm đã được dùng, marker hết việc (steering mục 7, vế b);
    (b) bỏ mã khỏi "done" trong `.kiro/task-status.json` — task chưa thật sự xong.
  Không có cách thứ ba. Nới phép kiểm cho xanh là bỏ luôn lý do test này tồn tại.
: expected [ Array(1) ] to deeply equal []
   ✓ Marker điểm cắm trong repo thật > ca 4 — mô tả marker không rỗng và không chung chung 0ms
   ✓ Marker điểm cắm trong repo thật > chốt chặn — không còn loại lỗi marker nào khác 0ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > đối chứng: marker đúng thì không sinh lỗi và vào được bảng 1ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > nhiều điểm cắm cũng không phải lỗi 1ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > 'ca 1' — 'thiếu dấu | sau mã task' phải sinh 'BAD_SYNTAX' 1ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > 'ca 2' — 'mã task không có trong nguồn trạng th…' phải sinh 'UNKNOWN_TASK' 0ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > 'ca 3' — 'marker chờ task đã done' phải sinh 'STALE_TASK' 0ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > 'ca 4' — 'mô tả chung chung' phải sinh 'VAGUE_NOTE' 0ms
   ✓ Phép kiểm có răng — đột biến trên repo giả > nguồn trạng thái task hỏng thì báo đỏ, không im lặng bỏ qua 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/pending-markers.test.ts > Marker điểm cắm trong repo thật > ca 3 — không marker nào chờ task đã hoàn thành
AssertionError:
  [STALE_TASK] — Task đã `done` mà marker vẫn chờ nó. Đúng hai cách sửa, chọn một:
    (a) DỌN MARKER — điểm cắm đã được dùng, marker hết việc (steering mục 7, vế b);
    (b) bỏ mã khỏi "done" trong `.kiro/task-status.json` — task chưa thật sự xong.
  Không có cách thứ ba. Nới phép kiểm cho xanh là bỏ luôn lý do test này tồn tại.
: expected [ Array(1) ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "app/src/lib/bank/purchase.service.ts:543
+       marker lạc hậu: BE-02 đã done. Task xong thì phải dọn marker (steering mục 7, vế b)",
+ ]
 ❯ test/pending-markers.test.ts:102:61

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

Thông báo nói đủ ba thứ người sửa cần: **task nào** đã done, **ở đâu** (`tệp:dòng`, dán được vào
terminal), và **hai cách sửa duy nhất** — dọn marker, hoặc bỏ mã khỏi `done`. Câu cuối cố ý chặn
cách thứ ba: nới phép kiểm cho xanh.

Hoàn nguyên, test xanh lại:

```
$ git checkout -- app/src/lib/bank/purchase.service.ts
$ cd app && npm test -- pending-markers
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

#### Đột biến 2 (task 4.3) — ca 2, mã task không tồn tại

```
$ perl -i -pe 's/\@pending BE-07 \|/\@pending XX-99 |/ if $. == 543' app/src/lib/bank/purchase.service.ts
$ cd app && npm test -- pending-markers

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/pending-markers.test.ts > Marker điểm cắm trong repo thật > ca 2 — mã task trong marker đều tồn tại
AssertionError:
  [UNKNOWN_TASK] — Mã task phải nằm trong `.kiro/task-status.json` (hợp done + inProgress + planned).
  Mở tệp đó ra: hoặc bạn gõ sai mã, hoặc task này chưa được khai. Đừng sửa test.
: expected [ Array(1) ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "app/src/lib/bank/purchase.service.ts:543
+       mã task XX-99 không có trong .kiro/task-status.json (hợp done + inProgress + planned)",
+ ]
 ❯ test/pending-markers.test.ts:98:65

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

#### Đột biến 3 — ca 1, marker sai cú pháp (bỏ dấu `|`)

```
$ perl -i -pe 's/\@pending BE-07 \|/\@pending BE-07/ if $. == 543' app/src/lib/bank/purchase.service.ts
$ sed -n '543p' app/src/lib/bank/purchase.service.ts | cut -c1-60
 * @pending BE-07 đã sẵn đầu cuối: validate Zod, kiểm quyền

$ cd app && npm test -- pending-markers

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/pending-markers.test.ts > Marker điểm cắm trong repo thật > ca 1 — mọi marker đúng cú pháp
AssertionError:
  [BAD_SYNTAX] — Cú pháp đúng, chọn một trong ba dạng:
    // @pending <MÃ-TASK> | <đã sẵn những gì>
    // @blocked <MÃ-TASK> | <thiếu gì>
    // @flow <tên-luồng>:<số nguyên> | <việc của bước này>
  Hay quên nhất: thiếu dấu | , hoặc mô tả rỗng, hoặc số bước ghi thập phân.
  Marker phải đứng ngay sau dấu mở chú thích (`// @pending ...`), không lọt giữa câu văn.
: expected [ Array(1) ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "app/src/lib/bank/purchase.service.ts:543
+       có từ khóa marker nhưng sai cú pháp. Đúng phải là \"@pending <MÃ-TASK> | <mô tả>\", \"@blocked <MÃ-TASK> | <mô tả>\" hoặc \"@flow <tên-luồng>:<số nguyên> | <mô tả>\"",
+ ]
 ❯ test/pending-markers.test.ts:94:61

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

Marker mất dấu `|` **không** trôi thành "không phải marker" rồi im lặng — đó mới là kiểu hỏng nguy
hiểm, vì điểm cắm biến mất khỏi bảng mà không ai được báo.

#### Đột biến 4 — ca 4, mô tả chung chung

```
$ perl -i -pe 's/^ \* \@pending BE-07 \|.*$/ * \@pending BE-07 | chờ làm/ if $. == 543' app/src/lib/bank/purchase.service.ts
$ sed -n '543p' app/src/lib/bank/purchase.service.ts
 * @pending BE-07 | chờ làm

$ cd app && npm test -- pending-markers

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/pending-markers.test.ts > Marker điểm cắm trong repo thật > ca 4 — mô tả marker không rỗng và không chung chung
AssertionError:
  [VAGUE_NOTE] — Mô tả sau dấu | vô dụng với người đọc. Người nhận task đọc đúng câu đó để biết
  mình KHÔNG phải viết lại cái gì (@pending) hoặc còn thiếu đúng cái gì (@blocked).
  Ngưỡng: tối thiểu 15 ký tự, và không được gần như chỉ gồm một cụm
  vô nghĩa (chờ làm, sẽ làm, chưa làm, cần làm, làm sau, xem sau, chờ task, chờ fe, chờ be, sau này, tbd, wip, n/a).
  Ví dụ đủ: "đã sẵn: validate Zod + kiểm quyền + ghi sổ kiểm toán, chỉ cần gọi".
: expected [ Array(1) ] to deeply equal []
- Expected
+ Received
+ [
+   "app/src/lib/bank/purchase.service.ts:543
+       @pending BE-07: mô tả chỉ 7 ký tự, dưới mức tối thiểu 15. Mô tả phải nói rõ ĐÃ SẴN gì, vì người nhận BE-07 đọc đúng câu này để biết mình không phải viết lại cái gì",
+ ]
 ❯ test/pending-markers.test.ts:108:61

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

Danh sách cụm vô nghĩa trong thông báo **nhập từ `VAGUE_PHRASES`**, không gõ tay vào test. Thêm
cụm vào script thì hướng dẫn sửa tự cập nhật theo.

#### Chứng minh đột biến không lọt vào commit

Sau lần hoàn nguyên cuối:

```
$ git checkout -- app/src/lib/bank/purchase.service.ts
$ git status --short -- app packages scripts
(rỗng)
$ git diff -- app packages scripts
(rỗng)
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0
$ cd app && npm test
 Test Files  12 passed (12)
      Tests  285 passed (285)
```

**Một điểm phải nói rõ:** `git status --short` **không** giới hạn phạm vi thì còn một dòng
` M .kiro/specs/mc-01-make-control/tasks.md`. Đó **không phải** đột biến còn sót, mà là trạng thái
checkbox do bộ theo dõi task của Kiro tự ghi (`[~]` → `[-]` → `[x]`) — cùng hiện tượng SL-1 đã ghi
ở Bước 1. Vì vậy phép kiểm "đột biến không lọt vào commit" giới hạn vào `app packages scripts`,
tức đúng những đường dẫn đột biến có thể chạm tới. Ghi cách giới hạn ra đây để Supervisor kiểm lại
được, thay vì dán một lệnh `git diff` trơn rồi phải giải thích một dòng lạ.

### Đột biến script quét — chi tiết

Tệp tạm `app/src/lib/__scan-probe.ts`, mỗi marker gắn trên một hàm thật để kiểm luôn phần suy
tên ký hiệu. Nội dung gồm: một marker **đúng**, một thiếu dấu `|`, một mã **không tồn tại**, một
mã **đã done**, `@flow purchase:2` **không có bước 1**, một biến thể `@blocked-by`, một `TODO`,
một tên luồng ngoài năm tên, một mô tả **rỗng**, một số bước **thập phân**, và một câu văn chỉ
**nhắc tên** từ khóa giữa dòng (ca đối chứng: phải **không** bị báo lỗi).

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Có 9 lỗi marker:

  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:8
      có từ khóa marker nhưng sai cú pháp. Đúng phải là "@pending <MÃ-TASK> | <mô tả>", "@blocked <MÃ-TASK> | <mô tả>" hoặc "@flow <tên-luồng>:<số nguyên> | <mô tả>"
  [UNKNOWN_TASK] app/src/lib/__scan-probe.ts:13
      mã task XX-99 không có trong .kiro/task-status.json (hợp done + inProgress + planned)
  [STALE_TASK] app/src/lib/__scan-probe.ts:18
      marker lạc hậu: BE-02 đã done. Task xong thì phải dọn marker (steering mục 7, vế b)
  [BAD_FLOW_STEP] app/src/lib/__scan-probe.ts:23
      luồng "purchase" bắt đầu ở bước 2, phải bắt đầu từ 1 (thiếu bước đầu = có ai xóa hàm mà quên sửa marker)
  [FORBIDDEN_KEYWORD] app/src/lib/__scan-probe.ts:28
      từ khóa bị cấm: @blocked-by — steering mục 5 chỉ cho @pending, @blocked, @flow; cần diễn đạt khác thì viết sau dấu |
  [FORBIDDEN_KEYWORD] app/src/lib/__scan-probe.ts:33
      từ khóa bị cấm: TODO — steering mục 5 chỉ cho @pending, @blocked, @flow; cần diễn đạt khác thì viết sau dấu |
  [BAD_FLOW_NAME] app/src/lib/__scan-probe.ts:38
      tên luồng "refund" không thuộc năm tên đã chốt: purchase, issue, distribute, settle, onboard
  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:43
      @blocked SC-04 có mô tả rỗng — phải nói rõ THIẾU gì
  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:48
      có từ khóa marker nhưng sai cú pháp. Đúng phải là "@pending <MÃ-TASK> | <mô tả>", "@blocked <MÃ-TASK> | <mô tả>" hoặc "@flow <tên-luồng>:<số nguyên> | <mô tả>"

Quy ước: .kiro/steering/make-control.md
exit=1
```

Bắt đủ **6 mã lỗi** mà tài liệu giao việc đòi: `BAD_SYNTAX`, `UNKNOWN_TASK`, `STALE_TASK`,
`FORBIDDEN_KEYWORD`, `BAD_FLOW_NAME`, `BAD_FLOW_STEP`. Bốn loại mà tài liệu nêu tên đích danh
(sai cú pháp · mã không tồn tại · mã đã done · `@flow` thiếu bước 1) đều có mặt.

Ca đối chứng ở dòng 52 (câu văn nhắc tên từ khóa) **không** sinh lỗi — đúng ý, xem SL-4.

Hoàn nguyên: xóa tệp probe, `--check` xanh lại, và probe **không lọt vào commit**.

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 0 điểm cắm, 0 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0

$ git status --short
 M .kiro/specs/mc-01-make-control/tasks.md
 M scripts/run-local-all.sh
 M scripts/scan-pending.mjs

$ ls app/src/lib/__scan-probe.ts
ls: app/src/lib/__scan-probe.ts: No such file or directory
```

### Ba đột biến của Bước 6 — `app/test/issue-price-single-source.test.ts`

Hai đột biến mà tài liệu giao việc đòi đi **ngược hướng nhau**, và đó là điểm cốt yếu: một phép
kiểm hardcode giá sẽ **đỏ ở cả hai**, nên nó không phân biệt được "hai chỗ lệch nhau" với "giá
khác 100.000". Chỉ khi đột biến 1 xanh **và** đột biến 2 đỏ thì test mới đang kiểm đúng tính chất.

Đột biến 2b do Kiro thêm: nó bịt lỗ hổng mà cả hai đột biến kia bỏ ngỏ.

| # | Đột biến | Kỳ vọng | Kết quả |
|---|---|---|---|
| **1** | Nguồn duy nhất: `100_000` → `123_000` | **xanh** (cả hai tầng cùng đổi theo) | ✅ **15/15 xanh** |
| **2** | Mock khai lại `100_000n` **+** nguồn đổi `123_000` → hai chỗ lệch | **đỏ** | ✅ **12/15 đỏ** |
| **2b** | Mock khai lại `100_000n`, nguồn **giữ** `100_000` → hai chỗ **không** lệch | phải còn ca đỏ, nếu không thì test chỉ bắt được lệch giá trị | ✅ **2/15 đỏ**, đúng hai ca cấu trúc |

#### Đột biến 1 — đổi giá ở nguồn duy nhất, phải VẪN XANH

```
$ perl -pi -e 's/^export const WPT_ISSUE_PRICE_VND = 100_000;$/export const WPT_ISSUE_PRICE_VND = 123_000;/' \
    app/src/lib/config/issue-terms.ts
$ git diff -- app/src/lib/config/issue-terms.ts
@@ -44,4 +44,4 @@
  */
 /** Giá phát hành một WPT, đơn vị VND. WPT có decimals = 0 nên đây là giá của trọn một token. */
-export const WPT_ISSUE_PRICE_VND = 100_000;
+export const WPT_ISSUE_PRICE_VND = 123_000;

$ cd app && npx vitest run test/issue-price-single-source.test.ts
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

Đúng kỳ vọng: test không biết con số 100.000, nó chỉ biết "giá ở nguồn" và "lượng × giá ở nguồn".

Nhưng chạy **toàn bộ** suite dưới cùng đột biến thì ra một chuyện khác:

```
$ cd app && npx vitest run
   × R2 — khớp lệnh mua > báo giá chỉ nhân số lượng với giá bán, không gọi nguồn tỷ giá nào
   × R2 — khớp lệnh mua > khớp lệnh chuyển VNDB và WPT trong cùng một lần gọi
   × R2 — khớp lệnh mua > CHẶN khớp lệnh khi thiếu ủy quyền VNDB dù số dư đủ
   × R2 — khớp lệnh mua > CHẶN khớp lệnh khi ví SPV thiếu WPT, và KHÔNG trừ VNDB
   × R4 — chốt quyền và đọc số dư theo thời điểm > mua WPT sau khi chốt quyền thì balanceOfAt ở mã snapshot cũ KHÔNG đổi
   × placeOrder > tính đúng số VNDB phải trả và lưu vào lệnh
   × executeOrder — từ chối trước khi gửi giao dịch > giá đổi sau khi đặt lệnh thì REJECTED với PRICE_CHANGED
   × 7.5 — khớp lệnh thành công > số dư hai bên đổi đúng, cả WPT và VNDB
   × 7.7 — một lệnh chỉ gửi đúng một giao dịch > gọi executeOrder hai lần tuần tự: chỉ một lần gửi
   × 7.7 — một lệnh chỉ gửi đúng một giao dịch > gọi đồng thời hai lần: chỉ một lần gửi, một lời gọi bị chặn

 AssertionError: expected 9631000n to be 9700000n
 ❯ test/purchase-service.test.ts:483:53

   Test Files  2 failed | 11 passed (13)
        Tests  10 failed | 290 passed (300)
```

`9_631_000 = 10_000_000 − 3 × 123_000` còn `9_700_000 = 10_000_000 − 3 × 100_000`: mười ca này
hardcode số VNDB suy ra từ giá 100.000. Tài liệu giao việc nói "nếu đỏ thì test đang hardcode giá,
sửa test" — nhưng mười ca đỏ **không phải** test của Bước 6, chúng nằm trong 285 test đang xanh mà
Bước 6 bị **cấm sửa**. Đã để nguyên và ghi thành SL-8 ở mục 10.

#### Đột biến 2 — tách lại thành hai hằng số, phải ĐỎ

```
$ git diff -- app/src/lib/config/issue-terms.ts app/src/lib/ledger/mock.adapter.ts
    -export const WPT_ISSUE_PRICE_VND = 100_000;
    +export const WPT_ISSUE_PRICE_VND = 123_000;
    -const DEFAULT_WPT_PRICE_VND = BigInt(WPT_ISSUE_PRICE_VND);
    +const DEFAULT_WPT_PRICE_VND = 100_000n;

$ cd app && npx vitest run test/issue-price-single-source.test.ts
   ✓ nguồn duy nhất là số nguyên dương, không phải undefined hay 0
   × quotePurchase cho 1 WPT bằng đúng giá ở nguồn duy nhất
     → expected 100000n to be 123000n
   × quotePurchase cho 2n WPT = lượng × giá ở nguồn duy nhất
     → expected 200000n to be 246000n
   × quotePurchase cho 7n WPT = lượng × giá ở nguồn duy nhất
     → expected 700000n to be 861000n
   × quotePurchase cho 250n WPT = lượng × giá ở nguồn duy nhất
     → expected 25000000n to be 30750000n
   × quotePurchase cho 1000000n WPT = lượng × giá ở nguồn duy nhất
     → expected 100000000000n to be 123000000000n
   × quotePurchase cho 123456789n WPT = lượng × giá ở nguồn duy nhất
     → expected 12345678900000n to be 15185185047000n
   × giá hiển thị và giá khớp lệnh cho 1 WPT là cùng một con số
     → expected '123000' to be '100000'
   × giá hiển thị và giá khớp lệnh cho 3 WPT là cùng một con số
     → expected '369000' to be '300000'
   × giá hiển thị và giá khớp lệnh cho 250 WPT là cùng một con số
     → expected '30750000' to be '25000000'
   × giá hiển thị và giá khớp lệnh cho 1000000 WPT là cùng một con số
     → expected '123000000000' to be '100000000000'
   ✓ re-export ở lib/bank/issuance.ts là chính giá ở nguồn duy nhất
   × mock.adapter.ts suy ra giá từ nguồn duy nhất, không khai bằng số
     → Giá phải suy ra từ `WPT_ISSUE_PRICE_VND` (nguồn: lib/config/issue-terms.ts), không được
       khai bằng số đếm ở đây.: expected '100_000n' to contain 'WPT_ISSUE_PRICE_VND'
   ✓ lib/bank/issuance.ts re-export, không khai lại hằng số
   × cả app/src chỉ có MỘT tệp khai hằng số giá bằng số đếm
     → Mỗi dòng ở đây là một nguồn giá. Hơn một dòng nghĩa là giá lại có hai nguồn — nhập từ
       `lib/config/issue-terms.ts` thay vì khai thêm.: expected [ …(2) ] to deeply equal [ Array(1) ]

   Test Files  1 failed (1)
        Tests  12 failed | 13 passed (15)
```

Ba ca xanh sót lại nói đúng chuyện: giá ở nguồn vẫn dương, `issuance.ts` vẫn re-export đúng — hai
điều đó **thật sự** không bị đột biến này chạm. Không có ca nào đỏ theo kiểu dây chuyền.

#### Đột biến 2b — khai lại hằng số với ĐÚNG con số hôm nay

Đây là dạng nguy hiểm nhất của việc tách nguồn, vì hôm nay nó **không** gây sai số nào:

```
$ git diff -- app/src/lib/config/issue-terms.ts app/src/lib/ledger/mock.adapter.ts
    -const DEFAULT_WPT_PRICE_VND = BigInt(WPT_ISSUE_PRICE_VND);
    +const DEFAULT_WPT_PRICE_VND = 100_000n;
    (nguồn duy nhất giữ nguyên 100_000)

$ cd app && npx vitest run test/issue-price-single-source.test.ts
     ✓ quotePurchase cho 2n WPT = lượng × giá ở nguồn duy nhất
     ✓ quotePurchase cho 7n WPT = lượng × giá ở nguồn duy nhất
     ✓ quotePurchase cho 250n WPT = lượng × giá ở nguồn duy nhất
     ✓ quotePurchase cho 1000000n WPT = lượng × giá ở nguồn duy nhất
     ✓ quotePurchase cho 123456789n WPT = lượng × giá ở nguồn duy nhất
     × mock.adapter.ts suy ra giá từ nguồn duy nhất, không khai bằng số
     × cả app/src chỉ có MỘT tệp khai hằng số giá bằng số đếm

   Test Files  1 failed (1)
        Tests  2 failed | 13 passed (15)
```

**Mọi phép so giá trị đều xanh.** Nếu test chỉ có các ca so giá trị thì repo vừa quay về đúng hiện
trạng mà R5.2 mô tả — hai hằng số độc lập — và không ai biết, cho tới lần đổi giá sau. Hai ca đỏ
là hai ca **cấu trúc**, và đây là toàn bộ lý do chúng tồn tại.

#### Hoàn nguyên

```
$ git diff --stat -- app packages scripts
(rỗng)
$ git status --short
 M .kiro/specs/mc-01-make-control/tasks.md
$ cd app && npx vitest run
   Test Files  13 passed (13)
        Tests  300 passed (300)
```

Một lưu ý về phép kiểm này: đột biến 1 ở lần chạy **đầu tiên** không kiểm được bằng `git diff`, vì
lúc đó `issue-terms.ts` còn là tệp **chưa theo dõi** (`??`) nên `git diff` không thấy nó. Đã commit
mã nguồn và test **trước**, rồi chạy lại cả hai đột biến từ trạng thái đã commit — output ở trên là
của lần chạy sau, và lúc này `git diff` là phép kiểm có giá trị thật.

---

## 6. Lựa chọn chỗ đặt hằng số giá phát hành và lý do

### 6.1 Bằng chứng chiều phụ thuộc — đo trước khi quyết

Câu hỏi: `lib/ledger` nhập từ `lib/bank` có ngược tầng không? Đo hai chiều bằng `git grep` trên
chính câu lệnh `import`:

```
$ git grep -nE "from '(@/lib/bank|\.\./bank)" -- 'app/src/lib/ledger'
(không có dòng nào — 0 chỗ)

$ git grep -nE "from '(@/lib/ledger|\.\./ledger)" -- 'app/src/lib/bank'
app/src/lib/bank/authorize.ts:4:import { LedgerError, InvalidAddressError } from '@/lib/ledger';
app/src/lib/bank/mint.service.ts:4:import { getLedger, receiptTimeoutFor } from '@/lib/ledger';
app/src/lib/bank/portfolio.service.ts:5:import { getLedger } from '@/lib/ledger';
app/src/lib/bank/purchase.service.ts:4:import { getLedger, receiptTimeoutFor, type ILedgerPort, type TxResult } from '@/lib/ledger';
```

| Chiều | Số chỗ |
|---|---|
| `lib/bank` (nghiệp vụ) → `lib/ledger` (cổng) | **4** |
| `lib/ledger` (cổng) → `lib/bank` (nghiệp vụ) | **0** |

Chiều phụ thuộc hiện có là **một chiều**, và `structure.md` xác nhận đó là chiều đúng: `lib/ledger`
là tầng cổng (`ILedgerPort` + adapter ra chuỗi), `lib/bank` là tầng nghiệp vụ. Nên cách mà
`design.md` mục 4 phác ra — `mock.adapter` nhập `@/lib/bank/issuance` — **là ngược tầng**, và nó sẽ
là chỗ ngược tầng **duy nhất** trong cả `app/src/lib`.

Đó không chỉ là chuyện hình thức. Hậu quả cụ thể:

```
bank/portfolio.service → ledger/index → ledger/mock.adapter → bank/issuance
```

`ledger/index.ts` nhập `mock.adapter`, nên nếu `mock.adapter` nhập ngược về `lib/bank` thì đồ hình
trên thành một **vòng** ngay khi `issuance.ts` nhập bất cứ thứ gì từ `lib/bank` — điều rất dễ xảy
ra, vì `issuance.ts` là tệp nghiệp vụ. Hôm nay `issuance.ts` không nhập gì nên chưa vỡ, tức đây là
cái bẫy **đang mở** chứ không phải đã sập.

Và chỗ nó sập là chỗ tệ nhất: `mock.adapter` dùng giá ở **phạm vi module**
(`const DEFAULT_NAV_RATE = DEFAULT_WPT_PRICE_VND;`), đúng lúc module đang khởi tạo. Trong vòng phụ
thuộc, giá trị ở đó là `undefined` (hoặc ném TDZ, tuỳ bundler) → `BigInt(undefined)` ném, hoặc giá
thành `0` và khớp lệnh biến thành "mua không mất tiền". `lessons.md` đã ghi đúng loại lỗi đó:
*"Mock adapter dễ tính hơn contract thật → SAI … giá bán mặc định 0 làm khớp lệnh thành mua không
mất tiền"*.

### 6.2 Chọn `app/src/lib/config/issue-terms.ts`

```
app/src/lib/config/issue-terms.ts     ← NGUỒN DUY NHẤT
        ↑                    ↑
lib/bank/issuance.ts    lib/ledger/mock.adapter.ts
(re-export + wptToVnd)  (BigInt(...) cho DEFAULT_WPT_PRICE_VND)
```

Bốn lý do, theo thứ tự quan trọng:

| # | Lý do |
|---|---|
| 1 | **Cả hai tầng nhập xuống đều thuận.** `lib/config` là tầng cấu hình, dưới cả nghiệp vụ và cổng. Không tạo chỗ ngược tầng nào, và `lib/config` hiện **không** nhập từ `lib/bank` hay `lib/ledger` (đo: 0 chỗ) nên không có vòng nào |
| 2 | **BE-04 chỉ phải đổi một chỗ.** Khi giá vào cơ sở dữ liệu, hằng số này thành "giá mặc định khi chưa cấu hình". Cơ sở dữ liệu (Prisma) nằm trong `app/`, cùng tầng với `lib/config`, nên BE-04 sửa một tệp trong cùng cây với chỗ nó đọc DB |
| 3 | **Ngữ nghĩa khớp tên thư mục.** Giá phát hành là *tham số cấu hình do ngân hàng ấn định*, không phải số liệu thị trường (lập luận đầy đủ đi theo hằng số sang tệp mới) |
| 4 | **Không phải sửa test đang xanh.** `issuance.ts` re-export nên `portfolio-service.test.ts` giữ nguyên đường nhập `@/lib/bank/issuance` |

Vì sao **không** chọn `packages/shared`:

| # | Lý do |
|---|---|
| 1 | `structure.md` khoanh phạm vi của nó: *"ABI (generated), addresses.json, chain config, types"*. Giá phát hành không thuộc bốn thứ đó |
| 2 | `packages/shared` còn được dùng bởi toolchain hợp đồng (`packages/contracts-evm`). Đặt một điều khoản phát hành ở đó là mở nó ra cho cả script deploy, trong khi **không contract nào** đọc con số này — mở rộng bán kính ảnh hưởng mà không được gì |
| 3 | BE-04 sẽ phải **chuyển nó lần nữa** về `app/` để đọc giá từ DB, tức hai lần đổi thay vì một |

**Không** phải lý do, và nói rõ để Supervisor không đọc nhầm: **kích thước bundle không phân biệt
được hai ứng viên.** `packages/shared` vốn đã được bundle vào worker (chain config, ABI), và một
hằng số số nguyên thì gần như không có kích thước. `lessons.md` nói *"đồ nặng để ở packages, không
ship nguyên vào worker"* — bài học đó nhắm hardhat/ethers/artifact, không nhắm một con số. Cả hai
ứng viên đều không vi phạm nó.

### 6.3 Hằng số có vào bundle client không, và có đường nào cho ra `undefined`/`0` không

Trả lời câu hỏi của tài liệu giao việc, bằng đo chứ không bằng suy đoán:

**Hôm nay: không vào bundle client.** Hai người dùng đều là tệp `server-only`
(`portfolio.service.ts`, `mock.adapter.ts`). Các component chỉ nhập **kiểu** (`import type
{ PortfolioView }`), mà kiểu bị xoá lúc biên dịch. Con số đến được trình duyệt dưới dạng **dữ
liệu** trong `PortfolioView.issuePriceVnd`, không phải dưới dạng module được nhập.

**Nhưng tệp nguồn CỐ Ý không đặt `import 'server-only'`**, khác `env.ts` và `flags.ts` cùng thư
mục. Lý do: đây là số hiển thị được, không phải bí mật; chặn nó ở phía client sẽ chặn luôn
`wptToVnd` và mọi màn hình muốn tự quy đổi — FE-05 rất có thể cần. Cùng cách chia đã có tiền lệ
trong repo: `lib/session/channel.ts` (dùng chung) đứng cạnh `current-channel.ts` (`server-only`).

**Đường cho ra `undefined`/`0`: không có, và lý do là cấu trúc chứ không phải may mắn.**

| Đường chạy | Kết luận |
|---|---|
| Vòng phụ thuộc | **Không thể.** `issue-terms.ts` là **tệp lá**: không có `import` nào. Không có cạnh đi ra thì không có vòng. Đã ghi vào chú thích của tệp rằng đây là điều cố ý, để người sau không "dọn" bằng cách thêm import |
| `server-only` bị nạp ở client | **Không xảy ra.** Tệp nguồn không có `server-only`, nên nó nạp được ở cả hai phía. Nếu có `server-only` thì lỗi là *build fail* (rõ ràng), không phải *giá = 0* (âm thầm) |
| Kiểu sai | `BigInt(number)` với số nguyên an toàn là toàn phần. Ca đầu của test chốt `typeof === 'number'`, `Number.isSafeInteger`, `> 0` |
| `seedMockLedger({ wptPriceVnd: 0n })` | Có thật, nhưng là **seam kiểm thử** đã có từ BE-01, không phải đường chạy nghiệp vụ, và nó ghi đè giá một cách tường minh. Test nguồn giá gọi `resetMockLedger()` ở `beforeEach` nên luôn đọc giá mặc định |

Ca *"nguồn duy nhất là số nguyên dương, không phải undefined hay 0"* đứng **đầu** test có lý do:
nếu một ngày ai thêm import vào tệp nguồn và sinh ra vòng, ca đó đỏ trước, nên lỗi được đọc đúng
là "nguồn giá hỏng" chứ không bị đọc nhầm thành "lệch giá".

---

## 7. Kết luận về `@x402/*` và `src/empty.ts`

_(chờ Bước 7)_

---

## 8. Sơ đồ luồng mua WPT

_(chờ Bước 9)_

---

## 9. DEVIATION so với spec

### D-1 (Bước 2) — Phạm vi quét rộng hơn `design.md` mục 2

`design.md` mục 2 nói quét `app/src`, `packages/*/src`, `app/test`. Tài liệu giao việc Bước 2
mở rộng thành `app/src`, `app/test`, `app/e2e`, `packages/*/src`, `packages/*/contracts`,
`scripts`. Đã cài **theo tài liệu giao việc** (rộng hơn). `docs/` và `.kiro/` bị loại có chủ
đích: hai thư mục đó chứa **ví dụ** về marker, quét vào là báo lỗi giả.

### D-2 (Bước 2) — Đường dẫn trong bảng tính từ gốc repo

Ví dụ minh họa trong `design.md` mục 2 in đường dẫn rút gọn (`actions/purchase.ts:12`). Tài liệu
giao việc đòi "đường dẫn tương đối gốc repo". Đã làm theo tài liệu giao việc
(`app/src/app/actions/purchase.ts:12`) vì đường dẫn rút gọn không dán được vào lệnh nào, còn
đường dẫn đủ thì mở được bằng một cú nhấp trong terminal.

### D-3 (Bước 2) — Ba quyết định thiết kế Kiro tự chọn

Tài liệu giao việc để mở, đây là chỗ Kiro tự quyết, ghi lại để Supervisor bác nếu thấy sai:

| Quyết định | Vì sao |
|---|---|
| Thêm mã lỗi thứ 7 `BAD_TASK_STATUS` | Tài liệu nói `--check` đỏ đúng 6 trường hợp "không hơn". Nhưng khi `.kiro/task-status.json` vi phạm bất biến "một mã ở đúng một danh sách" thì `UNKNOWN_TASK` và `STALE_TASK` cho kết quả tùy thứ tự đọc — nền của cả 6 phép kiểm sụp. Im lặng đi qua thì `--check` xanh mà vô nghĩa, tệ hơn đỏ. Trường hợp này **hiện không thể xảy ra** (mục 3.3 đo 26 mã không trùng) nên không làm `run-local-all.sh` đỏ trên repo lành. Danh sách mã lỗi trong tài liệu ghi là "tối thiểu" |
| Marker phải đứng **ngay sau dấu mở chú thích** | Xem SL-4 ở mục 10 |
| Nhãn `[cắm]` / `[chặn]` trên từng dòng của bảng | `design.md` chỉ ghi số đếm ở dòng tiêu đề nhóm. Một mã task có thể có **cả hai loại** (ví dụ `SC-03` vừa chặn `quotePurchase` vừa chờ FE gọi), lúc đó chỉ đọc dòng tiêu đề thì không biết dòng nào là loại nào — mà phân biệt hai loại chính là lý do tồn tại của hai marker (steering mục 3) |

### D-4 (Bước 2) — `--json` luôn trả mã thoát 0

Kể cả khi có lỗi. `--json` là bản **xuất dữ liệu**, lỗi nằm trong mảng `errors` của chính JSON.
Phép kiểm đỏ/xanh là việc của `--check`. Làm `--json` đỏ theo thì mọi lệnh `| node -e ...` phải
bọc thêm `|| true`, không lợi gì.

### D-5 (Bước 4) — Bảy chỗ Kiro tự quyết

Tài liệu giao việc để mở hoặc nói "tinh chỉnh nếu thấy lý do tốt hơn". Ghi ra để Supervisor bác
nếu thấy sai:

| # | Quyết định | Vì sao |
|---|---|---|
| 1 | Định nghĩa "gần như chỉ có cụm đó" = **bỏ cụm vô nghĩa + từ đệm + mã task đi thì còn dưới 8 ký tự** | Đề xuất gốc không nói "gần như" là bao nhiêu. Để mơ hồ thì mỗi người cài một kiểu, và ca 4 thành ca không kiểm được. Ngưỡng này cho kết quả đúng trên cả hai đầu: bắt `"chờ task FE-05 làm sau"`, tha `"...BE-07 sẽ làm phần gọi theo lịch"` |
| 2 | **Trừ mã task** khỏi phần "còn lại" | Mã đã nằm ở đầu marker; nhắc lại trong mô tả không thêm thông tin nào. Không trừ thì `"chờ task FE-05 làm sau"` (22 ký tự) lọt |
| 3 | `@flow` chỉ áp điều kiện (b), **không** áp ngưỡng 15 ký tự | Nhãn sơ đồ đứng cạnh tên tệp và tên hàm nên ngắn là đúng; `design.md` QĐ-5 dùng nhãn `"nhập số lượng"` (13 ký tự). Ngưỡng bác ví dụ của chính quy ước thì ngưỡng sai. Sẽ ảnh hưởng Bước 9 nên nói trước |
| 4 | `VAGUE_NOTE` kiểm **sau** `UNKNOWN_TASK` và `STALE_TASK` | Giữ nguyên nếp cũ của script: một dòng báo một lỗi, lỗi nền tảng trước. Mã task sai thì đó là điều phải sửa trước, mô tả tính sau |
| 5 | Thêm ca **"chốt chặn — không còn loại lỗi marker nào khác"** ngoài 4 ca có tên | 4 ca của `design.md` bỏ ngỏ `FORBIDDEN_KEYWORD`, `BAD_FLOW_NAME`, `BAD_FLOW_STEP`, `BAD_TASK_STATUS`. Không có ca này thì mã lỗi mới thêm vào script nằm ngoài tầm test mà không ai biết, và task 9.5 phải sửa test thay vì thêm |
| 6 | Thêm `@typedef` vào `scan-pending.mjs` | Test chạy dưới TypeScript; JSDoc cũ khai `summary:Object` nên `npm run typecheck` đỏ ở `report.summary.errors`. Hai cách sửa: khai kiểu ở script, hoặc `interface` riêng trong test. Chọn cách một — cách hai là khai lại cấu trúc ở hai nơi, đúng cái bẫy "hai bản lệch nhau" |
| 7 | **Commit thứ ba** `b65c077` ngoài hai commit tài liệu giao việc nêu tên | `b65c077` sửa lỗi của chính `49768e1` (xem SL-6). Chọn commit mới thay vì `--amend` để lịch sử nói đúng chuyện đã xảy ra: khẳng định rỗng ruột được thêm vào, rồi bị đột biến bắt, rồi bị sửa. Gộp bằng `--amend` là xoá mất bằng chứng cho giá trị của bước chạy đột biến |

Ngoài bảng trên, hai chỗ nữa đã ghi ở mục 1 (Bước 4): cách test đọc script (`import` trực tiếp,
không `spawnSync`) và phạm vi lệnh `git diff` khi chứng minh đột biến không lọt vào commit
(`-- app packages scripts`).

### D-6 (Bước 5) — Năm chỗ lệch so với bảng của `design.md` mục 6

| # | Lệch gì | Vì sao |
|---|---|---|
| 1 | **Ba nhóm thêm vào** bảng phân loại: D (Next.js gọi theo quy ước tệp), E (mặt tiền kiểu/lỗi của ký hiệu đã export), G (thư viện giao diện sao chép vào) | 55 trong 115 dòng thuộc ba nhóm này. Không tách ra thì bảng có 55 dòng trông như mã chết mà xóa dòng nào cũng làm hỏng ứng dụng. `design.md` mục 6 không lường vì nó dựa trên con số 27 đã lọc sẵn ba nhóm đó |
| 2 | **Một nhóm của `design.md` không tồn tại**: "dùng trong test". Ba hàm nó nêu tên không có test nào gọi | Bằng chứng ở 4.3. Theo chỉ dẫn "không tìm được chỗ gọi thì nó không thuộc nhóm này" → nhóm I + Q7 |
| 3 | **Không xóa** `UnsupportedChainError`, `evmTestnet`, `hardhatLocal`, `getSigner` — bốn ký hiệu `design.md` xếp vào "mã chết thật" | Không cái nào là mã chết (SL-7). `evmTestnet`/`hardhatLocal` nằm trong mảng `chains`, và xóa chúng **vẫn build xanh** vì mảng rỗng là kiểu hợp lệ — đúng cạm bẫy tài liệu giao việc cảnh báo |
| 4 | **Thêm `createWalletSigner`** vào nhóm điểm cắm, dù nó không có trong danh sách 7 ký hiệu của spec | Nó nằm trong 115 dòng đo được, và là cửa vào `ISigner` phía ví — LUẬT #2. Đúng loại mã mà cơ chế marker được dựng để bảo vệ: chưa ai gọi nên trông như rác |
| 5 | **Không gắn marker** cho 6 kiểu `z.input` của `schemas.ts`, dù chúng cũng "đã sẵn, chưa ai dùng" | Steering mục 1 định nghĩa `@pending` là "code **đã chạy được**, chỉ chưa ai gọi". Kiểu không chạy và không gọi được; gắn marker cho nó là dùng sai marker, mà steering mục 3 nói dùng sai còn tệ hơn không có |

### D-7 (Bước 6) — ĐỔI HÀNH VI: xóa `expireStaleOrdersAction`

**Owner chốt ở vòng review Bước 5** (Q5 phương án a3).

`tasks.md` ghi rõ *"Không đổi hành vi hệ thống"*, và xóa một server action là **thu hẹp mặt tiền
transport** — một endpoint POST mà Next.js từng đăng ký thì nay không còn. Đây là deviation duy
nhất của cả MC-01 mà Kiro **cố ý** đổi hành vi, và nó chỉ được làm vì Owner đã quyết.

| | |
|---|---|
| Commit | `f285acf` |
| Tệp | `app/src/app/actions/purchase.ts` (duy nhất) |
| Đã xóa | `expireStaleOrdersAction` + khối chú thích 8 dòng nêu câu hỏi mở; `expireStaleOrders` gỡ khỏi danh sách `import` (không còn ai dùng trong tệp) |
| Đã thêm | 5 dòng ở khối chú thích đầu tệp: service có **bốn** hàm, tệp này **ba** action, và đó là chủ đích — dẫn chủ đích ở `api/purchase/route.ts` |
| Giữ nguyên | `expireStaleOrders` trong `purchase.service.ts` và marker `@pending BE-07` của nó |

Kết quả: dọn lệnh treo còn **một** đường vào duy nhất — tiến trình theo lịch của BE-07 gọi thẳng
service. Hai tệp transport giờ nói cùng một chuyện, thay vì route handler cố ý không mở trong khi
server action thì đã mở.

Dòng chú thích thêm vào là cần, không phải trang trí: người sau đọc tệp thấy **3 action** trong khi
service có **4 hàm** sẽ tưởng là bỏ sót và thêm lại đúng cái vừa bị xóa. Và phép kiểm tự động thì
không chặn được việc đó — `verify-arch-rules.sh` chỉ đếm server action của `bank.ts`, không đếm
`purchase.ts` (xem 3.8).

**Không có phép kiểm nào đỏ vì deviation này:** `npm run typecheck`, `npx eslint .`, 285 test,
`npm run build` 17/17 route, `scan-pending.mjs --check` `exit=0` — tất cả xanh ngay ở commit đó.

---

## 10. Sai lệch phát hiện được

### SL-1 — Hai bản spec **không** giống hệt nhau

Tài liệu giao việc nói `docs/mc-01-make-control/` và `.kiro/specs/mc-01-make-control/` là "hai bản
giống hệt nhau". Đo thật thì lệch hai chỗ:

```
$ diff -r docs/mc-01-make-control/ .kiro/specs/mc-01-make-control/
11,13c11,13
< - [ ] 1.1 Tạo `.kiro/steering/make-control.md` ...
---
> - [-] 1.1 Tạo `.kiro/steering/make-control.md` ...
   (… 30 dòng checkbox tương tự)
Only in .kiro/specs/mc-01-make-control: tasks.meta.json
```

Nguyên nhân: bộ theo dõi task của Kiro ghi trạng thái trực tiếp vào `.kiro/specs/.../tasks.md`
(`[-]` = đang làm, `[~]` = chưa làm) và sinh thêm `tasks.meta.json`. `docs/` là bản người đọc nên
giữ `[ ]`.

**Đã xử lý:** commit cả hai bản **đúng như trên đĩa**, không chuẩn hóa cho giống nhau. Chuẩn hóa
thì bộ theo dõi task sẽ ghi lại ngay, và commit sẽ mô tả một trạng thái không tồn tại. Tiền lệ
BE-09: `.kiro/specs/be-09-data-schema/tasks.md` và `docs/be-09-data-schema/tasks.md` giống hệt
nhau, cùng `- [ ]` — nghĩa là trước đây trạng thái sống chưa từng được commit.

### SL-2 — Số method bị chặn trong `evm.adapter.ts` là **11**, không phải 10; và không phải tất cả chờ SC-02

Tài liệu giao việc (mục B1.2) nói "10 method trong `app/src/lib/ledger/evm.adapter.ts` chờ SC-02".
`design.md` QĐ-2 cũng nói "10 method trong `evm.adapter` là `@blocked SC-02`". Đo thật:

```
$ git grep -n -E "return pendingContract\(" -- app/src/lib/ledger/evm.adapter.ts
372:      return pendingContract('mintInitialSupply', 'hợp đồng phát hành một lần (SC-02)');
376:      return pendingContract('isInitialSupplyMinted', 'hợp đồng phát hành một lần (SC-02)');
388:      return pendingContract('spvWallet', 'hợp đồng phát hành một lần (SC-02)');
397:      return pendingContract('quotePurchase', 'hợp đồng khớp lệnh (SC-03)');
413:      return pendingContract('paymentAllowanceOf', 'địa chỉ hợp đồng khớp lệnh (SC-03)');
418:      return pendingContract('executePurchase', 'hợp đồng khớp lệnh (SC-03)');
511:      return pendingContract(  // distributeBatch
527:      return pendingContract('setSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
531:      return pendingContract('isSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
536:      return pendingContract('setNavRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
540:      return pendingContract('navRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
```

**11 method**, chia bốn nhóm chứ không một:

| Nhóm | Method | Chờ gì |
|---|---|---|
| 1 | `mintInitialSupply`, `isInitialSupplyMinted`, `spvWallet` | Hợp đồng phát hành một lần — **SC-02** |
| 2 | `quotePurchase`, `paymentAllowanceOf`, `executePurchase` | Hợp đồng khớp lệnh — **SC-03** |
| 3 | `distributeBatch` | Quyết định mapping `snapshotId → distributionId` — **BE-06** |
| 4 | `setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate` | **Không chờ task nào** — chờ Owner/Supervisor xác nhận nối vào contract nào. Xem Q1 |

Ảnh hưởng: steering đã viết theo số đo thật ("ba method chờ hợp đồng phát hành một lần của
SC-02"), không chép lại con số 10 của tài liệu giao việc. Bước 3 phải gắn marker theo bảng bốn
nhóm này, không gắn `@blocked SC-02` cho cả 11.

Bài học `lessons.md` đã lường đúng tình huống này: "Tin số dòng/số chỗ trong tài liệu giao việc
mà không đo lại → SAI. Luôn `git grep` đếm lại trước khi lập kế hoạch."

### SL-3 — CHỐT Ở BƯỚC 3: cả **33** và **43** đều sai, số thật là **13 chỗ trên 2 tệp**

`requirements.md` mục 2 và `tasks.md` 3.1 nói "rải rác **33 tệp**". Bước 1 đo ra 43 tệp / 115
dòng. Bước 3 đo lại và phân loại **từng dòng** thì cả ba con số đều không dùng được để lập kế
hoạch, vì cả ba đếm **mọi** lần nhắc mã task trong mã nguồn.

#### Số đo cuối

```
$ git grep -l -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
43
$ git grep -n -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
115
```

115 dòng đó tách làm hai trước khi phân loại được:

| | Dòng | Tệp |
|---|---|---|
| Dòng **bình luận** | **91** | 38 |
| Dòng **không phải bình luận** (chuỗi trong mã, chữ hiển thị trên giao diện, tên test) | **24** | 9 |

Rồi 91 dòng bình luận chia bốn nhóm:

| Nhóm | Ý nghĩa | Dòng | Xử lý ở Bước 3 |
|---|---|---|---|
| **A. Điểm cắm** | code chạy được, chưa ai gọi | **1** | `@pending BE-07` trên `expireStaleOrders` |
| **B. Điểm chặn** | code đang ném lỗi | **5** | Chuyển thành `@blocked`; cộng 6 method không có bình luận riêng → **11 marker** |
| **C. Văn giải thích** | nói *vì sao code hiện tại như thế này* | **84** | **GIỮ NGUYÊN**, không gắn marker |
| **D. Lạc hậu** | nhắc task đã `done` như thể còn phải làm | **1** | Viết lại cho đúng hiện trạng |

Tổng marker gắn được: **12** (1 `@pending` + 11 `@blocked`) trên **2 tệp**, cộng **1** chỗ nhóm
D viết lại = **13 chỗ sửa**. So với 115: **79 %** số dòng nhắc mã task là văn giải thích phải
giữ nguyên.

#### 33 và 43 sai ở đâu

Cả hai con số **đếm sai đơn vị**. Chúng đếm "tệp có nhắc mã task", còn việc cần làm là "chỗ
phải gắn marker" — hai tập gần như không giao nhau. Ví dụ ba dòng dưới đây đều bị cả hai phép
đếm bắt, và cả ba **không được** thành marker:

```
app/src/lib/store/memory.order.store.ts:17   ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3)
app/src/lib/ledger/ledger.port.ts:32         Kết quả kiểm tra trước khi gửi giao dịch (BE-01 R3).
app/test/rbac.test.ts:137                    Bảng quyền hiện có TRƯỚC BE-08, chép từ `git show dev:...`
```

Biến chúng thành `@pending` thì được một bảng điểm cắm 91 dòng mà **không dòng nào là việc phải
làm** — và vì BE-01 / BE-08 / BE-09 đã `done`, `--check` sẽ báo `STALE_TASK` và đỏ ngay lập tức.
Tức là gắn sai không chỉ vô ích, nó còn làm đỏ phép kiểm và buộc người sau tháo cơ chế ra.

Nguyên tắc phân biệt đã dùng, đúng theo steering mục 3: **marker trả lời "ai phải làm gì
tiếp"; văn giải thích trả lời "vì sao code hiện tại như thế này"**. Câu "theo BE-09 QĐ-3" là
loại thứ hai — nó dẫn nguồn một quyết định đã chốt, không giao việc cho ai.

Phép đếm 33 / 43 / 115 vì vậy **không phải phép đo của Bước 3** mà chỉ là danh sách chỗ cần
đọc. Số đáng theo dõi về sau là số marker trong bảng của `scan-pending.mjs`, và số đó máy đếm.

#### Nhóm thứ năm mà tài liệu giao việc không lường: 24 dòng KHÔNG phải bình luận

Đây là phát hiện có hệ quả thật, vì nó **giao với ràng buộc "chỉ sửa bình luận"**:

| Dạng | Số dòng | Ví dụ | Vì sao không chạm |
|---|---|---|---|
| Chuỗi tham số trong mã | 13 | `pendingContract('spvWallet', 'hợp đồng phát hành một lần (SC-02)')` · `todoNeeds(...)` ở `stellar.adapter.ts` | Là **mã thực thi**. Sửa là đổi thông báo lỗi — DoD 3.4 cấm, và có test kiểm nội dung đó |
| Tên `describe` / `it` | 8 | `it('sáu bảng BE-09 đều được tạo', ...)` | Là **tên test**. Sửa test đang xanh bị cấm tuyệt đối |
| Dòng GIỮA khối `{/* ... */}` | 2 | `header.tsx:79` · `wallet-status-card.tsx:109` | **Là bình luận thật**, nhưng dòng bắt đầu bằng chữ chứ không bằng `*`. Xem đoạn dưới |
| Chữ hiển thị cho người dùng | 1 | `asset-summary.tsx:148` | Là **kết xuất**, sửa là đổi giao diện |

Hai dòng dạng thứ ba đáng nói riêng, vì chúng là **điểm mù thật** chứ không phải lỗi phân loại.
Bình luận JSX viết thế này:

```tsx
{/*
  Số dư WPT và VNDB không hiển thị ở đây: hai thứ đó là số dư hợp đồng, phải đi qua
  `ILedgerPort` và thuộc FE-04. Xem ở trang Tổng quan.
*/}
```

Dòng giữa không có tiền tố `*` nào. Hệ quả kép:

1. **`scan-pending.mjs` không nhận marker ở đó** — cú pháp đòi marker đứng ngay sau dấu mở chú
   thích (SL-4), mà dòng giữa khối JSX không có dấu mở nào. Muốn gắn marker trong JSX thì phải
   viết `{/* @pending FE-05 | ... */}` **trên một dòng**.
2. **Sửa dòng giữa làm phép kiểm "không đổi mã thực thi" mất tác dụng** — bộ lọc ở mục 3.5 chỉ
   tha dòng bắt đầu bằng `//` `/*` `*` `#`, nên một sửa đổi bình luận hợp lệ sẽ hiện ra y như
   một sửa đổi mã.

Cả hai dòng này đều thuộc nhóm C (văn giải thích) nên Bước 3 không phải chạm tới, tức giới hạn
trên chưa gây thiệt hại. Nhưng nó có thật, và Bước 9 sẽ gặp nếu muốn gắn `@flow` cho thành phần
giao diện — ghi ở Q3.

Hệ quả cụ thể lên `stellar.adapter.ts`: tệp đó có 6 dòng nhắc SC-02/SC-03, **tất cả nằm trong
chuỗi tham số**, và toàn bộ ~25 method của nó đều ném lỗi. Nhưng chúng bị chặn bởi **Phase 7
(Stellar)** chứ không bởi SC-02/SC-03 — xong SC-02 cũng không nối được gì ở đây vì chưa có SDK
Soroban. Gắn `@blocked SC-02` vào đó là nói sai thứ đang thiếu. Bước 3 **không gắn marker nào**
cho `stellar.adapter.ts`; nếu muốn theo dõi thì phải có mã task cho Phase 7 trước — ghi ở Q3.

#### Nhóm D: bốn chỗ cùng nói một điều đã sai, chỉ sửa được một

Ghi chú ở `portfolio.service.ts` khẳng định `ILedgerPort` **chưa có** phương thức đọc số dư
token thanh toán, và gọi đó là "nợ chờ BE-01". Cả hai vế đều sai:

```
$ git grep -n 'paymentBalanceOf' -- app/src/lib/ledger/ledger.port.ts
117:  paymentBalanceOf(wallet: string): Promise<bigint>;
$ git log --oneline -S'paymentBalanceOf' -- app/src/lib/ledger/ledger.port.ts
bac0da3 refactor(ledger): tách ILedgerPort theo nghiệp vụ và thêm chữ ký cho ba luồng
$ git grep -n 'paymentBalanceOf' -- app/src/lib/bank
app/src/lib/bank/purchase.service.ts:184:  const paymentBalance = await ledger.paymentBalanceOf(order.investorWallet);
```

Method có từ BE-01 (`bac0da3`) và `purchase.service` đang dùng nó. Đã viết lại ghi chú cho đúng
hiện trạng và trỏ sang **FE-04** — task thật sự sẽ hiển thị số dư.

**Không gắn marker cho chỗ này.** Ở đây không có mã nào chạy được mà chờ người gọi; thiếu một
**trường** trong `PortfolioView`. `@pending FE-04` sẽ nói "đã sẵn, chỉ cần gọi" — sai.

Cùng lời khẳng định sai đó còn ở **ba** chỗ nữa, và **cả ba không sửa được trong Bước 3**:

| Chỗ | Dạng | Vì sao không sửa |
|---|---|---|
| `asset-summary.tsx:141-143` | bình luận JSX `{/* ... */}` | Dòng bên trong bắt đầu bằng **chữ**, không bằng `*`. Sửa nó thì phép kiểm "không đổi mã thực thi" ở mục 3.5 sẽ **báo có thay đổi** và mất luôn giá trị làm bằng chứng. (Khối này còn không nhắc mã task nào nên nằm ngoài cả 115 dòng đã đo) |
| `asset-summary.tsx:147-148` | chữ hiển thị cho người dùng | Sửa là đổi giao diện |
| `portfolio-service.test.ts:118` | tên test `it('... (chờ BE-01) ...')` | Sửa test đang xanh bị cấm |

Ghi lại làm nợ: khi FE-04 nối số dư VNDB thì phải sửa **cả ba** chỗ đó cùng lúc với
`portfolio.service.ts`. Đây cũng là một giới hạn thật của cơ chế marker: nó chỉ thấy bình luận
theo dạng `//` / `/* */`, còn khẳng định lạc hậu nằm trong chữ hiển thị và tên test thì không
công cụ nào trong MC-01 bắt được.

### SL-4 — Cắm script vào `run-local-all.sh` làm chính `run-local-all.sh` báo đỏ

Phát hiện ở Bước 2, và là loại lỗi mà tài liệu giao việc gọi là "cạm bẫy" nhưng chỉ lường cho
**ba** tệp. Tệp thứ tư chính là `run-local-all.sh`: khối chú thích đầu tệp phải giải thích mục
kiểm mới, mà giải thích thì phải **nhắc tên** từ khóa. Lần chạy đầy đủ đầu tiên:

```
  Không đạt: 1
    FAIL  LỚP 3 - ĐIỂM CẮM (marker)

$ node scripts/scan-pending.mjs --check
Có 2 lỗi marker:

  [BAD_SYNTAX] scripts/run-local-all.sh:9
      có từ khóa marker nhưng sai cú pháp. ...
  [BAD_SYNTAX] scripts/run-local-all.sh:65
      có từ khóa marker nhưng sai cú pháp. ...
```

Hai dòng bị báo là câu văn thuần, không phải marker:

```
#    2. Lớp 3 - điểm cắm: marker @pending / @blocked / @flow đúng quy ước
# marker chờ task đã done, từ khóa biến thể bị cấm, số bước @flow trùng/nhảy cách.
```

Ba cách xử lý, và vì sao chọn cách thứ ba:

| Cách | Vì sao **không** chọn |
|---|---|
| (a) Thêm `run-local-all.sh` vào danh sách tự loại trừ | Loại cả một tệp thật khỏi phép quét **vĩnh viễn**. Sau này ai viết marker thật trong đó thì marker vô hình với công cụ — đúng loại lỗi mà steering mục 5 cảnh báo |
| (b) Viết lại chú thích cho không chứa từ khóa | Chữa triệu chứng. Mọi tệp trong phạm vi quét sẽ **vĩnh viễn không được phép nhắc tên** từ khóa, kể cả khi cần giải thích cơ chế cho người sau |

**(c) Đã chọn — sửa gốc rễ:** marker chỉ được tính khi đứng **ngay sau dấu mở chú thích**
(`// @pending ...`, `# @flow ...`, `* @blocked ...`). Vẫn nhận marker viết ở cuối dòng mã
(`doSomething(); // @pending FE-05 | ...`).

Điều kiện này **không** nới lỏng phép kiểm, nó chỉ thu hẹp cái được coi là "ứng viên marker":

- Steering mục 6 **đã** đòi marker đứng một mình trên dòng ngay trên khai báo, nên không có
  marker hợp lệ nào bị bỏ sót.
- Ca đối chứng trong đột biến (dòng 52, câu văn nhắc tên từ khóa giữa dòng) không sinh lỗi,
  còn cả 9 marker sai vẫn bị bắt đủ.
- Danh sách tự loại trừ giữ đúng **ba** tệp như tài liệu giao việc yêu cầu. Nó vẫn cần thiết:
  khối chú thích của `scan-pending.mjs` viết `// @pending <MÃ-TASK> | ...` — đúng vị trí marker
  nên điều kiện (c) không cứu được, phải loại theo đường dẫn.

Từ khóa ghi chú `TODO` / `FIXME` / `HACK` / `XXX` thì **không** áp điều kiện vị trí: steering cấm
hẳn cách ghi chú đó, ở đâu trong dòng cũng là vi phạm.

Đo lại nền trước khi cài phép kiểm này, đúng như tài liệu giao việc yêu cầu — repo **sạch**, nên
không có ca nào phải báo lại Owner:

```
$ git grep -nE '\b(TODO|FIXME|HACK|XXX)\b' -- app/src app/test packages/*/src
(rỗng, exit 1)
$ git grep -nE '\b(TODO|FIXME|HACK|XXX)\b' -- app/e2e scripts packages/*/contracts
(rỗng, exit 1)
$ git grep -nE '@(pending|blocked|flow|waiting|todo)' -- app/src app/test app/e2e packages scripts
(rỗng, exit 1)
```

### SL-5 — `run-local-all.sh` in ra chuỗi `\n` nguyên văn ở dòng cuối (lỗi sẵn có trên `dev`)

Thấy khi dán output đầy đủ ở mục 3.5. Dòng kết luận hiện ra là `\n  => ĐẠT toàn bộ kiểm chứng
cục bộ.` với hai ký tự `\` và `n` in thật.

Nguyên nhân: `c_grn` dùng `printf '%s'` nên chuỗi `\n` trong **tham số** không được hiểu là dòng
mới.

```
$ grep -n 'c_grn()' scripts/run-local-all.sh
25:c_grn() { printf '\033[32m%s\033[0m\n' "$1"; }
$ grep -n 'ĐẠT toàn bộ kiểm chứng' scripts/run-local-all.sh
103:c_grn "\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
```

Có sẵn trên `dev`, không do Bước 2 hay Bước 3:

```
$ git show 71932bb:scripts/run-local-all.sh | grep -n 'ĐẠT toàn bộ kiểm chứng'
88:c_grn "\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
```

**Không sửa ở Bước 3**, vì bước này chỉ được sửa bình luận — sửa script là đổi hành vi và sẽ
phá phép kiểm 3. Chỉ là thẩm mỹ, không ảnh hưởng mã thoát. Cách sửa khi có bước nào chạm tới:
bỏ `\n` khỏi tham số và gọi `printf '\n'` riêng, hoặc thêm một `echo` rỗng phía trên.

### SL-6 — Chính đột biến 4.2 bắt được một khẳng định rỗng ruột trong test Bước 4

Đây là sai lệch **do Kiro tự gây ra rồi tự bắt được**, ghi lại vì cách bắt được nó là thứ đáng
giữ, không phải vì cái lỗi.

Commit `49768e1` có một ca ở tầng 1 tên *"còn điểm cắm là bình thường, không phải lỗi"*, thân là:

```ts
expect(report.summary.errors).toBe(0);
expect(report.summary.pending + report.summary.blocked).toBeGreaterThanOrEqual(0);
```

Đọc riêng thì trông hợp lý. Chạy đột biến 4.2 mới thấy hai chỗ sai:

- Khẳng định thứ nhất **lặp lại đúng bốn ca ở trên** dưới một cái tên nói sai việc nó làm. Hệ quả:
  đột biến làm ca 3 đỏ thì ca này đỏ theo, với thông báo `expected 1 to be +0` — vô dụng với người
  đi sửa, và làm cho "một đột biến, một ca đỏ" thành "một đột biến, hai ca đỏ".
- Khẳng định thứ hai là `x >= 0` với `x` là tổng hai số không âm. **Luôn đúng**, không thể đỏ, nên
  không kiểm gì.

Đã sửa ở `b65c077`: chuyển tính chất đó xuống **tầng 2**, dựng repo giả có 3 marker hợp lệ rồi
đòi `errors` rỗng và `byTask` / `summary` đếm đúng. Ở đó nó là phép kiểm thật cho *"nhiều điểm cắm
cũng không đỏ"* — tính chất giữ cho người sau không xóa marker cho xanh.

Bài học rút ra, đề nghị đưa vào `lessons.md` nếu Supervisor thấy đáng: **khẳng định "không có lỗi"
đặt trên cùng một nguồn dữ liệu với các ca có tên thì không phải phép kiểm mới, nó là bản sao mang
tên khác.** Muốn kiểm "trạng thái bình thường không sinh lỗi" thì phải kiểm trên **dữ liệu dựng
riêng**, nơi biết chắc đầu vào là hợp lệ.

Và điều này là bằng chứng cho chính lý do tầng 2 tồn tại: nếu Bước 4 chỉ có tầng 1 rồi không chạy
đột biến, hai khẳng định trên vẫn xanh mãi mãi và không ai biết chúng rỗng.

### SL-7 — CHỐT Ở BƯỚC 5: con số **27** đếm hẹp hơn một bậc, số thật là **115**; và cả **ba** dự đoán của `design.md` mục 6 đều sai

Phép đo và cách lệch ở mục 4.1. Ở đây ghi phần đáng thành bài học, vì nó là **lần thứ hai trong
cùng task này** một con số trong tài liệu không đo lại được — lần đầu là SL-3 (33 / 43 / 115 dòng
marker).

#### Ba dự đoán sai, mỗi cái sai một kiểu

| `design.md` mục 6 nói | Thực tế | Kiểu sai |
|---|---|---|
| `resetSignerCache`, `resetChainRegistryCache`, `resetKycProviderCache` → *"dùng trong test"* | **Không test nào gọi cả ba.** Ba hàm cùng họ (`resetServerEnvCache`, `resetStoreCache`, `resetMemoryStore`) thì có, 21 chỗ | Suy từ **tên hàm** và từ chú thích "chỉ dùng trong test" — cả hai đều là **ý định**, không phải hiện trạng |
| `UnsupportedChainError`, `evmTestnet`, `hardhatLocal`, `getSigner` → *"mã chết thật, xóa"* | **Không cái nào là mã chết.** `UnsupportedChainError` được `throw` ở 2 chỗ; `evmTestnet`/`hardhatLocal` nằm trong mảng `chains`; `getSigner` được `getBankSigner` gọi | Nhầm **"không ai ngoài tệp dùng"** với **"không ai dùng"**. Hai tập đó khác nhau, và bốn ký hiệu này đều ở phần khác nhau |
| *"27 export chỉ xuất hiện trong chính tệp nó"* | **115** | Đếm hẹp hơn một bậc: bỏ ra route Next.js, shadcn, và kiểu là mặt tiền của hàm đã export |

Điều đáng chú ý nhất: **dự đoán thứ hai nếu làm theo thì gây thiệt hại thật.** Xóa `evmTestnet`
và `hardhatLocal` sẽ làm mảng `chains` của wagmi rỗng — ví không kết nối được chain nào — mà
`npm run build` **vẫn xanh**, vì mảng rỗng là kiểu hợp lệ. Đó là loại lỗi chỉ hiện ra lúc bấm
"Connect Wallet".

Chính vì vậy phép kiểm "xóa thử rồi build" mà tài liệu giao việc yêu cầu là **cần nhưng không
đủ**. Phép đo phải trả lời được câu "còn ai dùng nó trong chính tệp không" **trước** khi xóa, chứ
không dựa vào build để phát hiện.

#### Cạm bẫy thứ tư, tài liệu giao việc không nêu

Tài liệu giao việc liệt kê 5 cạm bẫy của phép đo. Có một cái thứ sáu, và nó **đã làm vòng đo đầu
tiên sai**: pathspec `git ls-files 'app/src/**/*.ts'` **không khớp tệp nằm ngay trong thư mục
gốc** của mẫu. Vòng đo đầu thiếu 5 tệp, trong đó có `app/src/empty.ts` — tức thiếu luôn cả nhóm
mà spec nêu đích danh ở R7. Bằng chứng ở mục 4.1.

Bài học đề nghị đưa vào `lessons.md`: **đo "có bao nhiêu X" thì phải đo luôn "phép đo có thấy hết
tệp không".** Một phép đo bỏ sót tệp vẫn cho ra con số trông hợp lý, nên không có gì báo động.
Cách kiểm: đếm tệp bằng hai cách khác nhau rồi `diff`, thay vì tin một pathspec.

#### Đo lại được, và không để lại công cụ

Script đo là tệp tạm ở `/tmp`, **đã xóa**. Bước 5 không có nhiệm vụ thêm công cụ vào repo, và
thêm một script "quét export chết" là thêm một thứ phải bảo trì mà chưa ai yêu cầu. Ba bước của
phép đo ghi ở 4.1; mỗi dòng của bảng 4.4 kèm lệnh `grep` chạy được ngay.

### SL-8 — PHÁT HIỆN Ở BƯỚC 6: **10 test cũ hardcode giá phát hành**, nên hợp nhất nguồn vẫn chưa đủ để đổi giá an toàn

Hợp nhất nguồn (R5.1) giải quyết đúng vấn đề R5.2 nêu: giá hiển thị và giá khớp lệnh không lệch
nhau được nữa. Nhưng đột biến 1 làm lộ ra một tầng thứ hai mà R5 không nói tới:

```
$ (đổi giá ở nguồn duy nhất thành 123_000, rồi chạy toàn bộ suite)
   Tests  10 failed | 290 passed (300)
```

| Tệp | Số ca đỏ |
|---|---|
| `app/test/mock-ledger.test.ts` | 5 (nhóm `R2 — khớp lệnh mua`, `R4 — chốt quyền`) |
| `app/test/purchase-service.test.ts` | 5 (`placeOrder`, `executeOrder`, `7.5`, `7.7` ×2) |

Mười ca này viết thẳng số VNDB suy ra từ giá 100.000, ví dụ `10_000_000n - 300_000n` cho 3 WPT.
Chúng **không sai** — hôm nay chúng xanh và chúng kiểm đúng thứ chúng nói là kiểm. Nhưng hệ quả
thực tế là: **BE-04 đổi giá mặc định sẽ thấy 10 test đỏ**, và người đọc con đỏ đó sẽ mất một lúc
mới nhận ra đây là số cũ trong test chứ không phải lỗi mới trong mã.

Vì sao **không sửa ở Bước 6**: `tasks.md` cấm sửa test đang xanh, và tài liệu giao việc Bước 6 nhắc
lại bằng chữ ("Không sửa test đang xanh (285 test)"). Sửa 10 ca trong hai tệp test của BE-01/BE-02
cũng vượt ra ngoài mục tiêu "hợp nhất nguồn giá" — nó là một mục tiêu khác, nên thuộc một commit
khác, đúng theo `workflow.md`.

Đề xuất, xin Owner/Supervisor quyết:

- **(a)** Để nguyên. Món nợ nhỏ và chỉ chạm tới khi BE-04 đổi giá. Rủi ro: BE-04 mất thời gian chẩn
  đoán 10 con đỏ trông như lỗi hồi quy.
- **(b)** Một nhánh `test/` riêng cho BE-04 dùng: thay số hardcode bằng biểu thức suy ra từ
  `WPT_ISSUE_PRICE_VND`, đúng cách mà `issue-price-single-source.test.ts` đang làm. Sau đó đổi giá
  ở nguồn là **cả 300 test** xanh, tức nguồn giá thật sự có một chỗ duy nhất cả trong mã lẫn trong
  kiểm thử.

**Đề xuất (b), nhưng làm ở nhánh khác, không phải MC-01.** Hai lý do: nó sửa test đang xanh (việc
MC-01 bị cấm), và nó phục vụ BE-04 nên nên nằm cùng chỗ với BE-04 để người review thấy được cả
nguyên nhân lẫn kết quả.

#### Món nợ tài liệu kèm theo, đã hẹn Bước 10

`docs/tech-report.md` mục 3.6 (`app/src/lib/config/`) liệt kê `env.ts`, `flags.ts`,
`config-context.tsx` — **chưa có** `issue-terms.ts`. Dòng 500 (`issuance.ts | Điều khoản phát hành
| WPT_ISSUE_PRICE_VND, wptToVnd()`) thì **vẫn đúng**, vì `issuance.ts` còn re-export cả hai ký hiệu,
nên đó không phải chỗ lạc hậu. Cả hai việc thuộc task 10.x; ghi ra đây để Bước 10 không phải đi tìm
lại.

---

## 11. Câu hỏi mở

> **Q1 và Q2 đã được Owner chốt ở Bước 2. Q5 (vế a) đã được Owner chốt ở vòng review Bước 5** —
> quyết định và cách thi hành ghi ngay dưới mỗi câu.
> **Q3 và Q4 mở ở Bước 3. Q5 (vế b) đến Q8 còn mở.**

### Q3 — Ba chỗ phân loại 50/50, đã để nhóm C, xin xác nhận

Theo chỉ dẫn "không chắc thì để nguyên nhóm C, bỏ sót thì Bước sau thêm được, gắn sai thì không
ai phát hiện". Ba chỗ dưới đây tôi thấy có thể tranh luận được cả hai chiều. Không chỗ nào chặn
Bước 4; nếu Supervisor thấy nên gắn thì Bước 5 thêm vào là đủ.

**(a) `nav-config.ts:76` — ba mục nav `disabled` chờ FE-05 / FE-09 / FE-11**

```ts
/**
 * Kênh nhà đầu tư. Ba mục cuối chưa có nghiệp vụ nên để `disabled`:
 * `/purchase` chờ FE-05, `/earnings` chờ FE-09, `/settlement` chờ FE-11.
 */
export const INVESTOR_NAV: NavSection = { ... };
```

- **Cách hiểu 1 (điểm cắm):** nó trả lời đúng câu "ai phải làm gì tiếp" — FE-05 chỉ cần bỏ
  `disabled: true` và thêm trang. Gắn marker thì `--check` sẽ tự buộc dọn khi FE-05 xong.
- **Cách hiểu 2 (văn giải thích — đã chọn):** `@pending` theo steering mục 1 là "code ĐÃ CHẠY
  ĐƯỢC, chỉ **chưa ai gọi**". `INVESTOR_NAV` đang được gọi và đang kết xuất thật, chỉ ở trạng
  thái mờ. Nó không phải mã trông như rác mà người sau dễ xóa — tức không phải vấn đề mà cơ chế
  này dựng ra để giải.
- Còn một trở ngại kỹ thuật: một dòng chỉ mang **một** marker, mà chỗ này chờ **ba** task; đặt
  ba marker chồng nhau trên một `const` thì chỉ marker cuối là "ngay trên khai báo".

**(b) `wrong-chain-banner.tsx:26` và `use-wallet-status.ts:45` — hạ tầng dựng sẵn cho FE-05/09/11**

Bình luận nói rõ thành phần được tách riêng để ba màn hình sau dùng lại. Nhưng đo thật thì cả
hai **đang được gọi**: `WrongChainBanner` dùng ở `wallet-connect.tsx:72,83`, `useWalletStatus`
dùng ở `wallet-connect.tsx:31`. Đã chạy và đã có người gọi thì không phải điểm cắm. Để nhóm C.

**(c) `stellar.adapter.ts` — ~25 method đều ném lỗi, không có mã task nào đúng nghĩa**

Toàn bộ adapter là stub Phase 7. Sáu dòng nhắc SC-02/SC-03 đều nằm trong **chuỗi tham số**
(không phải bình luận), và bản thân SC-02/SC-03 **không** mở khoá được gì ở đây — còn thiếu SDK
Soroban. Đây đúng tình huống Q1 của Bước 2 (chặn vì một việc chưa có mã task), và cách xử lý đã
chốt lúc đó là **mở một mã task mới**. Bước 3 không tự làm việc đó: mở mã task là quyết định của
Owner, và Stellar thuộc `non-goals` của giai đoạn đầu theo `product.md`.

Đề xuất: **để nguyên, không marker.** Nếu Owner muốn theo dõi thì thêm một mã cho Phase 7
(ví dụ `SC-05` = *adapter Soroban*) rồi Bước 5 gắn một marker duy nhất cho cả adapter.

### Q4 — Bình luận JSX không gắn được marker ở dòng giữa khối; có cần nới cú pháp?

Chi tiết và bằng chứng ở SL-3, mục "Nhóm thứ năm". Tóm lại: `{/* ... */}` nhiều dòng có dòng
giữa bắt đầu bằng **chữ**, nên (1) `scan-pending.mjs` không nhận marker ở đó, và (2) sửa dòng
đó làm phép kiểm "không đổi mã thực thi" báo dương tính giả.

Chưa gây thiệt hại: cả hai dòng như vậy trong repo đều thuộc nhóm C. Nhưng Bước 9 sẽ gặp nếu
muốn gắn `@flow` cho thành phần giao diện.

Hai hướng, **chưa tự chọn**:

- **(a) Không đổi gì.** Quy ước là: marker trong JSX phải viết gọn một dòng
  `{/* @pending FE-05 | ... */}`. Giữ cú pháp chặt, đổi cách viết.
- **(b) Nới `COMMENT_OPEN`** để nhận cả dòng giữa khối JSX. Rủi ro: mất đúng cái điều kiện vị
  trí mà SL-4 vừa dựng lên để loại dương tính giả — câu văn nhắc tên từ khóa trong JSX sẽ bị
  báo `BAD_SYNTAX`.

**Đề xuất (a).** Nó không nới lỏng phép kiểm nào, và một marker một dòng thì vẫn đọc được.

### Q1 — Bốn method tất toán chặn vì một **quyết định**, không vì một task. Ghi marker thế nào?

Bốn method ở nhóm 4 của SL-2 (`setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate`)
không chờ task nào cả. Bình luận trong mã ghi rõ: `ProjectToken.paused` chặn chuyển nhượng và vẫn
cho `agentBurn`, còn `Redemption.paused` thì **ngược hướng**; chọn sai một trong hai cho ra hệ
thống chạy được nhưng làm ngược, nên **cần Owner/Supervisor xác nhận trước khi nối**.

Quy ước `@blocked <MÃ-TASK> | ...` đòi một mã task hợp lệ. Bốn chỗ này không có mã nào đúng nghĩa.

Hai cách hiểu:

- **(a)** Gán tạm `@blocked SC-03` vì cờ tất toán rồi cũng nằm ở tầng hợp đồng. Rủi ro: sai nghĩa.
  SC-03 là hợp đồng khớp lệnh, xong SC-03 cũng **không** trả lời được câu hỏi nối vào đâu, nên
  marker sẽ nói "chờ SC-03" trong khi thứ thật sự thiếu là một quyết định. Đúng loại lỗi mà mục 3
  của steering cảnh báo: trả lời sai một câu hỏi mà người đọc tin là đã được trả lời.
- **(b)** Mở một mã task mới cho việc quyết định này, thêm vào `planned` của `task-status.json`,
  rồi `@blocked <mã mới>`. Marker đúng nghĩa và vào được bảng điểm cắm.

**Phương án đề xuất: (b).** Việc này có đầu ra rõ ràng (một quyết định kiến trúc kèm chỗ nối) và
đang chặn 4 method, tức nó **là** một task chứ không phải ghi chú. Gán tạm vào SC-03 thì lúc SC-03
xong, quy tắc "dọn marker khi task done" buộc xóa 4 marker này trong khi thứ chặn vẫn còn đó.

#### ✅ Owner chốt: phương án (b), mã task là `SC-04`

`SC-04` = *hợp đồng cờ tất toán + giá NAV*. Nội dung: quyết định cờ "đang tất toán" nằm ở contract
nào (`ProjectToken.paused` chặn chuyển nhượng và **vẫn cho** `agentBurn`, còn `Redemption.paused`
**ngược hướng**) và `navRate` nối vào đâu.

Đã thi hành ở commit `c84ec7f`: thêm `SC-04` vào `planned` của `.kiro/task-status.json` → 26 mã
hợp lệ (mục 3.3). **Bước 2 chỉ thêm mã, chưa gắn marker.** Việc gắn `@blocked SC-04` cho bốn
method `setSettlementMode` / `isSettlementMode` / `setNavRate` / `navRate` trong
`app/src/lib/ledger/evm.adapter.ts` thuộc Bước 3; Bước 2 **không sửa** tệp đó.

### Q2 — `tasks.meta.json` nên commit hay nên `.gitignore`?

`.kiro/specs/mc-01-make-control/tasks.meta.json` (15 KB) là trạng thái máy sinh của bộ theo dõi
task, đổi mỗi lần một checkbox đổi. Tiền lệ be-02 và be-09: **không** commit (`git ls-files`
xác nhận chỉ có ba tệp `.md`).

Bước 1 đã theo tiền lệ, **không** commit tệp này. Hệ quả: `git status --short` còn một dòng
`?? .kiro/specs/mc-01-make-control/tasks.meta.json`, tức working tree **chưa sạch tuyệt đối** theo
nghĩa chặt của DoD.

Ba hướng, cần Owner chọn: (a) giữ nguyên, coi là trạng thái máy nằm ngoài git; (b) thêm
`.kiro/specs/*/tasks.meta.json` vào `.gitignore`; (c) commit luôn, chấp nhận churn mỗi commit.
**Đề xuất (b)** — đúng bản chất tệp và làm working tree sạch thật. Chưa tự làm vì `.gitignore` là
tệp dùng chung, sửa nó không thuộc phạm vi Bước 1.

#### ✅ Owner chốt: phương án (b)

Đã thi hành ở commit `c84ec7f`. Xác nhận có hiệu lực:

```
$ git check-ignore -v .kiro/specs/mc-01-make-control/tasks.meta.json
.gitignore:39:.kiro/specs/*/tasks.meta.json	.kiro/specs/mc-01-make-control/tasks.meta.json
```

`git status --short` không còn dòng `?? ...tasks.meta.json`.

### Q5 — Ai sẽ gọi `expireStaleOrdersAction` và `tokenOverviewAction`? Hai tài liệu nói ngược nhau

> **✅ VẾ (a) ĐÃ CHỐT — Owner chọn phương án (a3) ở vòng review Bước 5: XÓA `expireStaleOrdersAction`.**
>
> Đã thi hành ở Bước 6, commit `f285acf`. Dọn lệnh treo còn **một** đường vào: tiến trình theo lịch
> của BE-07 gọi thẳng service. Chi tiết và bằng chứng chạy ở D-7 (mục 9).
>
> Ba việc đã làm, đúng phạm vi Owner chốt, không hơn:
> 1. Xóa `expireStaleOrdersAction` **và** khối chú thích câu hỏi mở ngay trên nó (khối đó là chính
>    câu hỏi này, giờ đã có câu trả lời nên nó hết việc).
> 2. Gỡ `expireStaleOrders` khỏi danh sách `import` — không còn ai dùng trong tệp.
> 3. Thêm chú thích ở khối đầu tệp nói vì sao service có **bốn** hàm mà đây chỉ **ba** action, dẫn
>    chủ đích ở `api/purchase/route.ts`.
>
> `expireStaleOrders` trong `purchase.service.ts` và marker `@pending BE-07` của nó **giữ nguyên**.
> Bảng điểm cắm vẫn 8 cắm / 11 chặn, không mất marker nào (3.8).
>
> **Vế (b) `tokenOverviewAction` vẫn còn mở** — chờ mã task của màn hình tài sản kênh `(admin)`.

Hai server action này đã chạy được và chưa ai gọi, tức đúng hình dạng một điểm cắm. Nhưng marker
đòi **một** mã task, và với hai cái này không có mã nào đứng vững. Đã **để nguyên, không marker**,
theo chỉ dẫn "không xếp được thì không đoán".

**(a) `expireStaleOrdersAction` — `app/src/app/actions/purchase.ts:37`**

Ba dữ kiện, và chúng không khớp nhau:

| Nguồn | Nói gì |
|---|---|
| `purchase.service.ts:543` (marker Bước 3) | `@pending BE-07` — việc gọi theo lịch thuộc BE-07 |
| `api/purchase/route.ts:11` | *"`expireStaleOrders` **CỐ Ý** không có ở đây: mở một điểm vào HTTP cho nó là mời gọi việc gọi tay giữa lúc có lệnh đang xử lý"* |
| `tech-report.md:877` | *"cố ý **không** mở điểm vào HTTP"* |

Vấn đề: **server action cũng là một điểm vào HTTP.** Next.js đăng ký nó thành một endpoint POST
gọi được trực tiếp — chính `actions/purchase.ts` mở đầu bằng ghi chú đó để giải thích vì sao guard
nằm trong service. Nên hai tệp transport đang **làm ngược nhau** cho cùng một nghiệp vụ: route
handler cố ý không mở, server action thì đã mở.

Ba cách hiểu:

- **(a1)** `@pending BE-07`. Nhưng BE-07 chạy phía máy chủ nên nó gọi **thẳng** service, không cần
  đi qua server action. Marker sẽ nói "BE-07 chỉ cần gọi" cho một hàm mà BE-07 không dùng.
- **(a2)** `@pending FE-06` — một nút "dọn lệnh treo" ở màn quản trị. Nhưng điều đó **trái** với
  chủ đích đã ghi hai chỗ là không cho gọi tay.
- **(a3)** Server action này là **thừa** và nên xóa, để `expireStaleOrders` chỉ có một đường vào
  là tiến trình theo lịch — đúng như chủ đích đã ghi.

**Đề xuất (a3)**, nhưng **không tự làm**: xóa một server action là **thu hẹp mặt tiền transport**,
tức đổi hành vi, mà Bước 5 bị cấm đổi hành vi. Nếu Supervisor chốt (a3) thì đó là 3 dòng xóa +
một dòng ghi chú, làm ở Bước 7 hoặc một nhánh `fix/` riêng.

Ở Bước 5 lập luận này được ghi nguyên văn vào khối chú thích ngay trên hàm, để người đọc mã thấy
được lý do thiếu marker mà không phải mở checkpoint. **Bước 6 xóa khối đó cùng với hàm**: câu hỏi
đã có câu trả lời nên một khối chú thích nói "chưa rõ ai sẽ gọi" trở thành thông tin sai. Thay vào
đó là 5 dòng ở khối đầu tệp nói chủ đích đã chốt.

**(b) `tokenOverviewAction` — `app/src/app/actions/bank.ts:36`**

`tokenOverview` **có** người dùng: `api/token/route.ts:8`. Riêng server action thì không. Kiểu trả
về `TokenOverview` có trường `bankAddress` với chú thích *"để đối chiếu quyền on-chain"* — đó là
nhu cầu của **kênh quản trị**, không phải của nhà đầu tư. Nhưng `(admin)/assets/page.tsx` hiện là
trang trống, và **không có mã task nào trong `task-status.json` gắn với màn hình đó**: `FE-04` là
tổng quan **nhà đầu tư** (`fe-01/requirements.md:15`), `FE-10`/`FE-11` chưa có mô tả trong repo.

Xin Owner cho biết mã task nào sẽ dựng màn hình tài sản của kênh `(admin)`; có mã rồi thì đây là
một marker `@pending` một dòng.

### Q6 — 40 export của `components/ui/*` (shadcn): xin xác nhận để nguyên

Đây là **nhóm lớn nhất của cả 115 dòng (35 %)** và không có trong bảng của `design.md` mục 6, nên
xin xác nhận thay vì tự quyết. Đã **để nguyên**, lý do ở mục 4.3 nhóm G.

Hai cách hiểu:

- **(a) Để nguyên (đã chọn).** Chúng là primitive sao chép vào theo từng bộ; xóa lẻ làm tệp lệch
  bản gốc nên lần `shadcn add` sau sinh diff giả, và bộ nào sẽ cần thì phụ thuộc FE-05/FE-06 vẽ
  màn gì — chưa biết. Lợi ích của việc xóa bằng **không**: bundler đã loại cây chết nên chúng
  không vào bundle sản phẩm, tức không ảnh hưởng giới hạn kích thước Cloudflare.
- **(b) Xóa export không dùng.** Bảng điểm cắm sạch hơn 40 dòng, nhưng mỗi lần FE cần một
  primitive lại phải thêm lại, và người thêm sẽ không biết là nó từng bị xóa.

**Đề xuất (a).** Nếu Supervisor muốn (b) thì nên làm ở một nhánh `chore/` riêng cùng lúc với việc
dọn `@radix-ui/*` ở Bước 7, không trộn vào Bước 5.

### Q7 — Ba seam kiểm thử không có test nào gọi: xóa hay để?

`resetSignerCache`, `resetChainRegistryCache`, `resetKycProviderCache`. `design.md` mục 6 xếp
chúng vào nhóm "dùng trong test"; đo thật thì **không test nào gọi** (bằng chứng ở 4.3). Theo chỉ
dẫn "không tìm được chỗ gọi thì nó không thuộc nhóm này", chúng rơi sang nhóm I. Đã **để nguyên**.

Hai cách hiểu:

- **(a) Là mã chết, xóa.** Đúng theo chữ của `tasks.md` 5.5. Ba lần 3 dòng, `build` và test chắc
  chắn xanh, và thêm lại thì dễ.
- **(b) Là seam kiểm thử có chủ đích, giữ (đã chọn).** Cả ba tự khai mục đích trong chú thích
  (*"Chỉ dùng trong test sau khi đổi env"*, *"Xoá cache khi env đổi (test)"*), và ba hàm **cùng
  họ** thì đang được dùng thật ở 21 chỗ — nên đây là một họ nhất quán, không phải ba hàm bỏ quên.
  Cái nó phòng là loại lỗi mà chính chú thích trong `signer/index.ts` gọi là *"rất khó truy"*: test
  đổi env rồi nhận về đối tượng cache của lần trước, và triệu chứng là một test đỏ **tuỳ theo thứ
  tự chạy**.

**Đề xuất (b), nhưng đây là chỗ tôi ít chắc nhất của cả Bước 5.** Lý do chọn (b) chứ không (a):
trong năm ký hiệu của nhóm I thì đây là ba cái duy nhất mà hành động "xóa" **lấy đi một lớp phòng
hộ** đã được viết ra có chủ đích. Nếu Supervisor thấy nên xóa thì đó là 9 dòng, làm ngay được.

### Q8 — `getSigner`: có nên thu hẹp thành `function` (bỏ `export`) không?

Theo định nghĩa của nhóm B thì nó thuộc nhóm đó: chỉ `getBankSigner` trong cùng tệp gọi nó, và
`tech-report.md:388` ghi mặt tiền của `signer/index.ts` là `getBankSigner()`. **Đã cố ý KHÔNG thu
hẹp**, lý do đầy đủ ở 4.3.

Tóm lại: `getSigner(kind, chain)` là **cửa vào factory của LUẬT #2** — chỗ duy nhất chọn custody.
`tech.md` viết "Thêm custody = thêm 1 `ISigner`, **đổi factory**", và `workflow.md` đặt 3 LUẬT
thành cổng nghiệm thu bắt buộc. Đổi mặt tiền của một cổng kiến trúc trong một bước **dọn dẹp**, để
lấy một dòng ít hơn trong bảng, là đánh đổi sai hướng — nên tôi không tự quyết.

Nếu Supervisor chốt thu hẹp: một dòng (`export function getSigner` → `function getSigner`),
`getBankSigner` chạy nguyên, không chỗ nào khác phải sửa.

---

## 12. Tự đánh giá 3 LUẬT kiến trúc

### Bước 6 — chạm `lib/ledger` (LUẬT #1) và một server action, nên đánh giá kỹ

```
$ git diff --name-only c17fc1e..HEAD -- app/src app/test packages
app/src/app/actions/purchase.ts
app/src/lib/bank/issuance.ts
app/src/lib/config/issue-terms.ts
app/src/lib/ledger/mock.adapter.ts
app/test/issue-price-single-source.test.ts
```

| LUẬT | Có bị chạm? | Bằng chứng |
|---|---|---|
| **#1** mọi tương tác chain qua `ILedgerPort` | **Có chạm, nhưng không làm yếu** | Sửa duy nhất trong `mock.adapter.ts` là **nguồn của một hằng số**: `100_000n` → `BigInt(WPT_ISSUE_PRICE_VND)`. Không thêm/bớt/đổi method nào của `ILedgerPort`, không đổi chữ ký, không đổi hành vi — 49 ca `mock-ledger.test.ts` xanh nguyên. Chiều nhập mới là `ledger → config`, tức tầng cổng nhập xuống tầng cấu hình; **không** tạo chỗ nào để nghiệp vụ hay component gọi chain trực tiếp |
| **#2** mọi thao tác ký qua `ISigner` | **Không** | `app/src/lib/signer/` không có tệp nào trong danh sách. Giá phát hành không liên quan tới ký |
| **#3** mọi kiểm quyền qua RBAC | **Không, và đây là chỗ cần nói rõ** | Xóa `expireStaleOrdersAction` **không** gỡ phép kiểm quyền nào: guard `order:expire` nằm **trong** `expireStaleOrders` của service (`assertCan` qua `authorize()`), không nằm ở server action — đúng chủ đích đã ghi ở đầu `actions/purchase.ts`. Đường vào còn lại (BE-07 gọi thẳng service) **vẫn đi qua đúng guard đó**. Xóa một transport không mở lối tắt nào quanh RBAC; ngược lại nó bỏ một điểm vào HTTP |

Một điều đáng ghi về hướng của thay đổi: đặt hằng số ở `lib/config` **giữ** cho `lib/ledger` không
phải nhập từ `lib/bank`. Nếu làm theo cách `design.md` mục 4 phác ra thì `app/src/lib` sẽ có đúng
một chỗ ngược tầng, và nó nằm ngay trong tầng cổng của LUẬT #1 (bằng chứng và hậu quả ở mục 6.1).

### Bước 5 — bước ĐẦU TIÊN chạm mã thực thi, nên đánh giá kỹ hơn

Bốn bước trước chỉ sửa bình luận, tài liệu và script. Bước 5 **xóa hai hàm và đổi bốn từ khóa
`export`**, nên đây là lần đầu phép đánh giá này có nội dung thật.

```
$ git diff --name-only 1f7757f..HEAD -- app/src packages
app/src/app/actions/purchase.ts
app/src/lib/bank/schemas.ts
app/src/lib/signer/wallet.signer.ts
app/src/lib/store/index.ts
app/src/lib/wagmi.ts
packages/shared/src/addresses.ts
packages/shared/src/chains.ts
packages/shared/src/index.ts
```

| LUẬT | Có bị chạm? | Bằng chứng |
|---|---|---|
| **#1** mọi tương tác chain qua `ILedgerPort` | **Không** | `app/src/lib/ledger/` **không có tệp nào** trong danh sách trên. 5 interface con (`ILedgerCompliance`, `ILedgerIssuance`, `ILedgerPurchase`, `ILedgerDistribution`, `ILedgerRead`) đều nằm trong 115 dòng và đều được xếp nhóm E → **giữ nguyên `export`**, đúng ràng buộc "không xóa export thuộc hợp đồng kiến trúc" |
| **#2** mọi thao tác ký qua `ISigner` | **Chỉ thêm bình luận** | `wallet.signer.ts` chỉ thêm 2 dòng marker. `getSigner` **cố ý không** thu hẹp (Q8); `SignerKind` giữ `export` (nhóm E). `createWalletSigner` được gắn marker để lần sau không ai xóa nó vì tưởng là rác — đây là chỗ Bước 5 **củng cố** LUẬT #2 chứ không làm yếu |
| **#3** mọi kiểm quyền qua RBAC | **Không** | `app/src/lib/rbac/` không có tệp nào trong danh sách. `schemas.ts` chỉ đổi phạm vi hai schema, không chạm `can()` / `assertCan()` |

Phép kiểm "**không đổi hành vi**" của Bước 5 khắt khe hơn Bước 3 (Bước 3 chỉ sửa bình luận nên
diff mã thực thi phải **rỗng**; Bước 5 thì cố ý có diff). Thay vào đó, ba khẳng định sau đo được:

1. **Không thân hàm nào bị sửa, không chữ ký nào bị đổi.** Hai hàm bị xóa **nguyên khối**; bốn
   ký hiệu chỉ mất từ khóa `export`.
2. **Không test nào bị sửa.** 285 test, số ca từng tệp y nguyên Bước 4 (mục 3.7).
3. **17/17 route vẫn sinh được** sau mỗi thay đổi, qua 3 lần `next build` (mục 3.7).

`verify-arch-rules.sh` vẫn **20 PASS / 0 FAIL / 6 WARN** — sáu cảnh báo y nguyên nền của `dev`,
Bước 5 không thêm cái nào, kể cả sau khi xóa hai hàm khỏi `packages/shared`.

### Bước 4

**Không chạm tệp mã nguồn nào** trong `app/src` hay `packages/*/src`. Chỉ thêm một tệp test và sửa
một script ở `scripts/`. Bằng chứng:

```
$ git diff --name-only dd0fac0..HEAD
app/test/pending-markers.test.ts
scripts/scan-pending.mjs
$ git diff --stat dd0fac0..HEAD -- app/src packages
(rỗng)
```

Ba luật vì vậy **không bị chạm**, nhưng có một chỗ đáng nói theo hướng tích cực: `app/src` trong
lần đột biến bị sửa bốn lần rồi hoàn nguyên bốn lần, và `git diff -- app packages scripts` rỗng
chứng minh không lần nào lọt vào commit. Lớp 3 của `verify-arch-rules.sh` vẫn `20 PASS / 0 FAIL /
6 WARN`, đúng con số Bước 3 — không thêm cảnh báo nào.

Cần lưu ý cho các bước sau: tệp test mới `import` từ `scripts/scan-pending.mjs`, tức có một cạnh
phụ thuộc mới từ `app/test` ra ngoài `app/`. Cạnh này **chỉ tồn tại lúc chạy test**, không vào
bundle nào (`scan-pending.mjs` không được `app/src` nhập), nên không ảnh hưởng kích thước bundle
Cloudflare. Đã kiểm `npm run build` không cần chạy lại vì `tsconfig.json` đã `include` tệp test từ
trước và `npm run typecheck` xanh.

### Bước 3

Bước đầu tiên **chạm tệp mã nguồn**, nên đánh giá ở đây là đánh giá thật chứ không phải hình
thức. Ba tệp bị sửa, và **chỉ bình luận** — chứng minh bằng diff rỗng ở mục 3.5, phép kiểm 3.

```
$ git diff --name-only a1ab71e..HEAD
.kiro/specs/mc-01-make-control/tasks.md
app/src/lib/bank/portfolio.service.ts
app/src/lib/bank/purchase.service.ts
app/src/lib/ledger/evm.adapter.ts
docs/CHECKPOINT_MC01.md
```

Ba tệp mã nguồn, còn lại là tài liệu và trạng thái spec.

- [x] **LUẬT #1** mọi tương tác chain qua `ILedgerPort` — không đổi. `evm.adapter.ts` vẫn là
      adapter đứng sau cổng; không thêm/bớt method, không đổi thân method nào. `verify-arch-rules.sh`
      vẫn 20 PASS / 0 FAIL.
- [x] **LUẬT #2** mọi ký qua `ISigner` — không chạm `lib/signer`.
- [x] **LUẬT #3** mọi kiểm quyền qua RBAC — không chạm `lib/rbac`. Marker `@pending BE-07` **nhắc**
      quyền `order:expire` trong phần mô tả, nhưng đó là chữ trong bình luận; phép kiểm quyền vẫn
      nằm nguyên trong `expireStaleOrders` qua `authorize()`.

Không sửa test nào đang xanh: 272 test vitest, 13 test hardhat, 47 test cargo giữ nguyên số và
vẫn xanh (mục 3.5). Không thêm test — Bước 4 mới làm.

Một điều đáng nói về DoD 3.4 (*giữ nguyên thông báo lỗi*): nó **không** được kiểm bằng cách đọc
lại bằng mắt mà bằng bộ lọc diff ở mục 3.5. Đọc mắt thì bỏ sót được, còn bộ lọc thì hoặc rỗng
hoặc không.

### Bước 2

Cũng **không chạm tệp mã nguồn nào**. Chỉ thêm một script ở `scripts/`, sửa `run-local-all.sh`,
`.kiro/task-status.json`, `.gitignore` và tài liệu. Đặc biệt **không sửa**
`app/src/lib/ledger/evm.adapter.ts` như ràng buộc của Bước 2 yêu cầu, và **không** gắn marker vào
tệp mã nguồn nào (Bước 3 và Bước 5 làm việc đó).

```
$ git diff --name-only cefc895..HEAD
.gitignore
.kiro/specs/mc-01-make-control/tasks.md
.kiro/task-status.json
docs/CHECKPOINT_MC01.md
scripts/run-local-all.sh
scripts/scan-pending.mjs
```

Ba luật không bị ảnh hưởng; `verify-arch-rules.sh` vẫn 20 PASS / 0 FAIL (mục 3.5). Không sửa test
nào đang xanh: 272 test vitest, 13 test hardhat, 47 test cargo đều giữ nguyên và vẫn xanh.

### Bước 1

Bước 1 **không chạm tệp mã nguồn nào** (`app/src`, `packages/*/src`), chỉ tạo steering, JSON và
tài liệu. Ba luật không bị ảnh hưởng.

```
$ git diff --name-only 71932bb..HEAD
.kiro/specs/mc-01-make-control/design.md
.kiro/specs/mc-01-make-control/requirements.md
.kiro/specs/mc-01-make-control/tasks.md
.kiro/steering/make-control.md
.kiro/task-status.json
docs/CHECKPOINT_MC01.md
docs/mc-01-make-control/design.md
docs/mc-01-make-control/requirements.md
docs/mc-01-make-control/tasks.md
```

- [x] Mọi call chain qua `ILedgerPort` — không đổi
- [x] Mọi ký qua `ISigner` — không đổi
- [x] Mọi kiểm quyền qua RBAC — không đổi

Đánh giá đầy đủ sẽ làm lại ở vòng nộp cuối, khi Bước 5–7 đã chạm mã nguồn.
