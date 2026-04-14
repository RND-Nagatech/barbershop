import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";

const data = [
  { kode: "PGW001", nama: "Rizky Pratama", layananSelesai: 25, totalRp: 1500000, komisi: 225000 },
  { kode: "PGW002", nama: "Dimas Saputra", layananSelesai: 20, totalRp: 1200000, komisi: 180000 },
  { kode: "PGW003", nama: "Andi Wijaya", layananSelesai: 18, totalRp: 980000, komisi: 147000 },
];

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanPegawai() {
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const headers = ["Kode", "Nama Pegawai", "Layanan Selesai", "Total (Rp)", "Komisi"];
  const rows = data.map((d) => [d.kode, d.nama, d.layananSelesai, formatRp(d.totalRp), formatRp(d.komisi)]);

  const handleExcel = () => exportToExcel("Laporan Pegawai", headers, rows, "laporan_pegawai");
  const handlePDF = () => exportToPDF("Laporan Pegawai", headers, rows, "laporan_pegawai");

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
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
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
