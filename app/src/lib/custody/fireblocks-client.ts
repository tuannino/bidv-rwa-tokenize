import 'server-only';

import { fireblocksConfig, pemToDer, type FireblocksConfig } from './fireblocks-config';

/**
 * IN-04: khách REST nhỏ của Fireblocks (QĐ-10): `fetch` và Web Crypto, không SDK. Chỉ ba lời gọi:
 * tạo giao dịch gọi hợp đồng, tra theo `externalTxId`, tra theo mã Fireblocks.
 *
 * Khách CHỈ giữ `baseUrl`, khoá API, khoá RSA. Vault và mã tài sản luôn do người gọi truyền vào từ
 * bối cảnh ký đã ghi trên yêu cầu (requirements B1), không đọc cấu hình toàn cục.
 *
 * Không ghi khoá, JWT, chữ ký vào câu lỗi (QĐ-11).
 */

export interface FireblocksTx {
  id: string;
  status: string;
  subStatus: string | null;
  txHash: string | null;
  externalTxId: string | null;
}

export interface FireblocksClient {
  createContractCall(input: {
    externalTxId: string;
    vaultId: string;
    assetId: string;
    contract: string;
    data: string;
    note: string;
  }): Promise<{ id: string; status: string }>;
  /** `null` CHỈ khi Fireblocks trả HTTP 404 kèm mã 1439 ("No such External Tx ID"); lỗi khác ném. */
  getByExternalTxId(externalTxId: string): Promise<FireblocksTx | null>;
  getById(id: string): Promise<FireblocksTx>;
}

/**
 * Phản hồi khác 2xx. `message` là đúng thông điệp Fireblocks trả (không kèm khoá, JWT); `code` là mã
 * lỗi Fireblocks trong thân (nếu có). `describe()` cho câu đầy đủ kèm HTTP và mã.
 */
export class FireblocksHttpError extends Error {
  readonly status: number;
  readonly code: number | null;
  constructor(status: number, code: number | null, message: string) {
    super(message);
    this.name = 'FireblocksHttpError';
    this.status = status;
    this.code = code;
  }

  describe(): string {
    return `Fireblocks trả HTTP ${this.status}${this.code === null ? '' : `, mã ${this.code}`}: ${this.message}`;
  }
}

/** Lỗi mạng, hết giờ: không biết Fireblocks đã nhận yêu cầu hay chưa. */
export class FireblocksNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FireblocksNetworkError';
  }
}

export const DUPLICATE_EXTERNAL_TX_ID = 1438;
export const NO_SUCH_EXTERNAL_TX_ID = 1439;
/**
 * QĐ-7c: mã từ chối ĐỒNG BỘ khi tạo giao dịch (dữ liệu sai, tài sản sai, vault sai, không đủ quyền,
 * không đủ số dư, địa chỉ sai, xác thực sai): Fireblocks không tạo giao dịch.
 */
export const CREATE_REJECTED_CODES: ReadonlySet<number> = new Set([
  900, 1409, 1502, 1503, 1004, 11001, 1407, 1402, 1404, 1424, 1432, -7, -8,
]);

/**
 * Phân loại lỗi khi tạo giao dịch (QĐ-7c): mã lỗi Fireblocks trước, HTTP sau. Phản hồi 5xx mang mã
 * thuộc nhóm từ chối vẫn là `REJECTED`; 429, 5xx không mã, lỗi mạng, mã lạ là `UNKNOWN`.
 */
export function classifyCreateError(error: unknown): 'DUPLICATE' | 'REJECTED' | 'UNKNOWN' {
  if (!(error instanceof FireblocksHttpError) || error.code === null) return 'UNKNOWN';
  if (error.code === DUPLICATE_EXTERNAL_TX_ID) return 'DUPLICATE';
  if (CREATE_REJECTED_CODES.has(error.code)) return 'REJECTED';
  return 'UNKNOWN';
}

const REQUEST_TIMEOUT_MS = 15_000;
const JWT_LIFETIME_SECONDS = 25;

const encoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Khoá nhập một lần mỗi isolate, theo chính chuỗi PEM (đổi khoá thì nhập lại). */
const importedKeys = new Map<string, Promise<CryptoKey>>();

