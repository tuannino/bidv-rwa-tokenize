# BE-17 — các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md`, `tech.md`, `checkpoint.md`.
> Nhánh `feat/auto-settle` từ `dev` @ `456ab54`. Chuyển `BE-17` sang `inProgress` ở commit đầu.
>
> Task này sửa một luồng **đang chạy** và đụng tiền. Đọc kỹ mục "Nguyên tắc thiết kế phải giữ" của
> `requirements.md` trước khi viết dòng mã đầu tiên.

## Bước 0 — Đo lại hiện trạng

```bash
grep -n "executeOrder\|placeOrder" app/src/lib/bank/purchase.service.ts | head -20
grep -n "PLACED\|CHECKING\|EXECUTING" app/src/lib/store/order.store.port.ts | head
cd app && npx vitest run test/purchase-service.test.ts test/purchase-state.test.ts
```

Ghi lại số ca xanh **trước khi sửa**. Cuối task so lại: số ca chỉ được tăng, không được giảm. Ca
nào buộc phải đổi kỳ vọng thì ghi thành một mục riêng trong checkpoint kèm lý do.

## Bước 1 — Tách phần thân quyết toán, chưa đổi hành vi

Việc 1 của `requirements.md`. Đây là bước **thuần tái cấu trúc**: tách xong thì toàn bộ ca test cũ
phải còn xanh y nguyên, không sửa một ca nào. Nếu phải sửa test ở bước này nghĩa là đã đổi hành vi,
dừng lại và xem lại.

Commit: `refactor(purchase): tách thân quyết toán dùng chung cho hai đường`

## Bước 1b — Khóa chống trùng khi đặt lệnh

Việc 8 tới 14. **Làm trước đường tự động**, vì đường tự động biến việc bấm hai lần thành tiêu tiền
hai lần. Thứ tự: cột và ràng buộc duy nhất ở lược đồ trước, rồi hai bản hiện thực lưu trữ, rồi bộ
kiểm thử ràng buộc dùng chung, cuối cùng mới tới nghiệp vụ.

Ca 11 phải dựng được tình huống **song song thật**, không phải gọi tuần tự hai lần: chỗ này đang
kiểm ràng buộc của cơ sở dữ liệu, mà đọc rồi ghi thì chạy tuần tự vẫn xanh.

Commit: `feat(be-17): khóa chống trùng theo cặp ví và mã yêu cầu`

## Bước 2 — Đường tự động

Việc 2, 3, 4, 5. Làm ca 5 **trước** khi nối đường tự động vào `placeOrder`: nó là ràng buộc quan
trọng nhất của task, và viết test sau khi code xong thì dễ viết theo đúng thứ mình vừa làm.

Chạy phép đột biến thứ nhất ngay sau bước này, dán kết quả thật vào checkpoint.

Commit: `feat(be-17): lệnh hợp lệ tự quyết toán ngay sau khi đặt`

## Bước 3 — Đường can thiệp và sổ kiểm toán

Việc 6, 7, 15, 16, 17. `executeOrder` giữ nguyên chữ ký và vẫn kiểm `order:execute`. Sổ kiểm toán
phải phân biệt được hai đường: người đối soát mở sổ lên phải trả lời được "lệnh này tự chạy hay có
người bấm".

Ba nhánh của bảng trong `requirements.md` phải là ba nhánh **tường minh trong mã**, không suy ra từ
một điều kiện gộp. Nhánh `EXECUTING` chưa có mã giao dịch là nhánh dễ bị "dọn" nhất ở lần tái cấu
trúc sau, nên viết chú thích nêu rõ vì sao không được gửi lại.

Chạy phép đột biến thứ hai và thứ ba ở đây.

Commit: `feat(be-17): giữ đường can thiệp tay và ghi rõ hai đường trong sổ kiểm toán`

## Bước 4 — Giao diện tối thiểu

Việc 10 và 11. **Không dựng lại màn nào.** Màn Giao dịch token chỉ đổi phần hiện kết quả; màn Giao
dịch vận hành chỉ đổi điều kiện hiện nút và chữ đi kèm.

Commit: `feat(be-17): màn phản ánh đúng luồng tự khớp, nút khớp chỉ cho lệnh kẹt`

## Bước 5 — Hướng dẫn và sơ đồ

Việc 12. Sửa `docs/guide.md` mục 5.2 và mục 6, rồi **đi lại toàn bộ hướng dẫn từ bản sạch**, mỗi
bước bấm được thật mới đánh dấu xong. Đây là phép kiểm duy nhất bắt được loại lỗi mà OP-02 vừa phải
đi sửa, nên đừng bỏ.

Sinh lại sơ đồ luồng:

```bash
node scripts/gen-flow-diagram.mjs
```

Commit: `docs(be-17): hướng dẫn theo luồng tự khớp, sinh lại sơ đồ purchase`

## Bước 6 — Kiểm chứng và bàn giao

```bash
bash scripts/run-local-all.sh
cd app && npx playwright test
```

Viết `docs/CHECKPOINT_BE17.md` theo `docs/CHECKPOINT_TEMPLATE.md`, mục 0 đối chiếu đủ **12** điều
kiện hoàn thành kèm số mục chứa bằng chứng, dán kết quả thật của ba phép đột biến và bảng đi lại
hướng dẫn. Thêm hai dòng nợ kỹ thuật P2: tiến trình quét lệnh kẹt, và việc tách ký khỏi phát giao
dịch gắn vào SC-03. Chuyển `BE-17` sang `done`. Cập
nhật `docs/tech-report.md` mục 4.2.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE17.md docs/be-17-auto-settle/requirements.md
```
