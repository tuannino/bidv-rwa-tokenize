'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { bindProfileWalletAction, listWalletBindingsAction } from '@/app/actions/wallet-binding';
import type { WalletBindingListView } from '@/lib/bank/wallet-binding.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/role-labels';

/**
 * Màn **Định danh ví** (FIX-01 B1 tới B4), chỉ Giao dịch viên: định danh ví trên chuỗi và gắn ví cho
 * hồ sơ khách hàng trong MỘT thao tác. Mở màn gọi đúng một action (danh sách ví đã gắn, kèm danh sách
 * hồ sơ cho ô chọn); mọi kiểm tra nằm ở máy chủ.
 */

type Feedback = { tone: 'ok' | 'error'; message: string };

export function WalletBindingPage() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${chain}|${reloadKey}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    chain: ChainKey;
    data: WalletBindingListView | null;
    error: string | null;
  } | null>(null);
  const [actorId, setActorId] = useState('');
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listWalletBindingsAction({ chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, chain, data: result.data, error: null }
          : { key: requestKey, chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, requestKey]);

  // Giữ số liệu cũ cùng chain trong lúc tải lại sau khi gắn; đổi chain thì bỏ hẳn.
  const fresh = loaded?.chain === chain ? loaded : null;
  const data = fresh?.data ?? null;
  const profiles = data?.profiles ?? [];
  const selectedActor = actorId || profiles[0]?.actorId || '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const submittedChain = chain;
    setBusy(true);
    setFeedback(null);
    const result = await bindProfileWalletAction({ chain: submittedChain, actorId: selectedActor, wallet: wallet.trim() });
    setBusy(false);
    if (result.ok) {
      const { binding, txHash, created } = result.data;
      setFeedback({
        tone: 'ok',
        message:
          `${created ? 'Đã định danh và gắn' : 'Ví đã được gắn từ trước cho'} ví ${binding.wallet} cho hồ sơ ` +
          `${binding.actorId} (${binding.profileName}). ` +
          (txHash ? `Mã giao dịch định danh: ${txHash}.` : 'Ví đã whitelist từ trước, không gửi giao dịch.'),
      });
      setWallet('');
      setReloadKey((value) => value + 1);
    } else {
      setFeedback({ tone: 'error', message: result.error });
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Định danh ví</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <Wallet />
            </CardTitleIcon>
            Gắn ví cho hồ sơ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]" aria-label="Biểu mẫu định danh ví">
            <div className="space-y-1.5">
              <label htmlFor="binding-profile" className="text-sm font-medium">Hồ sơ</label>
              <select
                id="binding-profile"
                value={selectedActor}
                onChange={(event) => setActorId(event.target.value)}
                disabled={busy || profiles.length === 0}
                className={fieldClass}
              >
                {profiles.map((profile) => (
                  <option key={profile.actorId} value={profile.actorId}>
                    {profile.actorId}, {profile.fullName}, {ROLE_LABELS[profile.role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="binding-wallet" className="text-sm font-medium">Địa chỉ ví</label>
              <input
                id="binding-wallet"
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="0x…"
                spellCheck={false}
                disabled={busy}
                className={`${fieldClass} font-code`}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || wallet.trim() === '' || selectedActor === ''}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Định danh và gắn ví
              </Button>
            </div>
          </form>
          {feedback && (
            <Alert
              tone={feedback.tone === 'error' ? 'bad' : 'ok'}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              aria-label="Kết quả định danh ví"
              className="break-all"
            >
              {feedback.message}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <ShieldCheck />
            </CardTitleIcon>
            Ví đã định danh
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fresh?.error ? (
            <EmptyState tone="bad" role="alert">{fresh.error}</EmptyState>
          ) : data === null ? (
            <EmptyState loading>Đang tải…</EmptyState>
          ) : data.rows.length === 0 ? (
            <EmptyState>Chưa có ví nào được gắn trên chain này.</EmptyState>
          ) : (
            <Table aria-label="Ví đã định danh">
              <TableHeader>
                <TableRow>
                  <TableHead>Ví</TableHead>
                  <TableHead>Hồ sơ</TableHead>
                  <TableHead>Vai</TableHead>
                  <TableHead>Người gắn</TableHead>
                  <TableHead>Lúc gắn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.wallet} data-wallet={row.wallet}>
                    <TableCell className="break-all font-code text-xs">{row.wallet}</TableCell>
                    <TableCell className="text-xs">
                      {row.actorId}, {row.profileName}
                    </TableCell>
                    <TableCell className="text-xs">{ROLE_LABELS[row.role]}</TableCell>
                    <TableCell className="text-xs">{row.boundBy}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.boundAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data?.truncated && <p className="text-xs text-muted-foreground">Hiện 200 ví gần nhất</p>}
          <p className="text-xs text-muted-foreground">
            Trên mock và hardhat-local, ví mẫu của hồ sơ được coi là đã định danh dù không có trong bảng.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
