import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { api, type FinanceRow } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanKeuangan() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [data, setData] = useState<FinanceRow[]>([]);
  const [from, setFrom] = useState<Date | undefined>(today);
  const [to, setTo] = useState<Date | undefined>(new Date(today));

  useEffect(() => {
    const load = async () => {
      try {
        setData(
          await api.getFinanceReport({
            from: from ? from.toISOString() : undefined,
            to: to ? to.toISOString() : undefined,
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
  }, [from, to]);

  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  const headers = ["Kode", "Nama Layanan", "Jumlah Transaksi", "Total (Rp)"];
  const rows = data.map((d) => [d.kode, d.nama, d.jumlah, formatRp(d.total)]);
  const footer = ["", "Grand Total", "", formatRp(grandTotal)];

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

      <div className="mb-4">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      <Card className="border-border/50 mb-6">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama Layanan</th>
                  <th className="pb-3 font-medium text-center">Jumlah Transaksi</th>
                  <th className="pb-3 font-medium text-right">Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.kode} className="border-b last:border-0">
                    <td className="py-3 font-medium">{d.kode}</td>
                    <td className="py-3">{d.nama}</td>
                    <td className="py-3 text-center">{d.jumlah}</td>
                    <td className="py-3 text-right">{formatRp(d.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={3} className="py-3 font-display font-bold text-right">Grand Total</td>
                  <td className="py-3 text-right font-display font-bold text-accent">{formatRp(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
