# Báo cáo bàn giao — FE-02: Màn kết nối ví

| Trường | Giá trị |
|---|---|
| Task | FE-02 — Màn kết nối ví (P0, 3 điểm) |
| Nhánh | `feat/wallet-connect`, tạo từ `dev` @ `bf9b856` |
| Spec giao việc | `docs/fe-02-wallet-connect/` |
| Spec làm việc | `.kiro/specs/fe-02-wallet-connect/` |
| Ngày nộp | 2026-09-17 |

## 1. Đã làm

Sáu commit, chia theo mục tiêu:

| Commit | Nội dung |
|---|---|
| `0e7fcf1` | `feat(wallet): hook gom trạng thái kết nối ví` — logic thuần + hook + chuyển chain |
| `8cca1a6` | `feat(wallet): thành phần hiển thị trạng thái ví` + `explorerAddressUrl` ở `packages/shared` |
| `184d9f9` | `feat(client): trang kết nối ví cho nhà đầu tư` |
| `10240ad` | `fix(layout): nhãn nút kết nối ví không còn nói "Admin"` |
| `bebe1f1` | `fix(wallet): xử lý đổi ví và ngắt kết nối giữa phiên` |
| `13fea3a` | `test(wallet): kiểm thử các trạng thái kết nối ví` |
| (kèm báo cáo) | `docs: cập nhật báo cáo công nghệ cho màn kết nối ví` |

**17 file mã nguồn và kiểm thử** (chưa tính tài liệu). Không sửa `lib/wagmi.ts`,
`lib/hooks/use-is-mounted.ts`, `lib/chains/chain-store.ts`. Không thêm phụ thuộc nào.

Điểm chính: mọi câu hỏi về ví gom vào **một** chỗ (`useWalletStatus`), và quy tắc quyết định
tách thành **hàm thuần** (`resolveWalletStatus`) để test được ở vitest môi trường `node`.
`canSign` là thứ FE-04/05/09/11 dùng để bật/tắt nút ký — một chỗ quyết định, không rải rác.

## 2. Đối chiếu DoD

| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 1.1–1.6 | Hook gom trạng thái, đúng thứ tự ưu tiên, `canSign` chỉ ở `ready`/`mock` | ✅ | 30 unit test, phủ **tám** nhánh |
| 2.1–2.5 | Ba thành phần hiển thị, ẩn liên kết explorer khi chain không có, ghi nhãn số dư native | ✅ | |
| 3.1–3.4 | Chuyển/thêm chain, thông số từ `packages/shared`, không tự động chuyển | ✅ | Hộp thoại thật: ⚠️ xem mục 4 |
| 4.1–4.4 | Trang `/wallet`, mục menu, khung chờ | ✅ | |
| 5.1–5.3 | Đổi ví, ngắt kết nối, không lưu địa chỉ vào storage | ✅ | 5.1/5.2 tự đạt; xem mục 5 |
| 6.1–6.7 | Unit test + e2e + luật kiến trúc + `run-local-all.sh` | ✅ | 9 ca e2e |
| 7.1–7.3 | Cập nhật `tech-report.md` | ✅ | v1.4 → 1.5, thêm mục 3.9 |

**DoD ở `requirements.md` mục 5:**

| DoD | Đạt? | Bằng chứng |
|---|---|---|
| Kết nối/ngắt kết nối ở `hardhat-local` | ⚠️ | Cần ví thật — bảng mục 4 |
| Không có ví thì hiện hướng dẫn, không lỗi kỹ thuật | ✅ | e2e ca 3 + ảnh `02-no-provider.png` |
| Sai mạng thì cảnh báo + nút chuyển hoạt động | ⚠️ | Logic có test; hộp thoại cần ví thật |
| Từ chối chuyển mạng thì vẫn ở trạng thái cảnh báo | ⚠️ | Logic có test; hộp thoại cần ví thật |
| Đổi tài khoản trong ví thì địa chỉ cập nhật ngay | ⚠️ | Cần ví thật |
| Chế độ `mock` không đòi ví, không cảnh báo sai mạng | ✅ | e2e ca 2 + ảnh `01-mock.png` |
| Không có lỗi lệch kết xuất trong bảng điều khiển | ✅ | e2e ca 6 (bắt `console` + `pageerror`) |
| `grep viem/ethers ngoài src/lib` rỗng | ✅ | mục 3 |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | mục 3 |

