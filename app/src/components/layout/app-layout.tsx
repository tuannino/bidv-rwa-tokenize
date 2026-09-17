import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BANK_NAV, type NavSection } from "./nav-config";

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  /**
   * Menu của kênh. Mặc định `BANK_NAV` để các trang `(admin)`/`(audit)` đang chạy không
   * phải sửa gì.
   *
   * `NavSection` là dữ liệu thuần nên truyền được từ Server Component (page) xuống
   * `Sidebar` (Client Component) — xem ghi chú đầu `nav-config.ts`.
   */
  nav?: NavSection;
}

export function AppLayout({ children, breadcrumbs, nav = BANK_NAV }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar nav={nav} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
