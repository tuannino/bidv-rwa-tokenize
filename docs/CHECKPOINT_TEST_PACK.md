# Checkpoint: Tiếp nhận bộ test spec P4/P7/P12

| | |
|---|---|
| Nhánh | `test/spec-pack-p4-p7-p12` |
| Nền | `p4/mint-testnet` @ `a24034d` |
| Giao việc | `docs/20260910_test_pack_spec_p4_p7_p12/20260910_giao_viec_kiro_bo_test.md` |
| Trạng thái | ✅ Lớp 1 + lớp 3 PASS toàn bộ · ⛔ 1 mục DoD bị chặn bởi môi trường (Docker OOM) |

## 0. Cách nhánh này được tạo — và lý do phải làm khác yêu cầu

Yêu cầu: tạo nhánh từ `dev`, thêm bộ test, rồi rebase về nhánh hiện tại.

**`dev` không dùng được làm nền.** Commit `ac4f0b1` (`Revert "Iteration 2/UI cleanup"`) đã xoá
toàn bộ thành quả P0/P1 khỏi `dev`, và merge PR#7 sau đó **không** phục hồi được (git chỉ so
với merge-base, nên phần đã revert mất vĩnh viễn):

```
git ls-tree -r --name-only dev | grep -c '^packages/'      →  0
git ls-tree -r --name-only dev | grep '^app/src/lib'       →  chỉ mock-data.ts, utils.ts, wagmi.ts
git ls-tree --name-only dev                                →  có lại contracts/evm/AssetRegistry.sol
```

Mất: `packages/{contracts-evm,contracts-stellar,shared}`, `app/src/lib/{ledger,signer,rbac,chains,config,store}`,
`docker-compose.yml`. Bộ test nhắm đúng những đường dẫn này nên trên `dev` nó không chạy được;
`verify-arch-rules.sh` cũng tự thoát vì không thấy `packages/`.

Nếu làm đúng nghĩa chữ (`git checkout -b … dev` rồi `git rebase p4/mint-testnet`) thì git sẽ
replay chính commit revert đó lên trên P4 và **xoá sạch P0/P1/P4**. Nên tôi dùng:

```bash
git checkout -b test/spec-pack-p4-p7-p12 dev
# … commit bộ test …
git rebase --onto p4/mint-testnet dev test/spec-pack-p4-p7-p12
```

`--onto` replay **chỉ** commit của tôi. Lineage vẫn sinh ra từ `dev`, code đem ra chạy test là
code P4. Rebase sạch, không conflict.

⚠️ **`dev` vẫn đang hỏng.** Nhánh này không sửa `dev`. Xem mục 5, câu hỏi 1.

## 1. Kết quả chạy (nguyên văn)

### 3 luật kiến trúc — `bash scripts/verify-arch-rules.sh`

```
LUẬT 1 - Mọi tương tác chain đi qua ILedgerPort
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  @stellar/stellar-sdk không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
LUẬT 2 - Mọi thao tác ký đi qua ISigner
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):
        app/src/lib/signer/index.ts:40:  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
LUẬT 3 - Mọi kiểm quyền đi qua RBAC can()
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 5 server action (guard nằm ở tầng service, xem lớp 1)
MỘT NGUỒN SỰ THẬT - ABI và địa chỉ contract
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  WARN  Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):
        app/src/components/pages/mint.tsx:172:                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        app/src/components/pages/mint.tsx:178:                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
  PASS  Không có contract ID Stellar hardcode trong app/src
KHÔNG SỬA CONTRACT ĐÃ PASS TEST
  WARN  Chưa đặt BASE_REF nên bỏ qua so sánh contract. Dùng: BASE_REF=<commit> bash scripts/verify-arch-rules.sh
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
CHAIN ĐƯỢC PHÉP - Polygon đã loại bỏ vĩnh viễn
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
KÝ HIỆU TOKEN - WPT / VNDB (ký hiệu cũ SPT / tVND đã bỏ)
  PASS  Không còn ký hiệu cũ SPT / tVND
CẤU TRÚC SPEC VÀ STEERING
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  WARN  spec p4-mint-stellar chưa có (chưa tới lượt làm thì bỏ qua)
  WARN  spec p7-profit-distribution-stellar chưa có (chưa tới lượt làm thì bỏ qua)
  WARN  spec p12-redemption-stellar chưa có (chưa tới lượt làm thì bỏ qua)
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
TỔNG KẾT
  PASS: 20   FAIL: 0   WARN: 6
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
```

