# OP-04 — Nhật ký kiểm chứng 08/10/2026

Giữ nguyên đầu ra, mã màu và khoảng trắng của lệnh. Phần có mock/fixture được ghi rõ, không thay bằng chứng Sepolia.

## 1. Đo lại hiện trạng

Thư mục chạy: gốc repo.

```bash
python3 -c "import json;print(json.load(open('packages/shared/src/addresses.json'))['chains']['evm'])"
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
{'chainId': 11155111, 'deployer': '0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076', 'deployedAt': '2026-09-10T16:17:15.350Z', 'contracts': {'ProjectToken': '0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be', 'VNDToken': '0xF9ceD0D827020D4A8778E0B4DBEdF46bb14f9fCd', 'ProfitDistributor': '0x675f0e3dBc7a0c6dB11442F3a236b6427442CdB5', 'Redemption': '0x39eC24eC638dc9e394ED7bb7A6ff72c3DfBd1d68'}}
```

Thư mục chạy: gốc repo.

```bash
curl -sS --max-time 25 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be","data":"0xfc2ab6f2"},"latest"]}' https://ethereum-sepolia-rpc.publicnode.com
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted","data":"0x"}}
```

Thư mục chạy: gốc repo.

```bash
rg -n 'rpcEvm' app/src/lib/config/flags.ts
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
75:  if (key === 'evm' && !env.rpcEvm) {
```

Thư mục chạy: gốc repo.

```bash
rg -n 'ensureApplicationSignerRole' packages/contracts-evm/scripts/deploy.js
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
37:async function ensureApplicationSignerRole(token, roleName, account) {
115:  await ensureApplicationSignerRole(wpt, "MINTER_ROLE", admin);
116:  await ensureApplicationSignerRole(wpt, "AGENT_ROLE", admin);
```

Thư mục chạy: gốc repo.

```bash
rg -n 'demo-mint.mjs --chain evm|/mint' docs/TESTNET_SEPOLIA.md
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
114:node scripts/demo-mint.mjs --chain evm --wallet 0x<VÍ_NHÀ_ĐẦU_TƯ>   # cửa sổ 2
120:Hoặc làm từ UI: mở http://localhost:3000/mint, chọn **EVM Testnet (Sepolia)** ở dropdown
```

Thư mục chạy: gốc repo.

```bash
rg -n 'NEXT_PUBLIC_|Secret' docs/DEPLOYMENT.md
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
66:Demo public không cần đặt `NEXT_PUBLIC_DEFAULT_CHAIN`: source mặc định là `mock`. Có thể đặt
67:tường minh `NEXT_PUBLIC_DEFAULT_CHAIN=mock` ở Build variables để cấu hình tự mô tả. Chỉ chọn
77:| `NEXT_PUBLIC_*` | **Build variables** (trong Settings → Build) | Next nội tuyến vào bundle lúc build, đặt ở runtime không ăn |
79:| `DATABASE_URL`, `SERVER_SIGNER_PRIVATE_KEY*` | Worker → Settings → Variables, dạng **Secret** | không được để lộ dạng plain text |
```

Các phép rg ở trên đo trước khi viết lại runbook/bảng biến.

## 2. Kiểm cấp phí và tính toán

Thư mục chạy: packages/contracts-evm.

```bash
npx hardhat test test/fund-sepolia.test.js
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]


  OP-04 — cấp phí Sepolia
    ✔ từ chối chain khác Sepolia trước khi có thể ký
    ✔ từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường
    ✔ chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên
    ✔ đủ số dư thì không tạo signer và không gửi
    ✔ --dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch
    ✔ gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt
    ✔ tham số phải chọn một chế độ và số ETH phải dương

  OP-04 — preflight phí ví ký
    ✔ thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu
    ✔ báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng Mint/Mint/Burn


  9 passing (19ms)

```

Thư mục chạy: packages/contracts-evm.

```bash
node scripts/fund-sepolia.js --local-estimates
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
OP04_GAS={"deploy":"5019547","mint-initial":"107124","mint":"51031","burn":"51789","whitelist":"48199","cycle":"209944"}
```

