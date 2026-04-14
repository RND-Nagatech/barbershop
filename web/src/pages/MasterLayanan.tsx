import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Layanan {
  kode: string;
  nama: string;
  harga: number;
}

export default function MasterLayanan() {
  const [data, setData] = useState<Layanan[]>([
    { kode: "LYN001", nama: "Haircut", harga: 50000 },
    { kode: "LYN002", nama: "Shaving", harga: 30000 },
    { kode: "LYN003", nama: "Hair Coloring", harga: 150000 },
    { kode: "LYN004", nama: "Hair Wash", harga: 25000 },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Layanan | null>(null);
  const [form, setForm] = useState({ kode: "", nama: "", harga: "" });

  const handleSave = () => {
    if (!form.kode || !form.nama || !form.harga) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    const item = { kode: form.kode, nama: form.nama, harga: Number(form.harga) };
    if (editing) {
      setData(data.map((d) => (d.kode === editing.kode ? item : d)));
      toast({ title: "Berhasil", description: "Data layanan diperbarui" });
    } else {
      setData([...data, item]);
      toast({ title: "Berhasil", description: "Layanan baru ditambahkan" });
    }
    setForm({ kode: "", nama: "", harga: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleDelete = (kode: string) => {
    setData(data.filter((d) => d.kode !== kode));
    toast({ title: "Berhasil", description: "Data layanan dihapus" });
  };

  const openEdit = (l: Layanan) => {
    setEditing(l);
    setForm({ kode: l.kode, nama: l.nama, harga: String(l.harga) });
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ kode: "", nama: "", harga: "" });
    setOpen(true);
  };

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <div>
      <PageHeader title="Master Layanan" description="Kelola daftar layanan dan harga">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Tambah Layanan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit Layanan" : "Tambah Layanan"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Kode Layanan</Label>
                <Input value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Nama Layanan</Label>
                <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Harga (Rp)</Label>
                <Input type="number" value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama Layanan</th>
                  <th className="pb-3 font-medium text-right">Harga</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((l) => (
                  <tr key={l.kode} className="border-b last:border-0">
                    <td className="py-3 font-medium">{l.kode}</td>
                    <td className="py-3">{l.nama}</td>
                    <td className="py-3 text-right">{formatRp(l.harga)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(l.kode)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
