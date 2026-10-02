/**
 * Điều khoản phát hành WPT — THAM SỐ CẤU HÌNH, không phải số liệu thị trường.
 *
 * NGUỒN DUY NHẤT của giá phát hành. Trước MC-01 có hai hằng số độc lập cùng ý nghĩa
 * (`lib/bank/issuance.ts` và `lib/ledger/mock.adapter.ts`), nên đổi một chỗ thì màn nhà đầu tư
 * hiện giá mới trong khi `quotePurchase` vẫn khớp lệnh theo giá cũ — mà toàn bộ test vẫn xanh.
 * `app/test/issue-price-single-source.test.ts` giữ cho việc tách lại thành hai hằng số là đỏ.
 *
 * ## Vì sao là THAM SỐ CẤU HÌNH, không phải số liệu mẫu
 *
 * `lib/mock-data.ts` chứa số liệu *bịa để minh hoạ* (sản lượng, số nhà đầu tư...) và mọi
 * thứ lấy từ đó đều phải gắn nhãn "dữ liệu mẫu" trên giao diện. Giá phát hành thì khác: nó là
 * một điều khoản của đợt phát hành, giống con số trên term sheet — do ngân hàng ấn định, không
 * phải quan sát từ thị trường. Nhờ vậy `số dư thật × giá phát hành` là *thật × tham số*, không
 * phải *thật × số bịa*, nên không vi phạm quy tắc "không trộn số liệu thật với số liệu mẫu
 * trong cùng một con số".
 *
 * ⚠️ Đây KHÔNG phải giá thị trường. Hệ thống chưa có thị trường thứ cấp nên không có giá giao
 * dịch. Mọi chỗ hiển thị con số quy đổi PHẢI ghi rõ là "theo giá phát hành", tuyệt đối không
 * gọi là giá trị thị trường hay định giá.
 *
 * ## Vì sao ở `lib/config` chứ không ở `lib/bank/issuance.ts`
 *
 * Người dùng hằng số này nằm ở HAI tầng: tầng nghiệp vụ (`lib/bank`) và tầng cổng
 * (`lib/ledger/mock.adapter.ts`). Để nó ở `lib/bank` thì tầng cổng phải nhập từ tầng nghiệp vụ,
 * tức ngược chiều phụ thuộc: đo trên nhánh này, `lib/bank` nhập từ `lib/ledger` ở 4 chỗ, chiều
 * ngược lại 0 chỗ. `lib/config` là tầng cấu hình, cả hai tầng kia nhập xuống đều thuận.
 *
 * ## Hai điều CỐ Ý ở tệp này, đừng "dọn" mất
 *
 * 1. **Không có `import` nào.** Tệp lá thì không thể tạo vòng phụ thuộc. Điều đó quan trọng vì
 *    `mock.adapter.ts` dùng hằng số này ở phạm vi module (`const DEFAULT_NAV_RATE = ...`), đúng
 *    lúc module đang khởi tạo — nơi một vòng phụ thuộc sẽ cho ra giá `undefined`/`0` và biến
 *    khớp lệnh thành "mua không mất tiền". Thêm `import` vào đây là mở lại cửa đó.
 * 2. **Không có `import 'server-only'`**, khác `env.ts` và `flags.ts` cùng thư mục. Đây là hằng
 *    số hiển thị được, không phải bí mật; chặn nó ở phía client sẽ chặn luôn `wptToVnd` và mọi
 *    màn hình muốn tự quy đổi. Cùng cách chia như `lib/session/channel.ts` (dùng chung) đứng
 *    cạnh `current-channel.ts` (`server-only`).
 *
 * ## Ba hằng số dưới đây là MẶC ĐỊNH KHI CHƯA CẤU HÌNH (BE-04)
 *
 * Từ BE-04, giá phát hành và tổng cung sống trong cơ sở dữ liệu (`SystemConfig`, `Project`) và
 * cán bộ ngân hàng đổi được. Ba hằng số ở đây là giá trị dùng khi cơ sở dữ liệu còn trống —
 * `getIssuePrice()` đọc bảng trước, không có dòng nào thì lùi về đây.
 *
 * ⚠️ KHÔNG lưu bản sao của mấy con số này vào `SystemConfig` như một "giá trị mặc định". Mặc
 * định thuộc mã nguồn nên nó đi cùng bản triển khai; lưu thêm một bản trong cơ sở dữ liệu là
 * tạo nguồn thứ hai, và nó lệch ngay lần sửa mã đầu tiên mà không ai chạy lại dữ liệu khởi tạo.
 */

