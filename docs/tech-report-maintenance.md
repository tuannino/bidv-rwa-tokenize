---
inclusion: always
---

# Quy tắc: vừa build vừa cập nhật Báo cáo công nghệ

> **Tài liệu được duy trì:** `.kiro/steering/tech-report.md`

Kiro chịu trách nhiệm giữ `tech-report.md` **luôn khớp với mã nguồn thực tế**. Tài liệu lệch mã nguồn còn tệ hơn không có tài liệu, vì dev sau sẽ tin vào thứ đã sai.

---

## 0. Quy ước ký hiệu token (áp dụng toàn repo)

| Ký hiệu đúng | Nghĩa | Ký hiệu cũ đã bỏ |
|---|---|---|
| **WPT** | Wind Project Token — token phần vốn dự án điện gió | ~~SPT~~ |
| **VNDB** | Token tiền tệ dùng chi trả và hoàn vốn | ~~tVND~~ |

Khi chạm vào bất kỳ file nào còn ký hiệu cũ, **đổi luôn trong cùng commit**. Kiểm bằng:

```bash
grep -rniE "\bSPT\b|tVND" app/src app/e2e app/test packages/ docs/   # phải rỗng
```

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

# Ký hiệu token cũ
grep -rniE "\bSPT\b|tVND" app/src app/e2e app/test packages/ docs/  # phải rỗng

# Chất lượng
cd app && npm run typecheck && npx eslint . && npm test && npm run test:e2e
cd packages/contracts-evm && npx hardhat test
```

**Checklist tài liệu (tự trả lời từng câu, không bỏ qua):**

- [ ] Cây thư mục ở 1.4 có khớp `find` thực tế không?
- [ ] Mọi file mới trong `lib/` đã có dòng trong Phần 3 chưa?
- [ ] Mọi thư viện mới đã vào bảng Phần 2 với đúng version trong `package.json` chưa?
- [ ] Luồng vừa xây đã có bản đồ ở Phần 4 với tên hàm thật chưa?
- [ ] Ký hiệu token trong tài liệu có đúng **WPT** / **VNDB** ở mọi chỗ không?
- [ ] Nợ kỹ thuật đã sửa có được xóa khỏi 1.6.C chưa?
- [ ] Metadata đầu file đã cập nhật chưa?
- [ ] Có mục nào mô tả thứ **chưa tồn tại** như đã tồn tại không?

---

## 6. Chống trôi lệch (drift)

Tài liệu lệch mã nguồn thường do bốn nguyên nhân. Xử lý sẵn:

| Nguyên nhân | Cách chặn |
|---|---|
| Đổi tên hàm nhưng quên sửa tài liệu | Sau khi đổi tên, `grep` tên cũ trong `tech-report.md`. Còn kết quả là chưa xong |
| Xóa file nhưng tài liệu vẫn liệt kê | Đối chiếu cây thư mục bằng `find` trước khi nộp |
| Mô tả luồng theo dự định, không theo mã | Chỉ viết mục 4.x sau khi mã chạy được, và ghi đúng tên hàm trong mã |
| Đổi ký hiệu token nhưng sót chỗ | Chạy lệnh grep ký hiệu cũ ở mục 5, gồm cả `e2e/` và `docs/` |

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
| Duyệt tài liệu đã khớp mã nguồn | **Supervisor** khi review checkpoint |
