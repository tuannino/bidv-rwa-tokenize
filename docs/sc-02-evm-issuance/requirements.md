# SC-02: Lập duyệt Mint/Burn chạy thật trên EVM

| | |
|---|---|
| Nhánh | `feat/sc-02-evm-issuance`, từ `dev` @ `e4dd889` |
| Điểm | 10 (kế hoạch v5 ghi 8; tăng vì phải sửa dữ liệu dựng của các bộ kiểm thử hợp đồng cũ và ba script trình diễn, xem "Hiện trạng") |
| Mức kiểm chứng | **Cao** (phát hành và huỷ token trên chuỗi thật) |
| Thứ tự | Đợt 5 vòng 1, **song song với OP-03**. OP-04 (Sepolia) chỉ làm sau task này |
| Người làm | Codex hoặc Claude Code |
| Nguồn | Bản đề xuất trên nhánh `feat/account-info` @ `e7990cd`, đã rà và chỉnh theo hiện trạng `e4dd889`. Thiết kế ở `design.md` cùng thư mục |

## Mục tiêu

Đưa đúng luồng **Giao dịch viên lập, Kiểm soát viên duyệt, rồi Mint hoặc Burn** từ `mock` xuống
`hardhat-local` và Sepolia. Không mở lại đường phát hành trực tiếp. Lần Mint đầu đăng ký ví thanh
toán SPV trên chuỗi; các lần sau chỉ mint vào đúng ví đó. Đây là luồng đầu tiên chạy trọn trên chuỗi
thật, và là nền cho tích hợp Fireblocks ở đợt 6.

## Hiện trạng đã đo

```bash
grep -n "@blocked SC-02" app/src/lib/ledger/evm.adapter.ts      # 3: mintInitialSupply, isInitialSupplyMinted, spvWallet
sed -n 93,96p packages/contracts-evm/contracts/tokens/ProjectToken.sol   # mint(to, amount) vao MOI dia chi
grep -n "require(" packages/contracts-evm/contracts/tokens/ProjectToken.sol | head   # loi hien co la chuoi, khong phai custom error
grep -n "mintInitialSupply\|ledger.mint" app/src/lib/bank/issuance.service.ts   # da phan nhanh lan dau / lan sau, da kiem dung SPV
grep -n "spvWallet: request.wallet" app/src/lib/bank/token-request.service.ts   # vi SPV do Giao dich vien nhap o yeu cau Mint
grep -c "\.mint(" packages/contracts-evm/test/*.js               # du lieu dung cua kiem thu hop dong mint thang vao vi nha dau tu
grep -n "\.mint(" packages/contracts-evm/scripts/demo-cycle.js packages/contracts-evm/scripts/demo-oracle.js packages/contracts-evm/scripts/dod-verify-sepolia.js
grep -n "/api/mint" scripts/demo-mint.mjs                        # script trinh dien goi duong du lieu thu, mac dinh hardhat-local
grep -n "BASE_REF" scripts/verify-arch-rules.sh                  # phep "khong sua contract", CI khong dat BASE_REF nen bo qua
```

- `ProjectToken` có `mint` và `agentBurn`, nhưng **không lưu ví SPV** và **không có cờ** "đã phát
  hành lần đầu". `MINTER_ROLE` mint được vào mọi địa chỉ. Hook `_update` đã chặn phát hành cho ví
  chưa whitelist bằng thông báo chuỗi.
- Nghiệp vụ đã sẵn: `issuance.service.ts` phân nhánh lần đầu qua `mintInitialSupply`, lần sau qua
  `mint(spvWallet)`, kiểm trần từ bảng dự án, và **đã tự kiểm** ví nhận phải là ví SPV đã đăng ký.
  Burn gọi `ledger.burn`, đã nối `agentBurn` trên EVM.
- **Kiểm thử hợp đồng cũ mint thẳng vào ví nhà đầu tư** ở năm tệp: `full-cycle`, `oracle-cycle`,
  `spec-p7-profit-distribution`, `spec-p12-redemption` dùng nó để **dựng dữ liệu**; riêng
  `spec-p4-mint` (14 ca, P4-1 tới P4-14) **kiểm chính hành vi** "phát hành cho nhà đầu tư đã KYC".
  Sau SC-02 các lời gọi đó sẽ revert.
- Ba script trình diễn trong `packages/contracts-evm/scripts` cũng mint thẳng vào ví nhà đầu tư.
  `scripts/demo-mint.mjs` gọi đường dữ liệu thử `/api/mint`, mặc định trên `hardhat-local`.