Dry-run đầu dùng ethers transport trực tiếp bị timeout qua proxy môi trường:

Thư mục chạy: packages/contracts-evm.

```bash
node scripts/fund-sepolia.js 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 --for mint --dry-run
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 1:

```text
LỖI: Không hoàn tất cấp phí/ước lượng. Kiểm RPC, khóa trong .env, bản biên dịch và tx hash đã in (nếu có).
```

Sau khi dùng transport RPC sẵn có của Hardhat, cùng lệnh chạy được. Số dư đích đủ nên không gửi:

Thư mục chạy: packages/contracts-evm.

```bash
node scripts/fund-sepolia.js 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 --for mint --dry-run
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
◇ injected env (0) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
Gas mô phỏng bytecode hiện tại: 51031; giá trần 1000030 wei; dự phòng 20%.
Đích 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076; cần 0.000000061239037116 ETH; có 3.087612488504724201 ETH; bù 0.0 ETH.
Đã đủ số dư, không gửi.
```

## 3. Preflight Sepolia thật

Không có hai biến khóa cục bộ, nên mã 1 là đúng. Không phải bằng chứng đã đủ phí cho ví ký mới.

Thư mục chạy: packages/contracts-evm.

```bash
npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 1:

```text
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
PREFLIGHT SEPOLIA — network=sepolia
LƯU Ý: dùng RPC công khai; nên đặt SEPOLIA_RPC_URL có API key trong .env.
OK: RPC trả chainId 11155111.
THIẾU: PRIVATE_KEY chưa đặt trong packages/contracts-evm/.env.
THIẾU: SERVER_SIGNER_PRIVATE_KEY_EVM chưa đặt trong packages/contracts-evm/.env.
Địa chỉ hiện tại lấy từ addresses.json, không dùng NEXT_PUBLIC_ADDR_EVM_*:
ProjectToken 0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be: có bytecode (chưa khẳng định SC-02)
VNDToken 0xF9ceD0D827020D4A8778E0B4DBEdF46bb14f9fCd: có bytecode (chưa khẳng định SC-02)
ProfitDistributor 0x675f0e3dBc7a0c6dB11442F3a236b6427442CdB5: có bytecode (chưa khẳng định SC-02)
Redemption 0x39eC24eC638dc9e394ED7bb7A6ff72c3DfBd1d68: có bytecode (chưa khẳng định SC-02)
LƯU Ý: verify source Etherscan là tùy chọn, chưa có ETHERSCAN_API_KEY.
CHƯA SẴN SÀNG — 2 việc cần xử lý.
```

## 4. Kiểm CLI smoke bằng fixture

Fixture HTTP chỉ kiểm CLI và ba phản hồi, không gọi ứng dụng/adapter/Sepolia.

Thư mục chạy: gốc repo.

```bash
node /tmp/op04-review-20261008/smoke-fixture.mjs
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
FIXTURE valid (HTTP giả lập, không phải ứng dụng/Sepolia thật)
KIỂM KHÓI http://127.0.0.1:24449  [2m(chuỗi=evm, hạn chờ=10000ms)[0m

  [32mPASS[0m  GET /api/version
        commit=fixture-op04 nhánh=fixture dựng=2026-10-08T03:00:00Z
  [32mPASS[0m  mã commit đang chạy khớp --expect-commit
        fixture-op04
  [32mPASS[0m  GET /api/token?chain=evm
        WPT trên evm, tổng cung 950

[32m  => ĐẠT toàn bộ 3 phép kiểm.[0m
Mã thoát đã đối chiếu: 0
FIXTURE bad-supply (HTTP giả lập, không phải ứng dụng/Sepolia thật)
KIỂM KHÓI http://127.0.0.1:24449  [2m(chuỗi=evm, hạn chờ=10000ms)[0m

  [32mPASS[0m  GET /api/version
        commit=fixture-op04 nhánh=fixture dựng=2026-10-08T03:00:00Z
  [32mPASS[0m  mã commit đang chạy khớp --expect-commit
        fixture-op04
  [31mFAIL[0m  GET /api/token?chain=evm
        Phản hồi Sepolia không có metadata WPT decimals=0 và tổng cung nguyên không âm hợp lệ.

[31m  => CHƯA ĐẠT: 1/3 phép kiểm đỏ.[0m
Mã thoát đã đối chiếu: 1
FIXTURE wrong-chain (HTTP giả lập, không phải ứng dụng/Sepolia thật)
KIỂM KHÓI http://127.0.0.1:24449  [2m(chuỗi=evm, hạn chờ=10000ms)[0m

  [32mPASS[0m  GET /api/version
        commit=fixture-op04 nhánh=fixture dựng=2026-10-08T03:00:00Z
  [32mPASS[0m  mã commit đang chạy khớp --expect-commit
        fixture-op04
  [31mFAIL[0m  GET /api/token?chain=evm
        trả về chuỗi "mock" trong khi yêu cầu "evm"

[31m  => CHƯA ĐẠT: 1/3 phép kiểm đỏ.[0m
Mã thoát đã đối chiếu: 1
ĐẠT fixture CLI: chỉ GET, truyền chain evm, nhận đúng dữ liệu và từ chối hai phản hồi sai.
```