/** Giá phát hành một WPT, đơn vị VND. WPT có decimals = 0 nên đây là giá của trọn một token. */
export const WPT_ISSUE_PRICE_VND = 100_000;

/**
 * Tổng cung WPT của đợt phát hành, dùng làm `Project.totalSupply` lúc khởi tạo.
 *
 * WPT có `decimals = 0` nên đây là số token trọn, không phải đơn vị nhỏ nhất — 20 triệu token
 * ứng với 2.000 tỷ VND theo giá phát hành mặc định.
 *
 * Để ở đây thay vì viết cứng trong `issueInitialSupply` vì cùng một lý do với giá: đổi quy mô
 * một đợt phát hành không được đòi sửa mã nghiệp vụ. Nghiệp vụ đọc `Project.totalSupply`;
 * hằng số này chỉ là con số nạp vào dòng `Project` đầu tiên.
 */
export const WPT_TOTAL_SUPPLY = 20_000_000;

/**
 * Hệ số chặn đổi giá quá mạnh: giá mới lệch quá **gấp đôi** hoặc **còn một nửa** so với giá
 * đang có hiệu lực thì `setIssuePrice` từ chối, trừ khi người gọi xác nhận tường minh.
 *
 * Vì sao là HỆ SỐ chứ không phải phần trăm: giá phát hành không dao động theo thị trường, nên
 * mọi lần đổi đều là quyết định có chủ ý. Ngưỡng ở đây không nhằm chặn biến động, nó nhằm chặn
 * lỗi ĐÁNH MÁY — thiếu hoặc thừa một chữ số 0 làm giá lệch 10 lần, còn sửa 100.000 thành
 * 120.000 là việc bình thường. Phần trăm nhỏ sẽ chặn cả việc bình thường; hệ số 2 chỉ chặn
 * đúng loại sai lệch một bậc độ lớn.
 *
 * KHÔNG để 1: khi đó mọi lần đổi giá đều cần xác nhận, và lời xác nhận trở thành động tác bấm
 * cho qua — lúc đó nó không còn chặn được gì.
 */
export const WPT_PRICE_CHANGE_THRESHOLD = 2;

/**
 * Khoá của từng tham số trong bảng `SystemConfig`.
 *
 * Khai thành hằng số thay vì gõ chuỗi tại chỗ gọi: khoá là thứ nối mã nguồn với một dòng trong
 * cơ sở dữ liệu, mà gõ sai chuỗi thì không có lỗi biên dịch nào — chỉ có một lần đọc trả về
 * "chưa cấu hình" rồi âm thầm dùng giá mặc định, đúng lúc ngân hàng vừa đặt giá mới.
 */
