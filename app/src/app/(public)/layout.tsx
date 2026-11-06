/**
 * FE-UX-07a QĐ-1: nhóm công khai, chỉ chứa trang giới thiệu, không đọc vai. Ngoại lệ DUY NHẤT của bất
 * biến "mọi trang nằm trong một khu vực có cổng" (`four-roles-routes.test.ts` khoá đúng một nhóm này).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
