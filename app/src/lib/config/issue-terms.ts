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
 * ## Ghi chú cho BE-04
 *
 * Khi giá phát hành vào cơ sở dữ liệu, hằng số này thành **giá mặc định khi chưa cấu hình**.
 * Đổi ở đây là đổi cho cả hai tầng cùng lúc — BE-04 chỉ phải sửa một chỗ.
 */

/** Giá phát hành một WPT, đơn vị VND. WPT có decimals = 0 nên đây là giá của trọn một token. */
export const WPT_ISSUE_PRICE_VND = 100_000;