## 3. Kết quả chạy (nguyên văn)

### 3.1. Luật kiến trúc

```
$ grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"
(rỗng)

$ grep -rnE "from ['\"](viem|ethers)(/[a-z]+)?['\"]" app/src/ | grep -v "app/src/lib/"
(rỗng)

$ git grep -nE "localStorage|sessionStorage|document\.cookie" -- app/src
(rỗng)

$ git diff dev...HEAD --name-only | grep -cE "lib/wagmi\.ts|use-is-mounted\.ts|chain-store\.ts"
0

$ git diff dev...HEAD --name-only | grep -cE "package(-lock)?\.json"
0
```

### 3.2. `bash scripts/verify-arch-rules.sh`

```
  PASS: 20   FAIL: 0   WARN: 6
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
```

Cả **6 cảnh báo đều có từ trước FE-02**, không cảnh báo nào thuộc file của task này:

```
WARN  process.env đọc ngoài lib/config:
      app/src/lib/signer/index.ts:40
WARN  Địa chỉ EVM hardcode trong app/src:
      app/src/components/pages/mint.tsx:172, :178   (placeholder ví mẫu)
WARN  Chưa đặt BASE_REF nên bỏ qua so sánh contract
WARN  spec p4-mint-stellar chưa có
WARN  spec p7-profit-distribution-stellar chưa có
WARN  spec p12-redemption-stellar chưa có
```

### 3.3. `bash scripts/run-local-all.sh`

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

Lint còn đúng 1 cảnh báo, **có từ trước** và đã nằm trong bảng nợ P2 của báo cáo:

```
app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default
✖ 1 problem (0 errors, 1 warning)
```

### 3.4. Vitest

```
 ✓ test/rbac.test.ts (8 tests)
 ✓ test/receipt-timeout.test.ts (5 tests)
 ✓ test/evm-address-env.test.ts (5 tests)
 ✓ test/abi-contract-sync.test.ts (8 tests)
 ✓ test/wallet-status.test.ts (30 tests)      ← mới
 ✓ test/env-private-key.test.ts (5 tests)
 ✓ test/mock-ledger.test.ts (48 tests)
 ✓ test/portfolio-service.test.ts (12 tests)

 Test Files  8 passed (8)
      Tests  121 passed (121)
```

### 3.5. Playwright

```
$ npx playwright test
Running 30 tests using 1 worker
  ... (21 ca cũ đều xanh)
  ✓ 22 wallet-connect › có trong menu nhà đầu tư và mở được
  ✓ 23 wallet-connect › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng
  ✓ 24 wallet-connect › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật
  ✓ 25 wallet-connect › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví
  ✓ 26 wallet-connect › mạng Stellar bị disable trong bộ chọn
  ✓ 27 wallet-connect › không có lỗi lệch kết xuất khi tải trang
  ✓ 28 wallet-connect › vai BANK_ADMIN KHÔNG vào được trang ví của nhà đầu tư
  ✓ 29 wallet-connect › vai COMPLIANCE KHÔNG vào được trang ví của nhà đầu tư
  ✓ 30 wallet-connect › vai AUDITOR KHÔNG vào được trang ví của nhà đầu tư

  30 passed (20.7s)
```

Chạy riêng `e2e/wallet-connect.spec.ts` → **9 passed**. Không ca nào của FE-01 / mint /
chain-selector bị ảnh hưởng bởi việc sửa `header.tsx` và `asset-summary.tsx`.

## 4. Trạng thái ví: dựng được gì, chưa dựng được gì

