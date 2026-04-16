import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { api, type SaleDetail, type SaleListItem } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";
import { buildReceiptText, generateReceiptPdf, openEmailReceipt, openReceiptPrintWindow, openWhatsAppReceipt, type ReceiptData } from "@/lib/receiptUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function RiwayatTransaksi() {
  const getToday = () => formatLocalYmd(new Date()) ?? "";
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [query, setQuery] = useState("");
  const [includeVoid, setIncludeVoid] = useState(false);
  const [data, setData] = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [email, setEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.getSales({
        from,
        to,
        q: query.trim() || undefined,
        includeVoid,
      });
      setData(rows);
    } catch (error) {
      toast({
        title: "Gagal memuat riwayat",
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
  }, [from, to, includeVoid]);

  const openDetail = async (id: string) => {
    try {
      const row = await api.getSaleById(id);
      setDetail(row);
      setEmail("");
    } catch (error) {
      toast({
        title: "Gagal memuat detail",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const receiptData: ReceiptData | null = useMemo(() => {
    if (!detail) return null;
    return {
      bookingCode: detail.saleCode || detail.bookingCode,
      paidAt: detail.paidAt,
      items: detail.items,
      total: detail.total,
      received: detail.received,
      change: detail.change,
    };
  }, [detail]);

  return (
    <div>
      <PageHeader title="Riwayat Transaksi" description="Daftar transaksi yang sudah dibayar">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            autoUppercase={false}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari: kode transaksi/booking, customer, no HP, barber..."
            className="w-[260px]"
          />
          <Button variant="outline" onClick={load}>
            Cari
          </Button>
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={includeVoid} onCheckedChange={(v) => setIncludeVoid(Boolean(v))} />
          Tampilkan yang di-void
        </label>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">No Booking</th>
                  <th className="pb-3 font-medium">Barber</th>
                  <th className="pb-3 font-medium">Tanggal</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                ) : (
                  data.map((s) => (
                    <tr key={s.id} className={`border-b last:border-0 ${s.status === "Void" ? "opacity-60" : ""}`}>
                      <td className="py-3 font-medium">{s.saleCode || s.bookingCode}</td>
                      <td className="py-3">{s.employeeName || "-"}</td>
                      <td className="py-3">{new Date(s.paidAt).toLocaleString("id-ID")}</td>
                      <td className="py-3 text-right">{formatRp(s.total)}</td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openDetail(s.id)}>
                          Reprint
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Tidak ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => (!open ? setDetail(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Struk {detail?.saleCode || detail?.bookingCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-muted-foreground text-xs">{detail ? new Date(detail.paidAt).toLocaleString("id-ID") : ""}</div>
            {(detail?.customerName || detail?.customerPhone) && (
              <div className="text-sm">
                <span className="text-muted-foreground">Customer:</span>{" "}
                <span className="font-medium text-foreground">{detail?.customerName || "-"}</span>{" "}
                {detail?.customerPhone ? <span className="text-muted-foreground">({detail.customerPhone})</span> : null}
              </div>
            )}
            {detail?.status === "Void" && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning text-xs">
                VOID{detail.voidedAt ? ` • ${new Date(detail.voidedAt).toLocaleString("id-ID")}` : ""}{detail.voidReason ? ` • ${detail.voidReason}` : ""}
              </div>
            )}
            <div className="space-y-1">
              {(detail?.items || []).map((it) => (
                <div key={`${it.type}:${it.kode}`} className="flex justify-between gap-2">
                  <span className="truncate">{it.nama} x{it.qty}</span>
                  <span>{formatRp(it.harga * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium border-t pt-3">
              <span>Total</span>
              <span className="text-foreground tabular-nums">{formatRp(detail?.total || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dibayar</span>
              <span className="text-foreground tabular-nums">{formatRp(detail?.received || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kembalian</span>
              <span className="text-foreground tabular-nums">{formatRp(detail?.change || 0)}</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={email}
              autoUppercase={false}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (opsional)"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
            {detail?.status !== "Void" && (
              <Button variant="destructive" onClick={() => { setVoidReason(""); setVoidOpen(true); }}>
                Void
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (!detail || !receiptData) return;
                const ok = openWhatsAppReceipt(detail.customerPhone || "", buildReceiptText(receiptData));
                if (!ok) toast({ title: "No. HP tidak valid", description: "Tidak ada No. HP customer di transaksi ini.", variant: "destructive" });
              }}
            >
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!receiptData) return;
                const ok = openEmailReceipt(email, `Struk ${receiptData.bookingCode}`, buildReceiptText(receiptData));
                if (!ok) toast({ title: "Email kosong", description: "Isi email dulu.", variant: "destructive" });
              }}
            >
              Email
            </Button>
            <Button variant="outline" onClick={() => receiptData && openReceiptPrintWindow(receiptData)} disabled={!receiptData}>
              Print
            </Button>
            <Button onClick={() => receiptData && generateReceiptPdf(receiptData)} disabled={!receiptData} className="bg-accent text-accent-foreground hover:bg-accent/90">
              PDF
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void transaksi {detail?.saleCode || detail?.bookingCode}?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Stok produk (jika ada) akan dikembalikan, dan booking jadi bisa dibayar ulang.</div>
            <Input value={voidReason} autoUppercase={false} onChange={(e) => setVoidReason(e.target.value)} placeholder="Alasan void (opsional)" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!detail) return;
                try {
                  await api.voidSale(detail.id, voidReason);
                  toast({ title: "Berhasil", description: "Transaksi di-void" });
                  setVoidOpen(false);
                  setDetail(null);
                  await load();
                } catch (error) {
                  toast({
                    title: "Gagal void",
                    description: error instanceof Error ? error.message : "Terjadi kesalahan",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
