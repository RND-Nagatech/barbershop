import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function SettingLoyalty() {
  const [mode, setMode] = useState<"per_transaction" | "per_rupiah">("per_rupiah");
  const [pointsPerTransaction, setPointsPerTransaction] = useState("0");
  const [rupiahStep, setRupiahStep] = useState("10000");
  const [pointsPerStep, setPointsPerStep] = useState("1");

  const formatNumberInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  };
  const sanitizeNumberInput = (value: string) => value.replace(/\D/g, "");

  useEffect(() => {
    const load = async () => {
      try {
        const row = await api.getPointSetting();
        setMode(row.mode);
        setPointsPerTransaction(String(row.pointsPerTransaction ?? 0));
        setRupiahStep(String(row.rupiahStep ?? 10000));
        setPointsPerStep(String(row.pointsPerStep ?? 1));
      } catch (error) {
        toast({
          title: "Gagal memuat setting",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    try {
      await api.updatePointSetting({
        mode,
        pointsPerTransaction: Math.max(0, Math.floor(Number(pointsPerTransaction) || 0)),
        rupiahStep: Math.max(1, Math.floor(Number(rupiahStep) || 10000)),
        pointsPerStep: Math.max(0, Math.floor(Number(pointsPerStep) || 0)),
      });
      toast({
        title: "Berhasil",
        description: "Setting poin berhasil disimpan",
      });
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Setting Poin" description="Atur poin yang didapat member setiap transaksi (Paid)" />

      <Card className="border-border/50 max-w-lg">
        <CardContent className="p-5 space-y-6">
          <div className="space-y-3">
            <Label>Mode Poin</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "per_transaction" | "per_rupiah")} className="flex gap-4">
              <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${mode === "per_transaction" ? "border-accent bg-accent/5" : "border-border"}`}>
                <RadioGroupItem value="per_transaction" />
                <span className="text-sm font-medium">Per transaksi</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${mode === "per_rupiah" ? "border-accent bg-accent/5" : "border-border"}`}>
                <RadioGroupItem value="per_rupiah" />
                <span className="text-sm font-medium">Per rupiah</span>
              </label>
            </RadioGroup>
          </div>

          {mode === "per_transaction" ? (
            <div className="space-y-2">
              <Label>Poin per transaksi</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(pointsPerTransaction)}
                onChange={(e) => setPointsPerTransaction(sanitizeNumberInput(e.target.value))}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">Member akan mendapat poin tetap setiap transaksi yang dibayar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Setiap (Rp)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(rupiahStep)}
                  onChange={(e) => setRupiahStep(sanitizeNumberInput(e.target.value))}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label>Dapat poin</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(pointsPerStep)}
                  onChange={(e) => setPointsPerStep(sanitizeNumberInput(e.target.value))}
                  placeholder="1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Contoh: setiap Rp 10.000 dapat 1 poin (dibulatkan ke bawah).
              </p>
            </div>
          )}

          <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            Simpan Setting
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
