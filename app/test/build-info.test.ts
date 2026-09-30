import { afterEach, describe, expect, it } from 'vitest';
import { BUILD_INFO_FALLBACK, buildInfo } from '@/lib/config/build-info';

/**
 * Đường dẫn đọc phiên bản (`GET /api/version`) là thứ kiểm khói gọi sau mỗi lần triển khai để
 * xác nhận máy đang chạy ĐÚNG bản vừa đẩy lên.
 *
 * Vì sao đáng test: hai chế độ của nó hỏng theo hai kiểu ngược nhau và đều im lặng.
 *  - Không đọc được biến môi trường -> luôn trả giá trị dự phòng, nên kiểm khói báo xanh cho
 *    một bản triển khai CŨ. Đúng thứ nó tồn tại để phát hiện thì nó bỏ qua.
 *  - Không có giá trị dự phòng -> chạy cục bộ là ném lỗi, và người ta sẽ tắt kiểm khói đi.
 */
const VARS = ['BUILD_COMMIT_SHA', 'BUILD_BRANCH', 'BUILD_TIME'] as const;

// Lưu lại giá trị có trước rồi khôi phục: nơi chạy tự động ĐÃ đặt các biến này, nên xoá trắng
// sau mỗi ca sẽ làm ca sau chạy trên một môi trường khác môi trường thật.
const ORIGINAL = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of VARS) {
    const before = ORIGINAL[key];
    if (before === undefined) delete process.env[key];
    else process.env[key] = before;
  }
});

const clearVars = () => {
  for (const key of VARS) delete process.env[key];
};

describe('thông tin phiên bản của bản đang chạy', () => {
  it('trả đúng mã commit, nhánh và mốc dựng bản khi nơi chạy tự động cấp biến', () => {
    clearVars();
    process.env.BUILD_COMMIT_SHA = '0f5dd8e9c4b1a2d3e4f5061728394a5b6c7d8e9f';
    process.env.BUILD_BRANCH = 'op/01-ci';
    process.env.BUILD_TIME = '2026-09-29T10:20:30.000Z';

    const info = buildInfo();

    expect(info.commit).toBe('0f5dd8e9c4b1a2d3e4f5061728394a5b6c7d8e9f');
    expect(info.branch).toBe('op/01-ci');
    expect(info.buildTime).toBe('2026-09-29T10:20:30.000Z');
    expect(info.source).toEqual({ commit: 'env', branch: 'env', buildTime: 'env' });
  });

  it('trả giá trị dự phòng khi không có biến nào — chạy cục bộ', () => {
    clearVars();

    const info = buildInfo();

    expect(info.commit).toBe(BUILD_INFO_FALLBACK);
    expect(info.branch).toBe(BUILD_INFO_FALLBACK);
    expect(info.source.commit).toBe('fallback');
    expect(info.source.branch).toBe('fallback');
    // Mốc dự phòng phải là thời điểm hợp lệ, không phải chuỗi "local": kiểm khói so mốc này
    // với giờ hiện tại, nên một chuỗi không parse được sẽ thành NaN và phép so im lặng sai.
    expect(info.source.buildTime).toBe('fallback');
    expect(Number.isNaN(Date.parse(info.buildTime))).toBe(false);
  });

  it('biến đặt thành chuỗi trống hoặc chỉ khoảng trắng thì coi như KHÔNG đặt', () => {
    clearVars();
    // `BUILD_COMMIT_SHA: ${{ github.sha }}` trong một ngữ cảnh không có sẵn giá trị sẽ cho ra
    // chuỗi TRỐNG, không phải biến thiếu. Nhận chuỗi trống làm mã commit thì `/api/version`
    // trả `commit: ""` kèm `source: "env"` — vừa vô nghĩa vừa nói dối về nguồn.
    process.env.BUILD_COMMIT_SHA = '';
    process.env.BUILD_BRANCH = '   ';

    const info = buildInfo();

    expect(info.commit).toBe(BUILD_INFO_FALLBACK);
    expect(info.branch).toBe(BUILD_INFO_FALLBACK);
    expect(info.source).toEqual({
      commit: 'fallback',
      branch: 'fallback',
      buildTime: 'fallback',
    });
  });

  it('cắt khoảng trắng hai đầu — giá trị dán tay thường kèm ký tự xuống dòng', () => {
    clearVars();
    process.env.BUILD_COMMIT_SHA = '  abc1234\n';

    expect(buildInfo().commit).toBe('abc1234');
  });

  it('mốc dự phòng KHÔNG đổi giữa hai lời gọi', () => {
    clearVars();

    // Mốc dự phòng nghĩa là "giờ server khởi động". Tính lại mỗi lời gọi thì nó luôn trông
    // như vừa dựng bản xong, và người đọc /api/version sẽ tin đó là giờ dựng bản thật.
    expect(buildInfo().buildTime).toBe(buildInfo().buildTime);
  });

  it('thiếu một biến thì chỉ trường đó dự phòng, hai trường kia vẫn từ env', () => {
    clearVars();
    process.env.BUILD_COMMIT_SHA = 'deadbeef';
    process.env.BUILD_TIME = '2026-09-29T00:00:00.000Z';

    const info = buildInfo();

    expect(info.source).toEqual({ commit: 'env', branch: 'fallback', buildTime: 'env' });
    expect(info.commit).toBe('deadbeef');
    expect(info.branch).toBe(BUILD_INFO_FALLBACK);
  });
});
