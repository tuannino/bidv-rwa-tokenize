import type { FireblocksClient, FireblocksTx } from '@/lib/custody/fireblocks-client';

/**
 * IN-04 B4: khách Fireblocks GIẢ, cùng giao diện `FireblocksClient` (sau bước đọc HTTP). Không dùng khoá
 * thật. Kịch bản điều khiển được:
 * - `createError`: ném khi tạo; `afterCreate: true` thì giao dịch VẪN được tạo rồi mới ném (lỗi mạng sau
 *   khi Fireblocks đã nhận);
 * - `hold`: tạo xong giữ `SUBMITTED`, không có mã, tới khi gọi `release()` (khách chậm);
 * - `final`: trạng thái cuối khi xử lý (mặc định `COMPLETED` có mã); trạng thái âm thì không có mã;
 * - `lookupError`, `getByIdError`: lần tra ném; `hideFromLookup`: tra theo `externalTxId` trả "chưa có"
 *   (mã 1439) dù đã có giao dịch (mô phỏng chưa đồng bộ);
 * - `beforeGetById`: chạy trước mỗi lần `getById` trả kết quả (lượt khác chen vào).
 *
 * `broadcaster` là cách "phát lên chuỗi": trên mock thì gọi ledger mock; trên nút Hardhat thì gửi
 * `eth_sendTransaction` từ địa chỉ vault giả. Trả mã giao dịch.
 */
export interface CreateCall {
  externalTxId: string;
  vaultId: string;
  assetId: string;
  contract: string;
  data: string;
  note: string;
}

export type Broadcaster = (call: CreateCall) => Promise<string>;

interface StoredTx extends FireblocksTx {
  call: CreateCall;
}

export class FakeFireblocks implements FireblocksClient {
  readonly creates: CreateCall[] = [];
  readonly getByIdCalls: string[] = [];
  readonly lookupCalls: string[] = [];
  broadcasts = 0;
  createError: { error: Error; afterCreate: boolean } | null = null;
  lookupError: Error | null = null;
  getByIdError: Error | null = null;
  hideFromLookup = false;
  hold = false;
  final: { status: string; subStatus?: string | null; withHash: boolean } = { status: 'COMPLETED', withHash: true };
  beforeGetById: ((tx: FireblocksTx) => Promise<void>) | null = null;
  private readonly txs = new Map<string, StoredTx>();
  private counter = 0;

  constructor(private readonly broadcaster: Broadcaster | null = null) {}

  get callCount(): number {
    return this.creates.length + this.getByIdCalls.length + this.lookupCalls.length;
  }

  async createContractCall(input: CreateCall): Promise<{ id: string; status: string }> {
    this.creates.push({ ...input });
    if (this.createError && !this.createError.afterCreate) throw this.createError.error;
    this.counter += 1;
    const tx: StoredTx = {
      id: `fb-tx-${this.counter}`,
      status: 'SUBMITTED',
      subStatus: null,
      txHash: null,
      externalTxId: input.externalTxId,
      call: { ...input },
    };
    this.txs.set(tx.id, tx);
    if (!this.hold) await this.settle(tx);
    if (this.createError?.afterCreate) throw this.createError.error;
    return { id: tx.id, status: tx.status };
  }

  /** Xử lý giao dịch đang giữ (khách chậm): đưa về trạng thái cuối, phát lên chuỗi nếu có mã. */
  async release(): Promise<void> {
    for (const tx of this.txs.values()) {
      if (!tx.txHash && tx.status === 'SUBMITTED') await this.settle(tx);
    }
  }

  /** Đặt thẳng trạng thái một giao dịch (kịch bản trạng thái cuối âm). */
  setTx(id: string, patch: Partial<FireblocksTx>): void {
    const tx = this.txs.get(id);
    if (!tx) throw new Error(`Không có giao dịch giả ${id}.`);
    Object.assign(tx, patch);
  }

  get transactions(): FireblocksTx[] {
    return [...this.txs.values()].map(({ call: _call, ...tx }) => ({ ...tx }));
  }

  async getByExternalTxId(externalTxId: string): Promise<FireblocksTx | null> {
    this.lookupCalls.push(externalTxId);
    if (this.lookupError) throw this.lookupError;
    if (this.hideFromLookup) return null;
    const found = [...this.txs.values()].find((tx) => tx.externalTxId === externalTxId);
    return found ? this.view(found) : null;
  }

  async getById(id: string): Promise<FireblocksTx> {
    this.getByIdCalls.push(id);
    if (this.getByIdError) throw this.getByIdError;
    const found = this.txs.get(id);
    if (!found) throw new Error(`Không có giao dịch giả ${id}.`);
    // Hook chạy TRƯỚC khi đọc trạng thái: lượt khác chen vào (phát, gắn mã) thì lần đọc này thấy ngay.
    if (this.beforeGetById) await this.beforeGetById(this.view(found));
    return this.view(found);
  }

  private view(tx: StoredTx): FireblocksTx {
    return { id: tx.id, status: tx.status, subStatus: tx.subStatus, txHash: tx.txHash, externalTxId: tx.externalTxId };
  }

  private async settle(tx: StoredTx): Promise<void> {
    tx.status = this.final.status;
    tx.subStatus = this.final.subStatus ?? null;
    if (!this.final.withHash) return;
    this.broadcasts += 1;
    tx.txHash = this.broadcaster
      ? await this.broadcaster(tx.call)
      : `0x${this.broadcasts.toString(16).padStart(64, '0')}`;
  }
}
