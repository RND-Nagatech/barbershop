import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  antrian: number;
  customer: string;
  layanan: string[];
  pegawai: string;
  status: "Menunggu" | "Proses" | "Selesai";
}

export default function BookedList() {
  const [data, setData] = useState<Booking[]>([
    { id: "BK001", antrian: 1, customer: "Ahmad", layanan: ["Haircut", "Hair Wash"], pegawai: "", status: "Menunggu" },
    { id: "BK002", antrian: 2, customer: "Budi", layanan: ["Shaving"], pegawai: "", status: "Menunggu" },
    { id: "BK003", antrian: 3, customer: "Charlie", layanan: ["Hair Coloring"], pegawai: "Rizky Pratama", status: "Proses" },
    { id: "BK004", antrian: 4, customer: "David", layanan: ["Haircut", "Shaving"], pegawai: "Dimas Saputra", status: "Selesai" },
  ]);

  const handleAssign = (id: string, pegawai: string) => {
    setData(data.map((d) => (d.id === id ? { ...d, pegawai, status: "Proses" as const } : d)));
    toast({ title: "Berhasil", description: `Booking ${id} di-assign ke ${pegawai}` });
  };

  const handleComplete = (id: string) => {
    setData(data.map((d) => (d.id === id ? { ...d, status: "Selesai" as const } : d)));
    toast({ title: "Berhasil", description: `Booking ${id} selesai` });
  };

  const statusVariant: Record<string, string> = {
    Menunggu: "bg-muted text-muted-foreground",
    Proses: "bg-warning/10 text-warning",
    Selesai: "bg-success/10 text-success",
  };

  return (
    <div>
      <PageHeader title="Booked" description="Kelola antrian booking yang masuk" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((b) => (
          <Card key={b.id} className={`border-border/50 ${b.status === "Selesai" ? "opacity-60" : ""}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl font-bold text-accent">#{b.antrian}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusVariant[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{b.id}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{b.customer}</span></p>
                <div className="flex flex-wrap gap-1">
                  {b.layanan.map((l) => (
                    <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                  ))}
                </div>
              </div>

              {b.status === "Menunggu" && (
                <Select onValueChange={(v) => handleAssign(b.id, v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Assign pegawai..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rizky Pratama">Rizky Pratama</SelectItem>
                    <SelectItem value="Dimas Saputra">Dimas Saputra</SelectItem>
                    <SelectItem value="Andi Wijaya">Andi Wijaya</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {b.status === "Proses" && (
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Pegawai:</span> <span className="font-medium">{b.pegawai}</span></p>
                  <Button onClick={() => handleComplete(b.id)} className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm">
                    <CheckCircle className="w-4 h-4 mr-2" /> Selesai
                  </Button>
                </div>
              )}

              {b.status === "Selesai" && (
                <p className="text-sm text-muted-foreground">Dikerjakan oleh: <span className="font-medium text-foreground">{b.pegawai}</span></p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
