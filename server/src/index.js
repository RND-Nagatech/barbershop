// Middleware autentikasi JWT
const authRequired = (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: "Unauthorized" });
  const payload = verifyJwtHs256(match[1]);
  if (!payload) return res.status(401).json({ message: "Unauthorized" });
  req.user = payload;
  next();
};
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import crypto from "crypto";
import { waGateway } from "./waGateway.js";
import { buildReceiptPdf, buildTicketPdf } from "./pdfUtils.js";

process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

const app = express();
const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
const webPublicBaseUrl = process.env.WEB_PUBLIC_BASE_URL || "http://localhost:8080";

if (!mongoUri) {
  throw new Error("MONGODB_URI is required in environment variables");
}

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Using an insecure default; set JWT_SECRET in server/.env for real usage.");
}
if (!process.env.WEB_PUBLIC_BASE_URL) {
  console.warn("WEB_PUBLIC_BASE_URL is not set. WhatsApp links may not work on customer phones. Set it in server/.env.");
}

app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json());
app.use(morgan("dev"));

const base64UrlEncode = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (input) => {
  const normalized = String(input).replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
};

const signJwtHs256 = (payload, { expiresInSeconds = 7 * 24 * 60 * 60 } = {}) => {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${signature}`;
};

const verifyJwtHs256 = (token) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto
    .createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const sigOk =
    Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!sigOk) return null;
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && typeof payload.exp === "number" && now >= payload.exp) return null;
  return payload;
};
const apiGuard = (req, res, next) => {
  const path = req.path;
  const method = req.method.toUpperCase();
  const isPublic =
    (method === "GET" && path === "/health") ||
    (method === "POST" && path === "/auth/login") ||
    (method === "GET" && path === "/queue/today") ||
    (method === "GET" && path === "/public/branch") ||
    (method === "GET" && path.startsWith("/public/ticket/")) ||
    (method === "GET" && path.startsWith("/public/receipt/")) ||
    (method === "GET" && path === "/branches/by-domain") ||
    (method === "GET" && path === "/services") ||
    (method === "GET" && path === "/bookings/public") ||
    (method === "POST" && path === "/bookings");

  if (isPublic) return next();
  return authRequired(req, res, next);
};
// Middleware to restrict access by user level
const requireLevels = (...allowed) => (req, res, next) => {
  const level = req.user?.level;
  if (!level || !allowed.includes(level)) return res.status(403).json({ message: "Forbidden" });
  next();
};

app.use("/api", apiGuard);

const employeeSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const serviceComplimentSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
    compliments: { type: [serviceComplimentSchema], default: [] },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
    stok: { type: Number, default: 0, min: 0 },
    minStok: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

const stockMovementSchema = new mongoose.Schema(
  {
    // Canonical fields (used by web/API)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    kode: { type: String, required: true, trim: true },
    nama: { type: String, required: true, trim: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: ["sale", "void", "adjust"], required: true },
    refSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    refBookingCode: { type: String, trim: true, default: "" },
    ymd: { type: String, required: true, trim: true },

    // Backward-compatible fields (if you ever renamed properties/collections)
    id_produk: { type: mongoose.Schema.Types.ObjectId },
    perubahan: { type: Number },
    alasan: { type: String, enum: ["sale", "void", "adjust"] },
    id_transaksi: { type: mongoose.Schema.Types.ObjectId },
    kode_booking: { type: String, trim: true, default: "" },
    tgl_sistem: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
stockMovementSchema.index({ ymd: 1 });
stockMovementSchema.index({ tgl_sistem: 1 });

const branchSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    alamat: { type: String, required: true, trim: true },
    noHp: { type: String, required: true, trim: true },
    domain: { type: String, required: true, unique: true, trim: true, lowercase: true },
  },
  { timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    level: { type: String, required: true, trim: true },
    menuAccess: { type: [String], default: [] },
  },
  { timestamps: true },
);

const customerSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: null },
    name: { type: String, trim: true, default: "" },
    isMember: { type: Boolean, default: false },
    // Legacy: previously stored as rupiah, now replaced by points.
    loyaltyBalanceRp: { type: Number, default: 0, min: 0 },
    pointsBalance: { type: Number, default: 0, min: 0 },
    visitCount: { type: Number, default: 0, min: 0 },
    lastVisitAt: { type: Date },
  },
  { timestamps: true },
);
customerSchema.path("phone").validate(function validateMemberPhone(v) {
  if (!this.isMember) return true;
  return typeof v === "string" && v.trim().length > 0;
}, "Phone is required for member");
customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
  },
);

const commissionSchema = new mongoose.Schema(
  {
    tipe: { type: String, enum: ["persentase", "rupiah"], required: true },
    nilai: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

const loyaltySettingSchema = new mongoose.Schema(
  {
    tipe: { type: String, enum: ["persentase", "rupiah"], required: true },
    nilai: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

const pointSettingSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["per_transaction", "per_rupiah"], required: true },
    pointsPerTransaction: { type: Number, default: 0, min: 0 },
    rupiahStep: { type: Number, default: 10000, min: 1 },
    pointsPerStep: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true },
);

const queueCounterSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);
queueCounterSchema.index({ date: 1 }, { unique: true });

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
    id_booking: { type: mongoose.Schema.Types.ObjectId, ref: "tt_booking" },
    kode_booking: { type: String, trim: true, default: "" },
    sumber: { type: String, enum: ["tt_booking", "Direct"], default: "tt_booking" },
    kode_transaksi: { type: String, trim: true, default: "" },
    nama_pegawai: { type: String, trim: true, default: "" },
    id_pelanggan: { type: mongoose.Schema.Types.ObjectId, ref: "tm_customer" },
    nama_pelanggan: { type: String, trim: true, default: "" },
    no_hp_pelanggan: { type: String, trim: true, default: "" },
    item: { type: [saleItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    total_diskon: { type: Number, default: 0, min: 0 },
    metode: { type: String, enum: ["Cash", "QRIS", "Transfer", "Legacy"], required: true },
    diterima: { type: Number, required: true, min: 0 },
    kembalian: { type: Number, required: true, min: 0 },
    tgl_bayar: { type: Date, required: true },
    tgl_byr: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Paid", "Void"], default: "Paid" },
    tgl_void: { type: Date },
    alasan_void: { type: String, trim: true, default: "" },
    dibatalkan_oleh: { type: String, trim: true, default: "" },
    poin_didapat: { type: Number, default: 0, min: 0 },
    tipe_komisi: { type: String, enum: ["persentase", "rupiah"], default: "persentase" },
    nilai_komisi: { type: Number, default: 0, min: 0 },
    komisi_didapat: { type: Number, default: 0, min: 0 },
    token_bagi: { type: String, trim: true },
  },
  { timestamps: true },
);
saleSchema.index(
  { id_booking: 1 },
  { unique: true, partialFilterExpression: { status: "Paid", id_booking: { $exists: true } } },
);
saleSchema.index({ tgl_byr: 1 });
saleSchema.index({ tgl_byr: 1, kode_transaksi: 1 });
saleSchema.index({ token_bagi: 1 }, { unique: true, sparse: true });

const saleLineSchema = new mongoose.Schema(
  {
    id_transaksi: { type: mongoose.Schema.Types.ObjectId, ref: "tt_transaksi", required: true },
    kode_transaksi: { type: String, trim: true, default: "" },
    kode_booking: { type: String, trim: true, default: "" },
    tgl_bayar: { type: Date, required: true },
    tgl_byr: { type: String, required: true, trim: true },
    metode: { type: String, trim: true, default: "" },
    nama_pegawai: { type: String, trim: true, default: "" },
    nama_pelanggan: { type: String, trim: true, default: "" },
    no_hp_pelanggan: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["Paid", "Void"], default: "Paid" },
    tgl_void: { type: Date },
    alasan_void: { type: String, trim: true, default: "" },
    dibatalkan_oleh: { type: String, trim: true, default: "" },

    tipe: { type: String, enum: ["service", "product"], required: true },
    kode: { type: String, required: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    isCompliment: { type: Boolean, default: false },
  },
  { timestamps: true },
);
saleLineSchema.index({ tgl_byr: 1, tipe: 1, kode: 1 });
saleLineSchema.index({ tgl_byr: 1, nama_pegawai: 1 });
saleLineSchema.index({ id_transaksi: 1 });

const expenseSchema = new mongoose.Schema(
  {
    ymd: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, default: "" },
    createdBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
expenseSchema.index({ ymd: 1 });

const cashMovementSchema = new mongoose.Schema(
  {
    tgl_sistem: { type: String, required: true, trim: true },
    arah: { type: String, enum: ["in", "out"], required: true },
    jumlah: { type: Number, required: true, min: 1 },
    deskripsi: { type: String, required: true, trim: true },
    dibuat_oleh: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
cashMovementSchema.index({ tgl_sistem: 1, arah: 1 });

const bookingServiceSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    harga: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingProductSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    harga: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    isCompliment: { type: Boolean, default: false },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    kode_booking: { type: String, required: true, trim: true },
    antrian: { type: Number, required: true },
    nama_pelanggan: { type: String, required: true, trim: true },
    no_hp: { type: String, default: "" },
    id_pelanggan: { type: mongoose.Schema.Types.ObjectId, ref: "tm_customer" },
    token_bagi: { type: String, trim: true },
    nama_pegawai: { type: String, default: "" },
    id_cabang: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    domain_cabang: { type: String, trim: true },
    layanan: { type: [bookingServiceSchema], default: [] },
    produk: { type: [bookingProductSchema], default: [] },
    status: {
      type: String,
      enum: ["Menunggu", "Proses", "Selesai"],
      default: "Menunggu",
    },
    tgl_sistem: { type: String, required: true },
    status_bayar: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    tgl_bayar: { type: Date },
    tgl_byr: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
bookingSchema.index({ tgl_sistem: 1, kode_booking: 1 }, { unique: true });
bookingSchema.index({ token_bagi: 1 }, { unique: true, sparse: true });

const Employee = mongoose.model("tm_pegawai", employeeSchema, "tm_pegawai");
const Service = mongoose.model("tm_layanan", serviceSchema, "tm_layanan");
const Product = mongoose.model("tm_produk", productSchema, "tm_produk");
const StockMovement = mongoose.model("tt_stock", stockMovementSchema, "tt_stock");
const Branch = mongoose.model("tm_toko", branchSchema, "tm_toko");
const User = mongoose.model("tm_user", userSchema, "tm_user");
const Customer = mongoose.model("tm_customer", customerSchema, "tm_customer");
const CommissionSetting = mongoose.model("tp_komisi", commissionSchema, "tp_komisi");
const LoyaltySetting = mongoose.model("LoyaltySetting", loyaltySettingSchema);
const PointSetting = mongoose.model("tp_poin_member", pointSettingSchema, "tp_poin_member");
const QueueCounter = mongoose.model("tp_counter_booking", queueCounterSchema, "tp_counter_booking");
const SaleCounter = mongoose.model("tp_counter_jual", saleCounterSchema, "tp_counter_jual");
const Sale = mongoose.model("tt_transaksi", saleSchema, "tt_transaksi");
const SaleLine = mongoose.model("tt_item_transaksi", saleLineSchema, "tt_item_transaksi");
const Expense = mongoose.model("Expense", expenseSchema);
const CashMovement = mongoose.model("tt_keuangan", cashMovementSchema, "tt_keuangan");
const Booking = mongoose.model("tt_booking", bookingSchema, "tt_booking");

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const normalizeDomain = (value) => {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
};

const normalizePhone = (value) => {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits.startsWith("62") ? digits : null;
};

const upsertCustomerByPhone = async ({ phone, name, forceMember, session } = {}) => {
  const normalizedPhone = normalizePhone(phone || "");
  if (!normalizedPhone) return null;
  const safeName = String(name || "").trim();

  const update = {
    $setOnInsert: { phone: normalizedPhone, isMember: false },
    $set: {},
  };
  if (safeName) update.$set.name = safeName;
  if (forceMember === true) update.$set.isMember = true;
  if (!safeName) update.$setOnInsert.name = "";

  return Customer.findOneAndUpdate({ phone: normalizedPhone }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  });
};

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const parseDateRange = (from, to) => {
  const query = {};
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  return query;
};

const formatJakartaYmd = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const formatBookingCode = ({ queueDate, antrian }) => {
  const yymmdd = String(queueDate || "").replace(/-/g, "").slice(2);
  const seq = String(antrian).padStart(3, "0");
  return `BK-${yymmdd}-${seq}`;
};

const formatSaleCode = ({ saleDate, seq }) => {
  const yymmdd = String(saleDate || "").replace(/-/g, "").slice(2);
  const num = String(seq).padStart(3, "0");
  return `SL-${yymmdd}-${num}`;
};

const generateShareToken = () => crypto.randomBytes(18).toString("hex");

const sumBookingTotal = (booking) => {
  const services = booking?.services || booking?.layanan || [];
  return services.reduce((sum, s) => sum + (Number(s?.harga) || 0), 0);
};
const sumBookingProductTotal = (booking) => {
  const products = booking?.products || booking?.produk || [];
  return products.reduce((sum, p) => {
    if (p?.isCompliment) return sum;
    return sum + (Number(p?.harga) || 0) * (Number(p?.qty) || 0);
  }, 0);
};

const buildStockMovementDoc = ({ product, delta, reason, refSaleId, refBookingCode, ymd }) => ({
  productId: product?._id,
  kode: product?.kode || "",
  nama: product?.nama || "",
  delta,
  reason,
  refSaleId: refSaleId || undefined,
  refBookingCode: refBookingCode || "",
  ymd,
  // backward-compatible keys
  id_produk: product?._id,
  perubahan: delta,
  alasan: reason,
  id_transaksi: refSaleId || undefined,
  kode_booking: refBookingCode || "",
  tgl_sistem: ymd,
});

const computePointsEarned = ({ total, setting }) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const mode = setting?.mode;
  if (mode === "per_transaction") {
    return Math.max(0, Math.floor(Number(setting?.pointsPerTransaction) || 0));
  }
  // Default per_rupiah
  const rupiahStep = Math.max(1, Math.floor(Number(setting?.rupiahStep) || 10000));
  const pointsPerStep = Math.max(0, Math.floor(Number(setting?.pointsPerStep) || 0));
  return Math.floor(safeTotal / rupiahStep) * pointsPerStep;
};

const computeCommissionEarned = ({ total, setting }) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const tipe = setting?.tipe;
  const nilai = Number(setting?.nilai || 0);
  if (tipe === "rupiah") return Math.max(0, Math.round(nilai));
  // Default persentase
  return Math.max(0, Math.round((safeTotal * Math.max(0, nilai)) / 100));
};

const isTransactionNotSupported = (err) => {
  const message = String(err?.message || "");
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("Transactions are not supported") ||
    message.includes("requires a replica set") ||
    message.includes("replica set") ||
    message.includes("mongos") ||
    message.includes("Read preference in a transaction must be primary")
  );
};

app.get("/api/health", (_, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});


app.post(
  "/api/wa/connect",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    const status = await waGateway.connect({ wait: true });
    res.json({ status: status.status, me: status.me || "", lastError: status.lastError || "" });
  }),
);

app.get(
  "/api/wa/status",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    const s = waGateway.getStatus();
    res.json({ status: s.status, me: s.me || "", lastError: s.lastError || "" });
  }),
);

app.get(
  "/api/wa/qr",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    const st = await waGateway.ensureQr({ timeoutMs: 20000 });
    res.json({
      qrDataUrl: st.qrDataUrl || "",
      status: st.status,
      me: st.me || "",
      lastError: st.lastError || "",
      lastErrorDetail: st.lastErrorDetail || null,
    });
  }),
);

app.post(
  "/api/wa/refresh-qr",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    await waGateway.logout();
    await waGateway.connect({ wait: true });
    const st = waGateway.getState();
    res.json({
      qrDataUrl: st.qrDataUrl || "",
      status: st.status,
      me: st.me || "",
      lastError: st.lastError || "",
      lastErrorDetail: st.lastErrorDetail || null,
    });
  }),
);

app.post(
  "/api/wa/logout",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    const status = await waGateway.logout();
    res.json(status);
  }),
);

app.get(
  "/api/pegawai",
  asyncHandler(async (_, res) => {
    const rows = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama })));
  }),
);

app.post(
  "/api/pegawai",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Employee.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama });
  }),
);

app.put(
  "/api/pegawai/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Employee.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama });
  }),
);

app.delete(
  "/api/pegawai/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Employee.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

// Aliases (English routes) for web client compatibility
app.get(
  "/api/employees",
  asyncHandler(async (req, res) => {
    // same as /api/pegawai
    const rows = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama })));
  }),
);
app.post(
  "/api/employees",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Employee.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama });
  }),
);
app.put(
  "/api/employees/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Employee.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama });
  }),
);
app.delete(
  "/api/employees/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Employee.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);


app.get(
  "/api/layanan",
  asyncHandler(async (_, res) => {
    const rows = await Service.find().sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        kode: r.kode,
        nama: r.nama,
        harga: r.harga,
        compliments: Array.isArray(r.compliments) ? r.compliments : [],
      })),
    );
  }),
);

app.get(
  "/api/services",
  asyncHandler(async (_req, res) => {
    const rows = await Service.find().sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        kode: r.kode,
        nama: r.nama,
        harga: r.harga,
        compliments: Array.isArray(r.compliments) ? r.compliments : [],
      })),
    );
  }),
);
app.post(
  "/api/services",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Service.create(req.body);
    res.status(201).json({
      id: String(created._id),
      kode: created.kode,
      nama: created.nama,
      harga: created.harga,
      compliments: Array.isArray(created.compliments) ? created.compliments : [],
    });
  }),
);
app.put(
  "/api/services/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Service.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      kode: updated.kode,
      nama: updated.nama,
      harga: updated.harga,
      compliments: Array.isArray(updated.compliments) ? updated.compliments : [],
    });
  }),
);
app.delete(
  "/api/services/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Service.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);


app.post(
  "/api/layanan",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Service.create(req.body);
    res.status(201).json({
      id: String(created._id),
      kode: created.kode,
      nama: created.nama,
      harga: created.harga,
      compliments: Array.isArray(created.compliments) ? created.compliments : [],
    });
  }),
);

app.put(
  "/api/layanan/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Service.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      kode: updated.kode,
      nama: updated.nama,
      harga: updated.harga,
      compliments: Array.isArray(updated.compliments) ? updated.compliments : [],
    });
  }),
);

app.delete(
  "/api/layanan/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Service.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

app.get(
  "/api/produk",
  requireLevels("Owner", "Admin", "Kasir", "Pegawai"),
  asyncHandler(async (_, res) => {
    const rows = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
  }),
);

app.get(
  "/api/products",
  requireLevels("Owner", "Admin", "Kasir", "Pegawai"),
  asyncHandler(async (_req, res) => {
    const rows = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
  }),
);

app.get(
  "/api/produk/low-stock",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (_, res) => {
    const rows = await Product.find({ minStok: { $gt: 0 }, $expr: { $lte: ["$stok", "$minStok"] } })
      .sort({ stok: 1 })
      .lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
  }),
);

app.get(
  "/api/products/low-stock",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (_req, res) => {
    const rows = await Product.find({ minStok: { $gt: 0 }, $expr: { $lte: ["$stok", "$minStok"] } })
      .sort({ stok: 1 })
      .lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
  }),
);

app.post(
  "/api/produk",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Product.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama, harga: created.harga, stok: created.stok, minStok: created.minStok ?? 0 });
  }),
);

app.post(
  "/api/products",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await Product.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama, harga: created.harga, stok: created.stok, minStok: created.minStok ?? 0 });
  }),
);

app.put(
  "/api/produk/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Product.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga, stok: updated.stok, minStok: updated.minStok ?? 0 });
  }),
);

app.put(
  "/api/products/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Product.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga, stok: updated.stok, minStok: updated.minStok ?? 0 });
  }),
);

app.patch(
  "/api/produk/:id/adjust-stock",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ message: "Delta stok tidak valid" });

    const ymd = formatJakartaYmd();
    const updated = await Product.findOneAndUpdate(
      { _id, ...(delta < 0 ? { stok: { $gte: Math.abs(delta) } } : {}) },
      { $inc: { stok: delta } },
      { new: true },
    ).lean();
    if (!updated) return res.status(400).json({ message: "Stok tidak cukup" });

    await StockMovement.create(buildStockMovementDoc({ product: updated, delta, reason: "adjust", ymd }));

    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga, stok: updated.stok, minStok: updated.minStok ?? 0 });
  }),
);

app.patch(
  "/api/products/:id/adjust-stock",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ message: "Delta stok tidak valid" });

    const ymd = formatJakartaYmd();
    const updated = await Product.findOneAndUpdate(
      { _id, ...(delta < 0 ? { stok: { $gte: Math.abs(delta) } } : {}) },
      { $inc: { stok: delta } },
      { new: true },
    ).lean();
    if (!updated) return res.status(400).json({ message: "Stok tidak cukup" });

    await StockMovement.create(buildStockMovementDoc({ product: updated, delta, reason: "adjust", ymd }));
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga, stok: updated.stok, minStok: updated.minStok ?? 0 });
  }),
);

app.delete(
  "/api/produk/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Product.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

app.delete(
  "/api/products/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Product.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

app.get(
  "/api/stock/movements",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const and = [];
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (from || to) {
      const range = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      and.push({ $or: [{ ymd: range }, { tgl_sistem: range }] });
    }
    if (req.query.kode) and.push({ kode: String(req.query.kode) });
    if (req.query.reason) {
      const reason = String(req.query.reason);
      and.push({ $or: [{ reason }, { alasan: reason }] });
    }
    const query = and.length ? { $and: and } : {};

    const rows = await StockMovement.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        ymd: r.ymd || r.tgl_sistem,
        kode: r.kode,
        nama: r.nama,
        delta: r.delta ?? r.perubahan,
        reason: r.reason || r.alasan,
        refBookingCode: r.refBookingCode || r.kode_booking || "",
        createdAt: r.createdAt,
      })),
    );
  }),
);

app.post(
  "/api/cash/in",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const amount = Math.floor(Number(req.body?.amount) || 0);
    const description = String(req.body?.description || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Nominal tidak valid" });
    if (!description) return res.status(400).json({ message: "Deskripsi wajib diisi" });

    const ymd = formatJakartaYmd();
    const createdBy = req.user?.username ? String(req.user.username) : "";
    const created = await CashMovement.create({ tgl_sistem: ymd, arah: "in", jumlah: amount, deskripsi: description, dibuat_oleh: createdBy });
    res.status(201).json({
      id: String(created._id),
      ymd: created.tgl_sistem,
      direction: created.arah,
      amount: created.jumlah,
      description: created.deskripsi,
      createdBy: created.dibuat_oleh || "",
      createdAt: created.createdAt,
    });
  }),
);

app.post(
  "/api/cash/out",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const amount = Math.floor(Number(req.body?.amount) || 0);
    const description = String(req.body?.description || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Nominal tidak valid" });
    if (!description) return res.status(400).json({ message: "Deskripsi wajib diisi" });

    const ymd = formatJakartaYmd();
    const createdBy = req.user?.username ? String(req.user.username) : "";
    const created = await CashMovement.create({ tgl_sistem: ymd, arah: "out", jumlah: amount, deskripsi: description, dibuat_oleh: createdBy });
    res.status(201).json({
      id: String(created._id),
      ymd: created.tgl_sistem,
      direction: created.arah,
      amount: created.jumlah,
      description: created.deskripsi,
      createdBy: created.dibuat_oleh || "",
      createdAt: created.createdAt,
    });
  }),
);

app.get(
  "/api/cash/movements",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.tgl_sistem = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.tgl_sistem = { $gte: req.query.from };
    } else if (req.query.to) {
      query.tgl_sistem = { $lte: req.query.to };
    }
    const direction = String(req.query.direction || "").trim();
    if (direction === "in" || direction === "out") query.arah = direction;

    const rows = await CashMovement.find(query).sort({ createdAt: -1 }).limit(200).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        ymd: r.tgl_sistem,
        direction: r.arah,
        amount: r.jumlah,
        description: r.deskripsi,
        createdBy: r.dibuat_oleh || "",
        createdAt: r.createdAt,
      })),
    );
  }),
);

app.post(
  "/api/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const customerType = String(req.body?.customerType || "regular").toLowerCase();
    const rawPhone = normalizePhone(req.body?.customerPhone || "");
    let customerName = String(req.body?.customerName || "").trim();

    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = itemsRaw
      .map((it) => ({
        kode: String(it?.kode || "").trim(),
        qty: Math.max(1, Math.floor(Number(it?.qty) || 0)),
        isCompliment: Boolean(it?.isCompliment),
      }))
      .filter((it) => it.kode);
    if (items.length === 0) return res.status(400).json({ message: "Item transaksi wajib diisi" });

    const received = Number(req.body?.received);
    if (!Number.isFinite(received) || received < 0) return res.status(400).json({ message: "Nominal uang diterima tidak valid" });

    let customer = null;
    if (rawPhone) {
      const upserted = await upsertCustomerByPhone({
        phone: rawPhone,
        name: customerName,
        forceMember: customerType === "member",
      });
      customer = upserted ? upserted.toObject() : null;
    } else if (customerType === "member") {
      return res.status(400).json({ message: "No HP member wajib diisi" });
    } else if (customerName) {
      const created = await Customer.create({ phone: null, name: customerName, isMember: false });
      customer = created.toObject();
    }

    const customerId = customer?._id;
    const isMember = Boolean(customer?.isMember);
    if (!customerName) customerName = customer?.name || "";

    const codes = Array.from(new Set(items.map((it) => it.kode)));
    const products = await Product.find({ kode: { $in: codes } }).lean();
    const map = new Map(products.map((p) => [p.kode, p]));
    const missing = codes.filter((c) => !map.has(c));
    if (missing.length) return res.status(400).json({ message: `Produk tidak ditemukan: ${missing.join(", ")}` });

    const requiredMap = new Map();
    for (const it of items) requiredMap.set(it.kode, (requiredMap.get(it.kode) || 0) + it.qty);
    for (const [kode, needQty] of requiredMap.entries()) {
      const p = map.get(kode);
      if (!p) continue;
      if ((p.stok || 0) < needQty) return res.status(400).json({ message: `Stok produk ${p.nama} tidak cukup` });
    }

    const saleItems = items.map((it) => {
      const p = map.get(it.kode);
      const harga = it.isCompliment ? 0 : Number(p.harga || 0);
      return { type: "product", kode: p.kode, nama: p.nama, harga, qty: it.qty, isCompliment: it.isCompliment };
    });
    const total = saleItems.reduce((sum, it) => sum + (Number(it.harga) || 0) * (Number(it.qty) || 0), 0);
    if (received < total) return res.status(400).json({ message: "Uang diterima kurang dari total" });

    const paidAt = new Date();
    const paidYmd = formatJakartaYmd(paidAt);
    const change = received - total;

    const saleCounter = await SaleCounter.findOneAndUpdate(
      { date: paidYmd },
      { $inc: { seq: 1 }, $setOnInsert: { date: paidYmd } },
      { new: true, upsert: true },
    ).lean();
    let saleSeq = saleCounter.seq;
    if (saleCounter.date !== paidYmd) {
      saleSeq = 1;
      await SaleCounter.updateOne({ _id: saleCounter._id }, { seq: 1, date: paidYmd });
    }
    const saleCode = formatSaleCode({ saleDate: paidYmd, seq: saleSeq });

    let pointsEarned = 0;
    if (customerId && isMember) {
      const setting = (await PointSetting.findOne().lean()) || { mode: "per_rupiah", rupiahStep: 10000, pointsPerStep: 1, pointsPerTransaction: 0 };
      pointsEarned = computePointsEarned({ total, setting });
    }

    const salePayload = {
      id_booking: undefined,
      kode_booking: "",
      sumber: "Direct",
      kode_transaksi: saleCode,
      nama_pegawai: "",
      id_pelanggan: customerId,
      nama_pelanggan: customerName || "",
      no_hp_pelanggan: rawPhone || "",
      token_bagi: generateShareToken(),
      item: saleItems,
      total,
      total_diskon: 0,
      metode: "Cash",
      diterima: received,
      kembalian: change,
      tgl_bayar: paidAt,
      tgl_byr: paidYmd,
      status: "Paid",
      poin_didapat: pointsEarned,
      tipe_komisi: "persentase",
      nilai_komisi: 0,
      komisi_didapat: 0,
    };

    const saleLines = saleItems.map((it) => ({
      id_transaksi: null, // filled after create
      kode_transaksi: saleCode,
      kode_booking: "",
      tgl_bayar: paidAt,
      tgl_byr: paidYmd,
      metode: "Cash",
      nama_pegawai: "",
      nama_pelanggan: customerName || "",
      no_hp_pelanggan: rawPhone || "",
      status: "Paid",
      tipe: it.type,
      kode: it.kode,
      nama: it.nama,
      harga: Number(it.harga) || 0,
      qty: Number(it.qty) || 1,
      subtotal: (Number(it.harga) || 0) * (Number(it.qty) || 1),
      isCompliment: Boolean(it.isCompliment),
    }));

    const session = await mongoose.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
    let createdSale = null;
    try {
      await session.withTransaction(async () => {
        createdSale = await Sale.create([salePayload], { session, ordered: true }).then((rows) => rows[0]);
        for (const line of saleLines) line.id_transaksi = createdSale._id;
        if (saleLines.length) await SaleLine.insertMany(saleLines, { session, ordered: true });

        for (const [kode, qty] of requiredMap.entries()) {
          const updatedProduct = await Product.findOneAndUpdate(
            { kode, stok: { $gte: qty } },
            { $inc: { stok: -qty } },
            { new: true, session },
          ).lean();
          if (!updatedProduct) throw new Error(`Stok produk ${kode} tidak cukup`);

          await StockMovement.create(
            [buildStockMovementDoc({ product: updatedProduct, delta: -qty, reason: "sale", refSaleId: createdSale._id, refBookingCode: "", ymd: paidYmd })],
            { session, ordered: true },
          );
        }

        if (customerId && isMember) {
          await Customer.updateOne(
            { _id: customerId },
            {
              $inc: { pointsBalance: pointsEarned, visitCount: 1 },
              $set: { lastVisitAt: paidAt },
            },
            { session },
          );
        } else if (customerId) {
          await Customer.updateOne({ _id: customerId }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: paidAt } }, { session });
        }
      }, { readPreference: "primary" });
    } catch (err) {
      if (!isTransactionNotSupported(err)) {
        const message = err instanceof Error ? err.message : "Gagal membuat transaksi";
        return res.status(400).json({ message });
      }

      createdSale = await Sale.create(salePayload);
      for (const line of saleLines) line.id_transaksi = createdSale._id;
      if (saleLines.length) await SaleLine.insertMany(saleLines, { ordered: true });

      for (const [kode, qty] of requiredMap.entries()) {
        const updatedProduct = await Product.findOneAndUpdate({ kode, stok: { $gte: qty } }, { $inc: { stok: -qty } }, { new: true }).lean();
        if (!updatedProduct) return res.status(400).json({ message: `Stok produk ${kode} tidak cukup` });
        await StockMovement.create(buildStockMovementDoc({ product: updatedProduct, delta: -qty, reason: "sale", refSaleId: createdSale._id, refBookingCode: "", ymd: paidYmd }));
      }

      if (customerId && isMember) {
        await Customer.updateOne({ _id: customerId }, { $inc: { pointsBalance: pointsEarned, visitCount: 1 }, $set: { lastVisitAt: paidAt } });
      } else if (customerId) {
        await Customer.updateOne({ _id: customerId }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: paidAt } });
      }
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      id: String(createdSale._id),
      saleCode: createdSale.kode_transaksi || saleCode,
      bookingCode: "",
      paymentStatus: "Paid",
      paidAt,
      saleId: String(createdSale._id),
      customerName: createdSale.nama_pelanggan || "",
      customerPhone: createdSale.no_hp_pelanggan || "",
      items: createdSale.item || [],
      total: createdSale.total,
      received: createdSale.diterima,
      change: createdSale.kembalian,
      pointsEarned: createdSale.poin_didapat || 0,
    });
  }),
);

app.get(
  "/api/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.tgl_byr = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.tgl_byr = { $gte: req.query.from };
    } else if (req.query.to) {
      query.tgl_byr = { $lte: req.query.to };
    }

    const includeVoid = String(req.query.includeVoid || "") === "1";
    if (!includeVoid) query.status = "Paid";

    const q = String(req.query.q || "").trim();
    if (q) {
      query.$or = [
        { kode_booking: { $regex: q, $options: "i" } },
        { kode_transaksi: { $regex: q, $options: "i" } },
        { nama_pegawai: { $regex: q, $options: "i" } },
        { nama_pelanggan: { $regex: q, $options: "i" } },
        { no_hp_pelanggan: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await Sale.find(query)
      .select("kode_booking kode_transaksi nama_pegawai total total_diskon metode diterima kembalian tgl_bayar tgl_byr status tgl_void alasan_void dibatalkan_oleh createdAt")
      .sort({ tgl_bayar: -1 })
      .limit(300)
      .lean();

    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.kode_booking || "",
        saleCode: r.kode_transaksi || "",
        employeeName: r.nama_pegawai || "",
        total: r.total,
        discountTotal: r.total_diskon || 0,
        method: r.metode,
        received: r.diterima,
        change: r.kembalian,
        paidAt: r.tgl_bayar,
        paidYmd: r.tgl_byr,
        status: r.status || "Paid",
        voidedAt: r.tgl_void,
        voidReason: r.alasan_void || "",
        voidedBy: r.dibatalkan_oleh || "",
        customerName: r.nama_pelanggan || "",
        customerPhone: r.no_hp_pelanggan || "",
        items: r.item || [],
      })),
    );
  }),
);

app.get(
  "/api/sales/:id",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const row = await Sale.findById(_id).lean();
    if (!row) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(row._id),
      bookingCode: row.kode_booking || "",
      saleCode: row.kode_transaksi || "",
      employeeName: row.nama_pegawai || "",
      total: row.total,
      discountTotal: row.total_diskon || 0,
      method: row.metode,
      received: row.diterima,
      change: row.kembalian,
      paidAt: row.tgl_bayar,
      paidYmd: row.tgl_byr,
      status: row.status || "Paid",
      voidedAt: row.tgl_void,
      voidReason: row.alasan_void || "",
      voidedBy: row.dibatalkan_oleh || "",
      customerName: row.nama_pelanggan || "",
      customerPhone: row.no_hp_pelanggan || "",
      items: row.item || [],
    });
  }),
);

app.post(
  "/api/sales/:id/void",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const reason = String(req.body?.reason || "").trim();
    const sale = await Sale.findById(_id).lean();
    if (!sale) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (sale.status === "Void") return res.status(409).json({ message: "Transaksi sudah di-void" });

    const voidedAt = new Date();
    const ymd = formatJakartaYmd(voidedAt);
    const voidedBy = req.user?.username ? String(req.user.username) : "";

    const productItems = (sale.item || []).filter((i) => i.type === "product");
    const shouldRollbackBooking = Boolean(sale.id_booking) && String(sale.sumber || "tt_booking") === "tt_booking";

    const session = await mongoose.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
    try {
      await session.withTransaction(async () => {
        await Sale.updateOne(
          { _id: sale._id, status: "Paid" },
          { $set: { status: "Void", tgl_void: voidedAt, alasan_void: reason, dibatalkan_oleh: voidedBy } },
          { session },
        );

        await SaleLine.updateMany(
          { id_transaksi: sale._id, status: "Paid" },
          { $set: { status: "Void", tgl_void: voidedAt, alasan_void: reason, dibatalkan_oleh: voidedBy } },
          { session },
        );

        for (const item of productItems) {
          const qty = Number(item.qty) || 0;
          if (!qty) continue;
          const updatedProduct = await Product.findOneAndUpdate(
            { kode: item.kode },
            { $inc: { stok: qty } },
            { new: true, session },
          ).lean();
          if (updatedProduct) {
            await StockMovement.create(
              [buildStockMovementDoc({ product: updatedProduct, delta: qty, reason: "void", refSaleId: sale._id, refBookingCode: sale.kode_booking || "", ymd })],
              { session, ordered: true },
            );
          }
        }

        if (shouldRollbackBooking) {
          await Booking.updateOne(
            { _id: sale.id_booking },
            { $set: { status_bayar: "Unpaid", tgl_bayar: null, tgl_byr: "" } },
            { session },
          );
        }
      }, { readPreference: "primary" });
    } catch (err) {
      if (!isTransactionNotSupported(err)) throw err;

      await Sale.updateOne(
        { _id: sale._id, status: "Paid" },
        { $set: { status: "Void", tgl_void: voidedAt, alasan_void: reason, dibatalkan_oleh: voidedBy } },
      );

      await SaleLine.updateMany(
        { id_transaksi: sale._id, status: "Paid" },
        { $set: { status: "Void", tgl_void: voidedAt, alasan_void: reason, dibatalkan_oleh: voidedBy } },
      );

      for (const item of productItems) {
        const qty = Number(item.qty) || 0;
        if (!qty) continue;
        const updatedProduct = await Product.findOneAndUpdate({ kode: item.kode }, { $inc: { stok: qty } }, { new: true }).lean();
        if (updatedProduct) {
          await StockMovement.create(buildStockMovementDoc({ product: updatedProduct, delta: qty, reason: "void", refSaleId: sale._id, refBookingCode: sale.kode_booking || "", ymd }));
        }
      }

      if (shouldRollbackBooking) {
        await Booking.updateOne({ _id: sale.id_booking }, { $set: { status_bayar: "Unpaid", tgl_bayar: null, tgl_byr: "" } });
      }
    } finally {
      await session.endSession();
    }

    res.json({ id: String(sale._id), status: "Void", voidedAt, voidReason: reason, voidedBy });
  }),
);


app.get(
  "/api/branches",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_, res) => {
    const rows = await Branch.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), nama: r.nama, alamat: r.alamat, noHp: r.noHp, domain: r.domain })));
  }),
);

app.post(
  "/api/branches",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const domain = normalizeDomain(req.body?.domain);
    if (!domain) return res.status(400).json({ message: "Domain cabang wajib diisi" });
    const created = await Branch.create({
      nama: req.body?.nama,
      alamat: req.body?.alamat,
      noHp: req.body?.noHp,
      domain,
    });
    res.status(201).json({
      id: String(created._id),
      nama: created.nama,
      alamat: created.alamat,
      noHp: created.noHp,
      domain: created.domain,
    });
  }),
);

app.put(
  "/api/branches/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const domain = normalizeDomain(req.body?.domain);
    if (!domain) return res.status(400).json({ message: "Domain cabang wajib diisi" });
    const updated = await Branch.findByIdAndUpdate(
      _id,
      { ...req.body, domain },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      nama: updated.nama,
      alamat: updated.alamat,
      noHp: updated.noHp,
      domain: updated.domain,
    });
  }),
);

app.get(
  "/api/branches/by-domain",
  asyncHandler(async (req, res) => {
    const domain = normalizeDomain(req.query.domain);
    if (!domain) return res.status(400).json({ message: "Domain cabang tidak valid" });
    const row = await Branch.findOne({ domain }).lean();
    if (!row) return res.status(404).json({ message: "Cabang tidak ditemukan" });
    res.json({ id: String(row._id), nama: row.nama, alamat: row.alamat, noHp: row.noHp, domain: row.domain });
  }),
);

app.get(
  "/api/public/branch",
  asyncHandler(async (_req, res) => {
    const row = await Branch.findOne().sort({ createdAt: -1 }).lean();
    if (!row) return res.status(404).json({ message: "Cabang tidak ditemukan" });
    res.json({ id: String(row._id), nama: row.nama, alamat: row.alamat, noHp: row.noHp, domain: row.domain });
  }),
);

app.get(
  "/api/public/ticket/:token",
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Token tidak valid" });
    const booking = await Booking.findOne({ token_bagi: token }).lean();
    if (!booking) return res.status(404).json({ message: "Tiket tidak ditemukan" });
    const branch = booking.id_cabang ? await Branch.findById(booking.id_cabang).lean() : null;
    res.json({
      bookingCode: booking.kode_booking,
      antrian: booking.antrian,
      status: booking.status,
      createdAt: booking.createdAt,
      customerName: booking.nama_pelanggan || "",
      phone: booking.no_hp || "",
      services: booking.layanan || [],
      products: booking.produk || [],
      branch: branch
        ? { id: String(branch._id), nama: branch.nama, alamat: branch.alamat, noHp: branch.noHp, domain: branch.domain }
        : null,
    });
  }),
);

app.get(
  "/api/public/receipt/:token",
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Token tidak valid" });
    const sale = await Sale.findOne({ token_bagi: token }).lean();
    if (!sale) return res.status(404).json({ message: "Struk tidak ditemukan" });
    const booking = sale.id_booking ? await Booking.findById(sale.id_booking).lean() : null;
    const branch = booking?.id_cabang ? await Branch.findById(booking.id_cabang).lean() : null;
    res.json({
      bookingCode: sale.kode_booking || "",
      paidAt: sale.tgl_bayar,
      paidYmd: sale.tgl_byr,
      items: sale.item || [],
      total: sale.total || 0,
      received: sale.diterima || 0,
      change: sale.kembalian || 0,
      customerName: sale.nama_pelanggan || "",
      customerPhone: sale.no_hp_pelanggan || "",
      branch: branch
        ? { id: String(branch._id), nama: branch.nama, alamat: branch.alamat, noHp: branch.noHp, domain: branch.domain }
        : null,
    });
  }),
);

app.delete(
  "/api/branches/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await Branch.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

app.get(
  "/api/users",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_, res) => {
    const rows = await User.find().sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        username: r.username,
        level: r.level,
        menuAccess: r.menuAccess || [],
      })),
    );
  }),
);

app.get(
  "/api/customer",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const query = {};
    const memberOnly = String(req.query.memberOnly || "") === "1";
    if (memberOnly) query.isMember = true;
    if (q) {
      query.$or = [
        { phone: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await Customer.find(query).sort({ updatedAt: -1 }).limit(300).lean();
    res.json(
      rows.map((c) => ({
        id: String(c._id),
        phone: c.phone || "",
        name: c.name || "",
        isMember: Boolean(c.isMember),
        pointsBalance: c.pointsBalance || 0,
        visitCount: c.visitCount || 0,
        lastVisitAt: c.lastVisitAt,
        createdAt: c.createdAt,
      })),
    );
  }),
);

// Aliases for web client compatibility
app.get(
  "/api/customers",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    req.url = "/api/customer";
    const q = String(req.query.q || "").trim();
    const query = {};
    const memberOnly = String(req.query.memberOnly || "") === "1";
    if (memberOnly) query.isMember = true;
    if (q) {
      query.$or = [
        { phone: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }
    const rows = await Customer.find(query).sort({ updatedAt: -1 }).limit(300).lean();
    res.json(
      rows.map((c) => ({
        id: String(c._id),
        phone: c.phone || "",
        name: c.name || "",
        isMember: Boolean(c.isMember),
        pointsBalance: c.pointsBalance || 0,
        visitCount: c.visitCount || 0,
        lastVisitAt: c.lastVisitAt,
        createdAt: c.createdAt,
      })),
    );
  }),
);

app.post(
  "/api/customer",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const isMember = Boolean(req.body?.isMember);
    const phone = normalizePhone(req.body?.phone);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama wajib diisi" });
    if (isMember && !phone) return res.status(400).json({ message: "No HP tidak valid (wajib untuk member)" });

    try {
      const created = await Customer.create({
        phone: phone || null,
        name,
        isMember,
      });
      res.status(201).json({
        id: String(created._id),
        phone: created.phone || "",
        name: created.name || "",
        isMember: Boolean(created.isMember),
        pointsBalance: created.pointsBalance || 0,
        visitCount: created.visitCount || 0,
        lastVisitAt: created.lastVisitAt,
        createdAt: created.createdAt,
      });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ message: "No HP sudah terdaftar" });
      throw err;
    }
  }),
);

app.post(
  "/api/customers",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    // same as /api/customer
    const isMember = Boolean(req.body?.isMember);
    const phone = normalizePhone(req.body?.phone);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama wajib diisi" });
    if (isMember && !phone) return res.status(400).json({ message: "No HP tidak valid (wajib untuk member)" });

    try {
      const created = await Customer.create({
        phone: phone || null,
        name,
        isMember,
      });
      res.status(201).json({
        id: String(created._id),
        phone: created.phone || "",
        name: created.name || "",
        isMember: Boolean(created.isMember),
        pointsBalance: created.pointsBalance || 0,
        visitCount: created.visitCount || 0,
        lastVisitAt: created.lastVisitAt,
        createdAt: created.createdAt,
      });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ message: "No HP sudah terdaftar" });
      throw err;
    }
  }),
);

app.put(
  "/api/customer/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const isMember = Boolean(req.body?.isMember);
    const phone = normalizePhone(req.body?.phone);
    const payload = {
      phone: phone || null,
      name: String(req.body?.name || "").trim(),
      isMember,
    };
    if (payload.isMember && !payload.phone) return res.status(400).json({ message: "No HP tidak valid (wajib untuk member)" });

    const updated = await Customer.findByIdAndUpdate(_id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      phone: updated.phone || "",
      name: updated.name || "",
      isMember: Boolean(updated.isMember),
      pointsBalance: updated.pointsBalance || 0,
      visitCount: updated.visitCount || 0,
      lastVisitAt: updated.lastVisitAt,
    });
  }),
);

app.put(
  "/api/customers/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const isMember = Boolean(req.body?.isMember);
    const phone = normalizePhone(req.body?.phone);
    const payload = {
      phone: phone || null,
      name: String(req.body?.name || "").trim(),
      isMember,
    };
    if (payload.isMember && !payload.phone) return res.status(400).json({ message: "No HP tidak valid (wajib untuk member)" });

    const updated = await Customer.findByIdAndUpdate(_id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      phone: updated.phone || "",
      name: updated.name || "",
      isMember: Boolean(updated.isMember),
      pointsBalance: updated.pointsBalance || 0,
      visitCount: updated.visitCount || 0,
      lastVisitAt: updated.lastVisitAt,
    });
  }),
);

app.get(
  "/api/customer/:id/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const rows = await Sale.find({ id_pelanggan: _id })
      .select("kode_booking kode_transaksi total status tgl_bayar tgl_byr")
      .sort({ tgl_bayar: -1 })
      .limit(50)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.kode_transaksi || r.kode_booking,
        total: r.total,
        status: r.status || "Paid",
        paidAt: r.tgl_bayar,
        paidYmd: r.tgl_byr,
      })),
    );
  }),
);

app.get(
  "/api/customers/:id/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const rows = await Sale.find({ id_pelanggan: _id })
      .select("kode_booking kode_transaksi total status tgl_bayar tgl_byr")
      .sort({ tgl_bayar: -1 })
      .limit(50)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.kode_transaksi || r.kode_booking,
        total: r.total,
        status: r.status || "Paid",
        paidAt: r.tgl_bayar,
        paidYmd: r.tgl_byr,
      })),
    );
  }),
);

app.post(
  "/api/users",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const created = await User.create({
      username: req.body?.username,
      password: hashPassword(req.body?.password || ""),
      level: req.body?.level,
      menuAccess: req.body?.menuAccess || [],
    });
    res.status(201).json({
      id: String(created._id),
      username: created.username,
      level: created.level,
      menuAccess: created.menuAccess || [],
    });
  }),
);

app.put(
  "/api/users/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const payload = { ...req.body };
    if (payload.password) payload.password = hashPassword(payload.password);
    else delete payload.password;
    const updated = await User.findByIdAndUpdate(_id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      username: updated.username,
      level: updated.level,
      menuAccess: updated.menuAccess || [],
    });
  }),
);

app.delete(
  "/api/users/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const deleted = await User.findByIdAndDelete(_id).lean();
    if (!deleted) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.status(204).send();
  }),
);

app.get(
  "/api/access/:username",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ username: user.username, menuAccess: user.menuAccess || [] });
  }),
);

app.put(
  "/api/access/:username",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const menuAccess = Array.isArray(req.body?.menuAccess) ? req.body.menuAccess : [];
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { menuAccess },
      { new: true, runValidators: true },
    ).lean();
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ username: user.username, menuAccess: user.menuAccess || [] });
  }),
);

app.get(
  "/api/settings/commission",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_, res) => {
    let row = await CommissionSetting.findOne().lean();
    if (!row) {
      row = await CommissionSetting.create({ tipe: "persentase", nilai: 15 });
      row = row.toObject();
    }
    res.json({ id: String(row._id), tipe: row.tipe, nilai: row.nilai });
  }),
);

app.put(
  "/api/settings/commission",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const payload = {
      tipe: req.body?.tipe,
      nilai: Number(req.body?.nilai),
    };
    let row = await CommissionSetting.findOne();
    if (!row) {
      row = await CommissionSetting.create(payload);
    } else {
      row.tipe = payload.tipe;
      row.nilai = payload.nilai;
      await row.save();
    }
    res.json({ id: String(row._id), tipe: row.tipe, nilai: row.nilai });
  }),
);

app.get(
  "/api/settings/loyalty",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    let row = await LoyaltySetting.findOne().lean();
    if (!row) {
      row = await LoyaltySetting.create({ tipe: "persentase", nilai: 1 });
      row = row.toObject();
    }
    res.json({ id: String(row._id), tipe: row.tipe, nilai: row.nilai });
  }),
);

app.put(
  "/api/settings/loyalty",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const payload = {
      tipe: req.body?.tipe,
      nilai: Number(req.body?.nilai),
    };
    let row = await LoyaltySetting.findOne();
    if (!row) {
      row = await LoyaltySetting.create(payload);
    } else {
      row.tipe = payload.tipe;
      row.nilai = payload.nilai;
      await row.save();
    }
    res.json({ id: String(row._id), tipe: row.tipe, nilai: row.nilai });
  }),
);

app.get(
  "/api/settings/points",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (_req, res) => {
    let row = await PointSetting.findOne().lean();
    if (!row) {
      row = await PointSetting.create({ mode: "per_rupiah", pointsPerTransaction: 0, rupiahStep: 10000, pointsPerStep: 1 });
      row = row.toObject();
    }
    res.json({
      id: String(row._id),
      mode: row.mode,
      pointsPerTransaction: Number(row.pointsPerTransaction || 0),
      rupiahStep: Number(row.rupiahStep || 10000),
      pointsPerStep: Number(row.pointsPerStep || 1),
    });
  }),
);

app.put(
  "/api/settings/points",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const payload = {
      mode: req.body?.mode,
      pointsPerTransaction: Math.max(0, Math.floor(Number(req.body?.pointsPerTransaction) || 0)),
      rupiahStep: Math.max(1, Math.floor(Number(req.body?.rupiahStep) || 10000)),
      pointsPerStep: Math.max(0, Math.floor(Number(req.body?.pointsPerStep) || 1)),
    };
    let row = await PointSetting.findOne();
    if (!row) {
      row = await PointSetting.create(payload);
    } else {
      row.mode = payload.mode;
      row.pointsPerTransaction = payload.pointsPerTransaction;
      row.rupiahStep = payload.rupiahStep;
      row.pointsPerStep = payload.pointsPerStep;
      await row.save();
    }
    res.json({
      id: String(row._id),
      mode: row.mode,
      pointsPerTransaction: Number(row.pointsPerTransaction || 0),
      rupiahStep: Number(row.rupiahStep || 10000),
      pointsPerStep: Number(row.pointsPerStep || 1),
    });
  }),
);

app.get(
  "/api/bookings",
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.tgl_sistem = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.tgl_sistem = { $gte: req.query.from };
    } else if (req.query.to) {
      query.tgl_sistem = { $lte: req.query.to };
    }
    if (req.query.status) query.status = req.query.status;
    if (req.query.paymentStatus) query.status_bayar = req.query.paymentStatus;
    if (req.query.branchDomain) {
      const domain = normalizeDomain(req.query.branchDomain);
      if (domain) query.domain_cabang = domain;
    }
    const rows = await Booking.find(query).sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.kode_booking,
        antrian: r.antrian,
        customerName: r.nama_pelanggan,
        phone: r.no_hp,
        customerId: r.id_pelanggan ? String(r.id_pelanggan) : undefined,
        employeeName: r.nama_pegawai,
        branchId: r.id_cabang ? String(r.id_cabang) : undefined,
        branchDomain: r.domain_cabang,
        services: r.layanan || [],
        products: r.produk || [],
        status: r.status,
        createdAt: r.createdAt,
        paymentStatus: r.status_bayar || "Unpaid",
        paidAt: r.tgl_bayar,
      })),
    );
  }),
);

app.get(
  "/api/bookings/queue-preview",
  asyncHandler(async (_req, res) => {
    const queueDate = formatJakartaYmd();
    const row = await QueueCounter.findOne({ date: queueDate }).lean();
    const nextAntrian = (row?.seq || 0) + 1;
    const nextBookingCode = formatBookingCode({ queueDate, antrian: nextAntrian });
    res.json({ queueDate, nextAntrian, nextBookingCode });
  }),
);

app.get(
  "/api/bookings/public",
  asyncHandler(async (req, res) => {
    const codesRaw = String(req.query.codes || "").trim();
    if (!codesRaw) return res.json([]);
    const codes = Array.from(
      new Set(
        codesRaw
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ).slice(0, 20);

    const rows = await Booking.find({ kode_booking: { $in: codes } })
      .select("kode_booking antrian status nama_pegawai tgl_bayar status_bayar tgl_byr")
      .lean();

    res.json(
      rows.map((r) => ({
        bookingCode: r.kode_booking,
        antrian: r.antrian,
        status: r.status,
        employeeName: r.nama_pegawai || "",
        paymentStatus: r.status_bayar || "Unpaid",
        paidAt: r.tgl_bayar,
      })),
    );
  }),
);

const maskCustomerName = (value) => {
  const name = String(value || "").trim();
  if (!name) return "";
  const upper = name.toUpperCase();
  const head = upper.slice(0, Math.min(3, upper.length));
  return `${head}${upper.length > 3 ? "***" : "**"}`;
};

app.get(
  "/api/queue/today",
  asyncHandler(async (_req, res) => {
    const todayYmd = formatJakartaYmd();
    const rows = await Booking.find({ tgl_sistem: todayYmd })
      .select("antrian kode_booking nama_pelanggan status nama_pegawai")
      .sort({ antrian: 1 })
      .lean();

    res.json(
      rows.map((r) => ({
        antrian: r.antrian,
        bookingCode: r.kode_booking,
        customerName: maskCustomerName(r.nama_pelanggan),
        status: r.status,
        employeeName: r.nama_pegawai || "",
      })),
    );
  }),
);

app.post(
  "/api/bookings",
  asyncHandler(async (req, res) => {
    const branchDomain = normalizeDomain(req.body?.branchDomain);
    let branch = null;
    if (branchDomain) {
      branch = await Branch.findOne({ domain: branchDomain }).lean();
      if (!branch) return res.status(404).json({ message: "Cabang tidak ditemukan" });
    }
    const queueDate = formatJakartaYmd();
    const counter = await QueueCounter.findOneAndUpdate(
      { date: queueDate },
      { $inc: { seq: 1 }, $setOnInsert: { date: queueDate } },
      { new: true, upsert: true },
    ).lean();
    let antrian = counter.seq;
    if (counter.date !== queueDate) {
      antrian = 1;
      await QueueCounter.updateOne({ _id: counter._id }, { seq: 1, date: queueDate });
    }

    // Map input to Indonesian fields
    const phone = normalizePhone(req.body.phone || "");
    let id_pelanggan = undefined;
    if (phone) {
      const customer = await upsertCustomerByPhone({ phone, name: req.body.customerName });
      id_pelanggan = customer?._id;
    }

    const layanan = Array.isArray(req.body?.services) ? req.body.services : [];
    const serviceCodes = layanan.map((s) => String(s?.kode || "").trim()).filter(Boolean);

    // Auto-add compliment products
    let produk = [];
    if (serviceCodes.length > 0) {
      const serviceMasters = await Service.find({ kode: { $in: serviceCodes } })
        .select("kode compliments")
        .lean();
      const complimentQtyMap = new Map();
      for (const svc of serviceMasters) {
        for (const c of svc?.compliments || []) {
          const kode = String(c?.kode || "").trim();
          const qty = Number(c?.qty ?? 1);
          if (!kode) continue;
          const qtySafe = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
          complimentQtyMap.set(kode, (complimentQtyMap.get(kode) || 0) + qtySafe);
        }
      }
      if (complimentQtyMap.size > 0) {
        const productCodes = Array.from(complimentQtyMap.keys());
        const productRows = await Product.find({ kode: { $in: productCodes } }).lean();
        const productMap = new Map(productRows.map((p) => [p.kode, p]));
        produk = productCodes
          .map((kode) => {
            const row = productMap.get(kode);
            if (!row) return null;
            return {
              kode: row.kode,
              nama: row.nama,
              harga: 0,
              qty: complimentQtyMap.get(kode) || 1,
              isCompliment: true,
            };
          })
          .filter(Boolean);
        if (produk.length !== complimentQtyMap.size) {
          const missing = productCodes.filter((c) => !productMap.has(c));
          console.warn("Compliment products missing in master product. Skipped.", { missing, serviceCodes });
        }
      }
    }

    const kode_booking = formatBookingCode({ queueDate, antrian });
    const payload = {
      kode_booking,
      antrian,
      nama_pelanggan: req.body.customerName,
      no_hp: phone || "",
      id_pelanggan,
      token_bagi: generateShareToken(),
      nama_pegawai: req.body.employeeName || "",
      id_cabang: branch?._id,
      domain_cabang: branch?.domain,
      layanan,
      produk,
      status: "Menunggu",
      tgl_sistem: queueDate,
      status_bayar: "Unpaid",
      tgl_bayar: null,
      tgl_byr: "",
    };
    const created = await Booking.create(payload);

    if (created.no_hp) {
      setImmediate(() => {
        void (async () => {
          // Mapping field Indonesia ke field yang dipakai PDF
          const bookingObj = {
            antrian: created.antrian,
            bookingCode: created.kode_booking,
            customerName: created.nama_pelanggan,
            phone: created.no_hp,
            status: created.status,
            createdAt: created.createdAt,
            services: (created.layanan || []).map(l => ({
              nama: l.nama,
              harga: l.harga
            })),
            products: (created.produk || []).map(p => ({
              nama: p.nama,
              harga: p.harga,
              qty: p.qty,
              isCompliment: p.isCompliment
            }))
          };
          const pdf = await buildTicketPdf({ booking: bookingObj, branch });
          const caption = [
            "TIKET ANTREAN",
            branch?.nama ? `Cabang: ${branch.nama}` : null,
            `Kode: ${bookingObj.bookingCode}`,
            `Nomor: ${bookingObj.antrian}`,
            `Nama: ${bookingObj.customerName}`,
          ]
            .filter(Boolean)
            .join("\n");

          const ok = await waGateway.sendDocument(created.no_hp, pdf, {
            fileName: `tiket_${bookingObj.bookingCode}.pdf`,
            caption,
            mimetype: "application/pdf",
          });
          if (!ok) console.warn("WA send failed (booking)", { kode_booking: bookingObj.bookingCode, no_hp: created.no_hp, wa: waGateway.getStatus() });
        })().catch((err) =>
          console.warn("WA send error (booking)", { kode_booking: created.kode_booking, error: err?.message || String(err), wa: waGateway.getStatus() }),
        );
      });
    }

    res.status(201).json({
      id: String(created._id),
      bookingCode: created.kode_booking,
      antrian: created.antrian,
      customerName: created.nama_pelanggan,
      phone: created.no_hp,
      customerId: created.id_pelanggan ? String(created.id_pelanggan) : undefined,
      employeeName: created.nama_pegawai,
      branchId: created.id_cabang ? String(created.id_cabang) : undefined,
      branchDomain: created.domain_cabang,
      services: created.layanan || [],
      products: created.produk || [],
      status: created.status,
      createdAt: created.createdAt,
      paymentStatus: created.status_bayar || "Unpaid",
      paidAt: created.tgl_bayar,
    });
  }),
);

app.patch(
  "/api/bookings/:id/assign",
  requireLevels("Owner", "Admin", "Pegawai"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Booking.findByIdAndUpdate(
      _id,
      { nama_pegawai: req.body.employeeName, status: "Proses" },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), employeeName: updated.nama_pegawai || "", status: updated.status });
  }),
);

app.patch(
  "/api/bookings/:id/complete",
  requireLevels("Owner", "Admin", "Pegawai"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Booking.findByIdAndUpdate(_id, { status: "Selesai" }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), status: updated.status });
  }),
);

app.post(
  "/api/bookings/:id/add-service",
  requireLevels("Owner", "Admin", "Pegawai", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const serviceKode = String(req.body?.serviceKode || "").trim();
    if (!serviceKode) return res.status(400).json({ message: "Kode layanan wajib diisi" });

    const booking = await Booking.findById(_id).lean();
    if (!booking) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (booking.status_bayar === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });
    if (!["Menunggu", "Proses"].includes(booking.status)) {
      return res.status(400).json({ message: "Booking tidak bisa ditambah layanan pada status ini" });
    }

    const service = await Service.findOne({ kode: serviceKode }).lean();
    if (!service) return res.status(404).json({ message: "Layanan tidak ditemukan" });

    const updated = await Booking.findByIdAndUpdate(
      booking._id,
      {
        $push: {
          layanan: {
            kode: service.kode,
            nama: service.nama,
            harga: service.harga,
          },
        },
      },
      { new: true },
    ).lean();

    res.json({
      id: String(updated._id),
      bookingCode: updated.kode_booking,
      services: updated.layanan || [],
    });
  }),
);

app.post(
  "/api/bookings/:id/add-product",
  requireLevels("Owner", "Admin", "Pegawai", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const productKode = String(req.body?.productKode || "").trim();
    const qty = Number(req.body?.qty ?? 1);
    const isCompliment = Boolean(req.body?.isCompliment);
    if (!productKode) return res.status(400).json({ message: "Kode produk wajib diisi" });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ message: "Qty tidak valid" });

    const booking = await Booking.findById(_id).lean();
    if (!booking) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (booking.status_bayar === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });

    const product = await Product.findOne({ kode: productKode }).lean();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });

    const existingIndex = (booking.produk || []).findIndex(
      (p) => p.kode === product.kode && Boolean(p.isCompliment) === isCompliment,
    );
    if (existingIndex >= 0) {
      const path = `produk.${existingIndex}.qty`;
      await Booking.updateOne({ _id: booking._id }, { $inc: { [path]: qty } });
    } else {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $push: {
            produk: {
              kode: product.kode,
              nama: product.nama,
              harga: isCompliment ? 0 : product.harga,
              qty,
              isCompliment,
            },
          },
        },
      );
    }

    const updated = await Booking.findById(booking._id).lean();
    res.json({
      id: String(updated._id),
      bookingCode: updated.kode_booking || updated.bookingCode,
      products: updated.produk || [],
    });
  }),
);

app.delete(
  "/api/bookings/:id/products/:kode",
  requireLevels("Owner", "Admin", "Pegawai", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const kode = String(req.params.kode || "").trim();
    if (!kode) return res.status(400).json({ message: "Kode produk tidak valid" });

    const booking = await Booking.findById(_id).lean();
    if (!booking) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (booking.status_bayar === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });

    const isComplimentParam = req.query?.isCompliment;
    const hasIsCompliment = isComplimentParam !== undefined;
    const isCompliment =
      hasIsCompliment && String(isComplimentParam).trim() !== ""
        ? ["1", "true", "yes", "y", "on"].includes(String(isComplimentParam).toLowerCase())
        : false;

    await Booking.updateOne(
      { _id: booking._id },
      { $pull: { produk: hasIsCompliment ? { kode, isCompliment } : { kode } } },
    );
    const updated = await Booking.findById(booking._id).lean();
    res.json({
      id: String(updated._id),
      bookingCode: updated.kode_booking,
      products: updated.produk || [],
    });
  }),
);

app.post(
  "/api/bookings/:id/pay",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const received = Number(req.body?.received);
    if (!Number.isFinite(received) || received < 0) {
      return res.status(400).json({ message: "Nominal uang diterima tidak valid" });
    }

    const booking = await Booking.findById(_id).lean();
    if (!booking) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (booking.status_bayar === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });
    if (booking.status !== "Selesai") return res.status(400).json({ message: "Booking belum selesai dikerjakan" });

    const serviceTotal = sumBookingTotal(booking);
    const productTotal = sumBookingProductTotal(booking);
    const total = serviceTotal + productTotal;
    if (received < total) return res.status(400).json({ message: "Uang diterima kurang dari total" });

    const paidAt = new Date();
    const paidYmd = formatJakartaYmd(paidAt);
    const change = received - total;

    const saleCounter = await SaleCounter.findOneAndUpdate(
      { date: paidYmd },
      { $inc: { seq: 1 }, $setOnInsert: { date: paidYmd } },
      { new: true, upsert: true },
    ).lean();
    let saleSeq = saleCounter.seq;
    if (saleCounter.date !== paidYmd) {
      saleSeq = 1;
      await SaleCounter.updateOne({ _id: saleCounter._id }, { seq: 1, date: paidYmd });
    }
    const saleCode = formatSaleCode({ saleDate: paidYmd, seq: saleSeq });

    // Validate stock (best-effort; actual decrement happens later)
    const bookingProducts = booking.produk || [];
    if (bookingProducts.length > 0) {
      const requiredMap = new Map();
      for (const item of bookingProducts) {
        const kode = String(item?.kode || "").trim();
        const qty = Number(item?.qty) || 0;
        if (!kode || qty <= 0) continue;
        requiredMap.set(kode, (requiredMap.get(kode) || 0) + qty);
      }

      const products = await Product.find({ kode: { $in: Array.from(requiredMap.keys()) } }).lean();
      const map = Object.fromEntries(products.map((p) => [p.kode, p]));
      for (const [kode, needQty] of requiredMap.entries()) {
        const p = map[kode];
        if (!p) return res.status(400).json({ message: `Produk ${kode} tidak ditemukan` });
        if ((p.stok || 0) < needQty) return res.status(400).json({ message: `Stok produk ${p.nama} tidak cukup` });
      }
    }

    const bookingPhone = normalizePhone(booking.no_hp);
    let customer = null;
    if (booking.id_pelanggan) {
      customer = await Customer.findById(booking.id_pelanggan).lean();
    }
    if (!customer && bookingPhone) {
      const upserted = await upsertCustomerByPhone({ phone: bookingPhone, name: booking.nama_pelanggan });
      customer = upserted ? upserted.toObject() : null;
    }
    if (!customer && String(booking.nama_pelanggan || "").trim()) {
      const created = await Customer.create({ phone: null, name: String(booking.nama_pelanggan || "").trim(), isMember: false });
      customer = created.toObject();
    }
    const customerId = customer?._id;
    const isMember = Boolean(customer?.isMember);

    const salePayload = {
      id_booking: booking._id,
      kode_booking: booking.kode_booking,
      sumber: "tt_booking",
      kode_transaksi: saleCode,
      nama_pegawai: booking.nama_pegawai || "",
      id_pelanggan: customerId,
      nama_pelanggan: booking.nama_pelanggan || "",
      no_hp_pelanggan: booking.no_hp || "",
      token_bagi: generateShareToken(),
      item: [
        ...(booking.layanan || []).map((s) => ({
          type: "service",
          kode: s.kode,
          nama: s.nama,
          harga: Number(s.harga) || 0,
          qty: 1,
          isCompliment: false,
        })),
        ...(booking.produk || []).map((p) => ({
          type: "product",
          kode: p.kode,
          nama: p.nama,
          harga: p.isCompliment ? 0 : Number(p.harga) || 0,
          qty: Number(p.qty) || 1,
          isCompliment: Boolean(p.isCompliment),
        })),
      ],
      total,
      total_diskon: 0,
      metode: "Cash",
      diterima: received,
      kembalian: change,
      tgl_bayar: paidAt,
      tgl_byr: paidYmd,
      status: "Paid",
      poin_didapat: 0,
    };

    // Attempt to apply stock changes and create sale atomically (transaction when possible).
    let createdSale = null;
    let pointsEarned = 0;
    let commissionType = "persentase";
    let commissionValue = 0;
    let commissionEarned = 0;
    const session = await mongoose.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
    try {
      await session.withTransaction(async () => {
        if (customerId && isMember) {
          const setting = (await PointSetting.findOne().session(session).lean()) || {
            mode: "per_rupiah",
            pointsPerTransaction: 0,
            rupiahStep: 10000,
            pointsPerStep: 1,
          };
          pointsEarned = computePointsEarned({ total, setting });
        } else {
          pointsEarned = 0;
        }
        if (salePayload.nama_pegawai) {
          const commissionSetting = (await CommissionSetting.findOne().session(session).lean()) || { tipe: "persentase", nilai: 15 };
          commissionType = commissionSetting.tipe;
          commissionValue = Number(commissionSetting.nilai || 0);
          commissionEarned = computeCommissionEarned({ total, setting: commissionSetting });
        }

        salePayload.poin_didapat = pointsEarned;
        salePayload.tipe_komisi = commissionType;
        salePayload.nilai_komisi = commissionValue;
        salePayload.komisi_didapat = commissionEarned;
        createdSale = await Sale.create([salePayload], { session, ordered: true }).then((rows) => rows[0]);

        // Insert SaleLine (tt_item_transaksi)
        const saleLines = (salePayload.item || []).map((it) => ({
          id_transaksi: createdSale._id,
          kode_transaksi: salePayload.kode_transaksi || "",
          kode_booking: salePayload.kode_booking,
          tgl_bayar: salePayload.tgl_bayar,
          tgl_byr: salePayload.tgl_byr,
          metode: salePayload.metode,
          nama_pegawai: salePayload.nama_pegawai || "",
          nama_pelanggan: salePayload.nama_pelanggan || "",
          no_hp_pelanggan: salePayload.no_hp_pelanggan || "",
          status: "Paid",
          tipe: it.type,
          kode: it.kode,
          nama: it.nama,
          harga: Number(it.harga) || 0,
          qty: Number(it.qty) || 1,
          subtotal: (Number(it.harga) || 0) * (Number(it.qty) || 1),
          isCompliment: Boolean(it.isCompliment),
        }));
        if (saleLines.length > 0) {
          await SaleLine.insertMany(saleLines, { session, ordered: true });
        }

        const requiredMap = new Map();
        for (const item of booking.produk || []) {
          const kode = String(item?.kode || "").trim();
          const qty = Number(item?.qty) || 0;
          if (!kode || qty <= 0) continue;
          requiredMap.set(kode, (requiredMap.get(kode) || 0) + qty);
        }

        for (const [kode, qty] of requiredMap.entries()) {
          const updatedProduct = await Product.findOneAndUpdate(
            { kode, stok: { $gte: qty } },
            { $inc: { stok: -qty } },
            { new: true, session },
          ).lean();
          if (!updatedProduct) throw new Error(`Stok produk ${kode} tidak cukup`);

          await StockMovement.create(
            [buildStockMovementDoc({ product: updatedProduct, delta: -qty, reason: "sale", refSaleId: createdSale._id, refBookingCode: booking.kode_booking, ymd: paidYmd })],
            { session, ordered: true },
          );
        }

        await Booking.updateOne(
          { _id: booking._id },
          {
            $set: {
              status_bayar: "Paid",
              tgl_bayar: paidAt,
              tgl_byr: paidYmd,
              id_pelanggan: customerId,
            },
          },
          { session },
        );

        if (customerId && isMember && pointsEarned > 0) {
          await Customer.updateOne(
            { _id: customerId },
            { $inc: { pointsBalance: pointsEarned, visitCount: 1 }, $set: { lastVisitAt: paidAt } },
            { session },
          );
        } else if (customerId) {
          await Customer.updateOne(
            { _id: customerId },
            { $inc: { visitCount: 1 }, $set: { lastVisitAt: paidAt } },
            { session },
          );
        }
      }, { readPreference: "primary" });
    } catch (err) {
      if (isTransactionNotSupported(err)) {
        // Fallback for standalone MongoDB (no transactions).
        if (customerId && isMember) {
          const setting = (await PointSetting.findOne().lean()) || {
            mode: "per_rupiah",
            pointsPerTransaction: 0,
            rupiahStep: 10000,
            pointsPerStep: 1,
          };
          pointsEarned = computePointsEarned({ total, setting });
        } else {
          pointsEarned = 0;
        }
        if (salePayload.employeeName) {
          const commissionSetting = (await CommissionSetting.findOne().lean()) || { tipe: "persentase", nilai: 15 };
          commissionType = commissionSetting.tipe;
          commissionValue = Number(commissionSetting.nilai || 0);
          commissionEarned = computeCommissionEarned({ total, setting: commissionSetting });
        }
        salePayload.pointsEarned = pointsEarned;
        salePayload.commissionType = commissionType;
        salePayload.commissionValue = commissionValue;
        salePayload.commissionEarned = commissionEarned;

        try {
          createdSale = await Sale.create(salePayload);
        } catch (dupErr) {
          if (dupErr?.code === 11000) return res.status(409).json({ message: "Transaksi untuk booking ini sudah ada" });
          throw dupErr;
        }

        const saleLines = (salePayload.items || []).map((it) => ({
          saleId: createdSale._id,
          saleCode: salePayload.saleCode || "",
          bookingCode: salePayload.bookingCode,
          paidAt,
          paidYmd,
          method: salePayload.method,
          employeeName: salePayload.employeeName || "",
          customerName: salePayload.customerName || "",
          customerPhone: salePayload.customerPhone || "",
          status: "Paid",
          type: it.type,
          kode: it.kode,
          nama: it.nama,
          harga: Number(it.harga) || 0,
          qty: Number(it.qty) || 1,
          subtotal: (Number(it.harga) || 0) * (Number(it.qty) || 1),
          isCompliment: Boolean(it.isCompliment),
        }));
        if (saleLines.length > 0) await SaleLine.insertMany(saleLines);

        const requiredMap = new Map();
        for (const item of booking.produk || []) {
          const kode = String(item?.kode || "").trim();
          const qty = Number(item?.qty) || 0;
          if (!kode || qty <= 0) continue;
          requiredMap.set(kode, (requiredMap.get(kode) || 0) + qty);
        }

        for (const [kode, qty] of requiredMap.entries()) {
          const updatedProduct = await Product.findOneAndUpdate(
            { kode, stok: { $gte: qty } },
            { $inc: { stok: -qty } },
            { new: true },
          ).lean();
          if (!updatedProduct) return res.status(400).json({ message: `Stok produk ${kode} tidak cukup` });
          await StockMovement.create(buildStockMovementDoc({ product: updatedProduct, delta: -qty, reason: "sale", refSaleId: createdSale._id, refBookingCode: booking.kode_booking, ymd: paidYmd }));
        }

        await Booking.updateOne(
          { _id: booking._id },
          { $set: { status_bayar: "Paid", tgl_bayar: paidAt, tgl_byr: paidYmd, id_pelanggan: customerId } },
        );

        if (customerId && isMember && pointsEarned > 0) {
          await Customer.updateOne(
            { _id: customerId },
            { $inc: { pointsBalance: pointsEarned, visitCount: 1 }, $set: { lastVisitAt: paidAt } },
          );
        } else if (customerId) {
          await Customer.updateOne({ _id: customerId }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: paidAt } });
        }
      } else {
        if (err?.code === 11000) {
          return res.status(409).json({ message: "Transaksi untuk booking ini sudah ada" });
        }
        const message = err instanceof Error ? err.message : "Gagal memproses pembayaran";
        return res.status(400).json({ message });
      }
    } finally {
      await session.endSession();
    }

    const updated = await Booking.findById(booking._id).lean();

    const waPhone =
      salePayload.no_hp_pelanggan ||
      updated?.no_hp ||
      updated?.phone ||
      salePayload.customerPhone ||
      updated?.customerPhone ||
      "";

    if (waPhone) {
      setImmediate(() => {
        void (async () => {
          const branch = updated?.id_cabang ? await Branch.findById(updated.id_cabang).lean() : null;
          const pdf = await buildReceiptPdf({
            sale: {
              bookingCode: salePayload.kode_booking,
              paidAt: salePayload.tgl_bayar,
              items: salePayload.item || [],
              total: salePayload.total,
              received: salePayload.diterima,
              change: salePayload.kembalian,
              customerName: salePayload.nama_pelanggan || "",
              customerPhone: waPhone,
            },
            branch,
          });
          const caption = [
            `STRUK ${salePayload.kode_booking}`,
            new Date(salePayload.tgl_bayar).toLocaleString("id-ID"),
            salePayload.nama_pelanggan
              ? `Customer: ${salePayload.nama_pelanggan}${waPhone ? ` (${waPhone})` : ""}`
              : null,
            `Total: ${new Intl.DateTimeFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(salePayload.total)}`,
          ]
            .filter(Boolean)
            .join("\n");

          const ok = await waGateway.sendDocument(waPhone, pdf, {
            fileName: `struk_${salePayload.kode_booking}.pdf`,
            caption,
            mimetype: "application/pdf",
          });
          if (!ok) console.warn("WA send failed (pay)", { bookingCode: salePayload.kode_booking, phone: waPhone, wa: waGateway.getStatus() });
        })().catch((err) =>
          console.warn("WA send error (pay)", { bookingCode: salePayload.kode_booking, phone: waPhone, error: err?.message || String(err), wa: waGateway.getStatus() }),
        );
      });
    }

    res.json({
      id: String(updated._id),
      bookingCode: updated.kode_booking || updated.bookingCode || "",
      paymentStatus: updated.status_bayar || updated.paymentStatus || "",
      paidAt: updated.tgl_bayar || updated.paidAt || "",
      saleId: createdSale ? String(createdSale._id) : "",
      saleCode: salePayload.kode_transaksi || "",
      customerName: updated.nama_pelanggan || booking.nama_pelanggan || updated.customerName || booking.customerName || "",
      customerPhone: updated.no_hp || booking.no_hp || updated.phone || booking.phone || "",
      items: salePayload.item || [],
      loyaltyEarnedRp: 0,
      pointsEarned,
      total,
      received,
      change,
    });

    // Simpan keuangan (tt_keuangan) setelah transaksi sukses
    try {
      await CashMovement.create({
        tgl_sistem: paidYmd,
        arah: "in",
        jumlah: total,
        deskripsi: `Pembayaran booking ${updated.kode_booking || updated.bookingCode || ""}`,
        dibuat_oleh: req.user?.username ? String(req.user.username) : "",
      });
    } catch (err) {
      console.warn("Gagal simpan keuangan (tt_keuangan):", err?.message || err);
    }
  }),
);

app.get(
  "/api/dashboard",
  asyncHandler(async (_, res) => {
    const [employeeCount, serviceCount, waitingCount] = await Promise.all([
      Employee.countDocuments(),
      Service.countDocuments(),
      Booking.countDocuments({ status: { $in: ["Menunggu", "Proses"] } }),
    ]);

    const todayYmd = formatJakartaYmd();
    const salesToday = await Sale.find({ tgl_byr: todayYmd, status: "Paid" }).lean();
    const pendapatanHariIni = salesToday.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    const recent = await Booking.find().sort({ createdAt: -1 }).limit(8).lean();

    res.json({
      stats: {
        totalPegawai: employeeCount,
        layananTersedia: serviceCount,
        bookingHariIni: waitingCount,
        pendapatanHariIni,
      },
      recentBookings: recent.map((r) => ({
        id: r.kode_booking,
        customer: r.nama_pelanggan,
        layanan: (r.layanan || []).map((s) => s.nama).join(", "),
        pegawai: r.nama_pegawai || "-",
        status: r.status,
      })),
    });
  }),
);

app.get(
  "/api/reports/transactions/recap",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const matchSale = {};
    if (req.query.from && req.query.to) {
      matchSale.tgl_byr = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      matchSale.tgl_byr = { $gte: req.query.from };
    } else if (req.query.to) {
      matchSale.tgl_byr = { $lte: req.query.to };
    }

    const includeVoid = String(req.query.includeVoid || "") === "1";
    if (!includeVoid) matchSale.status = "Paid";

    const [salesByDay, linesByDayType] = await Promise.all([
      Sale.aggregate([
        { $match: matchSale },
        {
          $group: {
            _id: "$tgl_byr",
            totalTransaksi: { $sum: 1 },
            totalOmzet: { $sum: "$total" },
            totalDiskon: { $sum: { $ifNull: ["$total_diskon", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SaleLine.aggregate([
        { $match: matchSale },
        {
          $group: {
            _id: { ymd: "$tgl_byr", type: "$tipe" },
            total: { $sum: "$subtotal" },
          },
        },
        { $sort: { "_id.ymd": 1 } },
      ]),
    ]);

    const byDay = new Map();
    for (const row of salesByDay) {
      byDay.set(row._id, {
        ymd: row._id,
        totalTransaksi: row.totalTransaksi || 0,
        totalOmzet: row.totalOmzet || 0,
        totalService: 0,
        totalProduk: 0,
        totalDiskon: row.totalDiskon || 0,
      });
    }

    for (const row of linesByDayType) {
      const ymd = row._id?.ymd;
      if (!ymd) continue;
      const existing =
        byDay.get(ymd) ||
        ({ ymd, totalTransaksi: 0, totalOmzet: 0, totalService: 0, totalProduk: 0, totalDiskon: 0 });
      if (row._id?.type === "service") existing.totalService = row.total || 0;
      if (row._id?.type === "product") existing.totalProduk = row.total || 0;
      byDay.set(ymd, existing);
    }

    const days = Array.from(byDay.values()).sort((a, b) => String(a.ymd).localeCompare(String(b.ymd)));
    const totals = days.reduce(
      (acc, d) => {
        acc.totalTransaksi += d.totalTransaksi || 0;
        acc.totalOmzet += d.totalOmzet || 0;
        acc.totalService += d.totalService || 0;
        acc.totalProduk += d.totalProduk || 0;
        acc.totalDiskon += d.totalDiskon || 0;
        return acc;
      },
      { totalTransaksi: 0, totalOmzet: 0, totalService: 0, totalProduk: 0, totalDiskon: 0 },
    );

    res.json({ from: req.query.from || "", to: req.query.to || "", days, totals, includeVoid });
  }),
);

app.get(
  "/api/reports/transactions/details",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.tgl_byr = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.tgl_byr = { $gte: req.query.from };
    } else if (req.query.to) {
      query.tgl_byr = { $lte: req.query.to };
    }

    const includeVoid = String(req.query.includeVoid || "") === "1";
    if (!includeVoid) query.status = "Paid";

    const q = String(req.query.q || "").trim();
    if (q) {
      query.$or = [
        { kode_booking: { $regex: q, $options: "i" } },
        { kode_transaksi: { $regex: q, $options: "i" } },
        { nama_pelanggan: { $regex: q, $options: "i" } },
        { no_hp_pelanggan: { $regex: q, $options: "i" } },
        { nama_pegawai: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await Sale.find(query)
      .select("kode_transaksi kode_booking nama_pelanggan no_hp_pelanggan nama_pegawai total total_diskon metode status tgl_bayar tgl_byr tgl_void alasan_void dibatalkan_oleh")
      .sort({ tgl_bayar: 1 })
      .limit(2000)
      .lean();

    res.json(
      rows.map((r) => ({
        id: String(r._id),
        saleCode: r.kode_transaksi || "",
        bookingCode: r.kode_booking || "",
        customerName: r.nama_pelanggan || "",
        customerPhone: r.no_hp_pelanggan || "",
        barber: r.nama_pegawai || "",
        total: Number(r.total) || 0,
        discountTotal: Number(r.total_diskon) || 0,
        method: r.metode || "Cash",
        status: r.status || "Paid",
        paidAt: r.tgl_bayar,
        paidYmd: r.tgl_byr,
        voidedAt: r.tgl_void,
        voidReason: r.alasan_void || "",
        voidedBy: r.dibatalkan_oleh || "",
      })),
    );
  }),
);

app.get(
  "/api/reports/transactions/items",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const saleId = toObjectId(req.query.saleId);
    const saleCode = String(req.query.saleCode || "").trim();
    const bookingCode = String(req.query.bookingCode || "").trim();

    let sale = null;
    if (saleId) {
      sale = await Sale.findById(saleId).select("_id kode_transaksi kode_booking tgl_bayar tgl_byr nama_pelanggan no_hp_pelanggan nama_pegawai metode status").lean();
    } else if (saleCode) {
      sale = await Sale.findOne({ kode_transaksi: saleCode }).select("_id kode_transaksi kode_booking tgl_bayar tgl_byr nama_pelanggan no_hp_pelanggan nama_pegawai metode status").lean();
    } else if (bookingCode) {
      sale = await Sale.findOne({ kode_booking: bookingCode, status: "Paid" })
        .sort({ tgl_bayar: -1 })
        .select("_id kode_transaksi kode_booking tgl_bayar tgl_byr nama_pelanggan no_hp_pelanggan nama_pegawai metode status")
        .lean();
    }

    if (!sale) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

    const lines = await SaleLine.find({ id_transaksi: sale._id })
      .select("tipe kode nama qty harga subtotal isCompliment")
      .sort({ tipe: 1, createdAt: 1 })
      .lean();

    res.json({
      sale: {
        id: String(sale._id),
        saleCode: sale.kode_transaksi || "",
        bookingCode: sale.kode_booking || "",
        paidAt: sale.tgl_bayar,
        paidYmd: sale.tgl_byr,
        customerName: sale.nama_pelanggan || "",
        customerPhone: sale.no_hp_pelanggan || "",
        barber: sale.nama_pegawai || "",
        method: sale.metode || "Cash",
        status: sale.status || "Paid",
      },
      items: lines.map((l) => ({
        type: l.tipe,
        kode: l.kode,
        nama: l.nama,
        qty: Number(l.qty) || 1,
        harga: Number(l.harga) || 0,
        subtotal: Number(l.subtotal) || 0,
        isCompliment: Boolean(l.isCompliment),
      })),
    });
  }),
);

app.get(
  "/api/reports/transactions/items-grouped",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const match = {};
    if (req.query.from && req.query.to) {
      match.tgl_byr = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.tgl_byr = { $gte: req.query.from };
    } else if (req.query.to) {
      match.tgl_byr = { $lte: req.query.to };
    }
    match.status = "Paid";

    const q = String(req.query.q || "").trim();

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "tt_transaksi",
          localField: "id_transaksi",
          foreignField: "_id",
          as: "sale",
        },
      },
      { $unwind: "$sale" },
      ...(q
        ? [
            {
              $match: {
                $or: [
                  { "sale.kode_booking": { $regex: q, $options: "i" } },
                  { "sale.kode_transaksi": { $regex: q, $options: "i" } },
                  { "sale.nama_pelanggan": { $regex: q, $options: "i" } },
                  { "sale.no_hp_pelanggan": { $regex: q, $options: "i" } },
                  { "sale.nama_pegawai": { $regex: q, $options: "i" } },
                  { kode: { $regex: q, $options: "i" } },
                  { nama: { $regex: q, $options: "i" } },
                ],
              },
            },
          ]
        : []),
      { $sort: { "sale.tgl_bayar": 1, id_transaksi: 1, tipe: 1, createdAt: 1 } },
      {
        $group: {
          _id: "$id_transaksi",
          saleId: { $first: "$id_transaksi" },
          saleCode: { $first: { $ifNull: ["$sale.kode_transaksi", ""] } },
          bookingCode: { $first: "$sale.kode_booking" },
          paidAt: { $first: "$sale.tgl_bayar" },
          paidYmd: { $first: "$sale.tgl_byr" },
          customerName: { $first: { $ifNull: ["$sale.nama_pelanggan", ""] } },
          customerPhone: { $first: { $ifNull: ["$sale.no_hp_pelanggan", ""] } },
          barber: { $first: { $ifNull: ["$sale.nama_pegawai", ""] } },
          status: { $first: { $ifNull: ["$sale.status", "Paid"] } },
          total: { $first: { $ifNull: ["$sale.total", 0] } },
          discountTotal: { $first: { $ifNull: ["$sale.total_diskon", 0] } },
          items: {
            $push: {
              type: "$tipe",
              kode: "$kode",
              nama: "$nama",
              qty: "$qty",
              harga: "$harga",
              subtotal: "$subtotal",
              isCompliment: "$isCompliment",
            },
          },
        },
      },
      { $sort: { paidAt: 1, saleId: 1 } },
      { $limit: 2000 },
    ];

    const groups = await SaleLine.aggregate(pipeline);

    res.json({
      from: req.query.from || "",
      to: req.query.to || "",
      includeVoid: false,
      groups: groups.map((g) => ({
        saleId: String(g.saleId),
        saleCode: g.saleCode || "",
        bookingCode: g.bookingCode,
        paidAt: g.paidAt,
        paidYmd: g.paidYmd,
        customerName: g.customerName || "",
        customerPhone: g.customerPhone || "",
        barber: g.barber || "",
        status: g.status || "Paid",
        total: Number(g.total) || 0,
        discountTotal: Number(g.discountTotal) || 0,
        items: (g.items || []).map((it) => ({
          type: it.type,
          kode: it.kode,
          nama: it.nama,
          qty: Number(it.qty) || 1,
          harga: Number(it.harga) || 0,
          subtotal: Number(it.subtotal) || 0,
          isCompliment: Boolean(it.isCompliment),
        })),
      })),
    });
  }),
);

app.get(
  "/api/reports/finance",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const view = String(req.query.view || "recap").toLowerCase(); // recap|detail
    const jenis = String(req.query.jenis || "all").toLowerCase(); // all|service|product|cash_in|cash_out
    const kode = String(req.query.kode || "").trim();

    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const saleMatch = { status: { $in: ["Paid", "Void"] } };
    if (from && to) saleMatch.tgl_byr = { $gte: from, $lte: to };
    else if (from) saleMatch.tgl_byr = { $gte: from };
    else if (to) saleMatch.tgl_byr = { $lte: to };

    if (jenis === "service") saleMatch.tipe = "service";
    if (jenis === "product") saleMatch.tipe = "product";
    if (jenis === "service" || jenis === "product") {
      if (kode) saleMatch.kode = kode;
    }
    if (jenis === "cash_in" || jenis === "cash_out") {
      saleMatch.tipe = "__none__";
    }

    const cashMatch = {};
    if (from && to) cashMatch.tgl_sistem = { $gte: from, $lte: to };
    else if (from) cashMatch.tgl_sistem = { $gte: from };
    else if (to) cashMatch.tgl_sistem = { $lte: to };
    if (jenis === "cash_in") cashMatch.arah = "in";
    if (jenis === "cash_out") cashMatch.arah = "out";
    if (jenis === "service" || jenis === "product") cashMatch.arah = "__none__";

    const basePipeline = [
      { $match: saleMatch },
      {
        $project: {
          tipe: { $cond: [{ $eq: ["$tipe", "product"] }, "Produk", "Layanan"] },
          kode: "$kode",
          nama: "$nama",
          jumlah: "$qty",
          jumlahIn: { $cond: [{ $eq: ["$status", "Paid"] }, "$subtotal", 0] },
          jumlahOut: { $cond: [{ $eq: ["$status", "Void"] }, "$subtotal", 0] },
          deskripsi: {
            $concat: [
              { $ifNull: ["$kode_transaksi", ""] },
              {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$kode_transaksi", ""] } }, 0] },
                  "",
                  { $ifNull: ["$kode_booking", ""] },
                ],
              },
              { $cond: [{ $eq: ["$status", "Void"] }, " (VOID)", ""] },
            ],
          },
          sortYmd: "$tgl_byr",
          sortAt: "$tgl_bayar",
        },
      },
      {
        $unionWith: {
          coll: CashMovement.collection.name,
          pipeline: [
            { $match: cashMatch },
            {
              $project: {
                tipe: { $cond: [{ $eq: ["$arah", "in"] }, "Tambah Kas", "Ambil Kas"] },
                kode: "-",
                nama: "Kas",
                jumlah: 1,
                jumlahIn: { $cond: [{ $eq: ["$arah", "in"] }, "$jumlah", 0] },
                jumlahOut: { $cond: [{ $eq: ["$arah", "out"] }, "$jumlah", 0] },
                deskripsi: "$deskripsi",
                sortYmd: "$tgl_sistem",
                sortAt: "$createdAt",
              },
            },
          ],
        },
      },
    ];

    if (view === "detail") {
      const rows = await SaleLine.aggregate([
        ...basePipeline,
        { $sort: { sortYmd: 1, sortAt: 1, tipe: 1, kode: 1 } },
        { $limit: 5000 },
        { $project: { sortYmd: 0, sortAt: 0 } },
      ]);
      return res.json(
        rows.map((r) => ({
          tipe: r.tipe,
          kode: r.kode,
          nama: r.nama,
          jumlah: Number(r.jumlah) || 0,
          jumlahIn: Number(r.jumlahIn) || 0,
          jumlahOut: Number(r.jumlahOut) || 0,
          deskripsi: String(r.deskripsi || ""),
        })),
      );
    }

    const rows = await SaleLine.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: { tipe: "$tipe", kode: "$kode", nama: "$nama" },
          jumlah: { $sum: "$jumlah" },
          jumlahIn: { $sum: "$jumlahIn" },
          jumlahOut: { $sum: "$jumlahOut" },
        },
      },
      { $sort: { "_id.tipe": 1, "_id.kode": 1, "_id.nama": 1 } },
    ]);

    return res.json(
      rows.map((r) => ({
        tipe: r._id.tipe,
        kode: r._id.kode,
        nama: r._id.nama,
        jumlah: Number(r.jumlah) || 0,
        jumlahIn: Number(r.jumlahIn) || 0,
        jumlahOut: Number(r.jumlahOut) || 0,
      })),
    );
  }),
);

app.get(
  "/api/reports/employees",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const match = {};
    if (req.query.from && req.query.to) {
      match.tgl_byr = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.tgl_byr = { $gte: req.query.from };
    } else if (req.query.to) {
      match.tgl_byr = { $lte: req.query.to };
    }
    match.status = "Paid";

    const rows = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$nama_pegawai",
          layananSelesai: { $sum: 1 },
          totalRp: { $sum: "$total" },
          komisi: { $sum: { $ifNull: ["$komisi_didapat", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const employees = await Employee.find().lean();
    const kodeMap = Object.fromEntries(employees.map((e) => [e.nama, e.kode]));

    const data = rows
      .filter((r) => r._id)
      .map((r) => {
        return {
          kode: kodeMap[r._id] || "-",
          nama: r._id,
          layananSelesai: r.layananSelesai,
          totalRp: r.totalRp,
          komisi: Number(r.komisi) || 0,
        };
      });

    res.json(data);
  }),
);

app.use((err, _req, res, _next) => {
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Data duplikat, nilai harus unik" });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

const bootstrap = async () => {
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const existingSetting = await CommissionSetting.findOne().lean();
  if (!existingSetting) {
    await CommissionSetting.create({ tipe: "persentase", nilai: 15 });
  }

  const userCount = await User.countDocuments();
  const seedUsername = process.env.DEFAULT_OWNER_USERNAME;
  const seedPassword = process.env.DEFAULT_OWNER_PASSWORD;
  if (userCount === 0 && seedUsername && seedPassword) {
    await User.create({
      username: seedUsername,
      password: hashPassword(seedPassword),
      level: "Owner",
      menuAccess: [],
    });
  }

  app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`);
  });

  // Best-effort: try restore WhatsApp session if auth already exists.
  waGateway
    .connect()
    .then((s) => {
      if (s?.status === "connected") console.log("WhatsApp connected:", s.me || "");
      else console.log("WhatsApp status:", s?.status || "unknown");
    })
    .catch((err) => console.warn("WhatsApp init failed:", err?.message || String(err)));
};

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// ENDPOINT LOGIN
app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const user = await User.findOne({ username }).lean();
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Username atau password salah" });
    }
    const token = signJwtHs256({ id: user._id, username: user.username, level: user.level });
    res.json({
      user: {
        id: String(user._id),
        username: user.username,
        level: user.level,
        menuAccess: user.menuAccess || [],
      },
      token,
    });
  })
);

// --- PASSWORD HASHING & VERIFICATION ---
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derivedKey = crypto.scryptSync(String(password), salt, 32, { N, r, p });
  return `scrypt$N=${N}$r=${r}$p=${p}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
};

const verifyPassword = (password, storedHash) => {
  const stored = String(storedHash || "");
  const plain = String(password || "");
  if (!stored || !plain) return false;

  if (!stored.startsWith("scrypt$")) {
    return Buffer.byteLength(stored) === Buffer.byteLength(plain) && crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(plain));
  }

  const parts = stored.split("$");
  // Format: scrypt$N=...$r=...$p=...$<saltB64>$<keyB64>
  if (parts.length < 6) return false;
  const N = Number(String(parts[1] || "").split("=")[1] || 0);
  const r = Number(String(parts[2] || "").split("=")[1] || 0);
  const p = Number(String(parts[3] || "").split("=")[1] || 0);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || N <= 0 || r <= 0 || p <= 0) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  const derived = crypto.scryptSync(plain, salt, expected.length, { N, r, p });
  return Buffer.byteLength(derived) === Buffer.byteLength(expected) && crypto.timingSafeEqual(derived, expected);
};
// --- END PASSWORD HASHING ---
