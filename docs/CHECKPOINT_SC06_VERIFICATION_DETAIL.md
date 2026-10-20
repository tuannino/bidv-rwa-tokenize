# SC-06: chi tiết kiểm chứng

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mọi khối dưới đây là đầu ra nguyên văn
(chỉ bỏ mã màu terminal) của lệnh ghi ở dòng đầu khối, chạy trên commit `1c03e55`
của nhánh `feat/sc-06-chia-loi-nhuan` **sau khi rebase lên `dev` @ `bb02cd6`** (SC-03 đã merge), theo
đúng thứ tự trong `docs/sc-06-chia-loi-nhuan/tasks.md` bước 5. Các commit sau `1c03e55` chỉ sửa tài
liệu. Mã thoát ở dòng `exit=` cuối khối. Môi trường: `USE_LOCAL_SOLC=1` (sandbox chặn
`binaries.soliditylang.org`); Postgres 16 cục bộ cho `TEST_DATABASE_URL`.

## 1. Hợp đồng (ca 1 đến 10)

```text
$ cd packages/contracts-evm && npx hardhat test
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]


  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC (67ms)
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng (59ms)
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Đóng kỳ: sau thời hạn nhận, phần chưa nhận trở về quỹ chưa phân bổ
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó (44ms)

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
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (203ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV (46ms)
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SC-03 - OrderSettlement
    ✔ ca 1: triển khai nối đúng vault, token, giá và matcher duy nhất (141ms)
    ✔ ca 2: mua chuyển đủ hai chân, chỉ vault phát OrderSettled và matcher không giữ tiền
    ✔ ca 3: bán chuyển đủ hai chân và giảm thu ròng
    ✔ ca 4: giá đổi giữa đặt và khớp bị từ chối trước khi chuyển
    ✔ ca 5: đổi giá cần vai, cấm zero và phát đúng sự kiện
    ✔ ca 6: gửi lại mua, mua permit và bán đều báo OrderAlreadySettled đầu tiên (61ms)
    ✔ ca 7: bốn lỗi chiều mua hoàn nguyên cả hai chân (58ms)
    ✔ ca 8: bốn lỗi chiều bán hoàn nguyên cả hai chân (45ms)
    ✔ ca 9: phần khoá lớn hơn số dư không chặn bán lại
    ✔ ca 10: permit VNDB chạy, ràng buộc value và bỏ qua permit đã dùng
    ✔ ca 11: permit WPT chạy và chữ ký gửi trước vẫn dùng được
    ✔ ca 12: pause chặn bốn đường lệnh nhưng không chặn giá hay vault
    ✔ ca 13: bốn đường lệnh và pause đều bị chặn đúng vai
    ✔ ca 14: thay phiên bản giữ dấu orderRef ở vault (44ms)
    ✔ ca 15: module gọi lồng sell bị đúng ReentrancyGuardReentrantCall

  SC-06 - ProfitDistributor: quỹ chia một chiều
    ✔ ca 1: tạo kỳ từ quỹ lấy đúng phần chưa phân bổ, tra được theo nhãn (117ms)
    ✔ ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert (89ms)
    ✔ ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền (46ms)
    ✔ ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được (44ms)
    ✔ ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0
    ✔ ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia
    ✔ ca 7: bất biến sổ dự trữ sau mỗi bước của một chuỗi ngẫu nhiên có hạt giống cố định (564ms)
    ✔ ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3 (43ms)
    ✔ ca 9: phần của SPV vào vault, netProceeds của vault không đổi (117ms)

  SC-07 - công cụ an toàn
    ✔ ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu

  SC-07 - SpvPaymentVault: luật khoá và quyết toán
    ✔ ca 1: triển khai an toàn ở UNSET và chưa cấp matcher (121ms)
    ✔ ca 2: PERCENT kỳ đầu bám theo thu ròng sau từng lệnh (167ms)
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
    ✔ ca 16: matcher kéo chân vào và quyết toán nguyên tử (164ms)
    ✔ ca 17: vault phải đăng ký danh tính trước mint và chân WPT vào (138ms)
    ✔ ca 18: lợi nhuận phần SPV tăng số dư/rút được nhưng không đổi thu ròng
    ✔ ca 19: agent WPT và burner VNDB vẫn chạm được tài sản vault
    ✔ ca 20: module gọi lồng làm hoàn nguyên toàn bộ settleBuy

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh (57ms)
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua (44ms)
      ✔ chỉ token đã gắn gọi được ba action (54ms)
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực (90ms)
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay (74ms)
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được (75ms)
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng (94ms)
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được (61ms)
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay (38ms)
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance (86ms)

  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (148ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: đóng kỳ chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được (41ms)
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (128ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module (38ms)
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (109ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (120ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (122ms)
    ✔ cap: không cho triển khai cap bằng 0

  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm (40ms)
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
      ✔ P7-2: kho VNDB được kéo vào hợp đồng khi tạo kỳ (45ms)
      ✔ P7-3: amount = 0 bị từ chối
      ✔ P7-4: không có token đang lưu hành thì không tạo được kỳ
      ✔ P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ
      ✔ P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp) (38ms)
    Tính phần chia theo snapshot
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó
      ✔ P7-9: ví không nắm giữ token được chia 0 (38ms)
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận (41ms)
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng (40ms)
      ✔ P7-12: nhận lần hai không trả thêm tiền (39ms)
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư
      ✔ P7-15: ví không có quyền không được chia hộ
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia (38ms)
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle (42ms)
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần (40ms)
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng) (40ms)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được (40ms)
    Đóng kỳ sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không đóng được (38ms)
      ✔ P7-23: hết hạn thì phần chưa ai nhận trở về quỹ chưa phân bổ (41ms)


  156 passing (9s)

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
Marker hợp lệ: 18 điểm cắm, 4 điểm chặn, 37 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 3 - KHUÔN CHECKPOINT ##########
ĐẠT     SC-06 · docs/CHECKPOINT_SC06.md
  mục 0: 18/60 dòng · bảng đối chiếu 5 dòng / 5 điều kiện · 5 ✅ 0 🔶 0 ❌ · cả tệp 149/800 dòng
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

 ✓ test/postgres-request-client.test.ts (6 tests) 425ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 341ms
 ✓ test/investor-trading.test.ts (20 tests) 484ms
   ✓ ca 1: nhập quá trần mua thì ô số lượng tự chặn và hiện lý do > trần do số dư chia giá: vượt 1 token bị chặn, bằng trần thì qua  394ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 521ms
 ✓ test/pending-markers.test.ts (24 tests) 62ms
 ✓ test/seller-channel.test.ts (10 tests) 166ms
 ✓ test/distribution-service.test.ts (43 tests) 229ms
 ✓ test/demo-payment.test.ts (19 tests) 176ms
 ✓ test/issuance-service.test.ts (27 tests) 110ms
 ✓ test/ops-transactions.test.ts (7 tests) 131ms
 ✓ test/config-service.test.ts (31 tests) 132ms
 ✓ test/token-request.test.ts (22 tests) 135ms
 ✓ test/purchase-service.test.ts (88 tests) 163ms
 ✓ test/distribution-trigger.test.ts (45 tests) 179ms
 ✓ test/store-constraints.test.ts (122 tests) 90ms
 ✓ test/init-sql-generated.test.ts (1 test) 64ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 86ms
 ✓ test/check-checkpoint.test.ts (21 tests) 53ms
 ✓ test/account-info.test.ts (8 tests) 80ms
 ✓ test/env-private-key.test.ts (9 tests) 53ms
 ✓ test/rbac.test.ts (62 tests) 30ms
 ✓ test/mock-ledger.test.ts (63 tests) 47ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 35ms
 ✓ test/wallet-status.test.ts (30 tests) 24ms
 ✓ test/token-info-read.test.ts (8 tests) 28ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 41ms
 ✓ test/token-info-route.test.ts (6 tests) 26ms
 ✓ test/portfolio-service.test.ts (12 tests) 22ms
 ✓ test/four-roles-shell.test.ts (19 tests) 15ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 20ms
 ✓ test/mock-ledger-state-store.test.ts (12 tests | 5 skipped) 20ms
 ✓ test/abi-contract-sync.test.ts (16 tests) 21ms
 ✓ test/server-signer.test.ts (4 tests) 19ms
 ✓ test/purchase-state.test.ts (19 tests) 18ms
 ✓ test/seller-vault.test.ts (2 tests) 17ms
 ✓ test/account-profile.test.ts (9 tests) 19ms
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 16ms
 ✓ test/four-roles-routes.test.ts (22 tests) 31ms
 ✓ test/order-ref.test.ts (3 tests) 5ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 15ms
 ✓ test/build-info.test.ts (6 tests) 6ms
 ✓ test/evm-address-env.test.ts (5 tests) 11ms
 ✓ test/receipt-timeout.test.ts (5 tests) 6ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 9ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 5ms
 ↓ test/postgres-seed.test.ts (1 test | 1 skipped)
 ↓ test/evm-order-settlement.test.ts (10 tests | 10 skipped)
 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)

 Test Files  45 passed | 3 skipped (48)
      Tests  887 passed | 43 skipped (930)
   Start at  12:03:55
   Duration  12.64s (transform 2.33s, setup 0ms, collect 16.94s, tests 4.19s, environment 12ms, prepare 4.22s)

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

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:989   thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:995   thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1000  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1006  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

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
   7  app/src/lib/bank/purchase.service.ts:805   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:482   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1178  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:216      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1360  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 4 điểm chặn · 37 bước luồng

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
✓ Compiled successfully in 33.7s
  Running TypeScript ...
  Finished TypeScript in 22.8s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 972ms
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
✓ Compiled successfully in 23.6s
  Running TypeScript ...
  Finished TypeScript in 22.4s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 1012ms
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
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
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
  => PASS: EVM - DỰNG CHUỖI MỚI

########## EVM - E2E PROJECT HARDHAT ##########

Running 18 tests using 1 worker

  ✓   1 [hardhat] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (2.0s)
  -   2 [hardhat] › e2e/mint.spec.ts:55:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100
  -   3 [hardhat] › e2e/mint.spec.ts:88:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng
  ✓   4 [hardhat] › e2e/mint.spec.ts:100:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch (654ms)
  ✓   5 [hardhat] › e2e/mint.spec.ts:114:7 › Phát hành token điện gió › vai Nhà đầu tư không vào được khu vực Vận hành (371ms)
  ✓   6 [hardhat] › e2e/mint.spec.ts:126:7 › Phát hành token điện gió › Kiểm soát viên vào được Vận hành nhưng không phát hành được (775ms)
[SC-02] MINT tx=0xe106b87390ab0022b6232613d72864fbc9c1913cf9ba4c0ae910a78743e4c66e receipt=0x1 block=24
  ✓   7 [hardhat] › e2e/mint.spec.ts:240:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào vault qua Giao dịch viên và Kiểm soát viên (3.5s)
[SC-02] MINT tx=0x44b191c1ba668d0252811cdf43c6d53791414d0750c3024097f3d105ad8f392c receipt=0x1 block=25
  ✓   8 [hardhat] › e2e/mint.spec.ts:251:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng vault; vượt trần bị chặn trước khi gửi (3.7s)
[SC-02] BURN tx=0x560f8f32ccca7da02a08ff476a65b60d2637d00748219696ad23614c6ecf69dd receipt=0x1 block=26
  ✓   9 [hardhat] › e2e/mint.spec.ts:277:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt (3.2s)
  ✓  10 [hardhat] › e2e/wallet-connect.spec.ts:37:7 › Trang Ví của tôi › có trong menu nhà đầu tư và mở được (665ms)
  ✓  11 [hardhat] › e2e/wallet-connect.spec.ts:58:7 › Trang Ví của tôi › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng (568ms)
  ✓  12 [hardhat] › e2e/wallet-connect.spec.ts:91:7 › Trang Ví của tôi › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật (513ms)
  ✓  13 [hardhat] › e2e/wallet-connect.spec.ts:127:7 › Trang Ví của tôi › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví (574ms)
  ✓  14 [hardhat] › e2e/wallet-connect.spec.ts:169:7 › Trang Ví của tôi › mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar (511ms)
  ✓  15 [hardhat] › e2e/wallet-connect.spec.ts:182:7 › Trang Ví của tôi › không có lỗi lệch kết xuất khi tải trang (1.5s)
  ✓  16 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai TELLER KHÔNG vào được trang kết nối ví (404ms)
  ✓  17 [hardhat] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai CONTROLLER KHÔNG vào được trang kết nối ví (372ms)
  ✓  18 [hardhat] › e2e/wallet-connect.spec.ts:230:7 › Trang Ví của tôi › vai Người bán VÀO ĐƯỢC trang kết nối ví (507ms)

  2 skipped
  16 passed (23.0s)
  => PASS: EVM - E2E PROJECT HARDHAT
[evm-local] đã dừng nút (pid 3408)

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

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:989   thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:995   thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1000  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1006  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

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
   7  app/src/lib/bank/purchase.service.ts:805   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:482   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1178  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:216      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1360  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 4 điểm chặn · 37 bước luồng

  => ĐẠT các phần đã chạy: build evm
exit=0
```

