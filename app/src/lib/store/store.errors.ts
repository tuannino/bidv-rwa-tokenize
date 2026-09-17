/**
 * Lỗi dùng chung cho MỌI cổng lưu trữ, và các phép kiểm mà CẢ HAI bản hiện thực đều gọi.
 *
 * Vì sao gom vào một file: bản bộ nhớ và bản Postgres phải từ chối CÙNG một thứ và ném
 * CÙNG một loại lỗi (BE-09 QĐ-3). Nếu mỗi bản tự viết phép kiểm của mình thì hai bản sẽ
 * lệch dần, và lệch theo đúng hướng tệ nhất: bản bộ nhớ dễ tính hơn, nên test xanh ở
 * free-tier rồi đỏ khi `docker compose up` — loại lỗi tốn nhiều thời gian nhất để tìm.
 *
 * Không `import 'server-only'` ở đây: file chỉ có lớp lỗi và hàm thuần, không đọc env,
 * không mở kết nối. Hai file hiện thực mới là chỗ có hàng rào đó.
 */

/** Hai bản hiện thực. Giữ đúng hai giá trị mà `ITxnStore.kind` đang dùng. */
export type StoreKind = 'memory' | 'prisma';

/**
 * Vi phạm ràng buộc DUY NHẤT.
 *
 * Bản Postgres quy lỗi `23505` (unique_violation) về đây; bản bộ nhớ tự kiểm rồi ném
 * chính lớp này. Nhờ vậy nghiệp vụ bắt lỗi ĐÚNG MỘT KIỂU, không phải bóc `error.code`
 * của driver ở tầng trên — thứ sẽ không tồn tại khi chạy bản bộ nhớ.
 */
export class UniqueConstraintError extends Error {
  readonly table: string;
  readonly columns: readonly string[];

  constructor(table: string, columns: readonly string[], hint?: string) {
    super(
      `Đã có dòng khác trong "${table}" với cùng ${columns.map((c) => `"${c}"`).join(' + ')}.` +
        (hint ? ` ${hint}` : ''),
    );
    this.name = 'UniqueConstraintError';
    this.table = table;
    this.columns = columns;
  }
}

/**
 * Giá trị trạng thái không nằm trong danh sách hợp lệ.
 *
 * Cần lớp lỗi riêng vì cột trạng thái là `String` chứ không phải enum của Postgres
 * (BE-09 QĐ-4). Đánh đổi của QĐ-4 là cơ sở dữ liệu KHÔNG còn tự chặn giá trị lạ, nên
 * chốt chặn duy nhất là phép kiểm ở đây — và nó phải chạy ở cả hai bản.
 */
export class InvalidStatusError extends Error {
  readonly table: string;
  readonly value: string;
  readonly allowed: readonly string[];

  constructor(table: string, value: string, allowed: readonly string[]) {
    super(
      `Trạng thái "${value}" không hợp lệ cho "${table}". ` +
        `Giá trị được phép: ${allowed.join(', ')}.`,
    );
    this.name = 'InvalidStatusError';
    this.table = table;
    this.value = value;
    this.allowed = allowed;
  }
}

/**
 * Trỏ tới một dòng cha không tồn tại (vi phạm khoá ngoài).
 *
 * Bản Postgres quy lỗi `23503` (foreign_key_violation) về đây; bản bộ nhớ tự kiểm rồi ném
 * chính lớp này. Cần lớp RIÊNG, không gộp vào `UniqueConstraintError`: "đã có dòng trùng"
 * và "không có dòng cha" là hai tình huống trái ngược, và nghiệp vụ xử lý chúng khác nhau
 * — một cái là dừng vì đã làm rồi, một cái là lỗi lập trình phải sửa.
 */
export class ForeignKeyError extends Error {
  readonly table: string;
  readonly column: string;

  constructor(table: string, column: string, hint?: string) {
    super(`"${table}"."${column}" trỏ tới một dòng không tồn tại.` + (hint ? ` ${hint}` : ''));
    this.name = 'ForeignKeyError';
    this.table = table;
    this.column = column;
  }
}

/** Lời gọi sai hợp đồng của cổng (số tiền không phải số nguyên, lô quá lớn, ...). */
export class StoreUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreUsageError';
  }
}