Kiểm bản Cloudflare hiện hành do chủ dự án cung cấp, **trước** triển khai OP-04.
Node 22 cần bootstrap proxy cục bộ; bootstrap dùng undici có sẵn trong Hardhat, không đổi Worker.

Thư mục chạy: gốc repo.

```bash
curl -sS --max-time 25 https://bidv-rwa-tokenize.tuanlhbidv.workers.dev/api/version
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
{"ok":true,"data":{"commit":"dd015a14e2fac2e2723d47add44eb6deb42c8c10","branch":"local","buildTime":"2026-10-08T02:07:26Z","source":{"commit":"env","branch":"fallback","buildTime":"env"}}}
```

Thư mục chạy: gốc repo.

```bash
node --import /tmp/op04-review-20261008/proxy-bootstrap.mjs scripts/smoke-test.mjs https://bidv-rwa-tokenize.tuanlhbidv.workers.dev --expect-commit=dd015a14e2fac2e2723d47add44eb6deb42c8c10 --chain=evm
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
KIỂM KHÓI https://bidv-rwa-tokenize.tuanlhbidv.workers.dev  [2m(chuỗi=evm, hạn chờ=10000ms)[0m

  [32mPASS[0m  GET /api/version
        commit=dd015a14e2fac2e2723d47add44eb6deb42c8c10 nhánh=local dựng=2026-10-08T02:07:26Z[33m (dự phòng: branch)[0m
  [32mPASS[0m  mã commit đang chạy khớp --expect-commit
        dd015a14e2fac2e2723d47add44eb6deb42c8c10
  [32mPASS[0m  GET /api/token?chain=evm
        WPT trên evm, tổng cung 200

[32m  => ĐẠT toàn bộ 3 phép kiểm.[0m
```

Bản này vẫn đọc bytecode Sepolia cũ; smoke xanh không chứng minh cờ SC-02 hay quyền ký.

## 5. Bộ mặc định

Thư mục chạy: gốc repo.

