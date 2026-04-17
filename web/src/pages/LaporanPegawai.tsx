import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { api, type EmployeeReportRow } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatLocalYmd } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { buildPeriodeText, getActiveBranchName } from "@/lib/reportHeader";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanPegawai() {
  const getToday = () => formatLocalYmd(new Date()) ?? "";
  const [data, setData] = useState<EmployeeReportRow[]>([]);
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    void getActiveBranchName().then(setBranchName);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setData(
          await api.getEmployeeReport({
            from,
            to,
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

  const headers = ["Kode", "Nama Pegawai", "Layanan Selesai", "Total (Rp)", "Komisi"];
  const rows = data.map((d) => [d.kode, d.nama, d.layananSelesai, formatRp(d.totalRp), formatRp(d.komisi)]);

  const periodText = buildPeriodeText(from, to, getToday());
  const meta = { periodText, branchName };
  const handleExcel = () => exportToExcel("Laporan Pegawai", headers, rows, "laporan_pegawai", undefined, meta);
  const handlePDF = () => exportToPDF("Laporan Pegawai", headers, rows, "laporan_pegawai", undefined, meta);

  return (
    <div>
      <PageHeader title="Laporan Pegawai" description="Ringkasan performa dan komisi pegawai">
        <Button variant="outline" size="sm" onClick={handleExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF}>
          <FileText className="w-4 h-4 mr-2" /> PDF
        </Button>
      </PageHeader>

      <div className="mb-4">
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
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama Pegawai</th>
                  <th className="pb-3 font-medium text-center">Layanan Selesai</th>
                  <th className="pb-3 font-medium text-right">Total (Rp)</th>
                  <th className="pb-3 font-medium text-right">Komisi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.kode} className="border-b last:border-0">
                    <td className="py-3 font-medium">{d.kode}</td>
                    <td className="py-3">{d.nama}</td>
                    <td className="py-3 text-center">{d.layananSelesai}</td>
                    <td className="py-3 text-right">{formatRp(d.totalRp)}</td>
                    <td className="py-3 text-right font-medium text-accent">{formatRp(d.komisi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
