import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, List } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { api, type TransactionDetailRow, type TransactionItemsResponse, type TransactionRecapResponse } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatLocalYmd } from "@/lib/date";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LaporanTransaksi() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState<Date | undefined>(today);
  const [to, setTo] = useState<Date | undefined>(new Date(today));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<TransactionRecapResponse | null>(null);
  const [details, setDetails] = useState<TransactionDetailRow[]>([]);

  const [itemsDialog, setItemsDialog] = useState<{ open: boolean; saleId: string; loading: boolean; data: TransactionItemsResponse | null }>({
    open: false,
    saleId: "",
    loading: false,
    data: null,
  });

  const fromYmd = formatLocalYmd(from);
  const toYmd = formatLocalYmd(to);

  const load = async () => {
    setLoading(true);
    try {
      const [recapRow, detailRows] = await Promise.all([
        api.getTransactionRecap({ from: fromYmd, to: toYmd }),
        api.getTransactionDetails({ from: fromYmd, to: toYmd, q: query.trim() || undefined }),
      ]);
      setRecap(recapRow);
      setDetails(detailRows);
    } catch (error) {
      toast({
        title: "Gagal memuat laporan transaksi",
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
  }, [fromYmd, toYmd]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const titleRange = useMemo(() => {
    if (fromYmd && toYmd && fromYmd === toYmd) return `Tanggal: ${fromYmd}`;
    if (fromYmd && toYmd) return `Periode: ${fromYmd} s/d ${toYmd}`;
    if (fromYmd) return `Periode: ${fromYmd} s/d ...`;
    if (toYmd) return `Periode: ... s/d ${toYmd}`;
    return "Periode: -";
  }, [fromYmd, toYmd]);

  const totals = recap?.totals || { totalTransaksi: 0, totalOmzet: 0, totalService: 0, totalProduk: 0, totalDiskon: 0 };

  const headers = ["No", "Kode Transaksi", "Customer", "Barber", "Jumlah (Rp)", "Metode", "Status"];
  const rows = details.map((d, idx) => [
    idx + 1,
    d.saleCode || d.bookingCode,
    d.customerName || "-",
    d.barber || "-",
    d.total,
    String(d.method || "CASH").toUpperCase(),
    d.status === "Paid" ? "POSTED" : "VOID",
  ]);
  const footer = ["", "", "TOTAL", "", totals.totalOmzet, "", ""];

  const handleExcel = () => exportToExcel(`Laporan Transaksi - ${titleRange}`, headers, rows, "laporan_transaksi", footer);
  const handlePDF = () => exportToPDF(`Laporan Transaksi - ${titleRange}`, headers, rows, "laporan_transaksi", footer);

  const openItems = async (saleId: string) => {
    setItemsDialog({ open: true, saleId, loading: true, data: null });
    try {
      const data = await api.getTransactionItems({ saleId });
      setItemsDialog({ open: true, saleId, loading: false, data });
    } catch (error) {
      toast({
        title: "Gagal memuat detail item",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
      setItemsDialog({ open: false, saleId: "", loading: false, data: null });
    }
  };

  return (
    <div>
      <PageHeader title="Laporan Transaksi" description="Rekap harian + detail transaksi + detail item">
        <Button variant="outline" size="sm" onClick={handleExcel} disabled={loading}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF} disabled={loading}>
          <FileText className="w-4 h-4 mr-2" /> PDF
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Input
          value={query}
          autoUppercase={false}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari: kode transaksi/booking, nama, no HP, barber..."
          className="w-[320px]"
        />
      </div>

      <Card className="border-border/50 mb-6">
        <CardContent className="p-5 space-y-2">
          <div className="text-sm text-muted-foreground">{titleRange}</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Total Transaksi</div>
              <div className="font-display font-bold text-lg tabular-nums">{totals.totalTransaksi}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Total Omzet</div>
              <div className="font-display font-bold text-lg tabular-nums">{formatRp(totals.totalOmzet)}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Total Service</div>
              <div className="font-display font-bold text-lg tabular-nums">{formatRp(totals.totalService)}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Total Produk</div>
              <div className="font-display font-bold text-lg tabular-nums">{formatRp(totals.totalProduk)}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Total Diskon</div>
              <div className="font-display font-bold text-lg tabular-nums">{formatRp(totals.totalDiskon)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-5">
          {loading ? (
            <div className="text-center text-muted-foreground p-6">Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">No</th>
                    <th className="pb-3 font-medium">Kode Transaksi</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Barber</th>
                    <th className="pb-3 font-medium text-right">Jumlah (Rp)</th>
                    <th className="pb-3 font-medium">Metode</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-3">{idx + 1}</td>
                      <td className="py-3 font-medium">{d.saleCode || d.bookingCode}</td>
                      <td className="py-3">
                        <div className="font-medium">{d.customerName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{d.customerPhone || ""}</div>
                      </td>
                      <td className="py-3">{d.barber || "-"}</td>
                      <td className="py-3 text-right tabular-nums">{formatRp(d.total)}</td>
                      <td className="py-3">{String(d.method || "CASH").toUpperCase()}</td>
                      <td className="py-3">{d.status === "Paid" ? "POSTED" : "VOID"}</td>
                      <td className="py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => void openItems(d.id)}>
                          <List className="w-4 h-4 mr-2" /> Item
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {details.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted-foreground">
                        Tidak ada transaksi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={4} className="py-3 font-display font-bold text-right">Total</td>
                    <td className="py-3 text-right font-display font-bold text-accent tabular-nums">{formatRp(totals.totalOmzet)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={itemsDialog.open} onOpenChange={(open) => (!open ? setItemsDialog({ open: false, saleId: "", loading: false, data: null }) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Detail Item Transaksi</DialogTitle>
          </DialogHeader>
          {itemsDialog.loading ? (
            <div className="text-center text-muted-foreground p-6">Memuat item...</div>
          ) : itemsDialog.data ? (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">
                  {itemsDialog.data.sale.saleCode || itemsDialog.data.sale.bookingCode}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(itemsDialog.data.sale.paidAt).toLocaleString("id-ID")} • {String(itemsDialog.data.sale.method || "CASH").toUpperCase()} • {itemsDialog.data.sale.status === "Paid" ? "POSTED" : "VOID"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Customer: {itemsDialog.data.sale.customerName || "-"} {itemsDialog.data.sale.customerPhone ? `(${itemsDialog.data.sale.customerPhone})` : ""}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">No</th>
                      <th className="pb-2 font-medium">Item Type</th>
                      <th className="pb-2 font-medium">Nama Item</th>
                      <th className="pb-2 font-medium text-center">Qty</th>
                      <th className="pb-2 font-medium text-right">Harga</th>
                      <th className="pb-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsDialog.data.items.map((it, idx) => (
                      <tr key={`${it.type}:${it.kode}:${it.isCompliment ? 1 : 0}:${idx}`} className="border-b last:border-0">
                        <td className="py-2">{idx + 1}</td>
                        <td className="py-2">{it.type === "service" ? "SERVICE" : "PRODUCT"}</td>
                        <td className="py-2">
                          {it.nama}
                          {it.type === "product" && it.isCompliment ? <span className="text-xs text-muted-foreground"> (Compliment)</span> : null}
                        </td>
                        <td className="py-2 text-center tabular-nums">{it.qty}</td>
                        <td className="py-2 text-right tabular-nums">{formatRp(it.harga)}</td>
                        <td className="py-2 text-right tabular-nums">{formatRp(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-6">Item tidak ditemukan.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

