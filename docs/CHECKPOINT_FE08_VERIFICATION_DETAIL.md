# FE-08: chi tiết kiểm chứng

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mọi khối dưới đây là đầu ra của lệnh ghi ở
dòng đầu khối (bỏ mã màu terminal; khối quá 400 dòng chỉ giữ dòng lệnh và dòng kết quả), theo thứ tự
`docs/fe-08-duyet-chia-loi-nhuan/tasks.md` bước 4, nhánh `feat/fe-08-duyet-chia` (nền `dev` @ `dd00e12`).
Mục 1 đến 7 và 10 đến 12 chạy trên mã của commit `174ff9e` (cộng tài liệu chưa commit, sau đó vào
`ea9c6f1` chỉ gồm `docs/`). Lần chạy đầu mục 8, 9 đỏ vì máy chủ Postgres của sandbox đã tắt sau khi
phiên khởi động lại ("Connection refused"); bật lại Postgres rồi chạy lại mục 8, 9 trên `ea9c6f1`, đầu ra
dưới đây là lần chạy lại. Mã thoát ở dòng `exit=` cuối khối. Môi trường: `USE_LOCAL_SOLC=1`; Postgres 16
cục bộ. Kiểm thử nút thật chạy TỪNG TỆP một lệnh, reset chuỗi trước mỗi tệp, không kèm `--testTimeout`.

## 1. Hợp đồng

```text
$ cd packages/contracts-evm && npx hardhat test
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }


  BE-13 - bảng số khoá vault dùng chung với mock
    ✔ op05: Bảng số OP-05: PERCENT 20%, mua 100, bán 40, chốt kỳ 1.000.000, rút 50%. Giá 100.000 VNDB/WPT. (1346ms)
    ✔ rounding-pending: Làm tròn xuống như Math.mulDiv, netProceeds chặn ở 0 khi bán theo giá cao hơn, FIXED đổi sang PERCENT trước kỳ đầu, tỷ lệ chờ sau kỳ đầu, khoá vượt số dư. (227ms)

  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần (39ms)
    ✔ Đóng kỳ: sau thời hạn nhận, phần chưa nhận trở về quỹ chưa phân bổ (61ms)
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung (39ms)
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó (48ms)

  OP-04 — cấp phí Sepolia
    ✔ từ chối chain khác Sepolia trước khi có thể ký
    ✔ từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường
    ✔ chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên
    ✔ đủ số dư thì không tạo signer và không gửi
    ✔ --dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch
    ✔ gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt
    ✔ tham số phải chọn một chế độ và số ETH phải dương
    ✔ phân loại lỗi an toàn, không lộ URL hay thân lỗi RPC
    ✔ báo riêng thiếu khóa cấp phí
    ✔ báo riêng số dư tài khoản tổng không đủ

  OP-04 — preflight phí ví ký
    ✔ thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu
    ✔ báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng Mint/Mint/Burn

  Oracle sản lượng điện + chia lợi nhuận theo công thức
    ✔ Công thức lợi nhuận: gross = kWh×giá, net = gross−opex, chia = net×share
    ✔ Đa xác nhận: cần đủ 2 reporter khớp số liệu mới chốt; số liệu lệch bị từ chối
    ✔ Tạo đợt chia từ oracle rồi nhà đầu tư nhận đúng theo tỷ lệ nắm giữ
    ✔ Không chia được khi oracle chưa chốt, và không chia trùng một kỳ
    ✔ opex vượt doanh thu => lợi nhuận chia = 0 (không âm)

  SC-02 - Phát hành EVM khóa theo ví SPV
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (95ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SC-03 - OrderSettlement
    ✔ ca 1: triển khai nối đúng vault, token, giá và matcher duy nhất (156ms)
    ✔ ca 2: mua chuyển đủ hai chân, chỉ vault phát OrderSettled và matcher không giữ tiền
    ✔ ca 3: bán chuyển đủ hai chân và giảm thu ròng
    ✔ ca 4: giá đổi giữa đặt và khớp bị từ chối trước khi chuyển
    ✔ ca 5: đổi giá cần vai, cấm zero và phát đúng sự kiện
    ✔ ca 6: gửi lại mua, mua permit và bán đều báo OrderAlreadySettled đầu tiên (69ms)
    ✔ ca 7: bốn lỗi chiều mua hoàn nguyên cả hai chân (55ms)
    ✔ ca 8: bốn lỗi chiều bán hoàn nguyên cả hai chân (52ms)
    ✔ ca 9: phần khoá lớn hơn số dư không chặn bán lại
    ✔ ca 10: permit VNDB chạy, ràng buộc value và bỏ qua permit đã dùng (43ms)
    ✔ ca 11: permit WPT chạy và chữ ký gửi trước vẫn dùng được
    ✔ ca 12: pause chặn bốn đường lệnh nhưng không chặn giá hay vault (38ms)
    ✔ ca 13: bốn đường lệnh và pause đều bị chặn đúng vai
    ✔ ca 14: thay phiên bản giữ dấu orderRef ở vault (45ms)
    ✔ ca 15: module gọi lồng sell bị đúng ReentrancyGuardReentrantCall

  SC-06 - ProfitDistributor: quỹ chia một chiều
    ✔ ca 1: tạo kỳ từ quỹ lấy đúng phần chưa phân bổ, tra được theo nhãn (123ms)
    ✔ ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert (86ms)
    ✔ ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền (58ms)
    ✔ ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được (47ms)
    ✔ ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0
    ✔ ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia
    ✔ ca 7: bất biến sổ dự trữ sau mỗi bước của một chuỗi ngẫu nhiên có hạt giống cố định (650ms)
    ✔ ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3 (52ms)
    ✔ ca 9: phần của SPV vào vault, netProceeds của vault không đổi (140ms)

  SC-07 - công cụ an toàn
    ✔ ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu

  SC-07 - SpvPaymentVault: luật khoá và quyết toán
    ✔ ca 1: triển khai an toàn ở UNSET và chưa cấp matcher (123ms)
    ✔ ca 2: PERCENT kỳ đầu bám theo thu ròng sau từng lệnh (195ms)
    ✔ ca 3: thu ròng dừng ở 0 thay vì âm
    ✔ ca 4: FIXED không chặn mua lại và số rút được chặn ở 0
    ✔ ca 5: chốt kỳ lưu phần khoá và không đổi sau lệnh mới
    ✔ ca 6: tỷ lệ sau chốt chỉ áp ở kỳ tiếp theo
    ✔ ca 7: trước lần chốt đầu tỷ lệ mới có hiệu lực ngay
    ✔ ca 8: FIXED hiệu lực ngay và không thể quay về UNSET
    ✔ ca 9: mã kỳ tuần tự ở mọi chế độ
    ✔ ca 10: tỷ lệ tối đa và mulDiv xử lý số lớn
    ✔ ca 11: orderRef dùng đúng một lần cho cả hai chiều
    ✔ ca 12: số lượng, giá và thành tiền phải khớp
    ✔ ca 13: mọi hàm ghi được chặn đúng vai
    ✔ ca 14: chỉ rút phần được phép tới ví nhận đã xác minh
    ✔ ca 15: pause chỉ chặn rút, không chặn quyết toán và chốt kỳ

  SC-07 - SpvPaymentVault: nguyên tử và tương tác hợp đồng
    ✔ ca 16: matcher kéo chân vào và quyết toán nguyên tử (182ms)
    ✔ ca 17: vault phải đăng ký danh tính trước mint và chân WPT vào (151ms)
    ✔ ca 18: lợi nhuận phần SPV tăng số dư/rút được nhưng không đổi thu ròng
    ✔ ca 19: agent WPT và burner VNDB vẫn chạm được tài sản vault
    ✔ ca 20: module gọi lồng làm hoàn nguyên toàn bộ settleBuy

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh (47ms)
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua (41ms)
      ✔ chỉ token đã gắn gọi được ba action (50ms)
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực (72ms)
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay (79ms)
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được (71ms)
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng (82ms)
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được (64ms)
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ (47ms)
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay (59ms)
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance (106ms)

  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (140ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: đóng kỳ chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được (38ms)
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (149ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (110ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (124ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (112ms)
    ✔ cap: không cho triển khai cap bằng 0

  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng (43ms)
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm
      ✔ P12-7: tất toán một phần thì phần còn lại vẫn giữ
      ✔ P12-8: thanh khoản kho giảm đúng số đã trả
    Các ca bị chặn
      ✔ P12-9: đang tạm dừng thì không tất toán được
      ✔ P12-10: số lượng 0 bị từ chối
      ✔ P12-11: ví chưa KYC không tất toán được
      ✔ P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT (41ms)
      ✔ P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM)
      ✔ P12-14: approve thiếu so với số muốn tất toán thì thất bại
    Rút thanh khoản
      ✔ P12-15: MANAGER rút được VNDB dư khỏi kho
      ✔ P12-16: ví không có quyền không rút được kho

  SPEC P4 - Phát hành WPT
    Whitelist (điều kiện tuân thủ trước khi phát hành)
      ✔ P4-1: AGENT đăng ký được ví, isVerified phản ánh đúng
      ✔ P4-2: whitelist theo lô cho nhiều ví cùng lúc
      ✔ P4-3: ví KHÔNG có AGENT_ROLE không được whitelist
    Mint
      ✔ P4-4: phát hành lần đầu vào SPV đã whitelist làm tăng số dư và tổng cung
      ✔ P4-5: phát hành lần đầu vào SPV CHƯA whitelist bị chặn
      ✔ P4-6: ví KHÔNG có MINTER_ROLE không mint được
      ✔ P4-7: mint 0 sau lần đầu không làm đổi tổng cung
    Đóng băng và tạm dừng (ràng buộc tuân thủ)
      ✔ P4-8: ví bị đóng băng không nhận được token phát hành
      ✔ P4-9: khi tạm dừng toàn hệ thì không phát hành được
      ✔ P4-10: chuyển nhượng đòi CẢ HAI đầu đã whitelist (45ms)
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
      ✔ P7-3: amount = 0 bị từ chối (38ms)
      ✔ P7-4: không có token đang lưu hành thì không tạo được kỳ
      ✔ P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ (40ms)
      ✔ P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp) (41ms)
    Tính phần chia theo snapshot
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt (42ms)
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó (45ms)
      ✔ P7-9: ví không nắm giữ token được chia 0 (38ms)
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận (44ms)
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng
      ✔ P7-12: nhận lần hai không trả thêm tiền (49ms)
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư (39ms)
      ✔ P7-15: ví không có quyền không được chia hộ (41ms)
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia (41ms)
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle (58ms)
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia (47ms)
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần (57ms)
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng) (47ms)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được (41ms)
    Đóng kỳ sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không đóng được
      ✔ P7-23: hết hạn thì phần chưa ai nhận trở về quỹ chưa phân bổ (59ms)


  158 passing (9s)

exit=0
```

