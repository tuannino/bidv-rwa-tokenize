import 'server-only';

import { z } from 'zod';
import { assertCan, can } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { getOrderStore, getProjectStore, ORDER_STATUSES } from '@/lib/store';
import { ORDER_SIDES } from '@/lib/store/order.store.port';
import { toResult } from './authorize';
import { readSupplyMetrics, type SupplyMetrics } from './issuance.service';
import { orderCreatedRange, toOrderView, type OrderView } from './purchase.service';
import { EXECUTABLE_ORDER_STATUSES } from './purchase.state';
import { err, ok, type Result } from './result';
import type { SettlementStepView } from './settlement-steps';
import { getOrderDetail, type OrderDetailView } from './trade.service';
import { chainSchema, walletSchema } from './schemas';

/**
 * PHÉP ĐỌC cho màn Giao dịch của hai vai vận hành (FE-06): sổ lệnh toàn hệ, có lọc và phân trang,
 * kèm số liệu nguồn cung để màn cập nhật sau khi khớp lệnh.
 *
 * Tái dùng, không viết lại: năm bước quyết toán đi qua `toOrderView` (BE-14), khoảng ngày dùng
 * `orderCreatedRange`, nguồn cung qua `readSupplyMetrics`. Cổng lưu trữ làm lọc, đếm và phân trang;
 * không quét một mảng có trần rồi cắt ở bộ nhớ.
 *
 * Cổng `ops:read` kiểm lại ở đây chứ không chỉ ở layout: server action gọi được bằng POST trực tiếp,
 * và Người bán có `order:read:all` nên `listOrders` một mình KHÔNG chặn được Người bán.
 */

const opsOrdersSchema = z.object({
  chain: chainSchema,
  /** Tìm theo một phần mã lệnh hoặc địa chỉ ví nhà đầu tư, không phân biệt hoa thường. */
  q: z.string().trim().max(100).optional(),
  investorWallet: walletSchema.optional(),
  side: z.enum(ORDER_SIDES).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  fromDate: z.iso.date().optional(),
  toDate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface OpsOrderPage {
  rows: OpsOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Ví đã từng đặt lệnh trên chuỗi này, cho ô chọn nhà đầu tư. */
  investors: string[];
  /** Vai hiện tại có quyền khớp hay chỉ xem. */
  mayExecute: boolean;
  /** Nguồn cung của token trên chuỗi; `null` khi chưa có dự án hoặc chuỗi chưa đọc được. */
  supply: SupplyMetrics | null;
}

export interface OpsOrderRow extends OrderView {
  /** Bước hiện tại do tầng nghiệp vụ chọn từ ánh xạ năm bước; giao diện chỉ hiển thị. */
  currentStep: SettlementStepView;
  /** Quyền vai + trạng thái nghiệp vụ đều cho phép khớp. */
  canExecute: boolean;
}

function currentStepOf(order: OrderView): SettlementStepView {
  return (
    order.steps.find((step) => step.state === 'current' || step.state === 'failed') ??
    [...order.steps].reverse().find((step) => step.state === 'done') ??
    order.steps[0]!
  );
}

export async function listOpsOrders(input: unknown): Promise<Result<OpsOrderPage>> {
  const parsed = opsOrdersSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, q, investorWallet, side, status, fromDate, toDate, page, pageSize } = parsed.data;

  try {
    const role = await currentRole();
    assertCan(role, 'ops:read');
    assertCan(role, 'order:read');
    assertCan(role, 'order:read:all');

    const filters = {
      chain,
      investorWallet,
      side,
      status,
      search: q,
      ...orderCreatedRange(fromDate, toDate),
    };
    const orderStore = getOrderStore();
    const [total, investors, projects] = await Promise.all([
      orderStore.countOrders(filters),
      orderStore.listOrderInvestors({ chain }),
      getProjectStore().listProjects({ chain }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const selectedPage = Math.min(page, totalPages);
    const mayExecute = can(role, 'order:execute');
    const [records, supply] = await Promise.all([
      orderStore.listOrders({
        ...filters,
        limit: pageSize,
        offset: (selectedPage - 1) * pageSize,
      }),
      projects[0]
        ? readSupplyMetrics(chain, projects[0]).catch(() => null)
        : Promise.resolve<SupplyMetrics | null>(null),
    ]);

    return ok({
      rows: records.map((record) => {
        const order = toOrderView(record);
        return {
          ...order,
          currentStep: currentStepOf(order),
          canExecute: mayExecute && EXECUTABLE_ORDER_STATUSES.includes(order.status),
        };
      }),
      total,
      page: selectedPage,
      pageSize,
      totalPages,
      investors,
      mayExecute,
      supply,
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Chi tiết dùng lại toàn bộ dữ liệu FE-25 nhưng thêm cổng khu vực vận hành ở phía máy chủ. */
export async function getOpsOrderDetail(input: unknown): Promise<Result<OrderDetailView>> {
  try {
    assertCan(await currentRole(), 'ops:read');
    return await getOrderDetail(input);
  } catch (error) {
    return toResult(error);
  }
}
