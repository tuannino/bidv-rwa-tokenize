# HF-04: quyết định dễ hiểu sai

- **Không suy DONE từ biên nhận thành công:** `vaultCloseTxHash` có thể là giao dịch của script chen vào (đường CONFLICT thật ghi mã đó). Vì vậy adapter đọc đúng sự kiện `PeriodClosed` trong biên nhận và so số thật; xung đột thật vẫn CONFLICT.
- **CONFLICT đối soát lại được:** chỉ chuyển về DONE khi sự kiện đúng mã kỳ có số bằng số kỳ chia. Không có sự kiện hoặc khác số thì giữ CONFLICT và khoá như FE-08.
- **Màn chỉ đọc chuỗi thêm khi kỳ đang CONFLICT** (hiếm), để không thêm lời gọi cho trường hợp thường.
