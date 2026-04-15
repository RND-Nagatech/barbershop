import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getAuthUser } from "@/lib/api";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) return;
    if (user.level === "Owner" || user.level === "Admin") return;

    const allowed = new Set(user.menuAccess || []);
    const path = location.pathname;

    const routeToMenuTitle: Array<[RegExp, string]> = [
      [/^\/dashboard$/, "Dashboard"],
      [/^\/master\/pegawai/, "Master Pegawai"],
      [/^\/master\/layanan/, "Master Layanan"],
      [/^\/master\/produk/, "Master Produk"],
      [/^\/customer/, "Customer / Member"],
      [/^\/booking\/input/, "Input Booking"],
      [/^\/booking\/list/, "Booked"],
      [/^\/kasir\/pembayaran/, "Kasir / Pembayaran"],
      [/^\/transaksi\/riwayat/, "Riwayat Transaksi"],
      [/^\/laporan\/keuangan/, "Laporan Keuangan"],
      [/^\/laporan\/pegawai/, "Laporan Pegawai"],
      [/^\/laporan\/stok/, "Laporan Stok"],
      [/^\/laporan\/mutasi-stok/, "Mutasi Stok"],
      [/^\/user\/data/, "Data User"],
      [/^\/user\/akses/, "Hak Akses User"],
      [/^\/setting\/komisi/, "Setting Komisi"],
      [/^\/setting\/loyalty/, "Setting Loyalty"],
      [/^\/setting\/whatsapp/, "WhatsApp Gateway"],
    ];

    const match = routeToMenuTitle.find(([re]) => re.test(path));
    if (!match) return;
    const title = match[1];
    if (title === "Dashboard") return;
    if (!allowed.has(title)) navigate("/dashboard", { replace: true });
  }, [location.pathname, navigate]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b px-4 bg-card shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
