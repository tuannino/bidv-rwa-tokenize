import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { keccak256, type Hex } from 'viem';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';
import { FakeFireblocks, type Broadcaster } from './helpers/fake-fireblocks';

/**
 * IN-04: ký Mint, Burn qua Fireblocks (Vault Account), công tắc "Lưu ký Fireblocks".
 *
 * Bộ nhớ trên chain `mock`, trừ ca ghi rõ Postgres. Không khoá Fireblocks thật nào: khách REST được kiểm
 * bằng máy chủ HTTP cục bộ với cặp khoá RSA sinh lúc chạy (ca 1, 2); luồng duyệt dùng khách giả
 * `FakeFireblocks`, "phát lên chuỗi" bằng chính ledger mock để số liệu token đổi đúng.
 *
 * Vỏ bọc `@/lib/ledger`: chain `mock` (và `hardhat-local`, ánh xạ vào trạng thái mock cho ca 5b) có thêm
 * ba phương thức Lưu ký Fireblocks giả (D1, D2, D2b); mọi lời gọi khoá máy chủ (`mint`,
 * `mintInitialSupply`, `burn`) được đếm ở `ledgerFake.serverSends`.
 */

const ledgerFake = vi.hoisted(() => ({
  token: '0x000000000000000000000000000000000000C0DE',
  roles: { minter: true, agent: true },
  prepareError: null as string | null,
  serverSends: 0,
  prepared: new Map<string, { operation: 'mint' | 'mintInitialSupply' | 'burn'; wallet: string; amount: bigint }>(),
  txCalls: new Map<string, { from: string; to: string | null; input: string }>(),
  callOverride: null as null | ((call: { from: string; to: string | null; input: string }) => { from: string; to: string | null; input: string }),
  onPrepare: null as null | (() => void | Promise<void>),
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  const { encodeFunctionData } = await import('viem');
  const { projectTokenAbi } = await import('@bidv/shared');
  return {
    ...actual,
    getLedger: (chain: Parameters<typeof actual.getLedger>[0]) => {
      const real = actual.getLedger(chain === 'hardhat-local' ? 'mock' : chain);
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'chain') return chain;
          if (prop === 'mint' || prop === 'mintInitialSupply' || prop === 'burn') {
            const fn = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown;
            return (...args: unknown[]) => {
              ledgerFake.serverSends += 1;
              return fn.apply(target, args);
            };
          }
          if (prop === 'projectTokenRolesOf') return async () => ({ ...ledgerFake.roles });
          if (prop === 'prepareContractCall') {
            return async (operation: 'mint' | 'mintInitialSupply' | 'burn', [wallet, amount]: readonly [string, bigint]) => {
              await ledgerFake.onPrepare?.();
              if (ledgerFake.prepareError) throw new actual.LedgerError(chain, operation, ledgerFake.prepareError);
              const data = encodeFunctionData({
                abi: projectTokenAbi,
                functionName: operation,
                args: [wallet as `0x${string}`, amount],
              } as never);
              ledgerFake.prepared.set(data, { operation, wallet, amount });
              return { to: ledgerFake.token, data };
            };
          }
          if (prop === 'transactionCallOf') {
            return async (txHash: string) => {
              const call = ledgerFake.txCalls.get(txHash) ?? null;
              return call && ledgerFake.callOverride ? ledgerFake.callOverride(call) : call;
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const actualLedger = await vi.importActual<typeof import('@/lib/ledger')>('@/lib/ledger');
const { resetMockLedger } = await import('@/lib/ledger/mock.adapter');
const store = await import('@/lib/store');
const { getConfigStore, getStore, getTokenRequestStore, resetMemoryStore, resetStoreCache } = store;
const { memoryState } = await import('@/lib/store/memory.state');
const config = await import('@/lib/custody/fireblocks-config');
const { configRefOf, fireblocksChainScope, fireblocksConfig, parseChainAssets, setFireblocksConfigForTest } = config;
const client = await import('@/lib/custody/fireblocks-client');
const {
  classifyCreateError,
  createFireblocksClient,
  FireblocksHttpError,
  FireblocksNetworkError,
  setFireblocksClientForTest,
  signJwt,
} = client;
const execution = await import('@/lib/custody/fireblocks-execution');
const { classifyFireblocksTx, matchesPreparedCall, submitViaFireblocks } = execution;
const custodyService = await import('@/lib/bank/custody.service');
const { custodyFor, getCustodyState, setFireblocksCustody } = custodyService;
const tokenRequest = await import('@/lib/bank/token-request.service');
const { roleHomeHref } = await import('@/components/layout/role-home');

const CHAIN = 'mock';
const SPV = MOCK_VAULT_ADDRESS;
/** Vault Fireblocks giả (tài khoản Hardhat #7): chỉ là địa chỉ, không khoá. */
const VAULT = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955';
const CONFIG = {
  baseUrl: 'https://fireblocks.test',
  apiKey: 'api-key-thu',
  privateKeyPem: 'không dùng: khách giả',
  vaultId: '11',
  vaultAddress: VAULT,
  configRef: configRefOf('https://fireblocks.test', 'api-key-thu'),
};

/** "Phát lên chuỗi" của khách giả: chạy đúng lời gọi đã chuẩn bị trên ledger mock gốc, ghi lại giao dịch. */
const mockBroadcaster: Broadcaster = async (call) => {
  const prepared = ledgerFake.prepared.get(call.data);
  if (!prepared) throw new Error('Khách giả nhận lời gọi chưa được chuẩn bị.');
  const ledger = actualLedger.getLedger('mock');
  const tx =
    prepared.operation === 'burn'
      ? await ledger.burn(prepared.wallet, prepared.amount)
      : prepared.operation === 'mint'
        ? await ledger.mint(prepared.wallet, prepared.amount)
        : await ledger.mintInitialSupply(prepared.wallet, prepared.amount);
  ledgerFake.txCalls.set(tx.txHash, { from: VAULT, to: call.contract, input: call.data });
  return tx.txHash;
};

let fb: FakeFireblocks;

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}
const teller = () => actAs('TELLER', 'GDV001');
const controller = () => actAs('CONTROLLER', 'KSV001');

async function issueDirect(amount: bigint) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  teller();
  const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: String(amount) });
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  ledgerFake.serverSends = 0;
}

const mintInput = (amount: bigint, chain: string = CHAIN) => ({
  type: 'MINT',
  chain,
  amount: String(amount),
  wallet: SPV,
  reason: 'phát hành đợt tiếp theo',
  documentRef: 'QD-2026-001',
});

const burnInput = (amount: bigint, chain: string = CHAIN) => ({
  type: 'BURN',
  chain,
  amount: String(amount),
  burnSource: 'UNDISTRIBUTED',
  reason: 'thu hồi phần chưa bán',
});

async function draft(input: Record<string, unknown>): Promise<string> {
  teller();
  const result = await tokenRequest.createTokenRequest(input);
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data.request.id;
}

async function approve(requestId: string, chain: string = CHAIN) {
  controller();
  return tokenRequest.approveTokenRequest({ chain, requestId });
}

async function reconcile(requestId: string, chain: string = CHAIN) {
  controller();
  return tokenRequest.reconcileTokenRequest({ chain, requestId });
}

async function detail(requestId: string, chain: string = CHAIN) {
  controller();
  const result = await tokenRequest.getTokenRequestDetail({ chain, requestId });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const find = async (id: string) => (await getTokenRequestStore().findRequest(id))!;

async function setCustody(enabled: boolean) {
  teller();
  const result = await setFireblocksCustody({ enabled });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
}

/** Phát hành nền bằng khoá máy chủ khi công tắc còn tắt, rồi bật công tắc, lập một yêu cầu Mint. */
async function fireblocksMint(amount = 10n): Promise<string> {
  await issueDirect(1_000n);
  await setCustody(true);
  return draft(mintInput(amount));
}

const auditDecisions = async () =>
  (await getStore().listAudit({ limit: 500 })).filter(
    (row) => row.action === 'order:approve' && row.outcome !== 'ALLOWED',
  );

const txnRowsFor = async (txHash: string) =>
  (await getStore().listTxns({ chain: CHAIN, limit: 500 })).filter((row) => row.txHash === txHash);

const httpError = (status: number, code: number | null, message = 'lỗi thử') => new FireblocksHttpError(status, code, message);

beforeEach(async () => {
  ledgerFake.roles = { minter: true, agent: true };
  ledgerFake.prepareError = null;
  ledgerFake.serverSends = 0;
  ledgerFake.prepared.clear();
  ledgerFake.txCalls.clear();
  ledgerFake.callOverride = null;
  ledgerFake.onPrepare = null;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  // Chờ mã một lần hỏi rồi thôi: ca nào cần "chậm" thì khách giả giữ giao dịch.
  process.env.FIREBLOCKS_HASH_WAIT_MS = '1';
  resetServerEnvCache();
  fb = new FakeFireblocks(mockBroadcaster);
  setFireblocksClientForTest(fb);
  setFireblocksConfigForTest({ config: CONFIG, chainAssets: { mock: 'ETH_TEST5' } });
  teller();
  await actualLedger.getLedger(CHAIN).whitelist(SPV);
});

afterEach(() => {
  setFireblocksClientForTest(null);
  setFireblocksConfigForTest(null);
  vi.restoreAllMocks();
  for (const key of [
    'DEMO_ROLE',
    'DEMO_ACTOR',
    'USE_MOCK_DB',
    'FIREBLOCKS_HASH_WAIT_MS',
    'FIREBLOCKS_API_KEY',
    'FIREBLOCKS_SECRET_KEY',
    'FIREBLOCKS_BASE_URL',
    'FIREBLOCKS_VAULT_ID',
    'FIREBLOCKS_VAULT_ADDRESS',
    'FIREBLOCKS_CHAIN_ASSETS',
  ]) {
    delete process.env[key];
  }
  resetServerEnvCache();
  resetStoreCache();
});

// =============================================================================
//  B. Khách REST (ca 1, 2) trên máy chủ HTTP cục bộ, khoá RSA sinh lúc chạy
// =============================================================================

const { privateKey: PEM, publicKey: PUBLIC_PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const API_KEY = 'khoa-api-thu-nghiem';

interface Received {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
  payload: Record<string, unknown> | null;
  signatureValid: boolean;
}

const b64url = (text: string) => Buffer.from(text, 'base64url');

function verifyJwt(token: string): { valid: boolean; payload: Record<string, unknown> | null } {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return { valid: false, payload: null };
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  return {
    valid: verifier.verify(PUBLIC_PEM, b64url(signature)),
    payload: JSON.parse(b64url(payload).toString('utf8')) as Record<string, unknown>,
  };
}

describe('IN-04 ca 1, 2: khách REST và JWT', () => {
  let server: Server;
  let baseUrl: string;
  const received: Received[] = [];
  let respond: (req: Received) => { status: number; body: unknown } = () => ({ status: 200, body: {} });

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
        const { valid, payload } = verifyJwt(token);
        const entry: Received = {
          method: req.method ?? '',
          url: req.url ?? '',
          headers: req.headers,
          body,
          payload,
          signatureValid: valid,
        };
        received.push(entry);
        const reply = respond(entry);
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    received.length = 0;
    respond = () => ({ status: 200, body: {} });
  });

  const realClient = () => createFireblocksClient({ baseUrl, apiKey: API_KEY, privateKeyPem: PEM });

  it('ca 1: POST và GET đều ký đúng: RS256, uri kể cả truy vấn, sub, exp - iat, bodyHash; nonce mỗi lần khác; POST không có Idempotency-Key', async () => {
    respond = (req) =>
      req.method === 'POST'
        ? { status: 200, body: { id: 'fb-1', status: 'SUBMITTED' } }
        : { status: 200, body: { id: 'fb-1', status: 'CONFIRMING', subStatus: '', txHash: '0xabc', externalTxId: 'req-1' } };
    const fbClient = realClient();
    const created = await fbClient.createContractCall({
      externalTxId: 'req-1',
      vaultId: '11',
      assetId: 'ETH_TEST5',
      contract: '0x000000000000000000000000000000000000C0DE',
      data: '0x40c10f19',
      note: 'IN-04 MINT req-1',
    });
    expect(created).toEqual({ id: 'fb-1', status: 'SUBMITTED' });
    const tx = await fbClient.getById('fb-1');
    expect(tx).toEqual({ id: 'fb-1', status: 'CONFIRMING', subStatus: null, txHash: '0xabc', externalTxId: 'req-1' });

    expect(received).toHaveLength(2);
    for (const req of received) {
      expect(req.signatureValid, req.method).toBe(true);
      expect(req.headers['x-api-key']).toBe(API_KEY);
      expect(req.headers['content-type']).toBe('application/json');
      expect(req.payload?.uri).toBe(req.url);
      expect(req.payload?.sub).toBe(API_KEY);
      expect(Number(req.payload?.exp) - Number(req.payload?.iat)).toBeLessThanOrEqual(30);
      expect(req.payload?.bodyHash).toBe(createHash('sha256').update(req.body).digest('hex'));
    }
    const [post, get] = received;
    expect(post.method).toBe('POST');
    expect(post.url).toBe('/v1/transactions');
    expect(post.headers['idempotency-key']).toBeUndefined();
    expect(JSON.parse(post.body)).toEqual({
      operation: 'CONTRACT_CALL',
      assetId: 'ETH_TEST5',
      amount: '0',
      source: { type: 'VAULT_ACCOUNT', id: '11' },
      destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: '0x000000000000000000000000000000000000C0DE' } },
      extraParameters: { contractCallData: '0x40c10f19' },
      externalTxId: 'req-1',
      note: 'IN-04 MINT req-1',
    });
    expect(get.body).toBe('');
    expect(post.payload?.nonce).not.toBe(get.payload?.nonce);
  });

  it('ca 1: signJwt giữ nguyên chuỗi truy vấn trong uri', async () => {
    const token = await signJwt({ apiKey: API_KEY, privateKeyPem: PEM }, '/v1/x?a=1', '');
    const { valid, payload } = verifyJwt(token);
    expect(valid).toBe(true);
    expect(payload?.uri).toBe('/v1/x?a=1');
    expect(payload?.bodyHash).toBe(createHash('sha256').update('').digest('hex'));
  });

  it('ca 2: 404 mã 1439 là null; 404 không mã 1439 và 403 thì ném; 400 có status, message; hết giờ là lỗi mạng; câu lỗi không lộ khoá', async () => {
    const fbClient = realClient();
    respond = () => ({ status: 404, body: { code: 1439, message: 'No such External Tx ID' } });
    expect(await fbClient.getByExternalTxId('req-1')).toBeNull();
    expect(received[0].url).toBe('/v1/transactions/external_tx_id/req-1');

    respond = () => ({ status: 404, body: { message: 'Not found' } });
    await expect(fbClient.getByExternalTxId('req-1')).rejects.toBeInstanceOf(FireblocksHttpError);
    respond = () => ({ status: 404, body: { code: '1438', message: 'khác' } });
    await expect(fbClient.getByExternalTxId('req-1')).rejects.toMatchObject({ status: 404, code: 1438 });
    respond = () => ({ status: 403, body: { code: -7, message: 'Unauthorized' } });
    await expect(fbClient.getByExternalTxId('req-1')).rejects.toMatchObject({ status: 403, code: -7 });

    respond = () => ({ status: 400, body: { code: '1503', message: 'Asset sai' } });
    const error = await fbClient
      .createContractCall({ externalTxId: 'x', vaultId: '11', assetId: 'A', contract: '0x1', data: '0x', note: 'n' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FireblocksHttpError);
    expect(error).toMatchObject({ status: 400, code: 1503, message: 'Asset sai' });

    const timeoutClient = createFireblocksClient({ baseUrl, apiKey: API_KEY, privateKeyPem: PEM }, async () => {
      throw new DOMException('hết giờ', 'TimeoutError');
    });
    const timeout = await timeoutClient.getById('fb-1').catch((e: unknown) => e);
    expect(timeout).toBeInstanceOf(FireblocksNetworkError);

    for (const failure of [error as Error, timeout as Error]) {
      const text = `${failure.message} ${(failure as InstanceType<typeof FireblocksHttpError>).describe?.() ?? ''}`;
      expect(text).not.toContain(API_KEY);
      expect(text).not.toContain('Bearer');
      expect(text).not.toContain('PRIVATE KEY');
    }
  });

  it('classifyCreateError: mã trước HTTP; 1438 trùng, nhóm từ chối kể cả HTTP 5xx, còn lại chưa biết', () => {
    expect(classifyCreateError(httpError(400, 1438))).toBe('DUPLICATE');
    expect(classifyCreateError(httpError(400, 1503))).toBe('REJECTED');
    expect(classifyCreateError(httpError(500, 1503))).toBe('REJECTED');
    expect(classifyCreateError(httpError(401, -7))).toBe('REJECTED');
    expect(classifyCreateError(httpError(400, 9999))).toBe('UNKNOWN');
    expect(classifyCreateError(httpError(429, null))).toBe('UNKNOWN');
    expect(classifyCreateError(httpError(503, null))).toBe('UNKNOWN');
    expect(classifyCreateError(new FireblocksNetworkError('mạng'))).toBe('UNKNOWN');
    expect(classifyCreateError(new Error('khác'))).toBe('UNKNOWN');
  });
});

// =============================================================================
//  A. Cấu hình (ca 3), công tắc (ca 4), cách thực hiện (ca 5)
// =============================================================================

describe('IN-04 ca 3: fireblocksConfig và bảng chain', () => {
  const setEnv = (values: Record<string, string>) => {
    setFireblocksConfigForTest(null);
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    resetServerEnvCache();
  };
  const full = {
    FIREBLOCKS_API_KEY: 'khoa',
    FIREBLOCKS_SECRET_KEY: PEM.replace(/\n/g, '\\n'),
    FIREBLOCKS_VAULT_ID: '11',
    FIREBLOCKS_VAULT_ADDRESS: VAULT,
  };

  it('đủ trường thì có cấu hình (PEM viết một dòng với \\n vẫn đọc được); thiếu từng trường thì null kèm lý do', () => {
    setEnv(full);
    const read = fireblocksConfig();
    expect(read.reason).toBeNull();
    expect(read.config).toMatchObject({ vaultId: '11', vaultAddress: VAULT, baseUrl: 'https://sandbox-api.fireblocks.io' });
    expect(read.config?.privateKeyPem).toContain('\n');

    for (const name of Object.keys(full)) {
      setEnv(full);
      delete process.env[name];
      resetServerEnvCache();
      const missing = fireblocksConfig();
      expect(missing.config, name).toBeNull();
      expect(missing.reason, name).toContain(name);
    }
    setEnv({ ...full, FIREBLOCKS_VAULT_ADDRESS: '0x123' });
    expect(fireblocksConfig().reason).toMatch(/FIREBLOCKS_VAULT_ADDRESS/);
  });

  it('PEM sai thì null kèm lý do không chứa khoá', () => {
    // Thân giả rõ ràng (base64 của "KhongPhaiKhoa"), không phải một phần khoá nào.
    const body = 'S2hvbmdQaGFpS2hvYQ==';
    for (const pem of [
      `-----BEGIN RSA PRIVATE KEY-----\\n${body}\\n-----END RSA PRIVATE KEY-----`,
      `khong-phai-pem-${body}`,
      `-----BEGIN PRIVATE KEY-----\\n${body}!!\\n-----END PRIVATE KEY-----`,
    ]) {
      setEnv({ ...full, FIREBLOCKS_SECRET_KEY: pem });
      const read = fireblocksConfig();
      expect(read.config).toBeNull();
      expect(read.reason).not.toContain(body);
    }
  });

  it('bảng chain: chain lạ, mock, thiếu mã tài sản, chain trùng thì CẢ bảng sai; đọc được khi thiếu khoá; rỗng chủ động hợp lệ; bỏ biến dùng mặc định', () => {
    setEnv({ FIREBLOCKS_CHAIN_ASSETS: 'evm:ETH_TEST5,hardhat-local:ETH_HH' });
    expect(fireblocksConfig().config).toBeNull();
    expect(fireblocksChainScope()).toEqual({ ok: true, chainAssets: { evm: 'ETH_TEST5', 'hardhat-local': 'ETH_HH' } });
    for (const bad of ['evm:ETH_TEST5,foo:X', 'evm:ETH_TEST5,mock:X', 'evm:', 'evm:ETH_TEST5,evm:ETH_B', 'evm:ETH_TEST5,']) {
      const scope = parseChainAssets(bad);
      expect(scope.ok, bad).toBe(false);
    }
    setEnv({ FIREBLOCKS_CHAIN_ASSETS: '' });
    expect(fireblocksChainScope()).toEqual({ ok: true, chainAssets: {} });
    delete process.env.FIREBLOCKS_CHAIN_ASSETS;
    resetServerEnvCache();
    expect(fireblocksChainScope()).toEqual({ ok: true, chainAssets: { evm: 'ETH_TEST5' } });
  });

  it('configRef đổi khi đổi baseUrl hoặc khoá API, 16 ký tự hex, không chứa khoá', () => {
    const ref = configRefOf('https://a', 'khoa-1');
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(configRefOf('https://b', 'khoa-1')).not.toBe(ref);
    expect(configRefOf('https://a', 'khoa-2')).not.toBe(ref);
    expect(configRefOf('https://a', 'khoa-1')).toBe(ref);
  });
});

describe('IN-04 ca 4: công tắc Lưu ký Fireblocks', () => {
  it('Giao dịch viên, Kiểm soát viên bật tắt được, có lịch sử và dòng sổ; Nhà đầu tư, Người bán FORBIDDEN', async () => {
    for (const [role, actor] of [['TELLER', 'GDV001'], ['CONTROLLER', 'KSV001']] as const) {
      actAs(role, actor);
      expect((await setFireblocksCustody({ enabled: true, reason: `${role} bật` })).ok).toBe(true);
      expect((await getCustodyState()).enabled).toBe(true);
      expect((await setFireblocksCustody({ enabled: false })).ok).toBe(true);
      expect((await getCustodyState()).enabled).toBe(false);
    }
    const history = await getConfigStore().listConfigHistory({ key: custodyService.CUSTODY_CONFIG_KEY });
    expect(history).toHaveLength(4);
    const audit = (await getStore().listAudit({ limit: 50 })).filter(
      (row) => row.action === 'custody:toggle' && row.outcome === 'SUCCESS',
    );
    expect(audit).toHaveLength(4);
    expect(audit.map((row) => row.detail)).toContain('Lưu ký Fireblocks: tắt sang bật (TELLER bật)');

    for (const role of ['INVESTOR', 'SELLER']) {
      actAs(role);
      expect(await setFireblocksCustody({ enabled: true })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }
  });

  it('chưa cấu hình: bật là VALIDATION, tắt vẫn được; mất cấu hình sau khi bật: enabled vẫn true, configured false, custodyFor vẫn FIREBLOCKS', async () => {
    await setCustody(true);
    setFireblocksConfigForTest({ config: null, chainAssets: { mock: 'ETH_TEST5' } });
    const state = await getCustodyState();
    expect(state).toMatchObject({ enabled: true, configured: false });
    expect(custodyFor(CHAIN, state)).toBe('FIREBLOCKS');

    teller();
    expect((await setFireblocksCustody({ enabled: false })).ok).toBe(true);
    expect(await setFireblocksCustody({ enabled: true })).toMatchObject({
      ok: false,
      code: 'VALIDATION',
      error: 'Chưa cấu hình Fireblocks (khoá API, vault); không bật được.',
    });
  });
});

describe('IN-04 ca 5: custodyFor', () => {
  const scope = (raw: string) => parseChainAssets(raw);

  it('đủ các tổ hợp; bảng sai không bỏ phần tử sai để dùng phần còn lại', () => {
    for (const raw of ['evm:ETH_TEST5', '', 'evm:', 'foo:X']) {
      expect(custodyFor('evm', { enabled: false, scope: scope(raw) }), raw).toBe('SERVER');
    }
    expect(custodyFor('evm', { enabled: true, scope: scope('evm:ETH_TEST5') })).toBe('FIREBLOCKS');
    expect(custodyFor('hardhat-local', { enabled: true, scope: scope('evm:ETH_TEST5') })).toBe('SERVER');
    expect(custodyFor('evm', { enabled: true, scope: scope('') })).toBe('SERVER');
    for (const raw of ['evm:', 'foo:X', 'mock:X', 'evm:ETH_TEST5,evm:ETH_B', 'evm:ETH_TEST5,foo:X', 'evm:ETH_TEST5,mock:X']) {
      expect(custodyFor('evm', { enabled: true, scope: scope(raw) }), raw).toBe('UNRESOLVED');
    }
  });
});

describe('IN-04 ca 5b: mức approveTokenRequest', () => {
  it('bảng chain sai dạng ("evm:") khi công tắc bật: chặn, PENDING, khoá máy chủ không được gọi', async () => {
    await issueDirect(1_000n);
    await setCustody(true);
    setFireblocksConfigForTest({ config: CONFIG });
    process.env.FIREBLOCKS_CHAIN_ASSETS = 'evm:';
    resetServerEnvCache();
    const id = await draft(mintInput(10n));
    const result = await approve(id);
    expect(result).toMatchObject({ ok: false, code: 'REQUEST_CHECK' });
    expect(!result.ok && result.error).toMatch(/^Bảng chain của Lưu ký Fireblocks sai \(/);
    expect((await find(id)).status).toBe('PENDING');
    expect(ledgerFake.serverSends).toBe(0);
    expect(fb.creates).toHaveLength(0);
  });

  it('hai chain, hai mã tài sản: thân POST theo bối cảnh của từng yêu cầu; đổi cấu hình sau lúc chiếm quyền không đổi thân POST', async () => {
    await issueDirect(1_000n);
    setFireblocksConfigForTest({ config: CONFIG, chainAssets: { mock: 'ASSET_MOCK', 'hardhat-local': 'ASSET_HH' } });
    await setCustody(true);

    const mintId = await draft(mintInput(10n));
    expect((await approve(mintId)).ok).toBe(true);
    const burnId = await draft(burnInput(5n, 'hardhat-local'));
    const burned = await approve(burnId, 'hardhat-local');
    expect(burned.ok, burned.ok ? '' : burned.error).toBe(true);

    expect(fb.creates.map((call) => [call.externalTxId, call.assetId, call.vaultId])).toEqual([
      [mintId, 'ASSET_MOCK', '11'],
      [burnId, 'ASSET_HH', '11'],
    ]);
    expect((await find(mintId)).custodyContext).toMatchObject({ assetId: 'ASSET_MOCK', vaultId: '11', chain: 'mock' });
    expect((await find(burnId)).custodyContext).toMatchObject({ assetId: 'ASSET_HH', vaultId: '11', chain: 'hardhat-local' });

    // Đổi cấu hình toàn cục NGAY SAU lúc chiếm quyền (ở bước mô phỏng): thân POST vẫn theo bối cảnh đã ghi.
    const third = await draft(mintInput(3n));
    ledgerFake.onPrepare = () => {
      setFireblocksConfigForTest({ config: { ...CONFIG, vaultId: '99' }, chainAssets: { mock: 'ASSET_DOI' } });
    };
    expect((await approve(third)).ok).toBe(true);
    expect(fb.creates[2]).toMatchObject({ externalTxId: third, assetId: 'ASSET_MOCK', vaultId: '11' });
  });
});

// =============================================================================
//  C. Thực hiện qua Fireblocks (ca 6, 7)
// =============================================================================

describe('IN-04 ca 6: classifyFireblocksTx', () => {
  const tx = (status: string, txHash: string | null = null, subStatus: string | null = null) => ({
    id: 'fb-1',
    status,
    subStatus,
    txHash,
    externalTxId: 'req',
  });

  it('có mã ở mọi trạng thái là HASH; trạng thái âm không mã là DEAD; FAILED lý do khác là WAIT có lý do; còn lại WAIT', () => {
    for (const status of ['CONFIRMING', 'COMPLETED', 'FAILED']) {
      expect(classifyFireblocksTx(tx(status, '0xabc'))).toEqual({ kind: 'HASH', txHash: '0xabc', fireblocksId: 'fb-1' });
    }
    for (const status of ['CANCELLED', 'BLOCKED', 'REJECTED']) {
      expect(classifyFireblocksTx(tx(status)).kind, status).toBe('DEAD');
    }
    expect(classifyFireblocksTx(tx('FAILED', null, 'INSUFFICIENT_FUNDS_FOR_FEE'))).toEqual({
      kind: 'DEAD',
      reason: 'Fireblocks FAILED/INSUFFICIENT_FUNDS_FOR_FEE, chưa phát lên chuỗi.',
      fireblocksId: 'fb-1',
    });
    expect(classifyFireblocksTx(tx('FAILED', null, 'TIMEOUT'))).toEqual({
      kind: 'WAIT',
      reason: 'Fireblocks FAILED/TIMEOUT không có mã giao dịch; cần đối soát tay.',
      fireblocksId: 'fb-1',
    });
    for (const status of ['SUBMITTED', 'PENDING_SIGNATURE', 'BROADCASTING']) {
      expect(classifyFireblocksTx(tx(status))).toEqual({ kind: 'WAIT', fireblocksId: 'fb-1' });
    }
  });
});

describe('IN-04 ca 7: submitViaFireblocks với phụ thuộc giả', () => {
  const CONTEXT = {
    configRef: CONFIG.configRef,
    vaultId: '11',
    address: VAULT,
    assetId: 'ETH_TEST5',
    chain: 'mock' as const,
    contract: null,
    callDataHash: null,
  };

  async function run(setup: (client: FakeFireblocks) => void, options: { prepareThrows?: boolean } = {}) {
    const fake = new FakeFireblocks();
    setup(fake);
    let attempted = false;
    const outcome = await submitViaFireblocks(
      { requestId: 'req-7', note: 'IN-04 MINT req-7', context: CONTEXT },
      {
        prepare: async () => {
          if (options.prepareThrows) throw new Error('ProjectToken từ chối mint: thiếu vai.');
          return { to: ledgerFake.token, data: '0x40c10f19' };
        },
        setCustodyCall: async () => ({}) as never,
        markAttempted: () => {
          attempted = true;
        },
        client: fake,
        onCreated: async () => {},
        sleep: async () => {},
        hashWaitMs: 9_000,
        pollMs: 3_000,
      },
    );
    return { outcome, fake, attempted };
  }

  it('mô phỏng revert: FAILED, khách không được gọi', async () => {
    const { outcome, fake, attempted } = await run(() => {}, { prepareThrows: true });
    expect(outcome).toMatchObject({ kind: 'FAILED', definitelyNotOnChain: true });
    expect(fake.callCount).toBe(0);
    expect(attempted).toBe(false);
  });

  it.each([
    ['lỗi mạng sau khi đã tạo, tra thấy: có mã', (f: FakeFireblocks) => {
      f.createError = { error: new FireblocksNetworkError('mạng'), afterCreate: true };
    }, 'HASH'],
    ['400 mã 1503, tra trả 1439: FAILED', (f: FakeFireblocks) => {
      f.createError = { error: httpError(400, 1503, 'Asset sai'), afterCreate: false };
    }, 'FAILED'],
    ['400 mã 1438, tra lỗi: chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: httpError(400, 1438), afterCreate: false };
      f.lookupError = httpError(500, null);
    }, 'UNKNOWN'],
    ['400 mã 1438, tra trả 1439: chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: httpError(400, 1438), afterCreate: false };
    }, 'UNKNOWN'],
    ['400 mã lạ, tra trả 1439: chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: httpError(400, 9999), afterCreate: false };
    }, 'UNKNOWN'],
    ['429: chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: httpError(429, null), afterCreate: false };
    }, 'UNKNOWN'],
    ['lỗi mạng, tra trả 1439: chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: new FireblocksNetworkError('mạng'), afterCreate: false };
    }, 'UNKNOWN'],
    ['tra trả 404 không mã 1439 (lỗi tra): chưa rõ', (f: FakeFireblocks) => {
      f.createError = { error: httpError(503, null), afterCreate: false };
      f.lookupError = httpError(404, null, 'Not found');
    }, 'UNKNOWN'],
    ['chờ hết giờ không có mã: chưa rõ', (f: FakeFireblocks) => {
      f.hold = true;
    }, 'UNKNOWN'],
    ['trạng thái cuối âm (CANCELLED không mã): FAILED', (f: FakeFireblocks) => {
      f.final = { status: 'CANCELLED', withHash: false };
    }, 'FAILED'],
  ] as const)('%s', async (_name, setup, kind) => {
    const { outcome, fake, attempted } = await run(setup);
    expect(outcome.kind).toBe(kind);
    expect(fake.creates).toHaveLength(1);
    expect(attempted).toBe(true);
    if (outcome.kind === 'FAILED' && fake.createError) {
      expect(outcome.reason).toBe('Fireblocks từ chối tạo giao dịch (mã 1503): Asset sai');
    }
  });

  it('chờ mã hỏi đúng nhịp: 9 giây, mỗi 3 giây, tối đa bốn lần', async () => {
    const { fake } = await run((f) => {
      f.hold = true;
    });
    expect(fake.getByIdCalls).toHaveLength(4);
  });
});

