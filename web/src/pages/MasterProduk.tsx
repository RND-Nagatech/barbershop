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
import { Plus, Pencil, Trash2, Boxes } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, type Product } from "@/lib/api";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function MasterProduk() {
  const [data, setData] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    kode: "",
    nama: "",
    harga: "",
    stok: "0",
    minStok: "0",
    type_komisi: "persentase" as "persentase" | "rupiah",
    nilai_komisi: "0",
  });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCommissionType, setBulkCommissionType] = useState<"persentase" | "rupiah">("persentase");
  const [bulkCommissionValue, setBulkCommissionValue] = useState("0");

  const formatNumberInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  };
  const sanitizeNumberInput = (value: string) => value.replace(/\D/g, "");

  const load = async () => {
    try {
      const [rows, low] = await Promise.all([api.getProducts(), api.getLowStockProducts()]);
      setData(rows);
      setLowStock(low);
    } catch (error) {
      toast({
        title: "Gagal memuat produk",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    if (!form.kode || !form.nama || !form.harga) {
      toast({ title: "Error", description: "Kode, nama, dan harga wajib diisi", variant: "destructive" });
      return;
    }

    const payload = {
      kode: form.kode,
      nama: form.nama,
      harga: Number(form.harga),
      stok: Number(form.stok || "0"),
      minStok: Number(form.minStok || "0"),
      type_komisi: form.type_komisi,
      nilai_komisi: Number(form.nilai_komisi || "0"),
    };

    try {
      if (editing) {
        await api.updateProduct(editing.id, payload);
        toast({ title: "Berhasil", description: "Produk diperbarui" });
      } else {
        await api.createProduct(payload);
        toast({ title: "Berhasil", description: "Produk ditambahkan" });
      }
      await load();
      setForm({ kode: "", nama: "", harga: "", stok: "0", minStok: "0", type_komisi: "persentase", nilai_komisi: "0" });
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteProduct(deleteTarget.id);
      await load();
      toast({ title: "Berhasil", description: "Produk dihapus" });
    } catch (error) {
      toast({
        title: "Gagal menghapus",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      kode: p.kode,
      nama: p.nama,
      harga: String(p.harga),
      stok: String(p.stok ?? 0),
      minStok: String(p.minStok ?? 0),
      type_komisi: p.type_komisi || "persentase",
      nilai_komisi: String(p.nilai_komisi ?? 0),
    });
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ kode: "", nama: "", harga: "", stok: "0", minStok: "0", type_komisi: "persentase", nilai_komisi: "0" });
    setOpen(true);
  };

  const openStock = (p: Product) => {
    setStockTarget(p);
    setStockDelta("");
  };

  const saveStock = async () => {
    if (!stockTarget) return;
    const delta = Number(stockDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast({ title: "Error", description: "Delta stok tidak valid", variant: "destructive" });
      return;
    }
    try {
      await api.adjustProductStock(stockTarget.id, delta);
      toast({ title: "Berhasil", description: "Stok diperbarui" });
      setStockTarget(null);
      setStockDelta("");
      await load();
    } catch (error) {
      toast({
        title: "Gagal update stok",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(data.map((r) => r.id));
  };

  const handleBulkApply = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "Pilih data dulu", description: "Centang minimal satu produk.", variant: "destructive" });
      return;
    }
    try {
      await api.bulkUpdateProductCommission({
        ids: selectedIds,
        type_komisi: bulkCommissionType,
        nilai_komisi: Number(bulkCommissionValue || "0"),
      });
      await load();
      toast({ title: "Berhasil", description: `Komisi diterapkan ke ${selectedIds.length} produk` });
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Gagal bulk update",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Master Produk" description="Kelola produk retail dan stok">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Tambah Produk
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Kode Produk</Label>
                <Input value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Nama Produk</Label>
                <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Harga Jual (Rp)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(form.harga)}
                  onChange={(e) => setForm({ ...form, harga: sanitizeNumberInput(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Stok Awal</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(form.stok)}
                  onChange={(e) => setForm({ ...form, stok: sanitizeNumberInput(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Stok (Alert)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(form.minStok)}
                  onChange={(e) => setForm({ ...form, minStok: sanitizeNumberInput(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipe Komisi</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.type_komisi}
                    onChange={(e) => setForm({ ...form, type_komisi: e.target.value as "persentase" | "rupiah" })}
                  >
                    <option value="persentase">Persentase (%)</option>
                    <option value="rupiah">Nominal (Rp)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{form.type_komisi === "persentase" ? "Nilai Komisi (%)" : "Nilai Komisi (Rp)"}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={form.type_komisi === "rupiah" ? formatNumberInput(form.nilai_komisi) : form.nilai_komisi}
                    onChange={(e) => setForm({ ...form, nilai_komisi: sanitizeNumberInput(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Simpan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {lowStock.length > 0 && (
        <Card className="border-border/50 mb-4">
          <CardContent className="p-4 text-sm">
            <span className="font-medium text-warning">Low stock:</span>{" "}
            <span className="text-muted-foreground">
              {lowStock.map((p) => `${p.kode} (${p.stok}/${p.minStok})`).join(", ")}
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="mb-4 rounded-lg border border-border/60 p-3">
            <div className="text-sm font-medium mb-2">Edit Komisi</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={bulkCommissionType}
                onChange={(e) => setBulkCommissionType(e.target.value as "persentase" | "rupiah")}
              >
                <option value="persentase">Persentase (%)</option>
                <option value="rupiah">Nominal (Rp)</option>
              </select>
              <Input
                value={bulkCommissionType === "rupiah" ? formatNumberInput(bulkCommissionValue) : bulkCommissionValue}
                inputMode="numeric"
                onChange={(e) => setBulkCommissionValue(sanitizeNumberInput(e.target.value))}
                placeholder={bulkCommissionType === "persentase" ? "Contoh: 5" : "Contoh: 10.000"}
              />
              <Button variant="outline" onClick={toggleSelectAll}>
                {selectedIds.length === data.length && data.length > 0 ? "Batal Pilih Semua" : "Pilih Semua"}
              </Button>
              <Button onClick={handleBulkApply} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Terapkan ({selectedIds.length})
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Atur komisi produk sekaligus, lalu edit satuan jika ada produk khusus.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium w-10">
                    <input
                      type="checkbox"
                      checked={data.length > 0 && selectedIds.length === data.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Nama Produk</th>
                  <th className="pb-3 font-medium text-right">Harga</th>
                  <th className="pb-3 font-medium text-right">Komisi</th>
                  <th className="pb-3 font-medium text-center">Stok</th>
                  <th className="pb-3 font-medium text-center">Min</th>
                  <th className="pb-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className={`border-b last:border-0 ${(p.minStok ?? 0) > 0 && p.stok <= p.minStok ? "bg-warning/5" : ""}`}>
                    <td className="py-3">
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelectRow(p.id)} />
                    </td>
                    <td className="py-3 font-medium">{p.kode}</td>
                    <td className="py-3">{p.nama}</td>
                    <td className="py-3 text-right">{formatRp(p.harga)}</td>
                    <td className="py-3 text-right">
                      {p.type_komisi === "rupiah"
                        ? formatRp(Number(p.nilai_komisi || 0))
                        : `${Number(p.nilai_komisi || 0)}%`}
                    </td>
                    <td className="py-3 text-center">{p.stok ?? 0}</td>
                    <td className="py-3 text-center">{p.minStok ?? 0}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openStock(p)} title="Update stok">
                          <Boxes className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      Belum ada data produk.
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
            <AlertDialogTitle>Hapus produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk{deleteTarget ? ` "${deleteTarget.nama}"` : ""} akan dihapus permanen.
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

      <Dialog open={!!stockTarget} onOpenChange={(nextOpen) => (!nextOpen ? setStockTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Update Stok {stockTarget?.nama}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Gunakan angka + untuk tambah, - untuk kurangi.</p>
            <Input
              value={stockDelta}
              autoUppercase={false}
              onChange={(e) => setStockDelta(e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="Contoh: 10 atau -2"
            />
            <Button onClick={saveStock} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
