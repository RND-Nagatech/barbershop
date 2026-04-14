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
import { api, type Branch } from "@/lib/api";

export default function DataCabang() {
  const [data, setData] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ nama: "", alamat: "", noHp: "" });
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const loadBranches = async () => {
    try {
      setData(await api.getBranches());
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const handleSave = async () => {
    if (!form.nama || !form.alamat || !form.noHp) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }

    try {
      if (editing) {
        await api.updateBranch(editing.id, form);
        toast({ title: "Berhasil", description: "Data cabang diperbarui" });
      } else {
        await api.createBranch(form);
        toast({ title: "Berhasil", description: "Cabang baru ditambahkan" });
      }
      await loadBranches();
      setForm({ nama: "", alamat: "", noHp: "" });
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
      await api.deleteBranch(id);
      await loadBranches();
      toast({ title: "Berhasil", description: "Data cabang dihapus" });
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

  const openEdit = (c: Branch) => {
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
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Belum ada data cabang.
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
            <AlertDialogTitle>Hapus cabang?</AlertDialogTitle>
            <AlertDialogDescription>
              Cabang{deleteTarget ? ` "${deleteTarget.nama}"` : ""} akan dihapus permanen.
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
