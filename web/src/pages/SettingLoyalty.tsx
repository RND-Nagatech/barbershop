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
  const [tipe, setTipe] = useState<"persentase" | "rupiah">("persentase");
  const [nilai, setNilai] = useState("1");

  const formatRupiahInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  };
  const sanitizeNumberInput = (value: string) => value.replace(/\D/g, "");

  useEffect(() => {
    const load = async () => {
      try {
        const row = await api.getLoyaltySetting();
        setTipe(row.tipe);
        setNilai(String(row.nilai));
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
    if (!nilai) {
      toast({ title: "Error", description: "Nilai harus diisi", variant: "destructive" });
      return;
    }
    try {
      await api.updateLoyaltySetting({ tipe, nilai: Number(nilai) });
      toast({
        title: "Berhasil",
        description: `Loyalty disimpan: ${tipe === "persentase" ? `${nilai}% dari total` : `Rp ${Number(nilai).toLocaleString("id-ID")} per transaksi`}`,
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
      <PageHeader title="Setting Loyalty" description="Atur saldo loyalty yang didapat customer tiap transaksi (Paid)" />

      <Card className="border-border/50 max-w-lg">
        <CardContent className="p-5 space-y-6">
          <div className="space-y-3">
            <Label>Tipe Loyalty</Label>
            <RadioGroup value={tipe} onValueChange={(v) => setTipe(v as "persentase" | "rupiah")} className="flex gap-4">
              <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${tipe === "persentase" ? "border-accent bg-accent/5" : "border-border"}`}>
                <RadioGroupItem value="persentase" />
                <span className="text-sm font-medium">Persentase (%)</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${tipe === "rupiah" ? "border-accent bg-accent/5" : "border-border"}`}>
                <RadioGroupItem value="rupiah" />
                <span className="text-sm font-medium">Rupiah (Rp)</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>{tipe === "persentase" ? "Persentase Loyalty" : "Nominal Loyalty"}</Label>
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                value={tipe === "rupiah" ? formatRupiahInput(nilai) : nilai}
                onChange={(e) => setNilai(sanitizeNumberInput(e.target.value))}
                className="pr-14"
                placeholder={tipe === "persentase" ? "1" : "5000"}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                {tipe === "persentase" ? "%" : "Rp"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipe === "persentase"
                ? "Saldo loyalty = persentase dari total transaksi (dibulatkan)"
                : "Saldo loyalty = nominal tetap per transaksi yang dibayar"}
            </p>
          </div>

          <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            Simpan Setting
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