Spec yêu cầu ảnh chụp **cả 7 trạng thái**. Thực tế có **8** (xem DEVIATION D1). Dựng được 4,
kèm ảnh trong `docs/images/fe-02/`:

| # | Trạng thái | Dựng được? | Bằng chứng | Cách dựng |
|---|---|---|---|---|
| 1 | `loading` | ✅ | `04-loading-ssr.png` | Tắt JavaScript → thấy đúng nội dung máy chủ kết xuất, tức đúng thứ R6.1 nói tới |
| 2 | `mock` | ✅ | `01-mock.png` | Chain mặc định của môi trường e2e |
| 3 | `unsupported-chain` | ❌ | — | `stellar` có `implemented: false` nên `selectable: false`, `useSelectedChain` **không bao giờ** trả về nó. Nhánh này là phòng xa cho khi Stellar được hiện thực. e2e chỉ khẳng định được option đang bị disable |
| 4 | `no-provider` | ✅ | `02-no-provider.png` | Chromium của Playwright không có tiện ích ví |
| 5 | `disconnected` | ✅ | `03-disconnected.png` | Chèn `window.ethereum` tối giản (chỉ cần tồn tại, không cần hoạt động) |
| 6 | `wrong-chain` | ❌ | — | Cần ví thật ở chainId ngoài danh sách (vd mainnet) |
| 7 | `chain-mismatch` | ❌ | — | Cần ví thật đã kết nối ở Sepolia trong lúc trang xem `hardhat-local` |
| 8 | `ready` | ❌ | — | Cần ví thật đã cho phép kết nối |

