import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Scissors, CalendarPlus, DollarSign } from "lucide-react";

const stats = [
  { label: "Total Pegawai", value: "8", icon: Users, color: "bg-accent/10 text-accent" },
  { label: "Layanan Tersedia", value: "12", icon: Scissors, color: "bg-success/10 text-success" },
  { label: "Booking Hari Ini", value: "24", icon: CalendarPlus, color: "bg-primary/10 text-primary" },
  { label: "Pendapatan Hari Ini", value: "Rp 1.850.000", icon: DollarSign, color: "bg-warning/10 text-warning" },
];

const recentBookings = [
  { id: "BK001", customer: "Ahmad", layanan: "Haircut + Wash", pegawai: "Rizky", status: "Selesai" },
  { id: "BK002", customer: "Budi", layanan: "Shaving", pegawai: "Dimas", status: "Proses" },
  { id: "BK003", customer: "Charlie", layanan: "Hair Coloring", pegawai: "Rizky", status: "Menunggu" },
  { id: "BK004", customer: "David", layanan: "Haircut", pegawai: "Andi", status: "Menunggu" },
];

const statusColor: Record<string, string> = {
  Selesai: "bg-success/10 text-success",
  Proses: "bg-warning/10 text-warning",
  Menunggu: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
