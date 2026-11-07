import { cn } from '@/lib/utils';
import styles from './landing.module.css';

/**
 * FE-UX-07a: cánh đồng gió minh hoạ (bản chốt `assets/ui.js:119-139`, hàm `scene()`), dựng ở server.
 * Nét vẽ theo `currentColor` (nơi dùng đặt `text-(--tile-hl-ink)`), mặt trời và chấm trục theo
 * `--tile-hl-bar`; cánh quay bằng `animate-spin` với thời lượng riêng từng tua-bin.
 */

/** Mỗi tua-bin: [x, đáy, cao] theo tỷ lệ khung 800 x 300, độ mờ, giây mỗi vòng quay. */
const SEED: readonly (readonly [number, number, number, number, number])[] = [
  [0.08, 0.78, 0.34, 0.45, 7],
  [0.2, 0.7, 0.5, 0.6, 5.5],
  [0.34, 0.76, 0.4, 0.5, 9],
  [0.5, 0.66, 0.62, 0.8, 4.6],
  [0.63, 0.74, 0.44, 0.55, 6.4],
  [0.76, 0.64, 0.7, 0.9, 3.8],
  [0.9, 0.72, 0.5, 0.65, 5],
  [0.43, 0.8, 0.3, 0.38, 8],
  [0.97, 0.78, 0.36, 0.45, 6.8],
];

const STREAKS = [60, 110, 150, 205];

export function TurbineScene({
  turbines,
  sun = true,
  sea = true,
  className,
}: {
  turbines: number;
  sun?: boolean;
  sea?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 text-(--tile-hl-ink)', className)}>
      <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className="size-full">
        {sun && (
          <>
            <circle cx="660" cy="86" r="70" opacity=".16" className="fill-(--tile-hl-bar)" />
            <circle cx="660" cy="86" r="34" opacity=".55" className="fill-(--tile-hl-bar)" />
          </>
        )}
        <path
          d="M0 230 C 120 190, 230 214, 340 196 S 560 176, 660 198 S 760 214, 800 204 V300 H0Z"
          fill="currentColor"
          opacity=".08"
        />
        {SEED.slice(0, turbines).map(([x, by, h, op, seconds], i) => {
          const X = x * 800;
          const B = by * 300;
          const H = h * 300;
          const R = H * 0.42;
          const hub = B - H;
          return (
            <g key={i} opacity={op}>
              <path d={`M${X - 2.2} ${B} L${X - 0.9} ${hub} L${X + 0.9} ${hub} L${X + 2.2} ${B}Z`} fill="currentColor" />
              <g
                className="animate-spin"
                style={{ transformOrigin: `${X}px ${hub}px`, animationDuration: `${seconds}s`, animationDelay: `${-i}s` }}
              >
                <path d={`M${X} ${hub} L${X - 2} ${hub - R} L${X + 2.4} ${hub - R * 0.92}Z`} fill="currentColor" />
                <path d={`M${X} ${hub} L${X + R * 0.86} ${hub + R * 0.5} L${X + R * 0.78} ${hub + R * 0.56 + 3}Z`} fill="currentColor" />
                <path d={`M${X} ${hub} L${X - R * 0.86} ${hub + R * 0.5} L${X - R * 0.8} ${hub + R * 0.46 - 3}Z`} fill="currentColor" />
              </g>
              <circle cx={X} cy={hub} r="3" className="fill-(--tile-hl-bar)" />
            </g>
          );
        })}
        <path
          d="M0 252 C 140 232, 260 250, 400 238 S 650 222, 800 242 V300 H0Z"
          fill="currentColor"
          opacity=".12"
        />
        {sea && (
          <path
            d="M30 276 h90 M170 284 h120 M360 278 h70 M480 288 h110 M640 280 h90"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".35"
          />
        )}
        {STREAKS.map((y, i) => (
          <path
            key={y}
            className={styles.streak}
            style={{ animationDelay: `${-i * 1.7}s` }}
            d={`M-40 ${y} C 160 ${y - 26}, 320 ${y + 22}, 520 ${y - 6} S 760 ${y - 24}, 860 ${y}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity=".45"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
