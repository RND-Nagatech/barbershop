import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { toast } from "@/hooks/use-toast";
import { api, type StockMovementItem } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";

export default function MutasiStok() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState<Date | undefined>(today);
  const [to, setTo] = useState<Date | undefined>(new Date(today));
  const [kode, setKode] = useState("");
  const [data, setData] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(
        await api.getStockMovements({
          from: formatLocalYmd(from),
          to: formatLocalYmd(to),
          kode: kode.trim() || undefined,
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

  return (
    <div>
      <PageHeader title="Mutasi Stok" description="Riwayat perubahan stok produk" />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <div className="flex items-center gap-2">
          <Input
            value={kode}
            autoUppercase={false}
            onChange={(e) => setKode(e.target.value)}
            placeholder="Filter kode produk (opsional)"
            className="w-[220px]"
          />
          <button
            className="h-10 rounded-md border border-input px-3 text-sm hover:bg-muted"
            type="button"
            onClick={load}
          >
            Terapkan
          </button>
        </div>
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

