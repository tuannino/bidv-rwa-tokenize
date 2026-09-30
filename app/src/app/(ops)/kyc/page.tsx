import { AppLayout } from "@/components/layout/app-layout";
import { KycPage } from "@/components/pages/kyc";

export default function Kyc() {
  return (
    <AppLayout breadcrumbs={[{ label: "Ngân hàng" }, { label: "Nhà đầu tư & KYC" }]}>
      <KycPage />
    </AppLayout>
  );
}
