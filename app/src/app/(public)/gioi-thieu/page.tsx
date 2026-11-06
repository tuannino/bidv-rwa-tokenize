import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

/** FE-UX-07a: trang giới thiệu công khai, không cần vai, không có thanh bên (QĐ-1). */
export const metadata: Metadata = {
  title: 'Giới thiệu, BIDV RWA token hoá dự án điện gió',
  description:
    'BIDV token hoá quyền hưởng lợi tức của dự án điện gió. Sản lượng điện được ghi nhận minh bạch, lợi nhuận chia theo từng kỳ cho người nắm giữ WPT.',
};

export default function GioiThieuPage() {
  return <LandingPage />;
}
