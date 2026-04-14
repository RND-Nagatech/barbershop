import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { api, type BookingItem, type Branch, type Employee, type Service } from "@/lib/api";

export default function PublicBooking() {
  const [searchParams] = useSearchParams();
  const domainParam = searchParams.get("domain")?.trim() || "";
  const [branch, setBranch] = useState<Branch | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<BookingItem | null>(null);

  const [form, setForm] = useState({
    namaCustomer: "",
    noHp: "",
    pegawai: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!domainParam) {
        setLoading(false);
        return;
      }

      try {
        const [branchRow, employeeRows, serviceRows] = await Promise.all([
          api.getBranchByDomain(domainParam),
          api.getEmployees(),
          api.getServices(),
        ]);
        setBranch(branchRow);
        setEmployees(employeeRows);
        setServices(serviceRows);
      } catch (error) {
        toast({
          title: "Gagal memuat data",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [domainParam]);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const total = useMemo(
    () => services.filter((s) => selectedServices.includes(s.kode)).reduce((sum, s) => sum + s.harga, 0),
    [services, selectedServices],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.namaCustomer || !form.pegawai || selectedServices.length === 0) {
      toast({ title: "Error", description: "Lengkapi semua data booking", variant: "destructive" });
      return;
    }

    try {
      const selected = services
        .filter((s) => selectedServices.includes(s.kode))
        .map((s) => ({ kode: s.kode, nama: s.nama, harga: s.harga }));

      const booking = await api.createBooking({
        customerName: form.namaCustomer,
        phone: form.noHp,
        employeeName: form.pegawai,
        services: selected,
        branchDomain: domainParam,
      });

      setCreated(booking);
      toast({ title: "Berhasil", description: `Booking ${booking.bookingCode} berhasil disimpan` });
    } catch (error) {
      toast({
        title: "Gagal menyimpan booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const toggleService = (kode: string) => {
    setSelectedServices((prev) => (prev.includes(kode) ? prev.filter((id) => id !== kode) : [...prev, kode]));
  };

  const resetForm = () => {
    setCreated(null);
    setForm({ namaCustomer: "", noHp: "", pegawai: "" });
    setSelectedServices([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Memuat data booking...</CardContent>
        </Card>
      </div>
    );
  }

  if (!domainParam || !branch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Cabang tidak ditemukan.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-2">
            <h1 className="text-2xl font-display font-semibold text-foreground">Booking Cabang {branch.nama}</h1>
            <p className="text-sm text-muted-foreground">{branch.alamat}</p>
          </CardContent>
        </Card>

        {created ? (
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Booking Berhasil</h2>
                <p className="text-sm text-muted-foreground">Kode booking: {created.bookingCode}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p>Customer: {created.customerName}</p>
                <p>Pegawai: {created.employeeName}</p>
                <p>Antrian: {created.antrian}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Layanan</p>
                <div className="space-y-1 text-sm">
                  {created.services.map((service) => (
                    <div key={service.kode} className="flex items-center justify-between">
                      <span>{service.nama}</span>
                      <span>{formatRp(service.harga)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatRp(created.services.reduce((sum, s) => sum + s.harga, 0))}</span>
                </div>
              </div>
              <Button onClick={resetForm} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Buat Booking Baru
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Customer</Label>
                  <Input value={form.namaCustomer} onChange={(e) => setForm({ ...form, namaCustomer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>No. HP</Label>
                  <Input value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} />
                </div>
                {/* Input pegawai disembunyikan, assign dilakukan di menu Booked */}
                <div className="space-y-2">
                  <Label>Pilih Layanan</Label>
                  <div className="space-y-2">
                    {services.map((service) => (
                      <label key={service.kode} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedServices.includes(service.kode)}
                            onCheckedChange={() => toggleService(service.kode)}
                          />
                          <div>
                            <p className="text-sm font-medium">{service.nama}</p>
                            <p className="text-xs text-muted-foreground">{service.kode}</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium">{formatRp(service.harga)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
                  <span>Total</span>
                  <span className="font-semibold">{formatRp(total)}</span>
                </div>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Simpan Booking
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
