import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import {
  addressBook,
  addressEnvKey,
  getContractAddress,
  modularComplianceAbi,
  projectTokenAbi,
} from '@bidv/shared';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError, type ILedgerPort } from '@/lib/ledger/ledger.port';
import { resetSignerCache, type ISigner } from '@/lib/signer';
import { getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const OLD_HARDHAT_RPC = process.env.TEST_OLD_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const UNPRIVILEGED = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const UNVERIFIED = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const HARDHAT_ACCOUNT0_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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

function actAs(role: 'TELLER' | 'CONTROLLER', actor: string): void {
  process.env.DEMO_ROLE = role;
  process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

async function blockNumber(): Promise<bigint> {
  const response = await fetch(HARDHAT_RPC!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  });
  const body = (await response.json()) as { result?: string; error?: { message?: string } };
  if (!body.result) throw new Error(body.error?.message ?? 'Không đọc được block number.');
  return BigInt(body.result);
}

async function wait(ledger: ILedgerPort, tx: Awaited<ReturnType<ILedgerPort['mint']>>) {
  const receipt = await ledger.waitReceipt(tx.txHash);
  expect(receipt.status, receipt.reason).toBe('CONFIRMED');
}

async function adminWrite(
  address: Hex,
  abi: Abi | readonly unknown[],
  functionName: string,
  args: readonly unknown[],
) {
  const account: Account = { address: ADMIN, type: 'json-rpc' };
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: abi as Abi,
    functionName: functionName as never,
    args: args as never,
  });
  const hash = await walletClient.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
}

/** Đọc artifact lúc chạy, chỉ trong ca cần nút Hardhat: Job A không biên dịch hợp đồng. */
async function loadRejectAllArtifact(): Promise<{ abi: unknown[]; bytecode: string }> {
  const file = new URL(
    '../../packages/contracts-evm/artifacts/contracts/test/RejectAllModule.sol/RejectAllModule.json',
    import.meta.url,
  );
  return JSON.parse(await readFile(file, 'utf8'));
}

