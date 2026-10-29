import 'server-only';

import { isChainKey, type ChainKey } from '@bidv/shared';
import { sha256, toBytes } from 'viem';
import { chainFamily } from '@/lib/chains/registry';
import { serverEnv } from '@/lib/config/env';

/**
 * IN-04: cấu hình Lưu ký Fireblocks (Vault Account), đọc từ biến môi trường đã kiểm ở `config/env.ts`.
 *
 * Hai phần đọc ĐỘC LẬP (requirements A2):
 * - `fireblocksConfig()`: khoá API, khoá riêng RSA, vault. Thiếu hay sai là `config: null` kèm lý do.
 * - `fireblocksChainScope()`: bảng `chain:assetId`, nguồn DUY NHẤT của bảng chain. Đọc được cả khi
 *   thiếu khoá, để công tắc đang bật mà thiếu khoá vẫn chặn đúng lần duyệt (QĐ-13).
 *
 * Câu lý do KHÔNG BAO GIỜ chứa khoá: chỉ nêu trường nào thiếu hay sai dạng.
 */

export interface FireblocksConfig {
  baseUrl: string;
  /** Bí mật. Chỉ khách REST đọc. */
  apiKey: string;
  /** Bí mật: PEM PKCS#8. Chỉ khách REST đọc. */
  privateKeyPem: string;
  vaultId: string;
  /** Địa chỉ EVM của vault (người gửi giao dịch trên chuỗi). */
  vaultAddress: string;
  /** 16 ký tự hex đầu của SHA-256(`baseUrl|apiKey`): nhận ra cấu hình đã đổi, không lộ khoá (QĐ-14). */
  configRef: string;
}

export type FireblocksConfigRead =
  | { config: FireblocksConfig; reason: null }
  | { config: null; reason: string };

export type FireblocksChainScope =
  | { ok: true; chainAssets: Partial<Record<ChainKey, string>> }
  | { ok: false; reason: string };

const PEM_HEADER = '-----BEGIN PRIVATE KEY-----';
const PEM_FOOTER = '-----END PRIVATE KEY-----';
const PKCS1_HEADER = '-----BEGIN RSA PRIVATE KEY-----';

/** Lý do PEM không dùng được, hoặc `null` khi đúng dạng PKCS#8 base64. Không trả lại nội dung khoá. */
export function pemProblem(pem: string): string | null {
  if (pem.includes(PKCS1_HEADER)) {
    return 'FIREBLOCKS_SECRET_KEY là khoá dạng PKCS#1 (BEGIN RSA PRIVATE KEY); đổi sang PKCS#8 bằng openssl pkcs8 -topk8 -nocrypt.';
  }
  const start = pem.indexOf(PEM_HEADER);
  const end = pem.indexOf(PEM_FOOTER);
  if (start < 0 || end < start) {
    return 'FIREBLOCKS_SECRET_KEY không phải khoá PEM PKCS#8 (thiếu dòng BEGIN PRIVATE KEY hoặc END PRIVATE KEY).';
  }
  const body = pem.slice(start + PEM_HEADER.length, end).replace(/\s+/g, '');
  if (body.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body) || body.length % 4 !== 0) {
    return 'FIREBLOCKS_SECRET_KEY có phần thân không phải base64 hợp lệ.';
  }
  return null;
}

/** Phần thân DER của khoá PKCS#8 (người gọi đã kiểm bằng `pemProblem`). */
export function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const start = pem.indexOf(PEM_HEADER) + PEM_HEADER.length;
  const body = pem.slice(start, pem.indexOf(PEM_FOOTER)).replace(/\s+/g, '');
  const binary = atob(body);
  const der = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) der[i] = binary.charCodeAt(i);
  return der;
}

export const configRefOf = (baseUrl: string, apiKey: string): string =>
  sha256(toBytes(`${baseUrl}|${apiKey}`)).slice(2, 18);

let override: { config: FireblocksConfig | null; chainAssets?: Partial<Record<ChainKey, string>> } | null = null;

/**
 * CHỈ dùng trong test (requirements B4): thay cấu hình đọc từ biến môi trường. Có `chainAssets` thì
 * bảng chain lấy đúng bảng đó, KHÔNG qua bước kiểm họ EVM (test đưa được `mock` vào). `null` là bỏ ghi đè.
 */
export function setFireblocksConfigForTest(
  value: { config: FireblocksConfig | null; chainAssets?: Partial<Record<ChainKey, string>> } | null,
): void {
  override = value;
}

export function fireblocksConfig(): FireblocksConfigRead {
  if (override) {
    return override.config
      ? { config: override.config, reason: null }
      : { config: null, reason: 'Chưa cấu hình Fireblocks (ghi đè trong test).' };
  }
  const env = serverEnv();
  const missing = [
    env.fireblocksApiKey ? null : 'FIREBLOCKS_API_KEY',
    env.fireblocksSecretKey ? null : 'FIREBLOCKS_SECRET_KEY',
    env.fireblocksVaultId ? null : 'FIREBLOCKS_VAULT_ID',
    env.fireblocksVaultAddress ? null : 'FIREBLOCKS_VAULT_ADDRESS',
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) return { config: null, reason: `Thiếu ${missing.join(', ')}.` };

  const apiKey = env.fireblocksApiKey as string;
  const privateKeyPem = env.fireblocksSecretKey as string;
  const vaultAddress = env.fireblocksVaultAddress as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(vaultAddress)) {
    return { config: null, reason: 'FIREBLOCKS_VAULT_ADDRESS không phải địa chỉ EVM (0x và 40 ký tự hex).' };
  }
  const problem = pemProblem(privateKeyPem);
  if (problem) return { config: null, reason: problem };

  return {
    config: {
      baseUrl: env.fireblocksBaseUrl,
      apiKey,
      privateKeyPem,
      vaultId: env.fireblocksVaultId as string,
      vaultAddress,
      configRef: configRefOf(env.fireblocksBaseUrl, apiKey),
    },
    reason: null,
  };
}

/**
 * Bảng chain dùng Fireblocks (requirements A2): MỌI phần tử phải đúng dạng `chain:assetId`, chain là
 * ChainKey họ EVM, không trùng chain. CHỈ MỘT phần tử sai là cả bảng `ok: false`: không bỏ phần tử sai
 * rồi dùng phần còn lại, vì như vậy chain bị gõ sai sẽ âm thầm quay về khoá máy chủ.
 */
export function fireblocksChainScope(): FireblocksChainScope {
  if (override?.chainAssets) return { ok: true, chainAssets: { ...override.chainAssets } };
  return parseChainAssets(serverEnv().fireblocksChainAssets);
}

export function parseChainAssets(raw: string): FireblocksChainScope {
  const text = raw.trim();
  if (text === '') return { ok: true, chainAssets: {} };
  const chainAssets: Partial<Record<ChainKey, string>> = {};
  for (const item of text.split(',')) {
    const entry = item.trim();
    const match = /^([^:\s]+):([^:\s]+)$/.exec(entry);
    if (!match) {
      return { ok: false, reason: `phần tử "${entry}" không đúng dạng chain:assetId` };
    }
    const [, chain, assetId] = match;
    if (!isChainKey(chain) || chainFamily(chain) !== 'evm') {
      return { ok: false, reason: `"${chain}" không phải chain họ EVM` };
    }
    if (chainAssets[chain] !== undefined) {
      return { ok: false, reason: `chain "${chain}" lặp lại` };
    }
    chainAssets[chain] = assetId;
  }
  return { ok: true, chainAssets };
}