// =============================================================================
//  Mức lần duyệt (ca 7b), đối soát (ca 8), công tắc tắt và chain ngoài bảng (ca 9, 10)
// =============================================================================

const yearsAgo = (id: string) => {
  const state = memoryState('tokenRequest', () => ({ requests: [] as Array<{ id: string; decidedAt: string | null }> }));
  const row = state.requests.find((request) => request.id === id);
  if (!row) throw new Error(`Không có yêu cầu ${id} trong bộ nhớ.`);
  row.decidedAt = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
};

describe('IN-04 ca 7b: lần duyệt qua Fireblocks (bộ nhớ, chain mock trong bảng)', () => {
  it('vault thiếu vai: chặn, PENDING, có dòng sổ FAILURE, không gọi Fireblocks, không gọi khoá máy chủ', async () => {
    const id = await fireblocksMint();
    ledgerFake.roles = { minter: false, agent: true };
    const result = await approve(id);
    expect(result).toMatchObject({
      ok: false,
      code: 'REQUEST_CHECK',
      error: `Vault Fireblocks ${VAULT} chưa có quyền MINTER_ROLE trên ProjectToken.`,
    });
    expect((await find(id)).status).toBe('PENDING');
    expect((await auditDecisions()).some((row) => row.outcome === 'FAILURE' && row.detail?.includes('MINTER_ROLE'))).toBe(true);
    expect(fb.creates).toHaveLength(0);
    expect(ledgerFake.serverSends).toBe(0);
  });

  it('đọc công tắc lỗi khi đang bật: chặn, PENDING, khoá máy chủ không được gọi', async () => {
    const id = await fireblocksMint();
    const configStore = getConfigStore();
    const original = configStore.getConfig.bind(configStore);
    vi.spyOn(configStore, 'getConfig').mockImplementation(async (key: string) =>
      key === custodyService.CUSTODY_CONFIG_KEY ? Promise.reject(new Error('mất kết nối')) : original(key),
    );
    expect(await approve(id)).toMatchObject({
      ok: false,
      code: 'REQUEST_CHECK',
      error: 'Không đọc được trạng thái Lưu ký Fireblocks; thử lại.',
    });
    expect((await find(id)).status).toBe('PENDING');
    expect(ledgerFake.serverSends).toBe(0);
  });

  it('công tắc bật mà cấu hình mất: chặn, PENDING, khoá máy chủ không được gọi', async () => {
    const id = await fireblocksMint();
    setFireblocksConfigForTest({ config: null, chainAssets: { mock: 'ETH_TEST5' } });
    const result = await approve(id);
    expect(result).toMatchObject({ ok: false, code: 'REQUEST_CHECK' });
    expect(!result.ok && result.error).toMatch(/^Lưu ký Fireblocks đang bật nhưng thiếu cấu hình \(/);
    expect((await find(id)).status).toBe('PENDING');
    expect(ledgerFake.serverSends).toBe(0);
  });

  it('thành công: chiếm quyền ghi đủ bối cảnh ký; Txn ghi địa chỉ vault; nhãn "Thực hiện qua" có vault và mã Fireblocks', async () => {
    const id = await fireblocksMint(10n);
    const result = await approve(id);
    expect(result.ok && result.data.status).toBe('COMPLETED');
    const record = await find(id);
    expect(record.custody).toBe('FIREBLOCKS');
    expect(record.custodyTxId).toBe('fb-tx-1');
    expect(record.custodyContext).toEqual({
      configRef: CONFIG.configRef,
      vaultId: '11',
      address: VAULT,
      assetId: 'ETH_TEST5',
      chain: 'mock',
      contract: ledgerFake.token,
      callDataHash: keccak256(fb.creates[0].data as Hex),
    });
    expect(fb.creates[0]).toMatchObject({ externalTxId: id, note: `IN-04 MINT ${id}`, contract: ledgerFake.token });
    expect(ledgerFake.serverSends).toBe(0);
    const rows = await txnRowsFor(record.txHash!);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorAddress).toBe(VAULT);
    expect((await detail(id)).custodyLabel).toBe('Fireblocks, vault 11 (0x14dC…9955); mã Fireblocks fb-tx-1');
  });

  it('sau khi gọi tạo: getById luôn ném, attachCustodyTxId ném, saveTxn ném sau khi có mã: đều còn EXECUTING, không FAILED', async () => {
    // getById luôn ném (khách giữ giao dịch, chưa có mã).
    let id = await fireblocksMint();
    fb.hold = true;
    fb.getByIdError = new Error('mạng');
    let result = await approve(id);
    expect(result.ok && result.data.status).toBe('EXECUTING');
    expect((await find(id)).status).toBe('EXECUTING');

    // attachCustodyTxId ném; khách giả luôn trả trạng thái chờ tới hết thời gian chờ.
    fb.getByIdError = null;
    vi.spyOn(getTokenRequestStore(), 'attachCustodyTxId').mockRejectedValue(new Error('ghi lỗi'));
    id = await draft(mintInput(5n));
    result = await approve(id);
    expect(result.ok && result.data.status).toBe('EXECUTING');
    expect((await find(id)).custodyTxId).toBeNull();
    vi.restoreAllMocks();

    // saveTxn ném sau khi có mã: lần duyệt giữ EXECUTING; đối soát sau đó COMPLETED, vẫn 0 dòng Txn.
    fb.hold = false;
    const saveTxn = vi.spyOn(getStore(), 'saveTxn').mockRejectedValueOnce(new Error('ghi Txn lỗi'));
    id = await draft(mintInput(3n));
    result = await approve(id);
    expect(result.ok).toBe(false);
    const stuck = await find(id);
    expect(stuck.status).toBe('EXECUTING');
    expect(stuck.txHash).not.toBeNull();
    saveTxn.mockRestore();
    const reconciled = await reconcile(id);
    expect(reconciled.ok && reconciled.data.status).toBe('COMPLETED');
    expect(await txnRowsFor(stuck.txHash!)).toHaveLength(0);
  });
});

