import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAmount, formatDateTime } from '@/lib/format';
import type {
  AccountProfileView,
  AmlStatus,
  IdentityStatus,
  RiskRating,
} from '@/lib/bank/account-profile.service';
import type { Role } from '@/lib/rbac';

const ROLE_LABELS: Record<Role, string> = {
  INVESTOR: 'Nhà đầu tư',
  SELLER: 'Người bán',
  TELLER: 'Giao dịch viên',
  CONTROLLER: 'Kiểm soát viên',
};

const IDENTITY_LABELS: Record<IdentityStatus, string> = {
  APPROVED: 'Đã xác minh',
  PENDING: 'Đang xác minh',
  REJECTED: 'Không đạt',
};

const RISK_LABELS: Record<RiskRating, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

const AML_LABELS: Record<AmlStatus, string> = {
  CLEARED: 'Đạt',
  REVIEW: 'Đang rà soát',
  FLAGGED: 'Cần xử lý',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle role="heading" aria-level={2}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function AccountStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'default' : 'destructive'}>{active ? 'Đang hoạt động' : 'Đã khoá'}</Badge>;
}

export function AccountInfoPage({ profile }: { profile: AccountProfileView }) {
  const customer = profile.kind === 'CUSTOMER' ? profile : null;

  return (
    <div className="space-y-6" data-account-role={profile.role}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Thông tin tài khoản</h1>
          <Badge variant="outline">Chỉ đọc</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Thông tin hồ sơ của tài khoản đang đăng nhập. Mọi thay đổi cần được ngân hàng xác minh.
        </p>
      </header>

      {customer ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={customer.customerType === 'ORGANIZATION' ? 'Thông tin pháp nhân' : 'Thông tin cá nhân'}>
              <Field label={customer.customerType === 'ORGANIZATION' ? 'Tên pháp nhân' : 'Họ và tên'} wide>
                {customer.fullName}
              </Field>
              {customer.contactPerson && <Field label="Người liên hệ">{customer.contactPerson}</Field>}
              <Field label="Số điện thoại">{customer.phone}</Field>
              <Field label="Thư điện tử">{customer.email}</Field>
              <Field label="Trạng thái định danh">
                <Badge variant={customer.identityStatus === 'APPROVED' ? 'default' : 'secondary'}>
                  {IDENTITY_LABELS[customer.identityStatus]}
                </Badge>
              </Field>
              <Field label={customer.customerType === 'ORGANIZATION' ? 'Ví thanh toán' : 'Địa chỉ ví'} wide>
                <span className="break-all font-mono text-xs">{customer.wallet}</span>
              </Field>
            </Section>

            <Section title="Thông tin tài khoản">
              <Field label="Mã người dùng"><span className="font-mono">{customer.actorId}</span></Field>
              <Field label="Vai trò">{ROLE_LABELS[customer.role]}</Field>
              <Field label="Trạng thái"><AccountStatusBadge active={customer.status === 'ACTIVE'} /></Field>
              <Field label="Ngày tạo">{formatDateTime(customer.createdAt)}</Field>
              <Field label="Hoạt động gần nhất" wide>{formatDateTime(customer.lastActiveAt)}</Field>
            </Section>
          </div>

          <Section title="Hồ sơ định danh và rủi ro">
            <Field label="Loại khách hàng">
              {customer.customerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Tổ chức'}
            </Field>
            <Field label="Trạng thái định danh">{IDENTITY_LABELS[customer.identityStatus]}</Field>
            <Field label="Xếp hạng rủi ro">
              <Badge variant={customer.riskRating === 'HIGH' ? 'destructive' : 'secondary'}>
                {RISK_LABELS[customer.riskRating]}
              </Badge>
            </Field>
            <Field label="Phòng chống rửa tiền">{AML_LABELS[customer.amlStatus]}</Field>
            <Field label="Hạn mức giao dịch mỗi ngày" wide>
              <span className="font-mono">{formatAmount(customer.dailyTransactionLimitVnd)} VNDB</span>
            </Field>
          </Section>
        </>
      ) : (
        <Section title="Thông tin cán bộ">
          <Field label="Mã cán bộ"><span className="font-mono">{profile.actorId}</span></Field>
          <Field label="Họ và tên">{profile.fullName}</Field>
          <Field label="Vai trò">{ROLE_LABELS[profile.role]}</Field>
          <Field label="Trạng thái"><AccountStatusBadge active={profile.status === 'ACTIVE'} /></Field>
          <Field label="Số điện thoại">{profile.phone}</Field>
          <Field label="Thư điện tử">{profile.email}</Field>
          <Field label="Hoạt động gần nhất" wide>{formatDateTime(profile.lastActiveAt)}</Field>
        </Section>
      )}
    </div>
  );
}
