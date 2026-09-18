---
inclusion: always
---

# Quy tắc: vừa build vừa cập nhật Báo cáo công nghệ

> **Tài liệu được duy trì:** `docs/tech-report.md`

Kiro chịu trách nhiệm giữ `tech-report.md` **luôn khớp với mã nguồn thực tế**. Tài liệu lệch mã nguồn còn tệ hơn không có tài liệu, vì dev sau sẽ tin vào thứ đã sai.

---

## 0. Quy ước ký hiệu token (áp dụng toàn repo)

| Ký hiệu đúng | Nghĩa | Ký hiệu cũ đã bỏ |
|---|---|---|
| **WPT** | Wind Project Token — token phần vốn dự án điện gió | ~~SPT~~ |
| **VNDB** | Token tiền tệ dùng chi trả và hoàn vốn | ~~tVND~~ |

Khi chạm vào bất kỳ file nào còn ký hiệu cũ, **đổi luôn trong cùng commit**. Kiểm bằng:

```bash
# Giống hệt phép quét trong scripts/verify-arch-rules.sh mục "KÝ HIỆU TOKEN". Phải rỗng.
grep -rnoE "\bSPT\b|tVND" app/src/ app/e2e/ app/test/ packages/ | grep -v node_modules | grep -v target/
```

**`docs/` cố ý KHÔNG bị quét.** Tài liệu nhắc ký hiệu cũ một cách có chủ đích — checkpoint lịch sử, bảng "ký hiệu cũ đã bỏ" ngay phía trên, diff dán lại mã cũ — nên thêm `docs/` vào là tự tạo 60 dương tính giả. Thêm nữa, phép quét này **tự tham chiếu**: chính dòng lệnh ở đây nằm trong `docs/`. Cũng **không dùng `-i`**: ký hiệu niêm yết có đúng một cách viết, còn `-i` làm `tVND` khớp các định danh hợp lệ như `distributableProfitVnd` / `profitVndBn`. Lý do đầy đủ, kèm số đo, ghi trong chú thích của chính script.

Lưu ý: đổi nhãn giao diện sẽ **làm gãy selector trong `app/e2e/`**. Sửa test cùng lúc, không để lại cho vòng sau.

---

## 1. Nguyên tắc gốc

**Cập nhật tài liệu nằm TRONG định nghĩa "xong" của mỗi task.** Một task chưa cập nhật tài liệu là task chưa hoàn thành, không được đánh ✅ trong checkpoint.

Ba quy tắc con:

1. **Cùng commit, không tách sau.** Thay đổi mã và cập nhật tài liệu đi chung một commit. Không hẹn "cuối phase làm một thể" — đó là cách tài liệu bị bỏ quên.
2. **Chỉ ghi điều đã kiểm chứng.** Mọi con số, tên hàm, đường dẫn trong báo cáo phải lấy từ mã nguồn thật hoặc từ lệnh đã chạy. **Cấm** ghi theo trí nhớ hoặc theo dự định.
3. **Tách rõ ba loại nội dung.** Đã xây xong / đang xây / dự kiến. Luồng chưa xây phải ghi rõ "chưa xây" kèm phase, không mô tả như thể đã có.

---

## 2. Bảng ánh xạ: thay đổi gì thì sửa mục nào

Sau khi sửa mã, đối chiếu bảng này. Nếu một dòng khớp, mục tương ứng **bắt buộc** cập nhật.