describe('IN-04 ca 8: đối soát qua Fireblocks', () => {
  it('Fireblocks trả 1439 (không mã, custodyTxId null, decidedAt cũ hàng năm): giữ Đang thực hiện; KHÔNG tạo giao dịch', async () => {
    const id = await fireblocksMint();
    fb.hold = true;
    vi.spyOn(getTokenRequestStore(), 'attachCustodyTxId').mockRejectedValue(new Error('ghi lỗi'));
    await approve(id);
    vi.restoreAllMocks();
    fb.hideFromLookup = true;
    yearsAgo(id);
    for (let i = 0; i < 2; i += 1) {
      const result = await reconcile(id);
      expect(result).toMatchObject({ ok: true, data: { status: 'EXECUTING', notice: execution.FIREBLOCKS_NOT_FOUND } });
    }
    expect((await detail(id)).canReconcile).toBe(true);
    expect(fb.creates).toHaveLength(1);
  });

  it('tra lỗi 403 (theo externalTxId) hoặc 500 (theo mã Fireblocks): giữ, câu "Chưa đọc được Fireblocks; thử lại."', async () => {
    const id = await fireblocksMint();
    fb.hold = true;
    vi.spyOn(getTokenRequestStore(), 'attachCustodyTxId').mockRejectedValue(new Error('ghi lỗi'));
    await approve(id);
    vi.restoreAllMocks();
    fb.lookupError = httpError(403, -7, 'Unauthorized');
    expect(await reconcile(id)).toMatchObject({ ok: true, data: { status: 'EXECUTING', notice: 'Chưa đọc được Fireblocks; thử lại.' } });

    const second = await draft(mintInput(4n));
    await approve(second);
    expect((await find(second)).custodyTxId).not.toBeNull();
    fb.getByIdError = httpError(500, null, 'Internal');
    expect(await reconcile(second)).toMatchObject({ ok: true, data: { status: 'EXECUTING', notice: 'Chưa đọc được Fireblocks; thử lại.' } });
    expect(fb.creates).toHaveLength(2);
  });

  it('có mã: gắn mã, ghi đúng một dòng Txn của vault, đi đường biên nhận tới COMPLETED; kết quả trả có txHash mới', async () => {
    const id = await fireblocksMint(7n);
    fb.hold = true;
    expect((await approve(id)).ok).toBe(true);
    expect((await find(id)).txHash).toBeNull();
    await fb.release();
    const result = await reconcile(id);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.txHash).not.toBeNull();
    const rows = await txnRowsFor(result.data.txHash!);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorAddress).toBe(VAULT);
    expect(fb.creates).toHaveLength(1);
  });

  it('DEAD: FAILED có dòng sổ; công tắc tắt sau khi duyệt vẫn đối soát qua Fireblocks', async () => {
    const id = await fireblocksMint();
    fb.hold = true;
    await approve(id);
    fb.setTx('fb-tx-1', { status: 'CANCELLED' });
    const dead = await reconcile(id);
    expect(dead.ok && dead.data.status).toBe('FAILED');
    expect((await find(id)).failureReason).toBe('Fireblocks CANCELLED, chưa phát lên chuỗi.');

    const second = await draft(mintInput(2n));
    await approve(second);
    await setCustody(false);
    await fb.release();
    const done = await reconcile(second);
    expect(done.ok && done.data.status).toBe('COMPLETED');
    expect(ledgerFake.serverSends).toBe(0);
    expect(fb.creates).toHaveLength(2);
  });
});

