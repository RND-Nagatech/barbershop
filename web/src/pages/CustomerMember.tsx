import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { api, type CustomerItem } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

const formatNumberId = (n: number) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);

export default function CustomerMember() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomerItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", isMember: false });
  const [sales, setSales] = useState<Array<{ id: string; bookingCode: string; total: number; status: "Paid" | "Void"; paidAt: string; paidYmd: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.getCustomers({ q: query.trim() || undefined }));
    } catch (error) {
      toast({
        title: "Gagal memuat customer",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => `${c.phone} ${c.name}`.toLowerCase().includes(q));
  }, [data, query]);

  const openEdit = async (c: CustomerItem) => {
    setEditing(c);
    setForm({ phone: c.phone || "", name: c.name || "", isMember: Boolean(c.isMember) });
    setCreating(false);
    try {
      setSales(await api.getCustomerSales(c.id));
    } catch {
      setSales([]);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({ phone: "", name: "", isMember: false });
    setSales([]);
  };

  const save = async () => {
    try {
      if (form.isMember && !form.phone.trim()) {
        toast({ title: "Gagal menyimpan", description: "No HP wajib diisi jika customer adalah Member", variant: "destructive" });
        return;
      }
      if (creating) {
        const created = await api.createCustomer({ phone: form.phone || undefined, name: form.name, isMember: form.isMember });
        toast({ title: "Berhasil", description: "Customer ditambahkan" });
        setCreating(false);
        setForm({ phone: "", name: "", isMember: false });
        setData((prev) => [created, ...prev]);
      } else if (editing) {
        const updated = await api.updateCustomer(editing.id, { phone: form.phone || undefined, name: form.name, isMember: form.isMember });
        toast({ title: "Berhasil", description: "Customer diperbarui" });
        setEditing(null);
        setSales([]);
        setData((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      }
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
      <PageHeader title="Customer / Member" description="Kelola data customer dan status member (poin hanya untuk member)">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            autoUppercase={false}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari: nama / no HP..."
            className="w-[260px]"
          />
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
            Tambah Customer
          </Button>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </PageHeader>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Nama</th>
                  <th className="pb-3 font-medium">No HP</th>
                  <th className="pb-3 font-medium text-center">Member</th>
                  <th className="pb-3 font-medium text-right">Poin</th>
                  <th className="pb-3 font-medium text-center">Kunjungan</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{c.name || "-"}</td>
                      <td className="py-3">{c.phone || "-"}</td>
                      <td className="py-3 text-center">{c.isMember ? "Ya" : "-"}</td>
                      <td className="py-3 text-right tabular-nums">{formatNumberId(c.pointsBalance || 0)}</td>
                      <td className="py-3 text-center tabular-nums">{c.visitCount || 0}</td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!editing || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{creating ? "Tambah Customer" : "Detail Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input value={form.name} autoUppercase={false} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>No HP</Label>
                <Input value={form.phone} autoUppercase={false} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={form.isMember} onCheckedChange={(v) => setForm({ ...form, isMember: Boolean(v) })} />
              <span className="text-sm">Member</span>
            </div>

            {!creating && (
              <div className="rounded-md border border-border/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Poin</span>
                  <span className="font-medium tabular-nums">{formatNumberId(editing?.pointsBalance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kunjungan</span>
                  <span className="font-medium tabular-nums">{editing?.visitCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terakhir datang</span>
                  <span className="font-medium">{editing?.lastVisitAt ? new Date(editing.lastVisitAt).toLocaleString("id-ID") : "-"}</span>
                </div>
              </div>
            )}

            {!creating && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Riwayat Transaksi (terbaru)</p>
                <div className="max-h-56 overflow-auto rounded-md border border-border/50">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="p-2 text-left">Kode</th>
                        <th className="p-2 text-left">Tanggal</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{s.bookingCode}</td>
                          <td className="p-2">{new Date(s.paidAt).toLocaleString("id-ID")}</td>
                          <td className="p-2 text-right tabular-nums">{formatNumberId(s.total)}</td>
                          <td className="p-2">{s.status}</td>
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted-foreground">
                            Tidak ada transaksi.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button onClick={save} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
