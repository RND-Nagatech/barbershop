import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  PackageSearch,
  BarChart3,
  UsersRound,
  Settings2,
  Users,
  Scissors,
  ShoppingBag,
  ContactRound,
  CalendarPlus,
  ClipboardList,
  FileText,
  CreditCard,
  ReceiptText,
  Boxes,
  UserCog,
  Shield,
  Settings,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  ChevronDown,
  MessageCircle,
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
import { getAuthUser } from "@/lib/api";

const menuGroups = [
  {
    label: "Menu Utama",
    icon: Layers,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Master Data",
    icon: PackageSearch,
    items: [
      { title: "Master Pegawai", url: "/master/pegawai", icon: Users },
      { title: "Master Produk", url: "/master/produk", icon: ShoppingBag },
      { title: "Master Layanan", url: "/master/layanan", icon: Scissors },
      { title: "Customer / Member", url: "/customer", icon: ContactRound },
    ],
  },
  {
    label: "Transaksi",
    icon: CreditCard,
    items: [
      { title: "Input Booking", url: "/booking/input", icon: CalendarPlus },
      { title: "Booked", url: "/booking/list", icon: ClipboardList },
      { title: "Kasir / Pembayaran", url: "/kasir/pembayaran", icon: CreditCard },
      { title: "Riwayat Transaksi", url: "/transaksi/riwayat", icon: ReceiptText },
    ],
  },
  {
    label: "Kas",
    icon: Wallet,
    items: [
      { title: "Tambah Uang Kas", url: "/kas/in", icon: ArrowDownCircle },
      { title: "Ambil Uang Kas", url: "/kas/out", icon: ArrowUpCircle },
    ],
  },
  {
    label: "Laporan",
    icon: BarChart3,
    items: [
      { title: "Laporan Transaksi", url: "/laporan/transaksi", icon: FileText },
      { title: "Laporan Keuangan", url: "/laporan/keuangan", icon: FileText },
      { title: "Laporan Pegawai", url: "/laporan/pegawai", icon: FileText },
      { title: "Laporan Stok", url: "/laporan/stok", icon: Boxes },
      { title: "Mutasi Stok", url: "/laporan/mutasi-stok", icon: Boxes },
    ],
  },
  {
    label: "Manage User",
    icon: UsersRound,
    items: [
      { title: "Data User", url: "/user/data", icon: UserCog },
      { title: "Hak Akses User", url: "/user/akses", icon: Shield },
    ],
  },
  {
    label: "Setting",
    icon: Settings2,
    items: [
      { title: "Setting Komisi", url: "/setting/komisi", icon: Settings },
      { title: "Setting Poin", url: "/setting/loyalty", icon: Settings },
      { title: "Data Cabang", url: "/setting/cabang", icon: Settings },
      { title: "WhatsApp Gateway", url: "/setting/whatsapp", icon: MessageCircle },
    ],
  },
];

const legacyMenuAliases: Record<string, string[]> = {
  "Customer / Member": ["Member"],
  "Setting Poin": ["Setting Loyalty"],
};

function getAllowedTitles() {
  const user = getAuthUser();
  if (!user) return null;
  if (user.level === "Owner") return null;
  return new Set(user.menuAccess || []);
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const allowedTitles = useMemo(() => getAllowedTitles(), []);
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
        {menuGroups
          .map((group) => {
            const allowedItems = allowedTitles
              ? group.items.filter((i) => {
                  if (i.url === "/dashboard") return true;
                  if (allowedTitles.has(i.title)) return true;
                  const aliases = legacyMenuAliases[i.title] || [];
                  return aliases.some((a) => allowedTitles.has(a));
                })
              : group.items;
            return { ...group, items: allowedItems };
          })
          .filter((group) => group.items.length > 0)
          .map((group) => {
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
                  <SidebarGroupLabel className="h-9 px-3 text-sm font-medium flex items-center justify-between cursor-pointer text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors">
                    <div className="flex items-center gap-2">
                      {group.icon && <group.icon className="w-4 h-4 shrink-0" />}
                      {!collapsed && <span>{group.label}</span>}
                    </div>
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
                              className={`flex items-center gap-3 ${collapsed ? "px-3" : "pl-9 pr-3"} py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors`}
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
              onClick={() => {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
                navigate("/");
              }}
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
