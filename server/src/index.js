import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

const app = express();
const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is required in environment variables");
}

app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json());
app.use(morgan("dev"));

const employeeSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const serviceSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

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

const commissionSchema = new mongoose.Schema(
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

const bookingServiceSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    harga: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, trim: true },
    antrian: { type: Number, required: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    employeeName: { type: String, default: "" },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    branchDomain: { type: String, trim: true },
    services: { type: [bookingServiceSchema], default: [] },
    status: {
      type: String,
      enum: ["Menunggu", "Proses", "Selesai"],
      default: "Menunggu",
    },
    tgl_system: { type: String, required: true },
  },
  { timestamps: true },
);
bookingSchema.index({ tgl_system: 1, bookingCode: 1 }, { unique: true });

const Employee = mongoose.model("Employee", employeeSchema);
const Service = mongoose.model("Service", serviceSchema);
const Branch = mongoose.model("Branch", branchSchema);
const User = mongoose.model("User", userSchema);
const CommissionSetting = mongoose.model("CommissionSetting", commissionSchema);
const QueueCounter = mongoose.model("QueueCounter", queueCounterSchema);
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

    const user = await User.findOne({ username }).lean();
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
        level: user.level,
        menuAccess: user.menuAccess || [],
      },
    });
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
  asyncHandler(async (req, res) => {
    const created = await Employee.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama });
  }),
);

app.put(
  "/api/employees/:id",
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
    res.json(rows.map((r) => ({ id: String(r._id), kode: r.kode, nama: r.nama, harga: r.harga })));
  }),
);

app.post(
  "/api/services",
  asyncHandler(async (req, res) => {
    const created = await Service.create(req.body);
    res.status(201).json({ id: String(created._id), kode: created.kode, nama: created.nama, harga: created.harga });
  }),
);

app.put(
  "/api/services/:id",
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Service.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), kode: updated.kode, nama: updated.nama, harga: updated.harga });
  }),
);

app.delete(
  "/api/services/:id",
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
  asyncHandler(async (_, res) => {
    const rows = await Branch.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((r) => ({ id: String(r._id), nama: r.nama, alamat: r.alamat, noHp: r.noHp, domain: r.domain })));
  }),
);

app.post(
  "/api/branches",
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

app.delete(
  "/api/branches/:id",
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

app.post(
  "/api/users",
  asyncHandler(async (req, res) => {
    const created = await User.create(req.body);
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
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const payload = { ...req.body };
    if (!payload.password) delete payload.password;
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
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ username: user.username, menuAccess: user.menuAccess || [] });
  }),
);

app.put(
  "/api/access/:username",
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
        employeeName: r.employeeName,
        branchId: r.branchId ? String(r.branchId) : undefined,
        branchDomain: r.branchDomain,
        services: r.services,
        status: r.status,
        createdAt: r.createdAt,
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
    const payload = {
      bookingCode,
      antrian,
      customerName: req.body.customerName,
      phone: req.body.phone || "",
      employeeName: "",
      branchId: branch?._id,
      branchDomain: branch?.domain,
      services: req.body.services || [],
      status: "Menunggu",
      tgl_system: queueDate,
    };
    const created = await Booking.create(payload);
    res.status(201).json({
      id: String(created._id),
      bookingCode: created.bookingCode,
      antrian: created.antrian,
      customerName: created.customerName,
      phone: created.phone,
      employeeName: created.employeeName,
      branchId: created.branchId ? String(created.branchId) : undefined,
      branchDomain: created.branchDomain,
      services: created.services,
      status: created.status,
      createdAt: created.createdAt,
    });
  }),
);

app.patch(
  "/api/bookings/:id/assign",
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
  asyncHandler(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "ID tidak valid" });
    const updated = await Booking.findByIdAndUpdate(_id, { status: "Selesai" }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ id: String(updated._id), status: updated.status });
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingsToday = await Booking.find({ createdAt: { $gte: today }, status: "Selesai" }).lean();
    const pendapatanHariIni = bookingsToday.reduce(
      (sum, b) => sum + (b.services || []).reduce((acc, s) => acc + (s.harga || 0), 0),
      0,
    );

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
  asyncHandler(async (req, res) => {
    const match = {};
    if (req.query.from && req.query.to) {
      // Pastikan filter to tetap inklusif (<= to)
      match.tgl_system = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.tgl_system = { $gte: req.query.from };
    } else if (req.query.to) {
      match.tgl_system = { $lte: req.query.to };
    }
    const rows = await Booking.aggregate([
      { $match: { ...match, status: "Selesai" } },
      { $unwind: "$services" },
      {
        $group: {
          _id: "$services.kode",
          nama: { $first: "$services.nama" },
          jumlah: { $sum: 1 },
          total: { $sum: "$services.harga" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      rows.map((r) => ({
        kode: r._id,
        nama: r.nama,
        jumlah: r.jumlah,
        total: r.total,
      })),
    );
  }),
);

app.get(
  "/api/reports/employees",
  asyncHandler(async (req, res) => {
    const match = {};
    if (req.query.from && req.query.to) {
      match.tgl_system = { $gte: req.query.from, $lte: req.query.to };
    } else if (req.query.from) {
      match.tgl_system = { $gte: req.query.from };
    } else if (req.query.to) {
      match.tgl_system = { $lte: req.query.to };
    }
    match.status = "Selesai";

    const commission = (await CommissionSetting.findOne().lean()) || { tipe: "persentase", nilai: 15 };

    const rows = await Booking.aggregate([
      { $match: match },
      {
        $project: {
          employeeName: 1,
          totalBooking: {
            $sum: "$services.harga",
          },
        },
      },
      {
        $group: {
          _id: "$employeeName",
          layananSelesai: { $sum: 1 },
          totalRp: { $sum: "$totalBooking" },
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
      password: seedPassword,
      level: "Owner",
      menuAccess: [],
    });
  }

  app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`);
  });
};

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
