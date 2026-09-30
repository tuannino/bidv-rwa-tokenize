import { AppLayout } from "@/components/layout/app-layout";
import { AssetsPage } from "@/components/pages/assets";

export default function Assets() {
  return (
    <AppLayout breadcrumbs={[{ label: "Ngân hàng" }, { label: "Dự án điện gió" }]}>
      <AssetsPage />
    </AppLayout>
  );
}
