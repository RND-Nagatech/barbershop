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

  const groups = useMemo(() => {
    const menunggu = data.filter((d) => d.status === "Menunggu");
    const proses = data.filter((d) => d.status === "Proses");
    const selesai = data.filter((d) => d.status === "Selesai");
    return { menunggu, proses, selesai };
  }, [data]);

  const Card = ({ title, items, accent }: { title: string; items: QueueItem[]; accent: string }) => (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className={`px-5 py-4 border-b border-border/50 ${accent}`}>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm opacity-80">{items.length} antrean</p>
      </div>
      <div className="p-5 space-y-3">
        {items.slice(0, 12).map((q) => (
          <div key={q.bookingCode} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 text-center">
                <div className="text-2xl font-display font-bold text-accent">{q.antrian}</div>
                <div className="text-[10px] text-muted-foreground">{q.bookingCode}</div>
              </div>
              <div className="min-w-0">
                <div className="text-base font-medium truncate">{q.customerName || "-"}</div>
                <div className="text-xs text-muted-foreground truncate">{q.employeeName ? `Barber: ${q.employeeName}` : ""}</div>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center text-muted-foreground py-10">Kosong</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Antrean Barber</h1>
          <p className="text-muted-foreground">Update otomatis setiap 2 detik</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm ${online ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {online ? "Online" : "Offline"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Menunggu" items={groups.menunggu} accent="bg-muted/40" />
        <Card title="Proses" items={groups.proses} accent="bg-warning/10 text-warning" />
        <Card title="Selesai" items={groups.selesai} accent="bg-success/10 text-success" />
      </div>
    </div>
  );
}

