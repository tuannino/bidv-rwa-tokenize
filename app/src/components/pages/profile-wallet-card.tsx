'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { CHAINS } from '@bidv/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProfileWalletAction, linkProfileWalletAction } from '@/app/actions/account';
import type { ProfileWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatDateTime } from '@/lib/format';

const INPUT =
  'w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Mục "Ví liên kết trên chain" của trang tài khoản (OP-05 QĐ-I), chỉ cho vai khách hàng.
 *
 * Chain là lựa chọn phía trình duyệt nên khối này tự đọc ví liên kết bằng MỘT action khi mở hoặc khi
 * đổi chain. Liên kết không whitelist trên chuỗi và không chứng minh quyền sở hữu ví.
 */
export function ProfileWalletCard() {
  const { chain } = useSelectedChain();
  const { address } = useAccount();
  const [loaded, setLoaded] = useState<{ chain: string; result: Result<ProfileWalletView> } | null>(null);
  const [draft, setDraft] = useState<{ chain: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProfileWalletAction({ chain }).then((result) => {
      if (!cancelled) setLoaded({ chain, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const result = loaded?.chain === chain ? loaded.result : null;
  const view = result?.ok ? result.data : null;
  const value = draft?.chain === chain ? draft.value : (view?.linked ?? '');

  async function save() {
    setBusy(true);
    setMessage(null);
    const saved = await linkProfileWalletAction({ chain, wallet: value });
    setBusy(false);
    if (saved.ok) {
      setLoaded({ chain, result: saved });
      setDraft(null);
      setMessage({ tone: 'ok', text: `Đã liên kết ví ${saved.data.linked} trên chain ${chain}.` });
    } else {
      setMessage({ tone: 'error', text: saved.error });
    }
  }

  return (
    <Card aria-label="Ví liên kết">
      <CardHeader className="border-b border-border">
        <CardTitle role="heading" aria-level={2}>Ví liên kết trên chain {CHAINS[chain].label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Đang đọc ví liên kết…</p>
        ) : !view ? (
          <p role="alert" className="text-sm text-destructive">{result.ok ? '' : result.error}</p>
        ) : (
          <>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Ví đang liên kết</dt>
                <dd className="mt-1 break-all font-mono text-xs" data-linked-wallet>
                  {view.linked ?? (view.effective ? `chưa liên kết (đang dùng ví mẫu ${view.effective})` : 'chưa liên kết')}
                </dd>
              </div>
              {view.updatedAt && (
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Cập nhật lúc</dt>
                  <dd className="mt-1 text-sm">{formatDateTime(view.updatedAt)}</dd>
                </div>
              )}
            </dl>
            <div className="space-y-1.5">
              <label htmlFor="profile-wallet" className="text-sm font-medium">Địa chỉ ví</label>
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
              Liên kết chỉ ghi ví vào hồ sơ để app so với ví bạn kết nối khi đặt lệnh. Ví vẫn phải được ngân
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
