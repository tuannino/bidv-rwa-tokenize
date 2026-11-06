'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { buttonVariants } from '@/components/ui/button';
import { useIsMounted } from '@/lib/hooks/use-is-mounted';
import { cn } from '@/lib/utils';
import { EnterChannelForm } from './enter-channel-form';
import { landingChromeState } from './landing-data';
import styles from './landing.module.css';

/** Khung nội dung của trang giới thiệu: thanh trên và các khối cùng mép (QĐ-10). */
const FRAME = 'w-[min(1200px,calc(100%-48px))]';

const ANCHORS = [
  { href: '#du-an', label: 'Dự án' },
  { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
  { href: '#vai-tro', label: 'Dành cho bạn' },
  { href: '#minh-bach', label: 'Minh bạch' },
];

/**
 * FE-UX-07a: thanh trên (QĐ-10) và nút về đầu trang (QĐ-8) của trang giới thiệu.
 *
 * Logo và biểu tượng có ở khung (`Sun`, `Moon`, `ArrowRight`) dựng ở server rồi truyền vào qua prop
 * (QĐ-7, QĐ-15). Một trình nghe `scroll` thụ động dùng chung, gom vào một `requestAnimationFrame` mỗi
 * khung hình; `anchorY` giữ trong ref; chỉ `setState` khi trạng thái thật sự đổi.
 */
export function LandingChrome({
  logo,
  themeIcons,
  enterIcon,
}: {
  logo: React.ReactNode;
  themeIcons: { sun: React.ReactNode; moon: React.ReactNode };
  enterIcon: React.ReactNode;
}) {
  const [navHidden, setNavHidden] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const last = useRef({ anchorY: 0, navHidden: false, showTop: false });
  const logoLink = useRef<HTMLAnchorElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const prev = last.current;
      const next = landingChromeState({
        y: window.scrollY,
        anchorY: prev.anchorY,
        viewportHeight: window.innerHeight,
        navHidden: prev.navHidden,
      });
      last.current = next;
      if (next.navHidden !== prev.navHidden) setNavHidden(next.navHidden);
      if (next.showTop !== prev.showTop) setShowTop(next.showTop);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Tải lại giữa trang: tính trạng thái ở khung hình đầu, không đợi lần cuộn tiếp theo.
    frame = window.requestAnimationFrame(update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    logoLink.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <header
        data-hidden={navHidden || undefined}
        className={cn(
          FRAME,
          styles.bar,
          'fixed top-3.5 left-1/2 z-30 flex h-14 -translate-x-1/2 items-center gap-[18px] rounded-full py-2 pr-2 pl-3.5 shadow-lg ring-1 ring-border',
        )}
      >
        <a
          ref={logoLink}
          href="#top"
          aria-label="BIDV RWA Tokenize Platform"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {logo}
        </a>
        <nav aria-label="Mục trang chủ" className="mx-auto hidden gap-1 min-[760px]:flex">
          {ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {anchor.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 min-[760px]:ml-0">
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              title={resolvedTheme === 'dark' ? 'Chuyển sang Light mode' : 'Chuyển sang Dark mode'}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-[rotate,background-color,color] duration-300 ease-spring hover:-rotate-12 hover:bg-muted hover:text-foreground"
            >
              {resolvedTheme === 'dark' ? themeIcons.sun : themeIcons.moon}
            </button>
          )}
          <EnterChannelForm channel="teller">
            <button type="submit" aria-label="Vào hệ thống" className={cn(buttonVariants(), 'h-10 gap-2 px-4')}>
              {enterIcon}
              <span className="max-[759px]:hidden">Vào hệ thống</span>
            </button>
          </EnterChannelForm>
        </div>
      </header>

      <button
        type="button"
        aria-label="Về đầu trang"
        onClick={toTop}
        inert={!showTop}
        data-show={showTop || undefined}
        className={cn(styles.toTop, 'fixed top-[84px] z-30 grid size-10 place-items-center rounded-full text-foreground')}
      >
        <ArrowUp className="size-5" aria-hidden="true" />
      </button>
    </>
  );
}
