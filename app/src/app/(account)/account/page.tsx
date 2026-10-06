import { AppLayout } from '@/components/layout/app-layout';
import { AccountInfoPage } from '@/components/pages/account-info';
import { getOwnAccountProfile } from '@/lib/bank/account-profile.service';

export default async function AccountPage() {
  const result = await getOwnAccountProfile();

  return (
    <AppLayout breadcrumbs={[{ label: 'Thông tin tài khoản' }]}>
      {result.ok ? (
        <AccountInfoPage profile={result.data} />
      ) : (
        <div className="space-y-2 py-6">
          <h1 className="text-xl font-semibold text-foreground">Thông tin tài khoản</h1>
          <p role="alert" className="text-sm text-destructive">{result.error}</p>
        </div>
      )}
    </AppLayout>
  );
}
