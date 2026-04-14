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
import { api, type Employee } from "@/lib/api";

export default function MasterPegawai() {
  const [data, setData] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ kode: "", nama: "" });
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const loadEmployees = async () => {
    try {
      setData(await api.getEmployees());
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const handleSave = async () => {
    if (!form.kode || !form.nama) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }

    try {
      if (editing) {
        await api.updateEmployee(editing.id, form);
        toast({ title: "Berhasil", description: "Data pegawai diperbarui" });
      } else {
        await api.createEmployee(form);
        toast({ title: "Berhasil", description: "Pegawai baru ditambahkan" });
      }
      await loadEmployees();
      setForm({ kode: "", nama: "" });
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
      await api.deleteEmployee(id);
      await loadEmployees();
      toast({ title: "Berhasil", description: "Data pegawai dihapus" });
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

  const openEdit = (p: Employee) => {
    setEditing(p);
    setForm({ kode: p.kode, nama: p.nama });
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
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{p.kode}</td>
                    <td className="py-3">{p.nama}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      Belum ada data pegawai.
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
            <AlertDialogTitle>Hapus pegawai?</AlertDialogTitle>
            <AlertDialogDescription>
              Data pegawai{deleteTarget ? ` "${deleteTarget.nama}"` : ""} akan dihapus permanen.
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
