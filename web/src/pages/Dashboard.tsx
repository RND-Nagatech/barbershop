import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Scissors, CalendarPlus, DollarSign } from "lucide-react";
import { api, type DashboardPayload } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const statusColor: Record<string, string> = {
  Selesai: "bg-success/10 text-success",
  Proses: "bg-warning/10 text-warning",
  Menunggu: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setPayload(await api.getDashboard());
      } catch (error) {
        toast({
          title: "Gagal memuat dashboard",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    };
    void load();
  }, []);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const stats = useMemo(
    () => [
      { label: "Total Pegawai", value: String(payload?.stats.totalPegawai ?? 0), icon: Users, color: "bg-accent/10 text-accent" },
      { label: "Layanan Tersedia", value: String(payload?.stats.layananTersedia ?? 0), icon: Scissors, color: "bg-success/10 text-success" },
      { label: "Booking Hari Ini", value: String(payload?.stats.bookingHariIni ?? 0), icon: CalendarPlus, color: "bg-primary/10 text-primary" },
      { label: "Pendapatan Hari Ini", value: formatRp(payload?.stats.pendapatanHariIni ?? 0), icon: DollarSign, color: "bg-warning/10 text-warning" },
    ],
    [payload],
  );

  const recentBookings = payload?.recentBookings ?? [];

  return (
    <div>
      <PageHeader title="Dashboard" description="Selamat datang di BarberPro" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-xl font-display font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <h2 className="font-display font-semibold text-lg mb-4">Booking Terbaru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Layanan</th>
                  <th className="pb-3 font-medium">Pegawai</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{b.id}</td>
                    <td className="py-3">{b.customer}</td>
                    <td className="py-3">{b.layanan}</td>
                    <td className="py-3">{b.pegawai}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[b.status]}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Belum ada data booking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
