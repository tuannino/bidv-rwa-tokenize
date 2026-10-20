# SC-06 — chi tiết kiểm chứng

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mọi khối dưới đây là đầu ra nguyên văn
(chỉ bỏ mã màu terminal) của lệnh ghi ở dòng đầu khối, chạy trên commit `5b22999`
của nhánh `feat/sc-06-chia-loi-nhuan`, theo đúng thứ tự trong `docs/sc-06-chia-loi-nhuan/tasks.md`
bước 5. Mã thoát ở dòng `exit=` cuối khối. Môi trường: `USE_LOCAL_SOLC=1` (sandbox chặn
`binaries.soliditylang.org`); Postgres 16 cục bộ cho `TEST_DATABASE_URL`.

## 1. Hợp đồng (ca 1 đến 10)

```text
$ cd packages/contracts-evm && npx hardhat test
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }


  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC (49ms)
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Đóng kỳ: sau thời hạn nhận, phần chưa nhận trở về quỹ chưa phân bổ
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó (41ms)

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
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (136ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SC-06 - ProfitDistributor: quỹ chia một chiều
    ✔ ca 1: tạo kỳ từ quỹ lấy đúng phần chưa phân bổ, tra được theo nhãn (117ms)
    ✔ ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert (95ms)
    ✔ ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền (59ms)
    ✔ ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được (38ms)
    ✔ ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0
    ✔ ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia
    ✔ ca 7: bất biến sổ dự trữ sau mỗi bước của một chuỗi ngẫu nhiên có hạt giống cố định (572ms)
    ✔ ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3 (39ms)
    ✔ ca 9: phần của SPV vào vault, netProceeds của vault không đổi (112ms)

  SC-07 - công cụ an toàn
    ✔ ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu

  SC-07 - SpvPaymentVault: luật khoá và quyết toán
    ✔ ca 1: triển khai an toàn ở UNSET và chưa cấp matcher (113ms)
    ✔ ca 2: PERCENT kỳ đầu bám theo thu ròng sau từng lệnh (155ms)
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
    ✔ ca 16: matcher kéo chân vào và quyết toán nguyên tử (185ms)
    ✔ ca 17: vault phải đăng ký danh tính trước mint và chân WPT vào (132ms)
    ✔ ca 18: lợi nhuận phần SPV tăng số dư/rút được nhưng không đổi thu ròng
    ✔ ca 19: agent WPT và burner VNDB vẫn chạm được tài sản vault
    ✔ ca 20: module gọi lồng làm hoàn nguyên toàn bộ settleBuy

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh (54ms)
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua (48ms)
      ✔ chỉ token đã gắn gọi được ba action (53ms)
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực (77ms)
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay (67ms)
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được (70ms)
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng (80ms)
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được (74ms)
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ (40ms)
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay (64ms)
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance (133ms)

  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (135ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: đóng kỳ chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (148ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module (38ms)
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (123ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (98ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (109ms)
    ✔ cap: không cho triển khai cap bằng 0

  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm (43ms)
      ✔ P12-7: tất toán một phần thì phần còn lại vẫn giữ
      ✔ P12-8: thanh khoản kho giảm đúng số đã trả (42ms)
    Các ca bị chặn
      ✔ P12-9: đang tạm dừng thì không tất toán được
      ✔ P12-10: số lượng 0 bị từ chối
      ✔ P12-11: ví chưa KYC không tất toán được
      ✔ P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT (39ms)
      ✔ P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM) (41ms)
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
      ✔ P4-10: chuyển nhượng đòi CẢ HAI đầu đã whitelist (40ms)
    Thu hồi cưỡng chế (clawback / forcedTransfer)
      ✔ P4-11: AGENT đốt cưỡng chế làm giảm tổng cung
      ✔ P4-12: forcedTransfer chuyển được kể cả khi bên gửi bị đóng băng
      ✔ P4-13: forcedTransfer sang ví chưa KYC bị chặn
    Thông tin token
      ✔ P4-14: decimals của bản EVM là 0 (đơn vị nguyên)
      ✔ P4-15: ký hiệu token là WPT và VNDB

  SPEC P7 - Chia lợi tức
    Tạo kỳ chia (nhánh nhập tay)
      ✔ P7-1: tạo kỳ chốt snapshot và ghi đúng tổng cung tại snapshot (99ms)
      ✔ P7-2: kho VNDB được kéo vào hợp đồng khi tạo kỳ
      ✔ P7-3: amount = 0 bị từ chối (43ms)
      ✔ P7-4: không có token đang lưu hành thì không tạo được kỳ
      ✔ P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ
      ✔ P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp) (54ms)
    Tính phần chia theo snapshot
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt (42ms)
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó (43ms)
      ✔ P7-9: ví không nắm giữ token được chia 0
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng
      ✔ P7-12: nhận lần hai không trả thêm tiền (47ms)
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư (39ms)
      ✔ P7-15: ví không có quyền không được chia hộ
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia (39ms)
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle (47ms)
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia (42ms)
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần (41ms)
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng) (38ms)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được (38ms)
    Đóng kỳ sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không đóng được (39ms)
      ✔ P7-23: hết hạn thì phần chưa ai nhận trở về quỹ chưa phân bổ (52ms)


  141 passing (8s)

exit=0
```