## 2. run-local-all.sh (bộ mặc định)

```text
$ bash scripts/run-local-all.sh
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (36 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
KHÔNG SỬA CONTRACT ĐÃ PASS TEST
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
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
    ✔ Công thức lợi nhuận: gross = kWh×giá, net = gross−opex, chia = net×share
  158 passing (9s)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 ✓ test/postgres-request-client.test.ts (6 tests) 595ms
   ✓ khởi tạo nhanh trên Client của request > lược đồ và seed đủ thì không BEGIN, không INSERT và chỉ dùng một Client  351ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 379ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 464ms
 ✓ test/fe-08-approval.test.ts (30 tests) 129ms
 ✓ test/distribution-service.test.ts (43 tests) 201ms
 ✓ test/seller-channel.test.ts (10 tests) 201ms
 ✓ test/investor-trading.test.ts (20 tests) 227ms
 ✓ test/demo-payment.test.ts (19 tests) 194ms
 ✓ test/ops-transactions.test.ts (7 tests) 144ms
 ✓ test/fe-05-permit-order.test.ts (25 tests) 299ms
 ✓ test/token-request.test.ts (22 tests) 142ms
 ✓ test/config-service.test.ts (31 tests) 183ms
 ✓ test/purchase-service.test.ts (88 tests) 133ms
 ✓ test/issuance-service.test.ts (27 tests) 119ms
 ✓ test/distribution-trigger.test.ts (46 tests) 109ms
 ✓ test/be-13-vault-config.test.ts (42 tests | 3 skipped) 110ms
 ✓ test/sc-06-distribution-flow.test.ts (15 tests) 90ms
 ✓ test/mock-ledger.test.ts (63 tests) 71ms
 ✓ test/be-13-withdraw.test.ts (35 tests | 3 skipped) 75ms
 ✓ test/store-constraints.test.ts (130 tests) 114ms
 ✓ test/env-private-key.test.ts (9 tests) 77ms
 ✓ test/account-info.test.ts (8 tests) 76ms
 ✓ test/init-sql-generated.test.ts (1 test) 62ms
 ✓ test/pending-markers.test.ts (24 tests) 62ms
 ✓ test/check-checkpoint.test.ts (21 tests) 43ms
 ✓ test/rbac.test.ts (68 tests) 42ms
 ✓ test/be-13-seller.test.ts (4 tests) 57ms
 ✓ test/be-13-mock-vault.test.ts (11 tests) 39ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 39ms
 ✓ test/token-info-read.test.ts (8 tests) 30ms
 ✓ test/portfolio-service.test.ts (12 tests) 23ms
 ✓ test/fe-08-store.test.ts (10 tests | 1 skipped) 25ms
 ✓ test/token-info-route.test.ts (6 tests) 24ms
 ✓ test/wallet-status.test.ts (30 tests) 24ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 17ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 25ms
 ✓ test/four-roles-routes.test.ts (22 tests) 24ms
 ✓ test/mock-ledger-state-store.test.ts (13 tests | 6 skipped) 22ms
 ✓ test/server-signer.test.ts (4 tests) 19ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 26ms
 ✓ test/four-roles-shell.test.ts (19 tests) 20ms
 ✓ test/account-profile.test.ts (9 tests) 19ms
 ✓ test/seller-vault.test.ts (2 tests) 14ms
 ✓ test/abi-contract-sync.test.ts (16 tests) 17ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 17ms
 ✓ test/fe-05-permit-domain.test.ts (9 tests) 25ms
 ✓ test/purchase-state.test.ts (19 tests) 18ms
 ✓ test/receipt-timeout.test.ts (5 tests) 12ms
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 11ms
 ✓ test/build-info.test.ts (6 tests) 8ms
 ✓ test/order-ref.test.ts (3 tests) 5ms
 ✓ test/evm-address-env.test.ts (5 tests) 7ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 4ms
 Test Files  53 passed | 8 skipped (61)
      Tests  1063 passed | 75 skipped (1138)
  => PASS: APP - VITEST
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
   9  app/src/lib/bank/purchase.service.ts:1513  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
```

## 3. Mô phỏng job A, dời artifacts có trap

