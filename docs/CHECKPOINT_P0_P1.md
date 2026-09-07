# Báo cáo bàn giao — Phase 0 (Nền) + Phase 1 (Demo MINT)

> ⚠️ **Ghi chú lịch sử:** báo cáo này viết khi ký hiệu token còn là **SPT**. Sau đó token
> được đổi tên thành **WPT** (Wind Power Token) — xem commit `replace SPT token to WPT token`.
> Nội dung dưới đây giữ nguyên làm bản ghi tại thời điểm nộp; đọc "SPT" thành "WPT".

| | |
|---|---|
| Branch | `phase-0-1/mint-flow` |
| Spec | `.kiro/specs/mint-flow/{requirements,design,tasks}.md` |
| Ngày | 2026-09-06 |

## 1. Đã làm

### T0.1 — Cây thư mục về SPEC §3
- `contracts/evm_contracts` → `packages/contracts-evm`; `contracts/stellar-contracts` → `packages/contracts-stellar` (dùng `git mv`, giữ history).
- Tạo `packages/shared`: ABI tối giản, `addresses.json`, chain data, types dùng chung.
- Xóa docs lỗi thời (mô tả Polygon + `AssetRegistry.sol` không tồn tại): `README.md` cũ, `TECHNICAL.md`, `URD-v1.md`, `bidv-rwa-analysis.js`, `contracts/deploy.ts` (deploy AssetRegistry lên Polygon Amoy), `20260906_SPEC_bidv_rwa.md` (trùng `docs/SPEC.md`).
- `README-old.md` (nội dung điện gió, đúng) được đưa lên thành `README.md` và viết lại theo trạng thái mới.

### T0.2 — Docker Compose
- `packages/contracts-evm/Dockerfile` + `entrypoint.sh`: chạy hardhat node, **chờ RPC sẵn sàng** rồi deploy (không dùng `sleep` cố định — trên máy chậm sẽ deploy vào chain chưa lên và fail im lặng).
- `app/Dockerfile` multi-stage, build context = gốc repo (vì app phụ thuộc `packages/shared`).
- `docker-compose.yml`: healthcheck của `chain` kiểm **contract đã deploy** (`eth_getCode`), không chỉ kiểm cổng mở; `web` chờ `service_healthy` của cả `chain` và `db`.

### T0.3 — Deploy + xuất sang `packages/shared`
- `scripts/deploy.js` viết lại: deploy `ProjectToken` (tên "Wind Power Project Token", ký hiệu SPT, decimals 0) + `VNDToken` + `ProfitDistributor` + `Redemption`, grant `SNAPSHOT_ROLE`, rồi ghi `packages/shared/src/addresses.json` (giữ nguyên các chain khác đã có trong file) và `packages/shared/generated/*.abi.json`.

### T0.4 — `ILedgerPort` (LUẬT #1)
- `ledger.port.ts` (interface + `LedgerError`), `evm.adapter.ts` (viem), `mock.adapter.ts`, `stellar.adapter.ts` (stub), `index.ts` (`getLedger(chain)`).
- EVM adapter **`simulateContract` trước khi gửi tx**: vi phạm tuân thủ trả lỗi đọc được ngay và không tốn một tx revert on-chain.
- Mock adapter mô phỏng đúng ràng buộc của `ProjectToken._update` (chưa KYC / bị băng / paused) — mock dễ tính hơn contract thật sẽ sinh ra lỗi "xanh ở mock, đỏ ở chain thật".

### T0.5 — Chain registry + selector
- `packages/shared/src/chains.ts` (data) + `app/src/lib/chains/registry.ts` (hành vi) + `chain-store.ts` (Zustand) + `use-selected-chain.ts`.
- Dropdown ở header: **Hardhat Local** (mặc định) · **Mock** · **EVM Testnet** · **Stellar** (hiện nhưng disable + lý do). **Không có Polygon** — có e2e chốt điều này.
- Bỏ `polygonAmoy` khỏi `lib/wagmi.ts` và bỏ chữ "Testnet · Polygon Amoy" ghi cứng trong sidebar.

### T0.6 — Signer / RBAC / config / KYC provider
- `signer/`: `signer.port.ts`, `server.signer.ts` (khóa CHỈ đọc ở file này), `wallet.signer.ts`, `fireblocks.signer.stub.ts`, factory `getBankSigner()`.
- `rbac/`: `permissions.ts` (bảng dữ liệu role→permission), `can.ts` (`can`/`assertCan`), `session.ts`.
- `config/`: `env.ts` (Zod, `import 'server-only'`), `flags.ts` (tính `PublicConfig` ở server), `config-context.tsx`.
- `providers/kyc/`: port + mock auto-approve + real stub + factory theo `USE_MOCK_KYC`.

