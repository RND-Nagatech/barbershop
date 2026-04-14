import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Scissors,
  CalendarPlus,
  ClipboardList,
  FileText,
  UserCog,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const menuGroups = [
  {
    label: "Menu Utama",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Master Pegawai", url: "/master/pegawai", icon: Users },
      { title: "Master Layanan", url: "/master/layanan", icon: Scissors },
    ],
  },
  {
    label: "Booking",
    items: [
      { title: "Input Booking", url: "/booking/input", icon: CalendarPlus },
      { title: "Booked", url: "/booking/list", icon: ClipboardList },
    ],
  },
  {
    label: "Laporan",
    items: [
      { title: "Laporan Keuangan", url: "/laporan/keuangan", icon: FileText },
      { title: "Laporan Pegawai", url: "/laporan/pegawai", icon: FileText },
    ],
  },
  {
    label: "Manage User",
    items: [
      { title: "Data User", url: "/user/data", icon: UserCog },
      { title: "Hak Akses User", url: "/user/akses", icon: Shield },
    ],
  },
  {
    label: "Setting",
    items: [
      { title: "Setting Komisi", url: "/setting/komisi", icon: Settings },
      { title: "Data Cabang", url: "/setting/cabang", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroupLabel = useMemo(() => {
    const activeGroup = menuGroups.find((group) =>
      group.items.some((item) => location.pathname.startsWith(item.url)),
    );
    return activeGroup?.label ?? "";
  }, [location.pathname]);
  const [openGroup, setOpenGroup] = useState(activeGroupLabel);

  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroup(activeGroupLabel);
    }
  }, [activeGroupLabel]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Scissors className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display text-base font-bold text-sidebar-accent-foreground">BarberPro</h1>
              <p className="text-xs text-sidebar-foreground/60">Management System</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {menuGroups.map((group) => {
          const isOpen = openGroup === group.label;
          
          if (group.items.length === 1) {
            const item = group.items[0];
            return (
              <SidebarGroup key={group.label}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible
              key={group.label}
              open={isOpen}
              onOpenChange={(nextOpen) => setOpenGroup(nextOpen ? group.label : "")}
            >
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="flex items-center justify-between cursor-pointer text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
                    {!collapsed && <span>{group.label}</span>}
                    {!collapsed && <ChevronDown className="w-3 h-3" />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                            >
                              <item.icon className="w-4 h-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/")}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