Chạy thêm có `BASE_REF` để lộ đúng phần contract bị sửa:

```
BASE_REF=a24034d bash scripts/verify-arch-rules.sh

KHÔNG SỬA CONTRACT ĐÃ PASS TEST
  FAIL  Contract bị sửa so với a24034d (spec yêu cầu giữ nguyên, phải có DEVIATION):
        packages/contracts-evm/contracts/tokens/VNDToken.sol
        packages/contracts-stellar/contracts/profit_distributor_pull/src/lib.rs
        packages/contracts-stellar/contracts/redemption/src/lib.rs
        packages/contracts-stellar/contracts/wpt_token/src/lib.rs
```

Cả 4 đều có chủ đích và do chính giao việc yêu cầu — xem mục 4. Ba file `.rs` chỉ thêm đúng
hai dòng `#[cfg(test)] mod spec_tests;`, không đụng logic:

```
$ git diff a24034d..HEAD -- 'packages/contracts-stellar/contracts/*/src/lib.rs'
@@ -299,3 +299,6 @@ mod test {
         assert!(dist.try_claim(&1u32, &a).is_err());
     }
 }
+
+#[cfg(test)]
+mod spec_tests;
```
(giống hệt ở `redemption` và `wpt_token`)

### cargo test — `cd packages/contracts-stellar && cargo test`

```
     Running unittests src/lib.rs (target/debug/deps/profit_distributor-…)
running 1 test
test test::test_distribute_pro_rata ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running unittests src/lib.rs (target/debug/deps/profit_distributor_pull-…)
running 16 tests
test spec_tests::p7_11_claim_on_unopened_period_rejected ... ok
test spec_tests::p7_3_finalize_without_report_rejected ... ok
test spec_tests::p7_1_report_then_finalize_locks_revenue ... ok
test spec_tests::p7_2_report_after_finalize_rejected ... ok
test spec_tests::p7_14_period_info_readable ... ok
test spec_tests::p7_12_insufficient_treasury_rejected ... ok
test spec_tests::p7_4_open_period_snapshots_supply ... ok
test spec_tests::p7_13_non_holder_gets_nothing ... ok
test spec_tests::p7_10_double_claim_rejected ... ok
test spec_tests::p7_15_period_survives_long_gap_between_open_and_claim ... ok
test spec_tests::p7_7_open_period_with_zero_supply_rejected ... ok
test spec_tests::p7_5_open_period_requires_finalized_revenue ... ok
test spec_tests::p7_6_open_period_twice_rejected ... ok
test spec_tests::p7_8_share_follows_snapshot_not_current_balance ... ok
test spec_tests::p7_9_claim_pays_correct_amount ... ok
test test::test_pull_claim_uses_snapshot_balance ... ok
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.29s

     Running unittests src/lib.rs (target/debug/deps/redemption-…)
running 14 tests
test spec_tests::p12_13_initialize_only_once ... ok
test spec_tests::p12_10_negative_amount_rejected ... ok
test spec_tests::p12_2_negative_rate_rejected ... ok
test spec_tests::p12_11_insufficient_treasury_rejected_without_burning ... ok
test spec_tests::p12_12_redeem_more_than_balance_rejected ... ok
test spec_tests::p12_3_preview_uses_scale ... ok
test spec_tests::p12_1_rate_readable_and_updatable ... ok
test spec_tests::p12_6_treasury_decreases_by_paid_amount ... ok
test spec_tests::p12_5_partial_redeem_keeps_remainder ... ok
test spec_tests::p12_4_redeem_burns_wpt_and_pays_vndb ... ok
test spec_tests::p12_8_paused_blocks_redeem ... ok
test test::test_redeem ... ok
test spec_tests::p12_7_no_approve_needed_unlike_evm ... ok
test spec_tests::p12_9_unpause_restores_redeem ... ok
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.17s

     Running unittests src/lib.rs (target/debug/deps/revenue_oracle-…)
running 1 test
test test::test_report_finalize_lock ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

     Running unittests src/lib.rs (target/debug/deps/wpt_token-…)
running 16 tests
test spec_tests::p4_12_initialize_only_once ... ok
test spec_tests::p4_11_token_metadata ... ok
test spec_tests::p4_4_mint_blocked_when_not_authorized ... ok
test spec_tests::p4_5_mint_negative_rejected ... ok
test spec_tests::p4_1_authorize_reflects_state ... ok
test spec_tests::p4_2_deauthorize_works ... ok
test spec_tests::p4_10_invalid_snapshot_rejected ... ok
test spec_tests::p4_3_mint_to_authorized_holder ... ok
test spec_tests::p4_7_transfer_more_than_balance_rejected ... ok
test spec_tests::p4_6_transfer_requires_both_sides_authorized ... ok
test test::test_mint_requires_authorized_holder ... ok
test spec_tests::p4_8_clawback_reduces_supply ... ok
test test::test_transfer_blocked_when_not_authorized ... ok
test test::test_transfer_and_clawback ... ok
test spec_tests::p4_9_snapshot_freezes_balance_at_that_point ... ok
test test::test_snapshot_freezes_balance_for_reads ... ok
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
```