```bash
bash scripts/run-local-all.sh
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text

[1m########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########[0m

[1mLUẬT 1 - Mọi tương tác chain đi qua ILedgerPort[0m
[32m  PASS  viem/ethers không xuất hiện ngoài app/src/lib[0m
[32m  PASS  Không có lời gọi contract trực tiếp trong components/ và app/[0m

[1mLUẬT 2 - Mọi thao tác ký đi qua ISigner[0m
[32m  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts[0m
[33m  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):[0m
        app/src/lib/signer/index.ts:40:  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
[32m  PASS  Không có app/.env trong cây làm việc[0m
[32m  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn[0m

[1mLUẬT 3 - Mọi kiểm quyền đi qua RBAC can()[0m
[32m  PASS  Không có so sánh role cứng ngoài lib/rbac[0m
[32m  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)[0m
[32m  PASS  Bảng quyền không teo lại so với origin/dev (32 -> 32 hành động)[0m

[1mMỘT NGUỒN SỰ THẬT - ABI và địa chỉ contract[0m
[32m  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)[0m
[33m  WARN  Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):[0m
        app/src/components/pages/mint.tsx:186:                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        app/src/components/pages/mint.tsx:192:                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
        app/src/lib/signer/server.signer.ts:24:      account = { address: '0x0000000000000000000000000000000000000001', type: 'json-rpc' };
[32m  PASS  Không có contract ID Stellar hardcode trong app/src[0m

[1mKHÔNG SỬA CONTRACT ĐÃ PASS TEST[0m
[33m  WARN  Chưa đặt BASE_REF nên bỏ qua so sánh contract. Dùng: BASE_REF=<commit> bash scripts/verify-arch-rules.sh[0m
[32m  PASS  Contract chính không import từ trex/ (toolchain tách biệt)[0m

[1mCHAIN ĐƯỢC PHÉP - Polygon đã loại bỏ vĩnh viễn[0m
[32m  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)[0m

[1mKÝ HIỆU TOKEN - WPT / VNDB (ký hiệu cũ SPT / tVND đã bỏ)[0m
[32m  PASS  Không còn ký hiệu cũ SPT / tVND[0m

[1mCẤU TRÚC SPEC VÀ STEERING[0m
[32m  PASS  Có .kiro/steering[0m
[32m  PASS  Có .kiro/specs[0m
[32m  PASS  Có docs[0m
[32m  PASS  spec p4-mint-testnet đủ 3 file[0m
[32m  PASS  spec p7-profit-distribution đủ 3 file[0m
[32m  PASS  spec p12-redemption đủ 3 file[0m
[32m  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)[0m

[1mTỔNG KẾT[0m
  PASS: 20   FAIL: 0   WARN: 3
[33m  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.[0m
[33m  => PASS có cảnh báo: luật kiến trúc[0m

[1m########## LỚP 3 - ĐIỂM CẮM (marker) ##########[0m
Marker hợp lệ: 18 điểm cắm, 10 điểm chặn, 35 bước luồng. Không có lỗi.
[32m  => PASS: LỚP 3 - ĐIỂM CẮM (marker)[0m

[1m########## LỚP 3 - KHUÔN CHECKPOINT ##########[0m
ĐẠT     OP-04 · docs/CHECKPOINT_OP04.md
  mục 0: 23/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 3 ✅ 6 🔶 0 ❌ · cả tệp 125/800 dòng · có tệp _DETAIL.md
[32m  => PASS: LỚP 3 - KHUÔN CHECKPOINT[0m

[1m########## LỚP 1 - SPEC TEST CONTRACT EVM ##########[0m
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }


  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Quét phần dư: sau thời hạn nhận, phần chưa nhận trả về ngân hàng
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó

  OP-04 — cấp phí Sepolia
    ✔ từ chối chain khác Sepolia trước khi có thể ký
    ✔ từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường
    ✔ chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên
    ✔ đủ số dư thì không tạo signer và không gửi
    ✔ --dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch
    ✔ gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt
    ✔ tham số phải chọn một chế độ và số ETH phải dương

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
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

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


  84 passing (985ms)

[32m  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM[0m
[33m  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)[0m

[1m########## APP - TYPECHECK ##########[0m

> app@0.1.0 typecheck
> tsc --noEmit

[32m  => PASS: APP - TYPECHECK[0m

[1m########## APP - LINT ##########[0m
[32m  => PASS: APP - LINT[0m

[1m########## APP - VITEST ##########[0m

> app@0.1.0 test
> vitest --run


 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/check-checkpoint.test.ts (21 tests) 37ms
 ✓ test/pending-markers.test.ts (24 tests) 26ms
 ✓ test/rbac.test.ts (60 tests) 27ms
 ✓ test/env-private-key.test.ts (9 tests) 48ms
 ✓ test/wallet-status.test.ts (30 tests) 25ms
 ✓ test/account-info.test.ts (8 tests) 62ms
 ✓ test/four-roles-routes.test.ts (22 tests) 20ms
 ✓ test/mock-ledger.test.ts (61 tests) 53ms
 ✓ test/purchase-state.test.ts (19 tests) 8ms
 ✓ test/store-constraints.test.ts (119 tests) 57ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 9ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 21ms
 ✓ test/build-info.test.ts (6 tests) 5ms
 ✓ test/config-service.test.ts (30 tests) 231ms
 ✓ test/token-request.test.ts (22 tests) 239ms
 ✓ test/issuance-service.test.ts (25 tests) 251ms
 ✓ test/evm-address-env.test.ts (5 tests) 4ms
 ✓ test/demo-payment.test.ts (19 tests) 254ms
 ✓ test/account-profile.test.ts (9 tests) 15ms
 ✓ test/ops-transactions.test.ts (7 tests) 250ms
 ✓ test/receipt-timeout.test.ts (5 tests) 3ms
 ✓ test/seller-channel.test.ts (10 tests) 284ms
 ✓ test/investor-trading.test.ts (20 tests) 261ms
 ✓ test/distribution-trigger.test.ts (45 tests) 84ms
 ✓ test/maker-checker-ui.test.ts (31 tests) 308ms
 ✓ test/distribution-service.test.ts (43 tests) 153ms
 ✓ test/purchase-service.test.ts (81 tests) 135ms
 ✓ test/portfolio-service.test.ts (12 tests) 21ms
 ✓ test/server-signer.test.ts (4 tests) 9ms
 ↓ test/evm-issuance.test.ts (10 tests | 10 skipped)
 ✓ test/four-roles-shell.test.ts (19 tests) 8ms

 Test Files  30 passed | 1 skipped (31)
      Tests  790 passed | 10 skipped (800)
   Start at  10:17:58
   Duration  1.64s (transform 2.83s, setup 0ms, collect 15.40s, tests 2.91s, environment 5ms, prepare 3.21s)

[32m  => PASS: APP - VITEST[0m

[1m########## TỔNG KẾT ##########[0m
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
  [cắm]   app/src/lib/store/index.ts:189  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-13  (1 điểm cắm)
  [cắm]   app/src/components/pages/seller-withdraw.tsx:75  biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút

FE-05  (1 điểm cắm)
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:18  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:25  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-08  (7 điểm cắm)
  [cắm]   app/src/app/(ops)/distribution/page.tsx:4             đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
  [cắm]   app/src/app/actions/distribution.ts:33                đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
  [cắm]   app/src/app/actions/distribution.ts:41                đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
  [cắm]   app/src/app/actions/distribution.ts:49                đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
  [cắm]   app/src/app/actions/distribution.ts:79                đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem
  [cắm]   app/src/app/actions/distribution.ts:86                vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:739  đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng

FE-09  (1 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:57  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:344  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `profitPoolBalance` rồi so với mốc `distribution.last_settled_balance`, có chặn ngưỡng tối thiểu và có phát hiện số dư giảm. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào ví lợi nhuận do Indexer đọc được, giữ nguyên bốn nhánh quyết định và nguyên phần chia ở `runDistributionCycle`. Đổi được vì mốc số dư vẫn là thứ chốt "đã xử lý tới đâu", sự kiện chỉ thay việc hỏi định kỳ

SC-03  (5 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:468  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:480  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:499  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:538  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:544  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:680  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:686  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:691  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:697  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

SC-05  (1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:662  thiếu quyết định chữ ký: `distributeBatch(snapshotId, wallets)` không mang mã kỳ nên adapter không tra được `distributionId`; hợp đồng `ProfitDistributor` thì đã có và đã deploy. Hai đường xử lý ghi ngay trên marker này

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (14 bước)
   1  app/src/app/actions/distribution.ts:32                nhận yêu cầu mở kỳ chia, trước khi chốt quyền  ::openPeriodAction
   2  app/src/lib/bank/distribution.service.ts:369          kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ rồi mới chốt quyền, lưu kỳ ở OPEN  ::openPeriod
   3  app/src/app/actions/distribution.ts:40                nhận yêu cầu xem trước phân bổ của một kỳ đã mở  ::previewDistributionAction
   4  app/src/lib/bank/distribution.service.ts:520          kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewDistribution
   5  app/src/lib/bank/distribution.service.ts:269          dựng danh sách người nhận từ cơ sở dữ liệu vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:198          đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
   7  app/src/app/actions/distribution.ts:48                nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu  ::distributePeriodAction
   8  app/src/lib/bank/distribution.service.ts:628          kiểm quyền distribution:execute, lập hồ sơ chờ rồi gửi từng lô, chốt COMPLETED khi hết hồ sơ  ::distributePeriod
   9  app/src/app/actions/distribution.ts:56                nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ  ::getDistributionPeriodAction
  10  app/src/lib/bank/distribution.service.ts:885          kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả  ::getDistributionPeriod
  11  app/src/app/actions/distribution.ts:78                nhận yêu cầu chạy tay một vòng chia tự động, khi lịch chạy bị trượt  ::runDistributionCycleAction
  12  app/src/lib/bank/distribution-trigger.service.ts:505  chạy một vòng: phát hiện, chiếm chỗ chạy, mở kỳ, chia theo lô, cập nhật mốc  ::runDistributionCycle
  13  app/src/lib/bank/distribution-trigger.service.ts:345  so số dư ví lợi nhuận với mốc đã xử lý, quyết định mở kỳ mới hay chia tiếp kỳ dở  ::detectNewFunds
  14  app/src/lib/bank/distribution-trigger.service.ts:412  ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:326  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:227  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:76   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:91   đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:257  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::issuedAt
   7  app/src/lib/bank/issuance.service.ts:288  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:387  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:38         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:152   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:45         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:201   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:115      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:293   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:790   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:481   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:961   gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:165      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1103  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 10 điểm chặn · 35 bước luồng

[32m  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app[0m
```


