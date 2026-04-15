import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type PublicReceipt } from "@/lib/api";
import { generateReceiptPdf, openReceiptPrintWindow, type ReceiptData } from "@/lib/receiptUtils";

export default function PublicReceiptPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError("Token tidak valid.");
        setLoading(false);
        return;
      }
      try {
        const row = await api.getPublicReceipt(token);
        setData(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat struk.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token]);

  const receiptData: ReceiptData | null = useMemo(() => {
    if (!data) return null;
    return {
      bookingCode: data.bookingCode,
      paidAt: data.paidAt,
      customerName: data.customerName || "",
      customerPhone: data.customerPhone || "",
      items: data.items || [],
      total: data.total || 0,
      received: data.received || 0,
      change: data.change || 0,
    };
  }, [data]);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Memuat struk...</CardContent>
        </Card>
      </div>
    );
  }

  if (!data || !receiptData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">{error || "Struk tidak ditemukan."}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-2">
            <h1 className="text-2xl font-display font-semibold text-foreground">Struk Pembayaran</h1>
            <p className="text-sm text-muted-foreground">{data.branch?.nama || ""}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{data.bookingCode}</div>
                <div className="text-sm text-muted-foreground">{new Date(data.paidAt).toLocaleString("id-ID")}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold tabular-nums">{formatRp(data.total)}</div>
              </div>
            </div>

            {(data.customerName || data.customerPhone) && (
              <div className="text-sm">
                <span className="font-medium text-foreground">{data.customerName || "-"}</span>{" "}
                {data.customerPhone ? <span className="text-muted-foreground">({data.customerPhone})</span> : null}
              </div>
            )}

            <div className="space-y-2 text-sm">
              {(data.items || []).map((it, idx) => (
                <div key={`${it.kode}-${idx}`} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.nama}</div>
                    <div className="text-muted-foreground text-xs">
                      {it.qty} x {formatRp(it.harga)}
                    </div>
                  </div>
                  <div className="tabular-nums">{formatRp(it.harga * it.qty)}</div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="font-semibold tabular-nums">{formatRp(data.total)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Dibayar</span>
                <span className="tabular-nums">{formatRp(data.received)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Kembalian</span>
                <span className="tabular-nums">{formatRp(data.change)}</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => openReceiptPrintWindow(receiptData)} className="w-full">
                Print
              </Button>
              <Button onClick={() => generateReceiptPdf(receiptData)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

