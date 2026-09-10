import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}
