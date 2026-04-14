import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface User {
  username: string;
  level: string;
}

export default function DataUser() {
  const [data, setData] = useState<User[]>([
    { username: "owner", level: "Owner" },
    { username: "admin1", level: "Admin" },
    { username: "kasir1", level: "Kasir" },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", password: "", level: "" });

  const handleSave = () => {
    if (!form.username || !form.password || !form.level) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    if (editing) {
      setData(data.map((d) => (d.username === editing.username ? { username: form.username, level: form.level } : d)));
      toast({ title: "Berhasil", description: "Data user diperbarui" });
    } else {
      setData([...data, { username: form.username, level: form.level }]);
      toast({ title: "Berhasil", description: "User baru ditambahkan" });
    }
    setForm({ username: "", password: "", level: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleDelete = (username: string) => {
    setData(data.filter((d) => d.username !== username));
    toast({ title: "Berhasil", description: "User dihapus" });
  };

  const openEdit = (u: User) => {
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
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
                  <tr key={u.username} className="border-b last:border-0">
                    <td className="py-3 font-medium">{u.username}</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">{u.level}</span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.username)} disabled={u.level === "Owner"}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
