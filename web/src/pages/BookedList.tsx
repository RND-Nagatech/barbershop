import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, type BookingItem, type Employee, type Service } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";

function getToday() {
  return formatLocalYmd(new Date()) ?? "";
}

export default function BookedList() {
  const [data, setData] = useState<BookingItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [status, setStatus] = useState<"Aktif" | "Menunggu" | "Proses" | "Selesai">("Aktif");

  const loadData = async () => {
    try {
      const [bookings, employeeRows] = await Promise.all([
        api.getBookings({ from, to }),
        api.getEmployees(),
      ]);
      setData(bookings);
      setEmployees(employeeRows);
      if (services.length === 0) setServices(await api.getServices());
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
    // eslint-disable-next-line
  }, [from, to]);

  const [assignTarget, setAssignTarget] = useState<{ id: string; pegawai: string } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<string | null>(null);
  const [addServiceTarget, setAddServiceTarget] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");

  const handleAssign = async () => {
    if (!assignTarget) return;
    try {
      await api.assignBooking(assignTarget.id, assignTarget.pegawai);
      await loadData();
      toast({ title: "Berhasil", description: `Booking berhasil di-assign ke ${assignTarget.pegawai}` });
    } catch (error) {
      toast({
        title: "Gagal assign booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setAssignTarget(null);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    try {
      await api.completeBooking(completeTarget);
      await loadData();
      toast({ title: "Berhasil", description: "Booking selesai" });
    } catch (error) {
      toast({
        title: "Gagal update booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setCompleteTarget(null);
    }
  };

  const handleAddService = async () => {
    if (!addServiceTarget || !selectedService) return;
    try {
      await api.addServiceToBooking(addServiceTarget, selectedService);
      await loadData();
      toast({ title: "Berhasil", description: "Layanan ditambahkan ke booking" });
    } catch (error) {
      toast({
        title: "Gagal menambah layanan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setAddServiceTarget(null);
      setSelectedService("");
    }
  };

  const statusVariant: Record<string, string> = {
    Menunggu: "bg-muted text-muted-foreground",
    Proses: "bg-warning/10 text-warning",
    Selesai: "bg-success/10 text-success",
  };

  const sortByAntrianAsc = (a: BookingItem, b: BookingItem) => (Number(a.antrian) || 0) - (Number(b.antrian) || 0);
  const menungguRows = data.filter((b) => b.status === "Menunggu").slice().sort(sortByAntrianAsc);
  const prosesRows = data.filter((b) => b.status === "Proses").slice().sort(sortByAntrianAsc);
  const selesaiRows = data.filter((b) => b.status === "Selesai").slice().sort(sortByAntrianAsc);

  const renderCards = (rows: BookingItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rows.map((b) => (
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
              <>
                <Select onValueChange={(v) => setAssignTarget({ id: b.id, pegawai: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Assign pegawai..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.nama}>{employee.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AlertDialog open={!!assignTarget && assignTarget?.id === b.id} onOpenChange={(open) => !open && setAssignTarget(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Proses booking?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div>Booking akan diproses oleh pegawai <b>{assignTarget?.pegawai}</b>. Lanjutkan?</div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAssign}>Ya, proses</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {b.status === "Proses" && (
              <div className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Pegawai:</span> <span className="font-medium">{b.employeeName}</span></p>
                <Button
                  onClick={() => setAddServiceTarget(b.id)}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  Tambah Layanan
                </Button>
                <Button onClick={() => setCompleteTarget(b.id)} className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> Selesai
                </Button>
                <AlertDialog open={completeTarget === b.id} onOpenChange={(open) => !open && setCompleteTarget(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Selesaikan booking?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div>Booking akan diselesaikan. Lanjutkan?</div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>Ya, selesai</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {b.status === "Selesai" && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Dikerjakan oleh: <span className="font-medium text-foreground">{b.employeeName || "-"}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      b.paymentStatus === "Paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {b.paymentStatus === "Paid" ? "Lunas" : "Belum bayar"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {rows.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Belum ada data booking.</CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Booked" description="Kelola antrian booking yang masuk" />
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs mb-1">Dari</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Sampai</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Menunggu">Menunggu</SelectItem>
              <SelectItem value="Proses">Proses</SelectItem>
              <SelectItem value="Selesai">Selesai</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === "Aktif" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="mb-3">
                <div className="font-display font-semibold text-lg">Menunggu</div>
                <div className="text-xs text-muted-foreground">Booking yang belum di-assign</div>
              </div>
              {renderCards(menungguRows)}
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="mb-3">
                <div className="font-display font-semibold text-lg">Proses</div>
                <div className="text-xs text-muted-foreground">Booking yang sedang dikerjakan</div>
              </div>
              {renderCards(prosesRows)}
            </CardContent>
          </Card>
        </div>
      ) : status === "Menunggu" ? (
        renderCards(menungguRows)
      ) : status === "Proses" ? (
        renderCards(prosesRows)
      ) : (
        renderCards(selesaiRows)
      )}

      <Dialog open={!!addServiceTarget} onOpenChange={(open) => (!open ? setAddServiceTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Tambah Layanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger><SelectValue placeholder="Pilih layanan..." /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.kode}>
                    {s.nama} ({s.kode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddService} disabled={!selectedService} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Tambahkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