export const CONFIG_KEYS = {
  issuePriceVnd: 'wpt.issue_price_vnd',
  priceChangeThreshold: 'wpt.price_change_threshold',
  distributionBatchSize: 'distribution.batch_size',
  distributionDustWallet: 'distribution.dust_wallet',

  // --- BE-07: tiến trình tự động chia khi ví lợi nhuận nhận tiền -------------
  /**
   * Số dư ví chia lợi nhuận mà hệ thống ĐÃ XỬ LÝ XONG — mốc để phát hiện tiền mới.
   *
   * ⚠️ Đây là **số dư dự kiến còn lại** sau kỳ đã tất toán, KHÔNG phải tổng tiền đã nhận
   * luỹ tiến. Lý do nằm ở chính hành vi của chuỗi: chia lợi nhuận LÀM GIẢM số dư ví lợi
   * nhuận (`ProfitDistributor.distributeTo` chuyển VNDB ra khỏi hợp đồng, và
   * `mock.adapter` làm đúng thế), nên một mốc luỹ tiến sẽ luôn lớn hơn số dư thật ngay
   * sau kỳ đầu tiên và mọi lần so sánh về sau đều kết luận "số dư giảm".
   *
   * Sau một kỳ chia xong trọn vẹn, số dư còn lại đúng bằng phần dư làm tròn của kỳ đó
   * (`DistributionRunView.dust`) — đó là giá trị ghi vào khoá này. Nhờ vậy phần dư KHÔNG
   * bị hiểu là tiền mới, và mọi đồng vượt quá mốc là tiền SPV vừa nạp.
   */
  distributionLastSettledBalance: 'distribution.last_settled_balance',
  /** Số lô tối đa MỘT lượt chia được gửi. Xem `DISTRIBUTION_MAX_BATCHES_PER_RUN`. */
  distributionMaxBatchesPerRun: 'distribution.max_batches_per_run',
  /** Mức tăng tối thiểu mới coi là tiền mới. Xem `DISTRIBUTION_MIN_NEW_BALANCE`. */
  distributionMinNewBalance: 'distribution.min_new_balance',
  /** Số vòng chạy tối đa cho một kỳ trước khi coi là treo. Xem `DISTRIBUTION_STUCK_AFTER_RUNS`. */
  distributionStuckAfterRuns: 'distribution.stuck_after_runs',

  // --- FE-21: hạn mức rút của Người bán ------------------------------------------
  /**
   * Chế độ khoá: `FIXED` khoá một số VNDB cố định, `PERCENT` khoá một phần trăm số dư tại lúc rút.
   * Hai chế độ theo chốt của chủ dự án. KHÔNG có mặc định trong mã: chưa cấu hình thì không rút được.
   */
  sellerWithdrawLimitMode: 'seller.withdraw_limit_mode',
  /** Tham số của chế độ: số VNDB (`FIXED`) hoặc số phần trăm nguyên 0–100 (`PERCENT`). */
  sellerWithdrawLimitValue: 'seller.withdraw_limit_value',
  /** Phí một lần rút, đơn vị VNDB. */
  sellerWithdrawFeeVnd: 'seller.withdraw_fee_vnd',
} as const;

/**
 * Số ví tối đa trong MỘT lô chia lợi nhuận (BE-06), dùng khi bảng chưa có dòng nào.
 *
 * Phải là tham số cấu hình chứ không phải hằng số trong mã: kích thước lô tối ưu phụ thuộc giới
 * hạn gas của từng chuỗi và phải ĐO thực tế trên chuỗi đó, nên người vận hành cần đổi được mà
 * không chờ một bản triển khai mới. `ILedgerPort.distributeBatch` cố ý không tự chia lô vì lý do
 * này (BE-01 R5.3).
 *
 * 50 là mức thận trọng: một lô chuyển VNDB cho 50 ví nằm an toàn dưới giới hạn block gas của
 * EVM, và lô nhỏ thì một lô lỗi chỉ phải chạy lại 50 hồ sơ.
 */
export const DISTRIBUTION_BATCH_SIZE = 50;

/**
 * Chặn trên của kích thước lô. Một cấu hình gõ sai (ví dụ 50000) không được đi tới chuỗi rồi mới
 * vỡ: lời gọi sẽ thất bại vì hết gas SAU khi đã tốn phí, và thông báo của RPC không nói được là
 * do lô quá lớn. Chặn ở đây thì lỗi cấu hình hiện ra trước khi chạm chuỗi.
 *
 * ⚠️ KHÔNG phải cùng một giới hạn với `MAX_BULK_ROWS` của cổng lưu trữ: cái đó chặn số dòng một
 * câu `INSERT` mang được, cái này chặn số ví một giao dịch on-chain mang được. Hai giới hạn của
 * hai hệ thống khác nhau, gộp lại là buộc chúng phải đổi cùng nhau.
 */
