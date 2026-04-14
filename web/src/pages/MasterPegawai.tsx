import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Pegawai {
  kode: string;
  nama: string;
}

export default function MasterPegawai() {
  const [data, setData] = useState<Pegawai[]>([
    { kode: "PGW001", nama: "Rizky Pratama" },
    { kode: "PGW002", nama: "Dimas Saputra" },
    { kode: "PGW003", nama: "Andi Wijaya" },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pegawai | null>(null);
  const [form, setForm] = useState({ kode: "", nama: "" });

  const handleSave = () => {
    if (!form.kode || !form.nama) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    if (editing) {
      setData(data.map((d) => (d.kode === editing.kode ? form : d)));
      toast({ title: "Berhasil", description: "Data pegawai diperbarui" });
    } else {
      setData([...data, form]);
      toast({ title: "Berhasil", description: "Pegawai baru ditambahkan" });
    }
    setForm({ kode: "", nama: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleDelete = (kode: string) => {
    setData(data.filter((d) => d.kode !== kode));
    toast({ title: "Berhasil", description: "Data pegawai dihapus" });
  };

  const openEdit = (p: Pegawai) => {
    setEditing(p);
    setForm(p);
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ kode: "", nama: "" });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Master Pegawai" description="Kelola data pegawai barbershop">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Tambah Pegawai
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit Pegawai" : "Tambah Pegawai"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Kode Pegawai</Label>
                <Input value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Nama Pegawai</Label>
                <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
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
                  <th className="pb-3 font-medium">Nama Pegawai</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.kode} className="border-b last:border-0">
                    <td className="py-3 font-medium">{p.kode}</td>
                    <td className="py-3">{p.nama}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.kode)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
