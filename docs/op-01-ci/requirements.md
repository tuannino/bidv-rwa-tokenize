# OP-01 — Tích hợp liên tục, cổng bảo vệ nhánh dev, và tạm dừng phần Stellar

| | |
|---|---|
| Nhánh | `op/01-ci`, tạo từ `dev` |
| Điểm | 6 |
| Mức kiểm chứng | **Vừa** |

## Mục tiêu

1. Mọi thay đổi đẩy lên đều được kiểm tự động, và nhánh `dev` chỉ nhận thay đổi đã qua kiểm.
2. Tạm dừng phần Stellar trong khâu kiểm chứng và chuẩn bị môi trường, nhưng **giữ nguyên mã nguồn và kiến trúc đa chuỗi**.

Hiện toàn bộ việc kiểm chạy bằng tay nên chỉ phát hiện lỗi khi có người nhớ chạy. Dự án đã **hai lần mất nội dung trên nhánh dev** do mẫu hoàn tác rồi hợp nhất lại: lần đầu mất 164 tệp của vòng dọn giao diện, lần sau mất toàn bộ phần quyền của BE-08. Cả hai lần lịch sử vẫn ghi là đã hợp nhất nên nhìn nhật ký không thấy bất thường.

## Phần A: Tạm dừng phần Stellar trong khâu kiểm chứng

Làm phần này **trước**, để phần B không dựng quy trình rồi lại phải gỡ.

### Nguyên tắc: giữ mã, bỏ bắt buộc

| Giữ nguyên, KHÔNG được đụng | Gỡ khỏi khâu kiểm chứng |
|---|---|
| Thư mục `packages/contracts-stellar` và 8 tệp Rust | Nhánh chạy `cargo test` trong `scripts/run-local-all.sh` |
| `app/src/lib/ledger/stellar.adapter.ts` | Phép kiểm thư viện Stellar trong `scripts/verify-arch-rules.sh` |
| Giá trị `stellar` trong danh sách chuỗi, kiểu dữ liệu, sổ đăng ký chuỗi | Ba mục spec Stellar trong phần kiểm cấu trúc của cùng tệp đó |
| Trạng thái chuỗi ngoài họ Ethereum ở màn kết nối ví và kiểm thử của nó | Yêu cầu bắt buộc cài Rust hoặc chạy kiểm thử Soroban trong tài liệu |
| Mọi báo cáo bàn giao đã có | |

### Việc cần làm

1. Bỏ phần gọi `cargo test` khỏi `run-local-all.sh`. Thay bằng **một dòng thông báo** cho biết phần Soroban đang tạm dừng, không cần chạy. Không để lại gợi ý đi cài Rust.
2. Bỏ phép kiểm thư viện Stellar khỏi `verify-arch-rules.sh`, và bỏ ba mục spec Stellar khỏi phần kiểm cấu trúc trong cùng tệp.
3. Rà `.kiro/steering/structure.md` và `.kiro/steering/tech.md`: chuyển mọi yêu cầu bắt buộc liên quan Stellar thành ghi chú là phần mở rộng tương lai, đang tạm dừng.
4. Ghi vào `docs/tech-report.md` một mục ngắn: phần Stellar tạm dừng, mã nguồn giữ nguyên để mở rộng đa chuỗi sau này, không ai phải cài Rust để làm việc.
5. **Không sửa** các báo cáo bàn giao đã có. Đó là vết lịch sử.

## Phần B: Tích hợp liên tục

6. Quy trình tự động chạy khi đẩy mã lên `dev` và khi mở yêu cầu hợp nhất vào `dev`.
7. Hai việc chạy song song:
   - **Việc A, ứng dụng**: cài phụ thuộc trong `app`, ba luật kiến trúc, kiểm điểm cắm, kiểm khuôn báo cáo bàn giao, kiểm kiểu, kiểm chuẩn mã, kiểm thử đơn vị.
   - **Việc B, hợp đồng EVM**: cài phụ thuộc trong `packages/contracts-evm`, chạy kiểm thử hợp đồng. **Không có phần Rust.**
   - **Việc C, phần nặng**: dựng bản phát hành rồi chạy kiểm thử đầu cuối.
8. **Không chép lại danh sách lệnh vào tệp quy trình.** Tách `run-local-all.sh` thành các phần gọi riêng được, rồi quy trình tự động gọi lại đúng các phần đó, để nơi chạy tự động và nơi chạy tay luôn kiểm cùng một thứ.
9. Lưu đệm phụ thuộc của `app` và của `packages/contracts-evm`, trình biên dịch Solidity, trình duyệt kiểm thử đầu cuối, bộ nhớ đệm dựng bản.
10. Thêm phép kiểm mới vào `verify-arch-rules.sh`: **số hành động trong bảng quyền không được ít hơn bản trên nhánh `dev`**. Phép kiểm này bắt được đúng loại sự cố mất quyền đã xảy ra.
11. Thêm đường dẫn đọc phiên bản: trả mã commit đang chạy, tên nhánh, thời điểm dựng bản. Mã commit lấy từ biến môi trường do nơi chạy tự động cấp, có giá trị dự phòng khi chạy cục bộ.
12. Thêm tập lệnh kiểm khói: nhận địa chỉ gốc, gọi đường dẫn đọc phiên bản và một đường dẫn chỉ đọc, xác nhận cả hai trả về đúng. Chạy bằng tay, chưa gắn vào triển khai.
13. Việc A và việc B là cổng bắt buộc. Việc C **không chặn** hợp nhất ở giai đoạn này; ghi rõ trong tài liệu là sẽ siết sau.
14. Viết hướng dẫn bật bảo vệ nhánh `dev`: bắt buộc qua yêu cầu hợp nhất, bắt buộc việc A và việc B xanh, không cho đẩy thẳng. Chủ kho mã tự bật, task này chỉ viết hướng dẫn.