describe('IN-04 ca 9, 10: khoá máy chủ khi công tắc tắt hoặc chain ngoài bảng', () => {
  it('ca 9: công tắc tắt (mặc định): khoá máy chủ, custody SERVER, không gọi Fireblocks', async () => {
    await issueDirect(1_000n);
    const id = await draft(mintInput(10n));
    const result = await approve(id);
    expect(result.ok && result.data.status).toBe('COMPLETED');
    expect((await find(id)).custody).toBe('SERVER');
    expect((await find(id)).custodyContext).toBeNull();
    expect(ledgerFake.serverSends).toBe(1);
    expect(fb.creates).toHaveLength(0);
    expect((await detail(id)).custodyLabel).toBe('Khoá ký máy chủ');
  });

  it('ca 10: công tắc bật, chain mock ngoài bảng: khoá máy chủ, custody SERVER', async () => {
    await issueDirect(1_000n);
    setFireblocksConfigForTest({ config: CONFIG, chainAssets: { 'hardhat-local': 'ETH_HH' } });
    await setCustody(true);
    const id = await draft(mintInput(10n));
    expect((await detail(id)).custodyLabel).toBe('Khoá ký máy chủ');
    expect((await approve(id)).ok).toBe(true);
    expect((await find(id)).custody).toBe('SERVER');
    expect(ledgerFake.serverSends).toBe(1);
    expect(fb.creates).toHaveLength(0);
  });
});