- Đường dữ liệu thử `/mint` (`mint.service.ts`) mint vào ví bất kỳ. Ba tệp đầu cuối dùng nó, nhưng
  **chỉ `mint.spec.ts` chạy nó trên hardhat** (khi đặt `E2E_CHAIN=hardhat-local`).
  `chain-selector.spec.ts` và `maker-checker.spec.ts` mint trên `mock`.
- Bộ hợp đồng trên Sepolia là bản trước SC-02. Gọi `initialSupplyMinted` trên đó sẽ lỗi vì hàm
  không tồn tại.

## Việc cần làm

**Hợp đồng** (chi tiết ở `design.md` mục 2)

1. `ProjectToken` lưu `spvWallet` và cờ `initialSupplyMinted`. Thêm `mintInitialSupply(spv, amount)`
   chạy đúng một lần, từ chối ví 0 và số lượng 0 bằng custom error. Ví chưa whitelist, bị đóng băng,
   hay token đang tạm dừng thì để **hook `_update` hiện có** chặn với đúng thông báo chuỗi cũ. Ghi
   ví và cờ cùng giao dịch với lần mint: mint revert thì không ghi gì.
2. Sau lần đầu, `mint(to, amount)` chỉ nhận `to == spvWallet`. Trước lần đầu, `mint` bị từ chối.
   `mint` với số lượng 0 sau lần đầu **giữ hành vi hiện tại** (thành công, tổng cung không đổi), để
   không đổi ca P4-7.
3. Cờ đã phát hành **không** suy từ `totalSupply > 0`.
4. Phát sự kiện `InitialSupplyMinted`. Lỗi **mới** dùng custom error; lỗi chuỗi cũ của hook giữ nguyên
   (không đổi hành vi đã kiểm thử ở P4).

**Kiểm thử hợp đồng cũ**

5. Thêm helper trong `packages/contracts-evm/test/helpers` để dựng số dư nhà đầu tư theo đúng đường
   mới: lần đầu `mintInitialSupply` vào một ví SPV kiểm thử đã whitelist, các lần sau `mint` vào ví
   đó, rồi chuyển từ SPV sang nhà đầu tư. **Mint đúng số cần và chuyển hết**, để số dư SPV về 0 sau
   khi dựng. Lý do: các ca chia lợi nhuận (P7) và tất toán (P12) dùng tổng cung tại ảnh chụp làm mẫu
   số; SPV giữ lại token sẽ đổi kết quả của chính những ca đó.
6. Bốn tệp dựng dữ liệu (`full-cycle`, `oracle-cycle`, `spec-p7`, `spec-p12`): thay phần dựng bằng
   helper. **Chỉ đổi dữ liệu dựng, không đổi phép kiểm.** Ca nào bắt buộc đổi phép kiểm thì ghi riêng
   trong checkpoint kèm lý do. Ví dụ đã biết: `full-cycle.test.js` dòng 46 kiểm "mint cho ví chưa KYC
   bị chặn"; sau SC-02 lời gọi đó bị luật SPV chặn trước. Chuyển sang `mintInitialSupply` vào ví chưa
   whitelist để giữ ý của ca và giữ đúng thông báo `phat hanh cho vi chua KYC`.
7. `spec-p4-mint.test.js`: luật P4 "ngân hàng phát hành cho nhà đầu tư" đã bị SC-02 thay bằng "phát
   hành vào ví SPV". **Viết lại** từng ca theo luật mới, giữ đủ ý: P4-4 thành phát hành vào SPV làm
   tăng số dư và tổng cung; P4-5, P4-8, P4-9 thành `mintInitialSupply` vào ví chưa whitelist, bị
   đóng băng, khi tạm dừng, cùng thông báo cũ; P4-6 giữ; P4-7 giữ theo việc 2; P4-10 tới P4-13 chỉ
   đổi dữ liệu dựng. Checkpoint có bảng đối chiếu ca cũ sang ca mới. Không sửa gì trong `.kiro/specs/`
   (đã đóng băng).
8. Tổng số ca hợp đồng chỉ được tăng (đo 07/10: 67).

**Triển khai, ABI, script**

9. Cập nhật phần cấp vai và kiểm triển khai trong `deploy.js`, `verify-deployment.js`; ABI tối giản
   ở `packages/shared` (kèm custom error để viem giải mã) và ABI sinh tự động. Không sửa phần ghi
   `addresses.json` (thuộc OP-03).