### T1.1–T1.6 — Demo MINT
- `lib/bank/mint.service.ts`: nơi duy nhất ghép 3 trục. Guard RBAC + audit nằm ở **service**, không ở transport → thêm transport mới không thể lỡ mất guard.
- Hai transport gọi cùng service: server actions (`app/actions/bank.ts`) cho UI, và route handlers (`/api/investors`, `/api/mint`, `/api/balance`, `/api/txns`, `/api/token`) cho demo runner + e2e.
- `lib/bank/schemas.ts`: **một** schema Zod dùng chung FE/BE. Amount là chuỗi số nguyên → `bigint` (uint256 vượt tầm `number`).
- Trang `(admin)/mint` + `(audit)/audit`. Guard RBAC đặt ở **layout của route-group** nên trang thêm sau này tự được bảo vệ.
- `lib/store/`: `ITxnStore` + `memory.store.ts` (free-tier) + `postgres.store.ts` (docker), chọn bằng `USE_MOCK_DB`.
- `scripts/demo-mint.mjs`: một lệnh, gọi qua HTTP API (đúng đường UI đi) và **tự kiểm nghiệm thu**.
- Test: 21 Vitest + 5 Playwright.

### Sửa 3 lỗi có sẵn trong repo (phát hiện khi chạy thật)
1. **RainbowKit `getDefaultConfig` ném lỗi lúc nạp module** khi thiếu WalletConnect projectId → làm trắng TOÀN BỘ ứng dụng, kể cả trang không dùng ví. Lỗi này chưa từng lộ ra vì repo cũ chưa render trang nào có `Providers` trong luồng test. Sửa: không có projectId thì dựng wagmi config trực tiếp với connector `injected`.
2. **`isAddress` của viem mặc định `strict: true`** loại cả địa chỉ toàn chữ HOA (dạng hợp lệ, không mang checksum). Sửa `normalizeEvmAddress` theo đúng ngữ nghĩa EIP-55: toàn hoa/toàn thường thì chấp nhận, hoa-thường lẫn lộn thì bắt buộc khớp checksum (bắt lỗi gõ sai). Do một test Vitest phát hiện.
3. **Trang `/mint` gọi server mỗi ký tự gõ** vào ô địa chỉ (~42 lượt/địa chỉ) — thêm debounce 300ms + huỷ kết quả lỗi thời khi đổi chain nhanh.

## 2. Đối chiếu DoD

| Task | DoD | Đạt? | Bằng chứng |
|---|---|---|---|
| T0.1 | Cây thư mục theo SPEC §3, xóa docs lỗi thời | ✅ | `packages/{contracts-evm,contracts-stellar,shared}`; `git log --stat` |
| T0.2 | `docker compose up` chạy được | ✅ | 3 service `Up`, chain+db `healthy` |
| T0.3 | Deploy + xuất ABI/`addresses.json` sang `packages/shared` | ✅ | log container `chain`; `packages/shared/src/addresses.json` |
| T0.4 | ILedgerPort + evm + mock + factory | ✅ | `app/src/lib/ledger/` |
| T0.5 | Registry + selector, KHÔNG polygon | ✅ | e2e `chain-selector.spec.ts` chốt danh sách = `[hardhat-local, mock, evm, stellar]` |
| T0.6 | signer + rbac + config + kyc mock | ✅ | `app/src/lib/{signer,rbac,config,providers}` |
| **DoD P0** | compose chạy; đọc balance qua ILedgerPort; đổi chain UI không lỗi; test contracts xanh | ✅ | dưới đây |
| T1.1 | investor mới → `isWhitelisted=true` | ✅ | demo runner bước 1: `whitelisted=true` |
| T1.2 | mint 100 → CONFIRMED | ✅ | demo runner bước 3 |
| T1.3 | mint từ UI thấy balance đổi | ✅ | e2e `mint.spec.ts` test 1 |
| T1.4 | demo được ở cả 2 chế độ | ✅ | demo runner `--chain hardhat-local` và `--chain mock` đều PASS |
| T1.5 | 1 lệnh ra kết quả | ✅ | `node scripts/demo-mint.mjs` |
| T1.6 | e2e pass | ✅ | 5/5 Playwright |
| **Nghiệm thu P1** | compose up → mint 100 → balance=100; mock chạy được; giao dịch lưu DB; 3 LUẬT | ✅ | dưới đây |

