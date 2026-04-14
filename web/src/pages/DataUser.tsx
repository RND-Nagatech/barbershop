import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { api, type UserItem } from "@/lib/api";

export default function DataUser() {
  const [data, setData] = useState<UserItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: "", password: "", level: "" });
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const loadUsers = async () => {
    try {
      setData(await api.getUsers());
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleSave = async () => {
    if (!form.username || !form.level || (!editing && !form.password)) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }

    try {
      if (editing) {
        await api.updateUser(editing.id, {
          username: form.username,
          level: form.level,
          password: form.password === "****" ? undefined : form.password,
        });
        toast({ title: "Berhasil", description: "Data user diperbarui" });
      } else {
        await api.createUser({ username: form.username, password: form.password, level: form.level });
        toast({ title: "Berhasil", description: "User baru ditambahkan" });
      }
      await loadUsers();
      setForm({ username: "", password: "", level: "" });
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

  const handleDelete = async (user: UserItem) => {
    try {
      await api.deleteUser(user.id);
      await loadUsers();
      toast({ title: "Berhasil", description: "User dihapus" });
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
    await handleDelete(deleteTarget);
    setDeleteTarget(null);
  };

  const openEdit = (u: UserItem) => {
    setEditing(u);
    setForm({ username: u.username, password: "****", level: u.level });
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ username: "", password: "", level: "" });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Data User" description="Kelola user dan level akses">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit User" : "Tambah User"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  autoUppercase={false}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  autoUppercase={false}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Level User</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Kasir">Kasir</SelectItem>
                    <SelectItem value="Pegawai">Pegawai</SelectItem>
                  </SelectContent>
                </Select>
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
                  <th className="pb-3 font-medium">Username</th>
                  <th className="pb-3 font-medium">Level</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{u.username}</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">{u.level}</span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} disabled={u.level === "Owner"}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      Belum ada data user.
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
            <AlertDialogTitle>Hapus user?</AlertDialogTitle>
            <AlertDialogDescription>
              User{deleteTarget ? ` "${deleteTarget.username}"` : ""} akan dihapus permanen.
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