```text
$ (
  set -e
  BAK="$(mktemp -d)"
  mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app
); rc=$?; test -d packages/contracts-evm/artifacts && echo "artifacts đã phục hồi"; exit $rc

########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########

LUẬT 1 - Mọi tương tác chain đi qua ILedgerPort
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/

LUẬT 2 - Mọi thao tác ký đi qua ISigner
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):
        app/src/lib/ledger/postgres-mock-state.store.ts:85:      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        app/src/lib/signer/index.ts:40:  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn

LUẬT 3 - Mọi kiểm quyền đi qua RBAC can()
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (36 -> 37 hành động)

MỘT NGUỒN SỰ THẬT - ABI và địa chỉ contract
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  WARN  Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):
        app/src/components/pages/mint.tsx:199:                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        app/src/components/pages/mint.tsx:205:                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
        app/src/lib/signer/server.signer.ts:24:      account = { address: '0x0000000000000000000000000000000000000001', type: 'json-rpc' };
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
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)

TỔNG KẾT
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc

########## LỚP 3 - ĐIỂM CẮM (marker) ##########
Marker hợp lệ: 10 điểm cắm, 4 điểm chặn, 45 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 3 - KHUÔN CHECKPOINT ##########
BỎ QUA  FE-08: chưa có docs/CHECKPOINT_FE08.md — chưa viết thì chưa kiểm được khuôn.
  => PASS: LỚP 3 - KHUÔN CHECKPOINT

########## APP - TYPECHECK ##########

> app@0.1.0 typecheck
> tsc --noEmit

  => PASS: APP - TYPECHECK

########## APP - LINT ##########
  => PASS: APP - LINT

########## APP - VITEST ##########

> app@0.1.0 test
> vitest --run


 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/postgres-init-isolation.test.ts (5 tests) 591ms
   ✓ khởi tạo Postgres không chờ I/O của lượt khác > A chưa xong nhưng B vẫn đọc được bằng Client riêng  407ms
 ✓ test/postgres-request-client.test.ts (6 tests) 588ms
   ✓ khởi tạo nhanh trên Client của request > lược đồ và seed đủ thì không BEGIN, không INSERT và chỉ dùng một Client  361ms
 ✓ test/investor-trading.test.ts (20 tests) 310ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 662ms
 ✓ test/fe-05-permit-order.test.ts (25 tests) 322ms
 ✓ test/seller-channel.test.ts (10 tests) 154ms
 ✓ test/demo-payment.test.ts (19 tests) 156ms
 ✓ test/distribution-service.test.ts (43 tests) 263ms
 ✓ test/config-service.test.ts (31 tests) 184ms
 ✓ test/ops-transactions.test.ts (7 tests) 137ms
 ✓ test/token-request.test.ts (22 tests) 154ms
 ✓ test/purchase-service.test.ts (88 tests) 141ms
 ✓ test/issuance-service.test.ts (27 tests) 125ms
 ✓ test/fe-08-approval.test.ts (30 tests) 112ms
 ✓ test/store-constraints.test.ts (130 tests) 76ms
 ✓ test/be-13-vault-config.test.ts (42 tests | 3 skipped) 123ms
 ✓ test/distribution-trigger.test.ts (46 tests) 125ms
 ✓ test/sc-06-distribution-flow.test.ts (15 tests) 83ms
 ✓ test/env-private-key.test.ts (9 tests) 48ms
 ✓ test/account-info.test.ts (8 tests) 53ms
 ✓ test/init-sql-generated.test.ts (1 test) 75ms
 ✓ test/mock-ledger.test.ts (63 tests) 54ms
 ✓ test/be-13-withdraw.test.ts (35 tests | 3 skipped) 74ms
 ✓ test/pending-markers.test.ts (24 tests) 58ms
 ✓ test/check-checkpoint.test.ts (21 tests) 50ms
 ✓ test/rbac.test.ts (68 tests) 47ms
 ✓ test/be-13-seller.test.ts (4 tests) 40ms
 ✓ test/token-info-read.test.ts (8 tests) 23ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 30ms
 ✓ test/be-13-mock-vault.test.ts (11 tests) 27ms
 ✓ test/fe-08-store.test.ts (10 tests | 1 skipped) 19ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 27ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 16ms
 ✓ test/wallet-status.test.ts (30 tests) 23ms
 ✓ test/fe-05-permit-domain.test.ts (9 tests) 9ms
 ✓ test/token-info-route.test.ts (6 tests) 23ms
 ✓ test/four-roles-routes.test.ts (22 tests) 13ms
 ✓ test/portfolio-service.test.ts (12 tests) 38ms
 ✓ test/mock-ledger-state-store.test.ts (13 tests | 6 skipped) 25ms
 ✓ test/four-roles-shell.test.ts (19 tests) 12ms
 ✓ test/account-profile.test.ts (9 tests) 10ms
 ✓ test/purchase-state.test.ts (19 tests) 17ms
 ✓ test/server-signer.test.ts (4 tests) 14ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 9ms
 ✓ test/abi-contract-sync.test.ts (16 tests) 17ms
 ✓ test/receipt-timeout.test.ts (5 tests) 3ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 20ms
 ✓ test/seller-vault.test.ts (2 tests) 11ms
 ✓ test/build-info.test.ts (6 tests) 9ms
 ✓ test/evm-address-env.test.ts (5 tests) 6ms
 ✓ test/order-ref.test.ts (3 tests) 4ms
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 8ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 2ms
 ↓ test/be-13-postgres-upgrade.test.ts (1 test | 1 skipped)
 ↓ test/be-13-vault-evm.test.ts (5 tests | 5 skipped)
 ↓ test/evm-order-settlement.test.ts (10 tests | 10 skipped)
 ↓ test/fe-05-permit-evm.test.ts (8 tests | 8 skipped)
 ↓ test/fe-05-permit-postgres.test.ts (2 tests | 2 skipped)
 ↓ test/postgres-seed.test.ts (1 test | 1 skipped)
 ↓ test/fe-08-approval-evm.test.ts (8 tests | 8 skipped)
 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)

 Test Files  53 passed | 8 skipped (61)
      Tests  1063 passed | 75 skipped (1138)
   Start at  18:42:59
   Duration  14.64s (transform 2.95s, setup 0ms, collect 20.54s, tests 5.22s, environment 12ms, prepare 4.73s)

  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint app
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:220  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-09  (2 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:65  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-05 đã dùng hàm này để ký permit (`wallet-permit.ts`); FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:302  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1109  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1115  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1120  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1126  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (24 bước)
   1  app/src/app/actions/distribution.ts:29                 nhận yêu cầu xem tổng quan màn chia: quỹ, dự kiến, kỳ hoạt động  ::getDistributionOverviewAction
   2  app/src/lib/bank/distribution-approval.service.ts:576  kiểm quyền reconcile:read, đọc quỹ, dự kiến theo shareOf trên số dư hiện tại, kỳ hoạt động và lý do chưa duyệt được  ::getDistributionOverview
   3  app/src/app/actions/distribution.ts:34                 nhận lần duyệt chia của Kiểm soát viên kèm số VNDB đã xem trên màn  ::approveDistributionAction
   4  app/src/lib/bank/distribution-approval.service.ts:271  kiểm quyền distribution:approve, chain phải có vault, số duyệt phải bằng phần chưa phân bổ, giữ chỗ kỳ OPENING một kỳ hoạt động mỗi chain, mở trên chuỗi rồi so số thực tế  ::approveDistribution
   5  app/src/lib/bank/distribution.service.ts:335           dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
   7  app/src/lib/bank/distribution.service.ts:472           so số thực tế của kỳ trên chuỗi với số đã duyệt: đúng thì APPROVED, khác thì AMOUNT_CHANGED và dừng  ::decideApproval
   8  app/src/app/actions/distribution.ts:39                 nhận lần duyệt lại số thực tế trên chuỗi của kỳ AMOUNT_CHANGED hoặc kỳ cũ chưa duyệt  ::reapproveDistributionAction
   9  app/src/lib/bank/distribution-approval.service.ts:392  kiểm quyền distribution:approve, kỳ AMOUNT_CHANGED hoặc chưa duyệt, số duyệt lại phải bằng đúng số trên chuỗi, ghi APPROVED rồi chia  ::reapproveDistribution
  10  app/src/app/actions/distribution.ts:44                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:464  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  12  app/src/lib/bank/distribution-trigger.service.ts:479   chiếm số vòng KeeperRun kèm nguồn MANUAL hoặc KEEPER, chạy lõi một lượt chia, đóng vòng và ghi sổ  ::runApprovedPeriod
  13  app/src/lib/bank/distribution.service.ts:1169          lõi một lượt chia: kỳ phải APPROVED, chốt kỳ vault phải DONE rồi mới lập hồ sơ chờ, đối soát đã trả và gửi từng lô  ::runDistributionRound
  14  app/src/lib/bank/distribution.service.ts:804           đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose
  15  app/src/lib/bank/distribution.service.ts:261           đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
  16  app/src/lib/bank/distribution-trigger.service.ts:382   ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  17  app/src/lib/bank/distribution-trigger.service.ts:603   chạy một vòng keeper: dọn kỳ OPENING và phần vault, đọc quỹ, chỉ tiếp tục kỳ đã APPROVED, không bao giờ mở kỳ  ::runDistributionCycle
  18  app/src/lib/bank/distribution-trigger.service.ts:303   đọc kỳ hoạt động và phần chưa phân bổ: chỉ tiếp tục kỳ APPROVED, còn lại AWAITING_APPROVAL, không bao giờ mở kỳ  ::decideCycle
  19  app/src/app/actions/distribution.ts:49                 nhận yêu cầu xem trang lịch sử kỳ chia  ::listDistributionPeriodsAction
  20  app/src/lib/bank/distribution-approval.service.ts:671  kiểm quyền reconcile:read, trang lịch sử kỳ kèm người duyệt, số duyệt, số thực tế, duyệt lại và nguồn kích hoạt  ::listDistributionPeriods
  21  app/src/app/actions/distribution.ts:54                 nhận yêu cầu xem trang hồ sơ trả từng ví của một kỳ  ::listDistributionPayoutsAction
  22  app/src/lib/bank/distribution-approval.service.ts:708  kiểm quyền reconcile:read, trang hồ sơ trả từng ví của một kỳ gồm ví được chia 0  ::listDistributionPayouts
  23  app/src/app/actions/distribution.ts:59                 nhận yêu cầu xem lịch chạy, mới nhất trước  ::listDistributionRunsAction
  24  app/src/lib/bank/distribution-trigger.service.ts:777   kiểm quyền reconcile:read, đọc lịch chạy KeeperRun kèm nguồn kích hoạt MANUAL hoặc KEEPER  ::listDistributionRuns

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:368  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:270  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:88   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:103  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:301  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:330  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:429  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:39         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:163   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:46         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:219   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:232      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:542   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:1134  PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:751   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1513  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:299      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:65         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1700  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 10 điểm cắm · 4 điểm chặn · 45 bước luồng

  => ĐẠT các phần đã chạy: arch markers checkpoint app
artifacts đã phục hồi
exit=0
```

## 4. Job C: run-local-all.sh build evm (gồm e2e hardhat, ca 13)

