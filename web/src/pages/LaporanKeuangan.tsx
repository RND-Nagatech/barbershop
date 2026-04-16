import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { api, type FinanceRow, type Product, type Service } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatLocalYmd } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanKeuangan() {
  const getToday = () => formatLocalYmd(new Date()) ?? "";
  const [data, setData] = useState<FinanceRow[]>([]);
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [view, setView] = useState<"recap" | "detail">("recap");
  const [jenis, setJenis] = useState<"all" | "service" | "product" | "cash_in" | "cash_out">("all");
  const [kode, setKode] = useState<string>("all");
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (services.length === 0) setServices(await api.getServices());
        if (products.length === 0) setProducts(await api.getProducts());
        setData(
          await api.getFinanceReport({
            from,
            to,
            view,
            jenis,
            kode: jenis === "service" || jenis === "product" ? (kode !== "all" ? kode : undefined) : undefined,
          }),
        );
      } catch (error) {
        toast({
          title: "Gagal memuat laporan",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    };

    void load();
  }, [from, to, view, jenis, kode]);

  useEffect(() => {
    setKode("all");
  }, [jenis]);

  const totals = useMemo(() => {
    const jumlahIn = data.reduce((sum, d) => sum + (Number(d.jumlahIn) || 0), 0);
    const jumlahOut = data.reduce((sum, d) => sum + (Number(d.jumlahOut) || 0), 0);
    return { jumlahIn, jumlahOut };
  }, [data]);

  const headers = view === "detail"
    ? ["Tipe", "Kode", "Nama", "Jumlah", "Jumlah In", "Jumlah Out", "Deskripsi"]
    : ["Tipe", "Kode", "Nama", "Jumlah", "Jumlah In", "Jumlah Out"];

  const rows =
    view === "detail"
      ? data.map((d) => [d.tipe || "-", d.kode, d.nama, d.jumlah, formatRp(d.jumlahIn), formatRp(d.jumlahOut), d.deskripsi || "-"])
      : data.map((d) => [d.tipe || "-", d.kode, d.nama, d.jumlah, formatRp(d.jumlahIn), formatRp(d.jumlahOut)]);

  const footer = view === "detail"
    ? ["", "", "TOTAL", "", formatRp(totals.jumlahIn), formatRp(totals.jumlahOut), ""]
    : ["", "", "TOTAL", "", formatRp(totals.jumlahIn), formatRp(totals.jumlahOut)];

  const handleExcel = () => exportToExcel("Laporan Keuangan", headers, rows, "laporan_keuangan", footer);
  const handlePDF = () => exportToPDF("Laporan Keuangan", headers, rows, "laporan_keuangan", footer);

  return (
    <div>
      <PageHeader title="Laporan Keuangan" description="Ringkasan pendapatan per layanan">
        <Button variant="outline" size="sm" onClick={handleExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF}>
          <FileText className="w-4 h-4 mr-2" /> PDF
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs mb-1">Dari</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" autoUppercase={false} />
          </div>
          <div>
            <label className="block text-xs mb-1">Sampai</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" autoUppercase={false} />
          </div>
        </div>

        <div className="w-56">
          <label className="block text-sm mb-1">Type Laporan</label>
          <Select value={view} onValueChange={(v) => setView(v as "recap" | "detail")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recap">Rekap</SelectItem>
              <SelectItem value="detail">Detail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <label className="block text-sm mb-1">Jenis Transaksi</label>
          <Select value={jenis} onValueChange={(v) => setJenis(v as typeof jenis)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="service">Layanan</SelectItem>
              <SelectItem value="product">Produk</SelectItem>
              <SelectItem value="cash_in">Tambah Kas</SelectItem>
              <SelectItem value="cash_out">Ambil Kas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {jenis === "service" && (
          <div className="w-72">
            <label className="block text-sm mb-1">Jenis Layanan</label>
            <Select value={kode} onValueChange={setKode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.kode}>
                    {s.nama} ({s.kode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {jenis === "product" && (
          <div className="w-72">
            <label className="block text-sm mb-1">Jenis Produk</label>
            <Select value={kode} onValueChange={setKode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.kode}>
                    {p.nama} ({p.kode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="border-border/50 mb-6">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Tipe</th>
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama</th>
                  <th className="pb-3 font-medium text-center">Jumlah</th>
                  <th className="pb-3 font-medium text-right">Jumlah In</th>
                  <th className="pb-3 font-medium text-right">Jumlah Out</th>
                  {view === "detail" && <th className="pb-3 font-medium">Deskripsi</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((d, idx) => (
                  <tr key={`${d.tipe || "X"}:${d.kode}:${idx}`} className="border-b last:border-0">
                    <td className="py-3">{d.tipe || "-"}</td>
                    <td className="py-3 font-medium">{d.kode}</td>
                    <td className="py-3">{d.nama}</td>
                    <td className="py-3 text-center">{d.jumlah}</td>
                    <td className="py-3 text-right">{formatRp(d.jumlahIn)}</td>
                    <td className="py-3 text-right">{formatRp(d.jumlahOut)}</td>
                    {view === "detail" && <td className="py-3">{d.deskripsi || "-"}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={4} className="py-3 font-display font-bold text-right">TOTAL</td>
                  <td className="py-3 text-right font-display font-bold text-accent">{formatRp(totals.jumlahIn)}</td>
                  <td className="py-3 text-right font-display font-bold text-destructive">{formatRp(totals.jumlahOut)}</td>
                  {view === "detail" && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
