import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingKomisi() {
  return (
    <div>
      <PageHeader title="Setting Komisi" description="Komisi sekarang diatur per layanan dan per produk" />

      <Card className="border-border-/50 max-w-2xl">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm">
            Konfigurasi komisi global sudah tidak dipakai lagi.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Atur komisi layanan di menu Master Layanan.</li>
            <li>Atur komisi produk di menu Master Produk.</li>
            <li>Untuk set cepat banyak item, gunakan fitur Edit Komisi.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