```text
$ bash scripts/run-local-all.sh build evm

########## APP - BUILD BẢN PHÁT HÀNH ##########

> app@0.1.0 build
> next build

▲ Next.js 16.2.7 (Turbopack)
- Experiments (use with caution):
  · staticGenerationMaxConcurrency: 2
  · staticGenerationMinPagesPerWorker: 50

  Creating an optimized production build ...
✓ Compiled successfully in 25.9s
  Running TypeScript ...
  Finished TypeScript in 23.4s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 820ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /account
├ ƒ /api/balance
├ ƒ /api/investors
├ ƒ /api/keeper/distribution
├ ƒ /api/mint
├ ƒ /api/purchase
├ ƒ /api/token
├ ƒ /api/token-info
├ ƒ /api/txns
├ ƒ /api/version
├ ƒ /approvals
├ ƒ /approvals/[id]
├ ƒ /assets
├ ƒ /audit
├ ƒ /demo-payment
├ ƒ /distribution
├ ƒ /draft
├ ƒ /kyc
├ ƒ /mint
├ ƒ /orders
├ ƒ /orders/[id]
├ ƒ /portfolio
├ ƒ /reconciliation
├ ƒ /seller
├ ƒ /seller/transactions
├ ƒ /seller/withdraw
├ ƒ /tokens/[symbol]
├ ƒ /trade
├ ƒ /transactions
├ ƒ /transactions/[id]
├ ƒ /vault
├ ƒ /wallet
└ ƒ /withdraw


ƒ  (Dynamic)  server-rendered on demand

  => PASS: APP - BUILD BẢN PHÁT HÀNH

########## EVM - BUILD BẢN HARDHAT ##########

> app@0.1.0 build
> next build

▲ Next.js 16.2.7 (Turbopack)
- Experiments (use with caution):
  · staticGenerationMaxConcurrency: 2
  · staticGenerationMinPagesPerWorker: 50

  Creating an optimized production build ...
✓ Compiled successfully in 24.0s
  Running TypeScript ...
  Finished TypeScript in 21.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 762ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /account
├ ƒ /api/balance
├ ƒ /api/investors
├ ƒ /api/keeper/distribution
├ ƒ /api/mint
├ ƒ /api/purchase
├ ƒ /api/token
├ ƒ /api/token-info
├ ƒ /api/txns
├ ƒ /api/version
├ ƒ /approvals
├ ƒ /approvals/[id]
├ ƒ /assets
├ ƒ /audit
├ ƒ /demo-payment
├ ƒ /distribution
├ ƒ /draft
├ ƒ /kyc
├ ƒ /mint
├ ƒ /orders
├ ƒ /orders/[id]
├ ƒ /portfolio
├ ƒ /reconciliation
├ ƒ /seller
├ ƒ /seller/transactions
├ ƒ /seller/withdraw
├ ƒ /tokens/[symbol]
├ ƒ /trade
├ ƒ /transactions
├ ƒ /transactions/[id]
├ ƒ /vault
├ ƒ /wallet
└ ƒ /withdraw


ƒ  (Dynamic)  server-rendered on demand

  => PASS: EVM - BUILD BẢN HARDHAT

########## EVM - DỰNG CHUỖI MỚI ##########
[evm-local] không có nút nào do script này dựng
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
  => PASS: EVM - DỰNG CHUỖI MỚI

########## EVM - E2E PROJECT HARDHAT ##########

Running 28 tests using 1 worker

  ✓   1 [hardhat] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (1.7s)
  -   2 [hardhat] › e2e/mint.spec.ts:56:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100
  -   3 [hardhat] › e2e/mint.spec.ts:89:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng
  ✓   4 [hardhat] › e2e/mint.spec.ts:101:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch (638ms)
  ✓   5 [hardhat] › e2e/mint.spec.ts:115:7 › Phát hành token điện gió › vai Nhà đầu tư không vào được khu vực Vận hành (321ms)
  ✓   6 [hardhat] › e2e/mint.spec.ts:127:7 › Phát hành token điện gió › Kiểm soát viên vào được Vận hành nhưng không phát hành được (702ms)
[SC-02] MINT tx=0xe106b87390ab0022b6232613d72864fbc9c1913cf9ba4c0ae910a78743e4c66e receipt=0x1 block=24
  ✓   7 [hardhat] › e2e/mint.spec.ts:241:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào vault qua Giao dịch viên và Kiểm soát viên (3.4s)
[SC-02] MINT tx=0x44b191c1ba668d0252811cdf43c6d53791414d0750c3024097f3d105ad8f392c receipt=0x1 block=25
  ✓   8 [hardhat] › e2e/mint.spec.ts:252:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng vault; vượt trần bị chặn trước khi gửi (4.3s)
[SC-02] BURN tx=0x560f8f32ccca7da02a08ff476a65b60d2637d00748219696ad23614c6ecf69dd receipt=0x1 block=26
  ✓   9 [hardhat] › e2e/mint.spec.ts:278:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt (2.9s)
  ✓  10 [hardhat] › e2e/permit-order.spec.ts:153:7 › FE-05 ca 14: ký permit trên /trade › mua: hộp ký nêu đúng số VNDB, ký trong ví, lệnh hoàn tất (2.4s)
  ✓  11 [hardhat] › e2e/permit-order.spec.ts:166:7 › FE-05 ca 14: ký permit trên /trade › bán: hộp ký nêu đúng số WPT, lệnh hoàn tất (2.4s)
  ✓  12 [hardhat] › e2e/permit-order.spec.ts:176:7 › FE-05 ca 14: ký permit trên /trade › huỷ ký (4001): quay lại hộp xác nhận, không tạo lệnh (2.2s)
  ✓  13 [hardhat] › e2e/vault-withdraw.spec.ts:23:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › chuẩn bị: whitelist ví nhận NB001 bằng màn KYC có sẵn (652ms)
  ✓  14 [hardhat] › e2e/vault-withdraw.spec.ts:31:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Kiểm soát viên lưu cấu hình, /vault cập nhật (1.0s)
  ✓  15 [hardhat] › e2e/vault-withdraw.spec.ts:50:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › vai khác chỉ xem cấu hình (605ms)
  ✓  16 [hardhat] › e2e/vault-withdraw.spec.ts:57:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Người bán tạo lệnh rút, thấy COMPLETED (1.5s)
  ✓  17 [hardhat] › e2e/wallet-connect.spec.ts:37:7 › Trang Ví của tôi › có trong menu nhà đầu tư và mở được (637ms)
  ✓  18 [hardhat] › e2e/wallet-connect.spec.ts:58:7 › Trang Ví của tôi › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng (592ms)
  ✓  19 [hardhat] › e2e/wallet-connect.spec.ts:91:7 › Trang Ví của tôi › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật (568ms)
  ✓  20 [hardhat] › e2e/wallet-connect.spec.ts:127:7 › Trang Ví của tôi › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví (502ms)
  ✓  21 [hardhat] › e2e/wallet-connect.spec.ts:169:7 › Trang Ví của tôi › mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar (469ms)
  ✓  22 [hardhat] › e2e/wallet-connect.spec.ts:182:7 › Trang Ví của tôi › không có lỗi lệch kết xuất khi tải trang (1.4s)
  ✓  23 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai TELLER KHÔNG vào được trang kết nối ví (346ms)
  ✓  24 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai CONTROLLER KHÔNG vào được trang kết nối ví (334ms)
  ✓  25 [hardhat] › e2e/wallet-connect.spec.ts:230:7 › Trang Ví của tôi › vai Người bán VÀO ĐƯỢC trang kết nối ví (537ms)
  ✓  26 [hardhat] › e2e/zz-distribution-approval.spec.ts:31:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › chuẩn bị: SPV nạp 1.000.000 VNDB vào quỹ chia qua màn có sẵn (1.3s)
  ✓  27 [hardhat] › e2e/zz-distribution-approval.spec.ts:45:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Giao dịch viên xem quỹ và dự kiến, không thấy nút duyệt (698ms)
  ✓  28 [hardhat] › e2e/zz-distribution-approval.spec.ts:54:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Kiểm soát viên duyệt: hộp xác nhận nói rõ phạm vi, kỳ hoàn tất, lịch sử có người duyệt (1.5s)

  2 skipped
  26 passed (36.7s)
  => PASS: EVM - E2E PROJECT HARDHAT
[evm-local] đã dừng nút (pid 8041)

########## TỔNG KẾT ##########
  Phần đã chạy: build evm
  Đạt:     4
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  EVM - BUILD BẢN HARDHAT
    PASS  EVM - DỰNG CHUỖI MỚI
    PASS  EVM - E2E PROJECT HARDHAT
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:220  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-09  (2 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:65  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-05 đã dùng hàm này để ký permit (`wallet-permit.ts`); FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:302  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1109  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1115  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1120  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1126  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (24 bước)
   1  app/src/app/actions/distribution.ts:29                 nhận yêu cầu xem tổng quan màn chia: quỹ, dự kiến, kỳ hoạt động  ::getDistributionOverviewAction
   2  app/src/lib/bank/distribution-approval.service.ts:576  kiểm quyền reconcile:read, đọc quỹ, dự kiến theo shareOf trên số dư hiện tại, kỳ hoạt động và lý do chưa duyệt được  ::getDistributionOverview
   3  app/src/app/actions/distribution.ts:34                 nhận lần duyệt chia của Kiểm soát viên kèm số VNDB đã xem trên màn  ::approveDistributionAction
   4  app/src/lib/bank/distribution-approval.service.ts:271  kiểm quyền distribution:approve, chain phải có vault, số duyệt phải bằng phần chưa phân bổ, giữ chỗ kỳ OPENING một kỳ hoạt động mỗi chain, mở trên chuỗi rồi so số thực tế  ::approveDistribution
   5  app/src/lib/bank/distribution.service.ts:335           dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
   7  app/src/lib/bank/distribution.service.ts:472           so số thực tế của kỳ trên chuỗi với số đã duyệt: đúng thì APPROVED, khác thì AMOUNT_CHANGED và dừng  ::decideApproval
   8  app/src/app/actions/distribution.ts:39                 nhận lần duyệt lại số thực tế trên chuỗi của kỳ AMOUNT_CHANGED hoặc kỳ cũ chưa duyệt  ::reapproveDistributionAction
   9  app/src/lib/bank/distribution-approval.service.ts:392  kiểm quyền distribution:approve, kỳ AMOUNT_CHANGED hoặc chưa duyệt, số duyệt lại phải bằng đúng số trên chuỗi, ghi APPROVED rồi chia  ::reapproveDistribution
  10  app/src/app/actions/distribution.ts:44                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:464  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  12  app/src/lib/bank/distribution-trigger.service.ts:479   chiếm số vòng KeeperRun kèm nguồn MANUAL hoặc KEEPER, chạy lõi một lượt chia, đóng vòng và ghi sổ  ::runApprovedPeriod
  13  app/src/lib/bank/distribution.service.ts:1169          lõi một lượt chia: kỳ phải APPROVED, chốt kỳ vault phải DONE rồi mới lập hồ sơ chờ, đối soát đã trả và gửi từng lô  ::runDistributionRound
  14  app/src/lib/bank/distribution.service.ts:804           đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose
  15  app/src/lib/bank/distribution.service.ts:261           đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
  16  app/src/lib/bank/distribution-trigger.service.ts:382   ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  17  app/src/lib/bank/distribution-trigger.service.ts:603   chạy một vòng keeper: dọn kỳ OPENING và phần vault, đọc quỹ, chỉ tiếp tục kỳ đã APPROVED, không bao giờ mở kỳ  ::runDistributionCycle
  18  app/src/lib/bank/distribution-trigger.service.ts:303   đọc kỳ hoạt động và phần chưa phân bổ: chỉ tiếp tục kỳ APPROVED, còn lại AWAITING_APPROVAL, không bao giờ mở kỳ  ::decideCycle
  19  app/src/app/actions/distribution.ts:49                 nhận yêu cầu xem trang lịch sử kỳ chia  ::listDistributionPeriodsAction
  20  app/src/lib/bank/distribution-approval.service.ts:671  kiểm quyền reconcile:read, trang lịch sử kỳ kèm người duyệt, số duyệt, số thực tế, duyệt lại và nguồn kích hoạt  ::listDistributionPeriods
  21  app/src/app/actions/distribution.ts:54                 nhận yêu cầu xem trang hồ sơ trả từng ví của một kỳ  ::listDistributionPayoutsAction
  22  app/src/lib/bank/distribution-approval.service.ts:708  kiểm quyền reconcile:read, trang hồ sơ trả từng ví của một kỳ gồm ví được chia 0  ::listDistributionPayouts
  23  app/src/app/actions/distribution.ts:59                 nhận yêu cầu xem lịch chạy, mới nhất trước  ::listDistributionRunsAction
  24  app/src/lib/bank/distribution-trigger.service.ts:777   kiểm quyền reconcile:read, đọc lịch chạy KeeperRun kèm nguồn kích hoạt MANUAL hoặc KEEPER  ::listDistributionRuns

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:368  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:270  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:88   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:103  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:301  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:330  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:429  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:39         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:163   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:46         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:219   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:232      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:542   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:1134  PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:751   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1513  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:299      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:65         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1700  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 10 điểm cắm · 4 điểm chặn · 45 bước luồng

  => ĐẠT các phần đã chạy: build evm
exit=0
```

