# Báo cáo bàn giao — OP-03: hardhat một lệnh và bộ đầu cuối trên chuỗi cục bộ

| | |
|---|---|
| Mã task | OP-03 |
| Nhánh | `ops/03-evm-local`, từ `dev` @ `e4dd889` |
| Spec | `docs/op-03-evm-local/{requirements,tasks}.md` (gói `20261008_spec_dot5_v5`) |
| Mức kiểm chứng | Vừa |
| Tiến độ | Xong năm bước, `OP-03` đã chuyển `done`; chưa mở PR, chờ Supervisor nghiệm thu |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn) | | Bằng chứng |
|---|---|---|---|
| 1 | `evm-local.sh` có `up`/`down`/`reset`, đúng ca 1 tới 4, cây sạch | ✅ | mục 3.1 |
| 2 | Hai ví mẫu whitelist trên chuỗi, địa chỉ một nguồn | ✅ | mục 3.2 |
| 3 | Bộ `mock` trên bản build của phần `build`, ba lần liên tiếp xanh | ✅ | mục 3.3 |
| 4 | Project `hardhat` xanh; cách xử lý chain mặc định ghi lại | ✅ | mục 3.4, 4 |
| 5 | Phần `evm` trong `run-local-all.sh` và job `heavy`, tự dọn kể cả khi đỏ | ✅ | mục 3.4, 3.5 |
| 6 | Việc kèm 8, 9, 10 | ✅ | mục 3.6 |
| 7 | `docs/EVM_LOCAL.md` có, đã đi lại từ bản clone sạch | ✅ | mục 3.7 |
| 8 | `task-status.json` và `GIAO_VIEC_DOT_5.md` theo kế hoạch bản 3 | ✅ | mục 3.8 |
| 9 | `run-local-all.sh` bộ mặc định xanh | ✅ | mục 5 |

**Kết luận:** 9 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có việc chặn. Bốn chỗ lệch spec (mục 2) đã làm theo cách nhỏ nhất và ghi rõ để Supervisor
  duyệt: sửa thêm `investor-channel.spec.ts`, `hardhat.config.js`, `next.config.ts`, `tsconfig.json`
  ngoài danh sách Tác động.

---

## 1. Đã làm

- `scripts/evm-local.sh` `up`/`down`/`reset`. Kết luận "triển khai hay dừng" lấy từ
  `contracts-evm/scripts/local-state.js`: so bytecode trên chuỗi với artifact, **che vùng
  `immutable`** theo `immutableReferences` của build-info (WPT, VNDB, Distributor, Redemption đều
  có immutable, so thẳng thì luôn lệch). Nút ghi log và PID ở `$TMPDIR/bidv-evm-local-<cổng>/`.
- `deploy.js`: `writeAddresses` bỏ `deployedAt` khi so, chỉ ghi khi chainId, người triển khai hoặc
  địa chỉ đổi. Không đổi gì khác.
- Ví mẫu: `packages/shared/src/sample-wallets.json`; app đọc qua `SAMPLE_WALLETS`
  (`account-profile.service.ts`), `seed-local.js` đọc thẳng tệp. Seed chỉ gửi giao dịch cho ví chưa
  whitelist.
- Playwright: `next start` trên bản build, `E2E_DEV=1` để chạy `next dev`. `E2E_CHAIN` chọn project
  (`mock` mặc định, `hardhat` khi `hardhat-local`). Project `hardhat` không dùng lại máy chủ cũ.
- Phần `evm` trong `run-local-all.sh`, bước mới trong job `heavy` (sau `build e2e`), thêm phụ thuộc
  và đệm solc của `contracts-evm`, `timeout-minutes` 30 → 40, giữ `node.log` khi đỏ.
