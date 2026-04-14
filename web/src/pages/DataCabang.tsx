import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Cabang {
  id: string;
  nama: string;
  alamat: string;
  noHp: string;
}

export default function DataCabang() {
  const [data, setData] = useState<Cabang[]>([
    { id: "1", nama: "BarberPro Pusat", alamat: "Jl. Sudirman No. 10, Jakarta", noHp: "081234567890" },
    { id: "2", nama: "BarberPro Cabang Bandung", alamat: "Jl. Braga No. 25, Bandung", noHp: "081298765432" },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cabang | null>(null);
  const [form, setForm] = useState({ nama: "", alamat: "", noHp: "" });

  const handleSave = () => {
    if (!form.nama || !form.alamat || !form.noHp) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    if (editing) {
      setData(data.map((d) => (d.id === editing.id ? { ...editing, ...form } : d)));
      toast({ title: "Berhasil", description: "Data cabang diperbarui" });
    } else {
      setData([...data, { id: Date.now().toString(), ...form }]);
      toast({ title: "Berhasil", description: "Cabang baru ditambahkan" });
    }
    setForm({ nama: "", alamat: "", noHp: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    setData(data.filter((d) => d.id !== id));
    toast({ title: "Berhasil", description: "Data cabang dihapus" });
  };

  const openEdit = (c: Cabang) => {
    setEditing(c);
    setForm({ nama: c.nama, alamat: c.alamat, noHp: c.noHp });
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ nama: "", alamat: "", noHp: "" });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Data Cabang" description="Kelola data cabang barbershop">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Tambah Cabang
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit Cabang" : "Tambah Cabang"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nama Cabang</Label>
                <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama cabang" />
              </div>
              <div className="space-y-2">
                <Label>Alamat</Label>
                <Input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat lengkap" />
              </div>
              <div className="space-y-2">
                <Label>No. HP</Label>
                <Input value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} placeholder="08xxxxxxxxxx" />
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
                  <th className="pb-3 font-medium">Nama Cabang</th>
                  <th className="pb-3 font-medium">Alamat</th>
                  <th className="pb-3 font-medium">No. HP</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{c.nama}</td>
                    <td className="py-3">{c.alamat}</td>
                    <td className="py-3">{c.noHp}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