10. Script kiểm triển khai xác nhận vai `MINTER_ROLE` và `AGENT_ROLE` của khoá ký máy chủ, và ba phép
   đọc mới. Gặp bộ hợp đồng cũ thì **báo lỗi rõ** "bộ hợp đồng là bản trước SC-02, cần triển khai
   lại", không coi là "chưa phát hành".
11. Sửa `demo-cycle.js`, `demo-oracle.js`, `dod-verify-sepolia.js` dùng cùng cách dựng của việc 5 (helper).
    `scripts/demo-mint.mjs`: đổi mặc định sang `mock`, và khi chạy trên chain EVM thì dừng với thông
    báo dẫn sang luồng lập duyệt.

**Adapter**

12. Nối ba phương thức trong `evm.adapter.ts`, gỡ ba marker `@blocked SC-02`. `spvWallet()` trả
    `null` trước lần đầu, địa chỉ chuẩn hoá sau lần đầu.
13. Dịch lỗi thành thông báo có hành động, địa chỉ hợp đồng, nguyên nhân: cả custom error mới, cả lỗi
    chuỗi cũ của hook, cả trường hợp hàm không tồn tại trên bộ hợp đồng cũ. Không để lỗi viem thô lên
    giao diện.
14. Kiểm thử adapter với **nút hardhat thật**, bật bằng biến `TEST_HARDHAT_RPC` theo mẫu
    `TEST_DATABASE_URL`. Không có biến thì bỏ qua, không đỏ. Kiểm thử tự whitelist ví SPV nó dùng,
    không dựa vào dữ liệu mẫu của OP-03.

**Đường dữ liệu thử và đầu cuối**

15. `mint.service.ts` trên chain EVM **từ chối trước khi gửi**: "đường dữ liệu thử chỉ chạy trên
    mock; phát hành chính thức qua lập duyệt". Trên `mock` giữ nguyên. Ghi chú ngay trong tệp: đây là
    lệch có chủ ý giữa `mock` và hợp đồng, chấp nhận được vì luồng chính thức đã tự kiểm ví SPV ở
    `issuance.service.ts` nên hai chain cư xử giống nhau trên luồng chính thức.
16. Sửa `mint.spec.ts` cho hành vi mới khi chạy trên hardhat. Thêm ca đầu cuối lập duyệt Mint, Mint
    lần hai, Burn trên hardhat vào project `hardhat` của OP-03. Ví SPV dùng ví mẫu `NB001` mà OP-03
    đã whitelist.

**Luật kiến trúc**

17. `verify-arch-rules.sh` có phép "không sửa contract đã qua kiểm thử" (chạy khi đặt `BASE_REF`).
    Task này sửa hợp đồng **có chủ ý**: ghi mục DEVIATION trong checkpoint theo đúng thông báo của
    phép đó, nêu tệp, lý do, và phép kiểm thay thế (ca 1 tới 4 cùng hai phép đột biến).

## Ràng buộc

- Không gọi viem ngoài adapter, script triển khai và kiểm thử hợp đồng. Không đưa kiểu viem vào
  `ILedgerPort`.
- Mọi chữ ký của ứng dụng qua `ISigner`. Kiểm thử hợp đồng được dùng signer Hardhat.
- Lưu giao dịch `PENDING` trước khi đợi biên nhận (`trackTxn` hiện có).
- Không đổi lập duyệt, vai, quyền. Không bật `ENABLE_DEMO_TOKEN_MINT` mặc định.
- Không sửa `run-local-all.sh`, CI, cấu hình Playwright (thuộc OP-03).
- Không đổi constructor và thứ tự triển khai, để địa chỉ hardhat giữ nguyên.

## Tác động

| | Tệp |
|---|---|
| Sửa | `ProjectToken.sol`; năm tệp kiểm thử hợp đồng; `deploy.js` (phần vai), `verify-deployment.js`, `demo-cycle.js`, `demo-oracle.js`, `dod-verify-sepolia.js`; `scripts/demo-mint.mjs`; `packages/shared/src/abi/*`, `packages/shared/generated/*`; `evm.adapter.ts`; `mint.service.ts`; `app/e2e/mint.spec.ts` |
| Mới | Helper dựng số dư, kiểm thử hợp đồng SC-02, kiểm thử adapter với nút thật, ca đầu cuối lập duyệt trên hardhat |
| Bị ảnh hưởng | Sepolia **phải triển khai lại** ở OP-04; `docs/TESTNET_SEPOLIA.md` |

