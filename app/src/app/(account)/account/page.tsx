import { AppLayout } from '@/components/layout/app-layout';
import { AccountInfoPage } from '@/components/pages/account-info';
import { AccountWalletProvider } from '@/components/pages/account-wallet';
import { getOwnAccountProfile } from '@/lib/bank/account-profile.service';

export default async function AccountPage() {
  const result = await getOwnAccountProfile();

  return (
    <AppLayout breadcrumbs={[{ label: 'Thông tin tài khoản' }]}>
      {result.ok ? (
        result.data.kind === 'CUSTOMER' ? (
          // FIX-01 F3: chỉ vai khách hàng có ví thanh toán; ô ví đọc một action qua provider.
          <AccountWalletProvider>
            <div className="space-y-6">
              <AccountInfoPage profile={result.data} />
            </div>
          </AccountWalletProvider>
        ) : (
          <div className="space-y-6">
            <AccountInfoPage profile={result.data} />
          </div>
        )
      ) : (
        <div className="space-y-2 py-6">
          <h1 className="text-xl font-semibold text-foreground">Thông tin tài khoản</h1>
          <p role="alert" className="text-sm text-bad-ink">{result.error}</p>
        </div>
      )}
    </AppLayout>
  );
}
