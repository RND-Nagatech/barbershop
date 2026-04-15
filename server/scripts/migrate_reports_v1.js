import "dotenv/config";
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const formatSaleCode = ({ saleDate, seq }) => {
  const yymmdd = String(saleDate || "").replace(/-/g, "").slice(2);
  const num = String(seq).padStart(3, "0");
  return `SL-${yymmdd}-${num}`;
};

const saleCounterSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);
saleCounterSchema.index({ date: 1 }, { unique: true });

const saleItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["service", "product"], required: true },
    kode: { type: String, required: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    isCompliment: { type: Boolean, default: false },
  },
  { _id: false },
);

const saleSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, trim: true },
    saleCode: { type: String, trim: true, default: "" },
    employeeName: { type: String, trim: true, default: "" },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    items: { type: [saleItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    method: { type: String, trim: true, default: "Cash" },
    received: { type: Number, required: true, min: 0 },
    change: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true },
    paidYmd: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Paid", "Void"], default: "Paid" },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true, default: "" },
    voidedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
saleSchema.index({ paidYmd: 1 });

const saleLineSchema = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    saleCode: { type: String, trim: true, default: "" },
    bookingCode: { type: String, required: true, trim: true },
    paidAt: { type: Date, required: true },
    paidYmd: { type: String, required: true, trim: true },
    method: { type: String, trim: true, default: "" },
    employeeName: { type: String, trim: true, default: "" },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["Paid", "Void"], default: "Paid" },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true, default: "" },
    voidedBy: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["service", "product"], required: true },
    kode: { type: String, required: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    isCompliment: { type: Boolean, default: false },
  },
  { timestamps: true },
);
saleLineSchema.index({ saleId: 1 });

const Sale = mongoose.model("Sale", saleSchema);
const SaleLine = mongoose.model("SaleLine", saleLineSchema);
const SaleCounter = mongoose.model("SaleCounter", saleCounterSchema);

function parseSeqFromSaleCode(saleCode) {
  const raw = String(saleCode || "").trim();
  const m = raw.match(/^SL-(\d{6})-(\d+)$/);
  if (!m) return null;
  const seq = Number(m[2]);
  return Number.isFinite(seq) ? seq : null;
}

async function backfillSaleCodesForDay(ymd) {
  const sales = await Sale.find({ paidYmd: ymd }).sort({ paidAt: 1, _id: 1 }).lean();
  let maxSeq = 0;
  for (const s of sales) {
    const seq = parseSeqFromSaleCode(s.saleCode);
    if (seq && seq > maxSeq) maxSeq = seq;
  }

  let nextSeq = maxSeq + 1;
  const updates = [];
  for (const s of sales) {
    if (s.saleCode) continue;
    const saleCode = formatSaleCode({ saleDate: ymd, seq: nextSeq++ });
    updates.push({ id: s._id, saleCode });
  }

  for (const u of updates) {
    await Sale.updateOne({ _id: u.id, saleCode: "" }, { $set: { saleCode: u.saleCode } });
  }

  const finalSeq = Math.max(maxSeq, nextSeq - 1);
  await SaleCounter.findOneAndUpdate(
    { date: ymd },
    { $set: { date: ymd, seq: finalSeq } },
    { upsert: true, new: true },
  );

  return { ymd, updated: updates.length, maxSeq: finalSeq };
}

async function backfillSaleLines() {
  const cursor = Sale.find({}).select("_id saleCode bookingCode paidAt paidYmd method employeeName customerName customerPhone status voidedAt voidReason voidedBy items").lean().cursor();
  let created = 0;
  let skipped = 0;
  let processed = 0;
  for await (const sale of cursor) {
    processed++;
    const exists = await SaleLine.findOne({ saleId: sale._id }).select("_id").lean();
    if (exists) {
      skipped++;
      continue;
    }
    const lines = (sale.items || []).map((it) => ({
      saleId: sale._id,
      saleCode: sale.saleCode || "",
      bookingCode: sale.bookingCode,
      paidAt: sale.paidAt,
      paidYmd: sale.paidYmd,
      method: sale.method || "Cash",
      employeeName: sale.employeeName || "",
      customerName: sale.customerName || "",
      customerPhone: sale.customerPhone || "",
      status: sale.status || "Paid",
      voidedAt: sale.voidedAt,
      voidReason: sale.voidReason || "",
      voidedBy: sale.voidedBy || "",
      type: it.type,
      kode: it.kode,
      nama: it.nama,
      harga: Number(it.harga) || 0,
      qty: Number(it.qty) || 1,
      subtotal: (Number(it.harga) || 0) * (Number(it.qty) || 1),
      isCompliment: Boolean(it.isCompliment),
    }));
    if (lines.length > 0) {
      await SaleLine.insertMany(lines, { ordered: true });
      created += lines.length;
    }
    if (processed % 200 === 0) {
      console.log("Processed", processed, "sales. Created lines", created, "Skipped", skipped);
    }
  }
  return { processed, created, skipped };
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected.");

  console.log("Ensuring indexes...");
  await SaleCounter.syncIndexes();
  await SaleLine.syncIndexes();

  const days = await Sale.distinct("paidYmd", {}).then((arr) => arr.filter(Boolean).sort());
  console.log("Days:", days.length);

  let updatedTotal = 0;
  for (const ymd of days) {
    const r = await backfillSaleCodesForDay(ymd);
    updatedTotal += r.updated;
    if (r.updated) console.log("Backfilled saleCode:", r);
  }
  console.log("saleCode backfill done. updated:", updatedTotal);

  const lines = await backfillSaleLines();
  console.log("saleLines backfill done:", lines);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

