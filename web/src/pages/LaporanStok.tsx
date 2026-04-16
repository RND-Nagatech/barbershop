import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { api, type Product } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanStok() {
  const [data, setData] = useState<Product[]>([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    try {
      setData(await api.getProducts());
    } catch (error) {
      toast({
        title: "Gagal memuat stok",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) => `${p.kode} ${p.nama}`.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div>
      <PageHeader title="Laporan Stok" description="Ringkasan stok produk saat ini">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            autoUppercase={false}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk..."
            className="w-[260px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["Kode", "Nama Produk", "Harga", "Stok", "Min", "Status"];
              const rows = filtered.map((p) => {
                const low = (p.minStok ?? 0) > 0 && p.stok <= p.minStok;
                return [p.kode, p.nama, formatRp(p.harga), p.stok, p.minStok, low ? "Low Stock" : "OK"];
              });
              exportToExcel("Laporan Stok", headers, rows, "laporan_stok");
            }}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["Kode", "Nama Produk", "Harga", "Stok", "Min", "Status"];
              const rows = filtered.map((p) => {
                const low = (p.minStok ?? 0) > 0 && p.stok <= p.minStok;
                return [p.kode, p.nama, formatRp(p.harga), p.stok, p.minStok, low ? "Low Stock" : "OK"];
              });
              exportToPDF("Laporan Stok", headers, rows, "laporan_stok");
            }}
          >
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </PageHeader>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama Produk</th>
                  <th className="pb-3 font-medium text-right">Harga</th>
                  <th className="pb-3 font-medium text-center">Stok</th>
                  <th className="pb-3 font-medium text-center">Min</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = (p.minStok ?? 0) > 0 && p.stok <= p.minStok;
                  return (
                    <tr key={p.id} className={`border-b last:border-0 ${low ? "bg-warning/5" : ""}`}>
                      <td className="py-3 font-medium">{p.kode}</td>
                      <td className="py-3">{p.nama}</td>
                      <td className="py-3 text-right">{formatRp(p.harga)}</td>
                      <td className="py-3 text-center">{p.stok}</td>
                      <td className="py-3 text-center">{p.minStok}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${low ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                          {low ? "Low Stock" : "OK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Tidak ada data.
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