## 6. Kiểm lịch sử bí mật

Thư mục chạy: gốc repo.

```bash
git log -p origin/dev..HEAD | grep -nE "PRIVATE_KEY=0x[0-9a-fA-F]{64}|infura.io/v3/[0-9a-f]{20,}|alchemy.com/v2/[A-Za-z0-9_-]{20,}" || echo "không có bí mật"
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
không có bí mật
```


## 7. Kiểm khuôn checkpoint

Thư mục chạy: gốc repo.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP04.md docs/op-04-sepolia/requirements.md
```

Đầu ra nguyên văn (stdout/stderr), mã thoát 0:

```text
ĐẠT     docs/CHECKPOINT_OP04.md
  mục 0: 23/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 5 ✅ 4 🔶 0 ❌ · cả tệp 129/800 dòng · có tệp _DETAIL.md
```

## 8. Địa chỉ chủ dự án cung cấp

Kiểm định dạng bằng assertTarget của công cụ cấp phí và đối chiếu danh sách ví mẫu bị chặn.
Không truy cập khóa, không whitelist/cấp vai/gửi giao dịch.

```bash
node /tmp/op04-review-20261008/wallets-check.js
```

Đầu ra nguyên văn, mã thoát 0:

```text
SPV: 0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd — hợp lệ, không thuộc danh sách ví mẫu bị chặn.
INVESTOR: 0xB3a5B799F05F98f78FE58a7f14CD9A400696d033 — hợp lệ, không thuộc danh sách ví mẫu bị chặn.
CONTROLLER: 0x45614534F1f66043534585dB6AaaC1bdebBC8279 — hợp lệ, không thuộc danh sách ví mẫu bị chặn.
```

Kiểm lại khuôn checkpoint sau khi nhận địa chỉ ví:

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP04.md docs/op-04-sepolia/requirements.md
```

Đầu ra nguyên văn, mã thoát 0:

```text
ĐẠT     docs/CHECKPOINT_OP04.md
  mục 0: 23/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 6 ✅ 3 🔶 0 ❌ · cả tệp 130/800 dòng · có tệp _DETAIL.md
```

## 9. Kiểm khuôn sau đối chiếu bộ Sepolia mới

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP04.md docs/op-04-sepolia/requirements.md
```

Đầu ra nguyên văn, mã thoát 0:

```text
ĐẠT     docs/CHECKPOINT_OP04.md
  mục 0: 23/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 7 ✅ 2 🔶 0 ❌ · cả tệp 218/800 dòng · có tệp _DETAIL.md
```
