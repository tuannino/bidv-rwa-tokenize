import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { WPT_ISSUE_PRICE_VND as REEXPORTED_PRICE, wptToVnd } from '@/lib/bank/issuance';
import { createMockLedger, resetMockLedger } from '@/lib/ledger/mock.adapter';

/**
 * Chốt an toàn cho quyết định "giá phát hành có MỘT nguồn" (MC-01 Bước 6, R5).
 *
 * Trước MC-01 có hai hằng số độc lập cùng ý nghĩa: `WPT_ISSUE_PRICE_VND` ở tầng nghiệp vụ
 * (dùng để hiển thị và quy đổi) và `DEFAULT_WPT_PRICE_VND` ở mock adapter (dùng để khớp lệnh).
 * Đổi một chỗ thì màn nhà đầu tư hiện giá mới trong khi `quotePurchase` vẫn tính giá cũ — và
 * KHÔNG test nào đỏ. Đó là loại sai tệ nhất: sai âm thầm, ở đúng con số ra tiền.
 *
 * Test này CỐ Ý không hardcode 100.000 ở bất cứ đâu. Nó đọc giá từ nguồn duy nhất rồi suy ra
 * số tiền phải trả. Nhờ vậy:
 *
 *  - đổi giá ở nguồn duy nhất -> vẫn xanh (đúng, vì cả hai tầng cùng đổi theo);
 *  - tách lại thành hai hằng số -> đỏ ngay.
 *
 * Nếu test hardcode 100.000 thì nó bắt được đột biến thứ hai nhưng cũng đỏ luôn với đột biến
 * thứ nhất, tức nó kiểm "giá bằng 100.000" chứ không kiểm "hai chỗ không lệch nhau" — chệch
 * đúng tính chất cần bảo vệ.
 */

const SRC = path.resolve(__dirname, '../src');
const MOCK_ADAPTER = path.join(SRC, 'lib/ledger/mock.adapter.ts');
const ISSUANCE = path.join(SRC, 'lib/bank/issuance.ts');
const SINGLE_SOURCE = path.join(SRC, 'lib/config/issue-terms.ts');