## 5. E2E project mock (ca 13)

```text
$ bash scripts/run-local-all.sh e2e

########## APP - E2E (PLAYWRIGHT) ##########

Running 72 tests using 1 worker

  ✓   1 [mock] › e2e/account-info.spec.ts:26:9 › FE-24 — Thông tin tài khoản › INVESTOR mở được hồ sơ của chính mình (543ms)
  ✓   2 [mock] › e2e/account-info.spec.ts:26:9 › FE-24 — Thông tin tài khoản › SELLER mở được hồ sơ của chính mình (453ms)
  ✓   3 [mock] › e2e/account-info.spec.ts:26:9 › FE-24 — Thông tin tài khoản › TELLER mở được hồ sơ của chính mình (467ms)
  ✓   4 [mock] › e2e/account-info.spec.ts:26:9 › FE-24 — Thông tin tài khoản › CONTROLLER mở được hồ sơ của chính mình (473ms)
  ✓   5 [mock] › e2e/account-info.spec.ts:39:7 › FE-24 — Thông tin tài khoản › Nhà đầu tư thấy KYC, rủi ro và ví của mình (467ms)
  ✓   6 [mock] › e2e/account-info.spec.ts:50:7 › FE-24 — Thông tin tài khoản › Người bán thấy pháp nhân, liên hệ và ví thanh toán (447ms)
  ✓   7 [mock] › e2e/account-info.spec.ts:61:9 › FE-24 — Thông tin tài khoản › TELLER không thấy hồ sơ đầu tư và địa chỉ ví (439ms)
  ✓   8 [mock] › e2e/account-info.spec.ts:61:9 › FE-24 — Thông tin tài khoản › CONTROLLER không thấy hồ sơ đầu tư và địa chỉ ví (501ms)
  ✓   9 [mock] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (1.8s)
  ✓  10 [mock] › e2e/chain-selector.spec.ts:12:5 › dropdown chain có đúng các chain đã chốt, KHÔNG có Polygon (442ms)
  ✓  11 [mock] › e2e/chain-selector.spec.ts:28:5 › đổi chain rồi mint vẫn chạy, và số dư tính theo từng chain (839ms)
  ✓  12 [mock] › e2e/investor-channel.spec.ts:45:7 › Cổng quyền vào kênh nhà đầu tư › INVESTOR vào được /portfolio và thấy đủ bốn hộp (497ms)
  ✓  13 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai SELLER KHÔNG vào được khu vực nhà đầu tư (361ms)
  ✓  14 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai TELLER KHÔNG vào được khu vực nhà đầu tư (367ms)
  ✓  15 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai CONTROLLER KHÔNG vào được khu vực nhà đầu tư (372ms)
  ✓  16 [mock] › e2e/investor-channel.spec.ts:79:7 › Cổng quyền vào kênh nhà đầu tư › chưa kết nối ví thì MỜI kết nối, không hiện số 0 (370ms)
  ✓  17 [mock] › e2e/investor-channel.spec.ts:89:7 › Bộ chọn vai trò › có đủ bốn vai kèm mã tài khoản mẫu, và KHÔNG còn bộ chọn vai riêng (600ms)
  ✓  18 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang INVESTOR thì về trang mặc định của vai và menu đổi theo (846ms)
  ✓  19 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang SELLER thì về trang mặc định của vai và menu đổi theo (798ms)
  ✓  20 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang CONTROLLER thì về trang mặc định của vai và menu đổi theo (890ms)
  ✓  21 [mock] › e2e/investor-channel.spec.ts:131:7 › Bộ chọn vai trò › đổi từ Nhà đầu tư về Giao dịch viên thì vai và menu đều theo (840ms)
  ✓  22 [mock] › e2e/investor-channel.spec.ts:149:7 › Điều hướng theo vai trò › menu Nhà đầu tư không lẫn mục vận hành (503ms)
  ✓  23 [mock] › e2e/investor-channel.spec.ts:161:7 › Điều hướng theo vai trò › menu Giao dịch viên không lẫn mục khách hàng, và có mục Lập lệnh (763ms)
  ✓  24 [mock] › e2e/investor-channel.spec.ts:171:7 › Điều hướng theo vai trò › menu Kiểm soát viên có ba nhóm và mục Phê duyệt, KHÔNG có Lập lệnh (701ms)
  ✓  25 [mock] › e2e/investor-channel.spec.ts:195:7 › Điều hướng theo vai trò › mọi mục menu đều là liên kết bấm được, không còn mục mờ (479ms)
  ✓  26 [mock] › e2e/investor-channel.spec.ts:209:7 › Điều hướng theo vai trò › bấm mục Giao dịch token ở mock thì dùng ví hồ sơ, không đòi kết nối ví (624ms)
  ✓  27 [mock] › e2e/investor-channel.spec.ts:227:7 › Điều hướng theo vai trò › Quản lý lệnh ở mock cũng dùng ví hồ sơ mà không cần extension (440ms)
  ✓  28 [mock] › e2e/investor-channel.spec.ts:241:7 › Điều hướng theo vai trò › số việc đang chờ hiện cạnh hai mục tài liệu chỉ định (829ms)
  ✓  29 [mock] › e2e/investor-channel.spec.ts:263:7 › Trang chi tiết dự án token › bấm một dòng trong danh sách token thì mở được trang chi tiết (608ms)
  ✓  30 [mock] › e2e/investor-channel.spec.ts:279:7 › Trang chi tiết dự án token › dự án đã lên chuỗi hiển thị phần vị thế và nhãn on-chain (441ms)
  ✓  31 [mock] › e2e/investor-channel.spec.ts:292:7 › Trang chi tiết dự án token › mã token không tồn tại thì ra trang không tìm thấy (357ms)
  ✓  32 [mock] › e2e/investor-channel.spec.ts:303:7 › Nhãn dữ liệu mẫu › số liệu chưa có nguồn thật đều có nhãn (433ms)
  ✓  33 [mock] › e2e/investor-channel.spec.ts:312:7 › Nhãn dữ liệu mẫu › KHÔNG hiển thị biến động giá hay khối lượng giao dịch (482ms)
  ✓  34 [mock] › e2e/maker-checker.spec.ts:39:7 › Lập lệnh và Phê duyệt lệnh › chuẩn bị: whitelist ví SPV bằng màn KYC có sẵn (564ms)
  ✓  35 [mock] › e2e/maker-checker.spec.ts:46:7 › Lập lệnh và Phê duyệt lệnh › ca 1, 2, 3 — Giao dịch viên lập yêu cầu tạo token (1.9s)
  ✓  36 [mock] › e2e/maker-checker.spec.ts:105:7 › Lập lệnh và Phê duyệt lệnh › ca 4 — chọn nguồn toàn bộ nguồn cung thì có cảnh báo xác nhận lại (923ms)
  ✓  37 [mock] › e2e/maker-checker.spec.ts:122:7 › Lập lệnh và Phê duyệt lệnh › ca 7 — guard hai chiều: Giao dịch viên không vào được Phê duyệt (556ms)
  ✓  38 [mock] › e2e/maker-checker.spec.ts:130:7 › Lập lệnh và Phê duyệt lệnh › ca 7 — guard hai chiều: Kiểm soát viên không vào được Lập lệnh (404ms)
  ✓  39 [mock] › e2e/maker-checker.spec.ts:136:7 › Lập lệnh và Phê duyệt lệnh › ca 5, 6 — Kiểm soát viên từ chối phải có lý do; chấp nhận thì hoàn tất (1.0s)
  ✓  40 [mock] › e2e/maker-checker.spec.ts:177:7 › Lập lệnh và Phê duyệt lệnh › việc 13 — bộ lọc trạng thái có đủ năm trạng thái (512ms)
  ✓  41 [mock] › e2e/mint.spec.ts:56:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100 (881ms)
  ✓  42 [mock] › e2e/mint.spec.ts:89:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng (640ms)
  -  43 [mock] › e2e/mint.spec.ts:101:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch
  ✓  44 [mock] › e2e/mint.spec.ts:115:7 › Phát hành token điện gió › vai Nhà đầu tư không vào được khu vực Vận hành (319ms)
  ✓  45 [mock] › e2e/mint.spec.ts:127:7 › Phát hành token điện gió › Kiểm soát viên vào được Vận hành nhưng không phát hành được (764ms)
  -  46 [mock] › e2e/mint.spec.ts:241:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào vault qua Giao dịch viên và Kiểm soát viên
  -  47 [mock] › e2e/mint.spec.ts:252:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng vault; vượt trần bị chặn trước khi gửi
  -  48 [mock] › e2e/mint.spec.ts:278:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt
  ✓  49 [mock] › e2e/ops-transactions.spec.ts:26:5 › FE-06 / OP-02 — xử lý giao dịch và hai màn chi tiết Mock không cần ví (8.9s)
  ✓  50 [mock] › e2e/ops-transactions.spec.ts:212:5 › OP-02 — hai màn chi tiết vẫn mời kết nối ví trên chain thật (838ms)
  -  51 [mock] › e2e/permit-order.spec.ts:153:7 › FE-05 ca 14: ký permit trên /trade › mua: hộp ký nêu đúng số VNDB, ký trong ví, lệnh hoàn tất
  -  52 [mock] › e2e/permit-order.spec.ts:166:7 › FE-05 ca 14: ký permit trên /trade › bán: hộp ký nêu đúng số WPT, lệnh hoàn tất
  -  53 [mock] › e2e/permit-order.spec.ts:176:7 › FE-05 ca 14: ký permit trên /trade › huỷ ký (4001): quay lại hộp xác nhận, không tạo lệnh
  ✓  54 [mock] › e2e/token-info-read.spec.ts:4:5 › tra cứu WPT vẫn chạy khi hàng chờ Server Action bị giữ (856ms)
  ✓  55 [mock] › e2e/token-info-read.spec.ts:23:5 › lỗi mạng có nút thử lại và lần sau đọc được, giữ nội dung biểu mẫu (1.8s)
  ✓  56 [mock] › e2e/token-info-read.spec.ts:40:5 › phản hồi chậm của chain cũ không ghi đè dữ liệu chain mới (1.5s)
  ✓  57 [mock] › e2e/vault-withdraw.spec.ts:23:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › chuẩn bị: whitelist ví nhận NB001 bằng màn KYC có sẵn (602ms)
  ✓  58 [mock] › e2e/vault-withdraw.spec.ts:31:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Kiểm soát viên lưu cấu hình, /vault cập nhật (812ms)
  ✓  59 [mock] › e2e/vault-withdraw.spec.ts:50:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › vai khác chỉ xem cấu hình (557ms)
  ✓  60 [mock] › e2e/vault-withdraw.spec.ts:57:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Người bán tạo lệnh rút, thấy COMPLETED (1.2s)
  ✓  61 [mock] › e2e/wallet-connect.spec.ts:37:7 › Trang Ví của tôi › có trong menu nhà đầu tư và mở được (555ms)
  ✓  62 [mock] › e2e/wallet-connect.spec.ts:58:7 › Trang Ví của tôi › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng (540ms)
  ✓  63 [mock] › e2e/wallet-connect.spec.ts:91:7 › Trang Ví của tôi › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật (508ms)
  ✓  64 [mock] › e2e/wallet-connect.spec.ts:127:7 › Trang Ví của tôi › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví (511ms)
  ✓  65 [mock] › e2e/wallet-connect.spec.ts:169:7 › Trang Ví của tôi › mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar (475ms)
  ✓  66 [mock] › e2e/wallet-connect.spec.ts:182:7 › Trang Ví của tôi › không có lỗi lệch kết xuất khi tải trang (1.4s)
  ✓  67 [mock] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai TELLER KHÔNG vào được trang kết nối ví (308ms)
  ✓  68 [mock] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai CONTROLLER KHÔNG vào được trang kết nối ví (325ms)
  ✓  69 [mock] › e2e/wallet-connect.spec.ts:230:7 › Trang Ví của tôi › vai Người bán VÀO ĐƯỢC trang kết nối ví (404ms)
  ✓  70 [mock] › e2e/zz-distribution-approval.spec.ts:31:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › chuẩn bị: SPV nạp 1.000.000 VNDB vào quỹ chia qua màn có sẵn (976ms)
  ✓  71 [mock] › e2e/zz-distribution-approval.spec.ts:45:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Giao dịch viên xem quỹ và dự kiến, không thấy nút duyệt (573ms)
  ✓  72 [mock] › e2e/zz-distribution-approval.spec.ts:54:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Kiểm soát viên duyệt: hộp xác nhận nói rõ phạm vi, kỳ hoàn tất, lịch sử có người duyệt (1.2s)

  7 skipped
  65 passed (56.3s)
  => PASS: APP - E2E (PLAYWRIGHT)

########## TỔNG KẾT ##########
  Phần đã chạy: e2e
  Đạt:     1
    PASS  APP - E2E (PLAYWRIGHT)
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:220  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-09  (2 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:65  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-05 đã dùng hàm này để ký permit (`wallet-permit.ts`); FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:302  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1109  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1115  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1120  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1126  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (24 bước)
   1  app/src/app/actions/distribution.ts:29                 nhận yêu cầu xem tổng quan màn chia: quỹ, dự kiến, kỳ hoạt động  ::getDistributionOverviewAction
   2  app/src/lib/bank/distribution-approval.service.ts:576  kiểm quyền reconcile:read, đọc quỹ, dự kiến theo shareOf trên số dư hiện tại, kỳ hoạt động và lý do chưa duyệt được  ::getDistributionOverview
   3  app/src/app/actions/distribution.ts:34                 nhận lần duyệt chia của Kiểm soát viên kèm số VNDB đã xem trên màn  ::approveDistributionAction
   4  app/src/lib/bank/distribution-approval.service.ts:271  kiểm quyền distribution:approve, chain phải có vault, số duyệt phải bằng phần chưa phân bổ, giữ chỗ kỳ OPENING một kỳ hoạt động mỗi chain, mở trên chuỗi rồi so số thực tế  ::approveDistribution
   5  app/src/lib/bank/distribution.service.ts:335           dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
   7  app/src/lib/bank/distribution.service.ts:472           so số thực tế của kỳ trên chuỗi với số đã duyệt: đúng thì APPROVED, khác thì AMOUNT_CHANGED và dừng  ::decideApproval
   8  app/src/app/actions/distribution.ts:39                 nhận lần duyệt lại số thực tế trên chuỗi của kỳ AMOUNT_CHANGED hoặc kỳ cũ chưa duyệt  ::reapproveDistributionAction
   9  app/src/lib/bank/distribution-approval.service.ts:392  kiểm quyền distribution:approve, kỳ AMOUNT_CHANGED hoặc chưa duyệt, số duyệt lại phải bằng đúng số trên chuỗi, ghi APPROVED rồi chia  ::reapproveDistribution
  10  app/src/app/actions/distribution.ts:44                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:464  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  12  app/src/lib/bank/distribution-trigger.service.ts:479   chiếm số vòng KeeperRun kèm nguồn MANUAL hoặc KEEPER, chạy lõi một lượt chia, đóng vòng và ghi sổ  ::runApprovedPeriod
  13  app/src/lib/bank/distribution.service.ts:1169          lõi một lượt chia: kỳ phải APPROVED, chốt kỳ vault phải DONE rồi mới lập hồ sơ chờ, đối soát đã trả và gửi từng lô  ::runDistributionRound
  14  app/src/lib/bank/distribution.service.ts:804           đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose
  15  app/src/lib/bank/distribution.service.ts:261           đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
  16  app/src/lib/bank/distribution-trigger.service.ts:382   ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  17  app/src/lib/bank/distribution-trigger.service.ts:603   chạy một vòng keeper: dọn kỳ OPENING và phần vault, đọc quỹ, chỉ tiếp tục kỳ đã APPROVED, không bao giờ mở kỳ  ::runDistributionCycle
  18  app/src/lib/bank/distribution-trigger.service.ts:303   đọc kỳ hoạt động và phần chưa phân bổ: chỉ tiếp tục kỳ APPROVED, còn lại AWAITING_APPROVAL, không bao giờ mở kỳ  ::decideCycle
  19  app/src/app/actions/distribution.ts:49                 nhận yêu cầu xem trang lịch sử kỳ chia  ::listDistributionPeriodsAction
  20  app/src/lib/bank/distribution-approval.service.ts:671  kiểm quyền reconcile:read, trang lịch sử kỳ kèm người duyệt, số duyệt, số thực tế, duyệt lại và nguồn kích hoạt  ::listDistributionPeriods
  21  app/src/app/actions/distribution.ts:54                 nhận yêu cầu xem trang hồ sơ trả từng ví của một kỳ  ::listDistributionPayoutsAction
  22  app/src/lib/bank/distribution-approval.service.ts:708  kiểm quyền reconcile:read, trang hồ sơ trả từng ví của một kỳ gồm ví được chia 0  ::listDistributionPayouts
  23  app/src/app/actions/distribution.ts:59                 nhận yêu cầu xem lịch chạy, mới nhất trước  ::listDistributionRunsAction
  24  app/src/lib/bank/distribution-trigger.service.ts:777   kiểm quyền reconcile:read, đọc lịch chạy KeeperRun kèm nguồn kích hoạt MANUAL hoặc KEEPER  ::listDistributionRuns

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:368  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:270  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:88   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:103  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:301  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:330  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:429  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:39         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:163   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:46         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:219   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:232      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:542   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:1134  PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:751   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1513  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:299      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:65         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1700  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 10 điểm cắm · 4 điểm chặn · 45 bước luồng

  => ĐẠT các phần đã chạy: e2e
exit=0
```