| Kiểu thay đổi | Mục phải cập nhật |
|---|---|
| Thêm/xóa/đổi tên file trong `app/src/lib/` | Phần 3 (bảng file + hàm) và cây thư mục ở 1.4 |
| Thêm method vào `ILedgerPort` / `ISigner` / `ITxnStore` | Phần 3 (bảng hàm của port) + mục "Cách mở rộng" |
| Thêm action hoặc role vào RBAC | Phần 3.3 (ma trận quyền) |
| Thêm service mới ở `lib/bank/` | Phần 3.4 + Phần 4 (bản đồ luồng mới) |
| Thêm/sửa contract Solidity | Phần 3.8 (bảng contract + hàm) |
| Đổi ký hiệu hoặc thêm loại token | Mục "Quy ước ký hiệu token" ở đầu báo cáo + toàn bộ chỗ nhắc tên token |
| Thêm/gỡ/nâng thư viện (`package.json`, `Cargo.toml`) | Phần 2 (bảng công nghệ: bản dùng, mục đích) |
| Hoàn thành một phase | Phần 4.5 (lộ trình) + metadata đầu file |
| Xây xong luồng redeem/distribution | Chuyển mục 4.2/4.3 từ "chưa xây" sang mô tả thực tế, ghi rõ file và hàm đã dùng |
| Sửa xong một mục nợ kỹ thuật | Xóa khỏi bảng 1.6.C, ghi một dòng vào 1.6.B nếu là quyết định thiết kế |
| Gặp lỗi lặp lại hoặc bài học mới | Thêm vào 1.6.A hoặc 1.6.B, **đồng thời** thêm vào `.kiro/steering/lessons.md` |
| Đổi biến môi trường, cờ tính năng | Phần 1.5 (chế độ chạy) + Phần 3.6 |
| Đổi cách build/deploy | Phần 1.5 + bảng nợ kỹ thuật nếu phát sinh ràng buộc mới |
| Thêm/xóa điểm cắm, hoặc sửa nội dung marker `@pending` / `@blocked` | **Không sửa tay** mục điểm cắm ở 3.10 — chạy `node scripts/scan-pending.mjs --write-report` rồi commit tệp đã sinh |
| Hoàn thành một task | `.kiro/task-status.json`: chuyển mã task sang `done`, **và** dọn mọi marker đang chờ task đó |
| Xây xong một luồng đầu cuối ở tầng BE | Gắn `@flow`, chạy `node scripts/gen-flow-diagram.mjs <tên-luồng>`, thêm dòng trỏ sang `docs/flows/<tên-luồng>.md` ở mục 4.x của luồng đó |
| Thêm tệp vào `scripts/` | Phần 3.10 (bảng công cụ) + cây thư mục ở 1.4 |

---

## 3. Quy trình mỗi task

```
1. Đọc tech-report.md phần liên quan TRƯỚC khi code
   → tránh làm trái quyết định thiết kế đã có

2. Code theo tasks.md

3. Chạy kiểm chứng (mục 5)

4. Cập nhật tech-report.md theo bảng ánh xạ mục 2

5. Cập nhật metadata đầu báo cáo:
   - Phiên bản tài liệu: +0.1 (thay đổi thường), +1.0 (đổi lớn về kiến trúc)
   - Cập nhật lần cuối, nhánh/commit, phase

6. Commit chung: mã + tài liệu
   Ví dụ: feat(redeem): luồng hoàn vốn WPT sang VNDB + cập nhật báo cáo công nghệ

7. Ghi vào checkpoint: đã cập nhật những mục nào của báo cáo
```

---

## 4. Chuẩn viết

**Văn phong:** khách quan, đúng vị thế tài liệu kỹ thuật ngân hàng. Không quảng cáo, không hình dung hoa mỹ. Viết cho dev chưa từng đọc source này.

**Tiếng Việt đủ dấu**, kể cả trong bảng và chú thích.

**Mỗi mục trong Phần 3 giữ đủ bốn nội dung:**
1. File/thư mục làm gì
2. Các hàm chính và ý nghĩa
3. **Lưu ý khi phát triển** — cạm bẫy, ràng buộc, thứ dễ làm sai
4. **Cách mở rộng** — muốn thêm tính năng thì đụng vào đâu, theo thứ tự nào

**Mỗi luồng trong Phần 4 phải trả lời được:** đi qua file nào, hàm nào, theo thứ tự nào, điều kiện chặn ở đâu, ai ký giao dịch.

**Khi ghi "lưu ý", giải thích VÌ SAO**, không chỉ nói "phải làm thế". Dev không hiểu lý do sẽ sửa ngược lại ở lần refactor sau.

**Giữ cô đọng.** Bảng hơn đoạn văn dài. Không chép nguyên mã nguồn vào báo cáo — chỉ nêu tên hàm và ý nghĩa.

---

## 5. Tự kiểm trước khi nộp checkpoint

Chạy đủ và dán kết quả thật vào checkpoint:

```bash
# 3 luật kiến trúc
grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"     # phải rỗng
grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/                      # chỉ env.ts + server.signer.ts
grep -rnE "role ===|role ==" app/src/ | grep -v "src/lib/rbac/"     # phải rỗng

# Ký hiệu token cũ - KHÔNG quét docs/ và KHÔNG dùng -i, xem mục 0 để biết vì sao
grep -rnoE "\bSPT\b|tVND" app/src/ app/e2e/ app/test/ packages/ | grep -v node_modules | grep -v target/

# Marker điểm cắm và tài liệu sinh từ marker (mục 9)
node scripts/scan-pending.mjs --check          # cú pháp marker, mã task, marker lạc hậu
node scripts/gen-flow-diagram.mjs --check      # docs/flows/*.md còn khớp marker @flow
node scripts/scan-pending.mjs --check-report   # mục 3.10 của báo cáo còn khớp marker

# Chất lượng
cd app && npm run typecheck && npx eslint . && npm test && npm run test:e2e
cd packages/contracts-evm && npx hardhat test
```

Ba lệnh `--check` ở trên **đã nằm trong** `bash scripts/run-local-all.sh` + `npm test`, nên
chạy bộ đầy đủ là đủ. Liệt kê riêng ở đây để khi một mục đỏ thì biết chạy đúng lệnh hẹp nhất
mà xem, thay vì chạy lại cả bộ.

**Checklist tài liệu (tự trả lời từng câu, không bỏ qua):**

- [ ] Cây thư mục ở 1.4 có khớp `find` thực tế không?
- [ ] Mọi file mới trong `lib/` đã có dòng trong Phần 3 chưa?
- [ ] Mọi thư viện mới đã vào bảng Phần 2 với đúng version trong `package.json` chưa?
- [ ] Luồng vừa xây đã có bản đồ ở Phần 4 với tên hàm thật chưa?
- [ ] Ký hiệu token trong tài liệu có đúng **WPT** / **VNDB** ở mọi chỗ không?
- [ ] Nợ kỹ thuật đã sửa có được xóa khỏi 1.6.C chưa?
- [ ] Metadata đầu file đã cập nhật chưa?
- [ ] Có mục nào mô tả thứ **chưa tồn tại** như đã tồn tại không?
- [ ] Mục điểm cắm ở 3.10 đã **sinh lại**, chưa sửa tay dòng nào trong hai mốc?
- [ ] Task vừa xong đã vào `done` của `.kiro/task-status.json`, và marker chờ nó đã dọn?
- [ ] Con số trong tài liệu (số test, số method chờ contract, số dòng) có **đo lại** không?

---

## 6. Chống trôi lệch (drift)

Tài liệu lệch mã nguồn thường do bốn nguyên nhân. Xử lý sẵn:

| Nguyên nhân | Cách chặn |
|---|---|
| Đổi tên hàm nhưng quên sửa tài liệu | Sau khi đổi tên, `grep` tên cũ trong `tech-report.md`. Còn kết quả là chưa xong |
| Xóa file nhưng tài liệu vẫn liệt kê | Đối chiếu cây thư mục bằng `find` trước khi nộp |
| Mô tả luồng theo dự định, không theo mã | Chỉ viết mục 4.x sau khi mã chạy được, và ghi đúng tên hàm trong mã |
| Đổi ký hiệu token nhưng sót chỗ | Chạy lệnh grep ký hiệu cũ ở mục 5, gồm cả `e2e/`. **Không** gồm `docs/` — mục 0 giải thích vì sao |
| Sửa marker rồi quên sinh lại tài liệu | Ba lệnh `--check` ở mục 5. Chúng đã ở trong `run-local-all.sh` + `npm test` nên lệch là đỏ, không im lặng |
| Tin con số trong tài liệu giao việc mà không đo lại | Đo bằng lệnh trước khi lập kế hoạch. Đã xảy ra thật ở MC-01: "10 method chờ contract" đo lại là **11**, "36 test" đo lại là **307**, "5 test e2e" đo lại là **30** |

**Khi phát hiện tài liệu đã lệch:** sửa ngay trong commit hiện tại, đồng thời ghi một dòng vào checkpoint mục "Sai lệch phát hiện được". Không im lặng sửa lén.

---

## 7. Khi không chắc

Áp dụng quy tắc chống "kẹt" của `workflow.md`:

