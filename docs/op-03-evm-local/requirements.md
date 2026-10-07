# OP-03: Môi trường hardhat một lệnh và bộ đầu cuối trên chuỗi cục bộ

| | |
|---|---|
| Nhánh | `ops/03-evm-local`, từ `dev` @ `e4dd889` |
| Điểm | 5 |
| Mức kiểm chứng | **Vừa** (công cụ và khung kiểm thử; có một dòng log ở luồng mua) |
| Thứ tự | Đợt 5 vòng 1, **song song với SC-02** |
| Người làm | Codex hoặc Claude Code |

## Mục tiêu

Mục tiêu đợt 5 là chạy được trên hardhat và Sepolia. Trước hết phải có một cách **lặp lại được**
để dựng chuỗi cục bộ, triển khai hợp đồng, nạp dữ liệu mẫu và chạy kiểm thử đầu cuối trên đó, ở
máy người làm cũng như trên CI. Hiện mỗi người tự dựng tay, và CI không có bước nào chạy ứng dụng
với chuỗi thật. Task này dựng khung đó; SC-02, SC-07, SC-03 dùng lại.

## Hiện trạng đã đo

```bash
bash scripts/run-local-all.sh --list        # mac dinh: arch markers checkpoint contracts app; them: build, e2e
grep -n "next dev" app/playwright.config.ts # e2e chay next dev, ke ca khi phan build da dung ban phat hanh
grep -n "addresses.json\|writeFileSync" packages/contracts-evm/scripts/deploy.js
cd packages/contracts-evm && npx hardhat node &
npx hardhat run scripts/deploy.js --network localhost   # dia chi trung addresses.json
git status --short                                       # M packages/shared/src/addresses.json (chi doi deployedAt)
cd app && E2E_CHAIN=hardhat-local E2E_PORT=3300 npx playwright test e2e/mint.spec.ts e2e/wallet-connect.spec.ts
# 12 xanh / 1 do
grep -n "wallet:" app/src/lib/bank/account-profile.service.ts   # hai vi mau: NDT001 va NB001
grep -n "\"vars\"" app/wrangler.json | wc -l                     # 0
```

- Không có script nào dựng hardhat, triển khai và nạp dữ liệu mẫu bằng một lệnh.
- `deploy.js` ghi lại `addresses.json` mỗi lần chạy, kể cả khi địa chỉ không đổi. Địa chỉ hardhat
  chỉ tất định khi triển khai trên **nút mới** (cùng người triển khai, cùng thứ tự, nonce bắt đầu
  từ 0). Triển khai lên nút đã có giao dịch thì địa chỉ khác đi.
- Ví mẫu chỉ có **hai**: Nhà đầu tư `NDT001` và Người bán `NB001`, khai trong
  `account-profile.service.ts`. Hợp đồng `ProjectToken` chặn phát hành và chuyển nhượng tới ví chưa
  whitelist, nên trên chuỗi mới hai ví này chưa dùng được.
- Ca đỏ `wallet-connect.spec.ts:57` mặc định chain là `mock`, sai khi đặt `E2E_CHAIN`. Lỗi của ca
  test, không phải của sản phẩm.
- Ca `chain-selector.spec.ts` đổi sang `hardhat-local` và kiểm trang **báo lỗi đọc được khi không có
  nút**. Ca này chạy trong bộ đầu cuối `mock`, nên bộ đó phải chạy khi **không** có nút hardhat.
- Đầu cuối chạy trên `next dev`. Ở môi trường chậm, `ops-transactions.spec.ts` trượt ngẫu nhiên, cả
  trên `dev` gốc; chạy trên bản build thì xanh 54/54 (đo lúc nghiệm thu BE-17).
- Biến `NEXT_PUBLIC_*` bị **nhúng lúc dựng bản**, nên một bản build không đổi được chain mặc định lúc
  chạy.
- Dữ liệu nghiệp vụ trên `mock` và với `USE_MOCK_DB=true` nằm trong bộ nhớ tiến trình. Dựng lại
  chuỗi mà không khởi động lại ứng dụng thì cơ sở dữ liệu và chuỗi lệch nhau (ví dụ bảng dự án đã
  ghi mốc phát hành nhưng chuỗi mới chưa phát hành).

## Việc cần làm

**Dựng chuỗi cục bộ**