**Vì sao không dựng ví giả để phủ 4 trạng thái còn lại:** ví giả sẽ dễ tính hơn ví thật, đúng
loại lỗi `lessons.md` đã ghi ("Mock adapter dễ tính hơn contract thật → SAI, sinh loại lỗi
xanh ở mock, đỏ ở chain thật"). Ảnh chụp một ví giả không chứng minh được điều spec muốn thấy.
Thay vào đó **logic quyết định của cả tám trạng thái đã phủ bằng unit test** —
`app/test/wallet-status.test.ts` có ca riêng cho từng nhánh và một ca chốt bằng `Set` để thêm
nhánh mới mà quên phủ là đỏ ngay.

### Bảng thử trên ví thật

| Ví | Chain | Thao tác | Kết quả |
|---|---|---|---|
| — | — | — | **CHƯA THỬ** |

**Chưa thử được ví nào.** Máy chạy task này không có tiện ích ví trong trình duyệt và không
có cách cài trong môi trường hiện tại. Bốn việc còn nợ, cần người có ví làm:

1. `hardhat-local` (cần `docker compose up` hoặc `npx hardhat node`): kết nối → thấy địa chỉ,
   tên mạng, số dư ETH; liên kết explorer **phải ẩn**; ngắt kết nối → về `disconnected`.
2. Đổi ví sang mạng khác (vd Ethereum mainnet) → phải ra `wrong-chain`; bấm nút chuyển →
   ví bật hộp thoại; **bấm Từ chối** → cảnh báo giữ nguyên, hiện câu "Bạn đã từ chối chuyển
   mạng…", và **không** có hộp thoại thứ hai tự bật.
3. Ví ở Sepolia trong lúc trang xem `hardhat-local` → phải ra `chain-mismatch` với **hai** nút.
4. Đổi tài khoản trong ví khi đang ở `ready` → địa chỉ trên thẻ đổi ngay, không tải lại trang.
5. Chain lạ chưa có trong ví → xác nhận hộp thoại **thêm mạng** hiện ra với đúng tên, đơn vị
   tiền, RPC lấy từ `packages/shared`.

## 5. DEVIATION so với spec

| Mã | Làm khác gì | Lý do |
|---|---|---|
| **D1** | Thêm nhánh thứ **tám** `unsupported-chain` | Union trong `design.md` QĐ-1 có 7 `kind`, nhưng task 1.5 đòi "trả trạng thái chưa hỗ trợ ví" cho `stellar` và không `kind` nào ứng. Ghép vào `no-provider` sẽ mời người xem Stellar đi cài MetaMask — cài xong vẫn không dùng được. Ghép vào `wrong-chain` không được vì nhánh đó mang `expected: number` mà Stellar không có chainId EVM |
| **D2** | Thêm thư mục `app/src/lib/wallet/` (4 tệp), `design.md` mục 2 chỉ liệt kê `lib/hooks/use-wallet-status.ts` | `vitest.config.ts` dùng `environment: 'node'`, repo không có jsdom lẫn `@testing-library`. Không tách logic thuần ra thì yêu cầu "unit test cho hàm quyết định trạng thái" (task 1.1, 6.1) không có cách nào chạy. Đã loại phương án thêm jsdom vì `tasks.md` ghi rõ "Không thêm phụ thuộc mới" |
| **D3** | Bước 3 nằm trong commit của bước 1 (`0e7fcf1`) thay vì commit riêng | `switchToExpected` là một phần của `useWalletStatus`. Tách ra sẽ cho một commit bước 1 **không build được** (interface khai báo method mà hook chưa có), trái quy tắc "mỗi commit ở trạng thái build được". Nội dung vẫn đủ 3.1–3.4 |
| **D4** | Dùng `useAccount().chainId`, không dùng `useChainId()` như `design.md` QĐ-2 nhắc | `useChainId()` lùi về chain đầu tiên trong cấu hình khi chưa kết nối, nên phép so sánh "chain ví khớp chain đang xem" cho kết quả KHỚP trong lúc chưa có ví nào — sai âm thầm |
| **D5** | Thêm `explorerAddressUrl` vào `packages/shared` | R1.4 cần liên kết tra **địa chỉ**, repo chỉ có `explorerTxUrl`. `design.md` mục 4 nói "Hàm tra cứu trong `packages/shared` trả về rỗng cho trường hợp này" — tức hàm này được mong đợi tồn tại ở đó |
| **D6** | Sửa `header.tsx`: nhãn `"Kết nối ví Admin"` → `"Kết nối ví"`. **Spec không yêu cầu** | Nhãn cũ mời cán bộ ngân hàng kết nối ví để làm việc của ngân hàng, đúng ngược với R7.2 (thao tác đặc quyền ký bằng khóa phía máy chủ qua `ISigner`). Thanh trên dùng chung cho cả ba kênh nên nhãn phải trung tính |
| **D7** | Thêm `blockedReason`, `switching`, `switchError` vào giá trị trả của hook | R3.4 cần chỗ nói "bạn đã từ chối", R3.5 cần chỗ nói vì sao chặn ký. Giao diện trong `design.md` QĐ-2 không có trường nào cho hai việc đó |
| **D8** | Sửa copy trạng thái rỗng ở `components/investor/asset-summary.tsx` (của FE-01) | Câu cũ chỉ nói "Kết nối ví ở góc trên phải"; giờ đã có trang `/wallet` với hướng dẫn nên trỏ sang đó. Không đổi tiêu đề "Chưa kết nối ví" nên e2e của FE-01 không ảnh hưởng |

## 6. Sai lệch phát hiện được

**`stellar` không thể là chain đang chọn.** `reasonUnavailable('stellar')` trả "Chưa hiện thực
(adapter stub)" → `selectable: false` → `useSelectedChain` không bao giờ trả về nó. Task 1.5
yêu cầu xử lý `stellar` như một trạng thái người dùng gặp được, nhưng hiện tại **không có
đường nào tới đó** từ giao diện. Đã hiện thực nhánh này như phòng xa và ghi rõ trong e2e để
người đọc không tưởng là đã dựng được.

**Không có nợ kỹ thuật nào của FE-02 được thêm vào `tech-report.md` 1.6.C.** Nếu Supervisor cho
rằng "chưa thử trên ví thật" là nợ P1 thì đề nghị thêm dòng — theo
`tech-report-maintenance.md` §8, việc thêm/xóa nợ do Supervisor quyết.

## 7. Câu hỏi mở

**CH-1 — `unsupported-chain` có nên xoá đi cho gọn?**
Hai cách hiểu task 1.5:
- (a) Chỉ cần *không sập* khi chain là `stellar`, không cần trạng thái riêng.
- (b) Cần một trạng thái riêng nói rõ "chưa hỗ trợ ví cho mạng này".

Đã chọn **(b)** vì câu trong task là "trả trạng thái chưa hỗ trợ ví", và vì khi Stellar được
hiện thực (P7) thì ví trình duyệt **vẫn** không nói được Soroban, nên nhánh này sẽ cần thật.
Nếu Supervisor muốn (a) thì gộp vào `mock` là hỏng nghĩa, phải bàn cách khác.

**CH-2 — số dư native có nên đi qua `ILedgerPort`?**
Đã kết luận **không**: `eth_getBalance` không phải lời gọi hợp đồng, và BE-01 vừa chốt nguyên
tắc không nới `ILedgerPort` khi chưa cần. Nhưng đây là chỗ giáp ranh LUẬT #1 nên xin xác nhận.
Nếu Supervisor muốn đi qua port thì cần một method mới, và sẽ chạm cả ba adapter.

**CH-3 — ai làm phần thử ví thật?**
Năm việc ở mục 4 cần người có tiện ích ví. Đề nghị Owner hoặc Supervisor chạy và dán kết quả
vào mục "Bảng thử trên ví thật", hoặc cho biết môi trường nào có ví để Kiro tự chạy.

## 8. Cách chạy / kiểm thử

```bash
# Toàn bộ kiểm chứng cục bộ
bash scripts/run-local-all.sh

# Riêng phần FE-02
cd app
npx vitest --run test/wallet-status.test.ts      # 30 ca, logic tám trạng thái
npx playwright test e2e/wallet-connect.spec.ts   # 9 ca

# Xem bằng mắt (chế độ mock, không cần chain nào)
cd app && npm run dev
#  -> mở http://localhost:3000
#  -> đổi Kênh sang "Nhà đầu tư" ở thanh trên
#  -> vào "Ví của tôi"
#  -> đổi ô Chain sang "Hardhat Local" để thấy trạng thái chưa cài ví

# Thử với ví thật trên hardhat-local
docker compose up            # hoặc: cd packages/contracts-evm && npx hardhat node
#  -> thêm mạng 31337 / RPC http://127.0.0.1:8545 vào ví, hoặc để nút "Chuyển ví sang…" tự thêm
```

## 9. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** Task này **không gọi hợp đồng nào**. Component
      không nhập `viem`/`ethers` (grep rỗng); `verify-arch-rules.sh` xác nhận không có
      `readContract`/`writeContract` trong `components/` và `app/`. Các hook wagmi dùng ở đây
      chỉ phục vụ việc kết nối ví. Số dư native là `eth_getBalance`, không phải lời gọi hợp
      đồng — xem CH-2. Số dư WPT/VNDB **không** đọc ở task này (thuộc FE-04, qua `ILedgerPort`).
- [x] **Mọi ký qua `ISigner`.** Task này **không ký gì**. Ví trình duyệt chỉ dùng cho thao tác
      của nhà đầu tư; thao tác đặc quyền của ngân hàng vẫn ký bằng khóa phía máy chủ qua
      `ISigner` — đã nói tường minh trên giao diện và là lý do sửa nhãn ở `header.tsx` (D6).
- [x] **Mọi kiểm quyền qua RBAC.** Trang nằm trong route-group `(client)` nên dùng
      `ChannelGuard` với `portfolio:read` sẵn có; **không thêm role, không thêm action, không
      so sánh role cứng** (`verify-arch-rules.sh` PASS). Địa chỉ ví **không** được dùng để cấp
      quyền — kết nối ví chưa chứng minh sở hữu vì chưa có chữ ký, việc đó thuộc AU-01.
