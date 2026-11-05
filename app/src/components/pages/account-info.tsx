import { ShieldCheck, User, UserCog } from 'lucide-react';
import { initialsOf } from '@/components/account/initials';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { UnverifiedNote } from '@/components/ui/unverified-note';
import { formatAmount, formatDateTime } from '@/lib/format';
import type {
  AccountProfileView,
  AccountStatus,
  AmlStatus,
  IdentityStatus,
  RiskRating,
} from '@/lib/bank/account-profile.service';
import { ROLE_LABELS } from '@/lib/role-labels';
import { cn } from '@/lib/utils';
import { PaymentWalletValue } from './account-wallet';

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

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

/** Sắc nhãn (FE-UX-05b QĐ-8); chữ nhãn không đổi. */
const ACCOUNT_STATUS_TONES: Record<AccountStatus, BadgeVariant> = { ACTIVE: 'ok', LOCKED: 'bad' };
const IDENTITY_TONES: Record<IdentityStatus, BadgeVariant> = { APPROVED: 'ok', PENDING: 'warn', REJECTED: 'bad' };
const RISK_TONES: Record<RiskRating, BadgeVariant> = { LOW: 'secondary', MEDIUM: 'warn', HIGH: 'bad' };

function Section({
  title,
  icon,
  note,
  layout = 'tiles',
  className,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  note?: React.ReactNode;
  layout?: 'tiles' | 'rows';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5">
          <CardTitleIcon>{icon}</CardTitleIcon>
          {title}
          {note}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl
          className={
            layout === 'rows' ? 'divide-y divide-border' : 'grid gap-3 min-[640px]:grid-cols-2 min-[1180px]:grid-cols-3'
          }
        >
          {children}
        </dl>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  span,
  highlight = false,
  variant = 'tile',
}: {
  label: string;
  children: React.ReactNode;
  span?: 'wide' | 'full';
  highlight?: boolean;
  variant?: 'tile' | 'row';
}) {
  if (variant === 'row') {
    return (
      <div className="flex items-baseline justify-between gap-4 py-2.5">
        <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{children}</dd>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'min-w-0 rounded-[14px] px-4 py-3.5',
        // `tile-gold` vẽ `::before` tuyệt đối nên ô cần định vị và cắt tràn.
        highlight ? 'relative isolate overflow-hidden tile-gold' : 'bg-muted/60',
        span === 'wide' && 'min-[640px]:col-span-2',
        span === 'full' && 'min-[640px]:col-span-full',
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1 text-base font-medium [overflow-wrap:anywhere]', highlight && 'text-[22px] tabular-nums')}>
        {children}
      </dd>
    </div>
  );
}

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge variant={ACCOUNT_STATUS_TONES[status]}>{status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá'}</Badge>;
}

/** Ô xanh đầu màn (QĐ-4): chữ viết tắt, tên, mã người dùng (khách hàng), vai trò. Tên không là heading. */
function ProfileHero({ profile }: { profile: AccountProfileView }) {
  const customer = profile.kind === 'CUSTOMER' ? profile : null;
  const organization = customer?.customerType === 'ORGANIZATION';
  return (
    <Card
      tone="hl"
      data-account-hero
      className="[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)] min-[1100px]:col-span-4"
    >
      <CardContent className="flex flex-col gap-5">
        <span
          aria-hidden="true"
          className="relative isolate grid size-16 place-items-center overflow-hidden rounded-full text-xl font-bold tile-gold"
        >
          {initialsOf(profile.fullName, organization)}
        </span>
        <dl className="flex flex-wrap gap-x-7 gap-y-4">
          <div className="basis-full">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {organization ? 'Tên pháp nhân' : 'Họ và tên'}
              <UnverifiedNote title="Hồ sơ mẫu, chưa có kho người dùng" />
            </dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{profile.fullName}</dd>
          </div>
          {customer && (
            <div>
              <dt className="text-xs text-muted-foreground">Mã người dùng</dt>
              <dd className="mt-1 font-medium">
                <span className="font-code">{customer.actorId}</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Vai trò</dt>
            <dd className="mt-1 font-medium">{ROLE_LABELS[profile.role]}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function AccountInfoPage({ profile }: { profile: AccountProfileView }) {
  const customer = profile.kind === 'CUSTOMER' ? profile : null;

  return (
    <div className="space-y-6" data-account-role={profile.role}>
      <header className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight">Thông tin tài khoản</h1>
        <Badge variant="outline">Chỉ đọc</Badge>
      </header>

      {customer ? (
        <div className="grid gap-6 min-[1100px]:grid-cols-12">
          <ProfileHero profile={customer} />

          <Section
            className="min-[1100px]:col-span-8"
            icon={<User />}
            title={customer.customerType === 'ORGANIZATION' ? 'Thông tin pháp nhân' : 'Thông tin cá nhân'}
            note={<UnverifiedNote title="Hồ sơ mẫu, chưa có kho người dùng; riêng Ví thanh toán lấy từ ví kết nối và trạng thái định danh trong hệ thống" />}
          >
            {customer.contactPerson && <Field label="Người liên hệ">{customer.contactPerson}</Field>}
            <Field label="Số điện thoại">{customer.phone}</Field>
            <Field label="Thư điện tử">{customer.email}</Field>
            <Field label="Trạng thái định danh">
              <Badge variant={IDENTITY_TONES[customer.identityStatus]}>{IDENTITY_LABELS[customer.identityStatus]}</Badge>
            </Field>
            {/* FIX-01 F2: ví thanh toán và trạng thái định danh trên chain đang chọn, đọc qua AccountWalletProvider. */}
            <Field label="Ví thanh toán" span={customer.customerType === 'ORGANIZATION' ? 'wide' : 'full'}>
              <PaymentWalletValue />
            </Field>
          </Section>

          <Section
            className="min-[1100px]:col-span-4"
            icon={<UserCog />}
            layout="rows"
            title="Thông tin tài khoản"
            note={<UnverifiedNote title="Hồ sơ mẫu, chưa có kho người dùng" />}
          >
            <Field label="Trạng thái" variant="row"><AccountStatusBadge status={customer.status} /></Field>
            <Field label="Ngày tạo" variant="row">{formatDateTime(customer.createdAt)}</Field>
            <Field label="Hoạt động gần nhất" variant="row">{formatDateTime(customer.lastActiveAt)}</Field>
          </Section>

          <Section
            className="min-[1100px]:col-span-8"
            icon={<ShieldCheck />}
            title="Hồ sơ định danh và rủi ro"
            note={<UnverifiedNote title="Hồ sơ mẫu, chưa có kho người dùng" />}
          >
            <Field label="Loại khách hàng">
              {customer.customerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Tổ chức'}
            </Field>
            <Field label="Trạng thái định danh">{IDENTITY_LABELS[customer.identityStatus]}</Field>
            <Field label="Xếp hạng rủi ro">
              <Badge variant={RISK_TONES[customer.riskRating]}>{RISK_LABELS[customer.riskRating]}</Badge>
            </Field>
            <Field label="Phòng chống rửa tiền">{AML_LABELS[customer.amlStatus]}</Field>
            <Field label="Hạn mức giao dịch mỗi ngày" span="wide" highlight>
              <span className="tabular-nums">{formatAmount(customer.dailyTransactionLimitVnd)} VNDB</span>
            </Field>
          </Section>
        </div>
      ) : (
        <div className="grid gap-6 min-[1100px]:grid-cols-12">
          <ProfileHero profile={profile} />

          <Section
            className="min-[1100px]:col-span-8"
            icon={<UserCog />}
            title="Thông tin cán bộ"
            note={<UnverifiedNote title="Hồ sơ mẫu, chưa có kho người dùng" />}
          >
            <Field label="Mã cán bộ"><span className="font-code">{profile.actorId}</span></Field>
            <Field label="Trạng thái"><AccountStatusBadge status={profile.status} /></Field>
            <Field label="Số điện thoại">{profile.phone}</Field>
            <Field label="Thư điện tử" span="wide">{profile.email}</Field>
            <Field label="Hoạt động gần nhất">{formatDateTime(profile.lastActiveAt)}</Field>
          </Section>
        </div>
      )}
    </div>
  );
}
