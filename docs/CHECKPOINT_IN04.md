# Báo cáo bàn giao: IN-04 Ký Mint, Burn qua Fireblocks (Vault Account), công tắc "Lưu ký Fireblocks"

| | |
|---|---|
| Mã task | IN-04 |
| Nhánh | `feat/in-04-fireblocks-mint-burn`, tạo từ `dev` (`8f75d38`) |
| Spec | `docs/in-04-fireblocks-mint-burn/{requirements,design,tasks}.md` (bản spec thứ hai, chép nguyên) |
| Commit | mã `ef48347`, sửa nhỏ `d2cf384`; tài liệu `41ed9df` (bản nháp) và commit tài liệu cuối trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | A1 tới A5, B1 tới B4, C1 tới C7, D1 tới D3 (gồm D2b), E1 tới E3, F1, G1 đã làm | ✅ | mục 5 |
| 2 | Vitest ca 1 tới 19 (gồm 5b, 7b, 18b) xanh; 31 đột biến bị bắt; đột biến "bỏ kiểm vai" bị ca 7b bắt | ✅ | mục 1.1, 1.3 |
| 3 | `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` mock và hardhat, `arch markers checkpoint` xanh; tệp `*-evm` liên quan Mint, Burn xanh | ✅ | mục 1.2, 2 |
| 4 | Số action khi mở màn không đổi; thời gian trả `/` trước và sau | ✅ | mục 3 |
| 5 | Không có khoá, JWT trong mã, test, log, ảnh | ✅ | mục 6 (chỉ còn dòng hằng đầu, cuối PEM) |
| 6 | Ảnh trên `mock` trong `docs/images/in-04/` | ✅ | mục 4 |
| 7 | Diff không thêm dòng có mũi tên, gạch dài, chấm giữa (trừ dòng do script sinh) | ✅ | mục 6 |
| 8 | Mục "Giới hạn đã chấp nhận" (QĐ-16, QĐ-7b) | ✅ | mục 9 |
| 9 | `docs/USER_GUIDE.md`, checkpoint này có mục "Việc của chủ dự án", `.kiro/task-status.json` | ✅ | mục 7, 10 |

**Kết luận:** 9 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, không thêm thư viện (khách REST tự viết bằng `fetch` và Web
Crypto). Lược đồ `TokenRequest` thêm ba cột (`custody`, `custodyTxId`, `custodyContext`), tự thêm vào database đang
chạy qua `ADDED_COLUMNS`. Quyền mới `custody:toggle` cho Giao dịch viên và Kiểm soát viên. Mặc định (công tắc tắt)
mọi thứ như trước IN-04. Không dùng khoá Fireblocks thật nào: mọi ca chạy với khách giả.

UserGuide: đã cập nhật Phần 1 mục 1.1, 1.4; Phần 2; Phần 3 mục 3.0 (mới: công tắc, màn chặn vai), 3.4.4; Phụ
lục B (khoá `custody.fireblocks.enabled`), C (L-15); Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- Không có việc chặn. Năm việc của chủ dự án sau khi merge ở mục 10 (cấp vai, nạp ETH, đặt khoá, thử `/lookup404`,
  chạy thật trên Sepolia). Chỗ làm khác chữ spec ở mục 8.

---

## 1. Vitest

### 1.1 Tệp mới

```text
$ (cd app && npx vitest --run test/in-04-fireblocks.test.ts)
      Tests  48 passed | 3 skipped (51)          # 3 ca Postgres bỏ qua khi thiếu TEST_DATABASE_URL
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/in-04-fireblocks.test.ts)
      Tests  51 passed (51)
$ bash scripts/evm-local.sh reset
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/in-04-fireblocks-evm.test.ts)
      Tests  3 passed (3)
```