- Việc kèm 8, 9, 10; `docs/EVM_LOCAL.md`; liên kết từ `docs/guide.md`.
- Báo cáo công nghệ 3.7 → 3.8: metadata, 1.4 (cây thư mục), 1.5 (chế độ chuỗi cục bộ, `vars`),
  1.6.A (bài học), 2.5 (số ca Playwright), 2.7 (phần `evm`, lệnh), 3.7 (`sample-wallets.json`),
  3.10 (`evm-local.sh`), nợ P2 ở 1.6.C. Bài học thêm vào `.kiro/steering/lessons.md`.

## 2. Sai lệch so với spec

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Bước 0 chạy `node scripts/check-pending-markers.mjs` | Tệp không có (`ls scripts/check-pending-markers.mjs` → không tồn tại). Đã chạy `node scripts/scan-pending.mjs --check`: "18 điểm cắm, 13 điểm chặn, 35 bước luồng. Không có lỗi." | Script đúng tên trong repo là `scan-pending.mjs --check` (phần `markers`) |
| 2 | Tác động không có `app/e2e/investor-channel.spec.ts` | Sửa ca `:310` | Chuyển sang bản build làm ca này đỏ ổn định 3/3 lần: câu miễn trừ bắt buộc chứa "biến động giá". Trên `next dev` nó xanh ăn may vì kiểm trước khi hộp tải. Sửa: đợi hộp hiện, loại câu miễn trừ khỏi phép kiểm. Không đổi sản phẩm |
| 3 | Tác động không có `hardhat.config.js` | Thêm `networks.localhost.url` đọc `LOCAL_RPC_URL`, và biến `EVM_LOCAL_PORT` ở `evm-local.sh` | Lúc làm, cổng 8545 có nút hardhat của một phiên khác (thư mục gốc repo). Không tắt nút đó; chạy toàn bộ bằng chứng ở cổng 8645. Mặc định vẫn 8545, CI không đặt biến này |
| 4 | Tác động không có `next.config.ts`, `app/tsconfig.json`, `app/.gitignore` | `distDir` đọc `NEXT_DIST_DIR`; khai sẵn `.next-hardhat/types` trong `include`; bỏ qua `.next-hardhat/` | Cách (a) ở việc 6 cần thư mục build riêng. Không khai sẵn thì mỗi lần `next build` tự thêm hai dòng và định dạng lại cả `tsconfig.json`, làm bẩn cây (đã gặp, mục 3.4) |
| 5 | "Hiện trạng" ghi 12 xanh / 1 đỏ ở `E2E_CHAIN=hardhat-local` trên `next dev` | Không đo lại số này | Đã đọc mã xác nhận ca `:57` giả định `mock`. Sau sửa, project `hardhat` 13/13 (mục 3.4) |

Các số khác đo lại trên nền khớp spec: `git show e4dd889:app/src/lib/ledger/evm.adapter.ts | grep -c "@blocked"` → 13;
`ALL_PARTS` nền có 7 phần; `playwright.config.ts` nền dòng 50 `npx next dev`; hai ví mẫu ở dòng 67, 85
của `account-profile.service.ts`; `grep -c '"vars"' app/wrangler.json` nền → 0.

## 3. Bằng chứng

Mọi lệnh chạy ở cổng 8645 (`export EVM_LOCAL_PORT=8645`), lý do ở mục 2 dòng 3.

### 3.1 Ca 1 tới 4

| Ca | Thao tác | Kết quả |
|---|---|---|
| 1 | `reset` rồi `up` | Lần hai in "Hợp đồng đã có và khớp bản biên dịch hiện tại." · "không triển khai lại"; seed in "đã whitelist" cho cả hai ví, không gửi giao dịch |
| 2 | `git status --short packages/shared` sau `up` và `reset` | Không có `addresses.json` hay `generated/`; deploy in "Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json" |
| 3 | `down`, dựng nút tay, `eth_sendTransaction` 1 wei, rồi `up` | Bốn dòng "chưa có ở …" + "nút đã có 1 khối, triển khai lên đó sẽ ra địa chỉ khác"; "LỖI: … Chạy: bash scripts/evm-local.sh reset" |
| 4 | `reset`, sửa chuỗi `require` trong `ProjectToken.sol`, `up` | "ProjectToken … lệch bản biên dịch hiện tại" (cả Distributor, Redemption vì metadata nhúng nguồn ProjectToken), báo `reset`. Hoàn nguyên bằng `git checkout`, `up` lại → "khớp", không triển khai |

