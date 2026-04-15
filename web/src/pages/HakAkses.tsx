import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { api, type UserItem } from "@/lib/api";

const allMenus = [
  "Dashboard",
  "Master Pegawai",
  "Master Layanan",
  "Master Produk",
  "Customer / Member",
  "Input Booking",
  "Booked",
  "Kasir / Pembayaran",
  "Riwayat Transaksi",
  "Laporan Transaksi",
  "Laporan Keuangan",
  "Laporan Pegawai",
  "Laporan Stok",
  "Mutasi Stok",
  "Data User",
  "Hak Akses User",
  "Setting Komisi",
  "Setting Loyalty",
];

export default function HakAkses() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [accessMenus, setAccessMenus] = useState<string[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const rows = await api.getUsers();
        setUsers(rows.filter((u) => u.level !== "Owner"));
      } catch (error) {
        toast({
          title: "Gagal memuat user",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    };

    void loadUsers();
  }, []);

  const handleUserChange = async (username: string) => {
    setSelectedUser(username);
    try {
      const payload = await api.getAccessByUsername(username);
      setAccessMenus(payload.menuAccess || []);
    } catch (error) {
      toast({
        title: "Gagal memuat hak akses",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const toggleMenu = (menu: string) => {
    setAccessMenus((prev) =>
      prev.includes(menu) ? prev.filter((m) => m !== menu) : [...prev, menu]
    );
  };

  const handleSave = async () => {
    try {
      await api.saveAccessByUsername(selectedUser, accessMenus);
      toast({ title: "Berhasil", description: `Hak akses untuk ${selectedUser} berhasil disimpan` });
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Hak Akses User" description="Atur menu yang bisa diakses tiap user (kecuali Owner)" />

      <Card className="border-border/50">
        <CardContent className="p-5 space-y-6">
          <div className="max-w-sm space-y-2">
            <Label>Pilih User</Label>
            <Select value={selectedUser} onValueChange={handleUserChange}>
              <SelectTrigger><SelectValue placeholder="Pilih user..." /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.username} value={u.username}>
                    {u.username} ({u.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <>
              <div className="space-y-3">
                <Label>Menu yang Bisa Diakses</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allMenus.map((menu) => (
                    <label
                      key={menu}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        accessMenus.includes(menu) ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                      }`}
                    >
                      <Checkbox
                        checked={accessMenus.includes(menu)}
                        onCheckedChange={() => toggleMenu(menu)}
                      />
                      <span className="text-sm">{menu}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Simpan Hak Akses
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