## 6. Nút thật: 1-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] không có nút nào do script này dựng
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 1-vault

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/vault.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/vault.test.ts (6 tests) 209ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  18:46:47
   Duration  2.03s (transform 857ms, setup 0ms, collect 1.55s, tests 209ms, environment 0ms, prepare 70ms)

exit=0
```

## 6. Nút thật: 2-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 9596)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 2-sc-06-distribution-evm

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/sc-06-distribution-evm.test.ts (10 tests) 9100ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > mở kỳ từ phần chưa phân bổ, tra theo nhãn, chia lô, đã trả, đóng kỳ trả về quỹ  2347ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > chốt kỳ vault và tra lại đúng sự kiện PeriodClosed theo mã kỳ  1137ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 14: openPeriod ghi số trên chuỗi, distributePeriod trả đủ, vault nhận phần SPV, chốt vault một lần  416ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 16b: hai retry đồng thời chỉ gửi một giao dịch closePeriod  386ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 19: BE-07 trên chuỗi thật chờ duyệt (FE-08 QĐ-E); lần duyệt mở kỳ có tiền tố chain theo phần chưa phân bổ rồi keeper dừng khi hết tiền mới  305ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 18: quá hạn thì EXPIRED không gửi lô; đóng bằng distribution-admin.js thì CLOSED  3061ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  18:46:58
   Duration  10.87s (transform 840ms, setup 0ms, collect 1.43s, tests 9.10s, environment 0ms, prepare 79ms)

exit=0
```