export const DISTRIBUTION_BATCH_SIZE_MAX = 500;

/**
 * Số lô tối đa MỘT lượt chia được gửi (BE-07), dùng khi bảng chưa có dòng nào.
 *
 * Vì sao phải có chặn này chứ không cứ chia hết trong một lượt: một lượt chia cho 5.000 ví
 * với lô 50 là 100 giao dịch on-chain nối tiếp nhau, mỗi giao dịch còn phải chờ biên nhận.
 * Không nền chạy nào cho một yêu cầu HTTP sống lâu thế — free-tier serverless cắt sau vài
 * chục giây, và tiến trình bị cắt GIỮA lượt để lại kỳ chia dở mà không ai báo.
 *
 * Chặn số lô biến việc đó thành chuyện bình thường: mỗi lượt làm một phần, `outstanding`
 * khác 0 nói còn phải chạy lại, và tiến trình định kỳ gọi tiếp. 5 lô × 50 ví = 250 ví mỗi
 * lượt — đủ nhanh để xong trong một yêu cầu, đủ lớn để không cần hàng trăm lượt.
 */
export const DISTRIBUTION_MAX_BATCHES_PER_RUN = 5;

/**
 * Chặn trên của số lô mỗi lượt. Cùng lập luận với `DISTRIBUTION_BATCH_SIZE_MAX`: một cấu
 * hình gõ sai (5000) làm mất hẳn tác dụng của chặn số lô, và triệu chứng chỉ hiện ra khi
 * một lượt chia bị nền chạy cắt giữa đường.
 */
export const DISTRIBUTION_MAX_BATCHES_PER_RUN_MAX = 100;

/**
 * Mức tăng số dư ví lợi nhuận tối thiểu mới coi là "SPV vừa nạp tiền" (BE-07), đơn vị VNDB.
 *
 * VNDB có `decimals = 0` nên đây là số VND trọn. 1.000 VND nhỏ hơn mọi lần nạp lợi tức
 * thật (kỳ chia của một dự án điện gió tính bằng trăm triệu) và lớn hơn mọi sai lệch lẻ có
 * thể còn lại trong ví sau một kỳ — phần dư làm tròn nhiều nhất là một đồng mỗi ví.
 *
 * Vì sao cần ngưỡng khi mốc số dư đã trừ đúng phần dư: mốc chỉ đúng với phần dư của kỳ mà
 * hệ thống tự chia. Tiền vào ví lợi nhuận bằng đường khác (chuyển tay, hoàn trả một giao
 * dịch lỗi) không qua mốc nào, và mở một kỳ chia cho vài đồng lẻ là tốn một ảnh chụp trên
 * chuỗi cộng một giao dịch cho mỗi ví để chia ra số 0.
 */
export const DISTRIBUTION_MIN_NEW_BALANCE = 1_000;

/**
 * Số vòng chạy tối đa cho MỘT kỳ trước khi coi là treo và ghi cảnh báo (BE-07).
 *
 * 3 là mức để cảnh báo còn có ý nghĩa. Một kỳ bình thường xong trong một vòng, hoặc trong
 * vài vòng nếu số ví vượt `DISTRIBUTION_MAX_BATCHES_PER_RUN`. Tới vòng thứ ba mà vẫn còn ví
 * chưa nhận thì hoặc lô đang lỗi lặp lại, hoặc số ví lớn hơn mức cấu hình dự tính — cả hai
 * đều là việc người vận hành phải biết.
 *
 * KHÔNG để 1: khi đó mọi kỳ nhiều hơn một vòng đều sinh cảnh báo, và cảnh báo trở thành thứ
 * bị bỏ qua — lúc đó nó không còn báo được gì.
 */
export const DISTRIBUTION_STUCK_AFTER_RUNS = 3;

/** Mã token của dự án điện gió duy nhất trong PoC. */
export const WPT_TOKEN_SYMBOL = 'WPT';
