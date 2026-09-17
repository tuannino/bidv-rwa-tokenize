import { describe, expect, it } from 'vitest';
import {
  EXECUTABLE_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrderStateError,
  TERMINAL_ORDER_STATUSES,
  assertTransitionOrder,
  canTransitionOrder,
  findPaidPendingDeliveryStatuses,
  isOrderStatus,
  isTerminalOrderStatus,
  orderRank,
  type OrderStatus,
} from '@/lib/bank/purchase.state';

/**
 * Mô hình trạng thái lệnh mua — phần chốt trước, vì BE-09 dựng bảng dữ liệu theo nó.
 *
 * Ba thứ đáng test nhất, theo mức thiệt hại nếu sai:
 *   1. R4.2 — không có trạng thái "đã trả tiền chưa nhận token". Sai chỗ này là mô tả
 *      sai bản chất nguyên khối của giao dịch, kéo theo mã đối soát cho tình huống
 *      không tồn tại.
 *   2. R4.1 — một chiều. Cho quay lui là phá cơ chế chống gửi giao dịch hai lần.
 *   3. R4.3 — chuyển sai bị từ chối. Hở chỗ này thì một lệnh COMPLETED có thể bị đẩy
 *      lại vào EXECUTING và gửi giao dịch lần hai.
 */

/** Bảng chuyển tiếp mong đợi, chép TỪ design.md mục 1 — không import từ mã nguồn. */
const EXPECTED_TRANSITIONS: Record<string, readonly string[]> = {
  PLACED: ['CHECKING', 'EXPIRED'],
  CHECKING: ['EXECUTING', 'REJECTED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  FAILED: [],
  EXPIRED: [],
};

describe('R4.2 — không có trạng thái "đã trả tiền chưa nhận token"', () => {
  it('không tên trạng thái nào khớp mẫu PAID/PAYMENT/AWAITING_TOKEN/PENDING_DELIVERY/PARTIAL', () => {
    // Đây là chốt máy kiểm cho R4.2: thêm `PAID_PENDING_TOKEN` là đỏ ngay ở đây,
    // không phải chờ ai đọc được ghi chú trong tài liệu.
    expect(findPaidPendingDeliveryStatuses()).toEqual([]);
  });

  it('đúng 7 trạng thái, không thừa không thiếu', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'PLACED',
      'CHECKING',
      'EXECUTING',
      'COMPLETED',
      'REJECTED',
      'FAILED',
      'EXPIRED',
    ]);
  });

  it('chỉ EXECUTING nằm giữa "chưa gửi" và "đã xong" — không có trạng thái trung gian thứ hai', () => {
    // Sau CHECKING (chưa tốn phí) chỉ còn đúng một chặng có thể tốn phí. Nếu xuất hiện
    // chặng thứ hai thì đó chính là trạng thái nửa vời mà R4.2 cấm.
    const middle = ORDER_STATUSES.filter(
      (status) => !isTerminalOrderStatus(status) && status !== 'PLACED' && status !== 'CHECKING',
    );
    expect(middle).toEqual(['EXECUTING']);
  });
});

describe('bảng chuyển tiếp khớp design.md mục 1', () => {
  it('mọi trạng thái có entry, nội dung đúng từng phần tử', () => {
    for (const status of ORDER_STATUSES) {
      expect([...ORDER_TRANSITIONS[status]], `chuyển tiếp của ${status}`).toEqual(
        EXPECTED_TRANSITIONS[status],
      );
    }
  });

  it('bốn trạng thái kết thúc, suy ra từ bảng chứ không khai tay', () => {
    expect([...TERMINAL_ORDER_STATUSES]).toEqual(['COMPLETED', 'REJECTED', 'FAILED', 'EXPIRED']);
  });

  it('đích của mọi chuyển tiếp đều là trạng thái có thật', () => {
    for (const status of ORDER_STATUSES) {
      for (const target of ORDER_TRANSITIONS[status]) {
        expect(isOrderStatus(target), `${status} -> ${target}`).toBe(true);
      }
    }
  });
});

describe('R4.1 — một chiều, không quay lui', () => {
  it('mọi chuyển tiếp hợp lệ đều tăng thứ hạng', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_TRANSITIONS[from]) {
        expect(orderRank(to), `${from} -> ${to} phải tiến lên`).toBeGreaterThan(orderRank(from));
      }
    }
  });

  it('không trạng thái nào tự chuyển về chính nó', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransitionOrder(status, status), `${status} -> ${status}`).toBe(false);
    }
  });

  it('trạng thái kết thúc không đi được đâu nữa', () => {
    for (const terminal of TERMINAL_ORDER_STATUSES) {
      for (const target of ORDER_STATUSES) {
        expect(canTransitionOrder(terminal, target), `${terminal} -> ${target}`).toBe(false);
      }
    }
  });
});

