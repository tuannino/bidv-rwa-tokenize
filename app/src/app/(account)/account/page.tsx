import { AppLayout } from '@/components/layout/app-layout';
import { AccountInfoPage } from '@/components/pages/account-info';
import { ProfileWalletCard, ProfileWalletProvider } from '@/components/pages/profile-wallet';
import { getOwnAccountProfile } from '@/lib/bank/account-profile.service';

export default async function AccountPage() {
  const result = await getOwnAccountProfile();

  return (
    <AppLayout breadcrumbs={[{ label: 'Thông tin tài khoản' }]}>
      {result.ok ? (
        result.data.kind === 'CUSTOMER' ? (
          // OP-05 QĐ-I, UIUX-01 F1: chỉ vai khách hàng có ví thanh toán; hai chỗ hiện ví đọc chung một action.
          <ProfileWalletProvider>
            <div className="space-y-6">
              <AccountInfoPage profile={result.data} />
              <ProfileWalletCard />
            </div>
          </ProfileWalletProvider>
        ) : (
          <div className="space-y-6">
            <AccountInfoPage profile={result.data} />
          </div>
        )
      ) : (
        <div className="space-y-2 py-6">
          <h1 className="text-xl font-semibold text-foreground">Thông tin tài khoản</h1>
          <p role="alert" className="text-sm text-destructive">{result.error}</p>
        </div>
      )}
    </AppLayout>
  );
}