**48 passed, 0 failed.** Trong đó **40 test spec mới** (12 `p4_*` + 15 `p7_*` + 13 `p12_*`) —
khớp đúng con số gói cam kết — và 8 test cũ vẫn xanh.

Còn 9 `warning` deprecated `Events::publish` trong `wpt_token/src/lib.rs` (SDK khuyên dùng
`#[contractevent]`). Có từ trước, không phải do bộ test, tôi **không** sửa vì đó là logic contract.

### hardhat test — `cd packages/contracts-evm && npx hardhat test`

```
  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Quét phần dư: sau thời hạn nhận, phần chưa nhận trả về ngân hàng
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó
  Oracle sản lượng điện + chia lợi nhuận theo công thức
    ✔ Công thức lợi nhuận: gross = kWh×giá, net = gross−opex, chia = net×share
    ✔ Đa xác nhận: cần đủ 2 reporter khớp số liệu mới chốt; số liệu lệch bị từ chối
    ✔ Tạo đợt chia từ oracle rồi nhà đầu tư nhận đúng theo tỷ lệ nắm giữ
    ✔ Không chia được khi oracle chưa chốt, và không chia trùng một kỳ
    ✔ opex vượt doanh thu => lợi nhuận chia = 0 (không âm)
  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm
      ✔ P12-7: tất toán một phần thì phần còn lại vẫn giữ
      ✔ P12-8: thanh khoản kho giảm đúng số đã trả
    Các ca bị chặn
      ✔ P12-9: đang tạm dừng thì không tất toán được
      ✔ P12-10: số lượng 0 bị từ chối
      ✔ P12-11: ví chưa KYC không tất toán được
      ✔ P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT
      ✔ P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM)
      ✔ P12-14: approve thiếu so với số muốn tất toán thì thất bại
    Rút thanh khoản
      ✔ P12-15: MANAGER rút được VNDB dư khỏi kho
      ✔ P12-16: ví không có quyền không rút được kho
  SPEC P4 - Phát hành WPT
    Whitelist (điều kiện tuân thủ trước khi phát hành)
      ✔ P4-1: AGENT whitelist được ví, isWhitelisted phản ánh đúng
      ✔ P4-2: whitelist theo lô cho nhiều ví cùng lúc
      ✔ P4-3: ví KHÔNG có AGENT_ROLE không được whitelist
    Mint
      ✔ P4-4: mint cho ví đã whitelist làm tăng số dư và tổng cung
      ✔ P4-5: mint cho ví CHƯA whitelist bị chặn (không tạo token)
      ✔ P4-6: ví KHÔNG có MINTER_ROLE không mint được
      ✔ P4-7: mint 0 không làm đổi tổng cung
    Đóng băng và tạm dừng (ràng buộc tuân thủ)
      ✔ P4-8: ví bị đóng băng không nhận được token phát hành
      ✔ P4-9: khi tạm dừng toàn hệ thì không phát hành được
      ✔ P4-10: chuyển nhượng đòi CẢ HAI đầu đã whitelist
    Thu hồi cưỡng chế (clawback / forcedTransfer)
      ✔ P4-11: AGENT đốt cưỡng chế làm giảm tổng cung
      ✔ P4-12: forcedTransfer chuyển được kể cả khi bên gửi bị đóng băng
      ✔ P4-13: forcedTransfer sang ví chưa KYC bị chặn
    Thông tin token
      ✔ P4-14: decimals của bản EVM là 0 (đơn vị nguyên)
      ✔ P4-15: ký hiệu token là WPT và VNDB
  SPEC P7 - Chia lợi tức
    Tạo kỳ chia (nhánh nhập tay)
      ✔ P7-1: tạo kỳ chốt snapshot và ghi đúng tổng cung tại snapshot
      ✔ P7-2: kho VNDB được kéo vào hợp đồng khi tạo kỳ
      ✔ P7-3: amount = 0 bị từ chối
      ✔ P7-4: không có token đang lưu hành thì không tạo được kỳ
      ✔ P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ
      ✔ P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp)
    Tính phần chia theo snapshot
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó
      ✔ P7-9: ví không nắm giữ token được chia 0
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng
      ✔ P7-12: nhận lần hai không trả thêm tiền
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư
      ✔ P7-15: ví không có quyền không được chia hộ
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được
    Quét phần dư sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không quét được
      ✔ P7-23: hết hạn thì thu được phần chưa ai nhận

  67 passing (570ms)
```

