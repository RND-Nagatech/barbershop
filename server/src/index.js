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

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384$r=8$p=1$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
};

const verifyPassword = (password, stored) => {
  const raw = String(stored || "");
  if (!raw.startsWith("scrypt$")) {
    return String(password) === raw;
  }
  const parts = raw.split("$");
  // scrypt$N=...$r=...$p=...$<saltB64>$<hashB64>
  if (parts.length < 6) return false;
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(String(password), salt, expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
};

const authRequired = (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: "Unauthorized" });
  const payload = verifyJwtHs256(match[1]);
  if (!payload) return res.status(401).json({ message: "Unauthorized" });
  req.user = payload;
  next();
};

const requireLevels = (...allowed) => (req, res, next) => {
  const level = req.user?.level;
  if (!level || !allowed.includes(level)) return res.status(403).json({ message: "Forbidden" });
  next();
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
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    kode: { type: String, required: true, trim: true },
    nama: { type: String, required: true, trim: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: ["sale", "void", "adjust"], required: true },
    refSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    refBookingCode: { type: String, trim: true, default: "" },
    ymd: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);
stockMovementSchema.index({ ymd: 1 });

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
    loyaltyBalanceRp: { type: Number, default: 0, min: 0 },
    visitCount: { type: Number, default: 0, min: 0 },
    lastVisitAt: { type: Date },
  },
  { timestamps: true },
);
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

const queueCounterSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);
queueCounterSchema.index({ date: 1 }, { unique: true });

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
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    bookingCode: { type: String, required: true, trim: true },
    employeeName: { type: String, trim: true, default: "" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    items: { type: [saleItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["Cash", "Legacy"], required: true },
    received: { type: Number, required: true, min: 0 },
    change: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true },
    paidYmd: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Paid", "Void"], default: "Paid" },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true, default: "" },
    voidedBy: { type: String, trim: true, default: "" },
    loyaltyEarnedRp: { type: Number, default: 0, min: 0 },
    shareToken: { type: String, trim: true },
  },
  { timestamps: true },
);
saleSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: "Paid" } },
);
saleSchema.index({ paidYmd: 1 });
saleSchema.index({ shareToken: 1 }, { unique: true, sparse: true });

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
    bookingCode: { type: String, required: true, trim: true },
    antrian: { type: Number, required: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    shareToken: { type: String, trim: true },
    employeeName: { type: String, default: "" },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    branchDomain: { type: String, trim: true },
    services: { type: [bookingServiceSchema], default: [] },
    products: { type: [bookingProductSchema], default: [] },
    status: {
      type: String,
      enum: ["Menunggu", "Proses", "Selesai"],
      default: "Menunggu",
    },
    tgl_system: { type: String, required: true },
    paymentStatus: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    paidAt: { type: Date },
    paidYmd: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);
bookingSchema.index({ tgl_system: 1, bookingCode: 1 }, { unique: true });
bookingSchema.index({ shareToken: 1 }, { unique: true, sparse: true });

const Employee = mongoose.model("Employee", employeeSchema);
const Service = mongoose.model("Service", serviceSchema);
const Product = mongoose.model("Product", productSchema);
const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
const Branch = mongoose.model("Branch", branchSchema);
const User = mongoose.model("User", userSchema);
const Customer = mongoose.model("Customer", customerSchema);
const CommissionSetting = mongoose.model("CommissionSetting", commissionSchema);
const LoyaltySetting = mongoose.model("LoyaltySetting", loyaltySettingSchema);
const QueueCounter = mongoose.model("QueueCounter", queueCounterSchema);
const Sale = mongoose.model("Sale", saleSchema);
const Booking = mongoose.model("Booking", bookingSchema);

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
  const normalized = value.replace(/[^\d+]/g, "").trim();
  return normalized ? normalized : null;
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

const generateShareToken = () => crypto.randomBytes(18).toString("hex");

