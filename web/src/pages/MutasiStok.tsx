import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { api, type Product, type StockMovementItem } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { Input } from "@/components/ui/input";
import { buildPeriodeText, getActiveBranchName } from "@/lib/reportHeader";

export default function MutasiStok() {
  const getToday = () => formatLocalYmd(new Date()) || "";
  const [from, setFrom] = useState<string>(getToday());
  const [to, setTo] = useState<string>(getToday());
  const [kode, setKode] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    void getActiveBranchName().then(setBranchName);
  }, []);

  const selectedKode = kode !== "all" ? kode : "";

  const load = async () => {
    setLoading(true);
    try {
      if (products.length === 0) setProducts(await api.getProducts());
      setData(
        await api.getStockMovements({
          from: from.trim() || undefined,
          to: to.trim() || undefined,
          kode: selectedKode.trim() || undefined,
        }),
      );
    } catch (error) {
      toast({
        title: "Gagal memuat mutasi stok",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const exportHeaders = ["Tanggal", "Kode", "Nama", "Delta", "Reason", "Ref"];
  const exportRows = useMemo(
    () =>
      data.map((m) => [
        m.ymd,
        m.kode,
        m.nama,
        m.delta,
        m.reason,
        m.refBookingCode || "-",
      ]),
    [data],
  );

  const periodText = buildPeriodeText(from, to, getToday());
  const meta = { periodText, branchName };
  const handleExcel = () => exportToExcel("Mutasi Stok", exportHeaders, exportRows, "mutasi_stok", undefined, meta);
  const handlePDF = () => exportToPDF("Mutasi Stok", exportHeaders, exportRows, "mutasi_stok", undefined, meta);

  return (
    <div>
      <PageHeader title="Mutasi Stok" description="Riwayat perubahan stok produk">
        <Button variant="outline" size="sm" onClick={handleExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF}>
          <FileText className="w-4 h-4 mr-2" /> PDF
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs mb-1">Dari</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Sampai</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Kode Produk</label>
          <Select value={kode} onValueChange={setKode}>
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.kode}>
                  {p.kode} - {p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={load}>
          Terapkan
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Tanggal</th>
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama</th>
                  <th className="pb-3 font-medium text-right">Delta</th>
                  <th className="pb-3 font-medium">Reason</th>
                  <th className="pb-3 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                ) : (
                  data.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3">{m.ymd}</td>
                      <td className="py-3 font-medium">{m.kode}</td>
                      <td className="py-3">{m.nama}</td>
                      <td className={`py-3 text-right font-medium ${m.delta < 0 ? "text-destructive" : "text-success"}`}>
                        {m.delta > 0 ? `+${m.delta}` : String(m.delta)}
                      </td>
                      <td className="py-3">{m.reason}</td>
                      <td className="py-3">{m.refBookingCode || "-"}</td>
                    </tr>
                  ))
                )}
                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Tidak ada data mutasi.
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
