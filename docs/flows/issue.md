<!-- SINH TỰ ĐỘNG TỪ MARKER — ĐỪNG SỬA TAY -->

# Luồng `issue` — Ngân hàng phát hành WPT

> **Tệp này do `scripts/gen-flow-diagram.mjs` sinh ra từ marker `@flow` trong mã nguồn.**
> Sửa tay sẽ bị ghi đè ở lần sinh sau, và trong khoảng thời gian trước đó thì sơ đồ nói một
> đằng còn mã làm một nẻo. Muốn đổi nội dung thì sửa marker trong mã rồi sinh lại.
>
> - Sinh lại: `node scripts/gen-flow-diagram.mjs issue`
> - Kiểm tệp này còn khớp marker hay không: `node scripts/gen-flow-diagram.mjs issue --check`
> - Quy ước marker: `.kiro/steering/make-control.md` mục 4

**9 bước**, gắn ở 2 tệp:

- `app/src/app/actions/bank.ts`
- `app/src/lib/bank/issuance.service.ts`

## Sơ đồ

```mermaid
flowchart TD
  s1["1 · issueInitialSupplyAction()<br/>app/src/app/actions/bank.ts<br/>nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service"]
  s2["2 · issueInitialSupply()<br/>app/src/lib/bank/issuance.service.ts<br/>validate, kiểm quyền token:mint, đọc trần phát hành từ bảng dự án"]
  s3["3 · pending()<br/>app/src/lib/bank/issuance.service.ts<br/>gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint"]
  s4["4 · saved()<br/>app/src/lib/bank/issuance.service.ts<br/>lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận"]
  s5["5 · receipt()<br/>app/src/lib/bank/issuance.service.ts<br/>đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch"]
  s6["6 · issuedAt()<br/>app/src/lib/bank/issuance.service.ts<br/>lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan"]
  s7["7 · after()<br/>app/src/lib/bank/issuance.service.ts<br/>đọc lại tổng cung từ chuỗi làm sự thật cuối cùng"]
  s8["8 · issuanceStatusAction()<br/>app/src/app/actions/bank.ts<br/>nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service"]
  s9["9 · getIssuanceStatus()<br/>app/src/lib/bank/issuance.service.ts<br/>đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi"]
  w1(["điểm cắm, chờ FE-07<br/>đã sẵn đầu cuối ở issueInitialSupply: phát hành NHIỀU LẦN trong trần…"])
  w2(["điểm cắm, chờ FE-07<br/>đã sẵn đầu cuối ở getIssuanceStatus: trả SONG SONG trần trong bảng dự…"])
  s1 --> s2
  s2 --> s3
  s3 --> s4
  s4 --> s5
  s5 --> s6
  s6 --> s7
  s7 --> s8
  s8 --> s9
  w1 -.-> s1
  w2 -.-> s8
```

## Bảng bước

| Bước | Tệp | Hàm | Việc |
|---|---|---|---|
| 1 | `app/src/app/actions/bank.ts:37` | `issueInitialSupplyAction()` | nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service |
| 2 | `app/src/lib/bank/issuance.service.ts:281` | `issueInitialSupply()` | validate, kiểm quyền token:mint, đọc trần phát hành từ bảng dự án |
| 3 | `app/src/lib/bank/issuance.service.ts:186` | `pending()` | gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint |
| 4 | `app/src/lib/bank/issuance.service.ts:75` | `saved()` | lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận |
| 5 | `app/src/lib/bank/issuance.service.ts:90` | `receipt()` | đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch |
| 6 | `app/src/lib/bank/issuance.service.ts:216` | `issuedAt()` | lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan |
| 7 | `app/src/lib/bank/issuance.service.ts:247` | `after()` | đọc lại tổng cung từ chuỗi làm sự thật cuối cùng |
| 8 | `app/src/app/actions/bank.ts:45` | `issuanceStatusAction()` | nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service |
| 9 | `app/src/lib/bank/issuance.service.ts:342` | `getIssuanceStatus()` | đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi |

## Điểm cắm trên đường đi

Các bước dưới đây có marker chờ task khác. Trong sơ đồ chúng là ô bầu dục nối bằng
mũi tên gạch rời — chúng **không** phải bước của luồng.

| Bước | Loại | Task | Nội dung marker |
|---|---|---|---|
| 1 | điểm cắm | `FE-07` | đã sẵn đầu cuối ở `issueInitialSupply`: phát hành NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án, KHÔNG nhận từ input; `amount` tuỳ chọn chỉ chọn số lượng trong trần, bỏ trống = phát hành hết phần còn lại), kiểm quyền `token:mint`, lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi |
| 8 | điểm cắm | `FE-07` | đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một |

## Đọc sơ đồ này thế nào

- **Mũi tên liền là thứ tự nghiệp vụ, không phải cạnh gọi hàm.** Quy ước cho mỗi bước đúng
  một số nguyên liên tiếp, nên nó biểu diễn được một chuỗi thời gian chứ không biểu diễn
  được lồng nhau hay đường về. Ví dụ một hàm gọi hàm sau nó rồi nhận kết quả về thì trên sơ
  đồ chỉ thấy mũi tên đi, không thấy mũi tên về.
- **Ô bầu dục nối bằng mũi tên gạch rời không phải bước của luồng.** Đó là marker
  `@pending` / `@blocked` nằm trên đúng hàm của bước đó: một task khác còn phải gọi vào,
  hoặc còn phải xong trước.
- **Bước ở `ledger.port.ts` là cổng, không phải adapter.** Adapter thật (`mock`, `evm`,
  `stellar`) do `getLedger(chain)` chọn lúc chạy theo cấu hình, nên không cạnh gọi tĩnh
  nào nối được cổng với adapter (design.md QĐ-6). Sơ đồ dừng ở cổng là dừng ở chỗ còn nói
  thật được.
- **Nhánh phụ và nhánh song song không có trên sơ đồ.** Một chuỗi số nguyên không có chỗ
  cho hai đường vào cùng một bước, cũng không có chỗ cho nhánh chạy ngoài chuỗi. Những chỗ
  như vậy được nhắc trong nhãn của bước liên quan hoặc trong bình luận tại tệp bị bỏ ra.