function signingKey(privateKeyPem: string): Promise<CryptoKey> {
  let key = importedKeys.get(privateKeyPem);
  if (!key) {
    key = crypto.subtle.importKey(
      'pkcs8',
      pemToDer(privateKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    importedKeys.set(privateKeyPem, key);
    // Nhập lỗi thì không giữ lời hứa hỏng: lần sau nhập lại.
    key.catch(() => importedKeys.delete(privateKeyPem));
  }
  return key;
}

/**
 * JWT RS256 cho MỘT yêu cầu (requirements B2): `uri` là đường dẫn kể cả `/v1` và chuỗi truy vấn,
 * `bodyHash` là SHA-256 hex của ĐÚNG chuỗi thân gửi đi (chuỗi rỗng với GET).
 */
export async function signJwt(
  auth: { apiKey: string; privateKeyPem: string },
  path: string,
  body: string,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    uri: path,
    nonce: crypto.randomUUID(),
    iat,
    exp: iat + JWT_LIFETIME_SECONDS,
    sub: auth.apiKey,
    bodyHash: hex(await crypto.subtle.digest('SHA-256', encoder.encode(body))),
  };
  const signingInput =
    `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await signingKey(auth.privateKeyPem),
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

function toTx(raw: unknown): FireblocksTx {
  const value = (raw ?? {}) as Record<string, unknown>;
  const id = text(value.id);
  const status = text(value.status);
  if (!id || !status) {
    throw new FireblocksHttpError(200, null, 'phản hồi không có id hoặc status của giao dịch.');
  }
  return {
    id,
    status,
    subStatus: text(value.subStatus),
    txHash: text(value.txHash),
    externalTxId: text(value.externalTxId),
  };
}

/** Mã lỗi Fireblocks trong thân phản hồi; chuỗi số thì đổi sang số. */
function errorCodeOf(body: Record<string, unknown>): number | null {
  const raw = body.code;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

export function createFireblocksClient(
  config: Pick<FireblocksConfig, 'baseUrl' | 'apiKey' | 'privateKeyPem'>,
  fetchImpl: typeof fetch = fetch,
): FireblocksClient {
  const call = async (method: 'GET' | 'POST', path: string, payload?: unknown): Promise<unknown> => {
    // Dựng thân MỘT lần: cùng chuỗi này vừa băm vào JWT vừa gửi đi.
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const token = await signJwt(config, path, body);
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          'X-API-Key': config.apiKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? body : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      throw new FireblocksNetworkError(
        name === 'TimeoutError' || name === 'AbortError'
          ? `Fireblocks không trả lời trong ${REQUEST_TIMEOUT_MS / 1000} giây (${method} ${path}).`
          : `Không gọi được Fireblocks (${method} ${path}): ${name}.`,
      );
    }
    const raw = await response.text().catch(() => '');
    let parsed: unknown = null;
    try {
      parsed = raw === '' ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      const errorBody = (parsed ?? {}) as Record<string, unknown>;
      const message = text(errorBody.message)?.slice(0, 300) ?? response.statusText ?? 'không có thông điệp';
      throw new FireblocksHttpError(response.status, errorCodeOf(errorBody), message);
    }
    return parsed;
  };

  return {
    async createContractCall({ externalTxId, vaultId, assetId, contract, data, note }) {
      // KHÔNG gửi `Idempotency-Key` (QĐ-7): lời gọi tạo giao dịch chống trùng bằng `externalTxId`.
      const created = (await call('POST', '/v1/transactions', {
        operation: 'CONTRACT_CALL',
        assetId,
        amount: '0',
        source: { type: 'VAULT_ACCOUNT', id: vaultId },
        destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: contract } },
        extraParameters: { contractCallData: data },
        externalTxId,
        note,
      })) as Record<string, unknown> | null;
      const id = text(created?.id);
      if (!id) throw new FireblocksHttpError(200, null, 'phản hồi tạo giao dịch không có id.');
      return { id, status: text(created?.status) ?? 'SUBMITTED' };
    },

    async getByExternalTxId(externalTxId) {
      try {
        return toTx(await call('GET', `/v1/transactions/external_tx_id/${encodeURIComponent(externalTxId)}`));
      } catch (error) {
        if (error instanceof FireblocksHttpError && error.status === 404 && error.code === NO_SUCH_EXTERNAL_TX_ID) {
          return null;
        }
        throw error;
      }
    },

    async getById(id) {
      return toTx(await call('GET', `/v1/transactions/${encodeURIComponent(id)}`));
    },
  };
}

let clientOverride: FireblocksClient | null = null;

/** CHỈ dùng trong test: thay khách thật bằng khách giả. `null` là bỏ ghi đè. */
export function setFireblocksClientForTest(client: FireblocksClient | null): void {
  clientOverride = client;
}

/** Khách theo cấu hình hiện tại. Thiếu cấu hình là lỗi lập trình: người gọi phải kiểm trước. */
export function getFireblocksClient(): FireblocksClient {
  if (clientOverride) return clientOverride;
  const { config, reason } = fireblocksConfig();
  if (!config) throw new Error(`Lỗi lập trình: gọi khách Fireblocks khi chưa cấu hình (${reason}).`);
  return createFireblocksClient(config);
}