1. Script `scripts/evm-local.sh` với ba lệnh con:
   - `up`: chạy nút hardhat nếu chưa chạy, đợi sẵn sàng. Kiểm bytecode tại các địa chỉ trong
     `addresses.json`. Có và **khớp bản biên dịch hiện tại** thì không triển khai lại. Chưa có mà
     nút còn mới thì triển khai. Có nhưng lệch bản biên dịch, hoặc nút không còn mới, thì **dừng và
     báo phải `reset`**, không tự triển khai đè.
   - `down`: dừng nút.
   - `reset`: `down` rồi `up` từ trạng thái trống.
   Nút ghi log ra thư mục tạm, không ra cây làm việc. Sau `up`, in ra các biến ứng dụng cần đặt, và
   nhắc khởi động lại ứng dụng nếu vừa `reset`.
2. `deploy.js` **chỉ ghi** `addresses.json` khi có địa chỉ thay đổi. Chỉ đổi mốc thời gian thì
   không ghi. Không đổi gì khác trong `deploy.js` (SC-02 sửa phần cấp vai và kiểm triển khai).
3. Dữ liệu mẫu trên chuỗi: whitelist đúng hai ví `NDT001` và `NB001`. Địa chỉ phải lấy từ **một
   nguồn**: hoặc script đọc được `account-profile.service.ts`, hoặc chuyển hai địa chỉ sang một tệp
   dùng chung trong `packages/shared` rồi cả ứng dụng lẫn script cùng đọc. Không chép địa chỉ lần
   thứ hai.

**Đầu cuối**

4. Bộ đầu cuối `mock` chạy trên **bản build** do phần `build` dựng (`next start`), không dựng lại
   lần hai. Giữ một biến để chạy `next dev` khi cần gỡ lỗi. Bộ này phải chạy khi **không** có nút
   hardhat (vì ca `chain-selector.spec.ts`).
5. Một project Playwright `hardhat`, lúc đầu gồm `mint.spec.ts` và `wallet-connect.spec.ts`. Sửa ca
   `wallet-connect.spec.ts:57` để không giả định chain mặc định (chọn chain tường minh, hoặc bỏ qua
   ở project `hardhat` kèm lý do).
6. Project `hardhat` cần chain mặc định là `hardhat-local`, mà biến đó nhúng lúc dựng. Người làm
   chọn một trong hai cách và ghi lý do vào checkpoint: (a) bản build riêng với thư mục build riêng,
   không ghi đè bản build của phần `e2e`; (b) đặt chain qua cơ chế chọn chain của ứng dụng ở bước
   chuẩn bị của mỗi ca, không phụ thuộc chain mặc định.
7. Phần mới `evm` trong `run-local-all.sh`: `evm-local.sh reset`, khởi động ứng dụng mới, chạy
   project `hardhat`, dừng ứng dụng, `evm-local.sh down`. Phải dọn nút và ứng dụng **kể cả khi kiểm
   thử đỏ**. Không vào bộ mặc định. Thêm vào job `heavy` của CI, chạy **sau** bước `build e2e`; job
   này cần cài thêm phụ thuộc của `packages/contracts-evm`.

**Việc kèm** (đã chốt ở lần nghiệm thu BE-17)

8. Nhánh `catch` của `autoSettleCreatedOrder` đang nuốt lỗi im lặng: thêm một dòng `console.error`
   kèm mã lệnh, theo mẫu ở `lib/nav/pending-work.ts`. Không đổi hành vi nào khác.
9. Thêm dòng nợ P2 vào `docs/tech-report.md`: lệnh kẹt ở `PLACED` không can thiệp được, chỉ được
   `expireStaleOrders` dọn sang Hết hạn.
10. Mục `vars` trong `app/wrangler.json` cho các biến **công khai, đọc lúc chạy**: `USE_MOCK_KYC`,
    `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_DEMO_TOKEN_MINT`. Giá trị phải
    **bằng đúng mặc định đang hiệu lực** trong `lib/config/env.ts`. Đo được ngày 07/10:
    `USE_MOCK_KYC=true`, `USE_MOCK_DB=true`, `DEMO_ROLE=TELLER`, `ENABLE_DEMO_PAYMENT_MINT=true`,
    `ENABLE_DEMO_TOKEN_MINT=false`. Đo lại trước khi đặt. Không đưa biến
    `NEXT_PUBLIC_*` (nhúng lúc dựng, đặt ở `vars` không có tác dụng) và không đưa secret.

**Tài liệu và trạng thái**

