import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const allMenus = [
  "Dashboard",
  "Master Pegawai",
  "Master Layanan",
  "Input Booking",
  "Booked",
  "Laporan Keuangan",
  "Laporan Pegawai",
  "Data User",
  "Hak Akses User",
  "Setting Komisi",
];

const users = [
  { username: "admin1", level: "Admin" },
  { username: "kasir1", level: "Kasir" },
];

export default function HakAkses() {
  const [selectedUser, setSelectedUser] = useState("");
  const [accessMenus, setAccessMenus] = useState<string[]>([]);

  const handleUserChange = (username: string) => {
    setSelectedUser(username);
    // Simulate existing access
    if (username === "admin1") {
      setAccessMenus(["Dashboard", "Master Pegawai", "Master Layanan", "Input Booking", "Booked"]);
    } else {
      setAccessMenus(["Dashboard", "Input Booking", "Booked"]);
    }
  };

  const toggleMenu = (menu: string) => {
    setAccessMenus((prev) =>
      prev.includes(menu) ? prev.filter((m) => m !== menu) : [...prev, menu]
    );
  };

  const handleSave = () => {
    toast({ title: "Berhasil", description: `Hak akses untuk ${selectedUser} berhasil disimpan` });
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