## 4. Dựng lại nút Hardhat

```text
$ bash scripts/evm-local.sh reset
[evm-local] không có nút nào do script này dựng
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
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
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
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

## 5. verify-deployment ngay sau triển khai (QĐ-J)

```text
$ (set -o pipefail; cd packages/contracts-evm && npx hardhat run scripts/verify-deployment.js --network localhost | tail -25)
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
  OK   MATCHER_ROLE chỉ cấp cho OrderSettlement
  OK   lockMode = UNSET

6. Khớp lệnh SC-03
  OK   OrderSettlement.vault khớp
  OK   OrderSettlement.projectToken khớp
  OK   OrderSettlement.paymentToken khớp
  OK   OrderSettlement.price = 100000
  OK   OPERATOR_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  OK   PRICE_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  OK   PAUSER_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

BẢN DEPLOY HỢP LỆ — ERC-3643/permit và vault hiện có đã nối đúng.
exit=0
```

## 6. evm-issuance trên nút thật

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 5234ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1122ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1075ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1099ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1071ms

 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
   Start at  12:06:47
   Duration  6.66s (transform 730ms, setup 0ms, collect 1.13s, tests 5.23s, environment 0ms, prepare 64ms)

exit=0
```

## 7. Lần chạy gộp ba tệp trên cùng nút (ĐỎ do chạy song song, xem mục 7a)

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts test/vault.test.ts test/evm-order-settlement.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ❯ test/vault.test.ts (6 tests | 1 failed) 448ms
   ✓ SC-07 — adapter rỗng, quyền và menu vault > mock và stellar công khai trạng thái chưa triển khai thay vì ném lỗi 3ms
   ✓ SC-07 — adapter rỗng, quyền và menu vault > chỉ TELLER và CONTROLLER có quyền và mục /vault 2ms
   ✓ SC-07 — adapter rỗng, quyền và menu vault > service trả null trên mock và chặn vai không có quyền 3ms
   ✓ SC-07 — vault qua adapter và service trên nút Hardhat thật > đọc trạng thái sau chuỗi cấu hình/chốt kỳ và quét sự kiện từ deployBlock 297ms
   ✓ SC-07 — vault qua adapter và service trên nút Hardhat thật > thiếu deployBlock thì báo rõ và không quét từ block 0 2ms
   × SC-07 — vault qua adapter và service trên nút Hardhat thật > Tổng quan Người bán lấy ví và luật khoá từ on-chain kể cả trước Mint đầu 139ms
     → expected { …(8) } to match object { paymentVnd: '0', …(3) }