const sumBookingTotal = (booking) => (booking?.services || []).reduce((sum, s) => sum + (Number(s?.harga) || 0), 0);
const sumBookingProductTotal = (booking) =>
  (booking?.products || []).reduce((sum, p) => {
    if (p?.isCompliment) return sum;
    return sum + (Number(p?.harga) || 0) * (Number(p?.qty) || 0);
  }, 0);

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
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi" });
    }

    const user = await User.findOne({ username });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    if (!String(user.password || "").startsWith("scrypt$")) {
      user.password = hashPassword(password);
      await user.save();
    }

    const token = signJwtHs256({
      id: String(user._id),
      username: user.username,
      level: user.level,
      menuAccess: user.menuAccess || [],
    });

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
        level: user.level,
        menuAccess: user.menuAccess || [],
      },
      token,
    });
  }),
);

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
  "/api/employees",
  asyncHandler(async (_, res) => {
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
  "/api/services",
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
  "/api/products",
  requireLevels("Owner", "Admin", "Kasir", "Pegawai"),
  asyncHandler(async (_, res) => {
    const rows = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
  }),
);

app.get(
  "/api/products/low-stock",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (_, res) => {
    const rows = await Product.find({ minStok: { $gt: 0 }, $expr: { $lte: ["$stok", "$minStok"] } })
      .sort({ stok: 1 })
      .lean();
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga, stok: r.stok, minStok: r.minStok ?? 0 })));
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

    await StockMovement.create({
      productId: updated._id,
      kode: updated.kode,
      nama: updated.nama,
      delta,
      reason: "adjust",
      ymd,
    });

    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga, stok: updated.stok, minStok: updated.minStok ?? 0 });
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
    const query = {};
    if (req.query.from && req.query.to) {
      query.ymd = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.ymd = { $gte: req.query.from };
    } else if (req.query.to) {
      query.ymd = { $lte: req.query.to };
    }
    if (req.query.kode) query.kode = String(req.query.kode);
    if (req.query.reason) query.reason = String(req.query.reason);

    const rows = await StockMovement.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        ymd: r.ymd,
        kode: r.kode,
        nama: r.nama,
        delta: r.delta,
        reason: r.reason,
        refBookingCode: r.refBookingCode || "",
        createdAt: r.createdAt,
      })),
    );
  }),
);

app.get(
  "/api/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.paidYmd = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.paidYmd = { $gte: req.query.from };
    } else if (req.query.to) {
      query.paidYmd = { $lte: req.query.to };
    }

    const includeVoid = String(req.query.includeVoid || "") === "1";
    if (!includeVoid) query.status = "Paid";

    const q = String(req.query.q || "").trim();
    if (q) {
      query.$or = [
        { bookingCode: { $regex: q, $options: "i" } },
        { employeeName: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await Sale.find(query)
      .select("bookingCode employeeName total method received change paidAt paidYmd status voidedAt voidReason voidedBy createdAt")
      .sort({ paidAt: -1 })
      .limit(300)
      .lean();

    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.bookingCode,
        employeeName: r.employeeName || "",
        total: r.total,
        method: r.method,
        received: r.received,
        change: r.change,
        paidAt: r.paidAt,
        paidYmd: r.paidYmd,
        status: r.status || "Paid",
        voidedAt: r.voidedAt,
        voidReason: r.voidReason || "",
        voidedBy: r.voidedBy || "",
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
      bookingCode: row.bookingCode,
      employeeName: row.employeeName || "",
      total: row.total,
      method: row.method,
      received: row.received,
      change: row.change,
      paidAt: row.paidAt,
      paidYmd: row.paidYmd,
      status: row.status || "Paid",
      voidedAt: row.voidedAt,
      voidReason: row.voidReason || "",
      voidedBy: row.voidedBy || "",
      customerName: row.customerName || "",
      customerPhone: row.customerPhone || "",
      items: row.items || [],
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

    const productItems = (sale.items || []).filter((i) => i.type === "product");

    const session = await mongoose.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
    try {
      await session.withTransaction(async () => {
        await Sale.updateOne(
          { _id: sale._id, status: "Paid" },
          { $set: { status: "Void", voidedAt, voidReason: reason, voidedBy } },
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
              [
                {
                  productId: updatedProduct._id,
                  kode: updatedProduct.kode,
                  nama: updatedProduct.nama,
                  delta: qty,
                  reason: "void",
                  refSaleId: sale._id,
                  refBookingCode: sale.bookingCode,
                  ymd,
                },
              ],
              { session },
            );
          }
        }

        await Booking.updateOne(
          { _id: sale.bookingId },
          { $set: { paymentStatus: "Unpaid", paidAt: null, paidYmd: "" } },
          { session },
        );
      }, { readPreference: "primary" });
    } catch (err) {
      if (!isTransactionNotSupported(err)) throw err;

      await Sale.updateOne(
        { _id: sale._id, status: "Paid" },
        { $set: { status: "Void", voidedAt, voidReason: reason, voidedBy } },
      );

      for (const item of productItems) {
        const qty = Number(item.qty) || 0;
        if (!qty) continue;
        const updatedProduct = await Product.findOneAndUpdate({ kode: item.kode }, { $inc: { stok: qty } }, { new: true }).lean();
        if (updatedProduct) {
          await StockMovement.create({
            productId: updatedProduct._id,
            kode: updatedProduct.kode,
            nama: updatedProduct.nama,
            delta: qty,
            reason: "void",
            refSaleId: sale._id,
            refBookingCode: sale.bookingCode,
            ymd,
          });
        }
      }

      await Booking.updateOne({ _id: sale.bookingId }, { $set: { paymentStatus: "Unpaid", paidAt: null, paidYmd: "" } });
    } finally {
      await session.endSession();
    }

    res.json({ id: String(sale._id), status: "Void", voidedAt, voidReason: reason, voidedBy });
  }),
);