### Kết quả đo được

```
13 passing                      # npx hardhat test (contracts)
tsc --noEmit                    # sạch
Test Files 3 passed | Tests 21 passed   # vitest
5 passed                        # playwright
BALANCE = 100 SPT               # demo runner, chain hardhat-local trong docker
BALANCE = 100 SPT               # demo runner, chain mock
```

Postgres sau khi chạy cả hai chế độ (volume sạch):

```
 operation |  status   | amount | actorRole  |     chain
-----------+-----------+--------+------------+---------------
 whitelist | CONFIRMED |        | BANK_ADMIN | hardhat-local
 mint      | CONFIRMED |    100 | BANK_ADMIN | hardhat-local
 whitelist | CONFIRMED |        | BANK_ADMIN | mock
 mint      | CONFIRMED |    100 | BANK_ADMIN | mock
audit_rows = 14
```

### Acceptance criteria trong `requirements.md`

| AC | Nội dung | Kiểm bằng | Kết quả |
|---|---|---|---|
| 1 | mint → CONFIRMED, lưu giao dịch, cập nhật balance | demo runner + e2e + bảng `Txn` | ✅ |
| 2 | chưa whitelist → từ chối, **không gửi tx** | `POST /api/mint` → `409 NOT_WHITELISTED` (chặn trước khi gửi) | ✅ |
| 3 | amount ≤ 0 hoặc sai định dạng → lỗi validation | `400 VALIDATION` cho `amount:"0"` và ví sai | ✅ |
| 4 | chờ receipt tới CONFIRMED/FAILED hoặc timeout 30s | `waitReceipt(txHash, 30_000)` | ✅ |
| 5 | role ≠ BANK_ADMIN → chặn qua RBAC | `Cookie: bidv_role=AUDITOR` → `403 FORBIDDEN`, và audit log ghi `DENIED` | ✅ |
| 6 | đổi chain → dùng adapter tương ứng; `mock` chạy không cần chain | demo runner 2 chế độ; `chain:"polygon"` bị loại ở schema | ✅ |
| 7 | `balanceOf` phản ánh đúng sau CONFIRMED | demo runner đọc lại từ ledger sau mint | ✅ |

## 3. Cách chạy / kiểm thử

```bash
# --- Nghiệm thu Phase 1 (đầy đủ: chain thật + Postgres) ---
docker compose up -d                              # chờ ~30s cho chain healthy
node scripts/demo-mint.mjs --chain hardhat-local  # -> BALANCE = 100 SPT, PASS
node scripts/demo-mint.mjs --chain mock           # -> PASS, không cần chain
docker compose exec db psql -U bidv -d bidv_rwa -c 'SELECT operation,status,amount,"actorRole",chain FROM "Txn";'
docker compose exec db psql -U bidv -d bidv_rwa -c 'SELECT "actorRole",action,outcome FROM "AuditLog";'
# UI: http://localhost:3000/mint  ·  audit: http://localhost:3000/audit

# --- Test ---
cd packages/contracts-evm && npm install && npx hardhat test    # 13 passing
cd app && npm install
npm run typecheck
npm test                                          # 21 vitest
npm run test:e2e                                  # 5 playwright (chế độ mock, tự dựng server)
E2E_CHAIN=hardhat-local npm run test:e2e          # e2e trên chain thật (cần hardhat node)

# --- Kiểm RBAC chặn đúng chỗ ---
curl -i -X POST localhost:3000/api/mint -H 'Content-Type: application/json' \
  -H 'Cookie: bidv_role=AUDITOR' \
  -d '{"chain":"mock","wallet":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","amount":"5"}'
# -> 403 FORBIDDEN, và AuditLog có dòng outcome=DENIED
```

⚠️ **Docker cần ≥ 4GB RAM.** VM Docker Desktop trên máy dựng thử chỉ có 1.9GiB và `next build` bị OOM-kill (exit 137) khi có container khác chạy song song. Đã hạ heap + giảm worker sinh trang tĩnh, nhưng nếu vẫn 137 thì tăng RAM cho Docker Desktop rồi `docker compose build web` lại.

## 4. DEVIATION so với spec

