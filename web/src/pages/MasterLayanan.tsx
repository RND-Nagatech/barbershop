import { Fragment, useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, PlusCircle, MinusCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, type Product, type Service } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MasterLayanan() {
  const [data, setData] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<{
    kode: string;
    nama: string;
    harga: string;
    type_komisi: "persentase" | "rupiah";
    nilai_komisi: string;
    compliments: Array<{ kode: string; qty: number }>;
  }>({
    kode: "",
    nama: "",
    harga: "",
    type_komisi: "persentase",
    nilai_komisi: "0",
    compliments: [],
  });
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCommissionType, setBulkCommissionType] = useState<"persentase" | "rupiah">("persentase");
  const [bulkCommissionValue, setBulkCommissionValue] = useState("0");
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
    void (async () => {
      try {
        setProducts(await api.getProducts());
      } catch {
        // ignore; compliments UI will be disabled if products can't be loaded
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!form.kode || !form.nama || !form.harga) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }
    const complimentsMap = new Map<string, number>();
    for (const c of form.compliments || []) {
      const kode = String(c?.kode || "").trim();
      const qty = Number(c?.qty ?? 1);
      if (!kode) continue;
      const qtySafe = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      complimentsMap.set(kode, (complimentsMap.get(kode) || 0) + qtySafe);
    }
    const item = {
      kode: form.kode,
      nama: form.nama,
      harga: Number(form.harga),
      type_komisi: form.type_komisi,
      nilai_komisi: Number(form.nilai_komisi || "0"),
      compliments: Array.from(complimentsMap.entries()).map(([kode, qty]) => ({ kode, qty })),
    };

    try {
      if (editing) {
        await api.updateService(editing.id, item);
        toast({ title: "Berhasil", description: "Data layanan diperbarui" });
      } else {
        await api.createService(item);
        toast({ title: "Berhasil", description: "Layanan baru ditambahkan" });
      }
      await loadServices();
      setForm({ kode: "", nama: "", harga: "", type_komisi: "persentase", nilai_komisi: "0", compliments: [] });
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
    setForm({
      kode: l.kode,
      nama: l.nama,
      harga: String(l.harga),
      type_komisi: l.type_komisi || "persentase",
      nilai_komisi: String(l.nilai_komisi ?? 0),
      compliments: l.compliments || [],
    });
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ kode: "", nama: "", harga: "", type_komisi: "persentase", nilai_komisi: "0", compliments: [] });
    setOpen(true);
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
      toast({ title: "Pilih data dulu", description: "Centang minimal satu layanan.", variant: "destructive" });
      return;
    }
    try {
      await api.bulkUpdateServiceCommission({
        ids: selectedIds,
        type_komisi: bulkCommissionType,
        nilai_komisi: Number(bulkCommissionValue || "0"),
      });
      await loadServices();
      toast({ title: "Berhasil", description: `Komisi diterapkan ke ${selectedIds.length} layanan` });
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Gagal bulk update",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  // State for expanded rows
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <PageHeader title="Master Layanan" description="Kelola daftar layanan dan harga">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Tambah Layanan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Edit Layanan" : "Tambah Layanan"}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipe Komisi</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                    value={form.type_komisi === "rupiah" ? formatRupiahInput(form.nilai_komisi) : form.nilai_komisi}
                    onChange={(e) => setForm({ ...form, nilai_komisi: sanitizeRupiahInput(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Compliment (Produk)</Label>
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Master produk belum ada / tidak bisa dimuat.</p>
                ) : (
                  <ScrollArea className="border-border-/50 h-40 rounded-md border p-2">
                    <div className="space-y-2">
                      {products.map((p) => {
                        const selected = (form.compliments || []).find((c) => c.kode === p.kode);
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!selected}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...(form.compliments || []), { kode: p.kode, qty: 1 }]
                                    : (form.compliments || []).filter((c) => c.kode !== p.kode);
                                  setForm({ ...form, compliments: next });
                                }}
                              />
                              <span>
                                {p.nama} <span className="text-xs text-muted-foreground">({p.kode})</span>
                              </span>
                            </label>
                            <Input
                              value={String(selected?.qty ?? 1)}
                              autoUppercase={false}
                              inputMode="numeric"
                              className="w-20"
                              disabled={!selected}
                              onChange={(e) => {
                                const qty = Number(e.target.value.replace(/\D/g, "")) || 1;
                                const next = (form.compliments || []).map((c) => (c.kode === p.kode ? { ...c, qty } : c));
                                setForm({ ...form, compliments: next });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
                <p className="text-xs text-muted-foreground">Produk compliment harga 0, tetapi stok tetap berkurang saat pembayaran.</p>
              </div>
              <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="border-border-/50">
        <CardContent className="p-5">
          <div className="border-border-/60 mb-4 rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium">Edit Komisi</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={bulkCommissionType}
                onChange={(e) => setBulkCommissionType(e.target.value as "persentase" | "rupiah")}
              >
                <option value="persentase">Persentase (%)</option>
                <option value="rupiah">Nominal (Rp)</option>
              </select>
              <Input
                value={bulkCommissionType === "rupiah" ? formatRupiahInput(bulkCommissionValue) : bulkCommissionValue}
                inputMode="numeric"
                onChange={(e) => setBulkCommissionValue(sanitizeRupiahInput(e.target.value))}
                placeholder={bulkCommissionType === "persentase" ? "Contoh: 10" : "Contoh: 20.000"}
              />
              <Button variant="outline" onClick={toggleSelectAll}>
                {selectedIds.length === data.length && data.length > 0 ? "Batal Pilih Semua" : "Pilih Semua"}
              </Button>
              <Button onClick={handleBulkApply} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Terapkan ({selectedIds.length})
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Gunakan ini untuk set komisi massal, lalu ubah per layanan jika ada pengecualian.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="w-10 pb-3 font-medium">
                    <input
                      type="checkbox"
                      checked={data.length > 0 && selectedIds.length === data.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="w-10 pb-3 font-medium"></th>
                  <th className="w-32 pb-3 font-medium">Kode</th>
                  <th className="min-w-[240px] pb-3 font-medium">Nama Layanan</th>
                  <th className="w-40 pb-3 text-right font-medium">Harga</th>
                  <th className="w-40 pb-3 text-right font-medium">Komisi</th>
                  <th className="w-28 pb-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((l) => {
                  const isOpen = expanded === l.id;
                  const compliments = Array.isArray(l.compliments) ? l.compliments : [];
                  const complimentLines = compliments.map((c) => {
                    const prod = products.find((p) => p.kode === c.kode);
                    const name = prod ? prod.nama : c.kode;
                    return `${name} (${c.kode}) x ${c.qty}`;
                  });

                  return (
                    <Fragment key={l.id}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 text-center align-top">
                          <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelectRow(l.id)} />
                        </td>
                        <td className="py-2 text-center align-top">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={isOpen ? "Tutup" : "Lihat compliment"}
                            onClick={() => handleExpand(l.id)}
                            className="text-accent"
                          >
                            {isOpen ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                          </Button>
                        </td>
                        <td className="py-2 align-top font-medium">{l.kode}</td>
                        <td className="py-2 align-top">{l.nama}</td>
                        <td className="py-2 text-right align-top tabular-nums">{formatRp(l.harga)}</td>
                        <td className="py-2 text-right align-top tabular-nums">
                          {l.type_komisi === "rupiah"
                            ? formatRp(Number(l.nilai_komisi || 0))
                            : `${Number(l.nilai_komisi || 0)}%`}
                        </td>
                        <td className="py-2 text-right align-top">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(l)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b bg-muted/40 last:border-0">
                          <td colSpan={7} className="p-0">
                            <div className="px-4 py-3">
                              <div className="text-sm font-semibold">Compliment Produk:</div>
                              {complimentLines.length > 0 ? (
                                <div className="mt-1 whitespace-pre-line text-sm">{complimentLines.join("\n")}</div>
                              ) : (
                                <div className="mt-1 text-xs text-muted-foreground">Tidak ada compliment.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
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
