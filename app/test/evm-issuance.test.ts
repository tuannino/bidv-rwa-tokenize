import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BaseError, type Account } from 'viem';
import { getContractAddress } from '@bidv/shared';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError, type ILedgerPort } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const OLD_HARDHAT_RPC = process.env.TEST_OLD_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const UNPRIVILEGED = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

function unlockedSigner(address: `0x${string}`): ISigner {
  const account: Account = { address, type: 'json-rpc' };
  return {
    kind: 'server',
    async getAddress() {
      return account.address;
    },
    async getAccount() {
      return account;
    },
  };
}

function useRpc(url: string | undefined): void {
  if (url) process.env.RPC_HARDHAT = url;
  else delete process.env.RPC_HARDHAT;
  resetServerEnvCache();
  resetChainRegistryCache();
}

async function wait(ledger: ILedgerPort, tx: Awaited<ReturnType<ILedgerPort['mint']>>) {
  const receipt = await ledger.waitReceipt(tx.txHash);
  expect(receipt.status, receipt.reason).toBe('CONFIRMED');
}

async function expectLedgerFailure(promise: Promise<unknown>, ...messages: string[]) {
  let failure: unknown;
  try {
    await promise;
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(LedgerError);
  const ledgerError = failure as LedgerError;
  for (const message of messages) expect(ledgerError.message).toContain(message);
  expect(ledgerError.message).toContain(getContractAddress('hardhat-local', 'ProjectToken'));
  expect(ledgerError.cause).toBeInstanceOf(BaseError);
}

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('SC-02 — EVM issuance adapter trên Hardhat thật', () => {
  let ledger: ILedgerPort;
  const originalRpc = process.env.RPC_HARDHAT;

  beforeAll(() => {
    useRpc(HARDHAT_RPC);
    ledger = createEvmLedger('hardhat-local', unlockedSigner(ADMIN));
  });

  afterAll(() => useRpc(originalRpc));

  it('đọc trạng thái chưa phát hành từ contract mới', async () => {
    expect(await ledger.isInitialSupplyMinted()).toBe(false);
    expect(await ledger.spvWallet()).toBeNull();
  });

  it('whitelist rồi phát hành nguồn cung ban đầu vào đúng ví SPV', async () => {
    await wait(ledger, await ledger.whitelist(SPV));
    await wait(ledger, await ledger.mintInitialSupply(SPV, 1_000n));

    expect(await ledger.isInitialSupplyMinted()).toBe(true);
    expect(await ledger.spvWallet()).toBe(SPV);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
  });

  it('dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc', async () => {
    await expectLedgerFailure(
      ledger.mintInitialSupply(SPV, 1n),
      'Nguồn cung ban đầu đã được phát hành',
      'Cách xử lý:',
    );
  });

  it('dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc', async () => {
    await expectLedgerFailure(
      ledger.mint(OTHER, 1n),
      'Ví nhận không trùng với ví SPV đã đăng ký',
      'Đọc spvWallet()',
    );
  });

  it('dịch lỗi hook tuân thủ khi ví SPV bị đóng băng', async () => {
    await wait(ledger, await ledger.freeze(SPV, true));
    await expectLedgerFailure(ledger.mint(SPV, 1n), 'Ví bên nhận đang bị đóng băng', 'Gỡ đóng băng');
    await wait(ledger, await ledger.freeze(SPV, false));
  });

  it('dịch lỗi ví vận hành thiếu MINTER_ROLE', async () => {
    const unprivileged = createEvmLedger('hardhat-local', unlockedSigner(UNPRIVILEGED));
    await expectLedgerFailure(
      unprivileged.mint(SPV, 1n),
      'thiếu role',
      'Cấp MINTER_ROLE',
    );
  });

  it('phát hành bổ sung đúng ví SPV và chờ receipt thành công', async () => {
    await wait(ledger, await ledger.mint(SPV, 25n));
    expect(await ledger.balanceOf(SPV)).toBe(1_025n);
  });
});

const oldContract = HARDHAT_RPC && OLD_HARDHAT_RPC ? describe : describe.skip;

oldContract('SC-02 — nhận biết ProjectToken cũ', () => {
  const originalRpc = process.env.RPC_HARDHAT;

  afterAll(() => useRpc(originalRpc));

  it('báo triển khai lại thay vì trả lỗi ABI/RPC khó hiểu', async () => {
    useRpc(OLD_HARDHAT_RPC);
    const ledger = createEvmLedger('hardhat-local', unlockedSigner(ADMIN));
    await expectLedgerFailure(
      ledger.isInitialSupplyMinted(),
      'bản trước SC-02',
      'triển khai lại bộ hợp đồng',
    );
  });
});
