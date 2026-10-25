export const OPERATION_LABELS: Record<string, string> = {
  purchase: 'Mua',
  sale: 'Bán',
  mint: 'Phát hành',
  mintInitialSupply: 'Phát hành nguồn cung ban đầu',
  'payment-mint': 'Cấp VNDB thử',
  burn: 'Huỷ token',
  recall: 'Thu hồi',
  freeze: 'Đóng băng toàn hệ thống',
  unfreeze: 'Mở đóng băng',
  whitelist: 'Định danh ví',
  distribute: 'Nhận chia lợi nhuận',
  'distribution-open': 'Mở kỳ chia',
  'vault-close-period': 'Chốt kỳ vault',
  'vault:withdraw': 'Rút VNDB từ vault',
};

export function operationLabel(code: string): string {
  return OPERATION_LABELS[code] ?? (code.startsWith('vault:') ? 'Cấu hình vault' : code);
}
