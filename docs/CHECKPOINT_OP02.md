# Báo cáo bàn giao — OP-02: gỡ chặn demo và dọn tài liệu

| | |
|---|---|
| Mã task | OP-02 |
| Nhánh | `ops/02-demo-unblock`, từ `dev` @ `abd1ceb` |
| Spec | `docs/op-02-demo-unblock/{requirements,tasks}.md`, bản v2 Owner giao ngày 07/10/2026 |
| Tiến độ | Bước 6/6 xong; chờ Supervisor nghiệm thu qua PR, chưa merge `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ requirements) | | Bằng chứng |
|---|---|---|---|
| 1 | Mock không cần khóa; chain khác vẫn ném lỗi | ✅ | mục 3.1, 3.2 |
| 2 | Bản dựng local trả commit thật; smoke `--expect-commit` đạt | ✅ | mục 3.3 |
| 3 | Guide đúng menu và quy tắc khóa ký | ✅ | mục 3.4 |
| 4 | Metadata báo cáo đúng; xóa spec SC; xử lý ba dòng nợ | ✅ | mục 1, 3.5 |
| 5 | Structure ghi docs là nguồn spec duy nhất | ✅ | mục 3.5 |
| 6 | run-local-all.sh xanh sau sửa và kiểm lại phần app | ✅ | mục 3.6 |

**Kết luận:** 6 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có quyết định chặn OP-02. Lỗi có sẵn màn chi tiết lệnh Mock được ghi rõ trong guide; nếu Owner muốn sửa, cần mở rộng phạm vi riêng (mục 5).
- Triển khai và smoke trên Worker thật thuộc Owner, đã phân định trong spec v2; xem mục 7.

## 1. Đã làm

- `server.signer.ts` trả tài khoản json-rpc cố định cho riêng Mock, không mang khóa; mọi nghiệp vụ vẫn gọi qua ISigner. Chain thật vẫn đòi khóa.
- `cf:build` cấp SHA/nhánh/thời gian UTC, giữ giá trị CI cấp sẵn; `config/build-env.ts` đọc metadata công khai và Next nhúng vào bundle. Worker không kế thừa env máy build nên chỉ đặt biến trong shell là chưa đủ.
- Guide khớp nav thực tế, `/mint` vào trực tiếp theo chủ ý, giải thích khóa và secret Worker cho chain thật.
- Báo cáo 3.6: FE-24 merge PR #38; bỏ nợ CI/dual spec; ghi P1 cờ nạp VNDB mặc định bật theo quyết định Owner 07/10, production đặt false và gỡ màn.
- Xóa hai spec SC đề xuất bằng `git rm -r`, gỡ tham chiếu ở báo cáo; docs là nguồn spec duy nhất, `.kiro/specs/` đóng băng.
- Đưa OP-02 vào inProgress ở commit đầu và done ở commit cuối; không sửa nghiệp vụ, contract, quyền hay marker. Cập nhật test phát hành cũ để kỳ vọng nhãn audit cố định của Mock.

## 2. Đối chiếu DoD

Bảng mục 0 là đủ sáu điều kiện. Spec SC-02/SC-03 sẽ viết lại khi khởi động, không triển khai trong OP-02. Bàn giao qua PR để Supervisor nghiệm thu.

## 3. Cách chạy và bằng chứng

### 3.1 Kiểm thử tập trung

```bash
cd app
npm run typecheck
npx vitest run test/server-signer.test.ts test/build-info.test.ts
```

Typecheck đạt; Vitest: `Test Files 2 passed (2)`, `Tests 10 passed (10)`.
Kiểm thử signer xóa tất cả env khóa, reset cache: Mock không ném; Hardhat Local/EVM ném `SignerUnavailableError` có hướng dẫn; `onboardInvestor` qua service/store/ledger thật xác nhận whitelist và nhãn audit Mock.

### 3.2 Đột biến bắt buộc

Đổi duy nhất `if (chain === 'mock')` thành `if (chain === 'mock' || chain === 'evm')` ở signer; chạy:

```bash
cd app && npx vitest run test/server-signer.test.ts
```

Kết quả thật (exit 1):

```text
FAIL test/server-signer.test.ts > OP-02 — chỉ mock được chạy khi không có khóa ký > evm vẫn từ chối khi thiếu khóa
AssertionError: promise resolved "{ … }" instead of rejecting
Test Files 1 failed (1)
Tests 1 failed | 3 passed (4)
```

Đã phục hồi signer ngay sau phép đo. Ca EVM bắt được việc nới sai sang chain thật.

### 3.3 Build Cloudflare và smoke trên workerd local

Commit đã dựng (commit cuối chỉ cập nhật test/tài liệu/trạng thái, không đổi bundle ứng dụng): `9814905b8c41990eb4cb2ec17729d6cccfadadcd`.

```bash
cd app && npm run cf:build
WRANGLER_SEND_METRICS=false XDG_CONFIG_HOME=/tmp/op02-wrangler ./node_modules/.bin/wrangler dev --local --port 3000 --ip 127.0.0.1
# Từ gốc repo, terminal khác:
node scripts/smoke-test.mjs http://localhost:3000 --expect-commit=$(git rev-parse HEAD)
curl --noproxy '*' -s http://127.0.0.1:3000/api/version
```

Build exit 0, `OpenNext build complete`, worker `.open-next/worker.js`. Smoke exit 0: commit khớp, API version và token Mock đạt. Không có `.env` hay khóa ký trong tiến trình Worker.

```json
{"ok":true,"data":{"commit":"9814905b8c41990eb4cb2ec17729d6cccfadadcd","branch":"ops/02-demo-unblock","buildTime":"2026-10-07T08:47:19Z","source":{"commit":"env","branch":"env","buildTime":"env"}}}
```

### 3.4 Đối chiếu menu và đi guide trên trình duyệt sạch

Đo nhãn bằng `sed -n '141,163p' app/src/components/layout/nav-config.ts`, cộng mục điều kiện `DEMO_PAYMENT_NAV_ITEM` ở cùng tệp. Menu GDV: Bảng điều khiển, Lập lệnh, Giao dịch, Chia lợi nhuận, Thông tin tài khoản, Nạp VNDB (trình diễn). `rg -n 'KYC & Phát hành' docs/guide.md` rỗng.

Trình duyệt sạch trên Worker local, chain Mock, mặc định TELLER, không khóa/MetaMask. Thao tác UI thật theo guide:

| Bước | Kết quả quan sát |
|---|---|
| KYC/whitelist SPV và NDT001 | whitelist=true, CONFIRMED |
| GDV lập Mint / KSV duyệt | `07cd45fa`, 20.000.000 WPT, Hoàn tất |
| GDV nạp VNDB | 1.000.000 VNDB, CONFIRMED |
| NDT mua / GDV khớp | `ab8cb143`, 2 WPT / 200.000 VNDB, Hoàn tất, năm bước xong |
| KSV xem giao dịch | Chỉ đọc, không nút Khớp lệnh |
| NDT danh sách lệnh | Mua Hoàn tất; link Chi tiết gặp hạn chế ở mục 5 |
| NDT bán / GDV khớp | `f3f78058`, 1 WPT / 100.000 VNDB, Hoàn tất |
| GDV lập Burn / KSV duyệt | `89b3c51c`, 100 WPT chưa phân phối, Hoàn tất |

Sau mua/bán, `/orders` hiển thị cả hai lệnh Hoàn tất; `/trade` hiển thị NDT001 giữ 1 WPT và 900.000 VNDB. Guide đã thay bước chi tiết chưa dùng được bằng bước đối chiếu này và ghi rõ hạn chế.

Số liệu cuối màn duyệt Burn: tổng cung 19.999.900, chưa phân phối 19.999.899, lưu hành 1 WPT — đúng guide. Không tuyên bố mọi nút guide đều hoạt động: link chi tiết của NDT còn lỗi có sẵn ngoài scope.

### 3.5 Tài liệu và phạm vi

```bash
git diff --name-status abd1ceb -- docs/sc-02-evm-issuance docs/sc-03-evm-order-settlement
rg -n 'sc-02-evm-issuance|sc-03-evm-(trading|order-settlement)' docs/tech-report.md
rg -n 'nguồn spec duy nhất|đóng băng' .kiro/steering/structure.md
rg -n 'P1.*ENABLE_DEMO_PAYMENT_MINT|07/10' docs/tech-report.md
```

Hai thư mục đề xuất bị xóa; không còn tham chiếu cũ trong báo cáo. Các tên trong requirements/tasks OP-02 là chỉ dẫn xóa, không phải tham chiếu spec đang dùng. Các nội dung Supervisor khác giữ nguyên.

### 3.6 Bộ kiểm cuối task

```bash
bash scripts/run-local-all.sh
# Sau khi xử lý hai lỗi dưới, chỉ kiểm lại phần app:
bash scripts/run-local-all.sh app
```

Lần đầy đủ: 5 PASS / 2 FAIL. Kiến trúc đạt (20 PASS / 0 FAIL / 3 WARN), marker hợp lệ, checkpoint đạt, contract **67 passing**, typecheck đạt. Hai lỗi:

- Lint OOM vì `.wrangler/tmp/.../worker.js` sinh từ Worker local đang chạy (~44 MB bundle), ngoài các thư mục mà ESLint ignore. Đã dừng Wrangler bằng Ctrl+C để nó tự dọn tmp; không sửa rule lint hay mã nguồn vì output tạm.
- Vitest 770 passed / 1 failed: test phát hành cũ kỳ vọng `actorAddress=null`; signer mới trả nhãn Mock cố định. Cập nhật riêng assertion/chú thích, không đổi service.

Kiểm lại `app`: **3 PASS / 0 FAIL**, typecheck và ESLint đạt, `Test Files 30 passed (30)`, `Tests 771 passed (771)`, exit 0. Như vậy cả bảy mục của bộ mặc định đều có kết quả đạt cuối cùng; không chạy lại toàn bộ ngoài phạm vi bị ảnh hưởng. Soroban chủ ý tạm dừng theo OP-01.

Kiểm thêm cảnh báo so sánh nền bằng `BASE_REF=abd1ceb bash scripts/verify-arch-rules.sh`: **21 PASS / 0 FAIL / 2 WARN**, không sửa contract. Hai cảnh báo còn lại: đọc `SIGNER_KIND` ở `signer/index.ts` có sẵn; địa chỉ hardcode mẫu/demo, gồm nhãn audit Mock mới có chủ đích, không phải địa chỉ contract.

Sau khi bổ sung assertion địa chỉ cố định trong test signer, chạy `cd app && npm run typecheck && npx vitest run test/server-signer.test.ts test/issuance-service.test.ts`: typecheck đạt, **2 tệp / 29 test passed**. Không đổi mã ứng dụng sau build.

Khi tái hiện, dừng Wrangler local trước khi chạy `run-local-all.sh` để output bundle tạm không bị ESLint quét. Không nới luật hoặc tăng bộ nhớ để che lỗi.

## 4. DEVIATION so với spec

Đo lại nền trước khi sửa bằng `git show abd1ceb:<tệp> | rg -n '<mẫu>'`: lỗi signer dòng 25; `getBankSigner` ở service dòng 7, 25 (chú thích), 95, 165, 290 — **năm dòng khớp**, trong đó ba lời gọi, không phải bốn dòng như spec viết. Mock adapter không có signer. Playwright config tiêm khóa dòng 64. Guide nhắc menu KYC ở dòng 25 và 49. Dùng mã thật, không sửa service.

OP-02 v2 chỉ định kết thúc ở PR; mở draft PR để nghiệm thu dù quy trình cũ branching mục 8 mở PR sau PASS. Không merge trước nghiệm thu. `docs/` là nguồn spec duy nhất theo quyết định mới, không tạo lại spec ở `.kiro/specs/`.

Bước dựng đầu bị chặn mạng tải Geist Mono; dựng lại với mạng được cấp quyền thành công. Đây là vấn đề môi trường, không đổi font/mã ứng dụng. Spec có dòng dùng `app/scripts/smoke-test.mjs`, nhưng script thật ở gốc `scripts/`; dùng đường dẫn đúng như mục 3.3.

## 5. Câu hỏi mở / chỗ chưa chắc

`/orders/ab8cb143-e8ec-42e6-8f3b-d656a520f10d` hiện “Chưa kết nối ví”. Đọc `app/src/components/pages/investor-order-detail.tsx`: chỉ dùng `useAccount()`, không dùng ví hồ sơ Mock như danh sách `investor-orders.tsx`. Lỗi tồn tại ở nền, độc lập với signer. OP-02 cấm sửa màn hình/nghiệp vụ; đã hỏi Owner giữ scope, ghi hạn chế guide/checkpoint hay mở rộng sửa màn này. Trong khi chờ chỉ định mở rộng, giữ phạm vi OP-02: không sửa màn hình; ghi hạn chế và đường đối chiếu thay thế trong guide. Cả sáu DoD OP-02 đạt, nhưng không tuyên bố màn chi tiết này đã sửa.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua ILedgerPort; không sửa mock adapter/nghiệp vụ.
- [x] Mọi ký qua ISigner; ngoại lệ không khóa chỉ áp dụng mock.
- [x] Mọi kiểm quyền qua RBAC; không thêm/bỏ quyền.
- Metadata chỉ đọc env trong lib/config, không đưa secret vào cấu hình Next.

## 7. Bàn giao Owner

Sau nghiệm thu PR, Owner dựng/deploy lại commit muốn triển khai. Không đặt secret hay deploy Worker thật trong task. Chain Mock không cần khóa; nếu dùng chain thật, Owner đặt `SERVER_SIGNER_PRIVATE_KEY` bằng secret Worker và RPC truy cập được.

```bash
node scripts/smoke-test.mjs https://bidv-rwa-tokenize.tuanlhbidv.workers.dev --expect-commit=<sha-cua-commit-da-trien-khai>
```

Trước production: đặt `ENABLE_DEMO_PAYMENT_MINT=false` và gỡ màn Nạp VNDB theo quyết định P1 đã ghi.
