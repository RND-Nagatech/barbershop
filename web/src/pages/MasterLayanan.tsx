import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, type Service } from "@/lib/api";

export default function MasterLayanan() {
  const [data, setData] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ kode: "", nama: "", harga: "" });
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const formatRupiahInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  };
  const sanitizeRupiahInput = (value: string) => value.replace(/\D/g, "");

  const loadServices = async () => {
    try {
      setData(await api.getServices());
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const handleSave = async () => {
    if (!form.kode || !form.nama || !form.harga) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    const item = { kode: form.kode, nama: form.nama, harga: Number(form.harga) };

    try {
      if (editing) {
        await api.updateService(editing.id, item);
        toast({ title: "Berhasil", description: "Data layanan diperbarui" });
      } else {
        await api.createService(item);
        toast({ title: "Berhasil", description: "Layanan baru ditambahkan" });
      }
      await loadServices();
      setForm({ kode: "", nama: "", harga: "" });
      setEditing(null);
      setOpen(false);
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteService(id);
      await loadServices();
      toast({ title: "Berhasil", description: "Data layanan dihapus" });
    } catch (error) {
      toast({
        title: "Gagal menghapus",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const openEdit = (l: Service) => {
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
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(form.harga)}
                  onChange={(e) => setForm({ ...form, harga: sanitizeRupiahInput(e.target.value) })}
                />
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
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{l.kode}</td>
                    <td className="py-3">{l.nama}</td>
                    <td className="py-3 text-right">{formatRp(l.harga)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(l)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Belum ada data layanan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(nextOpen) => (!nextOpen ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus layanan?</AlertDialogTitle>
            <AlertDialogDescription>
              Layanan{deleteTarget ? ` "${deleteTarget.nama}"` : ""} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
