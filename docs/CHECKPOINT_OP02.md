# Báo cáo bàn giao — OP-02 v3: gỡ chặn demo và dọn tài liệu

| | |
|---|---|
| Mã task | OP-02 |
| Nhánh | `ops/02-demo-unblock`, từ `dev` @ `abd1ceb` |
| Spec | `docs/op-02-demo-unblock/{requirements,tasks}.md`, v3 Owner giao 07/10/2026 |
| Tiến độ | Xong toàn bộ, gồm mục E; [draft PR #39](https://github.com/tuannino/bidv-rwa-tokenize/pull/39) chờ Supervisor nghiệm thu, chưa merge `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ requirements v3) | | Bằng chứng |
|---|---|---|---|
| 1 | Mock không cần khóa; chain khác vẫn ném lỗi | ✅ | mục 3.1, 3.2 |
| 2 | Bản dựng local trả commit thật; smoke --expect-commit đạt | ✅ | mục 3.3 |
| 3 | Guide đúng menu và quy tắc khóa ký | ✅ | mục 3.4 |
| 4 | Metadata báo cáo đúng; xóa spec SC; xử lý ba dòng nợ | ✅ | mục 1, 3.5 |
| 5 | Structure ghi docs là nguồn spec duy nhất | ✅ | mục 3.5 |
| 6 | Hai màn chi tiết Mock không cần ví; chain thật vẫn mời kết nối | ✅ | mục 3.6 |
| 7 | Đi guide sạch, mọi bước bấm được gồm mục 5.3 Chi tiết | ✅ | mục 3.7 |
| 8 | run-local-all.sh xanh | ✅ | mục 3.8 |

**Kết luận:** 8 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có. Mục E v3 đã cho phép vá đúng hai màn chi tiết. Triển khai và smoke trên Worker thật thuộc Owner (mục 7).

## 1. Đã làm

- Signer trả tài khoản json-rpc cố định cho riêng Mock, không mang khóa; mọi nghiệp vụ vẫn qua ISigner. Hardhat Local/EVM vẫn đòi khóa. Không sửa service hoặc ledger để lách.
- cf:build cấp SHA/nhánh/thời gian UTC, giữ giá trị CI cấp sẵn. `config/build-env.ts` đọc metadata công khai; Next nhúng vào bundle vì Worker không kế thừa env của máy build. Không nhúng secret.
- Guide khớp nav, `/mint` vào trực tiếp theo chủ ý, giải thích khóa/secret chain thật. Khôi phục link Chi tiết sau khi vá mục E.
- Hai route chi tiết lấy ví hồ sơ CUSTOMER của phiên; hai component chép đúng khuôn phân giải ví và guard đã có ở investor-orders. Không đổi bố cục, nội dung hiển thị hay gom hook.
- Báo cáo 3.6: FE-24 merge PR #38; bỏ nợ CI/dual spec; ghi P1 cờ nạp VNDB mặc định bật theo Owner 07/10 và P2 bốn màn chép lặp phân giải ví. Gom hook khi task sau đụng nhóm này, không mở task riêng.
- Xóa hai spec SC đề xuất bằng git rm -r; gỡ tham chiếu trong báo cáo; docs là nguồn spec duy nhất, .kiro/specs đóng băng.
- OP-02 inProgress ở commit đầu, mở lại khi nhận v3, done ở commit cuối. Cập nhật test phát hành cũ để kỳ vọng nhãn audit cố định thay vì null.

## 2. Đối chiếu DoD

Bảng mục 0 đủ **tám** ô DoD requirements v3. tasks.md bước 6 vẫn ghi sáu là số cũ; dùng số ô thực tế, không bỏ hai điều kiện mới. Không triển khai SC-02/SC-03 hay Worker thật trong task.

## 3. Cách chạy và bằng chứng

### 3.1 Signer và metadata

```bash
cd app && npm run typecheck
npx vitest run test/server-signer.test.ts test/build-info.test.ts
```

Typecheck đạt; Vitest **2 tệp / 10 test passed**. Test signer xóa toàn bộ biến khóa và reset cache: Mock trả địa chỉ cố định không khóa; Hardhat Local/EVM thiếu khóa ném SignerUnavailableError có hướng dẫn; onboardInvestor qua service/store/ledger thật xác nhận whitelist và nhãn audit Mock. Test build-info kiểm metadata env và fallback.

### 3.2 Đột biến bắt buộc, đã thực hiện ở v2

Đổi duy nhất `if (chain === 'mock')` thành `if (chain === 'mock' || chain === 'evm')`, chạy:

```bash
cd app && npx vitest run test/server-signer.test.ts
```

Kết quả thật exit 1:

```text
FAIL test/server-signer.test.ts > OP-02 — chỉ mock được chạy khi không có khóa ký > evm vẫn từ chối khi thiếu khóa
AssertionError: promise resolved "{ … }" instead of rejecting
Test Files 1 failed (1)
Tests 1 failed | 3 passed (4)
```

Đã phục hồi signer ngay sau đo. v3 không đổi signer, không làm đột biến khác.

### 3.3 Cloudflare build và smoke v3 trên workerd local

Commit ứng dụng đã dựng: **ef8e85ee1c3c06e15e44aecca81a6c7c517319f9**. Commit cuối chỉ sửa checkpoint/tài liệu/trạng thái, không đổi bundle ứng dụng.

```bash
cd app && npm run cf:build
WRANGLER_SEND_METRICS=false XDG_CONFIG_HOME=/tmp/op02-wrangler ./node_modules/.bin/wrangler dev --local --port 3000 --ip 127.0.0.1
# Từ gốc repo, terminal khác, tại commit đã dựng:
node scripts/smoke-test.mjs http://localhost:3000 --expect-commit=$(git rev-parse HEAD)
curl --noproxy '*' -s http://127.0.0.1:3000/api/version
```

Build exit 0, OpenNext build complete, worker `.open-next/worker.js`. Smoke exit 0, **3 phép kiểm PASS**: version, commit khớp, token Mock tổng cung 0 trước đi guide. Worker không có .env hay biến khóa ký.

```json
{"ok":true,"data":{"commit":"ef8e85ee1c3c06e15e44aecca81a6c7c517319f9","branch":"ops/02-demo-unblock","buildTime":"2026-10-07T09:04:31Z","source":{"commit":"env","branch":"env","buildTime":"env"}}}
```

### 3.4 Guide và menu

Đo `sed -n '141,163p' app/src/components/layout/nav-config.ts`, cộng DEMO_PAYMENT_NAV_ITEM ở cùng tệp. Menu GDV: Bảng điều khiển, Lập lệnh, Giao dịch, Chia lợi nhuận, Thông tin tài khoản, Nạp VNDB (trình diễn). `rg -n 'KYC & Phát hành' docs/guide.md` rỗng. Guide nói Mock không cần khóa; chain thật cần secret Worker.

### 3.5 Tài liệu và phạm vi

```bash
git diff --name-status abd1ceb -- docs/sc-02-evm-issuance docs/sc-03-evm-order-settlement
rg -n 'sc-02-evm-issuance|sc-03-evm-(trading|order-settlement)' docs/tech-report.md
rg -n 'nguồn spec duy nhất|đóng băng' .kiro/steering/structure.md
rg -n 'P1.*ENABLE_DEMO_PAYMENT_MINT|P2.*Bốn màn' docs/tech-report.md
```

Hai thư mục đề xuất bị xóa, báo cáo không còn tham chiếu cũ. Tên thư mục trong requirements/tasks OP-02 là chỉ dẫn xóa, không phải spec đang dùng. Giữ các nội dung Supervisor khác.

### 3.6 E2E hai màn chi tiết và guard chain thật

```bash
cd app && npm run typecheck
npx playwright test e2e/ops-transactions.spec.ts --grep OP-02
```

Typecheck đạt; **2 passed (32.0s)**, không extension/ví trình duyệt:

- Ca luồng mua/khớp bấm Chi tiết: thấy đúng mã lệnh, ví NDT001, bốn bút toán đã ghi, không “Chưa kết nối ví”. `/tokens/WPT` thấy số đang giữ và giá trị vị thế, không lời mời ví.
- Ca guard đổi Hardhat Local trên cả hai màn: vẫn hiện lời mời kết nối, không hiện vị thế khi chưa có ví.

Chỉ bốn tệp ứng dụng trong mục E thay đổi: hai route chi tiết và hai component. Route lấy getOwnAccountProfile như `/orders`; component dùng wallet cho request/key/effect và guard đúng khuôn. Không đổi dữ liệu/bố cục/service.

### 3.7 Đi lại toàn bộ guide v3 từ bản sạch

Thao tác UI thật trên Worker v3 tại `http://127.0.0.1:3000`, host cookie sạch, TELLER/Mock mặc định; smoke đo tổng cung ban đầu 0. Không khóa ký hay MetaMask. Kết quả đọc trực tiếp từ UI:

| Bước guide | Kết quả |
|---|---|
| 1–2: mở demo, KYC SPV và NDT001 | Đúng menu; cả hai whitelist=true / CONFIRMED |
| 3: GDV lập Mint / KSV duyệt | `b38c6328`, 20.000.000 WPT, Hoàn tất |
| 4: GDV nạp VNDB | 1.000.000 VNDB / CONFIRMED |
| 5.1: NDT mua và Xem chi tiết | `b7ded0b5`, 2 WPT / 200.000 VNDB, chi tiết hiện ngay ở Mock |
| 5.2: GDV khớp / mở mã lệnh; KSV chỉ đọc | Hoàn tất; năm bước xong, tx mock ...0005; KSV không có nút Khớp lệnh |
| 5.3: NDT Quản lý lệnh → Chi tiết | Hoàn tất; đủ thông tin, tiến trình, tx và audit; `/trade` xác nhận 2 WPT / 800.000 VNDB |
| 6: NDT bán / GDV khớp / NDT đối chiếu | `d28084a5`, 1 WPT / 100.000 VNDB, Hoàn tất; NDT còn 1 WPT / 900.000 VNDB |
| 7: GDV lập Burn / KSV duyệt | `d6ca4ab7`, 100 WPT chưa phân phối, Hoàn tất |

Cuối guide: tổng cung **19.999.900**, chưa phân phối **19.999.899**, lưu hành **1 WPT**, đúng số liệu. Mục 8–9 là hướng dẫn lỗi/chuyển môi trường, không thao tác production trong demo.

Kiểm thêm UI `/tokens/WPT`: vị thế **1 WPT / 100.000 ₫** khi nút Kết nối ví vẫn hiện, không lời mời trong thẻ. Đổi Hardhat Local trên token và chi tiết lệnh đều hiện lời mời kết nối. Không có bước thao tác guide bị chặn sau v3.

### 3.8 Bộ kiểm cuối v3

Dừng Wrangler bằng Ctrl+C trước khi chạy để bundle tạm `.wrangler/tmp` không bị ESLint quét (lần v2 từng OOM vì Worker còn chạy).

```bash
bash scripts/run-local-all.sh
```

Chạy **một lần** cuối phần bổ sung v3, exit **0**, **7 PASS / 0 FAIL**: kiến trúc, marker, checkpoint, contract, typecheck, lint, Vitest. Contract **67 passing**; app **30 tệp / 771 test passed**. Soroban chủ ý tạm dừng theo OP-01.

Kiến trúc: 20 PASS / 0 FAIL / 3 WARN. Hai nhóm cảnh báo đọc SIGNER_KIND có sẵn và địa chỉ mẫu/demo (gồm nhãn Mock có chủ đích); nhóm thứ ba chưa cấp BASE_REF. v2 đã kiểm `BASE_REF=abd1ceb bash scripts/verify-arch-rules.sh`: 21 PASS / 0 FAIL / 2 WARN, không sửa contract. v3 chỉ bổ sung UI và không đổi contract/RBAC.

## 4. DEVIATION so với spec

Đo nền `git show abd1ceb:<tệp> | rg -n '<mẫu>'`: lỗi signer dòng 25; getBankSigner ở service dòng 7, 25 (chú thích), 95, 165, 290 — năm dòng khớp, trong đó ba lời gọi, không phải bốn dòng như spec. Mock adapter không có signer. Playwright config tiêm khóa dòng 64. Guide nhắc menu KYC dòng 25 và 49. Dùng mã thật, không sửa service.

Đo v3 `git show --stat d45b596 | rg 'investor-'`: component thay đổi chỉ orders/trade (cộng test investor-channel). Đúng nguyên nhân v3: hoàn thiện Mock ở FE-24 bỏ sót hai chi tiết, không quy lỗi cho FE-25 trước khi có khuôn này.

Spec có dòng app/scripts/smoke-test.mjs nhưng script thật ở gốc scripts/; dùng đường dẫn đúng. tasks bước 6 còn ghi sáu DoD; checkpoint đối chiếu tám ô requirements v3. Guide cũ yêu cầu số dư ở chi tiết nhưng màn không có dữ liệu đó; giữ nội dung màn theo ràng buộc E, chỉ rõ đối chiếu số dư ở `/trade` sau khi bấm Chi tiết.

v2 có một lần build bị chặn tải Geist Mono, sau cấp mạng build đạt; v3 build đạt. Không sửa font. v3 cho phép ngoại lệ đúng bốn tệp ứng dụng; không gom hook. Mở draft PR theo phạm vi v3 kết thúc ở PR, chờ Supervisor; không merge trước nghiệm thu.

## 5. Câu hỏi mở / chỗ chưa chắc

Không còn. Phát hiện thiếu Mock ở hai màn chi tiết đã được Owner đưa vào mục E v3 và sửa xong. Các giới hạn EVM chưa nối contract và triển khai Worker thật giữ theo spec.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua ILedgerPort; không sửa adapter/service.
- [x] Mọi ký qua ISigner; ngoại lệ không khóa chỉ áp dụng Mock.
- [x] Mọi kiểm quyền qua RBAC; không thêm/bỏ quyền. Ví Mock lấy từ hồ sơ phiên, không hardcode ở hai màn.
- Metadata chỉ đọc env trong lib/config, không nhúng secret vào Next.

## 7. Bàn giao Owner

Sau nghiệm thu PR, Owner dựng/deploy commit muốn triển khai. Không đặt secret hoặc deploy Worker thật trong task. Mock không cần khóa; chain thật cần SERVER_SIGNER_PRIVATE_KEY là secret Worker và RPC truy cập được.

```bash
node scripts/smoke-test.mjs https://bidv-rwa-tokenize.tuanlhbidv.workers.dev --expect-commit=<sha-cua-commit-da-trien-khai>
```

Trước production: đặt ENABLE_DEMO_PAYMENT_MINT=false và gỡ màn Nạp VNDB theo quyết định P1. Nợ P2 hook phân giải ví xử lý khi task tiếp theo đụng nhóm màn Nhà đầu tư.