app.post(
  "/api/services",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const complimentsRaw = Array.isArray(req.body?.compliments) ? req.body.compliments : [];
    const complimentsMap = new Map();
    for (const c of complimentsRaw) {
      const kode = String(c?.kode || "").trim();
      const qty = Number(c?.qty ?? 1);
      if (!kode) continue;
      const qtySafe = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      complimentsMap.set(kode, (complimentsMap.get(kode) || 0) + qtySafe);
    }
    const payload = {
      kode: req.body?.kode,
      nama: req.body?.nama,
      harga: req.body?.harga,
      compliments: Array.from(complimentsMap.entries()).map(([kode, qty]) => ({ kode, qty })),
    };

    const created = await Service.create(payload);
    res.status(201).json({
      id: String(created._id),
      kode: created.kode,
      nama: created.nama,
      harga: created.harga,
      compliments: created.compliments || [],
    });
  }),
);

app.put(
  "/api/services/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const complimentsRaw = Array.isArray(req.body?.compliments) ? req.body.compliments : [];
    const complimentsMap = new Map();
    for (const c of complimentsRaw) {
      const kode = String(c?.kode || "").trim();
      const qty = Number(c?.qty ?? 1);
      if (!kode) continue;
      const qtySafe = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      complimentsMap.set(kode, (complimentsMap.get(kode) || 0) + qtySafe);
    }
    const payload = {
      nama: req.body?.nama,
      harga: req.body?.harga,
      compliments: Array.from(complimentsMap.entries()).map(([kode, qty]) => ({ kode, qty })),
    };

    const updated = await Service.findByIdAndUpdate(_id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      kode: updated.kode,
      nama: updated.nama,
      harga: updated.harga,
      compliments: updated.compliments || [],
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
    const booking = await Booking.findOne({ shareToken: token }).lean();
    if (!booking) return res.status(404).json({ message: "Tiket tidak ditemukan" });
    const branch = booking.branchId ? await Branch.findById(booking.branchId).lean() : null;
    res.json({
      bookingCode: booking.bookingCode,
      antrian: booking.antrian,
      status: booking.status,
      createdAt: booking.createdAt,
      customerName: booking.customerName || "",
      phone: booking.phone || "",
      services: booking.services || [],
      products: booking.products || [],
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
    const sale = await Sale.findOne({ shareToken: token }).lean();
    if (!sale) return res.status(404).json({ message: "Struk tidak ditemukan" });
    const booking = sale.bookingId ? await Booking.findById(sale.bookingId).lean() : null;
    const branch = booking?.branchId ? await Branch.findById(booking.branchId).lean() : null;
    res.json({
      bookingCode: sale.bookingCode,
      paidAt: sale.paidAt,
      paidYmd: sale.paidYmd,
      items: sale.items || [],
      total: sale.total || 0,
      received: sale.received || 0,
      change: sale.change || 0,
      customerName: sale.customerName || "",
      customerPhone: sale.customerPhone || "",
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
  "/api/customers",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const query = {};
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
        isMember: !!c.isMember,
        loyaltyBalanceRp: c.loyaltyBalanceRp || 0,
        visitCount: c.visitCount || 0,
        lastVisitAt: c.lastVisitAt,
        createdAt: c.createdAt,
      })),
    );
  }),
);

