import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { api, type FinanceRowDetail, type FinanceRowRecap } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatLocalYmd } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { buildPeriodeText, getActiveBranchName } from "@/lib/reportHeader";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanKeuangan() {
  const getToday = () => formatLocalYmd(new Date()) ?? "";
  const [data, setData] = useState<Array<FinanceRowRecap | FinanceRowDetail>>([]);
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [view, setView] = useState<"recap" | "detail">("recap");
  const [jenisTrx, setJenisTrx] = useState<"all" | "layanan" | "produk" | "kas">("all");
  const [kategori, setKategori] = useState<string>("all");
  const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    void getActiveBranchName().then(setBranchName);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const cats = await api.getFinanceCategories({ from, to, jenisTrx });
        setKategoriOptions(cats);
        if (kategori !== "all" && cats.length > 0 && !cats.includes(kategori)) {
          setKategori("all");
        }
        setData(
          await api.getFinanceReport({
            from,
            to,
            view,
            jenisTrx,
            kategori: kategori !== "all" ? kategori : undefined,
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
  }, [from, to, view, jenisTrx, kategori]);

  const totals = useMemo(() => {
    const uangMasuk = data.reduce((sum, d) => sum + (Number(d.uangMasuk) || 0), 0);
    const uangKeluar = data.reduce((sum, d) => sum + (Number(d.uangKeluar) || 0), 0);
    return { uangMasuk, uangKeluar, saldoAkhir: uangMasuk - uangKeluar };
  }, [data]);

  const headers = view === "detail"
    ? ["Kategori", "Jenis Trx", "Deskripsi", "Uang Masuk", "Uang Keluar"]
    : ["Kategori", "Jenis Trx", "Uang Masuk", "Uang Keluar"];

  const rows = view === "detail"
    ? (data as FinanceRowDetail[]).map((d) => [
        d.kategori || "-",
        d.jenisTrx || "-",
        d.deskripsi || "-",
        formatRp(d.uangMasuk || 0),
        formatRp(d.uangKeluar || 0),
      ])
    : (data as FinanceRowRecap[]).map((d) => [
        d.kategori || "-",
        d.jenisTrx || "-",
        formatRp(d.uangMasuk || 0),
        formatRp(d.uangKeluar || 0),
      ]);

  const footerRows: (string | number)[][] =
    view === "detail"
      ? [
          ["TOTAL", "", "", formatRp(totals.uangMasuk), formatRp(totals.uangKeluar)],
          ["Saldo Akhir", "", "", "", formatRp(totals.saldoAkhir)],
        ]
      : [
          ["TOTAL", "", formatRp(totals.uangMasuk), formatRp(totals.uangKeluar)],
          ["Saldo Akhir", "", "", formatRp(totals.saldoAkhir)],
        ];

  const periodText = buildPeriodeText(from, to, getToday());
  const meta = { periodText, branchName };
  const handleExcel = () => exportToExcel("Laporan Keuangan", headers, rows, "laporan_keuangan", footerRows, meta);
  const handlePDF = () => exportToPDF("Laporan Keuangan", headers, rows, "laporan_keuangan", footerRows, meta);

  return (
    <div>
      <PageHeader title="Laporan Keuangan" description="Ringkasan arus kas">
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
          <label className="block text-sm mb-1">Jenis Trx</label>
          <Select value={jenisTrx} onValueChange={(v) => setJenisTrx(v as typeof jenisTrx)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="layanan">LAYANAN</SelectItem>
              <SelectItem value="produk">PRODUK</SelectItem>
              <SelectItem value="kas">KAS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-72">
          <label className="block text-sm mb-1">Kategori</label>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kategoriOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50 mb-6">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Kategori</th>
                  <th className="pb-3 font-medium">Jenis Trx</th>
                  {view === "detail" && <th className="pb-3 font-medium">Deskripsi</th>}
                  <th className="pb-3 font-medium text-right">Uang Masuk</th>
                  <th className="pb-3 font-medium text-right">Uang Keluar</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, idx) => (
                  <tr key={`${d.kategori || "X"}:${d.jenisTrx || "Y"}:${idx}`} className="border-b last:border-0">
                    <td className="py-3">{d.kategori || "-"}</td>
                    <td className="py-3 font-medium">{d.jenisTrx || "-"}</td>
                    {view === "detail" && <td className="py-3">{(d as FinanceRowDetail).deskripsi || "-"}</td>}
                    <td className="py-3 text-right">{formatRp(d.uangMasuk || 0)}</td>
                    <td className="py-3 text-right">{formatRp(d.uangKeluar || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={view === "detail" ? 3 : 2} className="py-3 font-display font-bold text-right">TOTAL</td>
                  <td className="py-3 text-right font-display font-bold text-accent">{formatRp(totals.uangMasuk)}</td>
                  <td className="py-3 text-right font-display font-bold text-destructive">{formatRp(totals.uangKeluar)}</td>
                </tr>
                <tr className="border-t">
                  <td colSpan={view === "detail" ? 3 : 2} className="py-3 font-display font-bold text-right">Saldo Akhir</td>
                  <td colSpan={2} className="py-3 text-right font-display font-bold">{formatRp(totals.saldoAkhir)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
