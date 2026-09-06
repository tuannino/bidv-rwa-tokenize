import { AppLayout } from "@/components/layout/app-layout";
import { ReconciliationPage } from "@/components/pages/reconciliation";

export default function Reconciliation() {
  return (
    <AppLayout breadcrumbs={[{ label: "Module B" }, { label: "Đối soát batch" }]}>
      <ReconciliationPage />
    </AppLayout>
  );
}
