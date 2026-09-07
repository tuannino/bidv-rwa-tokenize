import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectTokenAbi, vndTokenAbi } from '@bidv/shared';

/**
 * Chốt an toàn cho quyết định "ABI tối giản viết tay".
 *
 * ABI trong `packages/shared/src/abi/` chỉ giữ những hàm cần dùng, để bundle edge gọn.
 * Cái giá là ABI có thể LỆCH với contract mà không ai biết, và lệch ABI thì lỗi chỉ lộ
 * ra lúc runtime dưới dạng "function not found" rất khó truy.
 *
 * Test này đối chiếu từng chữ ký với ABI đầy đủ mà deploy script xuất ra
 * (`packages/shared/generated/*.abi.json`, sinh từ artifact Hardhat).
 * Sửa contract mà quên sửa ABI tối giản -> test này đỏ.
 */

const GENERATED_DIR = path.resolve(__dirname, '../../packages/shared/generated');

interface AbiParameter {
  type: string;
  components?: AbiParameter[];
}
interface AbiEntry {
  type: string;
  name?: string;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: string;
}

/** `mint(address,uint256)` — đủ để phát hiện lệch tên/kiểu tham số. */
function signature(entry: AbiEntry): string {
  const inputs = (entry.inputs ?? []).map((input) => input.type).join(',');
  return `${entry.type} ${entry.name}(${inputs})`;
}

function loadGenerated(contract: string): AbiEntry[] {
  const file = path.join(GENERATED_DIR, `${contract}.abi.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as AbiEntry[];
  } catch {
    throw new Error(
      `Không đọc được ${file}. Sinh lại bằng: ` +
        `cd packages/contracts-evm && npx hardhat run scripts/deploy.js --network localhost`,
    );
  }
}

describe.each([
  ['ProjectToken', projectTokenAbi as unknown as AbiEntry[]],
  ['VNDToken', vndTokenAbi as unknown as AbiEntry[]],
])('ABI tối giản %s khớp contract thật', (contract, minimalAbi) => {
  const generated = loadGenerated(contract);
  const generatedSignatures = new Set(generated.map(signature));

  it('mọi chữ ký trong ABI tối giản đều tồn tại trong contract', () => {
    const missing = minimalAbi.map(signature).filter((sig) => !generatedSignatures.has(sig));
    expect(missing, `Chữ ký không có trong ${contract}.sol`).toEqual([]);
  });

  it('kiểu trả về của hàm view khớp contract', () => {
    const byName = new Map(generated.filter((e) => e.type === 'function').map((e) => [signature(e), e]));

    for (const entry of minimalAbi.filter((e) => e.type === 'function')) {
      const real = byName.get(signature(entry));
      expect(real, `thiếu ${signature(entry)}`).toBeDefined();
      expect(
        (entry.outputs ?? []).map((o) => o.type),
        `outputs của ${entry.name}`,
      ).toEqual((real!.outputs ?? []).map((o) => o.type));
      expect(entry.stateMutability, `stateMutability của ${entry.name}`).toBe(real!.stateMutability);
    }
  });
});
