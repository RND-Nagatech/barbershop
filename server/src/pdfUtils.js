import PDFDocument from "pdfkit";

const formatRp = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0);

const toBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

export async function buildTicketPdf({ booking, branch }) {
  const doc = new PDFDocument({ size: "A6", margin: 24 });
  doc.fontSize(16).font("Helvetica-Bold").text("TIKET ANTREAN", { align: "left" });
  doc.moveDown(0.5);
  if (branch?.nama) doc.fontSize(10).font("Helvetica").fillColor("#444").text(`Cabang: ${branch.nama}`);
  doc.fontSize(10).fillColor("#444").text(new Date(booking.createdAt).toLocaleString("id-ID"));
  doc.moveDown(0.7);

  doc.fillColor("#111").fontSize(44).font("Helvetica-Bold").text(String(booking.antrian || "-"), { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(11).font("Helvetica-Bold").text(`Kode: ${booking.bookingCode}`);
  doc.fontSize(10).font("Helvetica").text(`Nama: ${booking.customerName || "-"}`);
  if (booking.phone) doc.fontSize(10).text(`No HP: ${booking.phone}`);
  doc.fontSize(10).text(`Status: ${booking.status || "-"}`);

  doc.moveDown(0.8);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.5);

  doc.fillColor("#111").fontSize(11).font("Helvetica-Bold").text("Layanan");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  let total = 0;
  for (const s of booking.services || []) {
    total += Number(s.harga) || 0;
    doc.text(`${s.nama}`, { continued: true });
    doc.text(`${formatRp(s.harga)}`, { align: "right" });
  }
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").text("Total", { continued: true });
  doc.text(formatRp(total), { align: "right" });

  if ((booking.products || []).length > 0) {
    doc.moveDown(0.6);
    doc.fontSize(11).font("Helvetica-Bold").text("Produk");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    for (const p of booking.products || []) {
      const label = p.isCompliment ? `${p.nama} (Compliment)` : p.nama;
      doc.text(`${label} x${p.qty}`, { continued: true });
      const subtotal = (Number(p.harga) || 0) * (Number(p.qty) || 0);
      doc.text(formatRp(subtotal), { align: "right" });
    }
  }

  return toBuffer(doc);
}

export async function buildReceiptPdf({ sale, branch }) {
  const doc = new PDFDocument({ size: "A6", margin: 24 });
  doc.fontSize(16).font("Helvetica-Bold").text("STRUK PEMBAYARAN", { align: "left" });
  doc.moveDown(0.5);
  if (branch?.nama) doc.fontSize(10).font("Helvetica").fillColor("#444").text(`Cabang: ${branch.nama}`);
  doc.fontSize(10).fillColor("#444").text(`No Booking: ${sale.bookingCode}`);
  doc.fontSize(10).fillColor("#444").text(new Date(sale.paidAt).toLocaleString("id-ID"));
  if (sale.customerName || sale.customerPhone) {
    doc.fontSize(10).fillColor("#444").text(`Customer: ${sale.customerName || "-"}${sale.customerPhone ? ` (${sale.customerPhone})` : ""}`);
  }
  doc.moveDown(0.6);

  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.5);

  doc.fillColor("#111").fontSize(10).font("Helvetica");
  for (const it of sale.items || []) {
    const isCompliment = it.type === "product" && it.isCompliment;
    const name = isCompliment ? `${it.nama} (Compliment)` : it.nama;
    const subtotal = (Number(it.harga) || 0) * (Number(it.qty) || 0);
    doc.text(`${name} x${it.qty}`, { continued: true });
    doc.text(formatRp(subtotal), { align: "right" });
  }

  doc.moveDown(0.6);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Total", { continued: true });
  doc.text(formatRp(sale.total), { align: "right" });
  doc.font("Helvetica").text("Dibayar", { continued: true });
  doc.text(formatRp(sale.received), { align: "right" });
  doc.text("Kembalian", { continued: true });
  doc.text(formatRp(sale.change), { align: "right" });

  return toBuffer(doc);
}

