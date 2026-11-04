import { readFileSync } from 'node:fs';
import path from 'node:path';
import { encodeAbiParameters, encodeEventTopics, toEventSelector, type Abi, type AbiEvent, type Hex, type Log } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectTokenAbi, spvPaymentVaultAbi } from '@bidv/shared';
import { normalizeEvmAddress } from '@/lib/ledger/address';

/**
 * FIX-07 (design mục 2): giải mã log Indexer EVM. Sự kiện không theo dõi bị bỏ im lặng; log lạ cảnh báo một
 * lần mỗi chain; dữ liệu sự kiện đang theo dõi giữ nguyên như trước khi dời mã.
 *
 * Tập cảnh báo nằm ở mức mô-đun nên mỗi ca nạp lại mô-đun (`vi.resetModules` rồi `import`).
 */

const TOPIC_ROLE_GRANTED = '0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d';
const TOPIC_APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

const VAULT = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const TOKEN = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const SCOPE = { vault: VAULT, token: TOKEN };
const ALICE = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const BOB = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
const TX = `0x${'ab'.repeat(32)}` as Hex;

/** ABI đầy đủ trong `packages/shared/generated` (chỉ đọc trong test). */
function fullAbi(name: 'ProjectToken' | 'SpvPaymentVault'): Abi {
  const raw = JSON.parse(
    readFileSync(path.resolve(__dirname, `../../packages/shared/generated/${name}.abi.json`), 'utf8'),
  ) as Abi | { abi: Abi };
  return Array.isArray(raw) ? (raw as Abi) : (raw as { abi: Abi }).abi;
}

