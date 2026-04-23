import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { api, type BookingItem, type CustomerItem, type PayResponse, type Product } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";
import { buildReceiptText, generateReceiptPdf, openEmailReceipt, openReceiptPrintWindow, openWhatsAppReceipt } from "@/lib/receiptUtils";
import { normalizePhone } from "@/lib/phone";

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
  const getToday = () => formatLocalYmd(new Date()) ?? "";
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [data, setData] = useState<BookingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [payTarget, setPayTarget] = useState<BookingItem | null>(null);
  const [received, setReceived] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productQty, setProductQty] = useState("1");
  const [productIsCompliment, setProductIsCompliment] = useState(false);

  const [directOpen, setDirectOpen] = useState(false);
  const [directCustomerType, setDirectCustomerType] = useState<"member" | "regular">("regular");
  const [directCustomerName, setDirectCustomerName] = useState("");
  const [directCustomerPhone, setDirectCustomerPhone] = useState("");
  const [directMember, setDirectMember] = useState<CustomerItem | null>(null);
  const [directMemberLoading, setDirectMemberLoading] = useState(false);
  const [directSelectedProduct, setDirectSelectedProduct] = useState("");
  const [directQty, setDirectQty] = useState("1");
  const [directIsCompliment, setDirectIsCompliment] = useState(false);
  const [directItems, setDirectItems] = useState<Array<{ kode: string; nama: string; harga: number; qty: number; isCompliment?: boolean }>>([]);
  const [directReceived, setDirectReceived] = useState("");
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
        from,
        to,
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

  useEffect(() => {
    if (!directOpen) return;
    if (directCustomerType !== "member") {
      setDirectMember(null);
      setDirectMemberLoading(false);
      return;
    }

    const phone = normalizePhone(directCustomerPhone);
    if (!phone) {
      setDirectMember(null);
      setDirectMemberLoading(false);
      setDirectCustomerName("");
      return;
    }

    let cancelled = false;
    setDirectMemberLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const rows = await api.getCustomers({ q: phone, memberOnly: true });
        if (cancelled) return;
        const found = rows.find((r) => r.phone === phone) || null;
        setDirectMember(found);
        setDirectCustomerName(found?.name?.toUpperCase?.() ? found.name.toUpperCase() : (found?.name || "").toUpperCase());
      } catch {
        if (!cancelled) setDirectMember(null);
      } finally {
        if (!cancelled) setDirectMemberLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [directOpen, directCustomerType, directCustomerPhone]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? data
      : data.filter((b) => {
      const haystack = [b.bookingCode, b.customerName, b.phone, b.employeeName].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return base.slice().sort((a, b) => (Number(a.antrian) || 0) - (Number(b.antrian) || 0));
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

  const directTotal = useMemo(
    () => directItems.reduce((sum, it) => sum + (Number(it.harga) || 0) * (Number(it.qty) || 0), 0),
    [directItems],
  );
  const directReceivedNum = Number(directReceived || 0);
  const directChange = directReceivedNum - directTotal;

  const openDirect = () => {
    setDirectOpen(true);
    setDirectCustomerType("regular");
    setDirectCustomerName("");
    setDirectCustomerPhone("");
    setDirectMember(null);
    setDirectMemberLoading(false);
    setDirectSelectedProduct("");
    setDirectQty("1");
    setDirectIsCompliment(false);
    setDirectItems([]);
    setDirectReceived("");
  };

  const addDirectItem = () => {
    if (!directSelectedProduct) return;
    const qty = Number(directQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Error", description: "Qty tidak valid", variant: "destructive" });
      return;
    }
    const p = products.find((x) => x.kode === directSelectedProduct);
    if (!p) {
      toast({ title: "Error", description: "Produk tidak ditemukan", variant: "destructive" });
      return;
    }
    setDirectItems((prev) => [
      ...prev,
      { kode: p.kode, nama: p.nama, harga: directIsCompliment ? 0 : p.harga, qty, isCompliment: directIsCompliment },
    ]);
    setDirectSelectedProduct("");
    setDirectQty("1");
    setDirectIsCompliment(false);
  };

  const removeDirectItem = (idx: number) => setDirectItems((prev) => prev.filter((_, i) => i !== idx));

  const submitDirectSale = async () => {
    try {
      const nominal = Number(directReceived);
      if (!Number.isFinite(nominal) || nominal < 0) {
        toast({ title: "Error", description: "Nominal uang diterima tidak valid", variant: "destructive" });
        return;
      }
      if (directItems.length === 0) {
        toast({ title: "Error", description: "Item transaksi wajib diisi", variant: "destructive" });
        return;
      }
      if (directCustomerType === "member" && !directCustomerPhone.trim()) {
        toast({ title: "Error", description: "No HP member wajib diisi", variant: "destructive" });
        return;
      }
      if (directCustomerType === "member" && (!directMember || !directMember.isMember)) {
        toast({ title: "Member tidak ditemukan", description: "Pastikan No. HP terdaftar sebagai member.", variant: "destructive" });
        return;
      }
      const paid = await api.createDirectSale({
        customerType: directCustomerType,
        customerName: directCustomerName.trim().toUpperCase() || undefined,
        customerPhone: directCustomerPhone.trim() || undefined,
        items: directItems.map((it) => ({ kode: it.kode, qty: it.qty, isCompliment: Boolean(it.isCompliment) })),
        received: nominal,
      });
      setReceipt({
        bookingCode: paid.saleCode || paid.bookingCode,
        paidAt: paid.paidAt,
        items: paid.items || [],
        total: paid.total,
        received: paid.received,
        change: paid.change,
        customerName: paid.customerName || "",
        customerPhone: paid.customerPhone || "",
      });
      toast({ title: "Berhasil", description: `Transaksi ${paid.saleCode || paid.bookingCode} berhasil` });
      setDirectOpen(false);
      setEmail("");
    } catch (error) {
      toast({
        title: "Gagal membuat transaksi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Kasir / Pembayaran" description="Selesaikan pembayaran booking yang sudah dikerjakan">
        <div className="flex items-center gap-2">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openDirect}>
            Add Transaksi
          </Button>
          <Input
            value={query}
            autoUppercase={false}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari: kode booking, nama, no HP, barber..."
            className="w-[280px]"
          />
        </div>
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
                <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Pilih produk..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.kode}>
                        {`${p.nama} (${p.kode}) - stok ${p.stok}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <AlertDialog open={directOpen} onOpenChange={setDirectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transaksi Baru</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">Tipe Customer</label>
                <div className="flex gap-2">
                  <Button type="button" variant={directCustomerType === "regular" ? "default" : "outline"} className={directCustomerType === "regular" ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""} onClick={() => setDirectCustomerType("regular")}>
                    Reguler
                  </Button>
                  <Button type="button" variant={directCustomerType === "member" ? "default" : "outline"} className={directCustomerType === "member" ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""} onClick={() => setDirectCustomerType("member")}>
                    Member
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">Nama (opsional)</label>
                <Input
                  value={directCustomerName}
                  disabled={directCustomerType === "member"}
                  autoUppercase={false}
                  onChange={(e) => setDirectCustomerName(e.target.value.toUpperCase())}
                  placeholder={directCustomerType === "member" ? "Otomatis dari member" : "Nama customer"}
                />
                {directCustomerType === "member" && (
                  <p className="text-[11px] text-muted-foreground">
                    {directMemberLoading ? "Mencari member..." : directMember ? `Member: ${directMember.name}` : "Masukkan No. HP member untuk mengambil nama otomatis."}
                  </p>
                )}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-muted-foreground text-xs">No HP/WA {directCustomerType === "member" ? "(wajib)" : "(opsional)"}</label>
                <Input value={directCustomerPhone} autoUppercase={false} onChange={(e) => setDirectCustomerPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tambah Produk</p>
              <div className="flex gap-2">
                <Select value={directSelectedProduct} onValueChange={(v) => setDirectSelectedProduct(v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Pilih produk..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.kode}>
                        {`${p.nama} (${p.kode}) - stok ${p.stok}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-24"
                  value={directQty}
                  autoUppercase={false}
                  inputMode="numeric"
                  onChange={(e) => setDirectQty(sanitizeRupiahInput(e.target.value))}
                  placeholder="Qty"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={directIsCompliment} onChange={(e) => setDirectIsCompliment(e.target.checked)} />
                  Compliment (harga 0)
                </label>
                <Button type="button" variant="outline" onClick={addDirectItem} disabled={!directSelectedProduct}>
                  Tambah
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Item</p>
              <div className="max-h-40 overflow-auto rounded-md border border-border/50">
                {directItems.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Belum ada item.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="p-2 text-left">Nama</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Subtotal</th>
                        <th className="p-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directItems.map((it, idx) => (
                        <tr key={`${it.kode}:${idx}`} className="border-b last:border-0">
                          <td className="p-2">
                            <span className="font-medium">{it.nama}</span>{" "}
                            {it.isCompliment ? <span className="text-[10px] text-muted-foreground">(Compliment)</span> : null}
                          </td>
                          <td className="p-2 text-right tabular-nums">{it.qty}</td>
                          <td className="p-2 text-right tabular-nums">{formatRp((Number(it.harga) || 0) * (Number(it.qty) || 0))}</td>
                          <td className="p-2 text-right">
                            <button className="text-xs text-destructive" type="button" onClick={() => removeDirectItem(idx)}>
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatRp(directTotal)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Uang diterima</label>
              <Input
                value={formatRupiahInput(directReceived)}
                autoUppercase={false}
                inputMode="numeric"
                onChange={(e) => setDirectReceived(sanitizeRupiahInput(e.target.value))}
                placeholder="0"
              />
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Kembalian</span>
              <span className={`font-medium ${directChange < 0 ? "text-destructive" : ""}`}>{formatRp(Math.max(0, directChange))}</span>
            </div>
            {directChange < 0 && <p className="text-xs text-destructive">Uang diterima kurang dari total.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={submitDirectSale} disabled={directChange < 0}>
              Simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