`in-04-fireblocks.test.ts` chạy bộ nhớ trên `mock`: vỏ bọc `@/lib/ledger` thêm ba phương thức Fireblocks giả (D1,
D2, D2b) và đếm mọi lời gọi khoá máy chủ; khách giả `test/helpers/fake-fireblocks.ts` "phát lên chuỗi" bằng chính
ledger mock nên số liệu token đổi thật. Ca 1, 2 dùng máy chủ HTTP cục bộ và cặp khoá RSA sinh lúc chạy (không ghi ra
tệp). Ca Postgres dựng database riêng `bidv_in04_<pid>` rồi xoá.

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Máy chủ cục bộ kiểm chữ ký RS256 bằng khoá công khai; `uri` đúng đường dẫn, `sub` là khoá API, `exp - iat` không quá 30, `bodyHash` bằng SHA-256 của thân nhận được; POST, GET đều đạt; `nonce` khác nhau; POST không có `Idempotency-Key`, thân đúng khuôn `CONTRACT_CALL`; `signJwt('/v1/x?a=1')` giữ chuỗi truy vấn |
| 2 | 404 mã 1439 là `null`; 404 không mã 1439, 404 mã khác, 403 đều ném; 400 có `status`, `code`, `message`; hết giờ là `FireblocksNetworkError`; câu lỗi không chứa khoá API, `Bearer`, `PRIVATE KEY`. `classifyCreateError`: 1438 trùng, nhóm từ chối kể cả HTTP 500, còn lại chưa biết |
| 3 | Thiếu từng biến thì `null` kèm tên biến; PEM viết một dòng với `\n` đọc được; PEM sai (PKCS#1, không phải PEM, base64 hỏng) thì lý do không chứa thân khoá; bảng chain: chain lạ, `mock`, thiếu mã tài sản, chain trùng, phần tử rỗng là cả bảng sai; đọc được khi thiếu khoá; chuỗi rỗng hợp lệ; bỏ biến dùng mặc định; `configRef` 16 hex, đổi theo `baseUrl` hoặc khoá API |
| 4 | Hai vai vận hành bật tắt được, bốn dòng lịch sử, bốn dòng sổ `custody:toggle`; Nhà đầu tư, Người bán `FORBIDDEN`; mất cấu hình sau khi bật: `enabled` vẫn true, `configured` false, `custodyFor` vẫn `FIREBLOCKS`; tắt khi thiếu cấu hình được, bật thì `VALIDATION` đúng câu |
| 5 | `custodyFor` đủ tổ hợp; bảng có phần tử sai (`evm:`, `foo:X`, `mock:X`, chain trùng, lẫn phần tử đúng) là `UNRESOLVED` |
| 5b | Bảng `evm:` khi công tắc bật: chặn, PENDING, 0 lời gọi khoá máy chủ, 0 lời gọi Fireblocks. Hai chain (`mock`, `hardhat-local`) hai mã tài sản: thân POST đúng `assetId`, vault theo bối cảnh từng yêu cầu; đổi cấu hình toàn cục ngay sau lúc chiếm quyền: thân POST vẫn theo bối cảnh |
| 6 | Có mã ở `CONFIRMING`, `COMPLETED`, `FAILED` là `HASH`; `CANCELLED`, `BLOCKED`, `REJECTED`, `FAILED`/thiếu phí không mã là `DEAD`; `FAILED` lý do khác là `WAIT` có lý do; `SUBMITTED`, `PENDING_SIGNATURE`, `BROADCASTING` là `WAIT` |
| 7 | `submitViaFireblocks` với phụ thuộc giả, mười một nhánh của requirements (revert, lỗi mạng sau khi tạo, 1503, 1438 tra lỗi, 1438 tra 1439, mã lạ, 429, lỗi mạng tra 1439, 404 không mã, hết giờ, `DEAD`); mọi nhánh trừ revert gọi tạo đúng một lần; nhịp hỏi 9 giây mỗi 3 giây là bốn lần |
| 7b | Vault thiếu vai: chặn đúng câu, PENDING, sổ FAILURE; đọc công tắc lỗi: chặn, PENDING; mất cấu hình: chặn, PENDING (cả ba không gọi khoá máy chủ); thành công: bối cảnh đủ bảy trường, `callDataHash` đúng, `Txn.actorAddress` là vault, nhãn "Thực hiện qua"; `getById` luôn ném, `attachCustodyTxId` ném, `saveTxn` ném sau khi có mã: đều EXECUTING; nhánh `saveTxn`: đối soát sau đó COMPLETED, 0 dòng `Txn` |
| 8 | 1439 (custodyTxId null, decidedAt cũ 400 ngày), hai lần: giữ, đúng câu, `canReconcile` true; 403 theo `externalTxId`, 500 theo mã Fireblocks: câu "Chưa đọc được Fireblocks; thử lại."; có mã: COMPLETED, kết quả có `txHash` mới, một dòng `Txn` của vault; `DEAD`: FAILED đúng lý do; công tắc tắt sau khi duyệt vẫn đối soát qua Fireblocks; không lần nào tạo giao dịch mới |
| 9 | Công tắc tắt: khoá máy chủ, `custody = SERVER`, 1 lời gọi khoá máy chủ, 0 Fireblocks, nhãn "Khoá ký máy chủ"; toàn bộ `token-request.test.ts`, `fe-08-approval.test.ts` xanh không sửa (mục 1.2) |
| 10 | Công tắc bật, bảng chỉ có `hardhat-local`: yêu cầu `mock` đi khoá máy chủ, `custody = SERVER` |
| 11 | Postgres: xoá ba cột rồi khởi tạo lại pool: ba cột trở lại; chiếm quyền ghi `custody`, `custodyContext`; `attachCustodyTxId`, `setCustodyCall` ghi khi EXECUTING, trả `null` sau khi COMPLETED; `claimTxHash` lần hai `null` |
| 12 | Hardhat: vault #7 chưa có vai: chặn, PENDING; tài khoản #0 cấp vai; duyệt Mint 1.000: COMPLETED, tổng cung tăng 1.000, giao dịch trên chuỗi `from` là vault, `to` là ProjectToken, `custody = FIREBLOCKS`, có `custodyTxId`, một dòng `Txn` của vault |
| 13 | Hardhat: Burn "Phần chưa phân phối" 100 qua vault: COMPLETED, số dư vault SPV giảm 100 |
| 14 | Hardhat: khách chậm, `FIREBLOCKS_HASH_WAIT_MS=1`: EXECUTING, `canReconcile` true; phát rồi đối soát: COMPLETED; phát đúng một lần; một dòng `Txn` của vault |
| 15 | `roleHomeHref`: `/portfolio`, `/seller`, `/`, `/` |
| 16 | Đổi `baseUrl`, đổi khoá API (đổi `configRef`), đổi vault ID: khách không được gọi, EXECUTING, câu QĐ-14; nhãn "Thực hiện qua" vẫn vault 11; khôi phục thì COMPLETED, `Txn.actorAddress` là vault |
| 17 | Tạo xong, `attachCustodyTxId` ném, khách giữ trạng thái chờ, tra trả 1439: ba lần đối soát (lần ba sau khi đặt decidedAt cũ): vẫn EXECUTING |
| 18 | Lần duyệt `from` khác; lần đối soát `to` khác, `input` khác: EXECUTING, sổ FAILURE nêu trường lệch; khớp đủ thì COMPLETED; `matchesPreparedCall` với `contract` hoặc `callDataHash` null, giao dịch null là false |
| 18b | Gắn mã lỗi lưu trữ sau khi đã gọi tạo: EXECUTING; lượt thua QĐ-16: EXECUTING, đúng câu, không thêm dòng sổ, 0 dòng `Txn`; `setCustodyCall` trả `null`: FAILED đúng câu, khách không được gọi |
| 19 | Postgres: (a) hai lượt đối soát đồng thời, (b) lần duyệt đang chờ cùng lúc một lần đối soát: COMPLETED một lần, một dòng `Txn`, một dòng `token:mint` SUCCESS; lượt kia nhận câu lượt khác hoặc "đã được chốt ở lượt khác" |

### 1.2 Toàn bộ `typecheck`, `lint`, `vitest`, tệp EVM

```text
$ (cd app && npx tsc --noEmit -p . && npx eslint src test --quiet)        # exit 0
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  69 passed | 11 skipped (80)
      Tests  1442 passed | 74 skipped (1516)          # bỏ qua: tệp cần nút Hardhat
# mỗi tệp sau một lần bash scripts/evm-local.sh reset, TEST_HARDHAT_RPC=http://127.0.0.1:8545
in-04-fireblocks-evm   Tests  3 passed (3)
fe-08-approval-evm     Tests  8 passed (8)
evm-issuance           Tests  13 passed | 1 skipped (14)   # ca bỏ qua cần TEST_OLD_HARDHAT_RPC, có từ trước
op-05-demo-cycle-evm   Tests  8 passed (8)
```

Test có sẵn đã sửa: chỉ `test/rbac.test.ts` (bảng `IN04_ACTIONS`, `custody:toggle` vào `ALL_WRITE_ACTIONS`, danh sách
quyền ghi của Kiểm soát viên). `pending-markers` xanh sau khi sinh lại `docs/flows/issue.md` và khối điểm cắm
`docs/tech-report.md` (chỉ đổi số dòng; bước 3 của luồng phát hành đổi tên biến từ `pending` sang `sent`).
`maker-checker-ui.test.ts` ca 10 (quét lời gọi `mint`, `burn`) xanh không sửa: lời gọi khoá máy chủ giữ ở đúng chỗ cũ.

### 1.3 Đột biến (31/31 bị bắt)

Mỗi đột biến sửa mã, chạy `test/in-04-fireblocks.test.ts` có `TEST_DATABASE_URL`, rồi trả mã về nguyên. Kịch bản
ngoài repo: `scratchpad/in04/mutate.py`.

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | JWT `bodyHash` băm chuỗi khác chuỗi gửi | ca 1 (2) |
| 2 | `uri` bỏ chuỗi truy vấn | ca 1 `signJwt` |
| 3 | `custodyFor` bỏ kiểm chain | ca 5, ca 10 |
| 4 | Chiếm quyền không ghi `custody` | 12 ca: 7b, 16, 17, 18, 19a |
| 5 | Đối soát gọi `createContractCall` khi không thấy | ca 8 |
| 6 | Tạo lỗi mạng mà không tra lại | ca 7 (lỗi mạng sau khi tạo) |
| 7 | Mã thuộc `CREATE_REJECTED_CODES` coi như chưa biết | ca 7 (1503) |
| 8 | Lỗi mạng coi như chắc chắn chưa tạo (`FAILED`) | ca 7 (4 nhánh chưa rõ) |
| 9 | `classifyFireblocksTx` coi `FAILED` có mã là `DEAD` | ca 6 |
| 10 | Bỏ kiểm vai của vault | **ca 7b** (vault thiếu vai), không cần nút Hardhat |
| 11 | Bỏ mô phỏng trước khi tạo (revert bị bỏ qua) | ca 7 (revert) |
| 12 | `canReconcile` bỏ nhánh `FIREBLOCKS` | ca 8 |
| 13 | Công tắc không kiểm quyền | ca 4 |
| 14 | `catch` của lần duyệt ghi `FAILED` dù đã gọi tạo | ca 7b (`saveTxn` ném) |
| 15 | Đọc công tắc lỗi thì rơi về khoá máy chủ | ca 7b |
| 16 | Tra lỗi 403 coi như không có | ca 2 |
| 17 | `enabled` gộp với `configured` | ca 4, ca 7b |
| 18 | Gửi `Idempotency-Key` khi tạo | ca 1 |
| 19 | Mã 1438 coi như từ chối | ca 2 (`classifyCreateError`), ca 7 |
| 20 | 404 không mã 1439 coi như `null` | ca 2 |
| 21 | Đối soát tự `FAILED` khi 1439 và đã lâu | ca 8, ca 17 |
| 22 | Bỏ kiểm `configRef` trong đối soát | ca 16 (đổi `baseUrl`, đổi khoá API) |
| 23 | Bỏ bước khớp QĐ-15 | ca 18 (2) |
| 24 | `fireblocksChainScope` bỏ phần tử sai rồi dùng phần còn lại | ca 3, 5, 5b |
| 25 | Lấy `assetId`, vault từ cấu hình toàn cục thay vì bối cảnh | ca 5b |
| 26 | Ghi `Txn` trước `claimTxHash` | ca 7b (2), 18b, 19b |
| 27 | Gắn mã không điều kiện (lượt thua ghi thêm `Txn`) | ca 18b, 11, 19a, 19b |
| 28 | Nhánh `!outcome.ok` ghi `FAILED` dù đã gọi tạo | ca 18b |
| 29 | `setCustodyCall` trả `null` mà vẫn gọi tạo | ca 18b |
| 30 | `matchesPreparedCall` coi `callDataHash` null là khớp | ca 18 |
| 31 | `syncTxnFromReceipt` thêm dòng `Txn` cho yêu cầu `FIREBLOCKS` | ca 7b (`saveTxn` ném rồi đối soát) |

## 2. Bản dựng, e2e, evm, job A

```text
$ CI=1 USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm; echo EXIT=$?
EXIT=0
  77 passed (1.3m), 7 skipped     # project mock, bằng FE-23 và FIX-02; bỏ qua là ca chỉ chạy hardhat
  26 passed (36.8s), 2 skipped    # project hardhat
  => ĐẠT các phần đã chạy: build e2e evm
```

Không thêm e2e (spec mục 7). Mô phỏng job A (cất `packages/contracts-evm/artifacts`):

```text
$ bash scripts/run-local-all.sh arch markers checkpoint app; echo EXIT=$?
  PASS: 20   FAIL: 0   WARN: 3      # 3 cảnh báo có từ trước, không tệp nào của IN-04
  Test Files  69 passed | 11 skipped (80)
  => ĐẠT các phần đã chạy: arch markers checkpoint app
EXIT=0
```

Kịch bản G1 trên nút Hardhat cục bộ (vault giả #7):

```text
$ FIREBLOCKS_VAULT_ADDRESS=0x14dC...9955 npx hardhat run scripts/fireblocks-roles.js --network localhost
MINTER_ROLE=false  AGENT_ROLE=false
$ ... FIREBLOCKS_ROLES_ACTION=grant
DRY-RUN: sẽ gửi grantRole(MINTER_ROLE, 0x14dC...9955)
DRY-RUN: sẽ gửi grantRole(AGENT_ROLE, 0x14dC...9955)
Đặt FIREBLOCKS_ROLES_CONFIRM=yes để gửi.
$ ... FIREBLOCKS_ROLES_ACTION=grant FIREBLOCKS_ROLES_CONFIRM=yes
Đã gửi grantRole(MINTER_ROLE, ...); CONFIRMED block=24
Đã gửi grantRole(AGENT_ROLE, ...); CONFIRMED block=25
MINTER_ROLE=true  AGENT_ROLE=true
```

## 3. Số server action khi mở và thời gian trả `/` (mock, `next start`)

Đếm header `next-action` (cách HF-01); máy chủ đo không có cấu hình Fireblocks. Thời gian trả `/` là thời gian tải
tài liệu HTML của Giao dịch viên: 2 lần làm nóng, 10 lần đo.

| Màn | Vai | Trước (`8f75d38`) | Sau |
|---|---|---|---|
| `/` | Giao dịch viên | 0 | 0 |
| `/draft` | Giao dịch viên | 3 | 3 |
| `/approvals/[id]` | Kiểm soát viên | 1 | 1 |
| `/seller` | Người bán | 1 | 1 |
| `/portfolio` | Nhà đầu tư | 1 | 1 |
| Thời gian trả `/` (trung vị) | Giao dịch viên | 15 ms | 15,5 ms |

`AppLayout` đọc thêm một khoá `SystemConfig` theo khoá chính, song song với số việc đang chờ, chỉ với hai vai vận
hành. Dòng "Thực hiện qua" tính trong lần đọc chi tiết có sẵn.

## 4. Ảnh (`docs/images/in-04/`, mock, không cấu hình Fireblocks)

| Tệp | Nội dung |
|---|---|
| `20261029_menu_giao_dich_vien_luu_ky_fireblocks.png` | Trang `/` của Giao dịch viên; đáy menu có "Lưu ký Fireblocks" và công tắc |
| `20261029_cong_tac_luu_ky_fireblocks_chua_cau_hinh.png` | Riêng thanh menu: công tắc tắt, mờ, khoá (gợi ý "Chưa cấu hình Fireblocks"), dòng phụ "Không áp dụng cho chain này" (bảng mặc định chỉ có `evm`) |
| `20261029_man_chan_vai_nut_ve_trang.png` | Nhà đầu tư mở `/draft`: màn chặn vai có nút "Về trang của vai hiện tại" (trỏ `/portfolio`) |

## 5. Yêu cầu và nơi làm

| Mã | Nơi làm |
|---|---|
| A1 | `lib/config/env.ts` (bảy biến `FIREBLOCKS_*`); `.env.example`; `app/wrangler.json` (bốn biến, không có khoá) |
| A2, B4 | `lib/custody/fireblocks-config.ts`: `fireblocksConfig`, `fireblocksChainScope`, `parseChainAssets`, `configRefOf`, `pemProblem`, `setFireblocksConfigForTest` |
| A3, A4 | `lib/bank/custody.service.ts`; `app/actions/custody.ts`; quyền `custody:toggle` ở `lib/rbac/permissions.ts` |
| A5 | `components/layout/custody-toggle.tsx` (mới), `sidebar.tsx`, `app-layout.tsx` |
| B1 tới B3 | `lib/custody/fireblocks-client.ts`: `createFireblocksClient`, `signJwt`, lớp lỗi, `classifyCreateError`, ba hằng mã lỗi; khách giả `test/helpers/fake-fireblocks.ts` |
| C1 tới C7 | `lib/custody/fireblocks-execution.ts` (`classifyFireblocksTx`, `submitViaFireblocks`, `reconcileViaFireblocks`, `matchesPreparedCall`, `fireblocksCallMismatch`); `lib/bank/issuance.service.ts` (`sendViaCustody`, `executeIssuance` nhận `route`); `lib/bank/token-request.service.ts` (`decideCustody`, nhánh trong `approveTokenRequest`, `executeBurn`, `reconcileTokenRequest`, `canReconcile`, `custodyLabel`); `components/pages/approval-detail.tsx` |
| D1 tới D3 | `lib/ledger/ledger.port.ts` (`ILedgerCustodyCall`), `evm.adapter.ts` (`projectTokenRolesOf`, `prepareContractCall`, `transactionCallOf`); service báo lỗi lập trình khi ledger thiếu |
| E1 tới E3 | `prisma/schema.prisma`, `init.sql` sinh lại, `ADDED_COLUMNS`; cổng `token-request.store.port.ts` và hai bản (`attachCustodyTxId`, `setCustodyCall`, `claimTxHash`); `SubmitTxnInput.actorAddress`; `syncTxnFromReceipt` |
| F1 | `components/layout/role-home.ts` (mới), `channel-guard.tsx` |
| G1 | `packages/contracts-evm/scripts/fireblocks-roles.js` |

## 6. Quét

```text
$ git diff 8f75d38 -- . ':(exclude)*.md' | grep -nE '^\+.*(BEGIN (RSA )?PRIVATE KEY|eyJhbGciOi)'
```

Không có JWT. Các dòng `BEGIN ... PRIVATE KEY` còn lại, không dòng nào chứa thân khoá:

- `.env.example`: chú thích hướng dẫn dạng khoá ("BEGIN PRIVATE KEY"), không có giá trị.
- `lib/custody/fireblocks-config.ts`: hai hằng `PEM_HEADER`, `PKCS1_HEADER` để tách PEM và hai câu lỗi nêu dạng khoá.
- `test/in-04-fireblocks.test.ts` ca 3: hai PEM sai cố ý có thân giả `S2hvbmdQaGFpS2hvYQ==` (base64 của "KhongPhaiKhoa").
- Khoá RSA của ca 1 sinh lúc chạy bằng `generateKeyPairSync`, không ghi ra tệp hay log.

```text
$ git diff 8f75d38 | python3 (lọc dòng thêm có mũi tên, gạch dài, chấm giữa)
(ra đúng một dòng: nhãn bước 3 trong sơ đồ mermaid của docs/flows/issue.md, do gen-flow-diagram.mjs sinh)
```

Dòng đó do `node scripts/gen-flow-diagram.mjs issue` tự sinh (dạng "số, chấm giữa, tên hàm"), có cùng khuôn ở mọi
bước của sơ đồ từ trước; IN-04 chỉ đổi tên biến của bước 3. Sửa tay thì lần sinh sau ghi đè lại.

## 7. Tài liệu

- `docs/USER_GUIDE.md`: như dòng UserGuide ở mục 0.1.
- `docs/flows/issue.md`, `docs/tech-report.md`: sinh lại (số dòng, tên biến bước 3).
- `.kiro/task-status.json`: IN-04 từ `planned` sang `done`.

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Câu cho người bấm (`notice`).** Lần duyệt, lần đối soát trả `TokenRequestOutcomeView` (bản ghi kèm `notice`)
   khi yêu cầu giữ Đang thực hiện vì chưa rõ; màn hiện câu đó bằng thông báo vàng. Spec chỉ nói "trả câu".
2. **Lỗi gắn mã sau khi đã gọi tạo trả `err`, không ném.** `sendViaCustody` chuyển lỗi lưu trữ của `claimTxHash`
   thành kết quả lỗi không mang cờ; nhánh `!outcome.ok` của lần duyệt giữ EXECUTING (đây là đường ca 18b kiểm).
3. **Đường gửi chung `sendViaCustody`** ở `issuance.service.ts` cho cả Mint và Burn; lời gọi khoá máy chủ vẫn nằm
   trong `executeIssuance` và `executeBurn` (tham số `sendWithServerKey`) để ca kiểm kiến trúc có sẵn giữ nguyên.
4. **`FireblocksHttpError.message` là đúng thông điệp Fireblocks**; câu đầy đủ kèm HTTP và mã qua `describe()`.
   Câu "Fireblocks từ chối tạo giao dịch (mã <code>): <message>" dùng đúng thông điệp đó.
5. **Đối soát ghi `custodyTxId`** khi tra theo `externalTxId` mà thấy giao dịch (lỗi chỉ log), để lần sau tra theo
   mã Fireblocks.
6. **Nhãn "Thực hiện qua" của yêu cầu bị từ chối** là "Không thực hiện (đã từ chối)"; spec chỉ nêu yêu cầu chờ duyệt
   và đã duyệt. Công tắc thêm dòng phụ "Chưa đọc được trạng thái" khi đọc công tắc lỗi.
7. **Ca 5b dùng `hardhat-local` ánh xạ vào trạng thái ledger mock** trong vỏ bọc test, vì `mock` là chain họ mock
   duy nhất; luồng service (dự án, bảng chain, bối cảnh) vẫn theo chain `hardhat-local`.
8. **Đột biến 25** sửa ở chỗ gọi khách (`submitViaFireblocks`) vì luồng duyệt trong test dùng khách giả; khách thật
   không đọc cấu hình toàn cục nào ngoài `baseUrl` và khoá.
9. **Commit**: ngoài hai commit spec nêu có thêm `d2cf384` (sửa câu sổ kiểm toán có gạch dài, thân khoá giả rõ
   ràng) và commit tài liệu nháp `41ed9df` (hook yêu cầu cây sạch giữa chừng).

## 9. Giới hạn đã chấp nhận

- **QĐ-16:** gắn mã có điều kiện, chỉ lượt thắng ghi `Txn`. Tiến trình chết sau khi gắn mã và trước khi ghi `Txn`
  thì THIẾU một dòng `Txn` thông tin của giao dịch đó; yêu cầu vẫn có mã và sổ kiểm toán, đối soát vẫn chốt được
  (đối soát không thêm dòng `Txn` cho yêu cầu Fireblocks). Không đổi lược đồ `Txn` trong task này.
- **QĐ-7b:** yêu cầu qua Fireblocks chưa rõ kết quả (Fireblocks trả 1439 kéo dài, `FAILED` không mã lý do khác,
  giao dịch không khớp lời gọi đã chuẩn bị) giữ EXECUTING vô thời hạn, không tự Thất bại theo thời gian. Đóng tay
  thuộc task L-15 (đã ghi tồn đọng trong UserGuide Phụ lục C).
- Giao dịch Fireblocks bị thay mã (tăng tốc, `replacedTxHash`) không xử lý; ghi nợ (spec mục 4).

## 10. Việc của chủ dự án sau khi merge (không phải điều kiện của PR)

Hướng dẫn từng bước, kèm kiến thức nền, vận hành và đường lùi: `docs/RUNBOOK_FIREBLOCKS.md` (Phần D).

1. Nạp SepoliaETH vào vault 11 (đủ cho vài chục giao dịch).
2. Trên máy mình, với khoá quản trị trong `.env`: `FIREBLOCKS_VAULT_ADDRESS=0xc7F6... npx hardhat run scripts/fireblocks-roles.js --network sepolia` (xem kế hoạch), rồi chạy lại với `FIREBLOCKS_ROLES_CONFIRM=yes` (và `FIREBLOCKS_ROLES_ACTION=grant`).
3. `wrangler secret put FIREBLOCKS_API_KEY`, `wrangler secret put FIREBLOCKS_SECRET_KEY` (PEM PKCS#8; khoá dạng `BEGIN RSA PRIVATE KEY` thì đổi bằng `openssl pkcs8 -topk8 -nocrypt`).
4. Trước khi bật công tắc: chạy đường `/lookup404` của bộ thử K0 câu 6 (`20261029_k0_cau6_fireblocks_workers.zip`) và gửi Supervisor mã HTTP và thân phản hồi (không gửi khoá). Kết quả mong đợi: HTTP 404, mã 1439. Khác thì báo để sửa B1 trước khi bật (khách chỉ coi đúng 404/1439 là "chưa thấy").
5. Triển khai, bật công tắc, lập và duyệt một Mint nhỏ rồi một Burn nhỏ trên Sepolia; kiểm trên Etherscan người gửi là vault; gửi Supervisor mã yêu cầu và mã giao dịch.
