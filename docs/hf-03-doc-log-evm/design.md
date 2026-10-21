# HF-03: quyết định dễ hiểu sai

- **Mặc định là RPC công khai, không phải `RPC_EVM`:** RPC chính có key (Alchemy gói miễn phí) chỉ cho 10 block mỗi lần; chia đoạn 10 block trên hàng nghìn block là hàng trăm lời gọi. RPC công khai không có bí mật nên dùng làm mặc định được; đặt `RPC_EVM_LOGS` để đổi.
- **`getBlockNumber({ cacheTime: 0 })` và đoạn cuối tới `latest`:** viem nhớ số block vài giây; dùng số cũ làm sót `PeriodClosed` vừa phát (SC-06 đỏ 8 ca trên nút Hardhat khi chia đoạn 3 block trước khi sửa). RPC đọc sự kiện có thể đi sau RPC ghi vài block, nên đoạn cuối luôn tới `latest`.
- **Lỗi một đoạn thì cả lần đọc lỗi** (`LedgerError`), không trả lịch sử thiếu.
