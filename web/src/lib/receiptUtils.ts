import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReceiptData = {
  bookingCode: string;
  paidAt: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{ type: "service" | "product"; kode: string; nama: string; harga: number; qty: number; isCompliment?: boolean }>;
  total: number;
  received: number;
  change: number;
};

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export function generateReceiptPdf(receipt: ReceiptData) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("STRUK PEMBAYARAN", 14, 16);
  doc.setFontSize(10);
  doc.text(`No Booking: ${receipt.bookingCode}`, 14, 24);
  doc.text(`Tanggal: ${new Date(receipt.paidAt).toLocaleString("id-ID")}`, 14, 29);
  if (receipt.customerName || receipt.customerPhone) {
    doc.text(`Customer: ${receipt.customerName || "-"} ${receipt.customerPhone ? `(${receipt.customerPhone})` : ""}`.trim(), 14, 34);
  }

  const rows = receipt.items.map((it) => [
    it.type === "product" && it.isCompliment ? `${it.nama} (Compliment)` : it.nama,
    String(it.qty),
    formatRp(it.harga),
    formatRp(it.harga * it.qty),
  ]);

  autoTable(doc, {
    startY: receipt.customerName || receipt.customerPhone ? 41 : 36,
    head: [["Item", "Qty", "Harga", "Subtotal"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [45, 40, 36], textColor: [255, 255, 255], halign: "center" },
    columnStyles: {
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
    },
  });

  const lastY = (doc as any).lastAutoTable?.finalY || 36;
  doc.setFontSize(10);
  doc.text(`Total: ${formatRp(receipt.total)}`, 14, lastY + 10);
  doc.text(`Dibayar: ${formatRp(receipt.received)}`, 14, lastY + 16);
  doc.text(`Kembalian: ${formatRp(receipt.change)}`, 14, lastY + 22);

  doc.save(`struk_${receipt.bookingCode}.pdf`);
}

export function openReceiptPrintWindow(receipt: ReceiptData) {
  const lines = receipt.items
    .map((it) => {
      const name = it.type === "product" && it.isCompliment ? `${it.nama} (Compliment)` : it.nama;
      const subtotal = formatRp(it.harga * it.qty);
      return `<tr><td>${escapeHtml(name)}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${subtotal}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Struk ${escapeHtml(receipt.bookingCode)}</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 16px; }
        .wrap { max-width: 360px; margin: 0 auto; }
        h1 { font-size: 16px; margin: 0 0 8px; }
        .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 6px 0; border-bottom: 1px dashed #ddd; }
        th { text-align: left; }
        .tot { margin-top: 12px; font-size: 12px; }
        .tot div { display: flex; justify-content: space-between; padding: 3px 0; }
        .bold { font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <h1>STRUK PEMBAYARAN</h1>
        <div class="meta">
          <div>No Booking: <b>${escapeHtml(receipt.bookingCode)}</b></div>
          <div>${escapeHtml(new Date(receipt.paidAt).toLocaleString("id-ID"))}</div>
          ${
            receipt.customerName || receipt.customerPhone
              ? `<div>Customer: <b>${escapeHtml(receipt.customerName || "-")}</b> ${receipt.customerPhone ? escapeHtml(receipt.customerPhone) : ""}</div>`
              : ""
          }
        </div>
        <table>
          <thead>
            <tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Subtotal</th></tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>
        <div class="tot">
          <div class="bold"><span>Total</span><span>${escapeHtml(formatRp(receipt.total))}</span></div>
          <div><span>Dibayar</span><span>${escapeHtml(formatRp(receipt.received))}</span></div>
          <div><span>Kembalian</span><span>${escapeHtml(formatRp(receipt.change))}</span></div>
        </div>
      </div>
      <script>
        window.onload = () => { window.print(); };
      </script>
    </body>
  </html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function buildReceiptText(receipt: ReceiptData) {
  const customerLine =
    receipt.customerName || receipt.customerPhone
      ? `Customer: ${receipt.customerName || "-"}${receipt.customerPhone ? ` (${receipt.customerPhone})` : ""}\n`
      : "";
  const header = `Struk ${receipt.bookingCode}\n${new Date(receipt.paidAt).toLocaleString("id-ID")}\n${customerLine}`;
  const items = receipt.items
    .map((it) => {
      const name = it.type === "product" && it.isCompliment ? `${it.nama} (Compliment)` : it.nama;
      return `- ${name} x${it.qty} = ${formatRp(it.harga * it.qty)}`;
    })
    .join("\n");
  const footer = `\n\nTotal: ${formatRp(receipt.total)}\nDibayar: ${formatRp(receipt.received)}\nKembalian: ${formatRp(receipt.change)}`;
  return `${header}\n${items}${footer}`;
}

export function normalizeWaPhoneId(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  return digits.startsWith("62") ? digits : null;
}

export function openWhatsAppReceipt(phone: string, text: string) {
  const normalized = normalizeWaPhoneId(phone);
  if (!normalized) return false;
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  return true;
}

export function openEmailReceipt(email: string, subject: string, body: string) {
  const to = String(email || "").trim();
  if (!to) return false;
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  return true;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
