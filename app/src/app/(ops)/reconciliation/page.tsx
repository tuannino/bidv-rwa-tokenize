import { AppLayout } from "@/components/layout/app-layout";
import { ReconciliationPage } from "@/components/pages/reconciliation";

export default function Reconciliation() {
  return (
    <AppLayout breadcrumbs={[{ label: "Ngân hàng" }, { label: "Đối soát doanh thu điện" }]}>
      <ReconciliationPage />
    </AppLayout>
  );
}