## 2. Mô phỏng job A, dời artifacts có trap

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
  PASS  Bảng quyền không teo lại so với origin/dev (33 -> 33 hành động)

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
Marker hợp lệ: 18 điểm cắm, 9 điểm chặn, 37 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 3 - KHUÔN CHECKPOINT ##########
BỎ QUA  SC-06: chưa có docs/CHECKPOINT_SC06.md — chưa viết thì chưa kiểm được khuôn.
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

 ✓ test/pending-markers.test.ts (24 tests) 41ms
 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 22ms
 ✓ test/store-constraints.test.ts (122 tests) 76ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 285ms
 ✓ test/mock-ledger-state-store.test.ts (11 tests | 5 skipped) 19ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 566ms
 ✓ test/postgres-request-client.test.ts (6 tests) 314ms
 ✓ test/investor-trading.test.ts (20 tests) 295ms
 ✓ test/token-request.test.ts (22 tests) 158ms
 ✓ test/demo-payment.test.ts (19 tests) 196ms
 ✓ test/distribution-service.test.ts (43 tests) 213ms
 ✓ test/seller-channel.test.ts (10 tests) 191ms
 ✓ test/issuance-service.test.ts (27 tests) 142ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 16ms
 ✓ test/ops-transactions.test.ts (7 tests) 200ms
 ✓ test/distribution-trigger.test.ts (45 tests) 126ms
 ✓ test/purchase-service.test.ts (81 tests) 153ms
 ✓ test/config-service.test.ts (31 tests) 175ms
 ✓ test/account-info.test.ts (8 tests) 67ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 87ms
 ✓ test/init-sql-generated.test.ts (1 test) 67ms
 ✓ test/check-checkpoint.test.ts (21 tests) 47ms
 ✓ test/env-private-key.test.ts (9 tests) 83ms
 ✓ test/mock-ledger.test.ts (61 tests) 53ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 26ms
 ✓ test/rbac.test.ts (62 tests) 44ms
 ✓ test/token-info-read.test.ts (8 tests) 24ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 33ms
 ✓ test/four-roles-routes.test.ts (22 tests) 19ms
 ✓ test/wallet-status.test.ts (30 tests) 38ms
 ✓ test/token-info-route.test.ts (6 tests) 26ms
 ✓ test/abi-contract-sync.test.ts (14 tests) 19ms
 ✓ test/portfolio-service.test.ts (12 tests) 23ms
 ✓ test/purchase-state.test.ts (19 tests) 17ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 23ms
 ✓ test/seller-vault.test.ts (2 tests) 12ms
 ✓ test/account-profile.test.ts (9 tests) 11ms
 ✓ test/server-signer.test.ts (4 tests) 16ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 10ms
 ✓ test/evm-address-env.test.ts (5 tests) 8ms
 ✓ test/four-roles-shell.test.ts (19 tests) 14ms
 ✓ test/receipt-timeout.test.ts (5 tests) 4ms
 ✓ test/build-info.test.ts (6 tests) 7ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 2ms
 ↓ test/postgres-seed.test.ts (1 test | 1 skipped)

 Test Files  44 passed | 2 skipped (46)
      Tests  872 passed | 33 skipped (905)
   Start at  11:13:21
   Duration  11.46s (transform 2.23s, setup 0ms, collect 15.66s, tests 3.97s, environment 9ms, prepare 3.86s)

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
  [cắm]   app/src/lib/store/index.ts:191  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-13  (1 điểm cắm)
  [cắm]   app/src/components/pages/seller-withdraw.tsx:75  biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút

FE-05  (1 điểm cắm)
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-08  (7 điểm cắm)
  [cắm]   app/src/app/(ops)/distribution/page.tsx:4             đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
  [cắm]   app/src/app/actions/distribution.ts:33                đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
  [cắm]   app/src/app/actions/distribution.ts:41                đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
  [cắm]   app/src/app/actions/distribution.ts:49                đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
  [cắm]   app/src/app/actions/distribution.ts:79                đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem
  [cắm]   app/src/app/actions/distribution.ts:86                vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:741  đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng

FE-09  (1 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:57  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:336  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được, giữ nguyên ba nhánh quyết định và nguyên phần chia ở `runDistributionCycle`

SC-03  (5 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:668  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:680  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:699  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:738  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:744  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:915  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:921  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:926  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:932  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (16 bước)
   1  app/src/app/actions/distribution.ts:32                nhận yêu cầu mở kỳ chia, trước khi chốt quyền  ::openPeriodAction
   2  app/src/lib/bank/distribution.service.ts:562          kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ chưa phân bổ, giữ chỗ OPENING rồi mở trên chuỗi  ::openPeriod
   3  app/src/app/actions/distribution.ts:40                nhận yêu cầu xem trước phân bổ của một kỳ đã mở  ::previewDistributionAction
   4  app/src/lib/bank/distribution.service.ts:888          kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewDistribution
   5  app/src/lib/bank/distribution.service.ts:302          dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:228          đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
   7  app/src/app/actions/distribution.ts:48                nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu  ::distributePeriodAction
   8  app/src/lib/bank/distribution.service.ts:1055         kiểm quyền distribution:execute, đọc kỳ trên chuỗi, lập hồ sơ chờ, đối soát đã trả rồi gửi từng lô theo mã kỳ trên chuỗi  ::distributePeriod
   9  app/src/app/actions/distribution.ts:56                nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ  ::getDistributionPeriodAction
  10  app/src/lib/bank/distribution.service.ts:1360         kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả  ::getDistributionPeriod
  11  app/src/app/actions/distribution.ts:78                nhận yêu cầu chạy tay một vòng chia tự động, khi lịch chạy bị trượt  ::runDistributionCycleAction
  12  app/src/lib/bank/distribution-trigger.service.ts:487  chạy một vòng: dọn kỳ OPENING và phần vault, phát hiện phần chưa phân bổ, chiếm chỗ chạy, mở kỳ, chia theo lô  ::runDistributionCycle
  13  app/src/lib/bank/distribution-trigger.service.ts:337  đọc phần chưa phân bổ của quỹ, quyết định mở kỳ mới hay chia tiếp kỳ dở  ::detectNewFunds
  14  app/src/lib/bank/distribution-trigger.service.ts:393  ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  15  app/src/lib/bank/distribution.service.ts:477          mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  16  app/src/lib/bank/distribution.service.ts:726          đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:365  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:267  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:85   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:100  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:298  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:327  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:426  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:38         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:152   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:45         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:201   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:162      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:293   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:790   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:481   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:961   gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:212      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1103  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 9 điểm chặn · 37 bước luồng

  => ĐẠT các phần đã chạy: arch markers checkpoint app
artifacts đã phục hồi
exit=0
```

## 3. Job C: run-local-all.sh build evm

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
✓ Compiled successfully in 24.4s
  Running TypeScript ...
  Finished TypeScript in 21.7s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 879ms
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
  Finished TypeScript in 21.5s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 886ms
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
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
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

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
  => PASS: EVM - DỰNG CHUỖI MỚI

########## EVM - E2E PROJECT HARDHAT ##########

Running 18 tests using 1 worker

  ✓   1 [hardhat] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (2.0s)
  -   2 [hardhat] › e2e/mint.spec.ts:55:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100
  -   3 [hardhat] › e2e/mint.spec.ts:88:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng
  ✓   4 [hardhat] › e2e/mint.spec.ts:100:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch (834ms)
  ✓   5 [hardhat] › e2e/mint.spec.ts:114:7 › Phát hành token điện gió › vai Nhà đầu tư không vào được khu vực Vận hành (360ms)
  ✓   6 [hardhat] › e2e/mint.spec.ts:126:7 › Phát hành token điện gió › Kiểm soát viên vào được Vận hành nhưng không phát hành được (799ms)
[SC-02] MINT tx=0xc2ddd299a6a5d8429ae4ee3d4728fd581fc31e5ce9e116ad055489faff087914 receipt=0x1 block=19
  ✓   7 [hardhat] › e2e/mint.spec.ts:240:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào vault qua Giao dịch viên và Kiểm soát viên (3.2s)
[SC-02] MINT tx=0x7b90e8070069c385ec63b3631a63a59a102d1f3c2b815a9bdc8ccb0870a6a838 receipt=0x1 block=20
  ✓   8 [hardhat] › e2e/mint.spec.ts:251:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng vault; vượt trần bị chặn trước khi gửi (4.2s)
[SC-02] BURN tx=0xbf8d42e6a4566a26ffca85463203b5a8a82128888f8c1c9ccb8b57c48b291002 receipt=0x1 block=21
  ✓   9 [hardhat] › e2e/mint.spec.ts:277:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt (3.2s)
  ✓  10 [hardhat] › e2e/wallet-connect.spec.ts:37:7 › Trang Ví của tôi › có trong menu nhà đầu tư và mở được (581ms)
  ✓  11 [hardhat] › e2e/wallet-connect.spec.ts:58:7 › Trang Ví của tôi › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng (509ms)
  ✓  12 [hardhat] › e2e/wallet-connect.spec.ts:91:7 › Trang Ví của tôi › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật (529ms)
  ✓  13 [hardhat] › e2e/wallet-connect.spec.ts:127:7 › Trang Ví của tôi › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví (524ms)
  ✓  14 [hardhat] › e2e/wallet-connect.spec.ts:169:7 › Trang Ví của tôi › mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar (429ms)
  ✓  15 [hardhat] › e2e/wallet-connect.spec.ts:182:7 › Trang Ví của tôi › không có lỗi lệch kết xuất khi tải trang (1.4s)
  ✓  16 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai TELLER KHÔNG vào được trang kết nối ví (357ms)
  ✓  17 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai CONTROLLER KHÔNG vào được trang kết nối ví (332ms)
  ✓  18 [hardhat] › e2e/wallet-connect.spec.ts:230:7 › Trang Ví của tôi › vai Người bán VÀO ĐƯỢC trang kết nối ví (450ms)

  2 skipped
  16 passed (22.3s)
  => PASS: EVM - E2E PROJECT HARDHAT
[evm-local] đã dừng nút (pid 19207)

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
  [cắm]   app/src/lib/store/index.ts:191  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-13  (1 điểm cắm)
  [cắm]   app/src/components/pages/seller-withdraw.tsx:75  biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút

FE-05  (1 điểm cắm)
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-08  (7 điểm cắm)
  [cắm]   app/src/app/(ops)/distribution/page.tsx:4             đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
  [cắm]   app/src/app/actions/distribution.ts:33                đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
  [cắm]   app/src/app/actions/distribution.ts:41                đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
  [cắm]   app/src/app/actions/distribution.ts:49                đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
  [cắm]   app/src/app/actions/distribution.ts:79                đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem
  [cắm]   app/src/app/actions/distribution.ts:86                vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:741  đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng

FE-09  (1 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:57  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:336  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được, giữ nguyên ba nhánh quyết định và nguyên phần chia ở `runDistributionCycle`

SC-03  (5 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:668  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:680  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:699  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:738  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:744  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:915  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:921  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:926  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:932  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (16 bước)
   1  app/src/app/actions/distribution.ts:32                nhận yêu cầu mở kỳ chia, trước khi chốt quyền  ::openPeriodAction
   2  app/src/lib/bank/distribution.service.ts:562          kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ chưa phân bổ, giữ chỗ OPENING rồi mở trên chuỗi  ::openPeriod
   3  app/src/app/actions/distribution.ts:40                nhận yêu cầu xem trước phân bổ của một kỳ đã mở  ::previewDistributionAction
   4  app/src/lib/bank/distribution.service.ts:888          kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewDistribution
   5  app/src/lib/bank/distribution.service.ts:302          dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:228          đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
   7  app/src/app/actions/distribution.ts:48                nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu  ::distributePeriodAction
   8  app/src/lib/bank/distribution.service.ts:1055         kiểm quyền distribution:execute, đọc kỳ trên chuỗi, lập hồ sơ chờ, đối soát đã trả rồi gửi từng lô theo mã kỳ trên chuỗi  ::distributePeriod
   9  app/src/app/actions/distribution.ts:56                nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ  ::getDistributionPeriodAction
  10  app/src/lib/bank/distribution.service.ts:1360         kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả  ::getDistributionPeriod
  11  app/src/app/actions/distribution.ts:78                nhận yêu cầu chạy tay một vòng chia tự động, khi lịch chạy bị trượt  ::runDistributionCycleAction
  12  app/src/lib/bank/distribution-trigger.service.ts:487  chạy một vòng: dọn kỳ OPENING và phần vault, phát hiện phần chưa phân bổ, chiếm chỗ chạy, mở kỳ, chia theo lô  ::runDistributionCycle
  13  app/src/lib/bank/distribution-trigger.service.ts:337  đọc phần chưa phân bổ của quỹ, quyết định mở kỳ mới hay chia tiếp kỳ dở  ::detectNewFunds
  14  app/src/lib/bank/distribution-trigger.service.ts:393  ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  15  app/src/lib/bank/distribution.service.ts:477          mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  16  app/src/lib/bank/distribution.service.ts:726          đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:365  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:267  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:85   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:100  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:298  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:327  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:426  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:38         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:152   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:45         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:201   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:162      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:293   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:790   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:481   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:961   gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:212      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1103  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 9 điểm chặn · 37 bước luồng

  => ĐẠT các phần đã chạy: build evm
exit=0
```

## 4. Dựng lại nút Hardhat

```text
$ bash scripts/evm-local.sh reset
[evm-local] không có nút nào do script này dựng
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
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

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
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

## 5. verify-deployment ngay sau triển khai (QĐ-J)

```text
$ (set -o pipefail; cd packages/contracts-evm && npx hardhat run scripts/verify-deployment.js --network localhost | tail -25)
  OK   Redemption.projectToken khớp
  OK   Redemption.payoutToken khớp VNDToken
  OK   Redemption.rate = 1000000 (VND cho 1 WPT)
  OK   ProjectToken.identityRegistry khớp IdentityRegistry
  OK   ProjectToken.compliance khớp ModularCompliance
  OK   ModularCompliance đã gắn đúng ProjectToken
  OK   AllowAllModule đã gắn vào ModularCompliance

4. Điều kiện cho P7 (chia lợi tức)
  OK   ProfitDistributor có SNAPSHOT_ROLE (chốt kỳ được)
  OK   ProfitDistributor.totalReserved = 0 (chưa kỳ nào giữ tiền)
  OK   ProfitDistributor.unallocatedBalance = 0 (phần quỹ chưa thuộc kỳ nào)

5. Vault thanh toán SPV (SC-07)
  OK   SpvPaymentVault có bytecode tại 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
  OK   SpvPaymentVault.projectToken khớp
  OK   SpvPaymentVault.paymentToken khớp VNDB
  OK   SpvPaymentVault đã đăng ký danh tính
  OK   CONFIG_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  OK   WITHDRAWER_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  OK   PAUSER_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  OK   MATCHER_ROLE chưa cấp cho ai
  OK   lockMode = UNSET

BẢN DEPLOY HỢP LỆ — ERC-3643/permit và vault hiện có đã nối đúng.
exit=0
```

## 6. evm-issuance trên nút thật

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 5231ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1104ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1085ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1093ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1073ms

 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
   Start at  11:15:55
   Duration  6.75s (transform 708ms, setup 0ms, collect 1.21s, tests 5.23s, environment 0ms, prepare 68ms)

exit=0
```

## 7. Ca 12, 14 đến 19 trên nút thật, kèm vault.test.ts

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts test/vault.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/vault.test.ts (6 tests) 181ms
 ✓ test/sc-06-distribution-evm.test.ts (10 tests) 8954ms
   ✓ SC-06 ca 12 — adapter EVM khớp ProfitDistributor trên Hardhat thật > mở kỳ từ phần chưa phân bổ, tra theo nhãn, chia lô, đã trả, đóng kỳ trả về quỹ  2320ms
   ✓ SC-06 ca 12 — adapter EVM khớp ProfitDistributor trên Hardhat thật > chốt kỳ vault và tra lại đúng sự kiện PeriodClosed theo mã kỳ  1124ms
   ✓ SC-06 ca 14 đến 19 — nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 14: openPeriod ghi số trên chuỗi, distributePeriod trả đủ, vault nhận phần SPV, chốt vault một lần  376ms
   ✓ SC-06 ca 14 đến 19 — nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 16a: closePeriod lên chuỗi nhưng mất ghi database: retry đối soát PeriodClosed, DONE, không chốt thêm  342ms
   ✓ SC-06 ca 14 đến 19 — nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 16b: hai retry đồng thời chỉ gửi một giao dịch closePeriod  382ms
   ✓ SC-06 ca 14 đến 19 — nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 18: quá hạn thì EXPIRED không gửi lô; đóng bằng distribution-admin.js thì CLOSED  3233ms

 Test Files  2 passed (2)
      Tests  16 passed (16)
   Start at  11:16:02
   Duration  10.46s (transform 859ms, setup 0ms, collect 2.55s, tests 9.13s, environment 0ms, prepare 167ms)

exit=0
```

## 8. Dừng nút

```text
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 19720)
exit=0
```

## 9. Không còn điểm chặn SC-05

```text
$ node scripts/scan-pending.mjs | grep "SC-05" || echo "không còn điểm chặn SC-05"
không còn điểm chặn SC-05
exit=0
```

## 10. Bộ lưu trữ, mock và luồng trên Postgres thật

```text
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest run test/store-constraints.test.ts test/mock-ledger-state-store.test.ts test/sc-06-distribution-mock.test.ts test/sc-06-distribution-flow.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 25ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 73ms
 ✓ test/mock-ledger-state-store.test.ts (11 tests) 1160ms
   ✓ Postgres MockLedgerState > hợp đồng kho trạng thái — Postgres > hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi  442ms
   ✓ Postgres MockLedgerState > whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công  487ms
 ✓ test/store-constraints.test.ts (192 tests) 2239ms

 Test Files  4 passed (4)
      Tests  223 passed (223)
   Start at  11:16:16
   Duration  3.51s (transform 1.20s, setup 0ms, collect 3.41s, tests 3.50s, environment 1ms, prepare 375ms)

exit=0
```

## 11. Quét bí mật

```text
$ git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
không có bí mật
exit=0
```

## 12. Đo lại nền trước khi làm (bước 0, `dev` @ `725f2c1`)

```text
$ grep -n "function createDistribution\|safeTransferFrom(msg.sender" packages/contracts-evm/contracts/ProfitDistributor.sol
95:    function createDistribution(uint256 amount, string memory period)
108:        payoutToken.safeTransferFrom(msg.sender, address(this), amount);
$ grep -n "function sweepDust" packages/contracts-evm/contracts/ProfitDistributor.sol
194:    function sweepDust(uint256 id, address to)
$ grep -rn "sweepDust\|DustSwept" packages/contracts-evm/test app/test app/src | cut -d: -f1 | sort | uniq -c
      1 app/src/lib/bank/distribution.service.ts
      1 app/src/lib/ledger/mock.adapter.ts
      2 app/test/distribution-service.test.ts
      1 app/test/mock-ledger.test.ts
      2 packages/contracts-evm/test/full-cycle.test.js
      8 packages/contracts-evm/test/sc-10-va-hop-dong.test.js
      2 packages/contracts-evm/test/spec-p7-profit-distribution.test.js
$ grep -n "@blocked SC-05" app/src/lib/ledger/evm.adapter.ts
757:     * @blocked SC-05 | thiếu quyết định chữ ký: `distributeBatch(snapshotId, wallets)` không mang mã kỳ nên adapter không tra được `distributionId`; hợp đồng `ProfitDistributor` thì đã có và đã deploy. Hai đường xử lý ghi ngay trên marker này
$ grep -n "takeSnapshot()\|poolAfter !== poolBefore" app/src/lib/bank/distribution.service.ts
418:    const snapshot = await ledger.takeSnapshot();
444:    if (poolAfter !== poolBefore) {
$ grep -n "distributable: s.profitPool" app/src/lib/ledger/mock.adapter.ts
576:          distributable: s.profitPool,
$ grep -n "settleBalanceMark\|detectNewFunds" app/src/lib/bank/distribution-trigger.service.ts
45: * `detectNewFunds`.
55: * tròn của kỳ vừa tất toán. Xem `settleBalanceMark`.
347:async function detectNewFunds(
414:async function settleBalanceMark(run: DistributionRunView, role: Role): Promise<bigint> {
485: * 2. ĐỌC số dư ví lợi nhuận và mốc đã xử lý; quyết định phải làm gì (`detectNewFunds`).
544:    const decision = await detectNewFunds(chain, poolBalance, settledBalance);
638:    const nextSettled = completed ? await settleBalanceMark(run, role) : settledBalance;
$ grep -n "DISTRIBUTION_PERIOD_STATUSES\|DISTRIBUTION_PAYOUT_STATUSES" app/src/lib/store/distribution.store.port.ts
28:export const DISTRIBUTION_PERIOD_STATUSES = ['OPEN', 'DISTRIBUTING', 'COMPLETED'] as const;
29:export type DistributionPeriodStatus = (typeof DISTRIBUTION_PERIOD_STATUSES)[number];
32:  assertStatus('DistributionPeriod', DISTRIBUTION_PERIOD_STATUSES, value);
44:export const DISTRIBUTION_PAYOUT_STATUSES = ['PENDING', 'SENT', 'PAID', 'FAILED'] as const;
45:export type DistributionPayoutStatus = (typeof DISTRIBUTION_PAYOUT_STATUSES)[number];
48:  assertStatus('DistributionPayout', DISTRIBUTION_PAYOUT_STATUSES, value);
$ grep -n "periodKey     String               @unique" app/prisma/schema.prisma
179:  periodKey     String               @unique

  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  132 passing (6s)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  42 passed | 1 skipped (43)
      Tests  849 passed | 23 skipped (872)
  => PASS: APP - VITEST
  Đạt:     7
  Không đạt: 0
exit=0
```

## 13. Bộ mặc định cuối task (`run-local-all.sh`, chạy một lần sau khi có checkpoint)

```text
$ bash scripts/run-local-all.sh
TỔNG KẾT
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc

########## LỚP 3 - ĐIỂM CẮM (marker) ##########
Marker hợp lệ: 18 điểm cắm, 9 điểm chặn, 37 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 3 - KHUÔN CHECKPOINT ##########
ĐẠT     SC-06 · docs/CHECKPOINT_SC06.md
  mục 0: 18/60 dòng · bảng đối chiếu 5 dòng / 5 điều kiện · 5 ✅ 0 🔶 0 ❌ · cả tệp 149/800 dòng
  => PASS: LỚP 3 - KHUÔN CHECKPOINT

########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }


  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC (51ms)
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng (44ms)
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Đóng kỳ: sau thời hạn nhận, phần chưa nhận trở về quỹ chưa phân bổ
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó (41ms)

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
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (172ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SC-06 - ProfitDistributor: quỹ chia một chiều
    ✔ ca 1: tạo kỳ từ quỹ lấy đúng phần chưa phân bổ, tra được theo nhãn (125ms)
    ✔ ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert (112ms)
    ✔ ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền (61ms)
    ✔ ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được (43ms)
    ✔ ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0 (52ms)
    ✔ ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia
    ✔ ca 7: bất biến sổ dự trữ sau mỗi bước của một chuỗi ngẫu nhiên có hạt giống cố định (598ms)
    ✔ ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3 (43ms)
    ✔ ca 9: phần của SPV vào vault, netProceeds của vault không đổi (120ms)

  SC-07 - công cụ an toàn
    ✔ ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu

  SC-07 - SpvPaymentVault: luật khoá và quyết toán
    ✔ ca 1: triển khai an toàn ở UNSET và chưa cấp matcher (127ms)
    ✔ ca 2: PERCENT kỳ đầu bám theo thu ròng sau từng lệnh (150ms)
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
    ✔ ca 16: matcher kéo chân vào và quyết toán nguyên tử (194ms)
    ✔ ca 17: vault phải đăng ký danh tính trước mint và chân WPT vào (138ms)
    ✔ ca 18: lợi nhuận phần SPV tăng số dư/rút được nhưng không đổi thu ròng
    ✔ ca 19: agent WPT và burner VNDB vẫn chạm được tài sản vault
    ✔ ca 20: module gọi lồng làm hoàn nguyên toàn bộ settleBuy

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh (54ms)
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài (38ms)
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua (58ms)
      ✔ chỉ token đã gắn gọi được ba action (62ms)
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực (88ms)
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay (61ms)
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được (83ms)
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng (84ms)
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được (69ms)
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay (52ms)
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance (87ms)

  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (125ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: đóng kỳ chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (135ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (113ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (82ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (108ms)
    ✔ cap: không cho triển khai cap bằng 0

  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm (42ms)
      ✔ P12-7: tất toán một phần thì phần còn lại vẫn giữ
      ✔ P12-8: thanh khoản kho giảm đúng số đã trả
    Các ca bị chặn
      ✔ P12-9: đang tạm dừng thì không tất toán được
      ✔ P12-10: số lượng 0 bị từ chối
      ✔ P12-11: ví chưa KYC không tất toán được
      ✔ P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT (38ms)
      ✔ P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM) (46ms)
      ✔ P12-14: approve thiếu so với số muốn tất toán thì thất bại (43ms)
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
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt (44ms)
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó (46ms)
      ✔ P7-9: ví không nắm giữ token được chia 0
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận (54ms)
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng
      ✔ P7-12: nhận lần hai không trả thêm tiền (39ms)
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư
      ✔ P7-15: ví không có quyền không được chia hộ
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần (48ms)
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng) (44ms)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được (41ms)
    Đóng kỳ sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không đóng được (42ms)
      ✔ P7-23: hết hạn thì phần chưa ai nhận trở về quỹ chưa phân bổ (48ms)


  141 passing (8s)

  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)

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

 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 12ms
 ✓ test/store-constraints.test.ts (122 tests) 85ms
 ✓ test/postgres-request-client.test.ts (6 tests) 332ms
 ✓ test/mock-ledger-state-store.test.ts (11 tests | 5 skipped) 22ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 516ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 278ms
 ✓ test/investor-trading.test.ts (20 tests) 309ms
 ✓ test/ops-transactions.test.ts (7 tests) 164ms
 ✓ test/distribution-service.test.ts (43 tests) 245ms
 ✓ test/demo-payment.test.ts (19 tests) 180ms
 ✓ test/seller-channel.test.ts (10 tests) 156ms
 ✓ test/config-service.test.ts (31 tests) 141ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 13ms
 ✓ test/token-request.test.ts (22 tests) 242ms
 ✓ test/issuance-service.test.ts (27 tests) 179ms
 ✓ test/purchase-service.test.ts (81 tests) 133ms
 ✓ test/env-private-key.test.ts (9 tests) 52ms
 ✓ test/distribution-trigger.test.ts (45 tests) 127ms
 ✓ test/init-sql-generated.test.ts (1 test) 63ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 79ms
 ✓ test/account-info.test.ts (8 tests) 67ms
 ✓ test/check-checkpoint.test.ts (21 tests) 51ms
 ✓ test/mock-ledger.test.ts (61 tests) 54ms
 ✓ test/rbac.test.ts (62 tests) 35ms
 ✓ test/pending-markers.test.ts (24 tests) 47ms
 ✓ test/wallet-status.test.ts (30 tests) 45ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 51ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 35ms
 ✓ test/token-info-read.test.ts (8 tests) 23ms
 ✓ test/token-info-route.test.ts (6 tests) 26ms
 ✓ test/abi-contract-sync.test.ts (14 tests) 12ms
 ✓ test/four-roles-routes.test.ts (22 tests) 12ms
 ✓ test/portfolio-service.test.ts (12 tests) 36ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 27ms
 ✓ test/purchase-state.test.ts (19 tests) 17ms
 ✓ test/server-signer.test.ts (4 tests) 15ms
 ✓ test/four-roles-shell.test.ts (19 tests) 16ms
 ✓ test/seller-vault.test.ts (2 tests) 16ms
 ✓ test/account-profile.test.ts (9 tests) 15ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 14ms
 ✓ test/evm-address-env.test.ts (5 tests) 5ms
 ✓ test/build-info.test.ts (6 tests) 14ms
 ✓ test/receipt-timeout.test.ts (5 tests) 5ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 4ms
 ↓ test/postgres-seed.test.ts (1 test | 1 skipped)

 Test Files  44 passed | 2 skipped (46)
      Tests  872 passed | 33 skipped (905)
   Start at  11:18:22
   Duration  11.38s (transform 2.25s, setup 0ms, collect 15.41s, tests 3.97s, environment 9ms, prepare 3.94s)

  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:191  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-13  (1 điểm cắm)
  [cắm]   app/src/components/pages/seller-withdraw.tsx:75  biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút

FE-05  (1 điểm cắm)
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-08  (7 điểm cắm)
  [cắm]   app/src/app/(ops)/distribution/page.tsx:4             đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
  [cắm]   app/src/app/actions/distribution.ts:33                đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
  [cắm]   app/src/app/actions/distribution.ts:41                đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
  [cắm]   app/src/app/actions/distribution.ts:49                đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
  [cắm]   app/src/app/actions/distribution.ts:79                đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem
  [cắm]   app/src/app/actions/distribution.ts:86                vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:741  đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng

FE-09  (1 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:57  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:336  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được, giữ nguyên ba nhánh quyết định và nguyên phần chia ở `runDistributionCycle`

SC-03  (5 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:668  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:680  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:699  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:738  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:744  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:915  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:921  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:926  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:932  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (16 bước)
   1  app/src/app/actions/distribution.ts:32                nhận yêu cầu mở kỳ chia, trước khi chốt quyền  ::openPeriodAction
   2  app/src/lib/bank/distribution.service.ts:562          kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ chưa phân bổ, giữ chỗ OPENING rồi mở trên chuỗi  ::openPeriod
   3  app/src/app/actions/distribution.ts:40                nhận yêu cầu xem trước phân bổ của một kỳ đã mở  ::previewDistributionAction
   4  app/src/lib/bank/distribution.service.ts:888          kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewDistribution
   5  app/src/lib/bank/distribution.service.ts:302          dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:228          đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
   7  app/src/app/actions/distribution.ts:48                nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu  ::distributePeriodAction
   8  app/src/lib/bank/distribution.service.ts:1055         kiểm quyền distribution:execute, đọc kỳ trên chuỗi, lập hồ sơ chờ, đối soát đã trả rồi gửi từng lô theo mã kỳ trên chuỗi  ::distributePeriod
   9  app/src/app/actions/distribution.ts:56                nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ  ::getDistributionPeriodAction
  10  app/src/lib/bank/distribution.service.ts:1360         kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả  ::getDistributionPeriod
  11  app/src/app/actions/distribution.ts:78                nhận yêu cầu chạy tay một vòng chia tự động, khi lịch chạy bị trượt  ::runDistributionCycleAction
  12  app/src/lib/bank/distribution-trigger.service.ts:487  chạy một vòng: dọn kỳ OPENING và phần vault, phát hiện phần chưa phân bổ, chiếm chỗ chạy, mở kỳ, chia theo lô  ::runDistributionCycle
  13  app/src/lib/bank/distribution-trigger.service.ts:337  đọc phần chưa phân bổ của quỹ, quyết định mở kỳ mới hay chia tiếp kỳ dở  ::detectNewFunds
  14  app/src/lib/bank/distribution-trigger.service.ts:393  ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  15  app/src/lib/bank/distribution.service.ts:477          mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  16  app/src/lib/bank/distribution.service.ts:726          đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:365  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:267  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:85   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:100  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:298  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:327  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:426  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:38         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:152   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:45         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:201   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:162      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:293   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:790   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:481   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:961   gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:212      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1103  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 9 điểm chặn · 37 bước luồng

  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
```
