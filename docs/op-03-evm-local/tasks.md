# OP-03: các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md`, `tech.md`, `checkpoint.md`, và
> `docs/GIAO_VIEC_DOT_5.md` bản 3 (trong gói spec này).
> Nhánh `ops/03-evm-local` từ `dev` @ `e4dd889`.
>
> SC-02 chạy song song. Ranh giới: task này **không** sửa hợp đồng, adapter, ABI, `ILedgerPort`.
> Cả hai cùng sửa `deploy.js` ở hai chỗ khác nhau, và cùng sửa `task-status.json`; ai merge sau thì
> rebase rồi chạy lại toàn bộ.

## Bước 0: Tiếp nhận và đo lại

Commit đầu: thay `docs/GIAO_VIEC_DOT_5.md` bằng bản 3, cập nhật `task-status.json` theo mục 7 của
bản đó (thêm đúng chín mã vào `planned`, chuyển `OP-03` sang `inProgress`). Chạy
`node scripts/check-pending-markers.mjs` để chắc tập mã hợp lệ vẫn đúng.

Chạy lại các lệnh ở "Hiện trạng đã đo". Số đo khác spec thì dùng số đo thật, ghi vào checkpoint.

Commit: `chore(op-03): tiếp nhận spec, cập nhật kế hoạch đợt 5 tới 8`

## Bước 1: Dựng chuỗi cục bộ

Việc 1, 2, 3. Kiểm ca 1 tới 5 ngay ở bước này.

Commit: `feat(op-03): dựng hardhat một lệnh, triển khai không làm bẩn cây, ví mẫu trên chuỗi`

## Bước 2: Đầu cuối trên bản build

Việc 4. Chạy bộ đầu cuối `mock` ba lần liên tiếp trên bản build, khi **không** có nút hardhat chạy.
Dán số ca và thời gian từng lần vào checkpoint.

Commit: `test(op-03): đầu cuối chạy trên bản build`

## Bước 3: Project hardhat và phần `evm`

Việc 5, 6, 7. Kiểm ca 6 và ca 8.

Commit: `test(op-03): bộ đầu cuối trên hardhat, thêm vào CI`

## Bước 4: Việc kèm

Việc 8, 9, 10. Với việc 10, checkpoint có bảng "biến, giá trị đặt, mặc định trong mã ở dòng nào".

Commit: `chore(op-03): log lỗi tự quyết toán, nợ lệnh PLACED, biến công khai cho Worker`

## Bước 5: Tài liệu và bàn giao

Việc 11. Đi lại `docs/EVM_LOCAL.md` từ một bản clone sạch, đúng từng lệnh trong tài liệu.

```bash
bash scripts/run-local-all.sh
bash scripts/run-local-all.sh build e2e
bash scripts/run-local-all.sh evm
```

Viết `docs/CHECKPOINT_OP03.md`. Mục 0 đối chiếu đủ **9** điều kiện hoàn thành. Chuyển `OP-03` sang
`done`, cập nhật `docs/tech-report.md`.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP03.md docs/op-03-evm-local/requirements.md
```