/** `100_000` / `100_000n` — khai hằng số bằng số đếm nguyên văn, tức MỘT nguồn giá. */
const LITERAL_PRICE_DECL =
  /(?:export\s+)?const\s+([A-Za-z_$][\w$]*(?:PRICE|Price)[\w$]*)\s*=\s*[\d_]+n?\s*;/g;

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('giá phát hành WPT — một nguồn duy nhất', () => {
  beforeEach(() => resetMockLedger());

  /**
   * Chốt nền cho mọi ca dưới: nguồn phải là số dương dùng được.
   *
   * Không phải phép kiểm hình thức. Nếu một ngày `mock.adapter` nhập giá qua một vòng phụ thuộc
   * thì giá lúc khởi tạo module là `undefined` -> `BigInt(undefined)` ném, hoặc `0` -> khớp lệnh
   * thành "mua không mất tiền". Ca này đứng trước để lỗi đó không bị đọc nhầm thành lệch giá.
   */
  it('nguồn duy nhất là số nguyên dương, không phải undefined hay 0', () => {
    expect(typeof WPT_ISSUE_PRICE_VND).toBe('number');
    expect(Number.isSafeInteger(WPT_ISSUE_PRICE_VND)).toBe(true);
    expect(WPT_ISSUE_PRICE_VND).toBeGreaterThan(0);
  });

  it('quotePurchase cho 1 WPT bằng đúng giá ở nguồn duy nhất', async () => {
    const ledger = createMockLedger();
    expect(await ledger.quotePurchase(1n)).toBe(BigInt(WPT_ISSUE_PRICE_VND));
  });

  /**
   * Lượng khác 1 để bắt lỗi nhân/chia: giá đúng mà công thức sai thì ca 1 WPT vẫn xanh.
   * Số lớn để chắc rằng phép tính chạy trên `bigint`, không tụt về `number`.
   */
  it.each([2n, 7n, 250n, 1_000_000n, 123_456_789n])(
    'quotePurchase cho %s WPT = lượng × giá ở nguồn duy nhất',
    async (amount) => {
      const ledger = createMockLedger();
      expect(await ledger.quotePurchase(amount)).toBe(BigInt(WPT_ISSUE_PRICE_VND) * amount);
    },
  );

  /**
   * Đây là phát biểu nghiệp vụ của cả test: con số nhà đầu tư THẤY (`wptToVnd`, tầng nghiệp vụ)
   * và con số nhà đầu tư TRẢ (`quotePurchase`, tầng cổng) là cùng một con số.
   *
   * Từ BE-04 `wptToVnd` nhận GIÁ làm tham số thay vì đọc hằng số bên trong — xem lập luận ở
   * `lib/bank/issuance.ts`. Ca này truyền vào chính con số ở nguồn duy nhất, nên nó vẫn kiểm đúng
   * tính chất cũ: hai tầng không lệch nhau. Một `createMockLedger()` KHÔNG truyền
   * `readInitialPrice` thì chạy bằng mặc định trong mã, tức là không cần cơ sở dữ liệu.
   */
  it.each(['1', '3', '250', '1000000'])(
    'giá hiển thị và giá khớp lệnh cho %s WPT là cùng một con số',
    async (amount) => {
      const ledger = createMockLedger();
      expect(wptToVnd(amount, WPT_ISSUE_PRICE_VND)).toBe(
        (await ledger.quotePurchase(BigInt(amount))).toString(),
      );
    },
  );

  it('re-export ở lib/bank/issuance.ts là chính giá ở nguồn duy nhất', () => {
    expect(REEXPORTED_PRICE).toBe(WPT_ISSUE_PRICE_VND);
  });

  /**
   * Ba ca dưới kiểm CẤU TRÚC, không kiểm giá trị.
   *
   * Cần thêm chúng vì các ca trên chỉ bắt được lúc hai bản đã lệch GIÁ TRỊ. Ai khai lại hằng số
   * với đúng con số hôm nay thì mọi ca trên vẫn xanh, và bẫy chỉ sập ở lần đổi giá sau — đúng
   * tình huống mà Bước 6 được lập ra để dẹp.
   */
  it('mock.adapter.ts suy ra giá từ nguồn duy nhất, không khai bằng số', () => {
    const source = readFileSync(MOCK_ADAPTER, 'utf8');
    const decl = /const\s+DEFAULT_WPT_PRICE_VND\s*=\s*([^;]+);/.exec(source);

    expect(decl, 'mock.adapter.ts phải còn khai `DEFAULT_WPT_PRICE_VND`').not.toBeNull();
    expect(
      decl?.[1],
      'Giá phải suy ra từ `WPT_ISSUE_PRICE_VND` (nguồn: lib/config/issue-terms.ts), ' +
        'không được khai bằng số đếm ở đây.',
    ).toContain('WPT_ISSUE_PRICE_VND');
    expect(source).toContain("from '@/lib/config/issue-terms'");
  });

  it('lib/bank/issuance.ts re-export, không khai lại hằng số', () => {
    const source = readFileSync(ISSUANCE, 'utf8');
    expect(
      /const\s+WPT_ISSUE_PRICE_VND\s*=/.test(source),
      'issuance.ts phải `export { WPT_ISSUE_PRICE_VND }` lấy từ lib/config/issue-terms.ts, ' +
        'không khai lại bằng `const`.',
    ).toBe(false);
    expect(source).toContain("from '@/lib/config/issue-terms'");
  });

  /**
   * Danh sách ĐẦY ĐỦ các hằng số khai bằng số đếm mà tên có chứa `PRICE`, kèm tệp chứa chúng.
   *
   * Liệt kê tường minh chứ không chỉ đếm số tệp: thêm một hằng số dạng này ở bất cứ đâu — kể cả
   * trong chính tệp nguồn duy nhất — đều làm ca kiểm đỏ và buộc người thêm phải sửa danh sách
   * này một cách có chủ ý. Đó đúng là điều cần: mỗi dòng ở đây là một con số về giá mà không suy
   * ra từ dòng nào khác, và số dòng đó phải nhỏ và được biết hết.
   *
   * `WPT_PRICE_CHANGE_THRESHOLD` nằm trong danh sách vì TÊN nó chứa `PRICE`, nhưng nó KHÔNG phải
   * một mức giá — nó là hệ số chặn đổi giá quá mạnh (BE-04). Nó đứng cùng tệp với giá vì cả hai
   * là điều khoản của cùng một đợt phát hành, nên không vi phạm "giá có một nguồn".
   */
  it('mọi hằng số giá khai bằng số đếm đều nằm ở tệp nguồn duy nhất', () => {
    const declarations = tsFilesUnder(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(LITERAL_PRICE_DECL)].map(
        (match) => `${path.relative(SRC, file)}: ${match[1]}`,
      ),
    );
    const source = path.relative(SRC, SINGLE_SOURCE);

    expect(
      [...declarations].sort(),
      'Mỗi dòng ở đây là một con số về giá không suy ra từ dòng nào khác. Dòng lạ nghĩa là giá ' +
        'lại có hai nguồn — nhập từ `lib/config/issue-terms.ts` thay vì khai thêm.',
    ).toEqual(
      [`${source}: WPT_ISSUE_PRICE_VND`, `${source}: WPT_PRICE_CHANGE_THRESHOLD`].sort(),
    );
  });

  /**
   * Phát biểu vẫn phải giữ: chỉ MỘT tệp được khai loại hằng số này.
   *
   * Tách khỏi ca trên vì hai ca trả lời hai câu khác nhau, và câu này là câu quan trọng hơn: ca
   * trên đỏ khi có hằng số mới (có thể hợp lệ), ca này đỏ khi hằng số đó nằm ở tệp khác — thứ
   * chưa bao giờ hợp lệ.
   */
  it('cả app/src chỉ có MỘT tệp khai hằng số giá bằng số đếm', () => {
    /**
     * Dùng `matchAll` rồi lọc theo số kết quả, KHÔNG dùng `regex.test()`.
     *
     * `LITERAL_PRICE_DECL` có cờ `g` nên `test()` mang theo `lastIndex` giữa các lời gọi: tệp thứ
     * hai sẽ được dò từ giữa chuỗi và khai báo ở đầu tệp bị bỏ sót. `matchAll` tạo iterator riêng
     * mỗi lần nên không có trạng thái dính lại.
     */
    const files = tsFilesUnder(SRC).filter(
      (file) => [...readFileSync(file, 'utf8').matchAll(LITERAL_PRICE_DECL)].length > 0,
    );

    expect(files.map((file) => path.relative(SRC, file))).toEqual([
      path.relative(SRC, SINGLE_SOURCE),
    ]);
  });
});
