import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";

export default function SettingKomisi() {
  const [tipe, setTipe] = useState<"persentase" | "rupiah">("persentase");
  const [nilai, setNilai] = useState("15");

  const handleSave = () => {
    if (!nilai) {
      toast({ title: "Error", description: "Nilai komisi harus diisi", variant: "destructive" });
      return;
    }
    toast({
      title: "Berhasil",
      description: `Komisi disimpan: ${tipe === "persentase" ? `${nilai}%` : `Rp ${Number(nilai).toLocaleString("id-ID")}`}`,
    });
  };

  return (
    <div>
      <PageHeader title="Setting Komisi" description="Atur komisi pegawai per transaksi" />

      <Card className="border-border/50 max-w-lg">
        <CardContent className="p-5 space-y-6">
          <div className="space-y-3">
            <Label>Tipe Komisi</Label>
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
            <Label>{tipe === "persentase" ? "Persentase Komisi" : "Nominal Komisi"}</Label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  type="number"
                  value={nilai}
                  onChange={(e) => setNilai(e.target.value)}
                  className="pr-12"
                  placeholder={tipe === "persentase" ? "15" : "50000"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  {tipe === "persentase" ? "%" : "Rp"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipe === "persentase"
                ? "Komisi dihitung berdasarkan persentase dari total harga layanan"
                : "Komisi diberikan dengan nominal tetap per transaksi yang diselesaikan"}
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