(4 matching properties omitted from actual)
 ❯ test/evm-order-settlement.test.ts (10 tests | 1 failed) 1928ms
   × SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > mua 100 WPT rồi bán 40 WPT qua service; bốn số dư trên chuỗi đúng 940ms
     → expected 660n to be 60n // Object.is equality
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > bán thiếu allowance WPT bị chặn ở R4 trước khi gửi 32ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R5 — lỗi lạ sau khi gửi vẫn chốt COMPLETED từ OrderSettled 204ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R5 — timeout biên nhận vẫn chốt COMPLETED từ OrderSettled 178ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R5 — SETTLED_TX_UNKNOWN giữ nguyên trạng thái hiện tại 25ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R5 — lỗi RPC giữ nguyên trạng thái hiện tại 27ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R6 — EXECUTING mất mã đã quyết toán: chốt mã gốc, không gửi lại 43ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R6 — EXECUTING mất mã chưa quyết toán: quay qua CHECKING và gửi đúng một lần 194ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R6 — giá đổi từ lúc đặt thì bộ kiểm chạy lại và không gửi 33ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > R7 — giá hiển thị lấy từ chain và cảnh báo khi database lệch 19ms
 ✓ test/sc-06-distribution-evm.test.ts (10 tests) 9365ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > mở kỳ từ phần chưa phân bổ, tra theo nhãn, chia lô, đã trả, đóng kỳ trả về quỹ  2578ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > chốt kỳ vault và tra lại đúng sự kiện PeriodClosed theo mã kỳ  1119ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 14: openPeriod ghi số trên chuỗi, distributePeriod trả đủ, vault nhận phần SPV, chốt vault một lần  414ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 18: quá hạn thì EXPIRED không gửi lô; đóng bằng distribution-admin.js thì CLOSED  3691ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/evm-order-settlement.test.ts > SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > mua 100 WPT rồi bán 40 WPT qua service; bốn số dư trên chuỗi đúng
