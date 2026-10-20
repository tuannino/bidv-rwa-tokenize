# HF-01: hotfix hiệu năng, cắt lượt gọi Worker thừa khi mở trang

> Mức kiểm chứng: **vừa** (giao diện và cách gọi; không đổi nghiệp vụ, quyền, dữ liệu, hợp đồng).
> Nhánh `fix/hf-01-hieu-nang` từ `dev` @ `dd00e12`. Supervisor tự làm theo chỉ định của chủ dự án ngày 21/10/2026 (hệ thống chậm trên production).

## Mục tiêu

Trang mở nhanh lại trên Cloudflare Workers bằng cách bỏ các lượt gọi Worker thừa. Không đổi số liệu nào trên màn.

## Hiện trạng đã đo (bản `dd00e12`, 21/10/2026)

- `/api/version` (không chạm DB), 15 lần: khoảng 40% mất 1 đến 2,5 giây; lần ấm 0,15 đến 0,35 giây.
- `wrangler dev` cục bộ: lần gọi đầu 1,1 đến 1,5 giây, lần sau 13 đến 27 ms; bản 14/10 như nhau.
- `/seller/withdraw` (Playwright): tài liệu 0,66 giây; hydrate xong khoảng 2,0 giây; 4 server action chạy nối tiếp từ 2,0 đến 4,1 giây; 10 yêu cầu prefetch RSC cho link menu, 8 bị huỷ rồi gửi lại.
- `createPublicClient({ transport: http(rpcUrl) })`: mỗi `eth_call` một yêu cầu HTTP; một lượt Worker mở tối đa 6 kết nối ra ngoài cùng lúc.

## Việc cần làm

1. Menu bên trái (`sidebar.tsx`): không gọi `getPendingWorkAction` khi chain đang chọn là chain mặc định (Server Component đã đọc số cho chain này ở mọi lần kết xuất). Chain khác giữ cách cũ.
2. Mọi `Link` trong menu bên trái đặt `prefetch={false}`.
3. Màn rút (`seller-withdraw.tsx`): thay cặp `reconcileWithdrawRequestsAction` rồi `listMyWithdrawRequestsAction` bằng một action `reconcileAndListMyWithdrawRequestsAction` làm đúng hai việc đó trong một lượt.
4. Client đọc EVM (`evm.adapter.ts`): `http(rpcUrl, { batch: { batchSize: 20 } })`. Client ghi giữ nguyên.

## Tác động

- `app/test/hf-01-hieu-nang.test.ts` (mới), `be-13-withdraw`, `seller-vault`, `four-roles-shell`, `op07-chain-scope`.
- Kiểm thử EVM trên nút Hardhat thật: `evm-issuance`, `be-13-vault-evm`, `evm-order-settlement`, `fe-05-permit-evm`, `sc-06-distribution-evm`, `vault`.
- e2e trong `run-local-all.sh` (menu, màn rút).

## Điều kiện hoàn thành

- [ ] Bốn việc ở mục "Việc cần làm" có trong mã, kiểm bởi `test/hf-01-hieu-nang.test.ts` ca 1 đến 4
- [ ] Kiểm thử EVM ở mục "Tác động" xanh trên nút Hardhat thật, từng tệp một
- [ ] `bash scripts/run-local-all.sh` xanh
- [ ] `/seller/withdraw` chạy bản dựng của nhánh: số server action khi mở giảm từ 4 xuống 2, không còn prefetch RSC cho link menu
- [ ] `docs/tech-report.md` mục 1.6 A có bài học, mục C có nợ PERF-01 và khởi động nguội

## Không làm

- Không gộp action của `/vault`, `investor-trade` (ghi nợ PERF-01).
- Không thu gọn gói Worker, không bật Smart Placement.
- Không đổi nghiệp vụ đối soát, quyền, lược đồ.