## Ràng buộc

- Quy trình tự động và `run-local-all.sh` phải kiểm **cùng một tập việc**.
- Phần dựng bản gọi ra dịch vụ phông chữ bên ngoài nên cần mạng. Nếu nơi chạy tự động chặn, ghi vào báo cáo bàn giao thay vì tự đổi mã nguồn.
- Không để lộ khóa bí mật trong nhật ký chạy.
- Kiểm thử hợp đồng cần tải trình biên dịch Solidity nên phải lưu đệm.

## Tác động

| | Tệp |
|---|---|
| Mới | `.github/workflows/ci.yml`, `scripts/smoke-test.mjs`, `app/src/app/api/version/route.ts` |
| Sửa | `scripts/run-local-all.sh`, `scripts/verify-arch-rules.sh`, `.kiro/steering/structure.md`, `.kiro/steering/tech.md`, `docs/tech-report.md` |
| Không sửa | `packages/contracts-stellar`, `app/src/lib/ledger/stellar.adapter.ts`, `packages/shared/src/chains.ts`, `packages/shared/src/types.ts`, mọi báo cáo bàn giao đã có |

Đo bằng:

```
grep -n "Soroban\|cargo\|Rust" scripts/run-local-all.sh      # 5 chỗ
grep -n "stellar" scripts/verify-arch-rules.sh               # 5 chỗ
ls .github/workflows                                          # hiện chưa có
```

## Mức kiểm chứng: Vừa

Trong lúc làm:

```
bash scripts/verify-arch-rules.sh
bash scripts/run-local-all.sh
cd app && npx vitest run
node scripts/smoke-test.mjs http://localhost:3000
```

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | `run-local-all.sh` không còn gọi `cargo`, và **không còn dòng nào khuyên cài Rust** |
| 2 | Toàn bộ kiểm thử hiện có vẫn xanh sau khi gỡ, kể cả kiểm thử trạng thái ví có nhắc chuỗi ngoài họ Ethereum |
| 3 | Mã nguồn Stellar còn nguyên: thư mục Rust, tệp adapter, giá trị `stellar` trong danh sách chuỗi |
| 4 | Phép kiểm quyền mới: bớt một hành động khỏi bảng quyền thì `verify-arch-rules.sh` báo đỏ |
| 5 | Đường dẫn đọc phiên bản trả đúng mã commit khi có biến môi trường, trả giá trị dự phòng khi không có |
| 6 | Kiểm khói báo đỏ khi địa chỉ gốc không truy cập được, báo xanh khi ứng dụng đang chạy |
| 7 | Quy trình tự động chạy thật trên một yêu cầu hợp nhất thử: việc A và việc B xanh |

Ca 7 cần đẩy lên kho mã mới kiểm được, làm ở bước cuối.

## Điều kiện hoàn thành

- [ ] `run-local-all.sh` không gọi `cargo`, có thông báo phần Soroban tạm dừng, không khuyên cài Rust.
- [ ] `verify-arch-rules.sh` không còn phép kiểm Stellar và ba mục spec Stellar.
- [ ] Mã nguồn Stellar giữ nguyên, kiểm thử hiện có vẫn xanh.
- [ ] Hai tệp quy tắc trong `.kiro/steering` chuyển Stellar thành phần mở rộng tương lai.
- [ ] `docs/tech-report.md` có mục ghi phần Stellar tạm dừng.
- [ ] Quy trình tự động có ba việc, chạy khi đẩy lên `dev` và khi mở yêu cầu hợp nhất.
- [ ] Việc A và việc B xanh trên một yêu cầu hợp nhất thử.
- [ ] Quy trình tự động gọi lại các phần của `run-local-all.sh`, không chép lại danh sách lệnh.
- [ ] Bớt một hành động khỏi bảng quyền thì phép kiểm báo đỏ.
- [ ] Đường dẫn đọc phiên bản và kiểm khói hoạt động.
- [ ] Có lưu đệm cho phụ thuộc, trình biên dịch Solidity, trình duyệt kiểm thử, bộ nhớ đệm dựng bản.
- [ ] Có hướng dẫn bật bảo vệ nhánh `dev`.
- [ ] `run-local-all.sh` xanh.

## Không làm

- **Không xóa mã nguồn Stellar.** Giữ nguyên để mở rộng đa chuỗi sau này.
- Không bỏ giá trị `stellar` khỏi danh sách chuỗi hay khỏi kiểu dữ liệu.
- Không sửa báo cáo bàn giao đã có.
- Không dựng quy trình triển khai tự động. Task này chỉ làm phần kiểm.
- Không tự bật bảo vệ nhánh trên kho mã. Chỉ viết hướng dẫn.
- Không chép danh sách lệnh vào tệp quy trình.
- Không đổi mã nguồn ứng dụng để quy trình tự động chạy được. Vướng thì ghi vào báo cáo bàn giao.
- Không để việc C chặn hợp nhất ở giai đoạn này.
- Không thêm phụ thuộc mới vào ứng dụng.
