# HF-02: quyết định

- Ghi đè đúng một cặp `(evm, OrderSettlement)` thay vì đổi chain của ca: ca cần một chain EVM thật (`isPermitChain`) mà không có OrderSettlement; `evm` là chain duy nhất như vậy trước OP-05. Ghi đè trong tệp kiểm thử giữ ý của ca, độc lập với lần triển khai sau.
- Không đổi `settlementSpender` hay address book: mã app đã đúng.