- **Không đoán.** Không hiểu một mục nên viết thế nào → ghi câu hỏi vào checkpoint mục "Câu hỏi mở", nêu hai cách hiểu khả dĩ và phương án đề xuất.
- **Không tự ý xóa** nội dung do Supervisor viết trong báo cáo (đặc biệt bảng nợ kỹ thuật và bài học). Muốn bỏ thì đề xuất, chờ xác nhận.
- **Không tự ý đổi cấu trúc 4 phần** của báo cáo. Cần thêm mục thì thêm mục con bên trong phần phù hợp.

---

## 8. Ranh giới trách nhiệm

| Việc | Ai làm |
|---|---|
| Cập nhật Phần 1.4, 2, 3, 4 theo mã nguồn | **Kiro** |
| Thêm bài học vào 1.6.A/B khi gặp lỗi thực tế | **Kiro**, Supervisor rà lại |
| Thêm/xóa mục nợ kỹ thuật 1.6.C | **Supervisor** quyết định mức P0/P1/P2; Kiro báo cáo phát hiện |
| Gắn và dọn marker `@pending` / `@blocked` / `@flow` | **Kiro** |
| Cập nhật `.kiro/task-status.json` | **Kiro** (mục 9 nói rõ lúc nào) |
| Sinh lại `docs/flows/*.md` và mục điểm cắm ở 3.10 | **Kiro**, bằng script — **không** gõ tay |
| Duyệt tài liệu đã khớp mã nguồn | **Supervisor** khi review checkpoint |

---

## 9. Marker điểm cắm, sơ đồ luồng và trạng thái task

> Quy ước đầy đủ (cú pháp, năm tên luồng, danh sách từ khóa bị cấm) ở
> `.kiro/steering/make-control.md`. Mục này chỉ nói **nghĩa vụ duy trì**: khi nào phải gắn
> marker, khi nào phải dọn, và sinh lại tài liệu nào.

### 9.1. Thêm điểm cắm thì gắn marker

Viết một hàm mà **chưa ai gọi**, hoặc một method **chưa chạy được**, thì gắn marker ngay trên
khai báo trong **cùng commit** — không hẹn "lúc nào rảnh gắn". Hai loại, không gộp:

| Loại | Trạng thái mã | Marker |
|---|---|---|
| Chờ người cắm vào | **đã chạy được** | `@pending <MÃ-TASK> \| <đã sẵn những gì>` |
| Chờ phụ thuộc | **đang ném lỗi** | `@blocked <MÃ-TASK> \| <thiếu gì>` |

**Vì sao phải phân biệt:** gặp `@pending`, task sau **làm được ngay**; gặp `@blocked`, task sau
**chưa làm được**. Dùng sai marker tệ hơn không có marker, vì nó trả lời sai một câu hỏi mà
người đọc tin là đã được trả lời. Chưa chắc code chạy được hay chưa thì **chạy thử**, đừng đoán.

Phần sau dấu `|` viết cho người đọc, nhưng phải nói **đã sẵn gì** (hoặc **thiếu gì**), không
phải "chờ làm". Người nhận task đọc đúng câu đó để biết mình **không cần viết lại** cái gì; ghi
"chờ làm giao diện" thì không giúp được gì. Script có phép kiểm `VAGUE_NOTE` chặn loại mô tả đó.

Mã task trong marker phải nằm trong `.kiro/task-status.json` (hợp `done` + `inProgress` +
`planned`). Marker ghi mã ngoài tập đó là sai định dạng và làm `--check` đỏ.

### 9.2. Dùng hết điểm cắm thì xóa marker

`@pending` đã được gọi → **xóa marker**. `@blocked` đã nối được → **xóa marker**.

Đây không phải việc tùy tâm. Bỏ qua thì `scripts/scan-pending.mjs --check` và
`app/test/pending-markers.test.ts` báo đỏ, và `scripts/run-local-all.sh` đỏ theo. Đó là chủ
đích: nếu dọn marker chỉ là "nhớ thì làm" thì sau vài tháng bảng điểm cắm đầy rác và không ai
còn tin nó — lúc đó cả cơ chế này vô dụng.

Ngược lại, **còn điểm cắm là bình thường**, không làm đỏ bất cứ thứ gì. Điểm cắm là trạng thái
công việc, không phải lỗi. Đừng thêm phép kiểm "số điểm cắm phải giảm".