## 6. Nút thật: 3-evm-order-settlement

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-order-settlement.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-order-settlement.test.ts (10 tests) 2492ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > mua 100 WPT rồi bán 40 WPT qua service; bốn số dư trên chuỗi đúng  1373ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  18:47:19
   Duration  3.62s (transform 872ms, setup 0ms, collect 791ms, tests 2.49s, environment 0ms, prepare 100ms)

exit=0
```

## 6. Nút thật: 3-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 9882)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 4-fe-05-permit-evm

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-05-permit-evm.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/fe-05-permit-evm.test.ts (8 tests) 3825ms
   ✓ FE-05: chữ ký permit trên nút Hardhat thật > ca 11: ủy quyền 0, xem trước vẫn cho xác nhận; thiếu VNDB thì không  303ms
   ✓ FE-05: chữ ký permit trên nút Hardhat thật > ca 5: bán không cần approve: ký WPT, COMPLETED, giao dịch là sellWithPermit  311ms
   ✓ FE-05: chữ ký permit trên nút Hardhat thật > ca 7b: hai tab đồng thời cùng nonce, ủy quyền 0: đúng một lệnh COMPLETED, tiền chỉ đổi một lần  1282ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  18:47:32
   Duration  4.83s (transform 797ms, setup 0ms, collect 704ms, tests 3.83s, environment 0ms, prepare 76ms)

exit=0
```

## 6. Nút thật: 4-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 10240)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 5-evm-issuance

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 5283ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1108ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1088ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1111ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1075ms

 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
   Start at  18:47:45
   Duration  6.78s (transform 794ms, setup 0ms, collect 1.21s, tests 5.28s, environment 0ms, prepare 63ms)

exit=0
```

## 6. Nút thật: 5-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 10527)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 6-be-13-vault-evm

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-13-vault-evm.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/be-13-vault-evm.test.ts (5 tests) 7521ms
   ✓ BE-13 ca 7: Kiểm soát viên cấu hình, Người bán rút qua service trên nút Hardhat thật > PERCENT 20%, mua 100 WPT (withdrawable 8.000.000), rút 3.000.000: COMPLETED, số dư đúng, Txn và audit có dòng, khoá đã nhả  865ms
   ✓ BE-13 ca 7: Kiểm soát viên cấu hình, Người bán rút qua service trên nút Hardhat thật > ca 5b (QĐ-C1): hai lần lưu nữa và một lần đổi bằng vault-admin.js; lịch sử đủ, dòng script ghi "ngoài app"  1556ms
   ✓ BE-13: cổng cấu hình và rút vault trên nút Hardhat thật > bốn setter cấu hình lên chuỗi; ví nhận chưa xác minh và chế độ UNSET bị từ chối  2241ms
   ✓ BE-13: cổng cấu hình và rút vault trên nút Hardhat thật > rút về ví nhận: biên nhận có sự kiện Withdrawn, quét ứng viên từ claimedBlock, block tăng  1172ms
   ✓ BE-13: cổng cấu hình và rút vault trên nút Hardhat thật > vault tạm dừng thì rút bị từ chối với câu riêng của vault  1101ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  18:48:02
   Duration  8.58s (transform 805ms, setup 0ms, collect 742ms, tests 7.52s, environment 0ms, prepare 68ms)

exit=0
```

## 6. Nút thật: 6-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 10809)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 6. Nút thật: 7-fe-08-approval-evm

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/fe-08-approval-evm.test.ts (8 tests) 5336ms
   ✓ FE-08 trên nút Hardhat thật > ca 4: tiền vào quỹ trong lúc mở kỳ: AMOUNT_CHANGED, không chốt vault, không lô; duyệt lại số sai bị từ chối, đúng số thì chia  422ms
   ✓ FE-08 trên nút Hardhat thật > ca 5 PENDING: không có distributeTo, số dư không đổi; tiếp tục thì chốt rồi chia  302ms
   ✓ FE-08 trên nút Hardhat thật > ca 5 SENT: giao dịch chốt treo thì không có lô; vào khối thì tiếp tục được, không chốt lần hai  357ms
   ✓ FE-08 trên nút Hardhat thật > ca 7: Kiểm soát viên duyệt đồng thời với keeper; hai Kiểm soát viên với hai số; hai mã khác ngày UTC: một kỳ hoạt động, không ai nhận hai lần  796ms
   ✓ FE-08 trên nút Hardhat thật > ca 8: dừng tiến trình sau mở kỳ, sau gửi chốt vault, sau gửi lô; tiếp tục không gửi trùng  802ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  18:48:20
   Duration  6.39s (transform 922ms, setup 0ms, collect 723ms, tests 5.34s, environment 0ms, prepare 74ms)

exit=0
```

## 6. Nút thật: 7-reset

```text
$ bash scripts/evm-local.sh reset
[evm-local] đã dừng nút (pid 11096)
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 7. Dừng nút

```text
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 11414)
exit=0
```

## 8a. Dựng database theo init.sql của dev (chưa có cột FE-08: chỉ đếm được WithdrawRequest.activeChain)

```text
$ psql postgresql://bidv:bidv@localhost:5432/bidv_rwa -c "DROP DATABASE IF EXISTS bidv_fe08_devinit" -c "CREATE DATABASE bidv_fe08_devinit" && git show origin/dev:app/prisma/init.sql | psql -q -v ON_ERROR_STOP=1 postgresql://bidv:bidv@localhost:5432/bidv_fe08_devinit && psql postgresql://bidv:bidv@localhost:5432/bidv_fe08_devinit -c "SELECT count(*) AS so_cot_fe08 FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('approvalStatus','activeChain','triggerSource')"
NOTICE:  database "bidv_fe08_devinit" does not exist, skipping
DROP DATABASE
CREATE DATABASE
NOTICE:  schema "public" already exists, skipping
 so_cot_fe08 
-------------
           1
(1 row)

exit=0
```

## 8b. Kiểm thử Postgres của nhánh trên database đó

```text
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_fe08_devinit npx vitest run test/store-constraints.test.ts test/fe-08-store.test.ts test/mock-ledger-state-store.test.ts test/be-13-postgres-upgrade.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/be-13-postgres-upgrade.test.ts (1 test) 1382ms
   ✓ BE-13 ca 17: nâng lược đồ trên database có sẵn > database thiếu hai bảng BE-13 và khoá cấu hình mới được nâng khi khởi tạo pool; hai cổng chạy được  1162ms
 ✓ test/mock-ledger-state-store.test.ts (13 tests) 1673ms
   ✓ Postgres MockLedgerState > hợp đồng kho trạng thái — Postgres > hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi  526ms
   ✓ Postgres MockLedgerState > whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công  757ms
 ✓ test/store-constraints.test.ts (200 tests) 2727ms
 ✓ test/fe-08-store.test.ts (18 tests) 2208ms
   ✓ FE-08 QĐ-B: cổng lưu trữ bản Postgres > giữ chỗ đặt activeChain; kỳ thứ hai cùng chain (mã khác) bị chặn bằng UniqueConstraintError trên activeChain  501ms
   ✓ FE-08 ca 15: nâng lược đồ trên database đang chạy trước FE-08 > thiếu cột duyệt, activeChain, triggerSource: pool tự thêm, điền activeChain cho kỳ cũ hoạt động sớm nhất mỗi chain, chỉ mục duy nhất có mặt  582ms

 Test Files  4 passed (4)
      Tests  232 passed (232)
   Start at  18:49:10
   Duration  4.46s (transform 1.12s, setup 0ms, collect 1.87s, tests 7.99s, environment 1ms, prepare 321ms)

exit=0
```

## 8c. Database đó sau khi chạy: đủ bảy cột kỳ chia, triggerSource và chỉ mục activeChain

```text
$ psql postgresql://bidv:bidv@localhost:5432/bidv_fe08_devinit -c "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('approvalStatus','expectedAmount','approvedAmount','approvedBy','approvedAt','reapprovedFrom','activeChain','triggerSource') ORDER BY 1, 2" -c "SELECT indexname FROM pg_indexes WHERE indexname = 'DistributionPeriod_activeChain_key'"
     table_name     |  column_name   
--------------------+----------------
 DistributionPeriod | activeChain
 DistributionPeriod | approvalStatus
 DistributionPeriod | approvedAmount
 DistributionPeriod | approvedAt
 DistributionPeriod | approvedBy
 DistributionPeriod | expectedAmount
 DistributionPeriod | reapprovedFrom
 KeeperRun          | triggerSource
 WithdrawRequest    | activeChain
(9 rows)

             indexname              
------------------------------------
 DistributionPeriod_activeChain_key
(1 row)

exit=0
```

## 9. Toàn bộ vitest trên Postgres thật

