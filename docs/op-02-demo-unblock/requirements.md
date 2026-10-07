# OP-02 — Gỡ chặn bản trình diễn trên Cloudflare và dọn tài liệu

| | |
|---|---|
| Nhánh | `ops/02-demo-unblock`, từ `dev` @ `abd1ceb` |
| Điểm | 3 |
| Mức kiểm chứng | **Vừa** |
| Thứ tự | **việc đầu tiên của đợt 5**, làm trước mọi task khác |
| Người làm | Codex hoặc Claude Code |

## Mục tiêu

Bản deploy Cloudflare hiện **không thao tác được**: mọi nghiệp vụ ghi đều hỏng. Task này mở lại khả
năng trình diễn, và dọn ba món tài liệu đã lệch mã nguồn.

Làm trước vì hai lý do: nó là thứ duy nhất đang chặn việc trình diễn, và nó sửa `docs/tech-report.md`
cùng `.kiro/task-status.json` là hai tệp mà **mọi** task khác cũng sửa. Merge nó trước thì các task
sau chỉ phải rebase một lần.

## Hiện trạng đã đo

Supervisor thao tác thật trên `https://bidv-rwa-tokenize.tuanlhbidv.workers.dev` ngày 07/10: mở
`/mint`, điền ví SPV, bấm **1 · KYC + Whitelist**. Màn trả về:

> Thiếu khóa ký cho chain "mock". Cách sửa: đặt SERVER_SIGNER_PRIVATE_KEY (dùng chung) hoặc
> SERVER_SIGNER_PRIVATE_KEY_MOCK (riêng cho chain này) trong app/.env.local.

Nguyên nhân đo được:

```bash
grep -n "Thiếu khóa ký cho chain" app/src/lib/signer/server.signer.ts   # 1 dòng, dòng 25
grep -n "getBankSigner" app/src/lib/bank/mint.service.ts                # 4 dòng: 7, 25, 95, 165, 290
grep -n "signer\|Signer" app/src/lib/ledger/mock.adapter.ts             # PHẢI RỖNG
```

Dòng cuối là mấu chốt: `mock.adapter.ts` **không dùng chữ ký ở bất kỳ đâu**, nhưng `mint.service.ts`
gọi `getBankSigner(chain)` vô điều kiện trước khi chạm ledger. Nên ở chain `mock`, cả luồng trình
diễn bị chặn bởi một thứ mà chain đó không cần.

Bộ kiểm thử đầu cuối không lộ ra lỗi này vì `app/playwright.config.ts` tự tiêm khóa cho máy chủ thử:

```bash
grep -n "SERVER_SIGNER_PRIVATE_KEY" app/playwright.config.ts            # 1 dòng, trong khối webServer.env
```

Hai món khác đo được:

```bash
curl -s https://bidv-rwa-tokenize.tuanlhbidv.workers.dev/api/version
# {"ok":true,"data":{"commit":"local","branch":"local",...,"source":{"commit":"fallback",...}}}
grep -rn "KYC & Phát hành" docs/guide.md                                # 2 dòng: mục 1 và mục 2
grep -rn "KYC" app/src/components/layout/nav-config.ts                  # PHẢI RỖNG — không có mục menu đó
```

## Việc cần làm

**A. Bỏ đòi khóa ký ở chain `mock`**

1. Ở chain `mock`, `getBankSigner` trả một tài khoản cố định thay vì ném lỗi. Sửa ở
   `lib/signer/server.signer.ts`, **một chỗ duy nhất** — không sửa `mint.service.ts` và các nghiệp
   vụ khác, vì Luật số 2 nói mọi chữ ký đi qua `ISigner`.
2. Ghi ngay tại chỗ sửa **vì sao**: `mock.adapter` không ký gì cả, nên đòi khóa ở chain này là chặn
   nhầm; và tài khoản cố định đó không bao giờ gửi giao dịch thật.
3. **Chain khác giữ nguyên hành vi ném lỗi.** Đây là ràng buộc quan trọng nhất của task: nới cho
   `hardhat-local` hay `evm` là mở đường chạy nghiệp vụ tiền mà không có ví ký.

