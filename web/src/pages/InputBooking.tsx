import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { api, type Employee, type Service } from "@/lib/api";

export default function InputBooking() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [layananList, setLayananList] = useState<Service[]>([]);
  const [form, setForm] = useState({
    namaCustomer: "",
    noHp: "",
    pegawai: "",
  });
  const [selectedLayanan, setSelectedLayanan] = useState<string[]>([]);
  const [antrian, setAntrian] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [employeeRows, serviceRows, preview] = await Promise.all([
          api.getEmployees(),
          api.getServices(),
          api.getQueuePreview(),
        ]);
        setEmployees(employeeRows);
        setLayananList(serviceRows);
        setAntrian(preview.nextAntrian);
      } catch (error) {
        toast({
          title: "Gagal memuat data",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    };

    void load();
  }, []);

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const total = layananList.filter((l) => selectedLayanan.includes(l.kode)).reduce((sum, l) => sum + l.harga, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.namaCustomer || !selectedLayanan.length) {
      toast({ title: "Error", description: "Lengkapi semua data booking", variant: "destructive" });
      return;
    }

    try {
      const selectedServices = layananList
        .filter((l) => selectedLayanan.includes(l.kode))
        .map((l) => ({ kode: l.kode, nama: l.nama, harga: l.harga }));

      const created = await api.createBooking({
        customerName: form.namaCustomer,
        phone: form.noHp,
        employeeName: form.pegawai,
        services: selectedServices,
      });

      toast({ title: "Berhasil", description: `Booking ${created.bookingCode} untuk ${form.namaCustomer} berhasil disimpan` });
      setAntrian((await api.getQueuePreview()).nextAntrian);
      setForm({ namaCustomer: "", noHp: "", pegawai: "" });
      setSelectedLayanan([]);
    } catch (error) {
      toast({
        title: "Gagal menyimpan booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const toggleLayanan = (kode: string) => {
    setSelectedLayanan((prev) =>
      prev.includes(kode) ? prev.filter((k) => k !== kode) : [...prev, kode]
    );
  };

  return (
    <div>
      <PageHeader title="Input Booking" description="Buat booking baru untuk customer" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Customer</Label>
                    <Input value={form.namaCustomer} onChange={(e) => setForm({ ...form, namaCustomer: e.target.value })} placeholder="Nama lengkap" />
                  </div>
                  <div className="space-y-2">
                    <Label>No. HP/WA</Label>
                    <Input value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>

                {/* Input pegawai disembunyikan, assign dilakukan di menu Booked */}

                <div className="space-y-3">
                  <Label>Pilih Layanan</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {layananList.map((l) => (
                      <label
                        key={l.kode}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedLayanan.includes(l.kode) ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                        }`}
                      >
                        <Checkbox
                          checked={selectedLayanan.includes(l.kode)}
                          onCheckedChange={() => toggleLayanan(l.kode)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{l.nama}</p>
                          <p className="text-xs text-muted-foreground">{formatRp(l.harga)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Simpan Booking
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-border/50 sticky top-6">
            <CardContent className="p-5">
              <h3 className="font-display font-semibold text-lg mb-4">Ringkasan</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Antrian</span>
                  <span className="font-display text-2xl font-bold text-accent">{antrian}</span>
                </div>
                <hr className="border-border" />
                {selectedLayanan.length > 0 ? (
                  layananList
                    .filter((l) => selectedLayanan.includes(l.kode))
                    .map((l) => (
                      <div key={l.kode} className="flex justify-between">
                        <span>{l.nama}</span>
                        <span>{formatRp(l.harga)}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-center py-2">Belum ada layanan dipilih</p>
                )}
                <hr className="border-border" />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{formatRp(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
