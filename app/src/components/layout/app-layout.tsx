import type { ChainKey } from "@bidv/shared";
import { getCustodyStateForLayout } from "@/lib/bank/custody.service";
import { can } from "@/lib/rbac";
import { canMintDemoPayment } from "@/lib/rbac/demo-payment";
import { currentRole } from "@/lib/rbac/session";
import { pendingWorkCounts } from "@/lib/nav/pending-work";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { NAV_BY_ROLE, withHiddenOps } from "./nav-config";
import type { CustodyToggleState } from "./custody-toggle";

/** IN-04: chỉ hai vai vận hành (quyền `custody:toggle`) thấy công tắc; một lần đọc khoá cấu hình. */
async function custodyToggleState(): Promise<CustodyToggleState> {
  const state = await getCustodyStateForLayout();
  return {
    enabled: state.enabled,
    configured: state.configured,
    unreadable: state.unreadable,
    scope: state.scope.ok
      ? { ok: true, chains: Object.keys(state.scope.chainAssets) as ChainKey[] }
      : { ok: false },
  };
}

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

/**
 * Khung trang: menu bên trái + thanh trên + phần thân.
 *
 * FE-20 bỏ prop `nav`: menu SUY RA từ vai đang có hiệu lực, không do trang truyền vào.
 *
 * Vì sao bỏ: có bốn vai và hơn mười trang, nên prop `nav` là mười chỗ có thể truyền sai, và
 * truyền sai thì không có gì báo — trang vẫn kết xuất, chỉ bày menu của vai khác. Suy từ
 * `currentRole()` thì menu và `ChannelGuard` đọc CÙNG một nguồn, nên không có trạng thái nào
 * mà menu nói một đằng guard làm một nẻo.
 *
 * `async` Server Component: đọc cookie vai và số việc đang chờ. Mọi trang gọi nó đều đã là
 * Server Component nên không phát sinh ràng buộc mới.
 */
export async function AppLayout({ children, breadcrumbs }: AppLayoutProps) {
  const role = await currentRole();
  const [pendingWork, custody] = await Promise.all([
    pendingWorkCounts(),
    can(role, "custody:toggle") ? custodyToggleState() : null,
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        nav={withHiddenOps(NAV_BY_ROLE[role], {
          demoPayment: canMintDemoPayment(role),
          walletBinding: can(role, "investor:whitelist"),
        })}
        pendingWork={pendingWork}
        custody={custody}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
