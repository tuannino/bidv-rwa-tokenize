import type { Channel } from '@/lib/session/channel';

/**
 * FE-UX-07a: dữ liệu thuần của trang giới thiệu (dùng được ở server và client).
 */

/** Mã video tạm trên YouTube (QĐ-13), sẽ thay bằng video chính thức. Chỗ DUY NHẤT chứa mã này. */
export const LANDING_VIDEO_ID = 'M52hkUDVe5w';

/**
 * Bốn thẻ vai ở khối "Một nền tảng, bốn vai" (design mục 1 khối 6). Mỗi thẻ là một form gọi
 * `setChannel(channel)` (QĐ-4), nên trang đích là `CHANNEL_HOME[channel]`.
 */
export const LANDING_ROLES: readonly {
  channel: Channel;
  code: string;
  title: string;
  body: string;
  cta: string;
  image: string;
}[] = [
  {
    channel: 'investor',
    code: 'NĐT',
    title: 'Nhà đầu tư',
    body: 'Mua bán WPT bằng VNDB, theo dõi tài sản và nhận lợi tức mỗi kỳ.',
    cta: 'Vào khu nhà đầu tư',
    image: 'coin',
  },
  {
    channel: 'seller',
    code: 'NB',
    title: 'Người bán',
    body: 'Pháp nhân SPV theo dõi nguồn cung, giao dịch khớp và rút tiền từ vault.',
    cta: 'Vào khu người bán',
    image: 'office',
  },
  {
    channel: 'teller',
    code: 'GDV',
    title: 'Giao dịch viên',
    body: 'Lập lệnh phát hành, huỷ token và theo dõi vận hành hằng ngày.',
    cta: 'Vào khu vận hành',
    image: 'memo',
  },
  {
    channel: 'controller',
    code: 'KSV',
    title: 'Kiểm soát viên',
    body: 'Duyệt lệnh, duyệt chia lợi nhuận và cấu hình khoá vault.',
    cta: 'Vào khu kiểm soát',
    image: 'check',
  },
];

/** Cuộn quá mốc này (px) thì thanh trên mới được ẩn. */
const NAV_HIDE_AFTER = 160;
/** Quãng cuộn tối thiểu (px) tính từ điểm đảo chiều gần nhất để đổi trạng thái thanh trên. */
const NAV_THRESHOLD = 6;
/** Nút về đầu trang hiện khi đã cuộn quá tỷ lệ này của chiều cao cửa sổ. */
const TO_TOP_AFTER = 0.8;

/**
 * QĐ-10: trạng thái thanh trên và nút về đầu trang sau một lần cuộn tới `y`.
 *
 * Ngưỡng tính từ ĐIỂM ĐẢO CHIỀU GẦN NHẤT `anchorY` (không từ sự kiện trước, nên cuộn chậm vài px
 * mỗi sự kiện vẫn cộng dồn đủ ngưỡng): đang hiện thì `anchorY` theo điểm thấp nhất đã qua, đang ẩn
 * thì theo điểm cao nhất; mỗi lần đổi trạng thái đặt `anchorY = y`.
 */
export function landingChromeState(input: {
  y: number;
  anchorY: number;
  viewportHeight: number;
  navHidden: boolean;
}): { navHidden: boolean; anchorY: number; showTop: boolean } {
  const { y, viewportHeight } = input;
  const showTop = y > viewportHeight * TO_TOP_AFTER;
  if (y <= NAV_HIDE_AFTER) return { navHidden: false, anchorY: y, showTop };
  if (!input.navHidden) {
    const anchorY = Math.min(input.anchorY, y);
    return y - anchorY > NAV_THRESHOLD ? { navHidden: true, anchorY: y, showTop } : { navHidden: false, anchorY, showTop };
  }
  const anchorY = Math.max(input.anchorY, y);
  return anchorY - y > NAV_THRESHOLD ? { navHidden: false, anchorY: y, showTop } : { navHidden: true, anchorY, showTop };
}