## Mức kiểm chứng: Cao

```bash
bash scripts/run-local-all.sh contracts
cd packages/contracts-evm && npx hardhat node &          # truoc khi OP-03 merge; sau thi dung scripts/evm-local.sh reset
npx hardhat run scripts/deploy.js --network localhost
cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/evm-issuance.test.ts
bash scripts/run-local-all.sh evm                        # sau khi rebase len OP-03
bash scripts/run-local-all.sh
```

| Ca | Kiểm |
|---|---|
| 1 | Hợp đồng: lần đầu thành công; sự kiện, getter, số dư đúng |
| 2 | Hợp đồng: `mintInitialSupply` lần hai bị từ chối, **kể cả sau khi Burn hết** |
| 3 | Hợp đồng: `mint` trước lần đầu, và `mint` sang ví khác SPV, đều bị từ chối |
| 4 | Hợp đồng: thiếu vai, ví 0, số lượng 0, chưa whitelist, bị đóng băng đều bị từ chối và **không ghi cờ** |
| 5 | Adapter với nút thật: ba phương thức đúng trước và sau lần đầu; lỗi mới, lỗi cũ, lỗi bộ hợp đồng cũ đều được dịch |
| 6 | Hardhat đầu cuối: Giao dịch viên lập Mint lần một vào `NB001`, Kiểm soát viên duyệt; tổng cung và số dư SPV tăng đúng |
| 7 | Hardhat đầu cuối: Mint lần hai vào cùng SPV; vượt trần bị chặn trước khi gửi |
| 8 | Hardhat đầu cuối: lập duyệt Burn phần chưa phân phối; tổng cung và số dư SPV giảm đúng |
| 9 | Duyệt cùng một yêu cầu hai lần đồng thời, kiểm ở mức service với nút thật (`TEST_HARDHAT_RPC`), gọi song song bằng `Promise.all`: chỉ một giao dịch được gửi |
| 10 | `/mint` trên hardhat bị từ chối trước khi gửi, thông báo đúng; trên `mock` vẫn chạy |
| 11 | Script kiểm triển khai gặp bộ hợp đồng cũ: báo lỗi rõ |

Đột biến, **đúng hai chỗ**:

- Bỏ phép kiểm `to == spvWallet` trong `mint`: ca 3 phải đỏ.
- Suy cờ đã phát hành từ `totalSupply > 0`: ca 2 phải đỏ.

## Điều kiện hoàn thành

- [ ] Hợp đồng chặn mint trước lần đầu, mint lần đầu lần hai, mint sang ví khác SPV.
- [ ] Kiểm thử hợp đồng cũ chuyển sang helper; phép kiểm không đổi trừ các ca có ghi lý do; tổng số ca không giảm.
- [ ] Ba marker `@blocked SC-02` đã gỡ; máy kiểm ra 18 điểm cắm, 10 điểm chặn.
- [ ] Adapter có kiểm thử với nút hardhat thật, bật bằng `TEST_HARDHAT_RPC`.
- [ ] Lập duyệt Mint hai lần và Burn chạy đầu cuối trên hardhat, nằm trong project `hardhat`.
- [ ] Đường `/mint` trên EVM từ chối trước khi gửi, có chú thích lệch có chủ ý; các script trình diễn đã sửa.
- [ ] ABI, triển khai, kiểm triển khai đồng bộ; script kiểm báo lỗi rõ với bộ hợp đồng cũ.
- [ ] Hai phép đột biến có kết quả thật trong checkpoint; mục DEVIATION cho việc sửa hợp đồng.
- [ ] Checkpoint ghi mã giao dịch và biên nhận hardhat của ca 6, 7, 8.
- [ ] `run-local-all.sh` bộ mặc định và phần `evm` xanh.

## Không làm

- Không làm hợp đồng khớp lệnh (SC-03) hay vault thanh toán (SC-07), cả hai ở đợt 6.
- Không triển khai Sepolia (OP-04).
- Không làm đường đổi ví SPV trên hợp đồng. Đợt 6 ví thanh toán chuyển sang vault; cách chuyển quyết
  định ở DS-01. Thêm hàm đổi ví ở đây là làm yếu đúng bất biến task này dựng lên.
- Không tích hợp Fireblocks (IN-03, IN-04 ở đợt 6).
- Không tuyên bố sẵn sàng cho môi trường thật.