1. **`ITxnStore` dùng `pg` chứ không dùng Prisma Client** — `prisma/schema.prisma` VẪN là nguồn sự thật của lược đồ (`prisma/init.sql` do Prisma sinh ra từ nó bằng `npm run db:sql`), nên không có hai nguồn DDL. Lý do đổi client: Prisma Client sinh ra ~22MB (kèm query engine nhị phân), nhét vào bundle Cloudflare Worker là trái steering "build gọn / đồ nặng để lúc build"; `pg` ~0.5MB và nằm trong `serverExternalPackages` mặc định của Next. Phase 4 muốn dùng Prisma Client thì thêm một hiện thực `ITxnStore` nữa, nghiệp vụ không đổi.
2. **Thêm tầng `lib/bank/` (service)** giữa transport và các port, không có trong `design.md`. Lý do: cần hai transport (server action cho UI, route handler cho demo runner/e2e); nếu để logic ở transport thì RBAC/audit bị nhân đôi và dễ lệch.
3. **Thêm role `COMPLIANCE` và `AUDITOR`** ngoài 2 role PoC trong SPEC §4.3. Lý do: `structure.md` yêu cầu route-group `(audit)` chỉ đọc, nên cần một role thực sự không có quyền ghi để chứng minh guard hoạt động. Thêm role = thêm dòng dữ liệu, đúng thiết kế.
4. **Deploy `ProjectToken` với tên "Wind Power Project Token"** (ký hiệu vẫn là SPT theo SPEC §2). Comment trong `.sol` vẫn viết "điện mặt trời" — không sửa vì steering `solidity.md` yêu cầu không viết lại bộ contract đã pass test; chỉ đổi tham số lúc deploy.
5. **Chưa tạo route-group `(client)`** — P1 không có màn hình nào cho nhà đầu tư, tạo thư mục rỗng là rác. Ranh giới `(admin)`/`(audit)` đã dựng nên thêm `(client)` sau là việc thêm file.
6. **`output: "standalone"` bị tắt** — xem câu hỏi 1 dưới đây.

## 5. Câu hỏi mở / chỗ chưa chắc

### Câu hỏi 1 (P0 nếu free-tier là đường demo chính): build Cloudflare đang bị chặn

`npx opennextjs-cloudflare build` fail với `ENOENT .next/standalone/.next/server/pages-manifest.json`.

Nguyên nhân đã xác định: Next 16 **bắt buộc** `outputFileTracingRoot` và `turbopack.root` bằng nhau. Turbopack chỉ resolve được `@bidv/shared` (npm link ra ngoài `app/`) khi root là thư mục **cha** của cả hai, tức gốc repo. Nhưng root = gốc repo làm output thành `.next/standalone/app/.next/...`, còn `@opennextjs/cloudflare` đọc cứng `.next/standalone/.next/...`.

Đã thử 3 cấu hình (root=repo, root=app, bỏ hẳn `outputFileTracingRoot`) — đều va vào cùng ràng buộc, nên **dừng vá** theo quy tắc chống kẹt và chốt cấu hình chạy được cho DoD P0/P1. Hiện tại `output: "standalone"` bị tắt vì bật lên làm `next start` (đường docker đang chạy được) báo "does not work with output: standalone".

Ba cách sửa, xin Supervisor chọn:
- **(a) npm workspaces ở gốc repo, một lockfile duy nhất.** Đúng chuẩn monorepo mà cả Next lẫn OpenNext thiết kế cho. Rủi ro: hardhat vào chung install ở gốc, cần giữ được sự tách toolchain với `trex/` (0.8.17 + OZ v4).
- **(b) `install-links=true`** trong `.npmrc` → npm **copy** `packages/shared` vào `app/node_modules` thay vì symlink, nên root = `app/` là đủ. Rủ i ro: sửa `packages/shared` (kể cả `addresses.json` sinh lại sau deploy) phải `npm install` lại mới thấy — dễ thành footgun.
- **(c) Bước prep sau `next build`** tạo đúng layout mà OpenNext mong đợi. Nhanh nhất nhưng là hack, sẽ vỡ khi OpenNext đổi.

Đề xuất của tôi: **(a)**. Đây là cấu hình mà cả hai công cụ hỗ trợ chính thức, và giải quyết luôn việc repo hiện có 3 lockfile rời (OpenNext ghi rõ nhiều lockfile làm hỏng nhận diện monorepo). Nhưng nó chạm vào ranh giới toolchain contracts nên tôi không tự làm.

**Việc này KHÔNG chặn DoD P0/P1**: `npm run dev`, `next build`, `next start`, `docker compose up` đều chạy.

### Câu hỏi 2 (P1): "giao dịch lưu DB" ở Phase 1 nên hiểu thế nào?