/**
 * Kiểm giá trị trạng thái, trả về giá trị đã thu hẹp kiểu.
 *
 * Trả về giá trị thay vì dùng chữ ký `asserts`: chỗ gọi viết được
 * `status: assertStatus(...)` trong đúng biểu thức khởi tạo, không cần một câu lệnh
 * riêng trước đó rồi mới dùng biến.
 */
export function assertStatus<T extends string>(
  table: string,
  allowed: readonly T[],
  value: string,
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new InvalidStatusError(table, value, allowed);
  }
  return value as T;
}

/** Số chữ số tối đa của `Decimal(78, 0)`. */
const MAX_AMOUNT_DIGITS = 78;

/**
 * Số tiền / số lượng token: chuỗi chữ số thập phân, không âm, tối đa 78 chữ số.
 *
 * Vì sao kiểm ở tầng cổng chứ không để cơ sở dữ liệu kiểm: Postgres sẽ từ chối
 * `"12.5"` và `"1e30"` bằng lỗi cú pháp numeric, còn bản bộ nhớ thì nhận hết. Không kiểm
 * ở đây là tự tạo ra khác biệt hành vi giữa hai bản.
 *
 * Không âm là chủ ý: mọi cột dùng hàm này đều là số WPT hoặc số VNDB, và số âm ở đó
 * không có nghĩa nào. `Decimal(78, 0)` của Postgres thì vẫn nhận số âm, nên đây là phép
 * kiểm duy nhất chặn nó.
 */
export function assertAmount(field: string, value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new StoreUsageError(
      `"${field}" phải là chuỗi chữ số nguyên không âm (đơn vị nhỏ nhất của token), nhận được "${value}". ` +
        'Số tiền đi qua biên máy chủ dạng CHUỖI vì bigint không JSON-hoá được.',
    );
  }
  if (value.length > MAX_AMOUNT_DIGITS) {
    throw new StoreUsageError(
      `"${field}" có ${value.length} chữ số, vượt giới hạn ${MAX_AMOUNT_DIGITS} của Decimal(78, 0).`,
    );
  }
  return value;
}

/** Mã snapshot của contract bắt đầu từ 1 — `balanceOfAt(_, 0)` luôn bị revert. */
export function assertSnapshotId(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new StoreUsageError(
      `snapshotId phải là số nguyên >= 1 (mã snapshot của contract bắt đầu từ 1), nhận được ${value}.`,
    );
  }
  return value;
}

/**
 * Số dòng tối đa cho một lời gọi ghi hàng loạt.
 *
 * Có giới hạn vì bản Postgres dồn cả lô vào MỘT câu `INSERT` (để lô nguyên tử: một dòng
 * vi phạm ràng buộc là cả lô không vào). Giao thức của Postgres chỉ mang được 65535 tham
 * số cho một câu lệnh, nên lô quá lớn sẽ vỡ ở tầng driver với thông báo khó hiểu. Chặn
 * sớm bằng lỗi nói rõ phải làm gì.
 *
 * Chia lô ở tầng nghiệp vụ (BE-06) chứ không ở đây: kích thước lô còn phụ thuộc giới hạn
 * của từng chuỗi, và chạy lại lô lỗi cần trạng thái mà cổng lưu trữ không có.
 */
export const MAX_BULK_ROWS = 1000;

export function assertBulkSize(field: string, count: number): void {
  if (count === 0) {
    throw new StoreUsageError(`"${field}" rỗng — không có gì để ghi.`);
  }
  if (count > MAX_BULK_ROWS) {
    throw new StoreUsageError(
      `"${field}" có ${count} dòng, vượt giới hạn ${MAX_BULK_ROWS} dòng một lời gọi. ` +
        'Chia lô ở tầng nghiệp vụ rồi gọi nhiều lần.',
    );
  }
}

/**
 * Trong MỘT lô, không ví nào xuất hiện hai lần — so sánh KHÔNG phân biệt hoa thường.
 *
 * Ràng buộc duy nhất của Postgres so sánh chuỗi CHÍNH XÁC, nên `0xAb…` và `0xab…` là hai
 * dòng khác nhau với cơ sở dữ liệu dù là cùng một ví EVM. Phép kiểm này bịt đúng chỗ hở
 * đó cho tình huống hay xảy ra nhất: cùng một lô có hai cách viết của một địa chỉ.
 *
 * KHÔNG hạ hết địa chỉ về chữ thường trước khi ghi: địa chỉ Stellar là base32 CHỮ HOA
 * (`GABC…`), hạ chữ thường là làm sai địa chỉ. Xem câu hỏi mở trong checkpoint BE-09 về
 * việc chuẩn hoá địa chỉ ở một biên duy nhất cho toàn hệ.
 */
