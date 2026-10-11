import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 min-h-screen bg-background">
        <header className="flex h-14 items-center gap-4 border-b border-border/40 px-6">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">Workspace</span>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}