AssertionError: expected 660n to be 60n // Object.is equality

- Expected
+ Received

- 60n
+ 660n

 ❯ test/evm-order-settlement.test.ts:237:52
    235|     if (!sale.ok) return;
    236|     expect(sale.data.status).toBe('COMPLETED');
    237|     expect(await directLedger.balanceOf(INVESTOR)).toBe(before.investo…
       |                                                    ^
    238|     expect(await directLedger.paymentBalanceOf(INVESTOR)).toBe(
    239|       before.investorVndb - 60n * PRICE,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  test/vault.test.ts > SC-07 — vault qua adapter và service trên nút Hardhat thật > Tổng quan Người bán lấy ví và luật khoá từ on-chain kể cả trước Mint đầu
AssertionError: expected { …(8) } to match object { paymentVnd: '0', …(3) }
(4 matching properties omitted from actual)

- Expected
+ Received

@@ -1,8 +1,8 @@
  {
    "lockedVnd": "12500000",
-   "paymentVnd": "0",
+   "paymentVnd": "10000000",
    "policy": {
      "lockMode": "PERCENT",
      "percentLocked": "12500000",
      "percentRateBps": "2500",
      "source": "on-chain",

 ❯ test/vault.test.ts:187:32
    185|     if (!result.ok) return;
    186|     expect(result.data.wallet.paymentWallet?.toLowerCase()).toBe(vault…
    187|     expect(result.data.wallet).toMatchObject({
       |                                ^
    188|       paymentVnd: '0',
    189|       lockedVnd: '12500000',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  2 failed | 1 passed (3)
      Tests  2 failed | 24 passed (26)
   Start at  12:06:55
   Duration  10.94s (transform 1.10s, setup 0ms, collect 3.33s, tests 11.74s, environment 1ms, prepare 387ms)

exit=1
```

Mục 7 chạy ba tệp trong MỘT lệnh vitest nên ba tệp chạy song song trên cùng một chuỗi. Ca SC-06
gọi `forcedTransfer(VAULT, INVESTOR, 600n)` trên đúng ví nhà đầu tư `0x7099…79C8` mà ca SC-03 dùng, và chia VNDB vào vault giữa lúc ca SC-03 và ca vault đang đo số dư,
nên hai ca đó lệch số (660 thay 60; vault 10.000.000 thay 0). Đây là xung đột trạng thái giữa các
tệp test dùng chung nút, không phải lỗi mã. Checkpoint SC-03 và SC-07 đều chạy từng tệp một lệnh;
mục 7a đến 7f chạy lại đúng cách đó trên chuỗi dựng mới và đều đạt.

## 7a. Dựng lại nút

```text
$ bash scripts/evm-local.sh reset
[evm-local] không có nút nào do script này dựng
[evm-local] dựng nút hardhat ở http://127.0.0.1:8545 (nhật ký: /tmp/bidv-evm-local-8545/node.log)
[evm-local] nút sẵn sàng sau 2s
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
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
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8545
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
exit=0
```

## 7b. evm-issuance

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 5227ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1123ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1082ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1118ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1078ms

 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
   Start at  12:08:04
   Duration  7.02s (transform 792ms, setup 0ms, collect 1.42s, tests 5.23s, environment 0ms, prepare 86ms)

exit=0
```

## 7c. vault.test.ts (SC-07)

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/vault.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/vault.test.ts (6 tests) 201ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  12:08:12
   Duration  1.87s (transform 651ms, setup 0ms, collect 1.30s, tests 201ms, environment 0ms, prepare 61ms)

exit=0
```

## 7d. evm-order-settlement.test.ts (SC-03)

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-order-settlement.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/evm-order-settlement.test.ts (10 tests) 1890ms
   ✓ SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật > mua 100 WPT rồi bán 40 WPT qua service; bốn số dư trên chuỗi đúng  929ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  12:08:15
   Duration  2.89s (transform 661ms, setup 0ms, collect 669ms, tests 1.89s, environment 0ms, prepare 93ms)

exit=0
```

## 7e. Ca 12, 14 đến 19 trên nút thật (SC-06)

```text
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ✓ test/sc-06-distribution-evm.test.ts (10 tests) 8917ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > mở kỳ từ phần chưa phân bổ, tra theo nhãn, chia lô, đã trả, đóng kỳ trả về quỹ  2337ms
   ✓ SC-06 ca 12: adapter EVM khớp ProfitDistributor trên Hardhat thật > chốt kỳ vault và tra lại đúng sự kiện PeriodClosed theo mã kỳ  1155ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 14: openPeriod ghi số trên chuỗi, distributePeriod trả đủ, vault nhận phần SPV, chốt vault một lần  336ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 16b: hai retry đồng thời chỉ gửi một giao dịch closePeriod  316ms
   ✓ SC-06 ca 14 đến 19: nghiệp vụ chia lợi nhuận trên Hardhat thật > ca 18: quá hạn thì EXPIRED không gửi lô; đóng bằng distribution-admin.js thì CLOSED  3377ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  12:08:19
   Duration  10.47s (transform 654ms, setup 0ms, collect 1.19s, tests 8.92s, environment 0ms, prepare 74ms)

exit=0
```

## 7f. Dừng nút

```text
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 6395)
exit=0
```

## 8. Dừng nút của lần chạy đầu

```text
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 3889)
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

 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 36ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 99ms
 ✓ test/mock-ledger-state-store.test.ts (12 tests) 1626ms
   ✓ Postgres MockLedgerState > hợp đồng kho trạng thái — Postgres > hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi  916ms
   ✓ Postgres MockLedgerState > whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công  457ms
 ✓ test/store-constraints.test.ts (192 tests) 2916ms
   ✓ lớp 2 — hành vi bản Postgres > kỳ chia lợi nhuận > mở cùng một periodKey hai lần bị từ chối (R2.2)  917ms

 Test Files  4 passed (4)
      Tests  224 passed (224)
   Start at  12:07:09
   Duration  4.30s (transform 1.29s, setup 0ms, collect 3.41s, tests 4.68s, environment 1ms, prepare 407ms)

exit=0
```

## 10a. Toàn bộ vitest trên Postgres thật

```text
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest run)

 RUN  v3.2.4 /home/user/bidv-rwa-tokenize/app

 ↓ test/evm-order-settlement.test.ts (10 tests | 10 skipped)
 ↓ test/sc-06-distribution-evm.test.ts (10 tests | 10 skipped)
 ✓ test/evm-issuance.test.ts (14 tests | 13 skipped) 11ms
 ✓ test/vault.test.ts (6 tests | 3 skipped) 8ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 370ms
 ✓ test/mock-ledger-state-store.test.ts (12 tests) 1333ms
   ✓ Postgres MockLedgerState > hợp đồng kho trạng thái — Postgres > hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi  471ms
   ✓ Postgres MockLedgerState > whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công  557ms
 ✓ test/investor-trading.test.ts (20 tests) 228ms
 ✓ test/postgres-request-client.test.ts (6 tests) 315ms
 ✓ test/store-constraints.test.ts (192 tests) 2438ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 322ms
 ✓ test/demo-payment.test.ts (19 tests) 165ms
 ✓ test/distribution-trigger.test.ts (45 tests) 149ms
 ✓ test/distribution-service.test.ts (43 tests) 236ms
 ✓ test/seller-channel.test.ts (10 tests) 132ms
 ✓ test/token-request.test.ts (22 tests) 164ms
 ✓ test/purchase-service.test.ts (88 tests) 174ms
 ✓ test/config-service.test.ts (31 tests) 174ms
 ✓ test/ops-transactions.test.ts (7 tests) 171ms
 ✓ test/issuance-service.test.ts (27 tests) 122ms
 ✓ test/init-sql-generated.test.ts (1 test) 71ms
 ✓ test/account-info.test.ts (8 tests) 97ms
 ✓ test/sc-06-distribution-flow.test.ts (13 tests) 61ms
 ✓ test/pending-markers.test.ts (24 tests) 65ms
 ✓ test/check-checkpoint.test.ts (21 tests) 62ms
 ✓ test/env-private-key.test.ts (9 tests) 46ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 47ms
 ✓ test/mock-ledger.test.ts (63 tests) 54ms
 ✓ test/sc-06-distribution-mock.test.ts (7 tests) 32ms
 ✓ test/four-roles-routes.test.ts (22 tests) 29ms
 ✓ test/token-info-read.test.ts (8 tests) 23ms
 ✓ test/rbac.test.ts (62 tests) 30ms
 ✓ test/wallet-status.test.ts (30 tests) 25ms
 ✓ test/token-info-route.test.ts (6 tests) 33ms
 ✓ test/abi-contract-sync.test.ts (16 tests) 16ms
 ✓ test/portfolio-service.test.ts (12 tests) 27ms
 ✓ test/account-profile.test.ts (9 tests) 16ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 37ms
 ✓ test/purchase-state.test.ts (19 tests) 17ms
 ✓ test/server-signer.test.ts (4 tests) 17ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 12ms
 ✓ test/seller-vault.test.ts (2 tests) 13ms
 ✓ test/evm-address-env.test.ts (5 tests) 7ms
 ✓ test/four-roles-shell.test.ts (19 tests) 20ms
 ✓ test/build-info.test.ts (6 tests) 7ms
 ✓ test/receipt-timeout.test.ts (5 tests) 5ms
 ✓ test/order-ref.test.ts (3 tests) 6ms
 ✓ test/op07-chain-scope.test.ts (2 tests) 125ms
 ✓ test/postgres-seed.test.ts (1 test) 84ms

 Test Files  46 passed | 2 skipped (48)
      Tests  964 passed | 36 skipped (1000)
   Start at  12:07:14
   Duration  13.69s (transform 2.65s, setup 0ms, collect 17.62s, tests 7.60s, environment 13ms, prepare 4.18s)

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