11. `docs/EVM_LOCAL.md`: dựng, chạy ứng dụng trên hardhat, chạy đầu cuối, `reset` thì khởi động lại
    ứng dụng, dọn. Liên kết từ `docs/guide.md`.
12. Commit đầu: thay `docs/GIAO_VIEC_DOT_5.md` bằng bản 3 trong gói này, và cập nhật
    `.kiro/task-status.json` theo mục 7 của bản đó.

## Ràng buộc

- **Không sửa** hợp đồng, `evm.adapter.ts`, ABI, `ILedgerPort`: thuộc SC-02.
- Không đưa khoá riêng nào vào repo ngoài khoá công khai của tài khoản mẫu Hardhat đã có.
- Bộ mặc định của `run-local-all.sh` không chậm thêm.
- Không đổi hành vi bản deploy.

## Tác động

| | Tệp |
|---|---|
| Sửa | `packages/contracts-evm/scripts/deploy.js` (chỉ phần ghi tệp), `app/playwright.config.ts`, `app/e2e/wallet-connect.spec.ts`, `scripts/run-local-all.sh`, `.github/workflows/ci.yml`, `app/wrangler.json`, `app/src/lib/bank/purchase.service.ts` (một dòng), `docs/tech-report.md`, `docs/guide.md`, `docs/GIAO_VIEC_DOT_5.md`, `.kiro/task-status.json`; có thể `account-profile.service.ts` nếu chọn cách tệp dùng chung ở việc 3 |
| Mới | `scripts/evm-local.sh`, script dữ liệu mẫu trên chuỗi, `docs/EVM_LOCAL.md` |
| Bị ảnh hưởng | Toàn bộ đầu cuối (đổi sang bản build); job `heavy` của CI dài thêm |

## Mức kiểm chứng: Vừa

```bash
bash scripts/evm-local.sh reset && bash scripts/evm-local.sh up    # up lan hai khong trien khai lai
git status --short                                                   # sach
bash scripts/run-local-all.sh build e2e                              # khong co nut hardhat dang chay
bash scripts/run-local-all.sh evm
bash scripts/run-local-all.sh
```

| Ca | Kiểm |
|---|---|
| 1 | `up` hai lần liên tiếp: lần hai không triển khai lại |
| 2 | Sau `up` và `reset`, cây làm việc sạch |
| 3 | Nút đã có giao dịch lạ (gửi tay một giao dịch rồi `up`): script dừng và báo `reset`, không triển khai đè |
| 4 | Sửa tạm một dòng trong hợp đồng rồi `up` trên nút cũ: script phát hiện lệch bytecode và báo `reset`. Hoàn nguyên sau khi thử |
| 5 | Sau `up`, hai ví mẫu đã whitelist trên chuỗi |
| 6 | Project `hardhat` xanh toàn bộ |
| 7 | Bộ đầu cuối `mock` trên bản build xanh **ba lần liên tiếp**, ghi thời gian từng lần |
| 8 | Phần `evm` đỏ giữa chừng (cố ý làm một ca đỏ): nút và ứng dụng vẫn được dọn |
| 9 | Giá trị trong `vars` khớp mặc định trong mã, có bảng đối chiếu trong checkpoint |

## Điều kiện hoàn thành

- [ ] `scripts/evm-local.sh` có `up`, `down`, `reset`, xử lý đúng ca 1 tới 4, không làm bẩn cây làm việc.
- [ ] Hai ví mẫu được whitelist trên chuỗi, địa chỉ lấy từ một nguồn.
- [ ] Bộ đầu cuối `mock` chạy trên bản build của phần `build`; ba lần liên tiếp xanh.
- [ ] Project `hardhat` xanh; cách xử lý chain mặc định (việc 6) ghi trong checkpoint.
- [ ] Phần `evm` có trong `run-local-all.sh` và job `heavy` của CI, tự dọn kể cả khi đỏ.
- [ ] Việc kèm 8, 9, 10 đã làm.
- [ ] `docs/EVM_LOCAL.md` có, và đã đi lại từ một bản clone sạch theo đúng tài liệu.
- [ ] `task-status.json` và `GIAO_VIEC_DOT_5.md` cập nhật theo kế hoạch bản 3.
- [ ] `run-local-all.sh` bộ mặc định xanh.

## Không làm

- Không nối lập duyệt Mint/Burn xuống chuỗi (SC-02).
- Không triển khai Sepolia (OP-04).
- Không dựng Besu hay mạng nào khác.
- Không thêm ca đầu cuối cho luồng chưa chạy trên chuỗi.
