import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, resolveMediaUrl, type BookingItem, type Employee, type Service } from "@/lib/api";
import { formatLocalYmd } from "@/lib/date";

function getToday() {
  return formatLocalYmd(new Date()) ?? "";
}

const emptyFotoSet = { depan: "", kiri: "", kanan: "", belakang: "" };
const fotoSlots: Array<{ key: keyof typeof emptyFotoSet; label: string }> = [
  { key: "depan", label: "Tampak Depan" },
  { key: "kiri", label: "Samping Kiri" },
  { key: "kanan", label: "Samping Kanan" },
  { key: "belakang", label: "Tampak Belakang" },
];

async function fileToCompressedDataUrl(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal memproses gambar"));
    el.src = rawDataUrl;
  });
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function BookedList() {
  const [data, setData] = useState<BookingItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [from, setFrom] = useState(getToday());
  const [to, setTo] = useState(getToday());
  const [status, setStatus] = useState<"Aktif" | "Menunggu" | "Proses" | "Selesai">("Aktif");

  const loadData = async () => {
    try {
      const [bookings, employeeRows] = await Promise.all([
        api.getBookings({ from, to }),
        api.getEmployees(),
      ]);
      setData(bookings);
      setEmployees(employeeRows);
      if (services.length === 0) setServices(await api.getServices());
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line
  }, [from, to]);

  const [assignTarget, setAssignTarget] = useState<{ id: string; pegawai: string } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<string | null>(null);
  const [addServiceTarget, setAddServiceTarget] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [photoTarget, setPhotoTarget] = useState<BookingItem | null>(null);
  const [photoForm, setPhotoForm] = useState(emptyFotoSet);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; label: string } | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [photoPickerTarget, setPhotoPickerTarget] = useState<keyof typeof emptyFotoSet | null>(null);
  const [cameraTarget, setCameraTarget] = useState<keyof typeof emptyFotoSet | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRefs = useRef<Partial<Record<keyof typeof emptyFotoSet, HTMLInputElement | null>>>({});
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const handleAssign = async () => {
    if (!assignTarget) return;
    try {
      await api.assignBooking(assignTarget.id, assignTarget.pegawai);
      await loadData();
      toast({ title: "Berhasil", description: `Booking berhasil di-assign ke ${assignTarget.pegawai}` });
    } catch (error) {
      toast({
        title: "Gagal assign booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setAssignTarget(null);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    try {
      await api.completeBooking(completeTarget);
      await loadData();
      toast({ title: "Berhasil", description: "Booking selesai" });
    } catch (error) {
      toast({
        title: "Gagal update booking",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setCompleteTarget(null);
    }
  };

  const handleAddService = async () => {
    if (!addServiceTarget || !selectedService) return;
    try {
      await api.addServiceToBooking(addServiceTarget, selectedService);
      await loadData();
      toast({ title: "Berhasil", description: "Layanan ditambahkan ke booking" });
    } catch (error) {
      toast({
        title: "Gagal menambah layanan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setAddServiceTarget(null);
      setSelectedService("");
    }
  };

  const openPhotoDialog = (booking: BookingItem) => {
    const firstFoto = booking.foto?.[0];
    setPhotoTarget(booking);
    setPhotoForm({
      depan: resolveMediaUrl(firstFoto?.depan || ""),
      kiri: resolveMediaUrl(firstFoto?.kiri || ""),
      kanan: resolveMediaUrl(firstFoto?.kanan || ""),
      belakang: resolveMediaUrl(firstFoto?.belakang || ""),
    });
  };

  const handleChoosePhoto = async (key: keyof typeof emptyFotoSet, file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoForm((prev) => ({ ...prev, [key]: dataUrl }));
    } catch (error) {
      toast({
        title: "Gagal memproses foto",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const savePhotos = async () => {
    if (!photoTarget) return;
    setPhotoSaving(true);
    try {
      await api.saveBookingHaircutPhotos(photoTarget.id, photoForm);
      await loadData();
      toast({ title: "Berhasil", description: "Foto terakhir disimpan" });
      setPhotoTarget(null);
      setPhotoForm(emptyFotoSet);
    } catch (error) {
      toast({
        title: "Gagal menyimpan foto",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setPhotoSaving(false);
    }
  };

  const removePhoto = (key: keyof typeof emptyFotoSet) => {
    setPhotoForm((prev) => ({ ...prev, [key]: "" }));
  };

  const stopCamera = () => {
    if (cameraStream) {
      for (const track of cameraStream.getTracks()) {
        track.stop();
      }
    }
    setCameraStream(null);
    setCameraTarget(null);
    setCameraReady(false);
    setCameraError("");
  };

  const startCamera = async (key: keyof typeof emptyFotoSet) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Kamera tidak didukung",
        description: "Browser ini tidak mendukung akses kamera. Gunakan opsi Pilih File.",
        variant: "destructive",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        setCameraError("Kamera tidak terdeteksi. Coba pilih file atau cek izin kamera.");
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      setCameraTarget(key);
      setCameraStream(stream);
      setCameraError("");
      setCameraReady(false);
    } catch {
      setCameraError("Gagal akses kamera. Izinkan kamera di browser lalu coba lagi.");
      toast({
        title: "Kamera tidak bisa dibuka",
        description: "Pastikan izin kamera aktif dan aplikasi dibuka via browser yang mendukung HTTPS/localhost.",
        variant: "destructive",
      });
    }
  };

  const captureFromCamera = () => {
    if (!cameraTarget || !videoRef.current) return;
    const video = videoRef.current;
    const rawWidth = Math.max(1, video.videoWidth || 1);
    const rawHeight = Math.max(1, video.videoHeight || 1);
    const ratio = Math.min(1, 1280 / Math.max(rawWidth, rawHeight));
    const width = Math.max(1, Math.round(rawWidth * ratio));
    const height = Math.max(1, Math.round(rawHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast({ title: "Gagal ambil foto", description: "Canvas tidak tersedia di browser.", variant: "destructive" });
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPhotoForm((prev) => ({ ...prev, [cameraTarget]: dataUrl }));
    stopCamera();
  };

  const openPhotoSourcePicker = (key: keyof typeof emptyFotoSet) => {
    setPhotoPickerTarget(key);
  };

  const choosePhotoSource = (source: "camera" | "file") => {
    if (!photoPickerTarget) return;
    if (source === "camera") {
      void startCamera(photoPickerTarget);
    } else {
      const targetInput = fileInputRefs.current[photoPickerTarget];
      targetInput?.click();
    }
    setPhotoPickerTarget(null);
  };

  const openPhotoPreview = (src: string, label: string) => {
    setPhotoPreview({ src, label });
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
  };

  const zoomInPreview = () => setPhotoZoom((z) => Math.min(4, z + 0.2));
  const zoomOutPreview = () =>
    setPhotoZoom((z) => {
      const next = Math.max(1, z - 0.2);
      if (next <= 1) {
        setPhotoPan({ x: 0, y: 0 });
      }
      return next;
    });

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (photoZoom <= 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: photoPan.x,
      originY: photoPan.y,
    };
    setIsPanning(true);
  };

  const handlePreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current || photoZoom <= 1) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPhotoPan({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy,
    });
  };

  const handlePreviewPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    panStartRef.current = null;
    setIsPanning(false);
  };

  useEffect(() => {
    if (!cameraStream) return;
    let cancelled = false;
    const attachStream = async (attempt = 0) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) {
        if (attempt < 20) {
          requestAnimationFrame(() => {
            void attachStream(attempt + 1);
          });
        }
        return;
      }
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
      }
      try {
        await video.play();
        if (!cancelled) setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraError("Preview kamera tidak bisa diputar. Coba buka kamera native.");
        }
      }
    };
    void attachStream();
    return () => {
      cancelled = true;
    };
  }, [cameraStream, cameraTarget]);

  useEffect(() => {
    return () => {
      if (!cameraStream) return;
      for (const track of cameraStream.getTracks()) {
        track.stop();
      }
    };
  }, [cameraStream]);

  const statusVariant: Record<string, string> = {
    Menunggu: "bg-muted text-muted-foreground",
    Proses: "bg-warning/10 text-warning",
    Selesai: "bg-success/10 text-success",
  };

  const sortByAntrianAsc = (a: BookingItem, b: BookingItem) => (Number(a.antrian) || 0) - (Number(b.antrian) || 0);
  const menungguRows = data.filter((b) => b.status === "Menunggu").slice().sort(sortByAntrianAsc);
  const prosesRows = data.filter((b) => b.status === "Proses").slice().sort(sortByAntrianAsc);
  const selesaiRows = data.filter((b) => b.status === "Selesai").slice().sort(sortByAntrianAsc);

  const renderCards = (rows: BookingItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((b) => (
        <Card key={b.id} className={`border-border/50 ${b.status === "Selesai" ? "opacity-60" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-bold text-accent">#{b.antrian}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusVariant[b.status]}`}>
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{b.bookingCode}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{b.customerName}</span></p>
              <div className="flex flex-wrap gap-1">
                {b.services.map((l) => (
                  <Badge key={l.kode} variant="secondary" className="text-xs">{l.nama}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Foto tersimpan: {fotoSlots.filter((slot) => Boolean(String(b.foto?.[0]?.[slot.key] || ""))).length}/4
              </p>
              <Button onClick={() => openPhotoDialog(b)} variant="outline" className="w-full" size="sm">
                Tambah Foto
              </Button>
            </div>

            {b.status === "Menunggu" && (
              <>
                <Select onValueChange={(v) => setAssignTarget({ id: b.id, pegawai: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Assign pegawai..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.nama}>{employee.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AlertDialog open={!!assignTarget && assignTarget?.id === b.id} onOpenChange={(open) => !open && setAssignTarget(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Proses booking?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div>Booking akan diproses oleh pegawai <b>{assignTarget?.pegawai}</b>. Lanjutkan?</div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAssign}>Ya, proses</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {b.status === "Proses" && (
              <div className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Pegawai:</span> <span className="font-medium">{b.employeeName}</span></p>
                <Button
                  onClick={() => setAddServiceTarget(b.id)}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  Tambah Layanan
                </Button>
                <Button onClick={() => setCompleteTarget(b.id)} className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> Selesai
                </Button>
                <AlertDialog open={completeTarget === b.id} onOpenChange={(open) => !open && setCompleteTarget(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Selesaikan booking?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div>Booking akan diselesaikan. Lanjutkan?</div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>Ya, selesai</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {b.status === "Selesai" && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Dikerjakan oleh: <span className="font-medium text-foreground">{b.employeeName || "-"}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      b.paymentStatus === "Paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {b.paymentStatus === "Paid" ? "Lunas" : "Belum bayar"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {rows.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground">Belum ada data booking.</CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Booked" description="Kelola antrian booking yang masuk" />
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs mb-1">Dari</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Sampai</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" autoUppercase={false} />
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "Aktif" | "Menunggu" | "Proses" | "Selesai")}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Menunggu">Menunggu</SelectItem>
              <SelectItem value="Proses">Proses</SelectItem>
              <SelectItem value="Selesai">Selesai</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === "Aktif" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="mb-3">
                <div className="font-display font-semibold text-lg">Menunggu</div>
                <div className="text-xs text-muted-foreground">Booking yang belum di-assign</div>
              </div>
              {renderCards(menungguRows)}
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="mb-3">
                <div className="font-display font-semibold text-lg">Proses</div>
                <div className="text-xs text-muted-foreground">Booking yang sedang dikerjakan</div>
              </div>
              {renderCards(prosesRows)}
            </CardContent>
          </Card>
        </div>
      ) : status === "Menunggu" ? (
        renderCards(menungguRows)
      ) : status === "Proses" ? (
        renderCards(prosesRows)
      ) : (
        renderCards(selesaiRows)
      )}

      <Dialog open={!!addServiceTarget} onOpenChange={(open) => (!open ? setAddServiceTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Tambah Layanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger><SelectValue placeholder="Pilih layanan..." /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.kode}>
                    {s.nama} ({s.kode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddService} disabled={!selectedService} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Tambahkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!photoTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoTarget(null);
            setPhotoForm(emptyFotoSet);
            setPhotoPickerTarget(null);
            stopCamera();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Foto Hasil Pangkas Rambut {photoTarget?.bookingCode}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fotoSlots.map((slot) => (
              <div key={slot.key} className="space-y-2 rounded-md border border-border/70 p-2">
                <div className="text-xs font-medium">{slot.label}</div>
                <input
                  ref={(el) => {
                    fileInputRefs.current[slot.key] = el;
                  }}
                  id={`haircut-photo-file-${slot.key}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleChoosePhoto(slot.key, e.target.files?.[0])}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openPhotoSourcePicker(slot.key)}
                    className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium cursor-pointer hover:bg-accent/10"
                  >
                    {photoForm[slot.key] ? "Ganti Foto" : "Upload Foto"}
                  </button>
                  <span className="text-xs text-muted-foreground truncate">
                    {photoForm[slot.key] ? "Foto sudah dipilih" : "Belum ada file"}
                  </span>
                </div>
                {photoForm[slot.key] ? (
                  <div className="relative">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-1 top-1 z-10 h-7 w-7"
                      onClick={() => removePhoto(slot.key)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <img
                      src={photoForm[slot.key]}
                      alt={slot.label}
                      onClick={() => openPhotoPreview(photoForm[slot.key], slot.label)}
                      className="w-full h-28 object-cover rounded border border-border/70 cursor-zoom-in"
                    />
                  </div>
                ) : (
                  <div className="w-full h-28 rounded border border-dashed border-border/70 text-xs text-muted-foreground flex items-center justify-center">
                    Belum ada foto
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button onClick={savePhotos} disabled={photoSaving} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {photoSaving ? "Menyimpan..." : "Simpan Foto"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!photoPickerTarget} onOpenChange={(open) => !open && setPhotoPickerTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pilih Sumber Foto</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">Pilih ambil foto langsung dari kamera atau pilih dari file.</div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => choosePhotoSource("camera")} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Foto Kamera
            </AlertDialogAction>
            <AlertDialogAction onClick={() => choosePhotoSource("file")}>
              Pilih File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!cameraTarget} onOpenChange={(open) => (!open ? stopCamera() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Foto Kamera</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md border border-border/70 bg-black">
              <video
                ref={videoRef}
                className="h-72 w-full object-cover"
                autoPlay
                playsInline
                muted
                onCanPlay={() => setCameraReady(true)}
                onLoadedData={() => setCameraReady(true)}
              />
              {!cameraReady && (
                <div className="absolute inset-0 z-10 flex h-72 w-full items-center justify-center text-sm text-white/80">
                  Menghubungkan kamera...
                </div>
              )}
            </div>
            {cameraError ? <div className="text-xs text-destructive">{cameraError}</div> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={stopCamera}>
                Batal
              </Button>
              <Button onClick={captureFromCamera} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Ambil Foto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!photoPreview}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoPreview(null);
            setPhotoZoom(1);
            setPhotoPan({ x: 0, y: 0 });
            setIsPanning(false);
          }
        }}
      >
        <DialogContent className="w-[588px] h-[786px] max-w-[94vw] max-h-[92vh] border-none bg-transparent p-0 shadow-none [&>button]:hidden">
          <div className="relative mx-auto w-full h-full overflow-hidden rounded-2xl bg-black">
            {photoPreview?.src ? (
              <div
                className={`w-full h-full flex items-center justify-center p-2 select-none touch-none ${photoZoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerEnd}
                onPointerCancel={handlePreviewPointerEnd}
              >
                <img
                  src={photoPreview.src}
                  alt={photoPreview.label}
                  draggable={false}
                  className={`block w-full h-full origin-center rounded-xl object-cover ${isPanning ? "" : "transition-transform duration-75"}`}
                  style={{ transform: `translate(${photoPan.x}px, ${photoPan.y}px) scale(${photoZoom})` }}
                />
              </div>
            ) : null}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/75 hover:text-white"
                onClick={zoomInPreview}
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/75 hover:text-white"
                onClick={zoomOutPreview}
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/75 hover:text-white"
              onClick={() => {
                setPhotoPreview(null);
                setPhotoZoom(1);
                setPhotoPan({ x: 0, y: 0 });
                setIsPanning(false);
              }}
            >
              <X className="h-7 w-7" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