**B. Truyền mã commit vào bản dựng Cloudflare**

4. Bản dựng cho Cloudflare đặt `BUILD_COMMIT_SHA` và tên nhánh, như `.github/workflows/ci.yml` đang
   làm. Sau task này, **dựng cục bộ** rồi gọi `/api/version` phải trả mã commit thật, không phải
   `local`. Kiểm trên địa chỉ thật nằm ngoài task, xem mục "Phạm vi" bên dưới.
5. Không đọc `process.env` ở đâu ngoài `lib/config` — `verify-arch-rules.sh` đang chặn việc đó.

**C. Sửa hướng dẫn trình diễn `docs/guide.md`**

6. Mục 1, danh sách "Trạng thái đúng khi mới mở": sửa thành đúng menu thật của Giao dịch viên. Đo
   bằng `sed -n '141,163p' app/src/components/layout/nav-config.ts`.
7. Mục 2 bước 1: bỏ câu "Mở menu KYC & Phát hành". Trang `/mint` **chỉ vào được bằng đường dẫn**;
   viết đúng như vậy và nói rõ đó là chủ ý (màn dữ liệu thử, không nằm trong menu theo tài liệu
   yêu cầu).
8. Gọi đúng nhãn menu **Nạp VNDB (trình diễn)** ở mục 4, thay cho "Nạp VNDB".
9. Viết đúng về khóa ký, **sau khi mục A đã sửa**: chain `mock` không cần khóa ký, nên bản trình
   diễn mặc định chạy được mà không cấu hình gì thêm. Chain thật (`hardhat-local`, `evm`) vẫn cần
   `SERVER_SIGNER_PRIVATE_KEY`; trên Cloudflare đó phải là biến bí mật của Worker. Đặt câu này ở
   mục 9 (chuyển sang môi trường thật), và thêm một dòng vào bảng lỗi thường gặp ở mục 8: đổi chain
   trên bản deploy sang Hardhat Local mà báo thiếu khóa ký là **đúng hành vi**, không phải hỏng.

**D. Dọn tài liệu**

10. `docs/tech-report.md` metadata: FE-24 đã merge qua PR #38, không còn "chờ nghiệm thu". Sửa đường
    dẫn `docs/sc-03-evm-trading/` thành tên thư mục thật. Xoá dòng nợ "Chưa có CI" ở mục 1.6.C vì
    OP-01 đã xong.
11. Xoá hai thư mục `docs/sc-02-evm-issuance/` và `docs/sc-03-evm-order-settlement/`. Hai spec đó là
    **đề xuất**, task chưa khởi động; spec sẽ viết lại khi thực sự làm. Gỡ mọi tham chiếu tới chúng.
12. Thêm vào `.kiro/steering/structure.md`: `docs/` là **nguồn spec duy nhất**; `.kiro/specs/` đóng
    băng, không sửa và không thêm mới. Xoá dòng nợ "spec tồn tại hai bản song song" ở 1.6.C vì đã có
    quyết định.
13. Thêm một dòng nợ kỹ thuật mức **P1** vào 1.6.C: cờ `ENABLE_DEMO_PAYMENT_MINT` mặc định **bật**
    cho bản trình diễn; trước khi triển khai thật phải đặt `false` và gỡ màn Nạp VNDB. Ghi rõ đây là
    quyết định của chủ dự án ngày 07/10, không phải sơ suất.

## Phạm vi: task kết thúc ở đâu

Task **kết thúc ở pull request**, kiểm chứng trên bản dựng cục bộ. Triển khai lại Worker **không
thuộc task** vì nó cần khóa tài khoản Cloudflare, thứ không nằm trong repo và người làm không có.

| Việc | Ai làm |
|---|---|
| Sửa mã, sửa tài liệu, dựng cục bộ, kiểm khói cục bộ, mở PR | **Người làm task** |
| Đặt biến bí mật `SERVER_SIGNER_PRIVATE_KEY` trên Worker | Chủ dự án |
| Triển khai lại Worker | Chủ dự án |
| Kiểm khói trên địa chỉ thật sau khi triển khai | Chủ dự án, bằng lệnh dưới đây |