const events = (abi: Abi) => abi.filter((item): item is AbiEvent => item.type === 'event');
const signature = (event: AbiEvent) => `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;

/** Giá trị mẫu theo kiểu tham số, đủ để mã hoá log giả. */
function sampleValue(type: string): unknown {
  if (type === 'address') return ALICE;
  if (type === 'bool') return true;
  if (type.startsWith('uint') || type.startsWith('int')) return 1n;
  if (type === 'bytes32') return `0x${'11'.repeat(32)}`;
  throw new Error(`Chưa có giá trị mẫu cho kiểu ${type}`);
}

/** Log thô giả: `topics` từ `encodeEventTopics`, `data` từ `encodeAbiParameters` của tham số không `indexed`. */
function makeLog(
  abi: Abi,
  eventName: string,
  args: Record<string, unknown>,
  opts: { address: string; blockNumber?: bigint | null; logIndex?: number | null; transactionHash?: Hex | null },
): Log {
  const event = events(abi).find((item) => item.name === eventName)!;
  const topics = encodeEventTopics({ abi, eventName, args } as never) as Hex[];
  const nonIndexed = event.inputs.filter((input) => !input.indexed);
  const data = encodeAbiParameters(nonIndexed, nonIndexed.map((input) => args[input.name!]) as never);
  return {
    address: opts.address as Hex,
    topics: topics as Log['topics'],
    data,
    blockNumber: opts.blockNumber === undefined ? 10n : opts.blockNumber,
    logIndex: opts.logIndex === undefined ? 0 : opts.logIndex,
    transactionHash: opts.transactionHash === undefined ? TX : opts.transactionHash,
    blockHash: `0x${'cd'.repeat(32)}` as Hex,
    transactionIndex: 0,
    removed: false,
  } as Log;
}

const sampleArgs = (event: AbiEvent) =>
  Object.fromEntries(event.inputs.map((input) => [input.name!, sampleValue(input.type)]));

async function load() {
  vi.resetModules();
  return import('@/lib/ledger/evm-log-decode');
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('FIX-07 evm-log-decode', () => {
  it('ca 1: topic RoleGranted, Approval đúng; tập bỏ qua 11 phần tử = ABI đầy đủ trừ ABI rút gọn', async () => {
    const { IGNORED_EVENT_SIGNATURES, IGNORED_EVENT_TOPICS } = await load();
    expect(toEventSelector('RoleGranted(bytes32,address,address)')).toBe(TOPIC_ROLE_GRANTED);
    expect(toEventSelector('Approval(address,address,uint256)')).toBe(TOPIC_APPROVAL);
    expect(IGNORED_EVENT_TOPICS.has(TOPIC_ROLE_GRANTED)).toBe(true);
    expect(IGNORED_EVENT_TOPICS.has(TOPIC_APPROVAL)).toBe(true);
    expect(IGNORED_EVENT_SIGNATURES).toHaveLength(11);
    expect(IGNORED_EVENT_TOPICS.size).toBe(11);

    const full = new Set([...events(fullAbi('ProjectToken')), ...events(fullAbi('SpvPaymentVault'))].map(signature));
    const short = new Set([...events(projectTokenAbi as Abi), ...events(spvPaymentVaultAbi as Abi)].map(signature));
    const expected = [...full].filter((sig) => !short.has(sig)).sort();
    expect([...IGNORED_EVENT_SIGNATURES].sort()).toEqual(expected);
  });

  it('ca 2: Transfer và OrderSettled giải mã như trước (giá trị chuẩn hoá viết tường minh)', async () => {
    const { decodeEvmLogs } = await load();
    const orderRef = `0x${'AB'.repeat(32)}`;
    const logs = [
      makeLog(projectTokenAbi as Abi, 'Transfer', { from: ALICE, to: BOB, value: 1_000_000_000_000_000_000n }, { address: TOKEN, blockNumber: 7n, logIndex: 1 }),
      makeLog(
        spvPaymentVaultAbi as Abi,
        'OrderSettled',
        { orderRef, investor: BOB, side: 0, wptAmount: 2n, vndbAmount: 200_000n, price: 100_000n },
        { address: VAULT.toLowerCase(), blockNumber: 7n, logIndex: 2 },
      ),
    ];
    const result = decodeEvmLogs(logs, SCOPE, 'hardhat-local');
    expect(result).toEqual([
      {
        contract: normalizeEvmAddress(TOKEN),
        eventName: 'Transfer',
        blockNumber: 7n,
        logIndex: 1,
        txHash: TX,
        args: { from: normalizeEvmAddress(ALICE), to: normalizeEvmAddress(BOB), value: '1000000000000000000' },
      },
      {
        contract: normalizeEvmAddress(VAULT),
        eventName: 'OrderSettled',
        blockNumber: 7n,
        logIndex: 2,
        txHash: TX,
        args: {
          orderRef: `0x${'ab'.repeat(32)}`,
          investor: normalizeEvmAddress(BOB),
          side: 0,
          wptAmount: '2',
          vndbAmount: '200000',
          price: '100000',
        },
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ca 3: 11 sự kiện không theo dõi đều bị bỏ, không cảnh báo', async () => {
    const { decodeEvmLogs, IGNORED_EVENT_SIGNATURES } = await load();
    const pool = [
      ...events(fullAbi('ProjectToken')).map((event) => ({ event, abi: fullAbi('ProjectToken'), address: TOKEN })),
      ...events(fullAbi('SpvPaymentVault')).map((event) => ({ event, abi: fullAbi('SpvPaymentVault'), address: VAULT })),
    ];
    const logs = IGNORED_EVENT_SIGNATURES.map((sig, index) => {
      const found = pool.find((item) => signature(item.event) === sig)!;
      return makeLog(found.abi, found.event.name, sampleArgs(found.event), { address: found.address, logIndex: index });
    });
    expect(logs).toHaveLength(11);
    expect(decodeEvmLogs(logs, SCOPE, 'hardhat-local')).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ca 4: topic lạ cảnh báo một lần mỗi chain, câu có topic và địa chỉ', async () => {
    const { decodeEvmLogs } = await load();
    const strange = (topic: string): Log =>
      ({
        address: TOKEN as Hex,
        topics: [topic as Hex],
        data: '0x',
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: TX,
        blockHash: TX,
        transactionIndex: 0,
        removed: false,
      }) as Log;
    const topicA = `0x${'01'.repeat(32)}`;
    const topicB = `0x${'02'.repeat(32)}`;
    expect(decodeEvmLogs([strange(topicA)], SCOPE, 'hardhat-local')).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain(topicA);
    expect(String(warn.mock.calls[0]![0])).toContain(TOKEN);
    decodeEvmLogs([strange(topicB)], SCOPE, 'hardhat-local');
    expect(warn).toHaveBeenCalledTimes(1);
    decodeEvmLogs([strange(topicB)], SCOPE, 'evm');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('ca 5: thiếu blockNumber, logIndex, transactionHash thì bỏ không cảnh báo; thiếu topics[0] thì bỏ và cảnh báo một lần', async () => {
    const { decodeEvmLogs } = await load();
    const transfer = (opts: Parameters<typeof makeLog>[3]) =>
      makeLog(projectTokenAbi as Abi, 'Transfer', { from: ALICE, to: BOB, value: 5n }, opts);
    const missing = [
      transfer({ address: TOKEN, blockNumber: null }),
      transfer({ address: TOKEN, logIndex: null }),
      transfer({ address: TOKEN, transactionHash: null }),
    ];
    expect(decodeEvmLogs(missing, SCOPE, 'hardhat-local')).toEqual([]);
    expect(warn).not.toHaveBeenCalled();

    const noTopic = { ...transfer({ address: TOKEN }), topics: [] } as unknown as Log;
    expect(decodeEvmLogs([noTopic, noTopic], SCOPE, 'hardhat-local')).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('ca 5b: sự kiện đang theo dõi mà data hỏng vẫn được trả, thiếu tham số không indexed, KHÔNG cảnh báo (hành vi hiện tại, QĐ-5)', async () => {
    // Ghi lại hành vi hiện tại để mọi thay đổi sau (strict: true, kiểm tham số) phải sửa test có chủ đích.
    const { decodeEvmLogs } = await load();
    const transfer = makeLog(projectTokenAbi as Abi, 'Transfer', { from: ALICE, to: BOB, value: 5n }, { address: TOKEN });
    const withdrawn = makeLog(spvPaymentVaultAbi as Abi, 'Withdrawn', { to: ALICE, amount: 9n, operator: BOB }, { address: VAULT, logIndex: 1 });
    const broken = [
      { ...transfer, data: '0x1234' as Hex },
      { ...withdrawn, data: '0x' as Hex },
    ];
    const result = decodeEvmLogs(broken, SCOPE, 'hardhat-local');
    expect(result.map((event) => [event.eventName, event.args])).toEqual([
      ['Transfer', { from: normalizeEvmAddress(ALICE), to: normalizeEvmAddress(BOB) }],
      ['Withdrawn', { to: normalizeEvmAddress(ALICE), operator: normalizeEvmAddress(BOB) }],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ca 6: kết quả sắp theo blockNumber rồi logIndex', async () => {
    const { decodeEvmLogs } = await load();
    const transfer = (blockNumber: bigint, logIndex: number) =>
      makeLog(projectTokenAbi as Abi, 'Transfer', { from: ALICE, to: BOB, value: BigInt(logIndex) }, { address: TOKEN, blockNumber, logIndex });
    const result = decodeEvmLogs([transfer(9n, 0), transfer(3n, 5), transfer(3n, 2), transfer(5n, 1)], SCOPE, 'hardhat-local');
    expect(result.map((event) => [event.blockNumber, event.logIndex])).toEqual([
      [3n, 2],
      [3n, 5],
      [5n, 1],
      [9n, 0],
    ]);
  });
});
