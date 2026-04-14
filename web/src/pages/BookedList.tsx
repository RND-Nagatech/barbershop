import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, type BookingItem, type Employee } from "@/lib/api";

export default function BookedList() {
  const [data, setData] = useState<BookingItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const loadData = async () => {
    try {
      const [bookings, employeeRows] = await Promise.all([api.getBookings(), api.getEmployees()]);
      setData(bookings);
      setEmployees(employeeRows);
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAssign = async (id: string, pegawai: string) => {
    try {
      await api.assignBooking(id, pegawai);
      await loadData();
      toast({ title: "Berhasil", description: `Booking berhasil di-assign ke ${pegawai}` });
    } catch (error) {
      toast({
        title: "Gagal assign booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.completeBooking(id);
      await loadData();
      toast({ title: "Berhasil", description: "Booking selesai" });
    } catch (error) {
      toast({
        title: "Gagal update booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
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
                  <p className="text-sm text-muted-foreground">{b.bookingCode}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{b.customerName}</span></p>
                <div className="flex flex-wrap gap-1">
                  {b.services.map((l) => (
                    <Badge key={l.kode} variant="secondary" className="text-xs">{l.nama}</Badge>
                  ))}
                </div>
              </div>

              {b.status === "Menunggu" && (
                <Select onValueChange={(v) => handleAssign(b.id, v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Assign pegawai..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.nama}>{employee.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {b.status === "Proses" && (
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Pegawai:</span> <span className="font-medium">{b.employeeName}</span></p>
                  <Button onClick={() => handleComplete(b.id)} className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm">
                    <CheckCircle className="w-4 h-4 mr-2" /> Selesai
                  </Button>
                </div>
              )}

              {b.status === "Selesai" && (
                <p className="text-sm text-muted-foreground">Dikerjakan oleh: <span className="font-medium text-foreground">{b.employeeName || "-"}</span></p>
              )}
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-6 text-center text-muted-foreground">Belum ada data booking.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