describe('IN-04 ca 15: đường về trang của vai', () => {
  it('roleHomeHref trả đúng bốn vai', () => {
    expect(roleHomeHref('INVESTOR')).toBe('/portfolio');
    expect(roleHomeHref('SELLER')).toBe('/seller');
    expect(roleHomeHref('TELLER')).toBe('/');
    expect(roleHomeHref('CONTROLLER')).toBe('/');
  });
});

// =============================================================================
//  Ca 16, 17, 18, 18b
// =============================================================================

describe('IN-04 ca 16: cấu hình đổi khi còn EXECUTING', () => {
  it.each([
    ['đổi baseUrl', { configRef: configRefOf('https://khac.test', CONFIG.apiKey) }],
    ['đổi khoá API', { configRef: configRefOf(CONFIG.baseUrl, 'khoa-moi') }],
    ['đổi vault ID', { vaultId: '12' }],
  ])('%s: không gọi khách, giữ EXECUTING, câu QĐ-14; khôi phục thì đối soát chạy', async (_name, patch) => {
    const id = await fireblocksMint();
    fb.hold = true;
    await approve(id);
    await fb.release();
    setFireblocksConfigForTest({ config: { ...CONFIG, ...patch }, chainAssets: { mock: 'ETH_TEST5' } });
    const calls = fb.callCount;
    const result = await reconcile(id);
    expect(result).toMatchObject({
      ok: true,
      data: { status: 'EXECUTING', notice: 'Cấu hình Fireblocks đã đổi so với lúc duyệt (vault 11); phục hồi cấu hình cũ để đối soát.' },
    });
    expect(fb.callCount).toBe(calls);
    expect((await detail(id)).custodyLabel).toBe('Fireblocks, vault 11 (0x14dC…9955); mã Fireblocks fb-tx-1');

    setFireblocksConfigForTest({ config: CONFIG, chainAssets: { mock: 'ETH_TEST5' } });
    const done = await reconcile(id);
    expect(done.ok && done.data.status).toBe('COMPLETED');
    expect((await txnRowsFor((await find(id)).txHash!))[0].actorAddress).toBe(VAULT);
  });
});

