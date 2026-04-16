import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const formatRupiahInput = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
};
const sanitizeRupiahInput = (value: string) => String(value || "").replace(/\D/g, "");

export default function KasOut() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const amountNum = useMemo(() => Number(amount || 0), [amount]);

  const submit = async () => {
    try {
      setLoading(true);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        toast({ title: "Error", description: "Nominal tidak valid", variant: "destructive" });
        return;
      }
      if (!description.trim()) {
        toast({ title: "Error", description: "Deskripsi wajib diisi", variant: "destructive" });
        return;
      }
      await api.cashOut(amountNum, description.trim());
      toast({ title: "Berhasil", description: "Pengambilan uang kas berhasil disimpan" });
      setAmount("");
      setDescription("");
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Ambil Uang Kas" description="Mencatat pengeluaran uang kas (Out)" />

      <Card className="border-border/50 max-w-xl">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nominal (Rp)</label>
            <Input
              value={formatRupiahInput(amount)}
              autoUppercase={false}
              inputMode="numeric"
              onChange={(e) => setAmount(sanitizeRupiahInput(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Deskripsi</label>
            <Input value={description} autoUppercase={false} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Bayar listrik" />
          </div>

          <Button onClick={submit} disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            Simpan (Out)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