**67 passing, 0 failing, 0 pending.** = 13 test cũ + 54 test spec (15 P4 + 23 P7 + 16 P12).
P4-15 **không còn skip**: nợ đổi tên đã trả nên tôi bật nó mặc định (commit `d72bf88`), không
cần `EXPECT_TOKEN_SYMBOLS=1` nữa. `EXPECT_TOKEN_SYMBOLS=1 npx hardhat test` cho kết quả y hệt.

### app: typecheck / lint / vitest / e2e

```
$ npm run typecheck
> tsc --noEmit
(không output, thoát 0)

$ npx eslint .
/Users/anbinh/workSpace/bidv-rwa-tokenize/app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)

$ npm test
 RUN  v3.2.4
 ✓ test/rbac.test.ts (6 tests) 2ms
 ✓ test/receipt-timeout.test.ts (5 tests) 2ms
 ✓ test/evm-address-env.test.ts (5 tests) 5ms
 ✓ test/abi-contract-sync.test.ts (4 tests) 4ms
 ✓ test/env-private-key.test.ts (5 tests) 30ms
 ✓ test/mock-ledger.test.ts (11 tests) 5ms
 Test Files  6 passed (6)
      Tests  36 passed (36)

$ npm run test:e2e
Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/chain-selector.spec.ts:12:5 › dropdown chain có đúng các chain đã chốt, KHÔNG có Polygon (598ms)
  ✓  2 [chromium] › e2e/chain-selector.spec.ts:28:5 › đổi chain rồi mint vẫn chạy, và số dư tính theo từng chain (648ms)
  ✓  3 [chromium] › e2e/mint.spec.ts:15:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100 (525ms)
  ✓  4 [chromium] › e2e/mint.spec.ts:47:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng (449ms)
  ✓  5 [chromium] › e2e/mint.spec.ts:58:7 › Phát hành token điện gió › vai trò AUDITOR không vào được kênh ngân hàng (509ms)
  5 passed (6.8s)
```

Cảnh báo lint ở `src/empty.ts` đã có từ trước, đang nằm ở nợ P2 trong `tech-report.md` 1.6.C.

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
  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet.
```
Exit code 0.

### ⛔ docker compose up từ clone sạch — CHƯA ĐẠT, do môi trường

Clone sạch từ repo local vào `/tmp/bidv-clean-clone` ở đúng nhánh này. **Lock file có mặt**
và **`npm ci` đi qua** (đây chính là phần nợ P1 cần chứng minh):

```
Step 7/32 : RUN npm ci --no-audit --no-fund      → qua, tiếp tục tới Step 10
```

Nhưng dừng ở bước build Next:

```
Step 19/32 : RUN npm run build
> next build
▲ Next.js 16.2.7 (Turbopack)
  Creating an optimized production build ...
Killed
The command '/bin/sh -c npm run build' returned a non-zero code: 137
```

**Chẩn đoán.** 137 = bị OOM killer giết, không phải lỗi Dockerfile. Docker ở máy này chạy trên
colima được cấp **1.913 GiB / 2 CPU** trong khi host có 16 GiB:

```
$ docker info | grep -iE "total memory|cpus|name:"
 CPUs: 2
 Total Memory: 1.913GiB
 Name: colima