Kiểm khói cục bộ, **thuộc task**, dán kết quả vào checkpoint:

```bash
cd app && npm run cf:build
# chạy bản dựng rồi:
node scripts/smoke-test.mjs http://localhost:3000 --expect-commit=$(git rev-parse HEAD)
```

Kiểm sau khi triển khai, **không thuộc task**, ghi vào checkpoint như việc bàn giao cho chủ dự án:

```bash
node scripts/smoke-test.mjs https://bidv-rwa-tokenize.tuanlhbidv.workers.dev \
  --expect-commit=<sha của commit đã triển khai>
```

`scripts/smoke-test.mjs` đã có sẵn từ OP-01 và làm đúng hai phép kiểm cần cho việc này; **không viết
script mới**.

## Ràng buộc

- Không nới đòi hỏi khóa ký cho bất kỳ chain nào ngoài `mock`.
- Không sửa `mint.service.ts` hay nghiệp vụ nào khác để lách; sửa đúng một chỗ ở tầng `signer`.
- Không xoá nội dung Supervisor viết trong báo cáo công nghệ ngoài ba dòng nêu ở mục 10 và 12.

## Tác động

| | Tệp |
|---|---|
| Sửa | `lib/signer/server.signer.ts`, cấu hình dựng bản Cloudflare, `docs/guide.md`, `docs/tech-report.md`, `.kiro/steering/structure.md`, `.kiro/task-status.json` |
| Xoá | `docs/sc-02-evm-issuance/`, `docs/sc-03-evm-order-settlement/` |
| Mới | kiểm thử cho mục A |

## Mức kiểm chứng: Vừa

```bash
cd app && npx vitest run test/server-signer.test.ts   # tên tệp tuỳ người làm đặt
cd app && npm run cf:build && node ../scripts/smoke-test.mjs http://localhost:3000 --expect-commit=$(git rev-parse HEAD)
bash scripts/run-local-all.sh                          # cuối task, một lần
```

| Ca | Kiểm |
|---|---|
| 1 | Chain `mock`, **không** đặt biến khóa ký: `getBankSigner('mock')` trả tài khoản, không ném lỗi |
| 2 | Chain `hardhat-local` và `evm`, không đặt khóa: **vẫn ném** `SignerUnavailableError` kèm hướng dẫn |
| 3 | Chain `mock`, không đặt khóa: KYC và whitelist chạy được đầu cuối |
| 4 | Đặt `BUILD_COMMIT_SHA`: `/api/version` trả đúng mã đó, `source.commit` là `env` |
| 5 | Mọi nhãn menu trong `guide.md` mục 1 khớp `nav-config.ts` |

Đột biến, **một chỗ**: cho chain `evm` dùng chung nhánh trả tài khoản cố định của `mock` — ca 2 phải đỏ.

## Điều kiện hoàn thành

- [ ] Chain `mock` chạy được mà không cần khóa ký; chain khác giữ nguyên hành vi ném lỗi.
- [ ] `/api/version` **trên bản dựng cục bộ** có mã commit thật; `smoke-test.mjs` với
      `--expect-commit` đạt.
- [ ] `docs/guide.md` không còn nhắc mục menu không tồn tại; nhãn khớp mã nguồn; phần khóa ký nói
      đúng rằng `mock` không cần, chain thật thì cần.
- [ ] Metadata `tech-report.md` đúng; hai thư mục spec SC đã xoá; ba dòng nợ ở 1.6.C đã xử lý.
- [ ] `.kiro/steering/structure.md` ghi rõ `docs/` là nguồn spec duy nhất.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không đặt biến bí mật trên Cloudflare và không triển khai lại Worker (việc của chủ dự án).
- Không viết script kiểm khói mới; `scripts/smoke-test.mjs` đã có.
- Không viết lại spec SC-02 và SC-03 trong task này.
- Không đụng màn hình hay nghiệp vụ nào.