### 3.2 Ví mẫu trên chuỗi (ca 5)

Đọc thẳng `isWhitelisted` bằng ethers sau `up`: `NDT001 … true`, `NB001 … true`, ví đối chứng
Hardhat #2 `false`. Địa chỉ một nguồn:
`grep -rln "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" app/src packages/shared/src packages/contracts-evm/scripts scripts`
→ chỉ `packages/shared/src/sample-wallets.json`.

### 3.3 Bộ `mock` trên bản build (ca 7)

`bash scripts/run-local-all.sh build` (17 s) rồi ba lần liên tiếp `cd app && npx playwright test`,
không có nút nào ở cổng `RPC_HARDHAT` trỏ tới:

| Lần | Kết quả | Playwright | Tổng |
|---|---|---|---|
| 1 | 54 passed, mã thoát 0 | 22,1 s | 23 s |
| 2 | 54 passed, mã thoát 0 | 22,3 s | 23 s |
| 3 | 54 passed, mã thoát 0 | 22,0 s | 23 s |

Trước khi sửa ca ở mục 2 dòng 2: ba lần đều 53 passed / 1 failed, cùng ca `investor-channel.spec.ts:310`.

### 3.4 Project `hardhat` và phần `evm` (ca 6, ca 8)

- `bash scripts/run-local-all.sh evm` → mã thoát 0, 24 s: build `.next-hardhat` PASS, dựng chuỗi PASS,
  **13 passed** (4,6 s). Sau đó cổng 8645 và 3200 trống.
- Chuỗi thật sự được ghi: `reset`, chạy project, đọc `balanceOf(NDT001)` = 100, `totalSupply` = 100,
  khối 8.
- Lần đầu, `git status` báo `app/tsconfig.json` bị `next build` tự sửa; xử lý ở mục 2 dòng 4, lần
  chạy lại cây sạch.
- Ca 8: đổi tạm `before + 100n` thành `before + 999n` ở `mint.spec.ts` → mã thoát 1, "1 failed,
  12 passed", "=> FAIL: EVM - E2E PROJECT HARDHAT", vẫn có dòng "đã dừng nút". Sau đó
  `lsof -ti tcp:8645` và `tcp:3200` rỗng, không còn tiến trình `next start --port 3200`. Đã hoàn nguyên.

### 3.5 CI

Job `heavy`: bước "Kiểm thử đầu cuối trên chuỗi hardhat cục bộ" gọi `bash scripts/run-local-all.sh evm`,
sau bước `build e2e`. YAML đọc được bằng gói `yaml` của app, đủ 12 bước theo thứ tự. Chưa chạy trên
GitHub (chưa mở PR).

### 3.6 Việc kèm

- Việc 8: `purchase.service.ts` nhánh `catch` của `autoSettleCreatedOrder`:
  `console.error(\`[purchase] tự quyết toán lệnh ${order.id} lỗi ngoài dự kiến:\`, error)`.
  `npx vitest --run purchase` → 100 passed.
- Việc 9: dòng P2 "Lệnh kẹt ở `PLACED` không can thiệp được" ở `tech-report.md` 1.6.C. Đã kiểm
  `INTERVENTION_ORDER_STATUSES = ['CHECKING', 'EXECUTING']` (`purchase.state.ts:153`).
- Việc 10 (ca 9), đo bằng `grep -nE "useMockKyc: boolFlag|useMockDb: boolFlag|enableDemo.*: boolFlag|: 'TELLER'\)\)" app/src/lib/config/env.ts`:

| Biến | Giá trị đặt | Mặc định trong mã |
|---|---|---|
| `USE_MOCK_KYC` | `"true"` | `env.ts:106` `boolFlag(true)` |
| `USE_MOCK_DB` | `"true"` | `env.ts:110` `boolFlag(true)` |
| `DEMO_ROLE` | `"TELLER"` | `env.ts:146` `… : 'TELLER'` |
| `ENABLE_DEMO_PAYMENT_MINT` | `"true"` | `env.ts:122` `boolFlag(true)` |
| `ENABLE_DEMO_TOKEN_MINT` | `"false"` | `env.ts:131` `boolFlag(false)` |

### 3.7 Đi lại `docs/EVM_LOCAL.md` từ bản clone sạch

`git clone -b ops/03-evm-local` vào thư mục tạm, đi từng mục với `EVM_LOCAL_PORT=8645`:
`up` (triển khai, whitelist), `up` lần hai (không triển khai), `git status` rỗng; `.env.local` theo
mục 3 rồi `npm run dev`: bộ chọn chain mặc định `hardhat-local`, KYC + Whitelist NDT001 trả
"whitelist=true · tx … (CONFIRMED)"; `down`, `build e2e` → 54 passed; `evm` → 13 passed; `git status`
rỗng.

Giới hạn: ổ đĩa máy chỉ còn 1,8 GiB, không đủ cho hai lần `npm ci` (~2,2 GB) nên `node_modules` của
clone sao bằng `cp -c` (APFS copy-on-write) từ worktree. `npm ci` của mục 1 đã chạy thật ở đầu task
với cùng lockfile, mã thoát 0 cả hai thư mục.

### 3.8 Kế hoạch và trạng thái

Commit đầu `294f281`: thay `docs/GIAO_VIEC_DOT_5.md` bằng bản 3; thêm đúng chín mã `OP-03`, `OP-04`,
`OP-05`, `SC-06`, `SC-07`, `SC-08`, `BE-18`, `IN-03`, `IN-04`, `OP-03` sang `inProgress`. Commit cuối
chuyển `OP-03` sang `done`.

## 4. Chain mặc định của project `hardhat` (việc 6): chọn cách (a)

Bản build riêng ở `app/.next-hardhat` (`NEXT_DIST_DIR`), dựng với `NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local`.

- App chạy **thật** với mặc định `hardhat-local`, cả các đường phía máy chủ đọc chain mặc định
  (`resolveChainKey`). Cách (b) chỉ đổi chain ở giao diện, và chain trong store không lưu qua lần
  tải trang (`chain-store.ts`), nên mỗi `page.goto` phải chọn lại và phải sửa `mint.spec.ts`.
- Không ghi đè `.next` của phần `e2e`. Giá: thêm một lần build (cục bộ khoảng 15 s có đệm).

## 5. Kết quả chạy cuối

| Lệnh | Kết quả |
|---|---|
| `bash scripts/run-local-all.sh` | Mã thoát 0, 21 s. Đạt 7 / không đạt 0: arch (3 cảnh báo, đều có từ trước), markers, checkpoint, contracts 67 passing, typecheck, lint, Vitest 790/790 (30 tệp) |
| `bash scripts/run-local-all.sh build e2e` | Mã thoát 0; 54 passed (mục 3.3, và lần trên bản clone ở 3.7) |
| `bash scripts/run-local-all.sh evm` | Mã thoát 0; 13 passed (mục 3.4, 3.7) |
| `BASE_REF=e4dd889 bash scripts/verify-arch-rules.sh` | "Contract không bị sửa so với e4dd889" |
| `node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP03.md docs/op-03-evm-local/requirements.md` | ĐẠT |

Lần chạy đầu bộ mặc định đỏ hai mục, cả hai do thay đổi của task này và đã gộp vào đúng commit gây ra:
ESLint quét bản build `.next-hardhat` (thêm vào `globalIgnores`, commit bước 3), và
`docs/flows/purchase.md` lệch một dòng sau khi thêm `console.error` (sinh lại bằng
`node scripts/gen-flow-diagram.mjs purchase`, commit bước 4).