describe('IN-04 ca 17: tạo xong nhưng không ghi được mã Fireblocks, Fireblocks chưa đồng bộ', () => {
  it('lần duyệt giữ EXECUTING; đối soát nhiều lần, kể cả khi đã lâu: KHÔNG FAILED', async () => {
    const id = await fireblocksMint();
    fb.hold = true;
    vi.spyOn(getTokenRequestStore(), 'attachCustodyTxId').mockRejectedValue(new Error('ghi lỗi'));
    const approved = await approve(id);
    expect(approved.ok && approved.data.status).toBe('EXECUTING');
    vi.restoreAllMocks();
    fb.hideFromLookup = true;
    for (let i = 0; i < 3; i += 1) {
      if (i === 2) yearsAgo(id);
      const result = await reconcile(id);
      expect(result.ok && result.data.status).toBe('EXECUTING');
    }
    expect((await find(id)).status).toBe('EXECUTING');
  });
});

describe('IN-04 ca 18: giao dịch phải khớp lời gọi đã chuẩn bị (QĐ-15)', () => {
  const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  it('lần duyệt: from khác thì không COMPLETED, giữ EXECUTING, có dòng sổ FAILURE', async () => {
    const id = await fireblocksMint();
    ledgerFake.callOverride = (call) => ({ ...call, from: OTHER });
    const result = await approve(id);
    expect(result.ok && result.data.status).toBe('EXECUTING');
    expect(result.ok && result.data.notice).toMatch(/không khớp lời gọi đã chuẩn bị; cần đối soát tay\.$/);
    expect((await auditDecisions()).some((row) => row.outcome === 'FAILURE' && row.detail?.includes('Trường lệch: from'))).toBe(true);
    expect((await find(id)).status).toBe('EXECUTING');
  });

  it('lần đối soát: to khác, input khác đều giữ EXECUTING; khớp đủ thì COMPLETED', async () => {
    const id = await fireblocksMint();
    fb.hold = true;
    await approve(id);
    await fb.release();
    for (const [field, override] of [
      ['to', (call: { from: string; to: string | null; input: string }) => ({ ...call, to: OTHER })],
      ['input', (call: { from: string; to: string | null; input: string }) => ({ ...call, input: `${call.input}00` })],
    ] as const) {
      ledgerFake.callOverride = override;
      const result = await reconcile(id);
      expect(result.ok && result.data.status, field).toBe('EXECUTING');
      expect((await auditDecisions()).some((row) => row.detail?.includes(`Trường lệch: ${field}`)), field).toBe(true);
    }
    ledgerFake.callOverride = null;
    const done = await reconcile(id);
    expect(done.ok && done.data.status).toBe('COMPLETED');
  });

  it('matchesPreparedCall: contract hoặc callDataHash null là false; khớp đủ là true', () => {
    const input = '0x40c10f19';
    const tx = { from: VAULT, to: ledgerFake.token, input };
    const ctx = { address: VAULT, contract: ledgerFake.token, callDataHash: keccak256(input) };
    expect(matchesPreparedCall(ctx, tx)).toBe(true);
    expect(matchesPreparedCall({ ...ctx, contract: null }, tx)).toBe(false);
    expect(matchesPreparedCall({ ...ctx, callDataHash: null }, tx)).toBe(false);
    expect(matchesPreparedCall(ctx, null)).toBe(false);
  });
});

