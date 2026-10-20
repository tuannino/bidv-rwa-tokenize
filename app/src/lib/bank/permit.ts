import 'server-only';

import { parseSignature, verifyTypedData } from 'viem';
import {
  buildPermitTypedData,
  CHAINS,
  findContractAddress,
  type ChainKey,
  type ContractName,
  type PermitTypedData,
} from '@bidv/shared';
import { getLedger, LedgerError, normalizeEvmAddress } from '@/lib/ledger';
import type { PermitDomain, PermitToken, SettlementPermit } from '@/lib/ledger';
import type { OrderSide } from './purchase.state';

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

/**
 * Chain dùng chữ ký permit khi đặt lệnh (FE-05): chuỗi EVM thật (`hardhat-local`, `evm`). Mock giữ
 * hành vi cũ (không ký); stellar chưa có cơ chế tương đương.
 */
export function isPermitChain(chain: ChainKey): boolean {
  return CHAINS[chain].family === 'evm';
}

/** Token được ủy quyền theo chiều lệnh: lệnh mua chi VNDB, lệnh bán chi WPT. */
export const permitTokenOf = (side: OrderSide): PermitToken => (side === 'BUY' ? 'payment' : 'project');

/** Bên được chi (`spender`): địa chỉ `OrderSettlement` trong address book, không nhận từ trình duyệt. */
export function settlementSpender(chain: ChainKey): `0x${string}` {
  const address = findContractAddress(chain, 'OrderSettlement');
  if (!address) {
    throw new LedgerError(
      chain,
      'preparePermit',
      `Chain "${chain}" chưa có địa chỉ OrderSettlement trong address book; chưa đặt lệnh bằng chữ ký được. ` +
        'Triển khai bộ hợp đồng có OrderSettlement rồi nạp lại địa chỉ.',
    );
  }
  return normalizeEvmAddress(address) as `0x${string}`;
}

export interface OrderPermitMessage {
  chain: ChainKey;
  side: OrderSide;
  owner: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

/**
 * Typed data ERC-2612 của một lệnh: domain đọc và kiểm từ chuỗi, `token`/`spender` theo chiều lệnh
 * và address book. Dùng CHUNG cho lúc chuẩn bị (trả cho ví ký) và lúc kiểm (dựng lại để so), nên
 * hai bên không thể dựng hai bản khác nhau.
 */
export async function buildOrderPermitTypedData(message: OrderPermitMessage): Promise<{
  token: `0x${string}`;
  spender: `0x${string}`;
  typedData: PermitTypedData;
}> {
  const token = permitTokenOf(message.side);
  const spender = settlementSpender(message.chain);
  const domain = await readPermitDomain(message.chain, token);
  const typedData = buildPermitTypedData({
    tokenName: domain.name,
    version: domain.version,
    chainId: domain.chainId,
    verifyingContract: domain.verifyingContract,
    owner: normalizeEvmAddress(message.owner) as `0x${string}`,
    spender,
    value: message.value,
    nonce: message.nonce,
    deadline: message.deadline,
  });
  return { token: domain.verifyingContract, spender, typedData };
}

/**
 * Kiểm chữ ký với typed data dựng lại (FE-05 QĐ-D bước 3): địa chỉ khôi phục phải đúng
 * `typedData.message.owner`. Chữ ký sai khuôn (không khôi phục được) cũng là "không khớp".
 */
export async function verifyOrderPermitSignature(
  typedData: PermitTypedData,
  signature: `0x${string}`,
): Promise<boolean> {
  try {
    return await verifyTypedData({
      address: typedData.message.owner,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
      signature,
    });
  } catch {
    return false;
  }
}

/** Tách chữ ký 65 byte thành `v, r, s` cho `OrderSettlement.buyWithPermit`. */
export function splitPermitSignature(signature: `0x${string}`): Pick<SettlementPermit, 'v' | 'r' | 's'> {
  const { r, s, v, yParity } = parseSignature(signature);
  return { r, s, v: v === undefined ? yParity + 27 : Number(v) };
}
