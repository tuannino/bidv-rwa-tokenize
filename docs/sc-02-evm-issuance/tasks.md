# SC-02 — Kế hoạch thực hiện

Mỗi nhóm dưới đây là một mục tiêu commit; không gom toàn bộ task vào một commit.

- [ ] 0. Khởi tạo task
  - Tạo nhánh `feat/sc-02-evm-issuance` từ `dev` đã chứa bổ sung demo.
  - Chuyển riêng SC-02 `planned → inProgress`; tạo checkpoint từ khuôn.
  - Đo lại 3 marker, test nền và địa chỉ Hardhat hiện tại.

- [ ] 1. Chốt bất biến phát hành ở contract
  - Thêm trạng thái/getter/event và `mintInitialSupply` vào ProjectToken.
  - Khóa `mint` trước khởi tạo và khóa địa chỉ khác SPV.
  - Viết contract test cho lần đầu, nhiều đợt, Burn hết, role/KYC/freeze và tranh chấp.
  - Commit đề xuất: `feat(sc-02): khóa phát hành WPT theo ví SPV`.

- [ ] 2. Đồng bộ deploy và ABI
  - Cập nhật deploy/verify, ABI tối giản và ABI sinh tự động.
  - Deploy lại Hardhat, kiểm địa chỉ/bytecode/role/getter.
  - Chạy test đối chiếu ABI và luật địa chỉ.
  - Commit đề xuất: `chore(sc-02): đồng bộ deploy và ABI phát hành`.

- [ ] 3. Nối EVM adapter
  - Hiện thực ba method SC-02; dịch lỗi có ngữ cảnh.
  - Bổ sung adapter test cả success/revert/zero address.
  - Gỡ đúng 3 marker SC-02, sinh lại báo cáo marker.
  - Commit đề xuất: `feat(sc-02): nối phát hành EVM vào ledger port`.

- [ ] 4. Kiểm luồng maker–checker Hardhat
  - Chạy Mint lần đầu, Mint lần sau, sai SPV, vượt trần và Burn qua service.
  - Thêm E2E Hardhat cho GDV lập → KSV duyệt → receipt → số liệu nguồn cung.
  - Giữ đường demo trực tiếp mặc định tắt.
  - Commit đề xuất: `test(sc-02): khóa luồng mint burn EVM đầu cuối`.

- [ ] 5. Bàn giao
  - Chạy `run-local-all.sh`, build, E2E mock và E2E Hardhat liên quan.
  - Cập nhật tech report/checkpoint; chuyển SC-02 sang `done` nếu mọi DoD đạt.
  - Ghi rõ SC-03 vẫn blocked và không tuyên bố mua/bán EVM đã hoạt động.
  - Commit đề xuất: `docs(sc-02): hoàn tất kiểm chứng và bàn giao`.
