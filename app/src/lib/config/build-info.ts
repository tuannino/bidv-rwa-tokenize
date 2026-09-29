import 'server-only';

/**
 * Thông tin phiên bản của bản đang chạy: mã commit, tên nhánh, thời điểm dựng bản.
 *
 * Đọc biến môi trường ở đây và CHỈ ở đây, cùng lý do với `env.ts` (LUẬT 2 — xem
 * `scripts/verify-arch-rules.sh` mục "process.env chỉ được đọc ở config"). Route handler
 * `app/api/version` chỉ gọi hàm, không tự đọc `process.env`.
 *
 * ## Vì sao tách khỏi `env.ts`
 *
 * `serverEnv()` **ném lỗi** khi cấu hình không hợp lệ (khoá ký sai định dạng, `KEEPER_SECRET`
 * quá ngắn...). Đó là hành vi đúng cho cấu hình nghiệp vụ, nhưng sai cho đường dẫn đọc phiên
 * bản: nơi đầu tiên người ta gọi khi nghi bản triển khai có vấn đề chính là `/api/version`, và
 * nó phải trả lời được **kể cả khi** cấu hình đang sai. Ba biến ở đây không có giá trị nào là
 * không hợp lệ, nên không có gì để validate.
 *
 * ## Vì sao không đọc `GITHUB_SHA`
 *
 * Tên biến ở đây là tên của ỨNG DỤNG, không phải của một nơi chạy cụ thể. Quy trình tự động
 * gán giá trị vào (`BUILD_COMMIT_SHA: ${{ github.sha }}` trong `.github/workflows/ci.yml`), và
 * đổi sang nơi chạy khác chỉ là đổi phía trái dấu hai chấm. Đọc thẳng `GITHUB_SHA` thì ứng
 * dụng tự gắn mình vào một nhà cung cấp, và trên VPS hay Cloudflare thì biến đó không tồn tại.
 */

/** Giá trị trả về khi biến môi trường trống — chạy cục bộ, hoặc quy trình triển khai chưa truyền. */
export const BUILD_INFO_FALLBACK = 'local';

/**
 * Mốc thời gian dự phòng cho `buildTime`: lúc tiến trình nạp tệp này.
 *
 * Tính MỘT LẦN ở cấp module, không tính lại mỗi lời gọi. Tính lại thì mỗi lần gọi
 * `/api/version` ra một giờ khác nhau, và người đọc sẽ tin đó là giờ dựng bản — một con số
 * luôn "mới" là con số vô dụng và gây hiểu sai. Ở đây nó nghĩa là "giờ server khởi động",
 * và trường `source.buildTime` nói rõ đó là giá trị dự phòng.
 */
const PROCESS_START_ISO = new Date().toISOString();

/** Giá trị đến từ biến môi trường, hay là giá trị dự phòng. */
export type BuildInfoSource = 'env' | 'fallback';

export type BuildInfo = {
  commit: string;
  branch: string;
  buildTime: string;
  /**
   * Từng trường lấy từ đâu.
   *
   * Không phải trang trí: `commit: "local"` một mình thì không phân biệt được "đang chạy cục
   * bộ" với "quy trình triển khai quên truyền biến" — hai chuyện cần xử lý khác nhau hoàn
   * toàn. `source` biến suy đoán đó thành dữ liệu.
   */
  source: { commit: BuildInfoSource; branch: BuildInfoSource; buildTime: BuildInfoSource };
};

/** Trống, hoặc chỉ có khoảng trắng, đều coi như KHÔNG đặt. */
function readVar(value: string | undefined, fallback: string): [string, BuildInfoSource] {
  const trimmed = value?.trim();
  return trimmed ? [trimmed, 'env'] : [fallback, 'fallback'];
}

/**
 * Đọc thông tin phiên bản. KHÔNG cache: ba phép đọc `process.env` là đủ rẻ, và cache làm test
 * phải có hàm dọn cache như `resetServerEnvCache()` — thêm một thứ phải nhớ gọi, đổi lấy một
 * khoản tiết kiệm không đo được.
 */
export function buildInfo(): BuildInfo {
  const [commit, commitSource] = readVar(process.env.BUILD_COMMIT_SHA, BUILD_INFO_FALLBACK);
  const [branch, branchSource] = readVar(process.env.BUILD_BRANCH, BUILD_INFO_FALLBACK);
  const [buildTime, buildTimeSource] = readVar(process.env.BUILD_TIME, PROCESS_START_ISO);

  return {
    commit,
    branch,
    buildTime,
    source: { commit: commitSource, branch: branchSource, buildTime: buildTimeSource },
  };
}