describe('R4.3 — canTransitionOrder', () => {
  it('cho qua đúng 6 cặp hợp lệ', () => {
    const valid: ReadonlyArray<[OrderStatus, OrderStatus]> = [
      ['PLACED', 'CHECKING'],
      ['PLACED', 'EXPIRED'],
      ['CHECKING', 'EXECUTING'],
      ['CHECKING', 'REJECTED'],
      ['EXECUTING', 'COMPLETED'],
      ['EXECUTING', 'FAILED'],
    ];
    for (const [from, to] of valid) {
      expect(canTransitionOrder(from, to), `${from} -> ${to}`).toBe(true);
    }
    // 7 trạng thái => 49 cặp; đúng 6 cặp hợp lệ, 43 cặp còn lại phải bị từ chối.
    const total = ORDER_STATUSES.flatMap((from) =>
      ORDER_STATUSES.map((to) => canTransitionOrder(from, to)),
    ).filter(Boolean).length;
    expect(total).toBe(valid.length);
  });

  it('từ chối các chuyển tiếp sai điển hình', () => {
    const invalid: ReadonlyArray<[OrderStatus, OrderStatus, string]> = [
      // Bỏ qua bước kiểm: gửi giao dịch mà chưa kiểm số dư/ủy quyền/tồn WPT.
      ['PLACED', 'EXECUTING', 'không được nhảy qua bước kiểm'],
      // Từ chối sau khi đã gửi giao dịch — phải là FAILED, vì REJECTED nghĩa là chưa tốn phí.
      ['EXECUTING', 'REJECTED', 'đã gửi tx thì không còn là REJECTED'],
      // Đánh dấu hoàn tất mà chưa gửi giao dịch.
      ['CHECKING', 'COMPLETED', 'không hoàn tất khi chưa gửi tx'],
      // Mở lại lệnh đã đóng để gửi lần hai.
      ['COMPLETED', 'EXECUTING', 'không mở lại lệnh đã hoàn tất'],
      ['REJECTED', 'CHECKING', 'không mở lại lệnh đã từ chối'],
      ['FAILED', 'EXECUTING', 'không gửi lại trên cùng một lệnh'],
      ['EXPIRED', 'CHECKING', 'lệnh quá hạn thì đặt lệnh mới'],
      // Hết hạn sau khi đã bắt đầu kiểm/gửi.
      ['CHECKING', 'EXPIRED', 'chỉ lệnh chưa kiểm mới hết hạn được'],
      ['EXECUTING', 'EXPIRED', 'đã gửi tx thì không hết hạn'],
    ];
    for (const [from, to, why] of invalid) {
      expect(canTransitionOrder(from, to), `${from} -> ${to}: ${why}`).toBe(false);
    }
  });
});

describe('assertTransitionOrder', () => {
  it('không ném với chuyển tiếp hợp lệ', () => {
    expect(() => assertTransitionOrder('PLACED', 'CHECKING')).not.toThrow();
  });

  it('ném OrderStateError mang theo from/to', () => {
    expect(() => assertTransitionOrder('COMPLETED', 'EXECUTING')).toThrow(OrderStateError);
    try {
      assertTransitionOrder('COMPLETED', 'EXECUTING');
    } catch (error) {
      expect(error).toBeInstanceOf(OrderStateError);
      expect((error as OrderStateError).from).toBe('COMPLETED');
      expect((error as OrderStateError).to).toBe('EXECUTING');
    }
  });

  it('message nêu được lối ra hợp lệ, để người sửa không phải mở bảng', () => {
    try {
      assertTransitionOrder('PLACED', 'COMPLETED');
    } catch (error) {
      expect((error as Error).message).toContain('CHECKING');
      expect((error as Error).message).toContain('EXPIRED');
    }
    try {
      assertTransitionOrder('COMPLETED', 'CHECKING');
    } catch (error) {
      expect((error as Error).message).toContain('trạng thái kết thúc');
    }
  });
});

describe('EXECUTABLE_ORDER_STATUSES', () => {
  it('đúng PLACED và CHECKING — hai trạng thái CHƯA gửi giao dịch nào', () => {
    expect([...EXECUTABLE_ORDER_STATUSES]).toEqual(['PLACED', 'CHECKING']);
  });

  it('KHÔNG chứa EXECUTING: chạy lại từ đó là nguy cơ gửi giao dịch hai lần', () => {
    expect(EXECUTABLE_ORDER_STATUSES).not.toContain('EXECUTING');
  });

  it('KHÔNG chứa trạng thái kết thúc nào', () => {
    for (const terminal of TERMINAL_ORDER_STATUSES) {
      expect(EXECUTABLE_ORDER_STATUSES, `không được chứa ${terminal}`).not.toContain(terminal);
    }
  });
});

describe('isOrderStatus — dữ liệu ngoài đi vào an toàn', () => {
  it('nhận đúng 7 giá trị hợp lệ', () => {
    for (const status of ORDER_STATUSES) expect(isOrderStatus(status)).toBe(true);
  });

  it('từ chối giá trị lạ thay vì cho qua', () => {
    for (const value of ['placed', 'PAID', '', null, undefined, 0, {}, []]) {
      expect(isOrderStatus(value), String(value)).toBe(false);
    }
  });
});
