# SC-10: Vá hợp đồng chia lợi nhuận và đường cưỡng chế của WPT

| | |
|---|---|
| Nhánh | `fix/sc-10-va-hop-dong`, từ `dev` @ `ecc3450` (PR #52, SC-09) |
| Điểm | 3,5 (CH-1 đã được Owner duyệt ngày 19/10/2026) |
| Mức kiểm chứng | **Cao** (hợp đồng giữ tiền, lỗi đã tái hiện) |
| Thứ tự | Trước SC-07. Chủ dự án **chưa** triển khai lại Sepolia sau SC-09; triển khai một lần sau khi SC-10 merge |
| Căn cứ | DS-01 bản 3: QĐ-18 và mục "Lỗi đã xác nhận" (mục 8) |

## Mục tiêu

1. `ProfitDistributor` không bao giờ chi vượt quỹ của một kỳ, và không chi được nữa khi kỳ đã đóng hoặc
   đã hết hạn nhận.
2. Hạn nhận của mỗi kỳ cố định từ lúc tạo kỳ; quản trị đổi `claimWindow` chỉ áp cho kỳ tạo sau.
3. Đường cưỡng chế của `ProjectToken` (`forcedTransfer`, `batchForcedTransfer`, `burn` của agent) vẫn bỏ
   qua kiểm tra `canTransfer` nhưng **báo lại** bộ luật (`transferred`, `destroyed`), để module có lưu
   trạng thái không bị lệch.

## Hiện trạng đã đo (Supervisor, `dev` @ `ecc3450`)

```bash
sed -n 156,170p packages/contracts-evm/contracts/ProfitDistributor.sol
# _claim: chỉ kiểm id tồn tại và hasClaimed; KHÔNG kiểm kỳ đã quét, đã hết hạn, hay claimed + amount <= d.amount
sed -n 175,190p packages/contracts-evm/contracts/ProfitDistributor.sol
# sweepDust: đặt d.claimed = d.amount; hạn tính bằng d.createdAt + claimWindow (claimWindow đọc lúc gọi)
grep -n "_forcedMove" packages/contracts-evm/contracts/tokens/ProjectToken.sol
# 278: nhánh _forcedMove gọi super._update rồi return, không gọi compliance
grep -n "createDistribution" packages/contracts-evm/contracts/ProfitDistributorOracle.sol
# 70: lớp con gọi lại createDistribution (QĐ-11: không dùng trong bản thử nhưng vẫn phải biên dịch, kiểm thử xanh)
```

**Tái hiện lỗi** (Supervisor chạy trên Hardhat với fixture `spec-fixture.js`): kỳ A 100 VNDB; qua 181 ngày;
`sweepDust(A)`; tạo kỳ B 100 VNDB; nhà đầu tư chưa nhận kỳ A gọi `claim(A)`: nhận **100** VNDB, kỳ A ghi
`claimed/amount = 200/100`, quỹ hợp đồng còn **0** (mất trọn tiền kỳ B).

Ứng dụng chưa gọi `claim`, `sweepDust`, `distributions()` trên chain EVM (luồng chia chưa nối, đóng ở SC-06),
nên thay đổi phía app chỉ là đồng bộ ABI.

## Quyết định thiết kế

**QĐ-1. Trạng thái của một kỳ trong `ProfitDistributor`.**
- `Distribution` thêm `uint64 claimDeadline` (bằng `block.timestamp + claimWindow` lúc tạo kỳ) và
  `bool closed`.
- `_claim` (dùng chung cho `claim`, `claimMany`, `distributeTo`) **revert** khi kỳ đã đóng
  (`DistributionClosed`) hoặc `block.timestamp >= claimDeadline` (`ClaimWindowEnded`). Revert chứ không trả
  0, để một lô `distributeTo` vào kỳ đã đóng không âm thầm "thành công".
- **Bất biến:** trước khi chuyển, `d.claimed + amount <= d.amount`, không thoả thì revert
  (`DistributionOverdrawn`). Đây là lớp phòng thủ thứ hai, độc lập với kiểm tra đóng kỳ.
- `sweepDust`: chỉ chạy khi `block.timestamp >= claimDeadline`; **đóng kỳ** (`closed = true`); chuyển phần
  còn lại nếu lớn hơn 0. Kỳ đã chi hết vẫn đóng được (bỏ điều kiện "khong con du"). Gọi lại trên kỳ đã đóng
  thì revert.
- Phát sự kiện `DistributionClosed(id, sweptAmount)`. Giữ `DustSwept` nếu có chuyển tiền.
- `setClaimWindow` chỉ ảnh hưởng kỳ tạo sau. Ghi rõ trong NatSpec.
- Dùng lỗi tuỳ biến cho các điều kiện mới. Không đổi tên, tham số các hàm công khai đang có.
- `ProfitDistributorOracle` phải biên dịch được và bộ `oracle-cycle.test.js` xanh.

**QĐ-2. Đường cưỡng chế báo lại bộ luật (QĐ-18 của DS-01).**
- Trong nhánh `_forcedMove` của `_update`: gọi `super._update` rồi gọi `compliance.transferred` (chuyển)
  hoặc `compliance.destroyed` (đốt). **Không** gọi `canTransfer`, **không** kiểm `isVerified` bên gửi.
  `forcedTransfer` vẫn kiểm bên nhận `isVerified` như hiện nay.
- Chưa gắn bộ luật mà gọi đường cưỡng chế: revert `ComplianceNotSet`, giống đường thường.
- Không đổi chữ ký hàm, không đổi sự kiện.

**QĐ-3. Module kiểm thử có trạng thái.** Thêm `contracts/test/HolderCountModule.sol` (chỉ dùng trong kiểm
thử, không triển khai): đếm số ví có số dư lớn hơn 0 qua `moduleMintAction`, `moduleTransferAction`,
`moduleBurnAction`, đọc số dư từ token. Dùng để chứng minh QĐ-2.

**QĐ-4. Triển khai.** Hai hợp đồng đổi bytecode: `ProfitDistributor`, `ProjectToken`. Thứ tự triển khai
trong `deploy.js` giữ nguyên, nên địa chỉ hardhat-local không đổi. Runbook Sepolia của SC-09 dùng lại
nguyên, không thêm bước.

## Việc cần làm

1. Sửa `ProfitDistributor` theo QĐ-1.
2. Sửa `ProjectToken._update` theo QĐ-2.
3. Thêm `HolderCountModule` (QĐ-3) và tệp kiểm thử `test/sc-10-va-hop-dong.test.js`.
4. Cập nhật ABI dùng chung (`packages/shared`), kiểm thử đồng bộ ABI.
5. Cập nhật `docs/tech-report.md`: đóng lỗi chi vượt quỹ; ghi luật module có trạng thái (QĐ-18).
6. Thêm `SC-10` vào `.kiro/task-status.json`.
7. Nếu CH-1 được duyệt: thêm trần nguồn cung theo CH-1.

## Ràng buộc

- Không sửa vault, hợp đồng khớp lệnh (chưa có), `Redemption`, `IdentityRegistry`, `ModularCompliance`.
- Không đổi chữ ký các hàm công khai đang có; chỉ thêm trường vào struct, lỗi, sự kiện.
- Không thêm thư viện. Không triển khai Sepolia. Không commit khoá riêng.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (`efficiency.md`).

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **Tái hiện lỗi:** đúng kịch bản ở "Hiện trạng" (kỳ A quét, tạo kỳ B, `claim(A)`). Sau sửa: `claim(A)` revert `DistributionClosed`; số dư VNDB của hợp đồng vẫn đủ 100 cho kỳ B; kỳ B chi đúng |
| 2 | `distributeTo` vào kỳ đã đóng revert cả lô; không ví nào nhận tiền |
| 3 | Qua `claimDeadline` nhưng chưa quét: `claim` và `distributeTo` revert `ClaimWindowEnded` |
| 4 | `sweepDust` trước hạn revert; sau hạn đóng kỳ và chuyển phần còn lại; kỳ đã chi hết vẫn đóng được; gọi lần hai revert |
| 5 | Đổi `claimWindow` sau khi tạo kỳ A: hạn kỳ A không đổi; kỳ B tạo sau dùng hạn mới |
| 6 | Hai kỳ mở cùng lúc: mỗi ví nhận đúng phần của từng kỳ; tổng chi mỗi kỳ không vượt quỹ kỳ đó; tổng số dư hợp đồng khớp phần chưa chi của các kỳ |
| 7 | `HolderCountModule` gắn khi chưa có người nắm giữ: sau mint, chuyển, `forcedTransfer` sang ví mới, `burn` của agent hết số dư một ví, `batchForcedTransfer`, số người nắm giữ module đếm **khớp** số ví có số dư thực tế |
| 8 | Gắn `RejectAllModule`: đường thường bị chặn, **đường cưỡng chế vẫn chạy** (không gọi `canTransfer`) |
| 9 | Chưa gắn bộ luật: đường cưỡng chế revert `ComplianceNotSet` |
| 10 | Bộ cũ xanh, không nới điều kiện: `spec-p7-profit-distribution`, `full-cycle`, `oracle-cycle`, `sc-09-erc3643`, `sc-02-issuance`, `spec-p4-mint`, `spec-p12-redemption` |
| 11 | Đột biến, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ **cả** kiểm đóng kỳ **và** bất biến, ca 1 đỏ; (b) bỏ kiểm hạn, ca 3 đỏ; (c) cho `sweepDust` chạy trước hạn, ca 4 đỏ; (d) hạn đọc `claimWindow` lúc gọi thay vì lưu theo kỳ, ca 5 đỏ; (e) nhánh cưỡng chế không gọi `transferred` hoặc `destroyed`, ca 7 đỏ; (f) nhánh cưỡng chế gọi `canTransfer`, ca 8 đỏ |
| 12 | App: đồng bộ ABI xanh; `run-local-all.sh` xanh; **mô phỏng job A** (dời `packages/contracts-evm/artifacts` đi rồi chạy `run-local-all.sh arch markers checkpoint app`) xanh; `evm-issuance.test.ts` trên nút Hardhat thật xanh |

## Điều kiện hoàn thành

- [ ] `ProfitDistributor` theo QĐ-1; lỗi tái hiện bị chặn (ca 1 đến 6).
- [ ] Đường cưỡng chế báo lại bộ luật, không kiểm `canTransfer` (ca 7 đến 9).
- [ ] Bộ cũ xanh không nới điều kiện (ca 10).
- [ ] Đột biến đỏ đúng ca (ca 11).
- [ ] App, mô phỏng job A, nút Hardhat thật xanh (ca 12); quét bí mật sạch.
- [ ] Tài liệu, `task-status.json` cập nhật.
- [ ] **[Chủ dự án, sau merge]** Triển khai lại Sepolia một lần theo runbook SC-09; đăng ký ví SPV; deploy
      lại Worker; duyệt Mint đầu, ghi mã giao dịch.

## Câu hỏi cho chủ dự án

| Mã | Câu hỏi | Đề xuất của Supervisor |
|---|---|---|
| CH-1 | Đưa **trần nguồn cung 20.000.000 WPT** lên hợp đồng? Hiện chỉ ứng dụng kiểm. Nếu có: tham số `cap` cố định lúc triển khai, `mintInitialSupply` và `mint` revert khi tổng cung vượt trần | **Có**, 0,5 điểm, tiện làm cùng lần triển khai lại. **Nếu chưa có trả lời khi bắt đầu thì không làm**, ghi vào checkpoint |

## Không làm

- Nối luồng chia lợi nhuận EVM vào ứng dụng (`createDistribution` thay `takeSnapshot`): thuộc SC-06.
- Vault, khớp lệnh, giao diện.
- Tạm dừng `ProfitDistributor`.


## CH-1 — Owner chốt ngày 19/10/2026

Đưa trần **20.000.000 WPT** lên hợp đồng, cố định khi triển khai. Áp dụng cho `mintInitialSupply`
và `mint`; kiểm tổng cung hiện tại cộng lượng phát hành không vượt cap. Cập nhật tham số constructor,
các script deploy/ước phí, fixture, ABI và kiểm thử theo thay đổi này; đây là ngoại lệ được duyệt
cho ràng buộc giữ chữ ký constructor. Không có hàm đổi cap sau triển khai. Nguồn cung hiện hành sau
burn được phép mint bù trong cap; cờ phát hành lần đầu vẫn bất biến theo SC-02.
