import { AppLayout } from "@/components/layout/app-layout";
import { AssetsPage } from "@/components/pages/assets";

export default function Assets() {
  return (
    <AppLayout breadcrumbs={[{ label: "Module E" }, { label: "Niêm yết tài sản" }]}>
      <AssetsPage />
    </AppLayout>
  );
}
