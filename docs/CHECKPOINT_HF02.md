# Báo cáo bàn giao: HF-02 kiểm thử FE-05 không dựa vào address book thật

| | |
|---|---|
| Mã task | HF-02 |
| Nhánh | `fix/hf-02-test-dia-chi-evm`, tạo từ `dev` (`07b8f27`, PR #64 đã merge) |
| Spec | `docs/hf-02-test-dia-chi-evm/{requirements,design,tasks}.md` (Supervisor soạn, kèm bản sửa) |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `fe-05-permit-order.test.ts` xanh; bỏ phần ghi đè thì ca đó đỏ lại | ✅ | mục 1 |
| 2 | Mô phỏng job A (không có artifacts) xanh | ✅ | mục 2 |

**Kết luận:** 2 ✅, 0 🔶, 0 ❌. Chỉ sửa tệp kiểm thử; không đổi mã app, hợp đồng, địa chỉ.

### 0.2 Việc cần Owner quyết

- Không có. Ghi nhận: kiểm thử đơn vị chạy trên máy có mạng có thể gọi RPC thật khi một ca đi qua chain `evm`
  không có giả lập (ca này đã gọi Sepolia thật trên CI, mục 1 dòng `HTTP request failed.`). Supervisor đưa việc
  chặn mạng trong kiểm thử đơn vị vào job D.

---

## 1. Tái hiện, kiểm thử và đột biến

Nguyên nhân: ca "chain thiếu OrderSettlement" coi `evm` là chain chưa có `OrderSettlement` bằng address book
thật. PR #64 nạp bộ Sepolia có `OrderSettlement`, nên `preparePermit` đi tiếp và đọc nonce trên Sepolia thật.
Bản sửa ghi đè riêng `findContractAddress('evm', 'OrderSettlement')` thành `undefined` trong tệp kiểm thử.

```text
$ git stash push -- app/test/fe-05-permit-order.test.ts   # tái hiện lỗi trên dev 07b8f27 (chưa sửa)
exit=0
$ (cd app && npx vitest --run test/fe-05-permit-order.test.ts)
   × FE-05 ca 1: preparePermit > mock, chain thiếu OrderSettlement và vai không có order:place đều bị chặn 1126ms
     → expected 'HTTP request failed.' to match /chưa có địa chỉ OrderSettlement/
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'HTTP request failed.' to match /chưa có địa chỉ OrderSettlement/
      Tests  1 failed | 24 passed (25)
exit=1
$ git stash pop
exit=0

$ (cd app && npx vitest --run test/fe-05-permit-order.test.ts)   # sau sửa
 Test Files  1 passed (1)
      Tests  25 passed (25)
exit=0

# đột biến: bỏ điều kiện chain === 'evm' && contract === 'OrderSettlement' (ghi đè thành không bao giờ khớp)
$ sed -i "s/chain === 'evm' \&\& contract === 'OrderSettlement'/false/" app/test/fe-05-permit-order.test.ts
exit=0
$ (cd app && npx vitest --run test/fe-05-permit-order.test.ts)
   × FE-05 ca 1: preparePermit > mock, chain thiếu OrderSettlement và vai không có order:place đều bị chặn 1120ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 24 passed (25)
exit=1
$ git checkout -- app/test/fe-05-permit-order.test.ts && git apply 0001-...patch  # hoàn nguyên đúng phần sửa
exit=0
$ git diff --stat
 .kiro/task-status.json              |  1 +
 app/test/fe-05-permit-order.test.ts | 15 +++++++++++++++
 2 files changed, 16 insertions(+)
```

## 2. Mô phỏng job A

```text
$ ( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"; trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT; bash scripts/run-local-all.sh arch markers checkpoint app )
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     OP-05 · docs/CHECKPOINT_OP05.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  57 passed | 9 skipped (66)
      Tests  1093 passed | 83 skipped (1176)
  => PASS: APP - VITEST
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  => ĐẠT các phần đã chạy: arch markers checkpoint app
jobA exit=0
artifacts đã phục hồi
```
