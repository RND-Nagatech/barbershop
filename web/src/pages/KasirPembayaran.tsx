import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { api, type BookingItem, type PayResponse, type Product } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";
import { buildReceiptText, generateReceiptPdf, openEmailReceipt, openReceiptPrintWindow, openWhatsAppReceipt } from "@/lib/receiptUtils";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatRupiahInput = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
};

const sanitizeRupiahInput = (value: string) => String(value || "").replace(/\D/g, "");

function sumServiceTotal(booking: BookingItem) {
  return booking.services.reduce((sum, s) => sum + (Number(s.harga) || 0), 0);
}

function sumProductTotal(booking: BookingItem) {
  return (booking.products || []).reduce((sum, p) => {
    if (p.isCompliment) return sum;
    return sum + (Number(p.harga) || 0) * (Number(p.qty) || 0);
  }, 0);
}

function sumGrandTotal(booking: BookingItem) {
  return sumServiceTotal(booking) + sumProductTotal(booking);
}

export default function KasirPembayaran() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState<Date | undefined>(today);
  const [to, setTo] = useState<Date | undefined>(new Date(today));
  const [data, setData] = useState<BookingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [payTarget, setPayTarget] = useState<BookingItem | null>(null);
  const [received, setReceived] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productQty, setProductQty] = useState("1");
  const [productIsCompliment, setProductIsCompliment] = useState(false);
  const [receipt, setReceipt] = useState<{
    bookingCode: string;
    paidAt: string;
    customerName: string;
    customerPhone: string;
    items: Array<{ type: "service" | "product"; kode: string; nama: string; harga: number; qty: number; isCompliment?: boolean }>;
    total: number;
    received: number;
    change: number;
  } | null>(null);
  const [email, setEmail] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await api.getBookings({
        from: formatLocalYmd(from),
        to: formatLocalYmd(to),
        status: "Selesai",
        paymentStatus: "Unpaid",
      });
      setData(rows);
      if (products.length === 0) setProducts(await api.getProducts());
    } catch (error) {
      toast({
        title: "Gagal memuat data kasir",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((b) => {
      const haystack = [b.bookingCode, b.customerName, b.phone, b.employeeName].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [data, query]);

  const totalServices = useMemo(() => (payTarget ? sumServiceTotal(payTarget) : 0), [payTarget]);
  const totalProducts = useMemo(() => (payTarget ? sumProductTotal(payTarget) : 0), [payTarget]);
  const grandTotal = totalServices + totalProducts;
  const receivedNum = Number(received || 0);
  const change = receivedNum - grandTotal;

  const openPay = (b: BookingItem) => {
    setPayTarget(b);
    const nextTotal = sumGrandTotal(b);
    setReceived(String(nextTotal));
    setSelectedProduct("");
    setProductQty("1");
    setProductIsCompliment(false);
  };

  const addProduct = async () => {
    if (!payTarget || !selectedProduct) return;
    const qty = Number(productQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Error", description: "Qty tidak valid", variant: "destructive" });
      return;
    }
    try {
      const updated = await api.addProductToBooking(payTarget.id, selectedProduct, qty, productIsCompliment);
      setPayTarget({ ...payTarget, products: updated.products });
      await loadData();
      toast({ title: "Berhasil", description: "Produk ditambahkan" });
    } catch (error) {
      toast({
        title: "Gagal tambah produk",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const removeProduct = async (kode: string, isCompliment?: boolean) => {
    if (!payTarget) return;
    try {
      const updated = await api.removeProductFromBooking(payTarget.id, kode, isCompliment);
      setPayTarget({ ...payTarget, products: updated.products });
      await loadData();
      toast({ title: "Berhasil", description: "Produk dihapus" });
    } catch (error) {
      toast({
        title: "Gagal hapus produk",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const handlePay = async () => {
    if (!payTarget) return;
    try {
      const nominal = Number(received);
      if (!Number.isFinite(nominal) || nominal < 0) {
        toast({ title: "Error", description: "Nominal uang diterima tidak valid", variant: "destructive" });
        return;
      }
      const paid: PayResponse = await api.payBooking(payTarget.id, nominal);
      setReceipt({
        bookingCode: paid.bookingCode,
        paidAt: paid.paidAt,
        items: paid.items || [],
        total: paid.total,
        received: paid.received,
        change: paid.change,
        customerName: paid.customerName || "",
        customerPhone: paid.customerPhone || "",
      });
      toast({ title: "Berhasil", description: `Booking ${payTarget.bookingCode} sudah lunas` });
      setPayTarget(null);
      setReceived("");
      setEmail("");
      await loadData();
    } catch (error) {
      toast({
        title: "Gagal pembayaran",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Kasir / Pembayaran" description="Selesaikan pembayaran booking yang sudah dikerjakan">
        <Input
          value={query}
          autoUppercase={false}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari: kode booking, nama, no HP, barber..."
          className="w-[280px]"
        />
      </PageHeader>

      <div className="mb-4">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Memuat data...</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const bookingTotal = sumGrandTotal(b);
            return (
              <Card key={b.id} className="border-border/50">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{b.bookingCode}</p>
                      <p className="font-medium">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground">{b.phone || "Tanpa No. HP"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-display font-bold text-accent">{formatRp(bookingTotal)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {b.services.map((s) => (
                      <span key={s.kode} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                        {s.nama}
                      </span>
                    ))}
                  </div>

                  <Button onClick={() => openPay(b)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="sm">
                    Bayar
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="p-6 text-center text-muted-foreground">
                {query.trim() ? "Tidak ada hasil pencarian." : "Tidak ada booking yang perlu dibayar."}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={!!payTarget} onOpenChange={(open) => (!open ? setPayTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pembayaran {payTarget?.bookingCode}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatRp(grandTotal)}</span>
            </div>
            {!!payTarget?.products?.length && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Produk</p>
                <div className="space-y-1">
                  {payTarget.products.map((p) => (
                    <div key={`${p.kode}:${p.isCompliment ? 1 : 0}`} className="flex items-center justify-between gap-3">
                      <span className="text-xs">
                        {p.nama} x{p.qty}{" "}
                        {p.isCompliment ? <span className="text-[10px] text-muted-foreground">(Compliment)</span> : null}
                      </span>
                      <button className="text-xs text-destructive" type="button" onClick={() => removeProduct(p.kode, p.isCompliment)}>
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tambah Produk</p>
              <div className="flex gap-2">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Pilih produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.kode}>
                      {p.nama} ({p.kode}) - stok {p.stok}
                    </option>
                  ))}
                </select>
                <Input
                  value={productQty}
                  autoUppercase={false}
                  inputMode="numeric"
                  className="w-20"
                  onChange={(e) => setProductQty(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={productIsCompliment} onChange={(e) => setProductIsCompliment(e.target.checked)} />
                  Compliment (harga 0)
                </label>
                <Button type="button" variant="outline" onClick={addProduct} disabled={!selectedProduct}>
                  Tambah
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Uang diterima</label>
              <Input
                value={formatRupiahInput(received)}
                autoUppercase={false}
                inputMode="numeric"
                onChange={(e) => setReceived(sanitizeRupiahInput(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kembalian</span>
              <span className={`font-medium ${change < 0 ? "text-destructive" : ""}`}>{formatRp(Math.max(0, change))}</span>
            </div>
            {change < 0 && <p className="text-xs text-destructive">Uang diterima kurang dari total.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handlePay} disabled={change < 0}>
              Bayar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!receipt} onOpenChange={(open) => (!open ? setReceipt(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Struk {receipt?.bookingCode}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {receipt ? new Date(receipt.paidAt).toLocaleString("id-ID") : ""}
            </div>
            {(receipt?.customerName || receipt?.customerPhone) && (
              <div className="text-sm">
                <span className="text-muted-foreground">Customer:</span>{" "}
                <span className="font-medium text-foreground">{receipt?.customerName || "-"}</span>{" "}
                {receipt?.customerPhone ? <span className="text-muted-foreground">({receipt.customerPhone})</span> : null}
              </div>
            )}
            <div className="space-y-1">
              {(receipt?.items || []).map((it, idx) => (
                <div key={`${it.type}:${it.kode}:${it.isCompliment ? 1 : 0}:${idx}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    {it.nama}
                    {it.type === "product" && it.isCompliment ? " (Compliment)" : ""} x{it.qty}
                  </span>
                  <span>{formatRp(it.harga * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium border-t pt-3">
              <span>Total</span>
              <span className="text-foreground tabular-nums">{formatRp(receipt?.total || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dibayar</span>
              <span className="text-foreground tabular-nums">{formatRp(receipt?.received || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kembalian</span>
              <span className="text-foreground tabular-nums">{formatRp(receipt?.change || 0)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={email}
                autoUppercase={false}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (opsional)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!receipt) return;
                    const ok = openEmailReceipt(email, `Struk ${receipt.bookingCode}`, buildReceiptText(receipt));
                    if (!ok) toast({ title: "Email kosong", description: "Isi email dulu.", variant: "destructive" });
                  }}
                >
                  Email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!receipt) return;
                    const ok = openWhatsAppReceipt(receipt.customerPhone, buildReceiptText(receipt));
                    if (!ok) toast({ title: "No. HP tidak valid", description: "Isi No. HP customer agar bisa kirim via WhatsApp.", variant: "destructive" });
                  }}
                >
                  WhatsApp
                </Button>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="sm:flex-wrap sm:gap-2 sm:space-x-0">
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => receipt && openReceiptPrintWindow(receipt)}
            >
              Print
            </Button>
            <AlertDialogAction
              onClick={() => receipt && generateReceiptPdf(receipt)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
