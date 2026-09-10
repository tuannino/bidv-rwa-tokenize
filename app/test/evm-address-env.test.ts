import { afterEach, describe, expect, it } from 'vitest';
import { CONTRACT_NAMES, addressEnvKey, findContractAddress } from '@bidv/shared';

/**
 * Tên biến môi trường nạp địa chỉ contract cho chain `evm` phải khớp CHÍNH XÁC những gì
 * `.env.example` và docs/TESTNET_SEPOLIA.md hướng dẫn.
 *
 * Vì sao đáng test: đặt sai một ký tự (vd `..._VNDTOKEN` thay vì `..._VND_TOKEN`) thì
 * `findContractAddress` âm thầm trả undefined -> app báo "chưa deploy" trong khi đã deploy rồi.
 * Đây là loại lỗi rất tốn thời gian truy trên testnet.
 */
const DOCUMENTED_KEYS: Record<string, string> = {
  ProjectToken: 'NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN',
  VNDToken: 'NEXT_PUBLIC_ADDR_EVM_VND_TOKEN',
  ProfitDistributor: 'NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR',
  Redemption: 'NEXT_PUBLIC_ADDR_EVM_REDEMPTION',
};

const TOUCHED: string[] = [];

afterEach(() => {
  for (const key of TOUCHED.splice(0)) delete process.env[key];
});

describe('nạp địa chỉ contract cho chain evm qua biến môi trường', () => {
  it('addressEnvKey sinh đúng tên biến đã ghi trong .env.example', () => {
    for (const [contract, expected] of Object.entries(DOCUMENTED_KEYS)) {
      expect(addressEnvKey('evm', contract as never), contract).toBe(expected);
    }
  });

  it('mọi contract trong CONTRACT_NAMES đều có tên biến evm (không sót)', () => {
    for (const contract of CONTRACT_NAMES) {
      const key = addressEnvKey('evm', contract);
      expect(key.startsWith('NEXT_PUBLIC_ADDR_EVM_'), contract).toBe(true);
      // Không được sinh ra khoảng trắng hay ký tự lạ -> phải là tên biến môi trường hợp lệ.
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('env THẮNG addresses.json cho chain evm', () => {
    const key = DOCUMENTED_KEYS.ProjectToken;
    // Chưa deploy evm nên addresses.json không có -> chưa đặt env thì phải undefined.
    expect(findContractAddress('evm', 'ProjectToken')).toBeUndefined();

    process.env[key] = '0x1111111111111111111111111111111111111111';
    TOUCHED.push(key);
    expect(findContractAddress('evm', 'ProjectToken')).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });

  it('không rò địa chỉ evm sang hardhat-local và ngược lại', () => {
    process.env[DOCUMENTED_KEYS.ProjectToken] = '0x2222222222222222222222222222222222222222';
    TOUCHED.push(DOCUMENTED_KEYS.ProjectToken);

    // hardhat-local vẫn phải lấy địa chỉ tất định của nó từ addresses.json.
    expect(findContractAddress('hardhat-local', 'ProjectToken')).not.toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });
});
