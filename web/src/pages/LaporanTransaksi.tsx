import { Fragment, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, FileText } from "lucide-react";
import { api, type TransactionDetailRow, type TransactionItemsGroupedResponse } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatLocalYmd } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatNumberId = (n: number) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);
const parseLocalYmd = (ymd: string) => {
  if (!ymd) return undefined;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const getLastAutoTableY = (doc: jsPDF, fallback: number) =>
  ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback) as number;

type ViewMode = "rekap" | "detail"; // Rekap = transaksi, Detail = item per transaksi

export default function LaporanTransaksi() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState<Date | undefined>(today);
  const [to, setTo] = useState<Date | undefined>(new Date(today));
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("rekap");

  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [details, setDetails] = useState<TransactionDetailRow[]>([]);
  const [groups, setGroups] = useState<TransactionItemsGroupedResponse["groups"]>([]);

  const fromYmd = formatLocalYmd(from);
  const toYmd = formatLocalYmd(to);

  const titleRange = useMemo(() => {
    if (fromYmd && toYmd && fromYmd === toYmd) return `Tanggal: ${fromYmd}`;
    if (fromYmd && toYmd) return `Periode: ${fromYmd} s/d ${toYmd}`;
    if (fromYmd) return `Periode: ${fromYmd} s/d ...`;
    if (toYmd) return `Periode: ... s/d ${toYmd}`;
    return "Periode: -";
  }, [fromYmd, toYmd]);

  const statusLabel = (status: "Paid" | "Void") => (status === "Paid" ? "POSTED" : "VOID");

  const detailSummary = useMemo(() => {
    const count = details.length;
    const totalRp = details.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    return { count, totalRp };
  }, [details]);

  const groupedSummary = useMemo(() => {
    let totalQty = 0;
    let totalHarga = 0;
    let totalSubtotal = 0;
    for (const g of groups) {
      for (const it of g.items || []) {
        totalQty += Number(it.qty) || 0;
        totalHarga += Number(it.harga) || 0;
        totalSubtotal += Number(it.subtotal) || 0;
      }
    }
    return { totalQty, totalHarga, totalSubtotal };
  }, [groups]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const rows = await api.getTransactionDetails({ from: fromYmd, to: toYmd, q: query.trim() || undefined });
      setDetails(rows);
    } catch (error) {
      toast({
        title: "Gagal memuat detail transaksi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const payload = await api.getTransactionItemsGrouped({ from: fromYmd, to: toYmd, q: query.trim() || undefined });
      setGroups(payload.groups || []);
    } catch (error) {
      toast({
        title: "Gagal memuat detail item",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (viewMode === "rekap") {
      void loadDetails();
    } else {
      void loadGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromYmd, toYmd, viewMode]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (viewMode === "rekap") void loadDetails();
      else void loadGroups();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, viewMode]);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];

    // Keep export layout consistent with the on-screen table:
    // - One table per view mode
    // - Grouping/subtotal/total rows are embedded inside the table (colSpan-like via merges)

    // Title (as shown above the table)
    wsData.push([titleRange, "", "", "", "", ""]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
    wsData.push(["", "", "", "", "", ""]);

    if (viewMode === "rekap") {
      wsData.push(["No", "Kode Transaksi", "Customer", "Barber", "Jumlah Rp", "Status"]);
      details.forEach((d, idx) => {
        wsData.push([
          idx + 1,
          d.saleCode || d.bookingCode,
          d.customerName || "-",
          d.barber || "-",
          formatNumberId(d.total),
          statusLabel(d.status),
        ]);
      });

      // Footer row mirrors the <tfoot> in the table
      const footerRowIndex = wsData.length;
      wsData.push([`Total ${formatNumberId(detailSummary.count)}`, "", "", "", formatNumberId(detailSummary.totalRp), ""]);
      merges.push({ s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 1 } });
      merges.push({ s: { r: footerRowIndex, c: 2 }, e: { r: footerRowIndex, c: 3 } });
    } else {
      wsData.push(["No", "Item Type", "Nama Item", "Qty", "Harga", "Subtotal"]);

      for (const g of groups) {
        const code = g.saleCode || g.bookingCode;

        // Group header row (merged across the whole table)
        const groupRowIndex = wsData.length;
        wsData.push([code, "", "", "", "", ""]);
        merges.push({ s: { r: groupRowIndex, c: 0 }, e: { r: groupRowIndex, c: 5 } });

        let subQty = 0;
        let subHarga = 0;
        let subSubtotal = 0;
        (g.items || []).forEach((it, idx) => {
          subQty += Number(it.qty) || 0;
          subHarga += Number(it.harga) || 0;
          subSubtotal += Number(it.subtotal) || 0;
          wsData.push([
            idx + 1,
            it.type === "service" ? "SERVICE" : "PRODUCT",
            `${it.nama}${it.type === "product" && it.isCompliment ? " (Compliment)" : ""}`,
            Number(it.qty) || 0,
            formatNumberId(it.harga),
            formatNumberId(it.subtotal),
          ]);
        });

        // Subtotal row (SUB TOTAL spans first 3 cols)
        const subRowIndex = wsData.length;
        wsData.push(["SUB TOTAL", "", "", formatNumberId(subQty), formatNumberId(subHarga), formatNumberId(subSubtotal)]);
        merges.push({ s: { r: subRowIndex, c: 0 }, e: { r: subRowIndex, c: 2 } });
      }

      // Total row (TOTAL spans first 3 cols)
      const totalRowIndex = wsData.length;
      wsData.push(["TOTAL", "", "", formatNumberId(groupedSummary.totalQty), formatNumberId(groupedSummary.totalHarga), formatNumberId(groupedSummary.totalSubtotal)]);
      merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 2 } });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!merges"] = merges;
    ws["!cols"] =
      viewMode === "rekap"
        ? [{ wch: 6 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
        : [{ wch: 6 }, { wch: 12 }, { wch: 36 }, { wch: 6 }, { wch: 12 }, { wch: 12 }];

    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "laporan_transaksi.xlsx");
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Laporan Transaksi", 14, 16);
    doc.setFontSize(10);
    doc.text(titleRange, 14, 22);

    const headFill: [number, number, number] = [240, 240, 240];
    const borderColor: [number, number, number] = [210, 210, 210];
    const zebraFill: [number, number, number] = [248, 248, 248];
    const groupFill: [number, number, number] = [245, 245, 245];
    const totalFill: [number, number, number] = [242, 242, 242];

    if (viewMode === "rekap") {
      autoTable(doc, {
        startY: 28,
        head: [["No", "Kode Transaksi", "Customer", "Barber", "Jumlah Rp", "Status"]],
        body: details.map((d, idx) => [
          String(idx + 1),
          d.saleCode || d.bookingCode,
          d.customerName || "-",
          d.barber || "-",
          formatNumberId(d.total),
          statusLabel(d.status),
        ]),
        foot: [
          [
            { content: `Total ${formatNumberId(detailSummary.count)}`, colSpan: 2 },
            { content: "", colSpan: 2 },
            { content: formatNumberId(detailSummary.totalRp), styles: { halign: "right" } },
            "",
          ],
        ],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, lineColor: borderColor, lineWidth: 0.1 },
        headStyles: { fillColor: headFill, textColor: [90, 90, 90], fontStyle: "bold" },
        alternateRowStyles: { fillColor: zebraFill },
        footStyles: { fillColor: totalFill, textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 38 },
          2: { cellWidth: 50 },
          3: { cellWidth: 26 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "center", cellWidth: 18 },
        },
      });
    } else {
      const body: unknown[] = [];

      for (const g of groups) {
        const code = g.saleCode || g.bookingCode;

        body.push([{ content: code, colSpan: 6, styles: { fillColor: groupFill, fontStyle: "bold" } }]);

        (g.items || []).forEach((it, idx) => {
          const fill = idx % 2 === 1 ? zebraFill : undefined;
          const cell = (content: string, styles?: Record<string, unknown>) => ({ content, styles: { ...(fill ? { fillColor: fill } : {}), ...(styles || {}) } });
          body.push([
            cell(String(idx + 1), { halign: "center" }),
            cell(it.type === "service" ? "SERVICE" : "PRODUCT"),
            cell(`${it.nama}${it.type === "product" && it.isCompliment ? " (Compliment)" : ""}`),
            cell(formatNumberId(it.qty), { halign: "right" }),
            cell(formatNumberId(it.harga), { halign: "right" }),
            cell(formatNumberId(it.subtotal), { halign: "right" }),
          ]);
        });

        const sub = (g.items || []).reduce(
          (acc, it) => {
            acc.qty += Number(it.qty) || 0;
            acc.harga += Number(it.harga) || 0;
            acc.subtotal += Number(it.subtotal) || 0;
            return acc;
          },
          { qty: 0, harga: 0, subtotal: 0 },
        );

        body.push([
          { content: "SUB TOTAL", colSpan: 3, styles: { fillColor: totalFill, fontStyle: "bold" } },
          { content: formatNumberId(sub.qty), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
          { content: formatNumberId(sub.harga), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
          { content: formatNumberId(sub.subtotal), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
        ]);
      }

      // TOTAL row
      body.push([
        { content: "TOTAL", colSpan: 3, styles: { fillColor: totalFill, fontStyle: "bold" } },
        { content: formatNumberId(groupedSummary.totalQty), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
        { content: formatNumberId(groupedSummary.totalHarga), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
        { content: formatNumberId(groupedSummary.totalSubtotal), styles: { fillColor: totalFill, fontStyle: "bold", halign: "right" } },
      ]);

      autoTable(doc, {
        startY: 28,
        head: [["No", "Item Type", "Nama Item", "Qty", "Harga", "Subtotal"]],
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, lineColor: borderColor, lineWidth: 0.1 },
        headStyles: { fillColor: headFill, textColor: [90, 90, 90], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 24 },
          2: { cellWidth: 74 },
          3: { cellWidth: 16, halign: "right" },
          4: { cellWidth: 28, halign: "right" },
          5: { cellWidth: 30, halign: "right" },
        },
      });
    }

    doc.save("laporan_transaksi.pdf");
  };

  return (
    <div>
      <PageHeader title="Laporan Transaksi" description="Rekap transaksi dan detail item">
        <Button variant="outline" size="sm" onClick={downloadExcel} disabled={viewMode === "rekap" ? loading : loadingGroups}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={downloadPdf} disabled={viewMode === "rekap" ? loading : loadingGroups}>
          <FileText className="w-4 h-4 mr-2" /> PDF
        </Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">Tanggal Dari</label>
          <Input type="date" value={fromYmd || ""} onChange={(e) => setFrom(parseLocalYmd(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Tanggal Akhir</label>
          <Input type="date" value={toYmd || ""} onChange={(e) => setTo(parseLocalYmd(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Type Laporan</label>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rekap">Rekap</SelectItem>
              <SelectItem value="detail">Detail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Cari</label>
          <Input
            value={query}
            autoUppercase={false}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kode transaksi/booking, nama, no HP, barber, item..."
          />
        </div>
      </div>

      {viewMode === "rekap" ? (
        <Card className="border-border/50">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-muted-foreground">{titleRange}</div>
            {loading ? (
              <div className="text-center text-muted-foreground p-6">Memuat data...</div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-sm table-fixed min-w-[980px]">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                      <th className="py-3 px-3 font-medium w-16">No</th>
                      <th className="py-3 px-3 font-medium w-52">Kode Transaksi</th>
                      <th className="py-3 px-3 font-medium">Customer</th>
                      <th className="py-3 px-3 font-medium w-44">Barber</th>
                      <th className="py-3 px-3 font-medium text-right w-44">Jumlah Rp</th>
                      <th className="py-3 px-3 font-medium w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, idx) => (
                      <tr key={d.id} className="border-b last:border-0 even:bg-muted/30">
                        <td className="py-3 px-3 tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-3 font-medium">{d.saleCode || d.bookingCode}</td>
                        <td className="py-3 px-3 truncate">{d.customerName || "-"}</td>
                        <td className="py-3 px-3 truncate">{d.barber || "-"}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatNumberId(d.total)}</td>
                        <td className="py-3 px-3">{statusLabel(d.status)}</td>
                      </tr>
                    ))}
                    {details.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          Tidak ada transaksi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="py-3 px-3 tabular-nums" colSpan={2}>
                        Total {formatNumberId(detailSummary.count)}
                      </td>
                      <td className="py-3 px-3" colSpan={2} />
                      <td className="py-3 px-3 text-right tabular-nums">{formatNumberId(detailSummary.totalRp)}</td>
                      <td className="py-3 px-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="text-sm text-muted-foreground">{titleRange}</div>
              {loadingGroups ? (
                <div className="text-center text-muted-foreground p-6">Memuat data...</div>
              ) : groups.length === 0 ? (
                <div className="text-center text-muted-foreground p-6">Tidak ada transaksi.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-sm table-fixed min-w-[1040px]">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                        <th className="py-3 px-3 font-medium w-16">No</th>
                        <th className="py-3 px-3 font-medium w-32">Item Type</th>
                        <th className="py-3 px-3 font-medium">Nama Item</th>
                        <th className="py-3 px-3 font-medium text-right w-28">Qty</th>
                        <th className="py-3 px-3 font-medium text-right w-44">Harga</th>
                        <th className="py-3 px-3 font-medium text-right w-44">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => {
                        const code = g.saleCode || g.bookingCode;
                        const sub = (g.items || []).reduce(
                          (acc, it) => {
                            acc.qty += Number(it.qty) || 0;
                            acc.harga += Number(it.harga) || 0;
                            acc.subtotal += Number(it.subtotal) || 0;
                            return acc;
                          },
                          { qty: 0, harga: 0, subtotal: 0 },
                        );
                        return (
                          <Fragment key={g.saleId}>
                            <tr className="bg-muted/50 border-b">
                              <td className="py-3 px-3 font-semibold" colSpan={6}>
                                {code}
                              </td>
                            </tr>
                            {(g.items || []).map((it, idx) => (
                              <tr key={`${g.saleId}:${it.type}:${it.kode}:${idx}`} className="border-b last:border-0 even:bg-muted/30">
                                <td className="py-2 px-3 tabular-nums">{idx + 1}</td>
                                <td className="py-2 px-3">{it.type === "service" ? "SERVICE" : "PRODUCT"}</td>
                                <td className="py-2 px-3 truncate">
                                  {it.nama}
                                  {it.type === "product" && it.isCompliment ? <span className="text-xs text-muted-foreground"> (Compliment)</span> : null}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(it.qty)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(it.harga)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(it.subtotal)}</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/40 border-b font-semibold">
                              <td className="py-2 px-3" colSpan={3}>
                                SUB TOTAL
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(sub.qty)}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(sub.harga)}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{formatNumberId(sub.subtotal)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-semibold">
                        <td className="py-3 px-3" colSpan={3}>
                          TOTAL
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatNumberId(groupedSummary.totalQty)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatNumberId(groupedSummary.totalHarga)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatNumberId(groupedSummary.totalSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