describe('IN-04 ca 18b: QĐ-8b ở nhánh kết quả lỗi', () => {
  it('sau khi gọi tạo, gắn mã lỗi lưu trữ: giữ EXECUTING', async () => {
    const id = await fireblocksMint();
    vi.spyOn(getTokenRequestStore(), 'claimTxHash').mockRejectedValue(new Error('cơ sở dữ liệu lỗi'));
    const result = await approve(id);
    expect(result.ok && result.data.status).toBe('EXECUTING');
    expect((await find(id)).status).toBe('EXECUTING');
  });

  it('lượt thua QĐ-16: giữ EXECUTING, không thêm dòng sổ, không ghi Txn', async () => {
    const id = await fireblocksMint();
    fb.beforeGetById = async (tx) => {
      if (tx.txHash && tx.externalTxId) await getTokenRequestStore().claimTxHash({ id: tx.externalTxId, txHash: tx.txHash });
    };
    const before = (await auditDecisions()).length;
    const result = await approve(id);
    expect(result).toMatchObject({ ok: true, data: { status: 'EXECUTING', notice: 'Yêu cầu đang được đối soát ở lượt khác.' } });
    expect((await auditDecisions()).length).toBe(before);
    expect(await txnRowsFor((await find(id)).txHash!)).toHaveLength(0);
  });

  it('setCustodyCall trả null: FAILED, khách KHÔNG được gọi', async () => {
    const id = await fireblocksMint();
    vi.spyOn(getTokenRequestStore(), 'setCustodyCall').mockResolvedValue(null);
    const result = await approve(id);
    expect(result.ok).toBe(false);
    expect((await find(id))).toMatchObject({ status: 'FAILED', failureReason: execution.PREPARED_CALL_NOT_SAVED });
    expect(fb.callCount).toBe(0);
  });
});

