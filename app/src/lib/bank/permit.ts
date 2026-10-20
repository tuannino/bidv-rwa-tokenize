import 'server-only';

import { CHAINS, findContractAddress, type ChainKey, type ContractName } from '@bidv/shared';
import { getLedger, LedgerError, normalizeEvmAddress } from '@/lib/ledger';
import type { PermitDomain, PermitToken } from '@/lib/ledger';

/**
 * Domain EIP-712 của token nhận chữ ký permit (FE-05 QĐ-B).
 *
 * Đọc từ `eip712Domain()` (ERC-5267) trên chuỗi rồi KIỂM KHUÔN, không đoán. Một domain sai là chữ
 * ký hợp lệ về mặt mật mã nhưng hợp đồng không nhận: `permit` thất bại im lặng trong
 * `OrderSettlement._permit` và lệnh trượt ở bước chuyển tiền. Chặn ở đây thì lỗi hiện ra trước khi
 * nhà đầu tư ký, kèm nguyên nhân.
 */
export interface VerifiedPermitDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

/** `fields = 0x0f`: name, version, chainId, verifyingContract. Không salt, không extension. */
const SUPPORTED_FIELDS = 0x0f;

const ZERO_SALT = `0x${'0'.repeat(64)}`;

/** Hợp đồng token theo chiều lệnh: VNDB cho lệnh mua, WPT cho lệnh bán. */
export const PERMIT_TOKEN_CONTRACT: Record<PermitToken, ContractName> = {
  payment: 'VNDToken',
  project: 'ProjectToken',
};

/** Địa chỉ token trong address book; thiếu thì lỗi cấu hình, không dựng typed data. */
export function permitTokenAddress(chain: ChainKey, token: PermitToken): `0x${string}` {
  const address = findContractAddress(chain, PERMIT_TOKEN_CONTRACT[token]);
  if (!address) {
    throw new LedgerError(
      chain,
      'permitDomain',
      `Chain "${chain}" chưa có địa chỉ ${PERMIT_TOKEN_CONTRACT[token]} trong address book; ` +
        'chưa dựng được chữ ký ủy quyền.',
    );
  }
  return normalizeEvmAddress(address) as `0x${string}`;
}

/**
 * Kiểm một domain thô theo khuôn hỗ trợ. Thuần, tách khỏi phép đọc chuỗi để kiểm thử được từng
 * điều kiện bằng domain giả (ca 1b).
 */
export function assertSupportedPermitDomain(
  chain: ChainKey,
  token: PermitToken,
  domain: PermitDomain,
): VerifiedPermitDomain {
  const expectedChainId = CHAINS[chain].chainId;
  const expectedContract = permitTokenAddress(chain, token);
  const problems: string[] = [];

  if (Number.parseInt(domain.fields, 16) !== SUPPORTED_FIELDS) {
    problems.push(`fields = ${domain.fields}, cần 0x0f`);
  }
  if (domain.salt.toLowerCase() !== ZERO_SALT) problems.push('salt khác 0');
  if (domain.extensions.length > 0) problems.push('extensions không rỗng');
  if (expectedChainId === undefined || domain.chainId !== BigInt(expectedChainId)) {
    problems.push(`chainId = ${domain.chainId}, cấu hình chain là ${expectedChainId ?? 'không có'}`);
  }
  if (domain.verifyingContract.toLowerCase() !== expectedContract.toLowerCase()) {
    problems.push(`verifyingContract = ${domain.verifyingContract}, address book là ${expectedContract}`);
  }
  if (!domain.name || !domain.version) problems.push('thiếu name hoặc version');

  if (problems.length > 0 || expectedChainId === undefined) {
    throw new LedgerError(
      chain,
      'permitDomain',
      `Domain permit của token ${PERMIT_TOKEN_CONTRACT[token]} không đúng khuôn hỗ trợ: ` +
        `${problems.join('; ')}. Không dựng chữ ký ủy quyền cho token này.`,
    );
  }
  return {
    name: domain.name,
    version: domain.version,
    chainId: expectedChainId,
    verifyingContract: expectedContract,
  };
}

/** Đọc domain từ chuỗi rồi kiểm khuôn (FE-05 QĐ-B). */
export async function readPermitDomain(
  chain: ChainKey,
  token: PermitToken,
): Promise<VerifiedPermitDomain> {
  return assertSupportedPermitDomain(chain, token, await getLedger(chain).permitDomain(token));
}