export function assertNoDuplicateWallet(
  table: string,
  column: string,
  wallets: readonly string[],
): void {
  const seen = new Map<string, string>();
  for (const wallet of wallets) {
    const key = wallet.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new UniqueConstraintError(
        table,
        [column],
        `Trong cùng một lô có hai lần ví này: "${previous}" và "${wallet}".`,
      );
    }
    seen.set(key, wallet);
  }
}

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

/**
 * Tên ràng buộc duy nhất trong `prisma/init.sql` → bảng + cột.
 *
 * Cần bảng tra này vì `pg` chỉ trả về TÊN ràng buộc bị vi phạm. Không tra thì
 * `UniqueConstraintError` không nói được đã trùng ở cột nào, và người sửa lỗi phải mở
 * init.sql ra đối chiếu tay.
 *
 * `test/store-constraints.test.ts` đối chiếu bảng này với `CREATE UNIQUE INDEX` thật
 * trong `prisma/init.sql` theo cả hai chiều, nên thêm ràng buộc mà quên khai ở đây (hoặc
 * ngược lại) thì test đỏ ngay.
 */
export const UNIQUE_CONSTRAINTS: Readonly<
  Record<string, { table: string; columns: readonly string[] }>
> = {
  PurchaseOrder_txHash_key: { table: 'PurchaseOrder', columns: ['txHash'] },
  DistributionPeriod_periodKey_key: { table: 'DistributionPeriod', columns: ['periodKey'] },
  DistributionPayout_periodId_investorWallet_key: {
    table: 'DistributionPayout',
    columns: ['periodId', 'investorWallet'],
  },
  SettlementCase_roundId_holderWallet_key: {
    table: 'SettlementCase',
    columns: ['roundId', 'holderWallet'],
  },
  KeeperRun_jobName_periodKey_key: { table: 'KeeperRun', columns: ['jobName', 'periodKey'] },
};

/** Tên khoá ngoài trong `prisma/init.sql` → bảng + cột. */
export const FOREIGN_KEYS: Readonly<Record<string, { table: string; column: string }>> = {
  DistributionPayout_periodId_fkey: { table: 'DistributionPayout', column: 'periodId' },
  SettlementCase_roundId_fkey: { table: 'SettlementCase', column: 'roundId' },
};

/**
 * Chạy một truy vấn Postgres và quy lỗi ràng buộc về lớp lỗi của tầng cổng.
 *
 * Bọc thay vì để lỗi thô lọt lên: nghiệp vụ không được biết đang chạy trên driver nào, và
 * `error.code === '23505'` là kiến thức riêng của `pg` — viết nó ở tầng trên là buộc tầng
 * đó chỉ chạy đúng với Postgres, tức là bản bộ nhớ sẽ không đi qua cùng nhánh xử lý.
 */
export async function mapPgConstraintError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const detail = error as { code?: string; constraint?: string };
    const constraint = detail?.constraint;

    if (detail?.code === PG_UNIQUE_VIOLATION) {
      const known = constraint ? UNIQUE_CONSTRAINTS[constraint] : undefined;
      if (known) throw new UniqueConstraintError(known.table, known.columns);

      // Ràng buộc chưa khai trong bảng tra: vẫn phải là UniqueConstraintError để nghiệp vụ
      // xử lý được, nhưng nói rõ tên ràng buộc để người sửa biết phải bổ sung vào đâu.
      throw new UniqueConstraintError(
        '(chưa khai trong UNIQUE_CONSTRAINTS)',
        [constraint ?? '(không rõ)'],
        `Bổ sung ràng buộc "${constraint}" vào UNIQUE_CONSTRAINTS trong store.errors.ts.`,
      );
    }

    if (detail?.code === PG_FOREIGN_KEY_VIOLATION) {
      const known = constraint ? FOREIGN_KEYS[constraint] : undefined;
      if (known) throw new ForeignKeyError(known.table, known.column);
      throw new ForeignKeyError(
        '(chưa khai trong FOREIGN_KEYS)',
        constraint ?? '(không rõ)',
        `Bổ sung khoá ngoài "${constraint}" vào FOREIGN_KEYS trong store.errors.ts.`,
      );
    }

    throw error;
  }
}
