# IN-04: ký Mint, Burn qua Fireblocks (Vault Account), công tắc "Lưu ký Fireblocks", yêu cầu

Nền: `dev` @ `8f75d38` (sau merge FIX-02, PR #77). Người viết: giám sát. Nguồn: quyết định của chủ dự án ngày 29/10/2026 (bàn giao mục 3.2ca, 3.2cb), kết quả thử Fireblocks Sandbox K0 (`claude/20261028_ket_qua_K0_fireblocks_sandbox.md`), câu hỏi màn chặn vai ngày 29/10.

## 1. Bối cảnh

- Hiện mọi giao dịch phía ngân hàng trên EVM ký bằng khoá riêng trên máy chủ (`SERVER_SIGNER_PRIVATE_KEY`), đi qua `write` của `lib/ledger/evm.adapter.ts`: `simulateContract` rồi `writeContract`, trả mã giao dịch ngay.
- Mint, Burn của ngân hàng đi theo luồng lập và duyệt: Giao dịch viên lập (`createTokenRequest`), Kiểm soát viên duyệt (`approveTokenRequest` ở `lib/bank/token-request.service.ts`). Lúc duyệt: chiếm quyền `PENDING` sang `EXECUTING`, gọi `executeIssuance` (`mint` hoặc `mintInitialSupply`, cần `MINTER_ROLE`) hoặc `executeBurn` (`burn`, cần `AGENT_ROLE`), gắn mã giao dịch (`attachRequestTxHash`), chờ biên nhận (`trackTxn`, 90 giây trên `evm`), chốt bằng `finalizeConfirmed`. Hết giờ thì giữ `EXECUTING` kèm mã, Kiểm soát viên bấm "Đối soát" (`reconcileTokenRequest`, HF-05).
- K0 đã chứng minh trên Sandbox: vault 11 (`0xc7F64D8101a3037850fd4896224cB48D4b1f83F1`) gọi hợp đồng bằng `CONTRACT_CALL`, đích `ONE_TIME_ADDRESS`, tài sản `ETH_TEST5`; diễn biến `SUBMITTED` (2 giây), `PENDING_SIGNATURE` (8 giây), `CONFIRMING` có `txHash` (14 giây), `COMPLETED` (55 giây). Sandbox tự duyệt, không cấu hình được chính sách (TAP). Vault thiếu ETH thì Fireblocks từ chối ngay (`INSUFFICIENT_FUNDS_FOR_FEE`), không lên chuỗi.
- Fireblocks nhận `externalTxId` do mình đặt, từ chối mã trùng (HTTP 400), và có `GET /v1/transactions/external_tx_id/{externalTxId}` để tra lại sau lỗi mạng.
- Màn chặn vai (`components/layout/channel-guard.tsx`) không có thanh trên cùng nên không đổi vai được; người dùng kẹt khi trình duyệt còn nhớ vai cũ.

## 2. Mục tiêu

1. Khi công tắc "Lưu ký Fireblocks" bật, lần duyệt Mint, Burn trên chain Sepolia (`evm`) gửi giao dịch qua Fireblocks từ một Vault Account của ngân hàng, thay cho khoá trên máy chủ. Công tắc tắt thì mọi thứ như hiện nay.
2. Không gửi trùng, không mất dấu: mỗi yêu cầu nhiều nhất MỘT giao dịch Fireblocks; mọi kết cục chưa rõ đều để `EXECUTING` và đối soát được.
3. Kết cục cuối vẫn do biên nhận trên chuỗi quyết định, không do trạng thái Fireblocks.
4. Màn chặn vai có nút về trang của vai hiện tại.
5. Không tăng số server action khi mở màn; không lộ khoá.

## 3. Quyết định

- **QĐ-1: Vault Account, không Embedded Wallets** (chủ dự án chốt 29/10). Một vault của ngân hàng (mặc định vault 11 của K0) giữ `MINTER_ROLE` và `AGENT_ROLE` trên `ProjectToken`.
- **QĐ-2: không dùng lớp duyệt của Fireblocks (TAP)**: Sandbox dùng chung không cho cấu hình. Lớp duyệt vẫn là lập và duyệt của ứng dụng. Ghi rõ trong UserGuide.
- **QĐ-3: phạm vi giao dịch**: chỉ ba lời gọi của luồng lập và duyệt: `mintInitialSupply`, `mint`, `burn` trên `ProjectToken`. Các đường khác (trang ẩn `/mint`, phát hành thử, đốt theo lô khi thu hồi BE-05, vault, chia lợi nhuận, VNDB) giữ khoá máy chủ.
- **QĐ-4: phạm vi chain và mã tài sản đi theo cặp**: biến `FIREBLOCKS_CHAIN_ASSETS` dạng `chain:assetId` cách nhau bằng dấu phẩy (mặc định `evm:ETH_TEST5`). Chỉ chain có trong bảng mới dùng Fireblocks, và dùng ĐÚNG mã tài sản ghi cạnh nó; không có mã tài sản chung cho mọi chain họ EVM. Chain ngoài bảng thì công tắc không có tác dụng (mock, `hardhat-local` ở môi trường thường). Bộ kiểm thử đặt `hardhat-local:<mã giả>` để chạy luồng thật trên nút Hardhat với Fireblocks giả.
- **QĐ-5: công tắc là cấu hình hệ thống dùng chung**, khoá `custody.fireblocks.enabled` trong `SystemConfig` (có lịch sử ở `SystemConfigHistory`), mặc định tắt khi chưa có dòng. Hiện cho Giao dịch viên và Kiểm soát viên; cả hai vai bật tắt được (quyền mới `custody:toggle`), mỗi lần đổi ghi sổ kiểm toán. Chỉ BẬT được khi Fireblocks đã cấu hình đủ; TẮT luôn được (mục 5 A3).
- **QĐ-6: cách thực hiện và bối cảnh ký chốt lúc chiếm quyền**: lần duyệt quyết định `custody` (`SERVER` hoặc `FIREBLOCKS`) theo công tắc và chain TẠI LÚC DUYỆT, và với `FIREBLOCKS` thì chụp lại bối cảnh ký KHÔNG bí mật (`custodyContext`: mã tham chiếu cấu hình, vault ID, địa chỉ ký, mã tài sản, chain, hợp đồng đích; mục E1), ghi vào yêu cầu trong cùng câu chuyển `PENDING` sang `EXECUTING`. Không lưu khoá API hay khoá RSA. Đối soát về sau theo giá trị đã ghi, không theo công tắc hay cấu hình hiện tại; `Txn.actorAddress` và dòng "Thực hiện qua" lấy địa chỉ, vault từ bối cảnh đã ghi.
- **QĐ-7: chống gửi trùng bằng `externalTxId` = mã yêu cầu.** Không gửi tiêu đề `Idempotency-Key` ở lời gọi tạo giao dịch (hướng dẫn hiện hành của Fireblocks: lời gọi tạo giao dịch dùng `externalTxId`, các POST khác mới dùng `Idempotency-Key`). Mỗi yêu cầu chỉ có một lời gọi tạo giao dịch, ở lần duyệt. Đối soát KHÔNG BAO GIỜ tạo giao dịch mới, chỉ tra.
- **QĐ-7b: không tự kết luận "Fireblocks không có giao dịch" theo thời gian.** Lần tạo chưa rõ kết quả thì yêu cầu giữ `EXECUTING` vô thời hạn; tra theo `externalTxId` nhận lỗi "No such External Tx ID" (HTTP 404, mã 1439) chỉ được hiểu là "chưa thấy", hiện cho Kiểm soát viên, không đổi trạng thái. Đóng tay yêu cầu kẹt thuộc task L-15 (đã ghi tồn đọng).
- **QĐ-7c: phân loại lỗi khi tạo giao dịch theo mã lỗi Fireblocks, không chỉ theo HTTP** (bảng mã lỗi chính thức):
  - mã 1438 ("External Tx ID Duplicate", HTTP 400): giao dịch ĐÃ có; tra lại theo `externalTxId`, đọc được thì đi tiếp, chưa đọc được thì giữ `EXECUTING`;
  - mã thuộc danh sách từ chối ĐỒNG BỘ `CREATE_REJECTED_CODES` = 900, 1409, 1502, 1503, 1004, 11001, 1407, 1402, 1404, 1424, 1432, -7, -8 (dữ liệu sai, tài sản sai, vault sai, không đủ quyền, không đủ số dư, địa chỉ sai, xác thực sai): Fireblocks không tạo giao dịch; tra lại theo `externalTxId` để chắc: nhận đúng 1439 thì `FAILED` "Fireblocks từ chối tạo giao dịch (mã <code>): <message>"; tra thấy giao dịch thì đi tiếp; tra lỗi khác thì giữ `EXECUTING`;
  - HTTP 429, 5xx, lỗi mạng, hết giờ, mã không có trong hai nhóm trên: chưa biết; tra lại, thấy thì đi tiếp, không thấy hoặc lỗi thì giữ `EXECUTING`.
  - Thứ tự xét: mã lỗi Fireblocks trước, HTTP sau (phản hồi 5xx mang mã thuộc nhóm từ chối vẫn là `REJECTED`; vẫn phải tra đúng 1439 mới `FAILED`).
- **QĐ-8: biên nhận là sự thật cuối; nghi ngờ thì giữ `EXECUTING`.** Có `txHash` (ở bất kỳ trạng thái Fireblocks nào) thì gắn vào yêu cầu và đi tiếp đúng đường biên nhận HF-05 hiện có. Chỉ chuyển `FAILED` khi CHẮC CHẮN chưa phát lên chuỗi: Fireblocks `CANCELLED`, `BLOCKED`, `REJECTED` không có `txHash`, hoặc `FAILED` không có `txHash` với `subStatus` `INSUFFICIENT_FUNDS_FOR_FEE` (đã thấy ở K0, bị từ chối trước khi phát). `FAILED` không mã với `subStatus` khác: giữ `EXECUTING`, lý do ghi rõ để đối soát tay (cùng nhóm nợ L-15).
- **QĐ-8b: một khi đã gọi tạo giao dịch Fireblocks thì không lối nào ghi `FAILED` ngoài các trường hợp ở QĐ-8 và QĐ-7c (nhóm từ chối đồng bộ).** Mọi lỗi phát sinh sau thời điểm gọi tạo (hỏi trạng thái lỗi, ghi `custodyTxId` lỗi, ghi `Txn` lỗi, chờ biên nhận lỗi, lượt thua QĐ-16, hàm thực hiện trả `err` vì lỗi lưu trữ) đều KHÔNG dẫn tới `FAILED`: lỗi nào làm lần thực hiện dừng thì yêu cầu giữ `EXECUTING`; lỗi chỉ log (ghi `custodyTxId` ở C3 bước 2, ghi `Txn` ở C4) thì đi tiếp theo C3, C4. Áp cho CẢ khối `catch` LẪN nhánh `!outcome.ok` của `approveTokenRequest`: khi cờ `fireblocksAttempted` bật, chỉ ghi `FAILED` với ba lý do được đánh dấu rõ trong kết quả (`DEAD`, `REJECTED` rồi 1439, biên nhận `FAILED`).
- **QĐ-9: kiểm trước khi gửi**: trước khi chiếm quyền, đọc vai trò của vault trên `ProjectToken` (Mint cần `MINTER_ROLE`, Burn cần `AGENT_ROLE`); thiếu thì chặn lần duyệt, yêu cầu giữ `PENDING`. Sau khi chiếm quyền, mô phỏng lời gọi với `from` là địa chỉ vault (`eth_call`); revert thì `FAILED`, không gửi gì tới Fireblocks.
- **QĐ-10: tự viết khách REST nhỏ** (`fetch` + Web Crypto ký JWT RS256), không dùng SDK `@fireblocks/ts-sdk`: chỉ cần ba endpoint, không thêm 395 KiB nén và `axios` vào Worker. K0 câu 6 đã chứng minh cả hai cách chạy trong workerd; đúng sai của JWT được kiểm bằng máy chủ giả có khoá công khai (mục 7) và lần chạy thật của chủ dự án (mục 9).
- **QĐ-11: khoá chỉ ở bí mật.** `FIREBLOCKS_API_KEY`, `FIREBLOCKS_SECRET_KEY` chỉ ở `.env` (gitignored) và Cloudflare Secrets do chủ dự án đặt. Lập trình viên không nhận khoá thật. Không ghi khoá, JWT, chữ ký vào log, sổ kiểm toán, câu lỗi.
- **QĐ-12: màn chặn vai**: chỉ thêm MỘT nút "Về trang của vai hiện tại" trỏ `CHANNEL_HOME[ROLE_CHANNEL[role]]`. Không sửa gì khác ở màn này (chủ dự án yêu cầu).
- **QĐ-13: giá trị công tắc tách khỏi khả năng dùng.** `enabled` là đúng giá trị người vận hành đã chọn; `configured` là cấu hình hiện có đủ hay không. Chọn `SERVER` CHỈ khi công tắc tắt hoặc chain ngoài bảng. Công tắc bật mà cấu hình thiếu, PEM lỗi hoặc đọc trạng thái lỗi: chặn lần duyệt, yêu cầu giữ `PENDING`; KHÔNG BAO GIỜ tự quay về khoá máy chủ.
- **QĐ-14: cấu hình đổi khi còn yêu cầu dở.** Đối soát một yêu cầu `FIREBLOCKS` dùng `custodyContext` đã ghi. Cấu hình hiện tại khác bối cảnh (mã tham chiếu cấu hình hoặc vault ID khác): không tra, giữ `EXECUTING`, báo "Cấu hình Fireblocks đã đổi so với lúc duyệt (vault <id>); phục hồi cấu hình cũ để đối soát.".
- **QĐ-15: khớp giao dịch trước khi chốt.** Với yêu cầu `FIREBLOCKS`, có biên nhận `CONFIRMED` rồi vẫn chỉ `COMPLETED` khi giao dịch trên chuỗi có `from` là địa chỉ ký trong bối cảnh, `to` là hợp đồng đích trong bối cảnh, và `keccak256(input)` bằng `callDataHash` đã ghi lúc chuẩn bị (chain đã cố định vì đọc qua ledger của chain yêu cầu). Không khớp: giữ `EXECUTING`, lý do "Giao dịch <hash> không khớp lời gọi đã chuẩn bị; cần đối soát tay.", audit FAILURE.
- **QĐ-16: một lượt gắn mã thắng, và chỉ lượt đó ghi `Txn`.** Gắn `txHash` cho yêu cầu `FIREBLOCKS` bằng câu có điều kiện (`EXECUTING` VÀ `txHash` đang NULL). Chỉ lượt gắn được mới ghi dòng `Txn` và đi tiếp tới biên nhận, chốt; lượt thua (dù là lần duyệt hay đối soát) đọc lại yêu cầu và trả kết quả `ok` dạng "chưa rõ" với câu "Yêu cầu đang được đối soát ở lượt khác.", KHÔNG ghi sổ kiểm toán. Với yêu cầu `FIREBLOCKS`, `syncTxnFromReceipt` CHỈ cập nhật dòng `Txn` đã có, không bao giờ thêm (bảng `Txn` không có khoá duy nhất theo mã; không đổi lược đồ `Txn` trong task này). Lượt thắng chết giữa lúc gắn mã và lúc ghi `Txn` thì thiếu một dòng `Txn` thông tin; yêu cầu vẫn có mã và sổ kiểm toán. Chốt cuối vẫn qua `finalizeTokenRequest` nguyên tử của HF-05.

## 4. Ngoài phạm vi

- Phía Nhà đầu tư (vault Nhà đầu tư, ký permit, rút VNDB qua vault), Embedded Wallets: nợ kỹ thuật định hướng.
- Chính sách TAP, webhook Fireblocks, Gas Station: không làm. Trạng thái lấy bằng hỏi lại (trong lần duyệt và khi bấm "Đối soát").
- Đóng tay yêu cầu kẹt `EXECUTING` (đường khoá máy chủ không mã giao dịch, và đường Fireblocks chưa rõ kết quả hoặc giao dịch không khớp): task riêng L-15 sau.
- Giao dịch Fireblocks bị thay mã (`replacedTxHash`, tăng tốc): hiếm, không xử lý; ghi nợ.
- Cấp quyền cho vault trên Sepolia, nạp ETH cho vault, đặt bí mật, triển khai: việc của chủ dự án (mục 9).

## 5. Yêu cầu chức năng

### A. Cấu hình và công tắc

- **A1.** Biến môi trường (đọc ở `lib/config/env.ts`, khai trong `.env.example` không có giá trị thật):
  - `FIREBLOCKS_API_KEY`, `FIREBLOCKS_SECRET_KEY` (bí mật; khoá riêng RSA dạng PEM PKCS#8 `BEGIN PRIVATE KEY`, cho phép `\n` thay xuống dòng);
  - `FIREBLOCKS_BASE_URL` (mặc định `https://sandbox-api.fireblocks.io`), `FIREBLOCKS_VAULT_ID`, `FIREBLOCKS_VAULT_ADDRESS`, `FIREBLOCKS_CHAIN_ASSETS` (mặc định `evm:ETH_TEST5`; mỗi phần tử `chain:assetId`, chain phải là ChainKey họ EVM; có phần tử sai thì cả bảng không dùng được, xem A2), `FIREBLOCKS_HASH_WAIT_MS` (mặc định 30000).
  - `wrangler.json` `vars`: `FIREBLOCKS_BASE_URL`, `FIREBLOCKS_VAULT_ID` `"11"`, `FIREBLOCKS_VAULT_ADDRESS` `"0xc7F64D8101a3037850fd4896224cB48D4b1f83F1"`, `FIREBLOCKS_CHAIN_ASSETS` `"evm:ETH_TEST5"`. Hai khoá KHÔNG có trong `wrangler.json`.
- **A2.** `fireblocksConfig()` trả cấu hình đã kiểm (KHÔNG chứa bảng chain; gồm `configRef` = 16 ký tự hex đầu của SHA-256(`baseUrl` + `|` + `apiKey`), không bí mật) hoặc `null` kèm lý do khi thiếu một trong các trường bắt buộc (hai khoá, `VAULT_ID`, `VAULT_ADDRESS` đúng dạng địa chỉ). Khoá sai định dạng PEM: `null` kèm lý do đọc được (không in khoá).
  - Bảng chain đọc riêng bằng `fireblocksChainScope()`, kết quả là MỘT trong hai: `{ ok: true; chainAssets }` khi chuỗi rỗng hợp lệ hoặc MỌI phần tử đều đúng dạng `chain:assetId` với chain là ChainKey họ EVM và không trùng chain; `{ ok: false; reason }` khi CÓ BẤT KỲ phần tử sai (không bỏ phần tử sai rồi dùng phần còn lại). Đọc độc lập với khoá, để QĐ-13 vẫn chặn đúng khi thiếu khoá. `fireblocksChainScope().chainAssets` là nguồn DUY NHẤT của bảng chain.
  - `FIREBLOCKS_CHAIN_ASSETS` đặt rỗng (`""`) là cấu hình hợp lệ chủ động "không chain nào dùng Fireblocks"; KHÔNG đặt biến thì dùng mặc định `evm:ETH_TEST5`.
- **A3.** Service `lib/bank/custody.service.ts`:
  - `getCustodyState()`: `{ enabled: boolean; configured: boolean; configError: string | null; scope: { ok: true; chainAssets: Partial<Record<ChainKey, string>> } | { ok: false; reason: string } }`; `enabled` là ĐÚNG giá trị khoá cấu hình (QĐ-13), không gộp với `configured`. Đọc lỗi thì NÉM lỗi (dùng ở lần duyệt).
  - `getCustodyStateForLayout()`: như trên nhưng đọc lỗi thì trả `{ enabled: false, unreadable: true, ... }` và ghi log (chỉ dùng ở `AppLayout` và dòng "Thực hiện qua").
  - `setFireblocksCustody({ enabled, reason? })`: `authorize('custody:toggle')`; BẬT khi chưa cấu hình thì `VALIDATION` "Chưa cấu hình Fireblocks (khoá API, vault); không bật được."; TẮT luôn được; ghi `setConfig` (lịch sử) và audit `custody:toggle` SUCCESS kèm giá trị cũ, mới.
  - `custodyFor(chain, state): 'SERVER' | 'FIREBLOCKS' | 'UNRESOLVED'` (hàm thuần): công tắc tắt là `SERVER`; công tắc bật mà bảng chain không đọc được (`scope.ok` false) là `UNRESOLVED`; bật, bảng hợp lệ, chain có trong bảng là `FIREBLOCKS` BẤT KỂ `configured` (thiếu cấu hình thì C1 chặn); bật, bảng hợp lệ, chain không có trong bảng là `SERVER`.
- **A4.** Quyền `custody:toggle` cho `TELLER`, `CONTROLLER` (`lib/rbac/permissions.ts`, cập nhật `test/rbac.test.ts`).
- **A5.** Thanh điều hướng (`Sidebar`), ngay trên khối trạng thái mạng ở đáy, chỉ khi vai là `TELLER` hoặc `CONTROLLER`: một dòng "Lưu ký Fireblocks" cùng màu chữ, cỡ chữ, khoảng đệm như các mục menu khác (dùng đúng lớp chữ của mục menu trong `sidebar.tsx`, KHÔNG tô đỏ), bên phải dòng là công tắc dạng viên thuốc: bật thì nền xanh lá, núm tròn trắng nằm bên phải; tắt thì nền xám, núm tròn trắng nằm bên trái (theo ảnh mẫu chủ dự án gửi 29/10); có hiệu ứng trượt ngắn khi đổi. Công tắc khoá thì mờ đi (`opacity-50`), con trỏ `not-allowed`. `AppLayout` đọc `getCustodyStateForLayout()` (một lần đọc database, không phải server action) và truyền xuống. Chưa cấu hình và đang tắt: công tắc khoá, `title` "Chưa cấu hình Fireblocks". Đang bật mà chưa cấu hình đủ: công tắc vẫn ở vị trí bật và bấm được để TẮT, dòng chữ nhỏ dưới "Thiếu cấu hình; lần duyệt sẽ bị chặn". Chain đang chọn không có trong bảng chain: dòng chữ nhỏ dưới "Không áp dụng cho chain này". Bảng chain sai (`scope.ok` false) mà công tắc bật: dòng chữ nhỏ "Bảng chain sai; lần duyệt sẽ bị chặn". Bấm công tắc: gọi `setFireblocksCustodyAction`, thành công thì `router.refresh()`; lỗi thì hiện câu lỗi ngắn dưới công tắc.

### B. Khách Fireblocks

- **B1.** `lib/custody/fireblocks-client.ts`, giao diện `FireblocksClient`:
  - `createContractCall({ externalTxId, vaultId, assetId, contract, data, note }): Promise<{ id: string; status: string }>`: `vaultId`, `assetId` LẤY TỪ `custodyContext` của yêu cầu do người gọi truyền vào; khách KHÔNG đọc vault hay tài sản từ cấu hình toàn cục (khách chỉ giữ `baseUrl`, khoá API, khoá RSA). `POST /v1/transactions`, thân `{ operation: 'CONTRACT_CALL', assetId, amount: '0', source: { type: 'VAULT_ACCOUNT', id: vaultId }, destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: contract } }, extraParameters: { contractCallData: data }, externalTxId, note }`;
  - `getByExternalTxId(externalTxId): Promise<FireblocksTx | null>`: `GET /v1/transactions/external_tx_id/{externalTxId}`; CHỈ phản hồi HTTP 404 có mã 1439 trả `null`, mọi lỗi khác (kể cả 404 không có mã 1439) ném;
  - lời gọi tạo KHÔNG gửi tiêu đề `Idempotency-Key` (QĐ-7);
  - `getById(id)`: `GET /v1/transactions/{id}`;
  - `FireblocksTx = { id; status; subStatus: string | null; txHash: string | null; externalTxId: string | null }`.
- **B2.** Xác thực mỗi yêu cầu: tiêu đề `X-API-Key`, `Authorization: Bearer <JWT>`, `Content-Type: application/json`. JWT RS256, phần thân `{ uri, nonce, iat, exp, sub, bodyHash }`: `uri` là đường dẫn kể cả `/v1` và chuỗi truy vấn; `nonce` UUID mới mỗi lần; `exp = iat + 25`; `sub` là khoá API; `bodyHash` là SHA-256 hex của ĐÚNG chuỗi thân gửi đi (chuỗi rỗng với GET). Ký bằng `crypto.subtle` (`RSASSA-PKCS1-v1_5`, `SHA-256`), khoá nhập một lần mỗi isolate.
- **B3.** Lỗi: `FireblocksHttpError { status, code: number | null, message }` cho phản hồi khác 2xx (đọc `message`, `code` trong thân nếu có; `code` dạng chuỗi số thì đổi sang số); hàm thuần `classifyCreateError(error): 'DUPLICATE' | 'REJECTED' | 'UNKNOWN'` theo QĐ-7c; lỗi mạng, hết giờ (`AbortSignal.timeout(15000)`) là `FireblocksNetworkError`. Câu lỗi không chứa khoá, JWT.
- **B4.** `lib/custody/fireblocks-config.ts` có `setFireblocksConfigForTest(override: { config: FireblocksConfig | null; chainAssets?: Partial<Record<ChainKey, string>> } | null)` (thay `fireblocksConfig()` bằng `config`; có `chainAssets` thì `fireblocksChainScope()` trả `{ ok: true, chainAssets }` mà KHÔNG qua bước kiểm họ EVM, nên test đưa được `mock` vào; không có thì đọc bảng từ biến môi trường như thường; `null` là bỏ ghi đè; chỉ dùng trong test). `test/helpers/fake-fireblocks.ts`: khách giả cài cùng giao diện, kịch bản điều khiển được (trả mã, chậm, lỗi mạng sau khi đã tạo, lỗi 400, trạng thái cuối âm), và chế độ "phát lên nút Hardhat": khi tạo, gửi `eth_sendTransaction` từ địa chỉ vault giả (tài khoản Hardhat đã mở khoá sẵn của nút) với đúng `to`, `data`, rồi trả `txHash`.

### C. Thực hiện lần duyệt qua Fireblocks

- **C1.** `approveTokenRequest`: sau lần kiểm lại điều kiện, tính `custody = custodyFor(chain, await getCustodyState())`. `UNRESOLVED`: chặn `REQUEST_CHECK` "Bảng chain của Lưu ký Fireblocks sai (<reason>); chưa duyệt được.", yêu cầu giữ `PENDING`. Đọc trạng thái lỗi: chặn `REQUEST_CHECK` "Không đọc được trạng thái Lưu ký Fireblocks; thử lại.", yêu cầu giữ `PENDING` (KHÔNG rơi về khoá máy chủ).
  - `FIREBLOCKS` mà `configured` false: chặn `REQUEST_CHECK` "Lưu ký Fireblocks đang bật nhưng thiếu cấu hình (<configError>); chưa duyệt được.", yêu cầu giữ `PENDING`.
  - Dựng `custodyContext` từ cấu hình hiện tại (QĐ-6), `assetId = scope.chainAssets[chain]`. Mọi bước sau (tạo, khớp, ghi `Txn`, đối soát) dùng giá trị trong bối cảnh, không đọc lại cấu hình toàn cục (trừ phép so QĐ-14).
  - Kiểm vai trò của vault (QĐ-9) bằng phương thức đọc mới của ledger EVM (mục D1); thiếu thì chặn `REQUEST_CHECK` câu "Vault Fireblocks <địa chỉ> chưa có quyền <MINTER_ROLE|AGENT_ROLE> trên ProjectToken.", ghi audit FAILURE như các lần chặn khác.
  - Chiếm quyền `PENDING` sang `EXECUTING` kèm `custody` và `custodyContext` (một câu, QĐ-6).
- **C2.** Đường `SERVER`: y như hiện nay, không đổi dòng nào ngoài việc truyền `custody`.
- **C3.** Đường `FIREBLOCKS` (`executeIssuance`, `executeBurn` nhận thêm tham số cách gửi; hàm gửi mới ở `lib/custody/fireblocks-execution.ts`, phụ thuộc truyền vào để kiểm riêng):
  1. Mô phỏng: `prepareContractCall` (mục D2) với `from` = địa chỉ ký trong bối cảnh, lấy `{ to, data }`; ghi `callDataHash = keccak256(data)` và `to` vào `custodyContext` bằng `setCustodyCall` (có điều kiện `EXECUTING`); `setCustodyCall` ném hoặc trả `null` thì `FAILED` "Không ghi được lời gọi đã chuẩn bị; chưa gửi Fireblocks." và DỪNG trước `markAttempted`. Revert khi mô phỏng: `FAILED` với lý do của hợp đồng, không gọi Fireblocks.
  2. Tạo: NGAY TRƯỚC lời gọi, đặt cờ `fireblocksAttempted = true` mà khối `catch` của `approveTokenRequest` đọc được (QĐ-8b: cờ bật thì `catch` không ghi `FAILED`, chỉ audit "chưa rõ, cần đối soát"). Gọi `createContractCall({ externalTxId: request.id, ... , note: 'IN-04 <MINT|BURN> <mã yêu cầu>' })`. Thành công: ghi `custodyTxId` (mục E1); ghi lỗi thì chỉ log, đi tiếp.
  3. Lỗi khi tạo: phân loại bằng `classifyCreateError` (QĐ-7c), rồi tra `getByExternalTxId(request.id)` trong MỌI nhóm:
     - tra thấy: dùng giao dịch đó, đi tiếp bước 4;
     - nhóm `REJECTED` và tra trả `null` (đúng 1439): `FAILED` "Fireblocks từ chối tạo giao dịch (mã <code>): <message>";
     - mọi trường hợp còn lại (nhóm `DUPLICATE` hoặc `UNKNOWN`, hoặc lần tra lỗi): KHÔNG biết, giữ `EXECUTING`, trả kết quả như nhánh hết giờ HF-05 (câu "Đã gửi Fireblocks, chưa rõ kết quả; bấm Đối soát sau.").
  4. Chờ mã: hỏi `getById` mỗi 3 giây, tối đa `FIREBLOCKS_HASH_WAIT_MS`, phân loại bằng `classifyFireblocksTx` (mục C5); một lần hỏi lỗi thì bỏ qua và hỏi tiếp, hết thời gian thì như `WAIT`:
     - `HASH`: MỘT đường duy nhất: `claimTxHash` (QĐ-16); trả `null` (thua) thì đọc lại yêu cầu và dừng với kết quả "chưa rõ", không ghi `Txn`, không ghi sổ kiểm toán; thắng thì dùng BẢN GHI MỚI do `claimTxHash` trả về (có `contract`, `callDataHash` đã ghi ở bước 1) cho mọi bước sau: ghi `Txn` với `actorAddress` là địa chỉ ký trong bối cảnh (ghi lỗi thì DỪNG, giữ `EXECUTING`, như ca 7b), chờ biên nhận (`trackTxn`, không gắn mã lần nữa), `CONFIRMED` thì khớp giao dịch (QĐ-15) bằng bối cảnh của bản ghi mới rồi mới `finalizeConfirmed`; biên nhận `FAILED` thì như đường `SERVER`;
     - `DEAD`: `FAILED`, lý do "Fireblocks <status>/<subStatus>, chưa phát lên chuỗi.";
     - hết thời gian vẫn `WAIT`: giữ `EXECUTING`, audit như nhánh hết giờ HF-05.
- **C4.** `reconcileTokenRequest`: yêu cầu `EXECUTING`, `custody = FIREBLOCKS`, chưa có `txHash`:
  - Thay nhánh trả lỗi sớm "chưa có mã giao dịch" hiện có bằng nhánh này (nhánh đó giữ nguyên cho `custody = SERVER`).
  - Kiểm QĐ-14 trước: cấu hình hiện tại thiếu, hoặc `configRef`, vault ID khác bối cảnh: giữ nguyên, trả câu của QĐ-14.
  - Tra: có `custodyTxId` thì `getById(custodyTxId)`, không thì `getByExternalTxId(request.id)`. Lỗi tra bất kỳ: giữ nguyên, trả câu "Chưa đọc được Fireblocks; thử lại.".
  - `null` (1439): giữ nguyên (QĐ-7b), trả câu "Fireblocks chưa có giao dịch của yêu cầu này (mã 1439); giữ Đang thực hiện, cần xử lý tay.". KHÔNG có nhánh tự `FAILED` theo thời gian, kể cả khi `custodyTxId` null;
  - có: phân loại như C3 bước 4 (không chờ, hỏi một lần); `HASH` thì gắn mã có điều kiện (QĐ-16): thua thì trả câu QĐ-16, không ghi gì; thắng thì dùng bản ghi `claimTxHash` trả về, ghi MỘT dòng `Txn` (`actorAddress` là địa chỉ ký trong bối cảnh, giống C3 bước 4), rồi đi tiếp đường đối soát bằng biên nhận hiện có với bản ghi mới, chèn bước khớp QĐ-15 trước `finalizeConfirmed`. Ghi `Txn` lỗi thì chỉ log, đi tiếp (QĐ-8b).
  - Có `txHash` rồi: đường biên nhận hiện có, chèn bước khớp QĐ-15 trước `finalizeConfirmed` cho yêu cầu `FIREBLOCKS`.
  - Không bao giờ gọi `createContractCall` (QĐ-7).
- **C5.** `classifyFireblocksTx(tx)` (hàm thuần): `txHash` khác rỗng là `{ kind: 'HASH', txHash }`; ngược lại `CANCELLED`, `BLOCKED`, `REJECTED`, hoặc `FAILED` với `subStatus === 'INSUFFICIENT_FUNDS_FOR_FEE'`, là `{ kind: 'DEAD', reason }`; `FAILED` với `subStatus` khác là `{ kind: 'WAIT', reason: 'Fireblocks FAILED/<subStatus> không có mã giao dịch; cần đối soát tay.' }`; còn lại `{ kind: 'WAIT' }`.
- **C6.** `canReconcile` (màn chi tiết): `EXECUTING` và (`txHash` khác null HOẶC `custody = FIREBLOCKS`), và vai có `order:approve`.
- **C7.** Màn chi tiết duyệt: thẻ "Nội dung yêu cầu" thêm dòng "Thực hiện qua": yêu cầu `PENDING` hiện cách sẽ dùng nếu duyệt bây giờ (`custodyFor` với `getCustodyStateForLayout()`, tính trong `getTokenRequestDetail`; đọc lỗi thì hiện "Chưa đọc được"), yêu cầu đã duyệt hiện `custody` đã ghi; giá trị "Khoá ký máy chủ" hoặc "Fireblocks, vault <id> (<địa chỉ rút gọn>)"; có `custodyTxId` thì thêm mã Fireblocks. Không thêm action.

### D. Ledger

- **D1.** `ILedgerPort` thêm phương thức tuỳ chọn `projectTokenRolesOf?(account): Promise<{ minter: boolean; agent: boolean }>` (đọc `hasRole` hai lần song song). Cài ở `evm.adapter.ts` (dùng chung cho `evm` và `hardhat-local`); mock, Stellar không cài.
- **D2.** Tuỳ chọn `prepareContractCall?(operation: 'mint' | 'mintInitialSupply' | 'burn', args, from): Promise<{ to: string; data: string }>`: `simulateContract` với `account` là địa chỉ `from` (chỉ địa chỉ, không khoá), lỗi đi qua `fail` hiện có để có câu revert đọc được; trả `to` là `ProjectToken`, `data` từ `encodeFunctionData`. Không gửi gì.
- **D2b.** Tuỳ chọn `transactionCallOf?(txHash): Promise<{ from: string; to: string | null; input: string } | null>` (đọc `getTransaction`), dùng cho QĐ-15.
- **D3.** Service gặp chain `FIREBLOCKS` mà ledger thiếu D1, D2 hoặc D2b: lỗi lập trình rõ câu (không xảy ra với cấu hình đúng vì `FIREBLOCKS_CHAIN_ASSETS` chỉ nhận họ EVM).

### E. Lưu trữ

- **E1.** `TokenRequest` thêm cột `custody TEXT NOT NULL DEFAULT 'SERVER'` (giá trị hợp lệ `TOKEN_REQUEST_CUSTODIES = ['SERVER', 'FIREBLOCKS']`), `custodyTxId TEXT NULL` và `custodyContext TEXT NULL` (JSON đã kiểm: `{ configRef, vaultId, address, assetId, chain, contract: string | null, callDataHash: string | null }`; đọc ra kiểm dạng, sai dạng là lỗi lập trình). Thêm vào `ADDED_COLUMNS` (`postgres.pool.ts`) cho database đang chạy; sinh lại `init.sql`.
- **E2.** `TokenRequestTransition` thêm `custody?`, `custodyContext?`; `transitionRequest` ghi trong cùng câu khi có. Phương thức mới (bản bộ nhớ và Postgres): `attachCustodyTxId({ id, custodyTxId })` chỉ ghi khi `EXECUTING`; `setCustodyCall({ id, contract, callDataHash })` chỉ ghi khi `EXECUTING`; `claimTxHash({ id, txHash })` chỉ ghi khi `EXECUTING` VÀ `txHash` NULL, trả `null` khi thua (QĐ-16).
- **E3.** `SubmitTxnInput` (`issuance.service.ts`) thêm `actorAddress?`; có thì dùng thay `signerAddressOrNull(chain)`. `syncTxnFromReceipt` với `custody = FIREBLOCKS` CHỈ cập nhật dòng `Txn` đã có (giữ `actorAddress` là địa chỉ ký trong `custodyContext`), không bao giờ thêm dòng (QĐ-16); với `custody = SERVER` giữ nguyên hành vi hiện tại.

### F. Màn chặn vai

- **F1.** `ChannelGuard`: thêm dưới câu hiện có một nút dạng liên kết "Về trang của vai hiện tại" trỏ `CHANNEL_HOME[ROLE_CHANNEL[role]]`. Không đổi chữ, bố cục khác.

### G. Kịch bản cho chủ dự án

- **G1.** `packages/contracts-evm/scripts/fireblocks-roles.js` theo mẫu `vault-admin.js`: hành động `status` (in hai vai của vault), `grant` (cấp `MINTER_ROLE`, `AGENT_ROLE` trên `ProjectToken` cho `FIREBLOCKS_VAULT_ADDRESS`), `revoke`; mặc định chỉ in kế hoạch, `FIREBLOCKS_ROLES_CONFIRM=yes` mới gửi. Ghi chú đầu tệp: `AGENT_ROLE` còn cho phép đóng băng, chuyển cưỡng bức; thu hồi khi thôi dùng.

## 6. Hiệu năng

- Mở màn: không thêm server action. `AppLayout` thêm một lần đọc khoá `SystemConfig` theo khoá chính, chỉ với hai vai vận hành. Đo số action và thời gian trả trang `/` (Giao dịch viên) trước và sau trên bản build, ghi checkpoint.
- Lần duyệt qua Fireblocks: tối đa `FIREBLOCKS_HASH_WAIT_MS` chờ mã cộng thời gian chờ biên nhận hiện có; hỏi Fireblocks mỗi 3 giây (khoảng 10 lần mỗi lần duyệt); thêm một lần đọc giao dịch trên chuỗi cho bước khớp QĐ-15.

## 7. Kiểm thử

Tệp mới `app/test/in-04-fireblocks.test.ts` (bộ nhớ, trừ ca ghi rõ); ca nút Hardhat ở `app/test/in-04-fireblocks-evm.test.ts` (`TEST_HARDHAT_RPC`, `setFireblocksConfigForTest` với bảng `hardhat-local:ETH_TEST5` (mã tài sản chỉ để khách giả ghi lại), khách giả chế độ phát lên nút, vault giả là tài khoản Hardhat #7 do test cấp vai bằng tài khoản #0).

| # | Ca |
|---|---|
| 1 | JWT: dựng máy chủ HTTP cục bộ, test tự sinh cặp khoá RSA; máy chủ kiểm chữ ký RS256 bằng khoá công khai, `uri` đúng đường dẫn và truy vấn, `sub` là khoá API, `exp - iat` không quá 30, `bodyHash` bằng SHA-256 của thân nhận được; POST và GET đều đạt; hai lần gọi có `nonce` khác nhau; gọi thẳng `signJwt` với đường dẫn có chuỗi truy vấn (`/v1/x?a=1`): `uri` giữ nguyên chuỗi truy vấn |
| 2 | Khách: 404 kèm mã 1439 của tra theo `externalTxId` trả `null`, 404 không có mã 1439 thì ném; 403 thì ném; 400 thành `FireblocksHttpError` có `status`, `message`; hết giờ thành `FireblocksNetworkError`; câu lỗi không chứa khoá API, không chứa `Bearer` |
| 3 | `fireblocksConfig`: thiếu từng trường thì `null` kèm lý do; PEM sai thì `null` kèm lý do không chứa khoá; `fireblocksChainScope`: bảng có chain lạ, `mock`, phần tử thiếu mã tài sản hoặc chain trùng thì CẢ bảng `ok: false`; bảng đọc được ngay cả khi thiếu khoá; `configRef` đổi khi đổi `baseUrl` hoặc khoá API |
| 4 | Công tắc: `TELLER`, `CONTROLLER` bật tắt được, có dòng lịch sử và audit; `INVESTOR`, `SELLER` `FORBIDDEN`; bật khi chưa cấu hình thì `VALIDATION`; tắt khi chưa cấu hình thì được; cấu hình mất sau khi bật: `enabled` VẪN true, `configured` false, `custodyFor` vẫn là `FIREBLOCKS` |
| 5 | `custodyFor` đủ các tổ hợp: tắt (bảng nào cũng `SERVER`); bật, bảng hợp lệ, chain trong hoặc ngoài bảng; bật, bảng rỗng chủ động (`""`): `SERVER`; bật, bảng có phần tử sai (`evm:`, `foo:X`, `mock:X`, chain trùng): `UNRESOLVED`. `fireblocksChainScope` không bỏ phần tử sai để dùng phần còn lại |
| 5b | Mức `approveTokenRequest`: công tắc bật, `FIREBLOCKS_CHAIN_ASSETS="evm:"` (sai dạng): chặn, `PENDING`, khoá máy chủ KHÔNG được gọi. Hai chain trong bảng với hai mã tài sản khác nhau (qua `setFireblocksConfigForTest`): thân POST của mỗi yêu cầu có đúng `assetId` và `source.id` trong `custodyContext` của nó; đổi cấu hình toàn cục sau lúc chiếm quyền không làm đổi thân POST |
| 6 | `classifyFireblocksTx`: có mã ở `CONFIRMING`, `COMPLETED`, `FAILED` đều `HASH`; `CANCELLED`, `BLOCKED`, `REJECTED` không mã và `FAILED`/`INSUFFICIENT_FUNDS_FOR_FEE` không mã là `DEAD`; `FAILED` không mã với `subStatus` khác là `WAIT` có lý do; `SUBMITTED`, `PENDING_SIGNATURE`, `BROADCASTING` không mã là `WAIT` |
| 7 | `fireblocks-execution` với phụ thuộc giả: mô phỏng revert thì `FAILED`, khách không được gọi; tạo lỗi mạng mà tra thấy thì đi tiếp có mã; tạo lỗi 400 mã 1503 và tra trả 1439 thì `FAILED`; tạo lỗi 400 mã 1438 và tra lỗi thì `EXECUTING` (KHÔNG `FAILED`); tạo lỗi 400 mã 1438 và tra trả 1439 thì `EXECUTING`; tạo lỗi 400 mã lạ và tra trả 1439 thì `EXECUTING`; tạo lỗi 429 thì `EXECUTING`; tạo lỗi mạng và tra trả 1439 thì `EXECUTING`; tra trả 404 không có mã 1439 thì coi là lỗi tra (`EXECUTING`); chờ hết giờ thì `EXECUTING`; `DEAD` thì `FAILED`. Mọi nhánh trừ nhánh mô phỏng revert: `createContractCall` được gọi đúng MỘT lần; lời gọi POST không có tiêu đề `Idempotency-Key` |
| 7b | Mức `approveTokenRequest` (bộ nhớ, chain `mock` đưa vào bảng bằng `setFireblocksConfigForTest`, `getLedger` bọc bằng `vi.mock` thêm `projectTokenRolesOf`, `prepareContractCall`, `transactionCallOf` giả): vault thiếu vai thì chặn, `PENDING`; đọc trạng thái công tắc lỗi khi bật thì chặn, `PENDING`, khoá máy chủ KHÔNG được gọi; công tắc bật mà cấu hình mất thì chặn, `PENDING`, khoá máy chủ KHÔNG được gọi; chiếm quyền ghi đủ `custodyContext`; sau khi gọi tạo mà `getById` luôn ném, `attachCustodyTxId` ném, hoặc `saveTxn` ném sau khi có mã (riêng nhánh `attachCustodyTxId` ném: khách giả `getById` luôn trả trạng thái chờ, không mã, tới hết `FIREBLOCKS_HASH_WAIT_MS`): yêu cầu đều còn `EXECUTING`, không `FAILED`; riêng nhánh `saveTxn` ném: đối soát sau đó tới `COMPLETED` và số dòng `Txn` của yêu cầu vẫn là 0 (giới hạn QĐ-16, bắt đột biến `syncTxnFromReceipt` thêm dòng) |
| 8 | Đối soát với khách giả: không mã, Fireblocks trả 1439: giữ, kể cả khi đặt `decidedAt` cũ hàng ngày và `custodyTxId` null; tra trả 403 hoặc 500 thì giữ, câu trả về đúng "Chưa đọc được Fireblocks; thử lại."; sau khi gắn mã, kết quả trả về có `txHash` mới; Fireblocks có mã thì gắn mã rồi đi đường biên nhận; `DEAD` thì `FAILED`; công tắc đã tắt sau khi duyệt vẫn đối soát qua Fireblocks; `createContractCall` KHÔNG được gọi |
| 9 | Công tắc tắt (mặc định): toàn bộ ca của `token-request.test.ts`, `fe-08-approval.test.ts` xanh không sửa; yêu cầu duyệt xong có `custody = 'SERVER'` |
| 10 | Chain ngoài danh sách khi công tắc bật (mock): đi khoá máy chủ, `custody = 'SERVER'` |
| 11 | Postgres (`TEST_DATABASE_URL`): ba cột mới có trên database cũ sau khi khởi động lại (`ADDED_COLUMNS`); chiếm quyền ghi `custody`, `custodyContext`; `attachCustodyTxId`, `setCustodyCall` không ghi khi yêu cầu không còn `EXECUTING`; `claimTxHash` lần hai trả `null` |
| 12 | Nút Hardhat: vault giả chưa có vai thì lần duyệt Mint bị chặn, yêu cầu giữ `PENDING`; cấp vai rồi duyệt Mint: `COMPLETED`, tổng cung tăng đúng, `Txn.actorAddress` là địa chỉ vault, giao dịch trên chuỗi có `from` là vault, `custody = 'FIREBLOCKS'`, `custodyTxId` có giá trị |
| 13 | Nút Hardhat: Burn "Phần chưa phân phối" qua vault giả: `COMPLETED`, số dư ví SPV giảm đúng |
| 14 | Nút Hardhat: khách giả chậm (không trả mã trong thời gian chờ, đặt `FIREBLOCKS_HASH_WAIT_MS` nhỏ): `EXECUTING`, `canReconcile` true; khách giả phát giao dịch; bấm đối soát: `COMPLETED`; số lần phát lên nút đúng 1; đúng MỘT dòng `Txn` của yêu cầu, `actorAddress` là địa chỉ vault |
| 15 | `ChannelGuard`: hàm thuần chọn đường về (tách `roleHomeHref(role)` trong một tệp `.ts`) trả đúng bốn vai |
| 16 | Đổi cấu hình khi còn `EXECUTING`: đổi `baseUrl` hoặc khoá API (đổi `configRef`), hoặc đổi vault ID, rồi đối soát: khách KHÔNG được gọi, yêu cầu giữ `EXECUTING`, câu QĐ-14; dòng "Thực hiện qua" và `Txn.actorAddress` vẫn là vault, địa chỉ cũ; khôi phục cấu hình cũ thì đối soát chạy bình thường |
| 17 | Tạo thành công nhưng `attachCustodyTxId` ném, khách giả `getById` luôn trả trạng thái chờ không mã: lần duyệt giữ `EXECUTING`; Fireblocks giả trả 1439 khi tra theo `externalTxId` (mô phỏng chưa đồng bộ); đối soát nhiều lần, kể cả sau khi đặt `decidedAt` cũ: KHÔNG `FAILED` |
| 18 | QĐ-15, chạy ở CẢ lần duyệt và lần đối soát: biên nhận `CONFIRMED` nhưng `transactionCallOf` trả `from` khác, `to` khác, hoặc `input` khác: không `COMPLETED`, giữ `EXECUTING`, có audit FAILURE; khớp đủ thì `COMPLETED`. Hàm thuần `matchesPreparedCall` với `contract` hoặc `callDataHash` null trả false |
| 18b | QĐ-8b ở nhánh `!outcome.ok`: sau `markAttempted`, hàm thực hiện trả `err` vì lỗi lưu trữ, hoặc lần duyệt là lượt thua QĐ-16: yêu cầu giữ `EXECUTING`; lượt thua không thêm dòng sổ kiểm toán nào. `setCustodyCall` trả `null`: `FAILED`, khách KHÔNG được gọi |
| 19 | Đồng thời (Postgres): (a) hai lượt đối soát cùng lúc, và (b) lần duyệt đang chờ cùng lúc với một lần đối soát, cùng thấy mã: đúng một lượt gắn được; không quá MỘT dòng `Txn` cho mã đó; chốt `COMPLETED` một lần, đúng một bộ dòng sổ chốt; lượt kia nhận câu "đang được đối soát ở lượt khác" hoặc trạng thái đã chốt |

Sửa ca có sẵn nếu cần: `test/rbac.test.ts` (quyền mới), `test/pending-markers.test.ts` (sinh lại bằng `node scripts/scan-pending.mjs --write-report` nếu thêm điểm cắm), `test/store-constraints.test.ts` nếu đụng.

Không thêm e2e (task gộp; khách Fireblocks giả chỉ có trong vitest). Ảnh ở mục 8.

Đột biến bắt buộc (ghi ca đỏ vào checkpoint): JWT `bodyHash` băm chuỗi khác chuỗi gửi; `uri` bỏ chuỗi truy vấn; `custodyFor` bỏ kiểm chain; chiếm quyền không ghi `custody`; đối soát gọi `createContractCall` khi không thấy; tạo lỗi mạng mà không tra lại; mã thuộc `CREATE_REJECTED_CODES` coi như chưa biết (giữ `EXECUTING`); lỗi mạng coi như chắc chắn chưa tạo (`FAILED`); `classifyFireblocksTx` coi `FAILED` có mã là `DEAD`; bỏ kiểm vai của vault; bỏ mô phỏng trước khi tạo; `canReconcile` bỏ nhánh `FIREBLOCKS`; công tắc không kiểm quyền; `catch` của lần duyệt ghi `FAILED` dù đã gọi tạo; đọc công tắc lỗi thì rơi về khoá máy chủ; tra lỗi 403 coi như không có (`null`); `enabled` gộp với `configured` (mất cấu hình thì về khoá máy chủ); gửi `Idempotency-Key` khi tạo; mã 1438 coi như từ chối (`FAILED`); 404 không mã 1439 coi như `null`; đối soát tự `FAILED` khi 1439 và đã lâu; bỏ kiểm `configRef` trong đối soát; bỏ bước khớp QĐ-15; `fireblocksChainScope` bỏ phần tử sai rồi dùng phần còn lại; khách lấy `assetId` từ cấu hình toàn cục thay vì tham số; ghi `Txn` trước `claimTxHash`; gắn mã không điều kiện (lượt thua ghi thêm `Txn`); nhánh `!outcome.ok` ghi `FAILED` dù đã gọi tạo; `setCustodyCall` trả `null` mà vẫn gọi tạo; `matchesPreparedCall` coi `callDataHash` null là khớp; `syncTxnFromReceipt` thêm dòng `Txn` cho yêu cầu `FIREBLOCKS`. (Tổng 31.)

## 8. Điều kiện hoàn thành

- [ ] A1 tới A5, B1 tới B4, C1 tới C7, D1 tới D3 (gồm D2b), E1 tới E3, F1, G1 đã làm.
- [ ] Vitest ca 1 tới 19 (gồm 5b, 7b, 18b) xanh (ca 11, 19 với `TEST_DATABASE_URL`, ca 12 tới 14 với `TEST_HARDHAT_RPC`, ghi lệnh và kết quả vào checkpoint); 31 đột biến đều bị bắt; đột biến "bỏ kiểm vai của vault" phải bị bắt bởi ca 7b (chạy không cần nút Hardhat).
- [ ] `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` (mock và hardhat), `arch markers checkpoint` xanh; các tệp `*-evm.test.ts` liên quan Mint, Burn chạy lại trên nút Hardhat xanh.
- [ ] Số action khi mở các màn không đổi; thời gian trả `/` trước và sau ghi trong checkpoint.
- [ ] Không có khoá, JWT trong mã, test, log, ảnh: lệnh quét khoá ở tasks bước 9 chỉ còn các dòng hằng đầu, cuối PEM (không có thân khoá), mỗi dòng ghi vào checkpoint; lệnh quét JWT rỗng.
- [ ] Ảnh trên `mock` vào `docs/images/in-04/` (tên có tiền tố ngày): thanh điều hướng Giao dịch viên có "Lưu ký Fireblocks" và công tắc (trạng thái chưa cấu hình); màn chặn vai có nút về trang của vai.
- [ ] Diff không thêm dòng chứa ký tự mũi tên, gạch dài, chấm giữa (trừ dòng do script sinh).
- [ ] Checkpoint có mục "Giới hạn đã chấp nhận" ghi đúng giới hạn QĐ-16 (tiến trình chết sau khi gắn mã, trước khi ghi `Txn` thì thiếu một dòng `Txn` thông tin) và QĐ-7b (yêu cầu chưa rõ giữ `EXECUTING` chờ L-15).
- [ ] `docs/USER_GUIDE.md` (công tắc; cách thực hiện ở màn duyệt; đối soát với Fireblocks; giới hạn: không có TAP, chỉ Mint, Burn); `docs/CHECKPOINT_IN04.md` có mục "Việc của chủ dự án" chép mục 9; `.kiro/task-status.json`.

## 9. Việc của chủ dự án sau khi merge (không phải điều kiện của PR)

1. Nạp SepoliaETH vào vault 11 (đủ cho vài chục giao dịch).
2. Trên máy mình, với khoá quản trị trong `.env`: `FIREBLOCKS_VAULT_ADDRESS=0xc7F6... npx hardhat run scripts/fireblocks-roles.js --network sepolia` (xem kế hoạch), rồi chạy lại với `FIREBLOCKS_ROLES_CONFIRM=yes`.
3. `wrangler secret put FIREBLOCKS_API_KEY`, `wrangler secret put FIREBLOCKS_SECRET_KEY` (PEM PKCS#8; khoá dạng `BEGIN RSA PRIVATE KEY` thì đổi bằng `openssl pkcs8 -topk8 -nocrypt`).
4. Trước khi bật công tắc: chạy đường `/lookup404` của bộ thử K0 câu 6 (`20261029_k0_cau6_fireblocks_workers.zip`) và gửi Supervisor mã HTTP và thân phản hồi (không gửi khoá). Kết quả mong đợi: HTTP 404, mã 1439. Khác thì báo để sửa B1 trước khi bật (khách chỉ coi đúng 404/1439 là "chưa thấy").
5. Triển khai, bật công tắc, lập và duyệt một Mint nhỏ rồi một Burn nhỏ trên Sepolia; kiểm trên Etherscan người gửi là vault; gửi Supervisor mã yêu cầu và mã giao dịch.
