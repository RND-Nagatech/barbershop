import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { API_BASE_URL, api, type WhatsAppStatus } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function WhatsAppGateway() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const baseUrlHint = useMemo(() => window.location.origin, []);

  const refresh = async () => {
    try {
      const qrRes = await api.waQr();
      setQr(qrRes.qrDataUrl || "");
      setStatus({
        status: qrRes.status,
        me: qrRes.me || "",
        lastError: qrRes.status === "connected" ? "" : (qrRes.lastError || ""),
      });
      if (!qrRes.qrDataUrl && qrRes.lastErrorDetail) {
        // eslint-disable-next-line no-console
        console.warn("WA lastErrorDetail", qrRes.lastErrorDetail);
      }
    } catch (err) {
      toast({
        title: "Gagal memuat status WhatsApp",
        description:
          err instanceof Error
            ? `${err.message}${err.message.toLowerCase().includes("fetch") ? ` (cek API: ${API_BASE_URL})` : ""}`
            : `Terjadi kesalahan (cek API: ${API_BASE_URL})`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  const handleRefreshQr = async () => {
    setLoading(true);
    try {
      const qrRes = await api.waRefreshQr();
      setQr(qrRes.qrDataUrl || "");
      setStatus({ status: qrRes.status, me: qrRes.me || "", lastError: qrRes.status === "connected" ? "" : (qrRes.lastError || "") });
      toast({ title: "WhatsApp", description: qrRes.qrDataUrl ? "QR diperbarui." : "Gagal memuat QR." });
      if (!qrRes.qrDataUrl && qrRes.lastErrorDetail) {
        // eslint-disable-next-line no-console
        console.warn("WA lastErrorDetail", qrRes.lastErrorDetail);
      }
    } catch (err) {
      toast({
        title: "Gagal refresh QR",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const st = await api.waLogout();
      setStatus(st);
      setQr("");
      toast({ title: "WhatsApp", description: "Logout berhasil. Scan ulang untuk connect lagi." });
    } catch (err) {
      toast({
        title: "Gagal logout",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const badgeClass =
    status?.status === "connected"
      ? "bg-success/10 text-success"
      : status?.status === "qr"
        ? "bg-warning/10 text-warning"
        : status?.status === "connecting"
          ? "bg-muted text-muted-foreground"
          : "bg-destructive/10 text-destructive";

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-2">
          <h1 className="text-2xl font-display font-semibold">WhatsApp Gateway</h1>
          <p className="text-sm text-muted-foreground">Scan QR untuk menghubungkan WhatsApp dan mengaktifkan pengiriman otomatis.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className={`inline-flex mt-1 px-3 py-1 rounded-full text-sm ${badgeClass}`}>
                  {status?.status || "unknown"}
                </div>
                {status?.status === "connected" && status?.me ? (
                  <div className="mt-2 text-xs text-muted-foreground">Connected as: {status.me}</div>
                ) : null}
                {status?.status !== "connected" && status?.lastError ? (
                  <div className="mt-2 text-xs text-destructive">Error: {status.lastError}</div>
                ) : null}
              </div>
              <Button
                variant="outline"
                onClick={() => void handleRefreshQr()}
                disabled={loading || status?.status === "connected"}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh QR"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input readOnly value={baseUrlHint} />
            </div>

            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input readOnly value={API_BASE_URL} />
            </div>

            <Button variant="destructive" onClick={() => void handleLogout()} disabled={loading}>
              Logout (Reset Session)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">QR Code</div>
              <div className="text-lg font-semibold">Scan untuk login</div>
            </div>

            {qr ? (
              <div className="flex items-center justify-center rounded-xl border border-border/50 bg-background p-6">
                <img src={qr} alt="WhatsApp QR" className="w-[280px] h-[280px]" />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-border/50 bg-muted/30 p-10 text-muted-foreground">
                {status?.status === "connected"
                  ? "Sudah terhubung."
                  : status
                    ? "Menyiapkan QR..."
                    : `Tidak bisa akses API (${API_BASE_URL}).`}
              </div>
            )}

            {status?.status !== "connected" && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>1) Buka WhatsApp di HP</div>
                <div>2) Menu <span className="font-medium">Perangkat tertaut</span> / <span className="font-medium">Linked Devices</span></div>
                <div>3) Scan QR di layar ini</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
