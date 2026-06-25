import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Users, Upload } from "lucide-react";
import CurrentUser from "@/components/CurrentUser";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resolveUrl } from "@/lib/url";
import { clearToken } from "@/lib/auth";

const navItems = [
  { icon: Users, label: "主播管理", path: "/anchors" },
  { icon: Upload, label: "数据导入", path: "/import" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src={resolveUrl("/app-icon.svg", true)} alt="" className="h-8 w-auto" />
          <span className="text-base font-semibold">主播管理后台</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarMenu className="gap-0.5">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                  <Link to={item.path}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border">
        <CurrentUser onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="flex min-h-screen w-full">
      <AppSidebar />
      <SidebarInset className="flex flex-1 flex-col w-full">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 min-w-0 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
