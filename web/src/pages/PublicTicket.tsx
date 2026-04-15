import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type PublicTicket } from "@/lib/api";
import { saveAs } from "file-saver";

export default function PublicTicketPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicTicket | null>(null);
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
        const row = await api.getPublicTicket(token);
        setData(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat tiket.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token]);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const total = useMemo(() => (data?.services || []).reduce((sum, s) => sum + (Number(s.harga) || 0), 0), [data]);

  const downloadTicketPng = async (ticket: PublicTicket) => {
    const padding = 24;
    const lineHeight = 22;
    const width = 720;
    const servicesLines = ticket.services.length;
    const height = padding * 2 + 220 + servicesLines * lineHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TIKET ANTREAN", padding, padding + 30);

    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#374151";
    ctx.fillText(ticket.branch?.nama ? `Cabang: ${ticket.branch.nama}` : "Cabang", padding, padding + 58);
    ctx.fillText(new Date(ticket.createdAt).toLocaleString("id-ID"), padding, padding + 80);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(ticket.antrian || "-"), padding, padding + 160);

    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#111827";
    ctx.fillText(`Kode: ${ticket.bookingCode}`, padding + 140, padding + 132);
    ctx.fillStyle = "#374151";
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Status: ${ticket.status}`, padding + 140, padding + 158);
    ctx.fillText(`Customer: ${ticket.customerName}`, padding + 140, padding + 182);
    if (ticket.phone) ctx.fillText(`No HP: ${ticket.phone}`, padding + 140, padding + 206);

    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 232);
    ctx.lineTo(width - padding, padding + 232);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Layanan", padding, padding + 262);
    let y = padding + 292;
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ticket.services.forEach((s) => {
      ctx.fillStyle = "#111827";
      ctx.fillText(s.nama, padding, y);
      ctx.fillStyle = "#374151";
      ctx.textAlign = "right";
      ctx.fillText(formatRp(s.harga), width - padding, y);
      ctx.textAlign = "left";
      y += lineHeight;
    });

    ctx.strokeStyle = "#E5E7EB";
    ctx.beginPath();
    ctx.moveTo(padding, y + 6);
    ctx.lineTo(width - padding, y + 6);
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Total", padding, y + 34);
    ctx.textAlign = "right";
    ctx.fillText(formatRp(total), width - padding, y + 34);
    ctx.textAlign = "left";

    canvas.toBlob((blob) => {
      if (!blob) return;
      saveAs(blob, `tiket_${ticket.bookingCode}.png`);
    }, "image/png");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Memuat tiket...</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">{error || "Tiket tidak ditemukan."}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-2">
            <h1 className="text-2xl font-display font-semibold text-foreground">Tiket Antrean</h1>
            <p className="text-sm text-muted-foreground">{data.branch?.nama || ""}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Nomor antrean</div>
                <div className="font-display text-6xl font-bold tabular-nums">{data.antrian}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{data.bookingCode}</div>
                <div className="text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleString("id-ID")}</div>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Customer:</span> <span className="font-medium">{data.customerName || "-"}</span>{" "}
                {data.phone ? <span className="text-muted-foreground">({data.phone})</span> : null}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span> <span className="font-medium">{data.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Layanan</div>
              <div className="space-y-1 text-sm">
                {data.services.map((s) => (
                  <div key={s.kode} className="flex items-center justify-between">
                    <span>{s.nama}</span>
                    <span className="tabular-nums">{formatRp(s.harga)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatRp(total)}</span>
              </div>
            </div>

            <Button onClick={() => void downloadTicketPng(data)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Download Tiket (PNG)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

