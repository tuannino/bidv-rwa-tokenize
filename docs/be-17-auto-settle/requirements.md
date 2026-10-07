# BE-17 — Tự khớp lệnh mua và bán theo tài liệu yêu cầu

| | |
|---|---|
| Nhánh | `feat/auto-settle`, từ `dev` @ `456ab54` (sau khi OP-02 merge qua PR #39) |
| Điểm | 10 |
| Mức kiểm chứng | **Cao** (chuyển tài sản của khách hàng và của SPV) |
| Thứ tự | **làm trước FE-08**; nó sửa luồng mua đang sai so với tài liệu yêu cầu |
| Người làm | Codex hoặc Claude Code |

## Mục tiêu

Hiện mỗi lệnh mua hay bán nằm ở trạng thái `PLACED` cho tới khi **một người** có quyền
`order:execute` bấm nút Khớp lệnh. Tài liệu yêu cầu nói ngược lại. Task này đưa luồng về đúng tài
liệu: lệnh hợp lệ tự quyết toán, Giao dịch viên chỉ theo dõi và can thiệp khi cần.

## Hiện trạng đã đo

**Tài liệu yêu cầu người sử dụng, bản 29/09, trang 11 mục 3** ghi nguyên văn tiêu đề luồng là
*"Luồng mua / bán token (NĐT – tự khớp)"*, và câu đầu là *"Mọi lệnh hợp lệ được tự khớp với người
bán."* Bảng các bước có bốn bước, và **bước 3 ghi vai trò là "Hệ thống"**:

| Bước | Vai trò | Thao tác |
|---|---|---|
| 1 | NĐT | Chọn token, nhập số lượng; khối kiểm tra trước lệnh phải đạt 5 điều kiện |
| 2 | NĐT | Bấm xác nhận lệnh. Trạng thái chạy: Đã tạo, Đang kiểm tra, Đang xử lý, Đang quyết toán. Màn hiện "Processing order" |
| 3 | **Hệ thống** | Kiểm khối lượng, giá, số dư, tồn kho, thanh khoản; **ghi 4 bút toán**. Thành công thì Hoàn tất kèm mã giao dịch |
| 4 | NĐT | Mở Quản lý lệnh xem chi tiết |

Trang 21 mô tả tiến trình lệnh là năm bước `ORDER CREATED`, `VALIDATION`, `BALANCE CHECK`,
`SETTLEMENT`, `COMPLETED`; **không có bước nào chờ người bấm**. Trang 30 mục 3.3 nói màn Giao dịch
của Giao dịch viên dùng *"để theo dõi và **can thiệp khi cần**"*.

Trong mã nguồn, đo được:

```bash
grep -n "executeOrder" app/src/lib/bank/purchase.service.ts app/src/app/actions/purchase.ts
# khong co loi goi tu dong nao sau placeOrder
grep -n "PLACED" app/src/lib/store/order.store.port.ts
# PLACED -> CHECKING -> EXECUTING -> COMPLETED
```

`placeOrder` lưu lệnh ở `PLACED` rồi dừng. `executeOrder` kiểm `order:execute` mà chỉ `TELLER` có.
Nên không có đường nào đưa lệnh đi tiếp ngoài người bấm.

**Vì sao thành ra thế.** Sơ đồ P4 bản đầu có bước 12 *"BIDV - Đối soát & xác nhận đã nhận VNDB"*.
Chủ dự án sau đó chốt quy trình mua **nguyên tử**, và chính spec BE-02 mục 2 đã ghi *"không còn bước
ngân hàng đối soát thanh toán thủ công"*. Nhưng BE-02 tách hai lời gọi mà **không chỉ định ai gọi
`executeOrder`**, nên bước thủ công quay lại dưới dạng một nút bấm. Đây là lỗi của spec BE-02, không
phải của người đã làm.

## Nguyên tắc thiết kế phải giữ

Tách **quyền** `order:place` và `order:execute` là ĐÚNG, giữ nguyên. Lý do vẫn còn nguyên giá trị:
giao dịch quyết toán do ví ngân hàng ký và nó chuyển WPT ra khỏi ví thanh toán SPV, nên gộp hai
quyền thì ai đặt được lệnh cũng tự rút được token khỏi ví SPV theo ý mình.

Cái sai không phải tách quyền, mà là **không ai cầm quyền đó để chạy tự động**. Cách sửa:

> Đường **tự động** không lấy thẩm quyền từ vai của phiên, mà từ **chính bản ghi lệnh** vừa được
> tạo và đã qua đủ bộ kiểm. Đường **thủ công** giữ nguyên `order:execute` và trở thành đường can
> thiệp của Giao dịch viên.

Điều này an toàn vì ba lẽ: tham số quyết toán lấy từ bản ghi lệnh chứ không từ dữ liệu người dùng
gửi lên; bộ kiểm đã chạy trước khi lệnh được tạo; và quyết toán là nguyên tử nên nhà đầu tư không
thể nhận token mà không trả tiền.

## Việc cần làm

**Nghiệp vụ**

1. Tách phần thân quyết toán của `executeOrder` thành một hàm nội bộ dùng chung, không đổi hành vi:
   vẫn chiếm trạng thái chống gửi hai lần, vẫn chạy `runOrderChecks`, vẫn `sendAndSettle`, vẫn đọc
   lại số dư từ chuỗi sau khi xong.
2. `placeOrder` sau khi lưu lệnh thành công thì **gọi tiếp** hàm nội bộ đó cho **đúng lệnh vừa tạo**.
3. ⚠️ **Ràng buộc quan trọng nhất của task:** đường tự động CHỈ quyết toán được lệnh vừa tạo trong
   cùng lời gọi. Nó KHÔNG nhận `orderId` từ bên ngoài. Nhận được mã lệnh tuỳ ý là mở đúng lỗ hổng mà
   việc tách hai quyền sinh ra để bịt.
4. Kết quả trả về của việc đặt lệnh phải mang **trạng thái cuối** sau quyết toán, kèm mã giao dịch
   khi thành công, để màn hiện đúng thay vì hiện "Đã đặt" rồi đứng im.
5. Quyết toán trượt **không** làm việc đặt lệnh trượt theo: lệnh vẫn tồn tại ở trạng thái phản ánh
   đúng chỗ dừng, kèm lý do, để Giao dịch viên can thiệp được. Nhà đầu tư thấy lỗi rõ ràng.
6. `executeOrder` giữ nguyên chữ ký, giữ nguyên kiểm `order:execute`, và trở thành **đường can
   thiệp**: dùng cho lệnh kẹt ở `CHECKING` hoặc `EXECUTING` vì tiến trình chết giữa chừng.
7. Ghi sổ kiểm toán phân biệt được hai đường: tự động và can thiệp tay. Người đối soát phải trả lời
   được "lệnh này tự chạy hay có người bấm".

**Khóa chống trùng khi đặt lệnh** (bổ sung 07/10 theo phát hiện của người làm)

Đo được: `placeOrder` **không có khóa chống trùng nào**.

```bash
grep -n "clientRequestId\|idempot\|requestId" app/src/lib/bank/purchase.service.ts app/prisma/schema.prisma
# rỗng
```

Trước BE-17 điều này chưa nguy hiểm: bấm hai lần tạo hai lệnh `PLACED`, và có người nhìn thấy
trước khi bấm khớp. Sau BE-17 thì **bấm hai lần là tiêu tiền hai lần**. Tự động hoá làm một khiếm
khuyết sẵn có trở thành lỗi mất tiền, nên phải đóng trong cùng task.

8. Thêm `clientRequestId` dạng UUID vào dữ liệu vào của việc đặt lệnh, và một cột tương ứng trong
   bảng lệnh.
9. Ràng buộc duy nhất theo **cặp `(investorWallet, clientRequestId)`**, KHÔNG duy nhất toàn cục.
   Lý do: duy nhất toàn cục cho phép một nhà đầu tư gửi mã trùng mã của người khác để dò xem mã đó
   đã tồn tại chưa, hoặc để chặn lệnh của người khác.
10. Gọi lại **cùng mã, cùng nội dung**: trả về đúng lệnh cũ kèm trạng thái hiện tại, KHÔNG tạo lệnh
    mới và KHÔNG quyết toán lần hai.
11. Gọi lại **cùng mã, khác nội dung**: từ chối, nêu rõ mã đã dùng cho một lệnh khác.
12. Chống trùng phải do **ràng buộc duy nhất của cơ sở dữ liệu** chặn, không phải đọc rồi ghi: hai
    lời gọi song song đều đọc thấy "chưa có" rồi cùng ghi là đúng tình huống phải chặn.
13. Mã do phía giao diện sinh **một lần cho mỗi lần người dùng xác nhận lệnh**, không sinh lại khi
    gửi lại. Sinh lại mỗi lần gửi thì khóa không bảo vệ được gì.
14. Ràng buộc mới phải có ở **cả hai bản hiện thực** lưu trữ và vào bộ kiểm thử ràng buộc dùng chung.

**Gửi lại an toàn một lệnh đang dở** (bổ sung 07/10 theo phát hiện của người làm)

Đo được trong `sendAndSettle`: giao dịch gửi đi trước, `attachOrderTxHash` lưu mã giao dịch sau.
Giữa hai việc đó có một khoảng trống. Tiến trình chết đúng lúc đó thì lệnh nằm ở `EXECUTING`
**không có mã giao dịch**, mà giao dịch có thể đã lên chuỗi. Gửi lại là tiêu tiền hai lần.

15. Đường can thiệp xử lý theo đúng ba nhánh, không gộp:

| Trạng thái lệnh | Được làm gì |
|---|---|
| `CHECKING` | Chạy tiếp bộ kiểm và **được gửi** giao dịch. Chưa có gì lên chuỗi nên gửi là an toàn |
| `EXECUTING` **có** mã giao dịch | **Chỉ đối soát biên nhận** rồi chốt trạng thái. Tuyệt đối không gửi lại |
| `EXECUTING` **chưa có** mã giao dịch | **KHÔNG gửi lại.** Đánh dấu cần đối soát tay, nêu rõ lý do |

16. Nhánh thứ ba không thêm trạng thái mới: điều kiện "cần đối soát" suy ra từ trạng thái
    `EXECUTING` cộng mã giao dịch rỗng. Màn Giao dịch hiện rõ dấu hiệu đó và **không** cho bấm gửi.
17. Ghi một dòng nợ kỹ thuật mức **P2**: khoảng trống này chỉ đóng triệt để được khi tách việc ký và
    việc phát giao dịch, để ghi được dấu vết nhận dạng giao dịch **trước khi** phát. Việc đó thuộc
    `ILedgerPort` của chuỗi thật, nên **gắn vào SC-03**, không làm trong task này. Trên chain `mock`
    tình huống hầu như không xảy ra, nhưng quy tắc phải đúng từ bây giờ để khi SC-03 xong thì hành vi
    đã sẵn đúng.

**Quyền**

18. KHÔNG thêm vai mới, KHÔNG đổi bảng `ROLES`. Bốn vai giữ nguyên.
19. KHÔNG cấp `order:execute` cho thêm vai nào.

**Giao diện và tài liệu, phần tối thiểu để luồng không mâu thuẫn**

10. Màn Giao dịch token của nhà đầu tư: sau khi gửi lệnh, hiện trạng thái cuối. Bỏ cách nói ngụ ý
    phải chờ ngân hàng bấm.
11. Màn Giao dịch của vận hành: nút Khớp lệnh **chỉ hiện cho lệnh đang kẹt**, không hiện cho mọi
    lệnh. Nhãn và chú thích nói rõ đây là can thiệp, không phải bước bắt buộc.
12. `docs/guide.md` mục 5.2 và 6: bỏ bước Giao dịch viên bấm Khớp lệnh khỏi luồng chính, chuyển
    thành mục nói về can thiệp khi lệnh kẹt. Đi lại toàn bộ hướng dẫn từ bản sạch sau khi sửa.

## Ràng buộc

- Không đổi mô hình trạng thái lệnh, không thêm trạng thái mới.
- Không bỏ phép kiểm nào trong `runOrderChecks`; đường tự động chạy **đúng bộ kiểm** của đường tay.
- Không gọi chuỗi trực tiếp từ giao diện; mọi thứ qua `ILedgerPort`.
- Mọi số tiền truyền dạng chuỗi. Trả `Result<T>`, không ném lỗi ra ngoài service.
- Đặt lệnh hai lần không được tạo hai lệnh và không được quyết toán hai lần.
- Không làm tiến trình quét lệnh kẹt theo lịch trong task này; xem mục Không làm.

## Tác động

| | Tệp |
|---|---|
| Sửa | `app/prisma/schema.prisma`, `lib/store/order.store.port.ts` và hai bản hiện thực, `lib/bank/purchase.service.ts`, `app/actions/purchase.ts`, `api/purchase/route.ts` nếu cần, `components/pages/investor-trade.tsx`, `components/pages/ops-transactions.tsx`, `lib/bank/ops-transactions.service.ts`, `docs/guide.md` |
| Mới | kiểm thử cho đường tự động và đường can thiệp |
| Bị ảnh hưởng | kiểm thử luồng mua và bán, kiểm thử đầu cuối của FE-25 và FE-06, sơ đồ `docs/flows/purchase.md` |

## Mức kiểm chứng: Cao

```bash
cd app && npx vitest run test/purchase-service.test.ts test/purchase-state.test.ts test/ops-transactions.test.ts
cd app && npx playwright test e2e/investor-channel.spec.ts e2e/ops-transactions.spec.ts
bash scripts/run-local-all.sh        # cuối task
```

| Ca | Kiểm |
|---|---|
| 1 | Nhà đầu tư đặt lệnh mua hợp lệ: lệnh về `COMPLETED` ngay trong lời gọi, có mã giao dịch, **không cần ai bấm** |
| 2 | Số dư sau lệnh đúng cả bốn bút toán: VNDB và WPT của nhà đầu tư và của SPV |
| 3 | Chiều bán cũng tự quyết toán, cùng cách |
| 4 | Điều kiện không đạt: lệnh **không** quyết toán, số dư không bên nào đổi, lý do đọc được |
| 5 | **Đường tự động không nhận mã lệnh từ bên ngoài**: không có cách nào để một lời gọi đặt lệnh quyết toán một lệnh khác |
| 6 | Nhà đầu tư vẫn **không** có `order:execute`; gọi thẳng đường can thiệp bị chặn |
| 7 | Lệnh kẹt ở `CHECKING` hoặc `EXECUTING`: Giao dịch viên can thiệp được bằng đường tay |
| 8 | Nút Khớp lệnh **không hiện** cho lệnh đã hoàn tất |
| 9 | Gọi lại **cùng mã chống trùng, cùng nội dung**: trả lệnh cũ, KHÔNG tạo lệnh mới, KHÔNG quyết toán lần hai |
| 10 | Gọi lại **cùng mã, khác nội dung**: bị từ chối, nêu rõ lý do |
| 11 | Hai lời gọi **song song** cùng mã: đúng một lệnh, đúng một giao dịch; ràng buộc cơ sở dữ liệu chặn, không phải đọc rồi ghi |
| 12 | Mã chống trùng của ví A **không** va chạm với mã trùng tên của ví B |
| 13 | Lệnh `CHECKING`: đường can thiệp **được** gửi giao dịch |
| 14 | Lệnh `EXECUTING` **có** mã giao dịch: chỉ đối soát biên nhận, KHÔNG gửi lại |
| 15 | Lệnh `EXECUTING` **chưa có** mã giao dịch: KHÔNG gửi lại, hiện dấu cần đối soát tay |
| 16 | Sổ kiểm toán phân biệt được lệnh tự chạy và lệnh có người bấm |

Đột biến, **chỉ ba chỗ**:

- Cho đường tự động nhận `orderId` từ dữ liệu vào của `placeOrder`: ca 5 phải đỏ.
- Bỏ `runOrderChecks` khỏi đường tự động, chỉ giữ ở đường tay: ca 4 phải đỏ.
- Cho nhánh `EXECUTING` chưa có mã giao dịch được gửi lại: ca 15 phải đỏ.

Ba phép này kiểm ba rủi ro của việc tự động hoá: quyết toán nhầm lệnh, quyết toán khi chưa đủ điều
kiện, và gửi hai lần một giao dịch có thể đã lên chuỗi.

## Điều kiện hoàn thành

- [ ] Lệnh mua và bán hợp lệ tự quyết toán, không cần người bấm.
- [ ] Đường tự động chỉ chạm lệnh vừa tạo, có ca test và phép đột biến chốt.
- [ ] Đường tự động chạy đúng bộ kiểm của đường tay.
- [ ] `order:execute` vẫn chỉ ở `TELLER`; bảng quyền không đổi.
- [ ] Quyết toán trượt không làm mất lệnh; Giao dịch viên can thiệp được.
- [ ] Nút Khớp lệnh chỉ còn cho lệnh kẹt.
- [ ] Sổ kiểm toán phân biệt hai đường.
- [ ] Khóa chống trùng chạy đúng ba tình huống, chặn bằng ràng buộc cơ sở dữ liệu ở cả hai bản lưu trữ.
- [ ] Đường can thiệp xử lý đúng ba nhánh; nhánh `EXECUTING` chưa có mã giao dịch KHÔNG gửi lại.
- [ ] `docs/guide.md` sửa xong và **đi lại từ bản sạch, mọi bước bấm được thật**.
- [ ] Sơ đồ `docs/flows/purchase.md` **sinh lại** bằng script, không sửa tay.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không thêm vai mới và không cấp thêm quyền cho vai nào.
- Không làm hạn mức tự động theo số tiền; nếu chủ dự án muốn ngưỡng cần người duyệt thì đó là
  quyết định riêng, mở task riêng.
- Không làm tiến trình quét lệnh kẹt theo lịch. Đường can thiệp tay của Giao dịch viên là cách xử
  lý trong giai đoạn này; ghi một dòng nợ kỹ thuật mức P2 đề xuất gom vào tiến trình định kỳ đã có
  của BE-07.
- Không dựng lại màn Giao dịch của FE-06; chỉ sửa điều kiện hiện nút và chữ.
- Không đụng luồng lập duyệt Mint và Burn; luồng đó **vẫn** cần hai người, đúng tài liệu yêu cầu.
