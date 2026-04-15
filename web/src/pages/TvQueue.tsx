import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

type QueueItem = {
  antrian: number;
  bookingCode: string;
  customerName: string;
  status: "Menunggu" | "Proses" | "Selesai";
  employeeName: string;
};

async function fetchQueue(): Promise<QueueItem[]> {
  const response = await fetch(`${API_BASE_URL}/queue/today`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as QueueItem[];
}

export default function TvQueue() {
  const [data, setData] = useState<QueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let timer: number | undefined;
    const tick = async () => {
      try {
        const rows = await fetchQueue();
        setData(rows);
        setOnline(true);
      } catch {
        setOnline(false);
      } finally {
        timer = window.setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const view = useMemo(() => {
    const menunggu = data
      .filter((d) => d.status === "Menunggu")
      .slice()
      .sort((a, b) => (a.antrian || 0) - (b.antrian || 0));
    const proses = data
      .filter((d) => d.status === "Proses")
      .slice()
      .sort((a, b) => (a.antrian || 0) - (b.antrian || 0));

    const current = proses.slice(0, 2);
    const next = menunggu[0] || null;
    const upcoming = menunggu.slice(1, 4);

    return { current, next, upcoming };
  }, [data]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold tracking-tight">Antrean</h1>
          <p className="text-muted-foreground text-lg">Update otomatis setiap 2 detik</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-display text-2xl font-semibold tabular-nums">
              {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-muted-foreground">
              {now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })}
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm ${
              online ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50 bg-warning/10 text-warning">
              <h2 className="font-display text-2xl font-semibold">Sedang Dilayani</h2>
              <p className="opacity-80">{view.current.length > 0 ? `${view.current.length} antrean` : "Belum ada"}</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {view.current.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-14 text-xl">—</div>
              ) : (
                view.current.map((q) => (
                  <div key={q.bookingCode} className="rounded-2xl border border-border/50 p-6 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-muted-foreground">Nomor</div>
                      <div className="font-display text-6xl font-bold tracking-tight tabular-nums">{q.antrian}</div>
                      <div className="text-muted-foreground truncate">{q.employeeName ? `Barber: ${q.employeeName}` : ""}</div>
                    </div>
                    <div className="text-right text-muted-foreground text-sm">
                      <div>{q.bookingCode}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50 bg-muted/40">
              <h2 className="font-display text-2xl font-semibold">Antrian Selanjutnya</h2>
              <p className="text-muted-foreground">Siap dipanggil berikutnya</p>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div className="font-display text-7xl font-bold tracking-tight tabular-nums">{view.next?.antrian ?? "—"}</div>
              <div className="text-right text-muted-foreground">
                <div className="text-sm">{view.next?.bookingCode ?? ""}</div>
              </div>
            </div>
            {view.upcoming.length > 0 && (
              <div className="border-t border-border/50 px-6 py-5">
                <div className="text-sm text-muted-foreground mb-3">Berikutnya</div>
                <div className="flex gap-3 flex-wrap">
                  {view.upcoming.map((q) => (
                    <div
                      key={q.bookingCode}
                      className="rounded-xl border border-border/50 bg-background px-5 py-3 font-display text-3xl font-semibold tabular-nums"
                    >
                      {q.antrian}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border/50 bg-background">
            <h2 className="font-display text-2xl font-semibold">Info</h2>
            <p className="text-muted-foreground">Silakan menunggu sampai nomor dipanggil</p>
          </div>
          <div className="p-6 flex-1 flex items-center justify-center text-center">
            <div className="space-y-3">
              <div className="font-display text-3xl font-semibold">Terima kasih</div>
              <div className="text-muted-foreground text-lg">Mohon siapkan diri saat nomor tampil di layar</div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border/50 text-sm text-muted-foreground">
            {online ? "Sinkron dengan server" : "Koneksi terputus — akan mencoba ulang"}
          </div>
        </div>
      </div>
    </div>
  );
}