async function deployRejectAllModule(): Promise<Hex> {
  const rejectAllArtifact = await loadRejectAllArtifact();
  const account: Account = { address: ADMIN, type: 'json-rpc' };
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
  const hash = await walletClient.deployContract({
    account,
    abi: rejectAllArtifact.abi,
    bytecode: rejectAllArtifact.bytecode as Hex,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
  expect(receipt.contractAddress).toBeTruthy();
  return receipt.contractAddress!;
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
  const originalEnv = {
    rpc: process.env.RPC_HARDHAT,
    privateKey: process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL,
    useMockDb: process.env.USE_MOCK_DB,
    enableDemoMint: process.env.ENABLE_DEMO_TOKEN_MINT,
    role: process.env.DEMO_ROLE,
    actor: process.env.DEMO_ACTOR,
  };

  beforeAll(() => {
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = HARDHAT_ACCOUNT0_KEY;
    process.env.USE_MOCK_DB = 'true';
    process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
    useRpc(HARDHAT_RPC);
    resetSignerCache();
    ledger = createEvmLedger('hardhat-local', unlockedSigner(ADMIN));
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('RPC_HARDHAT', originalEnv.rpc);
    restore('SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', originalEnv.privateKey);
    restore('USE_MOCK_DB', originalEnv.useMockDb);
    restore('ENABLE_DEMO_TOKEN_MINT', originalEnv.enableDemoMint);
    restore('DEMO_ROLE', originalEnv.role);
    restore('DEMO_ACTOR', originalEnv.actor);
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetStoreCache();
  });

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
    await expectLedgerFailure(
      ledger.mint(SPV, 1n),
      'Ví tham gia giao dịch đang bị đóng băng',
      'Gỡ đóng băng',
    );
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

  it('đường dữ liệu thử từ chối hardhat trước khi gửi giao dịch', async () => {
    resetMemoryStore();
    resetStoreCache();
    actAs('TELLER', 'GDV001');
    const before = await blockNumber();
    const { mintToInvestorDirect } = await import('@/lib/bank/mint.service');

    const result = await mintToInvestorDirect({
      chain: 'hardhat-local',
      wallet: SPV,
      amount: '10',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.error).toBe(
      'Đường dữ liệu thử chỉ chạy trên mock; phát hành chính thức qua luồng lập duyệt.',
    );
    expect(await blockNumber()).toBe(before);
    expect(await getStore().listTxns({ chain: 'hardhat-local' })).toHaveLength(0);
  });

  it('hai lần duyệt đồng thời ở service chỉ gửi đúng một giao dịch hardhat', async () => {
    resetMemoryStore();
    resetStoreCache();
    actAs('TELLER', 'GDV001');
    const { approveTokenRequest, createTokenRequest } = await import(
      '@/lib/bank/token-request.service'
    );
    const created = await createTokenRequest({
      chain: 'hardhat-local',
      tokenSymbol: 'WPT',
      type: 'MINT',
      wallet: SPV,
      amount: '50',
      reason: 'Kiểm thử duyệt đồng thời trên hardhat',
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;

    actAs('CONTROLLER', 'KSV001');
    const before = await blockNumber();
    const results = await Promise.all([
      approveTokenRequest({ chain: 'hardhat-local', requestId: created.data.request.id }),
      approveTokenRequest({ chain: 'hardhat-local', requestId: created.data.request.id }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rejected = results.find((result) => !result.ok);
    expect(rejected && !rejected.ok ? rejected.code : null).toBe('REQUEST_STATE');
    expect(await blockNumber()).toBe(before + 1n);
    const txns = (await getStore().listTxns({ chain: 'hardhat-local' })).filter(
      (txn) => txn.operation === 'mint',
    );
    expect(txns).toHaveLength(1);
    expect(await ledger.balanceOf(SPV)).toBe(1_075n);
    const audit = await getStore().listAudit({ limit: 20 });
    expect(audit.filter((entry) => entry.detail?.includes('Đối soát mốc phát hành từ chuỗi')))
      .toHaveLength(1);
  });

  it('luồng Burn lập duyệt dùng burn(address,uint256) và chạy hết', async () => {
    actAs('TELLER', 'GDV001');
    const { approveTokenRequest, createTokenRequest } = await import(
      '@/lib/bank/token-request.service'
    );
    const created = await createTokenRequest({
      chain: 'hardhat-local',
      tokenSymbol: 'WPT',
      type: 'BURN',
      burnSource: 'UNDISTRIBUTED',
      amount: '5',
      reason: 'Kiểm thử thu hồi SC-09 trên hardhat',
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;

    actAs('CONTROLLER', 'KSV001');
    const approved = await approveTokenRequest({
      chain: 'hardhat-local',
      requestId: created.data.request.id,
    });
    expect(approved.ok, approved.ok ? '' : approved.error).toBe(true);
    expect(await ledger.balanceOf(SPV)).toBe(1_070n);
  });

  it('adapter đọc đủ luật ERC-3643 theo đúng thứ tự, gồm đóng băng một phần và module từ chối', async () => {
    expect(await ledger.isWhitelisted(OTHER)).toBe(false);
    await wait(ledger, await ledger.whitelist(OTHER));
    expect(await ledger.isWhitelisted(OTHER)).toBe(true);
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toEqual({ allowed: true });

    await wait(ledger, await ledger.freeze(SPV, true));
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Bên gửi đang bị đóng băng'),
    });
    await wait(ledger, await ledger.freeze(SPV, false));

    await wait(ledger, await ledger.freeze(OTHER, true));
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Bên nhận đang bị đóng băng'),
    });
    await wait(ledger, await ledger.freeze(OTHER, false));

    expect(await ledger.canTransfer(UNVERIFIED, OTHER, 1n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Bên gửi chưa KYC/whitelist'),
    });
    expect(await ledger.canTransfer(SPV, UNVERIFIED, 1n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Bên nhận chưa KYC/whitelist'),
    });
    expect(await ledger.canTransfer(SPV, OTHER, 1_071n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Số dư WPT không đủ'),
    });

    const token = getContractAddress('hardhat-local', 'ProjectToken') as Hex;
    await adminWrite(token, projectTokenAbi, 'freezePartialTokens', [SPV, 1_065n]);
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('Số WPT khả dụng không đủ'),
    });
    await adminWrite(token, projectTokenAbi, 'unfreezePartialTokens', [SPV, 1_065n]);

    const compliance = getContractAddress('hardhat-local', 'ModularCompliance') as Hex;
    const rejectAll = await deployRejectAllModule();
    await adminWrite(compliance, modularComplianceAbi, 'addModule', [rejectAll]);
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toEqual({
      allowed: false,
      reason: 'Bộ luật tuân thủ ERC-3643 từ chối giao dịch.',
    });
    await adminWrite(compliance, modularComplianceAbi, 'removeModule', [rejectAll]);
    expect(await ledger.canTransfer(SPV, OTHER, 10n)).toEqual({ allowed: true });
  });
});

describe('SC-09 — chặn cấu hình EVM cũ trước khi gọi RPC', () => {
  it('thiếu địa chỉ registry/compliance báo đúng runbook và không lùi về hàm cũ', async () => {
    const registryKey = addressEnvKey('evm', 'IdentityRegistry');
    const complianceKey = addressEnvKey('evm', 'ModularCompliance');
    const oldRegistry = process.env[registryKey];
    const oldCompliance = process.env[complianceKey];
    const oldBookRegistry = addressBook.evm?.contracts.IdentityRegistry;
    const oldBookCompliance = addressBook.evm?.contracts.ModularCompliance;
    delete process.env[registryKey];
    delete process.env[complianceKey];
    if (addressBook.evm) {
      delete addressBook.evm.contracts.IdentityRegistry;
      delete addressBook.evm.contracts.ModularCompliance;
    }

    try {
      const ledger = createEvmLedger('evm', unlockedSigner(ADMIN));
      await expect(ledger.tokenInfo()).rejects.toThrow(
        'bộ hợp đồng chain này chưa triển khai bản ERC-3643 (SC-09), chạy lại triển khai theo runbook',
      );
    } finally {
      if (oldRegistry === undefined) delete process.env[registryKey];
      else process.env[registryKey] = oldRegistry;
      if (oldCompliance === undefined) delete process.env[complianceKey];
      else process.env[complianceKey] = oldCompliance;
      if (addressBook.evm && oldBookRegistry) {
        addressBook.evm.contracts.IdentityRegistry = oldBookRegistry;
      }
      if (addressBook.evm && oldBookCompliance) {
        addressBook.evm.contracts.ModularCompliance = oldBookCompliance;
      }
    }
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
