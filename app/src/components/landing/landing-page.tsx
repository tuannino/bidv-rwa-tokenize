import { ArrowRight, LayoutDashboard, Moon, Sun, Wallet, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { UnverifiedNote } from '@/components/ui/unverified-note';
import { BidvLogo } from '@/components/bidv-logo';
import { WPT_ANNUAL_YIELD_PERCENT } from '@/lib/config/issue-terms';
import { MOCK_PROJECTS, MOCK_WIND_STATS, PROJECT_STATUS_LABELS, REGION_LABELS } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { EnterChannelForm } from './enter-channel-form';
import { HeroVideo } from './hero-video';
import { LandingChrome } from './landing-chrome';
import { LANDING_ROLES } from './landing-data';
import { TurbineScene } from './turbine-scene';
import styles from './landing.module.css';

/**
 * FE-UX-07a: trang giới thiệu công khai (bản chốt `docs/prototypes/20261101_ui_ux_ban_chot/index.html`),
 * dựng ở server. Số liệu đọc lúc dựng từ hằng (`mock-data`, `issue-terms`), không gọi máy chủ khi mở
 * (QĐ-3); số chưa có nguồn thật kèm `UnverifiedNote` (QĐ-12).
 */

const FRAME = 'mx-auto w-[min(1200px,calc(100%-48px))]';
const SECTION = 'scroll-mt-24 py-16 min-[760px]:py-24';

const integer = (value: number) => value.toLocaleString('vi-VN');
const oneDecimal = (value: number) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Nút lớn trên nền tối: trắng chữ xanh đậm, hoặc kính mờ chữ trắng (bản chốt `.btn.white`, `.btn.glass`). */
const BIG_BUTTON = 'inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition-transform hover:-translate-y-px [&_svg]:size-4';
const WHITE_BUTTON = cn(BIG_BUTTON, 'bg-(--tile-hl-ink) text-(--lp-deep) shadow-lg');
const GLASS_BUTTON = cn(BIG_BUTTON, 'bg-(--tile-hl-chip) text-(--tile-hl-ink) ring-1 ring-(--tile-hl-chip)');

const STEPS = [
  { image: 'leaf', label: 'Gió', text: 'Các dự án điện gió lớn phù hợp định hướng ESG, sản lượng điện đều đặn' },
  { image: 'zap', label: 'Điện', text: 'EnergyOracle ghi sản lượng MWh lên chuỗi' },
  { image: 'classic', label: 'Doanh thu', text: 'Tiền điện định kỳ chuyển về vault thanh toán do BIDV quản lý' },
  { image: 'scales', label: 'Quỹ chia', text: 'Kiểm soát viên duyệt tổng số của kỳ' },
  { image: 'moneybag', label: 'Lợi tức', text: 'VNDB về ví theo số WPT nắm giữ' },
];

const TRUST = [
  { image: 'id', label: 'KYC và danh sách được phép', text: 'Chỉ ví đã định danh mới nắm giữ được WPT, theo chuẩn token có kiểm soát.' },
  { image: 'shield', label: 'Lập và duyệt tách bạch', text: 'Giao dịch viên lập, Kiểm soát viên duyệt. Người lập không tự duyệt được.' },
  { image: 'handshake', label: 'Quyết toán nguyên tử', text: 'WPT và VNDB đổi chủ trong cùng một giao dịch trên chuỗi.' },
  { image: 'ledger', label: 'Sổ kiểm toán đầy đủ', text: 'Mọi thao tác ghi lại người làm, thời điểm và mã giao dịch.' },
];

/** Ảnh nền thẻ dự án theo thứ tự `MOCK_PROJECTS` (bản chốt `.pcard:nth-child`). */
const PROJECT_PICS = [
  { tile: 'tile-hl', turbines: 7, sun: true, sea: true, overlay: false },
  { tile: 'tile-au', turbines: 5, sun: false, sea: true, overlay: false },
  { tile: 'tile-hl', turbines: 4, sun: true, sea: false, overlay: true },
];

/** Ảnh 3D tạm (QĐ-14): tệp tĩnh nhỏ, không cần tối ưu ảnh của Next. */
function Img3d({ name, size, className }: { name: string; size: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh vài KB, next/image không lợi gì mà thêm JS và yêu cầu
  return <img src={`/landing/3d/${name}.webp`} width={size} height={size} alt="" loading="lazy" decoding="async" className={className} />;
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-9">
      <h2 className="max-w-[20ch] text-[clamp(28px,3.4vw,42px)] leading-[1.12] font-bold tracking-[-.02em]">{title}</h2>
      {sub && <p className="mt-3 max-w-[62ch] text-base text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function LandingPage() {
  const totalTurbines = MOCK_PROJECTS.reduce((sum, project) => sum + project.turbines, 0);
  // Ô số liệu gọn hơn mặc định (bản chốt `.stats .kpi`): đệm 16 px, giá trị 23 px không xuống dòng.
  const kpiValue = 'p-4 [&>p]:text-[23px] [&>p]:whitespace-nowrap';

  return (
    <>
      <LandingChrome
        logo={<BidvLogo variant="inline" />}
        themeIcons={{ sun: <Sun className="size-4" />, moon: <Moon className="size-4" /> }}
        enterIcon={<ArrowRight className="size-4" aria-hidden="true" />}
      />

      <main id="top" className={styles.root}>
        {/* 2. Màn đầu */}
        <section className="tile-hl relative isolate grid min-h-svh place-items-center overflow-hidden pt-[100px] pb-[110px] text-center min-[760px]:pt-[120px]">
          <div aria-hidden="true" className={cn(styles.sky, 'pointer-events-none absolute inset-0')}>
            <TurbineScene turbines={9} className="h-[46%] opacity-55" />
          </div>
          <div className={cn(FRAME, 'relative')}>
            <h1 className="mx-auto max-w-[22ch] text-[clamp(34px,5vw,64px)] leading-[1.06] font-bold tracking-[-.02em]">
              Nền tảng Token hoá dự án điện gió, đầu tư bền vững,{' '}
              <span className="text-(--tile-hl-bar)">lợi tức dài hạn</span>
            </h1>
            <p className="mx-auto mt-[18px] max-w-[60ch] text-[15px] text-(--tile-hl-sub) min-[760px]:text-[17px]">
              BIDV token hoá quyền hưởng lợi tức của dự án điện gió. Sản lượng điện được ghi nhận minh bạch, lợi nhuận chia
              theo từng kỳ cho người nắm giữ WPT.
            </p>
            <HeroVideo scene={<TurbineScene turbines={9} className="h-[70%] opacity-60" />} />
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="#du-an" className={WHITE_BUTTON}>
                <Wind aria-hidden="true" />
                Khám phá dự án
              </a>
              <EnterChannelForm channel="investor">
                <button type="submit" className={GLASS_BUTTON}>
                  <Wallet aria-hidden="true" />
                  Tôi là nhà đầu tư
                </button>
              </EnterChannelForm>
            </div>
          </div>
          <span aria-hidden="true" className={styles.hint} />
        </section>

        {/* 3. Sáu ô số liệu */}
        <div className={cn(FRAME, 'relative z-[2] -mt-9 grid grid-cols-2 gap-3.5 min-[760px]:-mt-14 min-[760px]:grid-cols-3 min-[1100px]:grid-cols-6')}>
          <Kpi
            tone="hl"
            className={kpiValue}
            label={<>Dự án điện gió<UnverifiedNote className="ml-1.5" /></>}
            value={integer(MOCK_PROJECTS.length)}
            sub="Gần bờ và ven biển"
          />
          <Kpi
            tone="leaf"
            className={kpiValue}
            label={<>Công suất đặt<UnverifiedNote className="ml-1.5" /></>}
            value={oneDecimal(MOCK_WIND_STATS.totalCapacityMw)}
            unit="MW"
            sub={`${integer(totalTurbines)} tua-bin`}
          />
          <Kpi
            className={kpiValue}
            label={<>Sản lượng luỹ kế<UnverifiedNote className="ml-1.5" /></>}
            value={integer(MOCK_WIND_STATS.cumulativeGenerationMwh)}
            unit="MWh"
            sub="Nguồn EnergyOracle"
          />
          <Kpi
            tone="leaf"
            className={kpiValue}
            label={<>WPT đã phát hành<UnverifiedNote className="ml-1.5" /></>}
            value={integer(MOCK_WIND_STATS.wptIssued)}
            sub="Token quyền hưởng"
          />
          <Kpi
            tone="gold"
            className={kpiValue}
            label={<>Lợi tức đã chia<UnverifiedNote className="ml-1.5" /></>}
            value={oneDecimal(MOCK_WIND_STATS.profitDistributedVndBn)}
            unit="tỷ"
            sub={`VND, ${MOCK_WIND_STATS.distributionPeriods} kỳ`}
          />
          <Kpi
            tone="au"
            className={kpiValue}
            label={
              <>
                Lợi tức mục tiêu
                <UnverifiedNote className="ml-1.5" title="Hằng mặc định, chưa đọc cấu hình đang hiệu lực" />
              </>
            }
            value={oneDecimal(WPT_ANNUAL_YIELD_PERCENT)}
            unit="%/năm"
            sub="Theo điều khoản phát hành"
          />
        </div>

        {/* 4. Năm chặng */}
        <section id="cach-hoat-dong" className={SECTION}>
          <div className={FRAME}>
            <SectionHead
              title="Gió hoá dòng tiền trong năm chặng"
              sub="Mỗi kỳ, sản lượng điện của nhà máy trở thành doanh thu, đi vào vault thanh toán của dự án rồi được chia cho người nắm giữ WPT theo tỷ lệ sở hữu."
            />
            <div className="relative grid gap-[22px] min-[760px]:grid-cols-5 min-[760px]:gap-0">
              <span
                aria-hidden="true"
                className={cn(styles.rail, 'absolute inset-x-[10%] top-11 hidden h-1 rounded-full min-[760px]:block')}
              />
              <span aria-hidden="true" className="absolute inset-x-[10%] top-10 hidden overflow-x-clip min-[760px]:block">
                <span className={styles.pulse} />
                <span className={cn(styles.pulse, styles.pulse2)} />
                <span className={cn(styles.pulse, styles.pulse3)} />
              </span>
              {STEPS.map((step) => (
                <div
                  key={step.label}
                  className="relative grid grid-cols-[76px_1fr] items-center gap-3.5 min-[760px]:block min-[760px]:px-2.5 min-[760px]:text-center"
                >
                  <div className={cn(styles.bubble, 'relative z-[1] grid size-[68px] place-items-center rounded-full bg-card min-[760px]:mx-auto min-[760px]:mb-4 min-[760px]:size-[92px]')}>
                    <Img3d name={step.image} size={56} className="size-12 min-[760px]:size-14" />
                  </div>
                  <div>
                    <b className="block text-[17px] font-bold">{step.label}</b>
                    <span className="mt-1.5 block text-[13px] text-muted-foreground">{step.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Ba dự án */}
        <section id="du-an" className={cn(SECTION, 'pt-0 min-[760px]:pt-0')}>
          <div className={FRAME}>
            <SectionHead title="Ba dự án điện gió" sub="Đầu tư dài hạn, lợi nhuận bền vững - Đối tác của BIDV" />
            <div className="grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
              {MOCK_PROJECTS.map((project, index) => {
                const pic = PROJECT_PICS[index % PROJECT_PICS.length];
                return (
                  <article key={project.id} className="lift relative overflow-hidden rounded-[28px] bg-card ring-1 ring-border">
                    <div className={cn(pic.tile, 'relative h-[190px] overflow-hidden')}>
                      {pic.overlay && <span aria-hidden="true" className="absolute inset-0 bg-(--tile-hl-chip)" />}
                      <div className={cn(styles.pic, 'absolute inset-0')}>
                        <TurbineScene turbines={pic.turbines} sun={pic.sun} sea={pic.sea} className="h-full opacity-70" />
                      </div>
                    </div>
                    <Badge variant="outline" className="absolute top-3.5 left-3.5 z-[1] bg-card/90">
                      {`${project.onChain ? 'ON-CHAIN' : 'DỮ LIỆU MẪU'}, ${project.tokenSymbol}`}
                    </Badge>
                    <div className="px-[22px] pt-5 pb-[22px]">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-lg font-bold">{project.name}</h3>
                        {!project.onChain && <UnverifiedNote />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {`${REGION_LABELS[project.region]}, ${PROJECT_STATUS_LABELS[project.status]}`}
                      </span>
                      <dl className="mt-2.5 space-y-1.5 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Công suất đặt</dt>
                          <dd className="font-medium tabular-nums">{`${oneDecimal(project.capacityMw)} MW`}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Tua-bin</dt>
                          <dd className="font-medium tabular-nums">{integer(project.turbines)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Hệ số công suất</dt>
                          <dd className="font-medium tabular-nums">{`${oneDecimal(project.capacityFactorPct)}%`}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. Bốn vai */}
        <section id="vai-tro" className={cn(SECTION, 'pt-0 min-[760px]:pt-0')}>
          <div className={FRAME}>
            <SectionHead
              title="Một nền tảng, bốn vai"
              sub="Chọn vai để vào thử hệ thống. Mỗi vai thấy đúng menu và quyền của mình."
            />
            <div className="grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-4">
              {LANDING_ROLES.map((role) => (
                <EnterChannelForm
                  key={role.channel}
                  channel={role.channel}
                  className="group lift relative flex flex-col gap-2.5 rounded-[28px] bg-card p-6 ring-1 ring-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <span className="flex items-center justify-between">
                    <Img3d name={role.image} size={64} className="size-16 transition-transform duration-700 ease-spring group-hover:-translate-y-1 group-hover:-rotate-6" />
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold tracking-[.04em] text-primary">{role.code}</span>
                  </span>
                  <h3 className="text-lg font-bold">{role.title}</h3>
                  <p className="flex-1 text-sm text-muted-foreground">{role.body}</p>
                  <button
                    type="submit"
                    className="mt-1.5 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-primary after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none"
                  >
                    {role.cta}
                    <ArrowRight className="nudge-x size-4" aria-hidden="true" />
                  </button>
                </EnterChannelForm>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Minh bạch */}
        <section id="minh-bach" className={cn(SECTION, 'pt-0 min-[760px]:pt-0')}>
          <div className={FRAME}>
            <SectionHead title="Minh bạch và kiểm soát như ngân hàng" />
            <div className="grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-4">
              {TRUST.map((item) => (
                <Card key={item.label} className="group lift gap-0 p-5">
                  <div className="mb-3.5 grid size-12 place-items-center rounded-2xl bg-muted">
                    <Img3d name={item.image} size={34} className="size-[34px] transition-transform duration-700 ease-spring group-hover:scale-115 group-hover:-rotate-8" />
                  </div>
                  <b className="block text-base font-bold">{item.label}</b>
                  <span className="mt-1.5 block text-[13px] text-muted-foreground">{item.text}</span>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Khối kết */}
        <section className={cn(SECTION, 'pt-0 min-[760px]:pt-0')}>
          <div className={FRAME}>
            <div className="tile-hl relative isolate overflow-hidden rounded-[28px] px-[22px] py-12 text-center min-[760px]:rounded-[36px] min-[760px]:px-12 min-[760px]:py-16">
              <TurbineScene turbines={9} className="h-[60%] opacity-35" />
              <h2 className="relative text-[clamp(28px,3.4vw,44px)] font-bold tracking-[-.02em]">Sẵn sàng xem thử hệ thống?</h2>
              <p className="relative mx-auto mt-3 max-w-[56ch] text-(--tile-hl-sub)">
                Bản xem thử dùng dữ liệu mẫu, không có giao dịch thật. Có thể đổi vai và đổi giao diện Sáng, Tối ở mọi trang.
              </p>
              <div className="relative mt-[26px] flex flex-wrap justify-center gap-3">
                <EnterChannelForm channel="teller">
                  <button type="submit" className={WHITE_BUTTON}>
                    <LayoutDashboard aria-hidden="true" />
                    Vào Bảng điều khiển
                  </button>
                </EnterChannelForm>
                <EnterChannelForm channel="investor">
                  <button type="submit" className={GLASS_BUTTON}>
                    <Wallet aria-hidden="true" />
                    Vào khu nhà đầu tư
                  </button>
                </EnterChannelForm>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={cn(FRAME, 'pt-14 pb-10')}>
        <div
          aria-hidden="true"
          className={cn(styles.word, 'text-[clamp(56px,12vw,168px)] leading-[.9] font-bold tracking-[-.03em] opacity-90')}
        >
          BIDV RWA
        </div>
        <div className="mt-[18px] flex flex-wrap justify-between gap-4 text-[13px] text-muted-foreground">
          <span>Token hoá quyền hưởng lợi tức dự án điện gió, bản thử nghiệm (PoC).</span>
          <span>Hình minh hoạ và video là tạm, sẽ thay bằng tài liệu chính thức.</span>
        </div>
      </footer>
    </>
  );
}