Hai chỗ trong spec nói khác nhau:
- `docs/SPEC.md` §5 xếp **Postgres vào P4**, và §6 liệt KYC/audit thật vào non-goals.
- `tasks.md` "Nghiệm thu Phase 1" lại yêu cầu **giao dịch lưu DB** ngay.

Tôi đã làm **cả hai** để không phải đoán: `ITxnStore` có bản bộ nhớ (mặc định, cho free-tier) và bản Postgres (`docker compose` bật `USE_MOCK_DB=false`), đã kiểm chứng dữ liệu vào bảng thật. Nếu ý Sếp/Supervisor là Postgres để hẳn tới P4 thì chỉ cần đổi `USE_MOCK_DB=true` trong `docker-compose.yml`, không phải xoá code.

### Câu hỏi 3 (P2): 3 lỗi lint có sẵn, có nên sửa trong PR này?

`npx eslint .` báo 4 error. **1 lỗi của phase này đã sửa.** 3 lỗi còn lại là code có sẵn:
- `src/components/providers.tsx:27` và `src/components/layout/header.tsx:19` — mẫu `useEffect(() => setMounted(true), [])` để tránh hydration mismatch, bị rule mới `react-hooks/set-state-in-effect` của React Compiler chặn.
- `open-next.config.ts:7` — `any`.

Tôi không sửa vì đổi logic theme dễ gây hồi quy về mặt hiển thị, ngoài phạm vi P0/P1. Nhưng `npm run lint` đang đỏ nên cổng lint hiện không dùng được. Xin ý: sửa trong PR sau, hay để tôi làm luôn?

### Chỗ chưa chắc khác
- **`session.ts` PoC không xác thực**: vai trò đọc từ cookie do client tự đặt được. Đã ghi chú to trong code + `docs/SPEC.md` §6 liệt vào non-goals. Đây là lỗ hổng **có chủ ý** và phải đóng ở Phase 4 (SIWE) trước khi ra khỏi PoC.
- **Chain đang chọn không persist qua reload** (Zustand không dùng `persist`): cố tình, để render đầu tiên khớp server (không hydration mismatch) và để chain luôn được truyền tường minh vào server action. Nếu Sếp muốn giữ lựa chọn qua reload thì nên lưu bằng cookie để server đọc được cùng giá trị.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** Không có `viem`/`ethers` nào trong `components/` hay `app/*/route.ts`. `viem` chỉ xuất hiện ở `lib/ledger/evm.adapter.ts`, `lib/ledger/address.ts` (validate địa chỉ), `lib/chains/registry.ts` (`defineChain`), `lib/signer/*` (tạo account) và `lib/wagmi.ts` (ví client, chỉ dành cho thao tác NĐT). Kiểm nhanh:
  ```bash
  cd app && grep -rn "from 'viem'\|from \"viem\"" src/ | grep -v "src/lib/"   # rỗng
  ```
- [x] **Mọi ký qua `ISigner`.** `SERVER_SIGNER_PRIVATE_KEY` chỉ được đọc trong `lib/signer/server.signer.ts`. Kiểm nhanh:
  ```bash
  cd app && grep -rn "SERVER_SIGNER_PRIVATE_KEY" src/   # chỉ config/env.ts (khai báo) + signer/server.signer.ts (dùng)
  ```
- [x] **Mọi kiểm quyền qua RBAC.** Không có so sánh role cứng. Kiểm nhanh:
  ```bash
  cd app && grep -rn "role ===\|role ==" src/ | grep -v "src/lib/rbac/"   # rỗng
  ```
  Guard nằm ở service (`assertCan`), nên cả server action lẫn route handler đều đi qua. Mọi lần kiểm quyền được ghi audit, **kể cả lần bị chặn** (`outcome=DENIED`).

## 7. Đề xuất bổ sung `lessons.md` (Supervisor quyết)

Ba bài học rút từ phase này, nếu Supervisor thấy đáng thì nâng thành rule:

- **Mock dễ tính hơn contract thật** → SAI. Mock adapter phải mô phỏng đủ ràng buộc tuân thủ (chưa KYC / bị băng / paused), nếu không sẽ sinh lỗi "xanh ở mock, đỏ ở chain thật".
- **Đặt guard RBAC ở transport (component/route)** → SAI. Server action gọi được bằng POST trực tiếp; guard phải nằm ở tầng nghiệp vụ để thêm transport không lỡ mất kiểm quyền.
- **ABI tối giản viết tay mà không có test đối chiếu** → SAI. Lệch ABI chỉ lộ ra lúc runtime dưới dạng lỗi rất khó truy; phải có test so với ABI thật do deploy script xuất ra.
