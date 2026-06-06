import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "@/components/pages/dashboard";

export default function Home() {
  return (
    <AppLayout breadcrumbs={[{ label: "Tổng quan" }]}>
      <DashboardPage />
    </AppLayout>
  );
}
