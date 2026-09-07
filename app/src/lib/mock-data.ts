/**
 * Dữ liệu mẫu cho các trang tổng quan (dashboard / assets / reconciliation).
 *
 * Chủ đề DUY NHẤT: **điện gió** (docs/SPEC.md §1). Trước đây file này là dữ liệu của
 * console cũ (vàng / bất động sản / tín chỉ carbon) — đã thay toàn bộ.
 *
 * ⚠️ Đây là số minh hoạ cho phần CHƯA nối on-chain. Những gì đã nối thật
 * (số dư SPT, whitelist, lịch sử giao dịch ở trang /mint và /audit) KHÔNG lấy từ đây
 * mà đọc qua `ILedgerPort`. Đừng dùng file này để thay dữ liệu thật.
 */

/** Trạng thái vận hành nhà máy. */
export type ProjectStatus = 'OPERATING' | 'COMMISSIONING' | 'MAINTENANCE';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  OPERATING: 'Đang phát điện',
  COMMISSIONING: 'Chạy thử nghiệm thu',
  MAINTENANCE: 'Bảo trì',
};

/** Vùng dự án — dùng để lọc danh sách. */
export type ProjectRegion = 'ONSHORE_HIGHLAND' | 'ONSHORE_COASTAL' | 'NEARSHORE';

export const REGION_LABELS: Record<ProjectRegion, string> = {
  ONSHORE_HIGHLAND: 'Trên bờ · Cao nguyên',
  ONSHORE_COASTAL: 'Trên bờ · Ven biển',
  NEARSHORE: 'Gần bờ',
};

export interface WindProject {
  id: string;
  /** Mã dự án nội bộ BIDV. */
  code: string;
  name: string;
  location: string;
  region: ProjectRegion;
  /** Công suất đặt (MW). */
  capacityMw: number;
  turbines: number;
  /** SPT đã phát hành cho dự án. */
  sptIssued: number;
  /** Sản lượng luỹ kế (MWh) — nguồn: EnergyOracle. */
  generationMwh: number;
  /** Hệ số công suất luỹ kế (%). */
  capacityFactorPct: number;
  /** Giá bán điện (đồng/kWh) theo PPA với EVN. */
  ppaPricePerKwh: number;
  status: ProjectStatus;
  commissionedAt: string;
  operatorAddress: string;
  txHash: string;
}

export const MOCK_PROJECTS: WindProject[] = [
  {
    id: 'WIND-BLI-01',
    code: 'WIND-BLI-01',
    name: 'Điện gió Bạc Liêu 1',
    location: 'Bạc Liêu',
    region: 'NEARSHORE',
    capacityMw: 99.2,
    turbines: 62,
    sptIssued: 185_000,
    generationMwh: 214_600,
    capacityFactorPct: 38.4,
    ppaPricePerKwh: 1_927,
    status: 'OPERATING',
    commissionedAt: '18/03/2025',
    operatorAddress: 'operator.bidv.eth',
    txHash: '0xed3e4ec1...7d66',
  },
  {
    id: 'WIND-QTR-03',
    code: 'WIND-QTR-03',
    name: 'Điện gió Hướng Linh 3',
    location: 'Quảng Trị',
    region: 'ONSHORE_HIGHLAND',
    capacityMw: 30.0,
    turbines: 12,
    sptIssued: 100_000,
    generationMwh: 128_450,
    capacityFactorPct: 33.1,
    ppaPricePerKwh: 1_813,
    status: 'OPERATING',
    commissionedAt: '02/11/2025',
    operatorAddress: 'operator.bidv.eth',
    txHash: '0xfca87b5e...33af',
  },
  {
    id: 'WIND-NTH-07',
    code: 'WIND-NTH-07',
    name: 'Điện gió Ninh Thuận 7',
    location: 'Ninh Thuận',
    region: 'ONSHORE_COASTAL',
    capacityMw: 19.0,
    turbines: 8,
    sptIssued: 50_000,
    generationMwh: 69_630,
    capacityFactorPct: 35.7,
    ppaPricePerKwh: 1_813,
    status: 'MAINTENANCE',
    commissionedAt: '25/06/2026',
    operatorAddress: 'operator.bidv.eth',
    txHash: '0xc3bef42f...1b1b',
  },
];

/**
 * Sản lượng và lợi tức theo kỳ (tháng).
 * `generationMwh` từ EnergyOracle; `profitVndBn` là lợi tức đã chia (tỷ VND) qua ProfitDistributor.
 */
export interface GenerationPoint {
  period: string;
  generationMwh: number;
  profitVndBn: number;
}

export const MOCK_GENERATION_SERIES: GenerationPoint[] = [
  { period: '02/2026', generationMwh: 24_180, profitVndBn: 11.2 },
  { period: '03/2026', generationMwh: 27_640, profitVndBn: 13.1 },
  { period: '04/2026', generationMwh: 31_900, profitVndBn: 15.4 },
  { period: '05/2026', generationMwh: 29_450, profitVndBn: 14.0 },
  { period: '06/2026', generationMwh: 34_720, profitVndBn: 16.8 },
  { period: '07/2026', generationMwh: 33_180, profitVndBn: 15.9 },
];

/** Số liệu tổng quan toàn danh mục điện gió. */
export const MOCK_WIND_STATS = {
  projects: MOCK_PROJECTS.length,
  totalCapacityMw: 148.2,
  /** SPT đã phát hành (tổng cung). */
  sptIssued: 335_000,
  /** Nhà đầu tư đã whitelist. */
  whitelistedInvestors: 128,
  /** Sản lượng luỹ kế toàn danh mục (MWh). */
  cumulativeGenerationMwh: 412_680,
  /** Lợi tức đã chia (tỷ VND). */
  profitDistributedVndBn: 86.4,
  /** Số kỳ đã chia lợi tức. */
  distributionPeriods: 6,
  /** Kỳ đối soát doanh thu điện chưa khớp. */
  pendingReconciliations: 0,
} as const;