### 9.3. Hoàn thành task thì cập nhật `.kiro/task-status.json`

| | |
|---|---|
| **Ai** | Kiro. Không phải Supervisor, không phải Owner |
| **Lúc nào** | Trong **commit cuối của task**, cùng lúc với cập nhật `docs/tech-report.md` (mục 3 bước 6). Không hẹn "cuối phase làm một thể" |
| **Cái gì** | (a) Chuyển mã task sang `done`. (b) **Dọn mọi marker đang chờ task đó** theo 9.2 |

Bất biến: **một mã task chỉ xuất hiện ở đúng một** trong ba danh sách `done` / `inProgress` /
`planned`. Trùng ở hai danh sách thì trạng thái của nó không xác định, và phép kiểm "marker chờ
task đã `done`" cho kết quả tùy thứ tự đọc — script báo `BAD_TASK_STATUS` chứ không im lặng bỏ
qua.

Dùng tệp dữ liệu thay vì đọc trạng thái từ `docs/tech-report.md` vì tài liệu là văn bản tự do:
phân tích được nhưng vỡ ngay khi ai đó đổi cách diễn đạt.

### 9.4. Luồng mới xong đầu cuối ở BE thì gắn `@flow` và sinh sơ đồ

Chỉ gắn `@flow` cho luồng **đã hoàn thành đầu cuối ở tầng backend**. Gắn cho luồng còn dở sinh
ra sơ đồ mô tả thứ chưa tồn tại — đúng cái mà mục 1.3 cấm.

Gắn xong thì sinh tệp và **commit tệp đã sinh**:

```bash
node scripts/gen-flow-diagram.mjs <tên-luồng>      # ghi docs/flows/<tên-luồng>.md
```

Rồi thêm một dòng ở mục 4.x của luồng đó trong báo cáo, trỏ sang tệp vừa sinh.

Số bước phải là **chuỗi số nguyên liên tiếp từ 1**: không trùng, không nhảy cách. Cần chèn bước
vào giữa thì **đánh số lại cả luồng**, tuyệt đối không dùng số thập phân — số nguyên liên tiếp
làm cho "thiếu bước" thành thứ máy phát hiện được, cho phép số thập phân là bỏ mất phép kiểm đó.

⚠️ **Số bước `@flow` và số bước trong bảng ở mục 4.x là hai hệ đánh số khác nhau.** Bảng 4.x
đánh số các bước **bên trong một hàm**; `@flow` đánh số **các hàm** trên đường đi. Đọc chéo hai
hệ bằng số bước sẽ ra kết luận sai. Nếu viết chú giải nối hai hệ thì nói rõ điều này.

### 9.5. Tài liệu sinh từ marker: sinh lại, không sửa tay

| Tệp / vùng | Sinh bằng | Kiểm bằng |
|---|---|---|
| `docs/flows/<luồng>.md` — **cả tệp** | `node scripts/gen-flow-diagram.mjs <luồng>` | `node scripts/gen-flow-diagram.mjs --check` |
| `docs/tech-report.md` mục 3.10, **phần giữa hai mốc** `BEGIN:diem-cam` / `END:diem-cam` | `node scripts/scan-pending.mjs --write-report` | `node scripts/scan-pending.mjs --check-report` |

Sửa tay là sai: lần sinh sau ghi đè, và trong khoảng thời gian trước đó thì tài liệu nói một
đằng còn mã làm một nẻo. Muốn đổi nội dung thì **sửa marker trong mã** rồi sinh lại.

Ở `docs/tech-report.md`, chữ **ngoài** hai mốc là viết tay và script không chạm tới — đó là chỗ
để giải thích cơ chế, cạm bẫy, cách mở rộng. Không tìm thấy cặp mốc thì script **dừng**, không
tự đoán chỗ chèn: chèn sai chỗ trong một tệp viết tay là thiệt hại khó lần ra.

Cả hai lệnh sinh đều **từ chối chạy khi marker còn lỗi**. Sinh từ dữ liệu lỗi ra một bảng hoặc
một hình vẽ trông hợp lệ mà thiếu dòng hoặc nối sai, và người đọc tài liệu không có cách nào
biết — tệ hơn là không sinh.
