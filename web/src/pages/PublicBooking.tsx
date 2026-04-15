import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { api, type BookingItem, type Branch, type PublicBookingStatus, type Service } from "@/lib/api";
import { saveAs } from "file-saver";
import { Loader2 } from "lucide-react";

export default function PublicBooking() {
  const [searchParams] = useSearchParams();
  const domainParam = searchParams.get("domain")?.trim() || "";
  const [branch, setBranch] = useState<Branch | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCreated, setLastCreated] = useState<BookingItem | null>(null);
  const [myBookings, setMyBookings] = useState<BookingItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PublicBookingStatus>>({});
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    namaCustomer: "",
    noHp: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const storageKey = "public_bookings:v1";

  const persistBookings = (rows: BookingItem[]) => {
    try {
      const compact = rows.map((b) => ({
        bookingCode: b.bookingCode,
        antrian: b.antrian,
        customerName: b.customerName,
        phone: b.phone,
        services: b.services,
        createdAt: b.createdAt,
      }));
      localStorage.setItem(storageKey, JSON.stringify(compact));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [branchRow, serviceRows] = await Promise.all([
          domainParam ? api.getBranchByDomain(domainParam) : api.getPublicBranch(),
          api.getServices(),
        ]);
        setBranch(branchRow);
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const rows = JSON.parse(raw) as Array<Partial<BookingItem>>;
      const hydrated = rows
        .filter((r) => typeof r.bookingCode === "string")
        .map((r) => ({
          id: String(r.bookingCode),
          bookingCode: String(r.bookingCode),
          antrian: Number(r.antrian || 0),
          customerName: String(r.customerName || ""),
          phone: String(r.phone || ""),
          employeeName: "",
          services: (r.services as any) || [],
          products: [],
          status: "Menunggu" as const,
          createdAt: String(r.createdAt || new Date().toISOString()),
          paymentStatus: "Unpaid" as const,
        }));
      setMyBookings(hydrated);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    if (myBookings.length === 0) return;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const codes = myBookings.map((b) => b.bookingCode);
        const rows = await api.getPublicBookings(codes);
        const map: Record<string, PublicBookingStatus> = {};
        rows.forEach((r) => (map[r.bookingCode] = r));
        setStatuses(map);
      } catch {
        // ignore
      } finally {
        timer = window.setTimeout(tick, 5000);
      }
    };
    void tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [myBookings]);

  useEffect(() => {
    if (myBookings.length === 0) return;
    const active = myBookings.filter((b) => (statuses[b.bookingCode]?.status ?? b.status) !== "Selesai");
    if (active.length === myBookings.length) return;
    setMyBookings(active);
    persistBookings(active);
  }, [statuses, myBookings]);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const total = useMemo(
    () => services.filter((s) => selectedServices.includes(s.kode)).reduce((sum, s) => sum + s.harga, 0),
    [services, selectedServices],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.namaCustomer || selectedServices.length === 0) {
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
        services: selected,
      });

      setLastCreated(booking);
      setMyBookings((prev) => {
        const next = [booking, ...prev.filter((b) => b.bookingCode !== booking.bookingCode)];
        persistBookings(next);
        return next;
      });
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
    setLastCreated(null);
    setForm({ namaCustomer: "", noHp: "" });
    setSelectedServices([]);
  };

  const refreshStatusesNow = async () => {
    if (myBookings.length === 0) return;
    setRefreshing(true);
    try {
      const rows = await api.getPublicBookings(myBookings.map((b) => b.bookingCode));
      const map: Record<string, PublicBookingStatus> = {};
      rows.forEach((r) => (map[r.bookingCode] = r));
      setStatuses(map);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const downloadTicketPng = async (booking: BookingItem) => {
    const padding = 24;
    const lineHeight = 22;
    const width = 720;
    const servicesLines = booking.services.length;
    const height = padding * 2 + 220 + servicesLines * lineHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TIKET ANTREAN", padding, padding + 30);

    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#374151";
    ctx.fillText(branch?.nama ? `Cabang: ${branch.nama}` : "Cabang", padding, padding + 58);
    ctx.fillText(new Date(booking.createdAt).toLocaleString("id-ID"), padding, padding + 80);

    const status = statuses[booking.bookingCode]?.status || booking.status;
    const antrian = statuses[booking.bookingCode]?.antrian || booking.antrian;
    ctx.fillStyle = "#111827";
    ctx.font = "bold 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(antrian || "-"), padding, padding + 160);

    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#111827";
    ctx.fillText(`Kode: ${booking.bookingCode}`, padding + 140, padding + 132);
    ctx.fillStyle = "#374151";
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Status: ${status}`, padding + 140, padding + 158);
    ctx.fillText(`Customer: ${booking.customerName}`, padding + 140, padding + 182);
    if (booking.phone) ctx.fillText(`No HP: ${booking.phone}`, padding + 140, padding + 206);

    // divider
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 232);
    ctx.lineTo(width - padding, padding + 232);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Layanan", padding, padding + 262);
    let y = padding + 292;
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    let totalHarga = 0;
    booking.services.forEach((s) => {
      totalHarga += s.harga || 0;
      ctx.fillStyle = "#111827";
      ctx.fillText(s.nama, padding, y);
      ctx.fillStyle = "#374151";
      ctx.textAlign = "right";
      ctx.fillText(formatRp(s.harga), width - padding, y);
      ctx.textAlign = "left";
      y += lineHeight;
    });
    ctx.strokeStyle = "#E5E7EB";
    ctx.beginPath();
    ctx.moveTo(padding, y + 6);
    ctx.lineTo(width - padding, y + 6);
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Total", padding, y + 34);
    ctx.textAlign = "right";
    ctx.fillText(formatRp(totalHarga), width - padding, y + 34);
    ctx.textAlign = "left";

    canvas.toBlob((blob) => {
      if (!blob) return;
      saveAs(blob, `tiket_${booking.bookingCode}.png`);
    }, "image/png");
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

  if (!branch) {
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
            <h1 className="text-2xl font-display font-semibold text-foreground">Booking {branch.nama}</h1>
            <p className="text-sm text-muted-foreground">{branch.alamat}</p>
          </CardContent>
        </Card>

        {myBookings.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Booking Anda</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshStatusesNow()}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
              <div className={`space-y-2 ${refreshing ? "animate-pulse" : ""}`}>
                {myBookings.map((b) => {
                  const st = statuses[b.bookingCode];
                  const status = st?.status ?? b.status;
                  if (status === "Selesai") return null;
                  return (
                    <div
                      key={b.bookingCode}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="text-sm min-w-0">
                        <div className="font-medium">{b.bookingCode}</div>
                        <div className="text-muted-foreground truncate">
                          {b.customerName ? `${b.customerName}${b.phone ? ` • ${b.phone}` : ""}` : ""}
                        </div>
                        <div className="text-muted-foreground">
                          Antrian: {st?.antrian ?? b.antrian} • Status: {status ?? "Menunggu"}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => downloadTicketPng(b)}>
                        Download PNG
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {lastCreated ? (
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Booking Berhasil</h2>
                <p className="text-sm text-muted-foreground">Kode booking: {lastCreated.bookingCode}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p>Customer: {lastCreated.customerName}</p>
                <p>Antrian: {statuses[lastCreated.bookingCode]?.antrian ?? lastCreated.antrian}</p>
                <p>Status: {statuses[lastCreated.bookingCode]?.status ?? lastCreated.status}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Layanan</p>
                <div className="space-y-1 text-sm">
                  {lastCreated.services.map((service) => (
                    <div key={service.kode} className="flex items-center justify-between">
                      <span>{service.nama}</span>
                      <span>{formatRp(service.harga)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatRp(lastCreated.services.reduce((sum, s) => sum + s.harga, 0))}</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => downloadTicketPng(lastCreated)}
                  variant="outline"
                  className="w-full"
                >
                  Download Tiket (PNG)
                </Button>
                <Button onClick={resetForm} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Tambah Booking Baru
                </Button>
              </div>
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