```text
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest run)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/op07-chain-scope.test.ts (2 tests) 191ms
 ✓ test/fe-05-permit-postgres.test.ts (2 tests) 1172ms
   ✓ FE-05 ca 12: cột permit trên Postgres thật > database dựng từ trước FE-05 (thiếu cột permit) được thêm cột khi khởi tạo pool  687ms
 ✓ test/be-13-vault-config.test.ts (42 tests) 868ms
   ✓ Postgres thật (database riêng của tệp) > BE-13 ca 6: hợp đồng khoá vận hành, Postgres > một câu lấy khoá: năm lần lấy song song chỉ một lần được  324ms
 ✓ test/be-13-withdraw.test.ts (35 tests) 1315ms
   ✓ Postgres thật (database riêng của tệp) > BE-13 ca 9: ràng buộc WithdrawRequest, Postgres > một lệnh đang dở mỗi chain (activeChain); về trạng thái cuối thì nhả chỗ  367ms
   ✓ Postgres thật (database riêng của tệp) > hai lệnh rút song song qua service trên Postgres: đúng một lệnh được tạo  527ms
 ✓ test/postgres-seed.test.ts (1 test) 118ms
 ✓ test/mock-ledger-state-store.test.ts (13 tests) 1482ms
   ✓ Postgres MockLedgerState > hợp đồng kho trạng thái — Postgres > hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi  545ms
   ✓ Postgres MockLedgerState > whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công  536ms
 ✓ test/store-constraints.test.ts (200 tests) 2741ms
 ✓ test/fe-08-store.test.ts (18 tests) 2527ms
   ✓ FE-08 QĐ-B: cổng lưu trữ bản Postgres > giữ chỗ đặt activeChain; kỳ thứ hai cùng chain (mã khác) bị chặn bằng UniqueConstraintError trên activeChain  441ms
   ✓ FE-08 ca 15: nâng lược đồ trên database đang chạy trước FE-08 > thiếu cột duyệt, activeChain, triggerSource: pool tự thêm, điền activeChain cho kỳ cũ hoạt động sớm nhất mỗi chain, chỉ mục duy nhất có mặt  743ms
 ✓ test/be-13-postgres-upgrade.test.ts (1 test) 945ms
   ✓ BE-13 ca 17: nâng lược đồ trên database có sẵn > database thiếu hai bảng BE-13 và khoá cấu hình mới được nâng khi khởi tạo pool; hai cổng chạy được  747ms
 ✓ test/postgres-request-client.test.ts (6 tests) 309ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 293ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 315ms
 ✓ test/distribution-service.test.ts (43 tests) 256ms
 ✓ test/investor-trading.test.ts (20 tests) 245ms
 ✓ test/fe-05-permit-order.test.ts (25 tests) 279ms
 ✓ test/seller-channel.test.ts (10 tests) 211ms
 ✓ test/token-request.test.ts (22 tests) 193ms
 ✓ test/demo-payment.test.ts (19 tests) 159ms
 ✓ test/ops-transactions.test.ts (7 tests) 141ms
 ✓ test/config-service.test.ts (31 tests) 193ms
 ✓ test/purchase-service.test.ts (88 tests) 167ms
 ✓ test/issuance-service.test.ts (27 tests) 161ms
 ✓ test/distribution-trigger.test.ts (46 tests) 141ms
 ✓ test/fe-08-approval.test.ts (30 tests) 139ms
 ✓ test/sc-06-distribution-flow.test.ts (15 tests) 114ms
 ✓ test/init-sql-generated.test.ts (1 test) 63ms
 ✓ test/check-checkpoint.test.ts (21 tests) 96ms
 ✓ test/account-info.test.ts (8 tests) 71ms
 ✓ test/mock-ledger.test.ts (63 tests) 55ms
 ✓ test/env-private-key.test.ts (9 tests) 49ms
 ✓ test/rbac.test.ts (68 tests) 66ms
 ✓ test/be-13-seller.test.ts (4 tests) 58ms
 ✓ test/pending-markers.test.ts (24 tests) 66ms
 ✓ test/wallet-status.test.ts (30 tests) 33ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 36ms
 ✓ test/token-info-read.test.ts (8 tests) 31ms
 ✓ test/be-13-mock-vault.test.ts (11 tests) 31ms
 ✓ test/four-roles-routes.test.ts (22 tests) 17ms
 ✓ test/portfolio-service.test.ts (12 tests) 33ms
 ✓ test/server-signer.test.ts (4 tests) 12ms
 ✓ test/token-info-route.test.ts (6 tests) 38ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 36ms
 ✓ test/four-roles-shell.test.ts (19 tests) 28ms
 ✓ test/seller-vault.test.ts (2 tests) 14ms
 ✓ test/abi-contract-sync.test.ts (16 tests) 15ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 10ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 22ms
 ✓ test/account-profile.test.ts (9 tests) 12ms
 ✓ test/fe-05-permit-domain.test.ts (9 tests) 11ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 12ms
 ✓ test/purchase-state.test.ts (19 tests) 16ms
 ✓ test/evm-address-env.test.ts (5 tests) 8ms
 ✓ test/build-info.test.ts (6 tests) 4ms
 ✓ test/order-ref.test.ts (3 tests) 5ms
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 10ms
 ✓ test/receipt-timeout.test.ts (5 tests) 7ms
 ↓ test/be-13-vault-evm.test.ts (5 tests | 5 skipped)
 ↓ test/evm-order-settlement.test.ts (10 tests | 10 skipped)
 ↓ test/fe-05-permit-evm.test.ts (8 tests | 8 skipped)
 ↓ test/fe-08-approval-evm.test.ts (8 tests | 8 skipped)
 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)

 Test Files  56 passed | 5 skipped (61)
      Tests  1159 passed | 57 skipped (1216)
   Start at  18:49:16
   Duration  18.91s (transform 2.92s, setup 0ms, collect 22.69s, tests 15.64s, environment 11ms, prepare 4.83s)

exit=0
```

## 10. Quét bí mật

```text
$ git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
không có bí mật
exit=0
```

## 11. Điểm chờ FE-08

```text
$ node scripts/scan-pending.mjs | grep "FE-08" || echo "không còn điểm chờ FE-08"
không còn điểm chờ FE-08
exit=0
```

## 12. Hợp đồng không bị sửa

```text
$ BASE_REF=origin/dev bash scripts/verify-arch-rules.sh 2>&1 | sed "s/\x1b\[[0-9;]*m//g" | grep -A2 "KHÔNG SỬA CONTRACT"; git diff --stat origin/dev -- packages/contracts-evm/contracts
KHÔNG SỬA CONTRACT ĐÃ PASS TEST
  PASS  Contract không bị sửa so với origin/dev
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
exit=0
```

## 13. Đo lại nền trước khi làm (bước 0, `dev` @ `dd00e12`)

```text
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
    ✔ opex vượt doanh thu => lợi nhuận chia = 0 (không âm)
  158 passing (10s)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  51 passed | 7 skipped (58)
      Tests  1020 passed | 66 skipped (1086)
  => PASS: APP - VITEST
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
```

## 14. Sau rebase lên `dev` @ `1eed914` (HF-01) và gộp action màn chia

Chạy trên mã của commit gộp action (cộng tài liệu). Chỉ phần bị ảnh hưởng, theo ghi chú Supervisor.

```text
$ git log --oneline -1 origin/dev
1eed914 Merge pull request #62 from tuannino/fix/hf-01-hieu-nang
exit=0

$ git merge-base --is-ancestor origin/dev HEAD
exit=0

$ git diff --name-only origin/dev -- packages/contracts-evm/contracts
exit=0

$ cd app && npx tsc --noEmit -p .
exit=0

$ cd app && npx eslint src test
exit=0

$ cd app && npx vitest run test/fe-08-approval.test.ts test/hf-01-hieu-nang.test.ts test/pending-markers.test.ts test/distribution-trigger.test.ts test/rbac.test.ts
 ✓ test/pending-markers.test.ts (24 tests) 106ms
 ✓ test/rbac.test.ts (68 tests) 62ms
 ✓ test/hf-01-hieu-nang.test.ts (4 tests) 27ms
 ✓ test/fe-08-approval.test.ts (38 tests) 150ms
 ✓ test/distribution-trigger.test.ts (46 tests) 180ms
 Test Files  5 passed (5)
      Tests  180 passed (180)
exit=0

$ cd app && npx vitest run
 Test Files  54 passed | 8 skipped (62)
      Tests  1075 passed | 75 skipped (1150)

$ node scripts/gen-flow-diagram.mjs --check
Sơ đồ khớp marker: distribute, issue, purchase. Không có tệp mồ côi.
exit=0

$ node scripts/scan-pending.mjs --check-report
Khớp marker: mục điểm cắm trong docs/tech-report.md
exit=0
```

### 14b. E2E mock

```text
$ bash scripts/run-local-all.sh build e2e
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  ✓  70 [mock] › e2e/zz-distribution-approval.spec.ts:31:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › chuẩn bị: SPV nạp 1.000.000 VNDB vào quỹ chia qua màn có sẵn (1.1s)
  ✓  71 [mock] › e2e/zz-distribution-approval.spec.ts:45:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Giao dịch viên xem quỹ và dự kiến, không thấy nút duyệt (453ms)
  ✓  72 [mock] › e2e/zz-distribution-approval.spec.ts:54:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Kiểm soát viên duyệt: hộp xác nhận nói rõ phạm vi, kỳ hoàn tất, lịch sử có người duyệt (1.0s)
  7 skipped
  65 passed (1.2m)
  => PASS: APP - E2E (PLAYWRIGHT)
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  APP - E2E (PLAYWRIGHT)
EXIT=0
```

### 14c. Đo lượt gọi khi mở `/distribution`

```text
$ cd app && npm run build && NEXT_PUBLIC_DEFAULT_CHAIN=mock USE_MOCK_DB=true USE_MOCK_KYC=true DEMO_ROLE=TELLER npx next start --port 3300
$ node measure-distribution.mjs   # Playwright: mỗi vai một context, cookie bidv_channel và bidv_role, mở /distribution, chờ "Lịch sử kỳ chia", networkidle, thêm 1,5 giây
# trước khi gộp (bản rebase)
/distribution CONTROLLER {"ACTION":3,"RSC":0}
/distribution TELLER {"ACTION":3,"RSC":0}
# sau khi gộp
/distribution CONTROLLER {"ACTION":1,"RSC":0}
/distribution TELLER {"ACTION":1,"RSC":0}
```
