'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { CHAINS, type ChainKey } from '@bidv/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProfileWalletAction, linkProfileWalletAction } from '@/app/actions/account';
import type { ProfileWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatDateTime } from '@/lib/format';

const INPUT =
  'w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const NO_WALLET = 'Chưa có ví thanh toán trên chain này';

interface ProfileWalletState {
  chain: ChainKey;
  /** `null` khi đang đọc ví của chain đang chọn. */
  result: Result<ProfileWalletView> | null;
  setResult: (result: Result<ProfileWalletView>) => void;
}

const ProfileWalletContext = createContext<ProfileWalletState | null>(null);

/**
 * "Ví thanh toán" của trang tài khoản (OP-05 QĐ-I, UIUX-01 F1), chỉ cho vai khách hàng.
 *
 * Ô "Ví thanh toán" ở khối hồ sơ và khối ví bên dưới cùng đọc từ MỘT lần gọi `getProfileWalletAction`
 * mỗi chain, giữ trong context này; lưu xong thì cập nhật context nên cả hai chỗ đổi theo. Liên kết
 * không whitelist trên chuỗi và không chứng minh quyền sở hữu ví.
 */
export function ProfileWalletProvider({ children }: { children: React.ReactNode }) {
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<{ chain: ChainKey; result: Result<ProfileWalletView> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProfileWalletAction({ chain }).then((result) => {
      if (!cancelled) setLoaded({ chain, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const value: ProfileWalletState = {
    chain,
    result: loaded?.chain === chain ? loaded.result : null,
    setResult: (result) => setLoaded({ chain, result }),
  };
  return <ProfileWalletContext.Provider value={value}>{children}</ProfileWalletContext.Provider>;
}

/** Ví hiệu lực trên chain đang chọn (QĐ-4). Không có provider (dựng ở máy chủ, test) thì "Đang đọc…". */
export function PaymentWalletValue() {
  const state = useContext(ProfileWalletContext);
  if (!state?.result) return <span className="text-muted-foreground">Đang đọc…</span>;
  if (!state.result.ok) return <span className="text-destructive">{state.result.error}</span>;
  const { linked, effective } = state.result.data;
  const wallet = linked ?? effective;
  return wallet ? (
    <span className="break-all font-mono text-xs" data-payment-wallet>{wallet}</span>
  ) : (
    <span className="text-muted-foreground">{NO_WALLET}</span>
  );
}

export function ProfileWalletCard() {
  const state = useContext(ProfileWalletContext);
  const { address } = useAccount();
  const [draft, setDraft] = useState<{ chain: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  if (!state) return null;

  const { chain, result, setResult } = state;
  const view = result?.ok ? result.data : null;
  // Ô nhập luôn để trống khi mở và sau khi lưu xong: ví hiện hành đã hiện ở ô "Ví thanh toán".
  const value = draft?.chain === chain ? draft.value : '';

  async function save() {
    setBusy(true);
    setMessage(null);
    const saved = await linkProfileWalletAction({ chain, wallet: value });
    setBusy(false);
    if (saved.ok) {
      setResult(saved);
      setDraft(null);
      setMessage({ tone: 'ok', text: `Đã lưu ví thanh toán ${saved.data.linked} trên chain ${CHAINS[chain].label}.` });
    } else {
      setMessage({ tone: 'error', text: saved.error });
    }
  }

  return (
    <Card aria-label="Ví thanh toán">
      <CardHeader className="border-b border-border">
        <CardTitle role="heading" aria-level={2}>Ví thanh toán trên chain {CHAINS[chain].label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Đang đọc ví thanh toán…</p>
        ) : !view ? (
          <p role="alert" className="text-sm text-destructive">{result.ok ? '' : result.error}</p>
        ) : (
          <>
            {view.updatedAt && (
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Cập nhật lúc</dt>
                  <dd className="mt-1 text-sm">{formatDateTime(view.updatedAt)}</dd>
                </div>
              </dl>
            )}
            <div className="space-y-1.5">
              <label htmlFor="profile-wallet" className="text-sm font-medium">Dùng địa chỉ ví mới</label>
              <input
                id="profile-wallet"
                value={value}
                onChange={(event) => setDraft({ chain, value: event.target.value })}
                placeholder="0x…"
                spellCheck={false}
                className={INPUT}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!address || busy}
                onClick={() => address && setDraft({ chain, value: address })}
              >
                Dùng ví đang kết nối
              </Button>
              <Button type="button" disabled={busy || value.trim() === ''} onClick={() => void save()}>
                {busy ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lưu chỉ ghi ví vào hồ sơ để app so với ví bạn kết nối khi đặt lệnh. Ví vẫn phải được ngân
              hàng đưa vào danh sách được phép trên chuỗi.
            </p>
          </>
        )}
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={
              message.tone === 'error'
                ? 'rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'
                : 'rounded-md border border-primary/30 bg-primary/10 p-3 text-sm'
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
