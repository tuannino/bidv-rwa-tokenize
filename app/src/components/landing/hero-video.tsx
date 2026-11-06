'use client';

import { useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { LANDING_VIDEO_ID } from './landing-data';
import styles from './landing.module.css';

/**
 * FE-UX-07a QĐ-13: khung video ở màn đầu.
 *
 * HTML máy chủ và lượt hydrate luôn là ảnh nền có nút phát (`getServerSnapshot` trả "giảm chuyển
 * động"), không có `iframe`. Sau hydrate, nếu người dùng KHÔNG chọn giảm chuyển động thì dựng `iframe`
 * tự phát, tắt tiếng; chọn giảm chuyển động thì giữ ảnh nền và không gửi yêu cầu nào tới YouTube cho
 * tới khi bấm nút phát. Đọc `prefers-reduced-motion` bằng `useSyncExternalStore` (như
 * `use-is-mounted.ts`), không `setState` trong effect.
 */
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const getSnapshot = () => window.matchMedia(REDUCE_QUERY).matches;
const getServerSnapshot = () => true;

const EMBED_URL = `https://www.youtube-nocookie.com/embed/${LANDING_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${LANDING_VIDEO_ID}&rel=0&modestbranding=1&playsinline=1`;
const WATCH_URL = `https://www.youtube.com/watch?v=${LANDING_VIDEO_ID}`;

export function HeroVideo({ scene }: { scene: React.ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [played, setPlayed] = useState(false);
  const playing = played || !reduced;

  return (
    <div className={cn(styles.player, 'relative mx-auto mt-10 w-[min(980px,100%)] rounded-[28px] p-2 shadow-2xl')}>
      <div className="tile-hl relative aspect-video overflow-hidden rounded-[22px]">
        {playing ? (
          <iframe
            src={EMBED_URL}
            title="Video giới thiệu dự án điện gió"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            aria-label="Phát video giới thiệu dự án điện gió"
            onClick={() => setPlayed(true)}
            className="absolute inset-0 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tile-hl-bar) focus-visible:ring-inset"
          >
            {scene}
            <span
              className={cn(
                styles.bigplay,
                'tile-au relative grid size-[104px] place-items-center rounded-full shadow-2xl',
              )}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-1.5 size-10">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
            </span>
            <span className="absolute inset-x-0 bottom-[22px] text-center font-medium text-(--tile-hl-ink)/90">
              Video giới thiệu dự án điện gió An Viên
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3 px-2.5 pt-2.5 pb-0.5 text-left text-xs text-(--tile-hl-sub)">
        <span>
          {playing
            ? 'Video tạm để thử giao diện, sẽ thay bằng video chính thức. Đang tắt tiếng, bấm biểu tượng loa để nghe.'
            : 'Video tạm để thử giao diện, sẽ thay bằng video chính thức.'}
        </span>
        <a href={WATCH_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-(--tile-hl-bar) hover:underline">
          Không xem được? Mở trên YouTube
        </a>
      </div>
    </div>
  );
}
