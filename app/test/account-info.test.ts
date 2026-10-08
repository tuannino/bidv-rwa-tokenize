import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountInfoPage } from '@/components/pages/account-info';
import { findOwnAccountProfile } from '@/lib/bank/account-profile.service';
import type { Role } from '@/lib/rbac';

const ACTORS: Record<Role, string> = {
  INVESTOR: 'NDT001',
  SELLER: 'NB001',
  TELLER: 'GDV001',
  CONTROLLER: 'KSV001',
};

function render(role: Role) {
  const profile = findOwnAccountProfile(role, ACTORS[role]);
  if (!profile) throw new Error(`Thiếu hồ sơ mẫu ${role}`);
  return renderToStaticMarkup(createElement(AccountInfoPage, { profile }));
}

describe('FE-24 — màn Thông tin tài khoản', () => {
  it('Nhà đầu tư thấy thông tin cá nhân, tài khoản, ví và hồ sơ rủi ro', () => {
    const html = render('INVESTOR');
    for (const text of [
      'Nguyễn Văn An',
      'NDT001',
      'Nhà đầu tư',
      'Địa chỉ ví',
      'Hồ sơ định danh và rủi ro',
      'Hạn mức giao dịch mỗi ngày',
    ]) {
      expect(html).toContain(text);
    }
  });

  it('Người bán thấy pháp nhân, người liên hệ và ví thanh toán', () => {
    const html = render('SELLER');
    for (const text of ['Thông tin pháp nhân', 'Công ty Cổ phần Điện gió An Viên', 'Trần Thị Bình', 'Ví thanh toán']) {
      expect(html).toContain(text);
    }
  });

  it.each(['TELLER', 'CONTROLLER'] as const)('%s chỉ thấy thông tin cán bộ, không có hồ sơ đầu tư hay ví', (role) => {
    const html = render(role);
    expect(html).toContain('Thông tin cán bộ');
    expect(html).toContain(ACTORS[role]);
    expect(html).not.toContain('Hồ sơ định danh và rủi ro');
    expect(html).not.toContain('Địa chỉ ví');
    expect(html).not.toContain('Ví thanh toán');
  });

  it.each(Object.keys(ACTORS) as Role[])('%s là màn chỉ đọc, không có điều khiển sửa', (role) => {
    const html = render(role);
    expect(html).toContain('Chỉ đọc');
    expect(html).not.toMatch(/<(button|input|textarea|select)\b/);
  });
});