app.put(
  "/api/customers/:id",
  requireLevels("Owner", "Admin"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const phone = normalizePhone(req.body?.phone);
    const payload = {
      phone,
      name: String(req.body?.name || "").trim(),
      isMember: Boolean(req.body?.isMember),
    };

    const updated = await Customer.findByIdAndUpdate(_id, payload, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({
      id: String(updated._id),
      phone: updated.phone || "",
      name: updated.name || "",
      isMember: !!updated.isMember,
      loyaltyBalanceRp: updated.loyaltyBalanceRp || 0,
      visitCount: updated.visitCount || 0,
      lastVisitAt: updated.lastVisitAt,
    });
  }),
);

app.get(
  "/api/customers/:id/sales",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const rows = await Sale.find({ customerId: _id })
      .select("bookingCode total status paidAt paidYmd")
      .sort({ paidAt: -1 })
      .limit(50)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.bookingCode,
        total: r.total,
        status: r.status || "Paid",
        paidAt: r.paidAt,
        paidYmd: r.paidYmd,
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
  "/api/bookings",
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.from && req.query.to) {
      query.tgl_system = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      query.tgl_system = { $gte: req.query.from };
    } else if (req.query.to) {
      query.tgl_system = { $lte: req.query.to };
    }
    if (req.query.status) query.status = req.query.status;
    if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
    if (req.query.branchDomain) {
      const domain = normalizeDomain(req.query.branchDomain);
      if (domain) query.branchDomain = domain;
    }
    const rows = await Booking.find(query).sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        bookingCode: r.bookingCode,
        antrian: r.antrian,
        customerName: r.customerName,
        phone: r.phone,
        customerId: r.customerId ? String(r.customerId) : undefined,
        employeeName: r.employeeName,
        branchId: r.branchId ? String(r.branchId) : undefined,
        branchDomain: r.branchDomain,
        services: r.services,
        products: r.products || [],
        status: r.status,
        createdAt: r.createdAt,
        paymentStatus: r.paymentStatus || "Unpaid",
        paidAt: r.paidAt,
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

    const rows = await Booking.find({ bookingCode: { $in: codes } })
      .select("bookingCode antrian status employeeName paidAt paymentStatus")
      .lean();

    res.json(
      rows.map((r) => ({
        bookingCode: r.bookingCode,
        antrian: r.antrian,
        status: r.status,
        employeeName: r.employeeName || "",
        paymentStatus: r.paymentStatus || "Unpaid",
        paidAt: r.paidAt,
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
    const rows = await Booking.find({ tgl_system: todayYmd })
      .select("antrian bookingCode customerName status employeeName")
      .sort({ antrian: 1 })
      .lean();

    res.json(
      rows.map((r) => ({
        antrian: r.antrian,
        bookingCode: r.bookingCode,
        customerName: maskCustomerName(r.customerName),
        status: r.status,
        employeeName: r.employeeName || "",
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
    const antrian = counter.seq;
    const bookingCode = formatBookingCode({ queueDate, antrian });

    const phone = normalizePhone(req.body.phone || "");
    let customerId = undefined;
    if (phone) {
      const customer = await Customer.findOneAndUpdate(
        { phone },
        { $setOnInsert: { phone, name: req.body.customerName || "" } },
        { new: true, upsert: true },
      ).lean();
      customerId = customer?._id;
    }

    const requestedServices = Array.isArray(req.body?.services) ? req.body.services : [];
    const serviceCodes = requestedServices
      .map((s) => String(s?.kode || "").trim())
      .filter(Boolean);

    // Auto-add compliment products based on selected services (harga 0, tetap mengurangi stok saat bayar)
    let complimentProducts = [];
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
        complimentProducts = productCodes
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

        if (complimentProducts.length !== complimentQtyMap.size) {
          const missing = productCodes.filter((c) => !productMap.has(c));
          console.warn("Compliment products missing in master product. Skipped.", { missing, serviceCodes, bookingCode });
        }
      }
    }

    const payload = {
      bookingCode,
      antrian,
      customerName: req.body.customerName,
      phone: phone || "",
      customerId,
      shareToken: generateShareToken(),
      employeeName: "",
      branchId: branch?._id,
      branchDomain: branch?.domain,
      services: requestedServices,
      products: complimentProducts,
      status: "Menunggu",
      tgl_system: queueDate,
      paymentStatus: "Unpaid",
      paidYmd: "",
    };
    const created = await Booking.create(payload);

    if (created.phone) {
      setImmediate(() => {
        void (async () => {
          const bookingObj = created.toObject();
          const pdf = await buildTicketPdf({ booking: bookingObj, branch });
          const caption = [
            "TIKET ANTREAN",
            branch?.nama ? `Cabang: ${branch.nama}` : null,
            `Kode: ${created.bookingCode}`,
            `Nomor: ${created.antrian}`,
            `Nama: ${created.customerName}`,
          ]
            .filter(Boolean)
            .join("\n");

          const ok = await waGateway.sendDocument(created.phone, pdf, {
            fileName: `tiket_${created.bookingCode}.pdf`,
            caption,
            mimetype: "application/pdf",
          });
          if (!ok) console.warn("WA send failed (booking)", { bookingCode: created.bookingCode, phone: created.phone, wa: waGateway.getStatus() });
        })().catch((err) =>
          console.warn("WA send error (booking)", { bookingCode: created.bookingCode, error: err?.message || String(err), wa: waGateway.getStatus() }),
        );
      });
    }

    res.status(201).json({
      id: String(created._id),
      bookingCode: created.bookingCode,
      antrian: created.antrian,
      customerName: created.customerName,
      phone: created.phone,
      customerId: created.customerId ? String(created.customerId) : undefined,
      employeeName: created.employeeName,
      branchId: created.branchId ? String(created.branchId) : undefined,
      branchDomain: created.branchDomain,
      services: created.services,
      products: created.products || [],
      status: created.status,
      createdAt: created.createdAt,
      paymentStatus: created.paymentStatus || "Unpaid",
      paidAt: created.paidAt,
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
      { employeeName: req.body.employeeName, status: "Proses" },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), employeeName: updated.employeeName, status: updated.status });
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
  requireLevels("Owner", "Admin", "Pegawai"),
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });

    const serviceKode = String(req.body?.serviceKode || "").trim();
    if (!serviceKode) return res.status(400).json({ message: "Kode layanan wajib diisi" });

    const booking = await Booking.findById(_id).lean();
    if (!booking) return res.status(404).json({ message: "Data tidak ditemukan" });
    if (booking.paymentStatus === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });
    if (!["Menunggu", "Proses"].includes(booking.status)) {
      return res.status(400).json({ message: "Booking tidak bisa ditambah layanan pada status ini" });
    }

    const service = await Service.findOne({ kode: serviceKode }).lean();
    if (!service) return res.status(404).json({ message: "Layanan tidak ditemukan" });

    const updated = await Booking.findByIdAndUpdate(
      booking._id,
      {
        $push: {
          services: {
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
      bookingCode: updated.bookingCode,
      services: updated.services,
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
    if (booking.paymentStatus === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });

    const product = await Product.findOne({ kode: productKode }).lean();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });

    const existingIndex = (booking.products || []).findIndex(
      (p) => p.kode === product.kode && Boolean(p.isCompliment) === isCompliment,
    );
    if (existingIndex >= 0) {
      const path = `products.${existingIndex}.qty`;
      await Booking.updateOne({ _id: booking._id }, { $inc: { [path]: qty } });
    } else {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $push: {
            products: {
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
      bookingCode: updated.bookingCode,
      products: updated.products || [],
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
    if (booking.paymentStatus === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });

    const isComplimentParam = req.query?.isCompliment;
    const hasIsCompliment = isComplimentParam !== undefined;
    const isCompliment =
      hasIsCompliment && String(isComplimentParam).trim() !== ""
        ? ["1", "true", "yes", "y", "on"].includes(String(isComplimentParam).toLowerCase())
        : false;

    await Booking.updateOne(
      { _id: booking._id },
      { $pull: { products: hasIsCompliment ? { kode, isCompliment } : { kode } } },
    );
    const updated = await Booking.findById(booking._id).lean();
    res.json({
      id: String(updated._id),
      bookingCode: updated.bookingCode,
      products: updated.products || [],
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
    if (booking.paymentStatus === "Paid") return res.status(409).json({ message: "Booking sudah dibayar" });
    if (booking.status !== "Selesai") return res.status(400).json({ message: "Booking belum selesai dikerjakan" });

    const serviceTotal = sumBookingTotal(booking);
    const productTotal = sumBookingProductTotal(booking);
    const total = serviceTotal + productTotal;
    if (received < total) return res.status(400).json({ message: "Uang diterima kurang dari total" });

    const paidAt = new Date();
    const paidYmd = formatJakartaYmd(paidAt);
    const change = received - total;

    // Validate stock (best-effort; actual decrement happens later)
    const bookingProducts = booking.products || [];
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

    let customerId = booking.customerId;
    const bookingPhone = normalizePhone(booking.phone);
    if (!customerId && bookingPhone) {
      const customer = await Customer.findOneAndUpdate(
        { phone: bookingPhone },
        { $setOnInsert: { phone: bookingPhone, name: booking.customerName || "" } },
        { new: true, upsert: true },
      ).lean();
      customerId = customer?._id;
    }

    const salePayload = {
      bookingId: booking._id,
      bookingCode: booking.bookingCode,
      employeeName: booking.employeeName || "",
      customerId,
      customerName: booking.customerName || "",
      customerPhone: booking.phone || "",
      shareToken: generateShareToken(),
      items: [
        ...(booking.services || []).map((s) => ({
          type: "service",
          kode: s.kode,
          nama: s.nama,
          harga: Number(s.harga) || 0,
          qty: 1,
          isCompliment: false,
        })),
        ...(booking.products || []).map((p) => ({
          type: "product",
          kode: p.kode,
          nama: p.nama,
          harga: p.isCompliment ? 0 : Number(p.harga) || 0,
          qty: Number(p.qty) || 1,
          isCompliment: Boolean(p.isCompliment),
        })),
      ],
      total,
      method: "Cash",
      received,
      change,
      paidAt,
      paidYmd,
      status: "Paid",
    };

    // Attempt to apply stock changes and create sale atomically (transaction when possible).
    let createdSale = null;
    let loyaltyEarnedRp = 0;
    const session = await mongoose.startSession({ defaultTransactionOptions: { readPreference: "primary" } });
    try {
      await session.withTransaction(async () => {
        const loyalty = (await LoyaltySetting.findOne().session(session).lean()) || { tipe: "persentase", nilai: 1 };
        if (customerId) {
          loyaltyEarnedRp =
            loyalty.tipe === "persentase"
              ? Math.max(0, Math.round((total * Number(loyalty.nilai || 0)) / 100))
              : Math.max(0, Math.round(Number(loyalty.nilai || 0)));
        }

        salePayload.loyaltyEarnedRp = loyaltyEarnedRp;
        createdSale = await Sale.create([salePayload], { session }).then((rows) => rows[0]);

        const requiredMap = new Map();
        for (const item of booking.products || []) {
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
            [
              {
                productId: updatedProduct._id,
                kode: updatedProduct.kode,
                nama: updatedProduct.nama,
                delta: -qty,
                reason: "sale",
                refSaleId: createdSale._id,
                refBookingCode: booking.bookingCode,
                ymd: paidYmd,
              },
            ],
            { session },
          );
        }

        await Booking.updateOne(
          { _id: booking._id },
          { $set: { paymentStatus: "Paid", paidAt, paidYmd, customerId } },
          { session },
        );

        if (customerId && loyaltyEarnedRp > 0) {
          await Customer.updateOne(
            { _id: customerId },
            {
              $inc: { loyaltyBalanceRp: loyaltyEarnedRp, visitCount: 1 },
              $set: { lastVisitAt: paidAt },
              $setOnInsert: { isMember: false },
            },
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
        const loyalty = (await LoyaltySetting.findOne().lean()) || { tipe: "persentase", nilai: 1 };
        if (customerId) {
          loyaltyEarnedRp =
            loyalty.tipe === "persentase"
              ? Math.max(0, Math.round((total * Number(loyalty.nilai || 0)) / 100))
              : Math.max(0, Math.round(Number(loyalty.nilai || 0)));
        }
        salePayload.loyaltyEarnedRp = loyaltyEarnedRp;

        try {
          createdSale = await Sale.create(salePayload);
        } catch (dupErr) {
          if (dupErr?.code === 11000) return res.status(409).json({ message: "Transaksi untuk booking ini sudah ada" });
          throw dupErr;
        }

        const requiredMap = new Map();
        for (const item of booking.products || []) {
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
          await StockMovement.create({
            productId: updatedProduct._id,
            kode: updatedProduct.kode,
            nama: updatedProduct.nama,
            delta: -qty,
            reason: "sale",
            refSaleId: createdSale._id,
            refBookingCode: booking.bookingCode,
            ymd: paidYmd,
          });
        }

        await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: "Paid", paidAt, paidYmd, customerId } });

        if (customerId && loyaltyEarnedRp > 0) {
          await Customer.updateOne(
            { _id: customerId },
            { $inc: { loyaltyBalanceRp: loyaltyEarnedRp, visitCount: 1 }, $set: { lastVisitAt: paidAt } },
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

    if (salePayload.customerPhone) {
      setImmediate(() => {
        void (async () => {
          const branch = updated?.branchId ? await Branch.findById(updated.branchId).lean() : null;
          const pdf = await buildReceiptPdf({
            sale: {
              bookingCode: salePayload.bookingCode,
              paidAt,
              items: salePayload.items || [],
              total,
              received,
              change,
              customerName: salePayload.customerName || "",
              customerPhone: salePayload.customerPhone || "",
            },
            branch,
          });
          const caption = [
            `STRUK ${salePayload.bookingCode}`,
            new Date(paidAt).toLocaleString("id-ID"),
            salePayload.customerName
              ? `Customer: ${salePayload.customerName}${salePayload.customerPhone ? ` (${salePayload.customerPhone})` : ""}`
              : null,
            `Total: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(total)}`,
          ]
            .filter(Boolean)
            .join("\n");

          const ok = await waGateway.sendDocument(salePayload.customerPhone, pdf, {
            fileName: `struk_${salePayload.bookingCode}.pdf`,
            caption,
            mimetype: "application/pdf",
          });
          if (!ok) console.warn("WA send failed (pay)", { bookingCode: salePayload.bookingCode, phone: salePayload.customerPhone, wa: waGateway.getStatus() });
        })().catch((err) =>
          console.warn("WA send error (pay)", { bookingCode: salePayload.bookingCode, error: err?.message || String(err), wa: waGateway.getStatus() }),
        );
      });
    }

    res.json({
      id: String(updated._id),
      bookingCode: updated.bookingCode,
      paymentStatus: updated.paymentStatus,
      paidAt: updated.paidAt,
      saleId: createdSale ? String(createdSale._id) : "",
      customerName: booking.customerName || "",
      customerPhone: booking.phone || "",
      items: salePayload.items,
      loyaltyEarnedRp,
      total,
      received,
      change,
    });
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
    const salesToday = await Sale.find({ paidYmd: todayYmd, status: "Paid" }).lean();
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
        id: r.bookingCode,
        customer: r.customerName,
        layanan: (r.services || []).map((s) => s.nama).join(", "),
        pegawai: r.employeeName || "-",
        status: r.status,
      })),
    });
  }),
);

app.get(
  "/api/reports/finance",
  requireLevels("Owner", "Admin", "Kasir"),
  asyncHandler(async (req, res) => {
    const match = {};
    if (req.query.from && req.query.to) {
      match.paidYmd = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.paidYmd = { $gte: req.query.from };
    } else if (req.query.to) {
      match.paidYmd = { $lte: req.query.to };
    }
    match.status = "Paid";

    const rows = await Sale.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: { type: "$items.type", kode: "$items.kode" },
          nama: { $first: "$items.nama" },
          jumlah: { $sum: "$items.qty" },
          total: { $sum: { $multiply: ["$items.harga", "$items.qty"] } },
        },
      },
      { $sort: { "_id.type": 1, "_id.kode": 1 } },
    ]);

    res.json(
      rows.map((r) => ({
        kode: r._id.kode,
        nama: r.nama,
        tipe: r._id.type === "product" ? "Produk" : "Layanan",
        jumlah: r.jumlah,
        total: r.total,
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
      match.paidYmd = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.paidYmd = { $gte: req.query.from };
    } else if (req.query.to) {
      match.paidYmd = { $lte: req.query.to };
    }
    match.status = "Paid";

    const commission = (await CommissionSetting.findOne().lean()) || { tipe: "persentase", nilai: 15 };

    const rows = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$employeeName",
          layananSelesai: { $sum: 1 },
          totalRp: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const employees = await Employee.find().lean();
    const kodeMap = Object.fromEntries(employees.map((e) => [e.nama, e.kode]));

    const data = rows
      .filter((r) => r._id)
      .map((r) => {
        const komisi =
          commission.tipe === "persentase"
            ? Math.round((r.totalRp * commission.nilai) / 100)
            : commission.nilai * r.layananSelesai;

        return {
          kode: kodeMap[r._id] || "-",
          nama: r._id,
          layananSelesai: r.layananSelesai,
          totalRp: r.totalRp,
          komisi,
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