$ colima list
PROFILE    STATUS     ARCH       CPUS    MEMORY    DISK      RUNTIME
default    Running    aarch64    2       2GiB      100GiB    docker
```

`app/Dockerfile:40` đã đặt `--max-old-space-size=1280` và `next.config.ts` đã hạ
`staticGenerationMaxConcurrency: 2` — dấu hiệu có người từng vấp việc này rồi. Lịch sử container
cũng cho thấy lỗi cũ: `bidv-rwa-tokenize-web-1  Exited (143)`, cùng nhiều `Exited (137)` từ 6 ngày trước.

**Bằng chứng đây là giới hạn môi trường, không phải lỗi repo:**

- `next build` trên host (16 GiB) chạy xong trong ~10 s, sinh đủ 12 route:
  ```
  ✓ Compiled successfully in 5.1s
  ✓ Generating static pages using 9 workers (14/14) in 251ms
  ```
- image `chain` build thành công: `Successfully tagged bidv-clean-clone-chain:latest`

**Vì sao tôi không tự sửa.** Cách sửa là `colima stop && colima start --memory 8 --cpu 4`, nhưng
lệnh đó sẽ **giết 2 container đang chạy của Owner** (`moneyprinterturbo-api`,
`moneyprinterturbo-webui`, up 48 phút) — việc ngoài phạm vi giao việc và không thể tự hoàn tác.
Xin Owner xác nhận, xem mục 5 câu hỏi 2.

## 2. Sửa gì để Soroban biên dịch được

Supervisor dự đoán sẽ vướng lifetime ở struct `Ctx`. **Không xảy ra.** Lỗi duy nhất là tên type,
vì bộ test viết theo trạng thái repo *trước* commit `ebdcf61` (`replace SPT token to WPT token`).

| File | Lỗi gặp | Đã sửa thế nào |
|---|---|---|
| (đường dẫn cả gói) | Gói đặt file ở `contracts/spt_token/src/`, nhưng crate thật tên `wpt_token` (package `wpt-token`). Thư mục `spt_token` không có `Cargo.toml` sẽ làm `members = ["contracts/*"]` hỏng | `git mv` sang `contracts/wpt_token/src/spec_tests.rs`, xoá thư mục `spt_token` rỗng |
| `wpt_token/src/spec_tests.rs` | `E0425: cannot find type SptTokenClient` (dòng 21, 24), `E0425: cannot find value SptToken` (dòng 23) | Đổi `SptToken` → `WptToken`, `SptTokenClient` → `WptTokenClient` |
| `profit_distributor_pull/src/spec_tests.rs` | `use spt_token::{SptToken, SptTokenClient};` — crate phụ thuộc thật là `wpt-token` (đã khai trong `Cargo.toml`, module `wpt_token`) | Đổi thành `use wpt_token::{WptToken, WptTokenClient};` + 8 chỗ dùng type trong file |
| `redemption/src/spec_tests.rs` | Y như trên | Y như trên, 6 chỗ |
| `wpt_token/src/spec_tests.rs:221` | Thông điệp assert chứa chữ `SPT` nên chính script lớp 3 báo FAIL ký hiệu cũ | Đổi thông điệp thành "ký hiệu cũ trước khi đổi tên đã bỏ" — không đổi phần `assert_eq!` |

Không phải sửa import `soroban_sdk`, không phải sửa lifetime, không phải bỏ struct nào. API mà
gói dùng (`env.register`, `Client::new`, `mock_all_auths`, `try_*`) **đúng** với repo.

Ba dòng khai báo module thêm vào cuối `src/lib.rs` của `wpt_token`, `profit_distributor_pull`,
`redemption` — đúng như hướng dẫn, không đụng logic.

## 3. Đổi tên token

**Số chỗ đã đổi: 33** (đếm trên file git theo dõi trong `app/src app/e2e app/test packages docs`).

Giao việc nói "còn **264 chỗ**". Con số đó không còn đúng: phần `SPT → WPT` đã được làm ở commit
`ebdcf61` trước khi tôi nhận việc. Đo lại thực tế:

```
$ git grep -oE "\bSPT\b|tVND" -- app/src app/e2e app/test packages docs | wc -l
33
```

Phân bố và cách xử lý:

| Nhóm | Số chỗ | Xử lý |
|---|---|---|
| `packages/contracts-evm/contracts/tokens/VNDToken.sol` | 2 | **Sửa contract** (mục 4.1): `ERC20("Vietnam Dong Bank token", "VNDB")` + docstring |
| `packages/contracts-evm/20260810_huong_dan_….md` | 7 | Đổi `tVND` → `VNDB` |
| `packages/contracts-evm/README.md` | 2 | Đổi |
| `packages/contracts-evm/scripts/deploy.js`, `deploy-oracle.js` | 2 | Đổi (chuỗi log + comment tỷ giá) |
| `packages/shared/src/abi/vnd-token.ts` | 1 | Đổi (docstring) |
| `packages/contracts-evm/test/helpers/spec-fixture.js` | 2 | Viết lại comment: nợ đã trả nên bỏ mô tả "chưa xong" |
| `packages/contracts-stellar/…/wpt_token/src/spec_tests.rs` | 1 | Viết lại thông điệp assert |
| `docs/SPEC.md`, `docs/UI_REDESIGN_BRIEF.md` | 4 | Đổi — đây là chỗ dùng **sai thật** |
| `packages/contracts-evm/artifacts/build-info/*.json` | 6 | Artifact cũ (gitignore). `hardhat clean && compile` sinh lại với `VNDB` |
| `docs/tech-report.md`, `docs/tech-report-maintenance.md`, `docs/CHECKPOINT_P4_MINT_TESTNET.md`, `docs/20260910_test_pack_…/*` | 6+ | **Giữ nguyên có chủ đích** — xem mục 5 câu hỏi 3 |

**File e2e đã sửa selector: KHÔNG CÓ, vì không cần.** Giao việc cảnh báo đổi nhãn sẽ gãy
`Số lượng SPT` / `Số dư SPT` trong `app/e2e/`. Thực tế e2e đã dùng nhãn mới từ trước:

```
app/e2e/mint.spec.ts:21:    await page.getByLabel('Số lượng WPT').fill('100');
app/e2e/mint.spec.ts:31:    const balancePanel = page.getByText('Số dư WPT').locator('..');
app/e2e/chain-selector.spec.ts:32:  const balancePanel = page.getByText('Số dư WPT').locator('..');
```

`git grep -nE "\bSPT\b|tVND" -- app` → rỗng. Toàn bộ `app/` đã sạch trước khi tôi bắt đầu.

**Test P4-15 đã xanh: CÓ.** Và tôi bật nó **mặc định** thay vì phải truyền
`EXPECT_TOKEN_SYMBOLS=1`, vì món nợ nó theo dõi đã trả xong. Đổi cờ thành `=== "0"` để vẫn còn
đường tắt nếu cần.

## 4. DEVIATION (làm khác yêu cầu)

### 4.1. Sửa `VNDToken.sol` — thay đổi contract

**Làm khác gì:** đổi symbol trong constructor, vi phạm ràng buộc "không sửa contract".

```diff
- * @title VNDToken (tVND — Tokenized VND)
+ * @title VNDToken (VNDB — Vietnam Dong Bank token)
- constructor(address admin) ERC20("Tokenized VND", "tVND") {
+ constructor(address admin) ERC20("Vietnam Dong Bank token", "VNDB") {
```

**Vì sao:** Task 4b của giao việc yêu cầu tường minh "gồm cả symbol trong `VNDToken.sol`", và
P4-15 kiểm `payout.symbol() === "VNDB"` — không sửa thì DoD không thể đạt. Symbol nằm trong
constructor, không phải tham số, nên không có cách nào khác. Đây cũng đúng phương án (a) mà
`CHECKPOINT_P4_MINT_TESTNET.md` mục 5 đã đề xuất và Owner đã chốt "dùng VNDB".

**Hệ quả — phần này quan trọng:** chuỗi đổi chỉ ảnh hưởng metadata, **không đổi một dòng logic
nào**. Nhưng bản **đã deploy trên Sepolia thì không sửa được**. Muốn đồng bộ phải deploy lại
**3 contract**: `VNDToken`, và `ProfitDistributor` + `Redemption` (cả hai giữ địa chỉ VNDToken
dạng `immutable`), rồi verify lại. Tôi **không** tự deploy — tốn ETH test của Owner và đổi địa
chỉ đang ghi trong `packages/shared`. Đã ghi thành nợ P1 mới trong `tech-report.md` 1.6.C.

`ProjectToken`/WPT **không ảnh hưởng**, nên nghiệm thu P4 (mint WPT) vẫn đứng nguyên.

### 4.2. Sửa 2 chuỗi revert kỳ vọng trong test EVM

**Làm khác gì:** sửa test, trong khi ràng buộc nói test đỏ thì phải báo chứ không sửa.

```diff
- ).to.be.revertedWith("sptAmount = 0");            // spec-p12-redemption.test.js:111
+ ).to.be.revertedWith("wptAmount = 0");
- ).to.be.revertedWith("khong co SPT dang luu hanh");  // spec-p7-profit-distribution.test.js:66
+ ).to.be.revertedWith("khong co WPT dang luu hanh");
```

**Vì sao:** contract đã dùng `WPT` từ trước (`Redemption.sol:82`, `ProfitDistributor.sol:93`).
Đây là test lệch so với contract, không phải contract sai — và sửa theo hướng contract cũng là
hướng Task 4b yêu cầu. Chi tiết ở mục 6.

**Hệ quả:** không. Hai test vẫn kiểm đúng hành vi cũ, chỉ khớp lại chuỗi.

### 4.3. Nhánh tạo bằng `rebase --onto` chứ không `rebase` thường

Đã giải thích ở mục 0. Nếu làm đúng nghĩa chữ sẽ mất toàn bộ P0/P1/P4.

### 4.4. Không sửa `dev`

Giao việc không yêu cầu, và sửa `dev` (nhánh dùng chung, đã push) là việc cần Owner đồng ý.
Xem mục 5 câu hỏi 1.

### 4.5. Đổi vị trí `spec_tests.rs` của `spt_token` → `wpt_token`

Giao việc nói "không đổi tên file, không đổi cấu trúc thư mục". Nhưng thư mục `spt_token` không
tồn tại trong repo (crate tên `wpt_token`), nên giữ nguyên đường dẫn thì file thành mồ côi và
Cargo workspace hỏng. Đã `git mv`, giữ nguyên tên file.

### 4.6. Bật P4-15 mặc định

Giao việc chỉ nói "bật khi đã đổi xong" qua biến môi trường. Tôi đổi hẳn mặc định thành bật, để
`run-local-all.sh` (không truyền biến) cũng kiểm ký hiệu. Không xoá test, không nới lỏng assert.

## 5. Câu hỏi mở

### Câu hỏi 1 (P0) — `dev` đang hỏng, xử lý thế nào?

`dev` mất `packages/`, `app/src/lib/{ledger,signer,rbac,chains,config,store}`,
`docker-compose.yml`, và có lại `contracts/evm/AssetRegistry.sol` (thứ `structure.md` yêu cầu xoá).
Ai clone `dev` hôm nay sẽ không build được và không thấy 3 port kiến trúc.

- **Cách hiểu A:** `dev` cố tình được đưa về trạng thái cũ, sẽ tự dựng lại sau.
- **Cách hiểu B:** đây là tai nạn git (revert-rồi-merge), chưa ai phát hiện.

**Tôi cho là B** (commit `ac4f0b1` tên `Revert "Iteration 2/UI cleanup"` chỉ nói về UI, không
có ý xoá contract). **Đề xuất:** mở PR riêng đưa `test/spec-pack-p4-p7-p12` (hoặc `p4/mint-testnet`)
vào `dev`, hoặc `git revert ac4f0b1` trên `dev`. **Tôi chưa làm gì với `dev` và chờ xác nhận**,
vì đó là nhánh dùng chung đã push.

### Câu hỏi 2 (P1) — có được tăng RAM cho colima để nghiệm thu Docker?

Cần `colima stop && colima start --memory 8 --cpu 4`. Việc này sẽ dừng 2 container
`moneyprinterturbo-*` đang chạy của Owner.

- **Cách hiểu A:** DoD Docker là bắt buộc, cứ restart colima.
- **Cách hiểu B:** DoD Docker nhằm kiểm *lock file*, mà điều đó đã chứng minh xong ở `npm ci`;
  phần OOM là chuyện môi trường, ghi nhận là đủ.

**Đề xuất:** B trước mắt (nợ lock file đã trả và có bằng chứng), rồi Owner tự chạy lại khi
container kia rảnh. Nếu Owner nói được thì tôi restart colima và chạy lại ngay.

### Câu hỏi 3 (P2) — DoD `grep … docs/` phải rỗng là bất khả thi

DoD ghi:

```
grep -rniE "\bSPT\b|tVND" app/src app/e2e app/test packages/ docs/   # cho kết quả rỗng
```

Không bao giờ rỗng được, vì **chính câu lệnh này nằm trong `docs/`**:

- `docs/tech-report.md:547`
- `docs/tech-report-maintenance.md:23` và `:119`

Ngoài ra một số chỗ *phải* nhắc ký hiệu cũ mới có nghĩa: bảng ánh xạ `WPT | ~~SPT~~` trong
`tech-report-maintenance.md:18`, dòng cảnh báo "ký hiệu cũ đã bỏ" trong `tech-report.md:26`,
biên bản câu hỏi mở trong `CHECKPOINT_P4_MINT_TESTNET.md`, và ba file tài liệu của chính gói test.

- **Cách hiểu A:** phải xoá sạch, kể cả tài liệu ghi lại việc đổi tên (làm mất dấu vết lịch sử).
- **Cách hiểu B:** phạm vi thật là mã nguồn chạy được, không phải tài liệu kể về việc đổi tên.

**Tôi chọn B** và lấy phạm vi của `verify-arch-rules.sh` làm chuẩn (script chỉ grep
`app/src app/e2e app/test packages/`, **không** có `docs/`) — script chính là cái cổng, nên nó
là nguồn đáng tin hơn. Cổng đó hiện **PASS**. Đề xuất Supervisor sửa dòng DoD cho khớp script,
hoặc thêm loại trừ.

## 6. Sai lệch phát hiện được

### 6.1. Bộ test viết theo ảnh chụp repo cũ hơn hiện tại

Đây là sai lệch duy nhất, nhưng lặp ở 4 chỗ. Tất cả cùng một gốc: gói được viết **trước** commit
`ebdcf61` (`replace SPT token to WPT token`).

| Bộ test nói | Contract/repo thật làm | Spec yêu cầu | Xử lý |
|---|---|---|---|
| file ở `contracts/spt_token/src/` | crate là `wpt_token`, package `wpt-token` | Ký hiệu chuẩn là WPT | `git mv` sang `wpt_token` |
| `use spt_token::{SptToken, SptTokenClient}` | `wpt_token::{WptToken, WptTokenClient}` | như trên | sửa test |
| `revertedWith("sptAmount = 0")` | `Redemption.sol:82` → `require(wptAmount > 0, "wptAmount = 0")` | như trên | sửa test |
| `revertedWith("khong co SPT dang luu hanh")` | `ProfitDistributor.sol:93` → `require(supply > 0, "khong co WPT dang luu hanh")` | như trên | sửa test |

Tôi sửa **test**, không sửa contract. Điều này khớp cả với Task 4b (yêu cầu bỏ hết ký hiệu cũ)
lẫn với ràng buộc "contract đã pass test là chuẩn".

**Điều này nghĩa là gói test đã được chạy thử trên một cây mã khác với `p4/mint-testnet`.**
Supervisor báo "53 test xanh" — nếu chạy trên nhánh này thì phải thấy 2 test đỏ. Nên xác nhận
lại gói được kiểm trên commit nào, để lần sau ánh xạ đúng.

### 6.2. Con số "264 chỗ" trong giao việc

Đo thật còn 33 (mục 3). Chênh vì phần `SPT → WPT` đã xong ở `ebdcf61`.

### 6.3. `verify-arch-rules.sh` quét cả build artifact

Kiểm ký hiệu token loại trừ `node_modules` và `target/` nhưng **không** loại trừ
`packages/contracts-evm/artifacts/` (đã gitignore). Lần chạy đầu 6/23 kết quả FAIL đến từ
`artifacts/build-info/*.json` — nhiễu, không phải mã nguồn.

Tôi xử lý bằng `hardhat clean && hardhat compile` để artifact sinh lại theo symbol mới, nên hiện
đã PASS. Nhưng đề xuất thêm loại trừ cho lần sau:

```diff
- | grep -v node_modules | grep -v target/ || true)
+ | grep -v node_modules | grep -v target/ | grep -v '/artifacts/' | grep -v '/cache/' || true)
```

### 6.4. `run-local-all.sh` không chạy Playwright

Script gọi `npm run typecheck`, `npx eslint .`, `npm test` nhưng bỏ `npm run test:e2e`, trong khi
DoD đòi e2e xanh. Tôi chạy tay (5/5 pass, output ở mục 1). Có chủ đích vì e2e cần dựng dev server
chậm hơn? Nếu vậy nên ghi rõ trong script để người sau không tưởng là đã đủ.

### 6.5. Steering `testnet.md` vẫn còn RPC chết

Đã báo ở `CHECKPOINT_P4_MINT_TESTNET.md` mục 5 câu hỏi 2, **vẫn chưa được sửa**: §3 và §6 còn
giới thiệu `https://rpc.sepolia.org` (trả HTTP 404). Tôi không sửa steering của Supervisor.

### 6.6. Cảnh báo deprecated trong contract Soroban

`wpt_token/src/lib.rs` dùng `env.events().publish(...)` ở dòng 409, 450, 494; SDK 26 khuyên
`#[contractevent]`. 9 warning, không phải lỗi. Không sửa vì là logic contract. Nên ghi thành nợ P2.
