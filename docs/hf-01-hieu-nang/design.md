# HF-01: quyết định dễ hiểu sai

- **Vì sao bỏ gọi số việc chờ cho chain mặc định là an toàn:** `AppLayout` là Server Component được gọi trong từng trang, nên mỗi lần điều hướng hay `router.refresh()` đều đọc lại `pendingWorkCounts()` cho chain mặc định và truyền xuống qua prop. Prop đó đã là số mới nhất.
- **Vì sao gộp đối soát và đọc danh sách vào một action:** Next xếp hàng server action nối tiếp. Hai action là hai lượt Worker chờ nhau, mỗi lượt tự `authorize` lại. Hành vi giữ nguyên: kết quả đối soát vẫn bỏ qua ở màn này, lỗi đối soát không chặn đọc danh sách. `reconcileWithdrawRequestsAction` giữ cho nút đối soát ở `/vault`.
- **Vì sao chỉ gom lô ở client đọc:** lô JSON-RPC lỗi thì cả lô lỗi. Lời đọc chịu được (thử lại khi tải lại màn); giao dịch ghi phải có lỗi và biên nhận riêng. `batchSize` 20 để không chạm giới hạn lô của RPC công cộng; đã thử lô 3 lời gọi trên `ethereum-sepolia-rpc.publicnode.com` trả đủ kết quả.