// =============================================================================
//  Postgres (ca 19, rồi ca 11): database riêng của tệp, xoá khi xong
// =============================================================================

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_in04_${process.pid}`;

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin<T>(fn: (c: Client) => Promise<T>, url = TEST_DATABASE_URL!): Promise<T> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

describe.skipIf(!TEST_DATABASE_URL)('IN-04 ca 19, 11: Postgres', () => {
  const previous = process.env.DATABASE_URL;

  beforeAll(async () => {
    await admin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`));
    await admin((c) => c.query(`CREATE DATABASE "${DB_NAME}"`));
  });

  beforeEach(async () => {
    process.env.USE_MOCK_DB = 'false';
    process.env.DATABASE_URL = isolatedUrl();
    resetServerEnvCache();
    resetStoreCache();
    await actualLedger.getLedger(CHAIN).whitelist(SPV);
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    resetServerEnvCache();
    await admin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`));
  });

  it('ca 19a: hai lượt đối soát cùng lúc cùng thấy mã: một lượt gắn, một dòng Txn, chốt một lần', async () => {
    await issueDirect(1_000n);
    await setCustody(true);
    const id = await draft(mintInput(6n));
    fb.hold = true;
    expect((await approve(id)).ok).toBe(true);
    await fb.release();
    const results = await Promise.all([reconcile(id), reconcile(id)]);
    const record = await find(id);
    expect(record.status).toBe('COMPLETED');
    expect(await txnRowsFor(record.txHash!)).toHaveLength(1);
    const finals = (await getStore().listAudit({ limit: 500 })).filter(
      (row) => row.action === 'token:mint' && row.outcome === 'SUCCESS' && row.detail?.includes(record.txHash!),
    );
    expect(finals).toHaveLength(1);
    const other = results.find((result) => !(result.ok && result.data.status === 'COMPLETED'));
    if (other) {
      expect(
        (other.ok && other.data.notice === 'Yêu cầu đang được đối soát ở lượt khác.') ||
          (!other.ok && /đã được chốt ở lượt khác/.test(other.error)),
      ).toBe(true);
    }
  });

  it('ca 19b: lần duyệt đang chờ cùng lúc với một lần đối soát: một lượt gắn, một dòng Txn, chốt một lần', async () => {
    await setCustody(true);
    const id = await draft(mintInput(5n));
    fb.hold = true;
    let reconciling: ReturnType<typeof reconcile> | null = null;
    fb.beforeGetById = async () => {
      if (reconciling) return;
      await fb.release();
      reconciling = reconcile(id);
      // Nhường lượt để đối soát chạy song song tới lần tra của nó.
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const approved = await approve(id);
    const reconciled = await reconciling!;
    const record = await find(id);
    expect(record.status).toBe('COMPLETED');
    expect(await txnRowsFor(record.txHash!)).toHaveLength(1);
    const finals = (await getStore().listAudit({ limit: 500 })).filter(
      (row) => row.action === 'token:mint' && row.outcome === 'SUCCESS' && row.detail?.includes(record.txHash!),
    );
    expect(finals).toHaveLength(1);
    expect([approved, reconciled].filter((result) => result.ok && result.data.status === 'COMPLETED').length).toBeGreaterThanOrEqual(1);
  });

  it('ca 11: ba cột mới thêm vào database cũ khi khởi động lại; chiếm quyền ghi bối cảnh; phương thức có điều kiện', async () => {
    const columns = () =>
      admin(
        (c) =>
          c.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'TokenRequest' AND column_name IN ('custody','custodyTxId','custodyContext')
              ORDER BY column_name`,
          ),
        isolatedUrl(),
      );
    expect((await columns()).rows.map((row) => row.column_name)).toEqual(['custody', 'custodyContext', 'custodyTxId']);
    await admin(
      (c) =>
        c.query(`ALTER TABLE "TokenRequest" DROP COLUMN "custody", DROP COLUMN "custodyTxId", DROP COLUMN "custodyContext"`),
      isolatedUrl(),
    );
    expect((await columns()).rows).toEqual([]);

    vi.resetModules();
    const pool = await import('@/lib/store/postgres.pool');
    await pool.pgQuery('SELECT 1');
    expect((await columns()).rows.map((row) => row.column_name)).toEqual(['custody', 'custodyContext', 'custodyTxId']);

    const { createPostgresTokenRequestStore } = await import('@/lib/store/postgres.token-request.store');
    const pg = createPostgresTokenRequestStore();
    const created = await pg.createRequest({
      chain: 'mock',
      tokenSymbol: 'WPT',
      type: 'MINT',
      amount: '1',
      wallet: SPV,
      reason: 'ca 11',
      makerId: 'GDV001',
      makerRole: 'TELLER',
    });
    expect(created.custody).toBe('SERVER');
    const context = {
      configRef: CONFIG.configRef,
      vaultId: '11',
      address: VAULT,
      assetId: 'ETH_TEST5',
      chain: 'mock' as const,
      contract: null,
      callDataHash: null,
    };
    const claimed = await pg.transitionRequest({
      id: created.id,
      from: ['PENDING'],
      to: 'EXECUTING',
      checkerId: 'KSV001',
      checkerRole: 'CONTROLLER',
      custody: 'FIREBLOCKS',
      custodyContext: context,
    });
    expect(claimed).toMatchObject({ custody: 'FIREBLOCKS', custodyContext: context });
    expect((await pg.attachCustodyTxId({ id: created.id, custodyTxId: 'fb-1' }))?.custodyTxId).toBe('fb-1');
    const hash = keccak256('0x01');
    expect((await pg.setCustodyCall({ id: created.id, contract: ledgerFake.token, callDataHash: hash }))?.custodyContext).toEqual({
      ...context,
      contract: ledgerFake.token,
      callDataHash: hash,
    });
    const txHash = `0x${'ab'.repeat(32)}`;
    expect((await pg.claimTxHash({ id: created.id, txHash }))?.txHash).toBe(txHash);
    expect(await pg.claimTxHash({ id: created.id, txHash: `0x${'cd'.repeat(32)}` })).toBeNull();

    await pg.finalizeTokenRequest({ id: created.id, to: 'COMPLETED', audits: [] });
    expect(await pg.attachCustodyTxId({ id: created.id, custodyTxId: 'fb-2' })).toBeNull();
    expect(await pg.setCustodyCall({ id: created.id, contract: ledgerFake.token, callDataHash: hash })).toBeNull();
  });
});
