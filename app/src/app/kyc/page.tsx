import { AppLayout } from "@/components/layout/app-layout";
import { KycPage } from "@/components/pages/kyc";

export default function Kyc() {
  return (
    <AppLayout breadcrumbs={[{ label: "Module A" }, { label: "Quản lý KYC" }]}>
      <KycPage />
    </AppLayout>
  );
}
