export type AssetType = "GOLD" | "REAL_ESTATE" | "CARBON";
export type AssetStatus = "TRADING" | "PROCESSING" | "PAUSED";

export interface Asset {
  id: string;
  code: string;
  name: string;
  type: AssetType;
  tokenSymbol: string;
  totalSupply: number;
  backingAmount: string;
  backingUnit: string;
  currentPrice: string;
  priceUnit: string;
  status: AssetStatus;
  listedAt: string;
  adminAddress: string;
  txHash: string;
}

export const MOCK_ASSETS: Asset[] = [
  {
    id: "BCT-CP073",
    code: "BCT-CP073",
    name: "CC-2026-073",
    type: "CARBON",
    tokenSymbol: "BCT",
    totalSupply: 50000,
    backingAmount: "2.500ha · 50.000 tCO₂e",
    backingUnit: "tCO₂e",
    currentPrice: "120.000",
    priceUnit: "tCO₂e/ha",
    status: "TRADING",
    listedAt: "29/05/2026",
    adminAddress: "admin.bidv.eth",
    txHash: "0xed3e4ec1...7d66",
  },
  {
    id: "BGT-GOLD-512",
    code: "BGT-GOLD-512",
    name: "GOLD-20260529-512",
    type: "GOLD",
    tokenSymbol: "BGT",
    totalSupply: 100000,
    backingAmount: "3.750g · 1.000 chi",
    backingUnit: "chi",
    currentPrice: "950.000",
    priceUnit: "đ/chi",
    status: "TRADING",
    listedAt: "29/05/2026",
    adminAddress: "admin.bidv.eth",
    txHash: "0xfca87b5e...33af",
  },
  {
    id: "BRT-VOP3-991",
    code: "BRT-VOP3-991",
    name: "RE-20260529-991",
    type: "REAL_ESTATE",
    tokenSymbol: "BRT",
    totalSupply: 185000,
    backingAmount: "98.500m² · 185 tỷ VND",
    backingUnit: "m²",
    currentPrice: "1.050.000",
    priceUnit: "tỷ VND",
    status: "TRADING",
    listedAt: "29/05/2026",
    adminAddress: "admin.bidv.eth",
    txHash: "0xc3bef42f...1b1b",
  },
];

export const MOCK_CHART_DATA = [
  { date: "01/06", gold: 88, realEstate: 178, carbon: 5 },
  { date: "02/06", gold: 90, realEstate: 180, carbon: 5 },
  { date: "03/06", gold: 91, realEstate: 183, carbon: 6 },
  { date: "04/06", gold: 92, realEstate: 185, carbon: 6 },
  { date: "05/06", gold: 94, realEstate: 190, carbon: 6 },
  { date: "06/06", gold: 95, realEstate: 194, carbon: 6 },
];

export const MOCK_STATS = {
  totalAssets: 3,
  totalValueVnd: "295,3 tỷ",
  todayTransactions: 0,
  pendingBatches: 0,
  gold: { count: 1, label: "1 lô", detail: "3.750g · 1.000 chi" },
  realEstate: { count: 1, label: "1 dự án", detail: "Tổng giá trị: 185 tỷ VND" },
  carbon: { count: 1, label: "1 đợt", detail: "50.000 tCO₂e · Vintage 2025" },
};
