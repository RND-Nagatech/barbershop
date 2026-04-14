import "dotenv/config";
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI is required in environment variables");
  process.exit(1);
}

const formatJakartaYmd = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const sumTotal = (services) => (services || []).reduce((sum, s) => sum + (Number(s?.harga) || 0), 0);

const run = async () => {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const bookings = db.collection("bookings");
  const sales = db.collection("sales");
  const customers = db.collection("customers");

  console.log("Connected. Ensuring indexes...");

  console.log("Normalizing existing customers with empty phone -> null");
  await customers.updateMany({ phone: "" }, { $set: { phone: null } });

  await customers.createIndex(
    { phone: 1 },
    {
      unique: true,
      name: "phone_1_unique_nonempty",
      partialFilterExpression: { phone: { $type: "string" } },
    },
  );
  await sales.createIndex({ bookingId: 1 }, { unique: true, name: "bookingId_1" });
  await sales.createIndex({ paidYmd: 1 }, { name: "paidYmd_1" });
  await bookings.createIndex(
    { tgl_system: 1, bookingCode: 1 },
    { unique: true, name: "tgl_system_1_bookingCode_1" },
  );

  console.log("Migrating existing bookings (status=Selesai) -> Paid + Sale snapshot...");
  const cursor = bookings.find({ status: "Selesai", $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: "" }] });

  let scanned = 0;
  let updated = 0;
  let saleCreated = 0;
  let skippedSale = 0;

  while (await cursor.hasNext()) {
    const b = await cursor.next();
    scanned += 1;

    const paidAt = b.updatedAt ? new Date(b.updatedAt) : new Date();
    const paidYmd = formatJakartaYmd(paidAt);

    const phone = typeof b.phone === "string" ? b.phone : "";
    let customerId = b.customerId;
    if (!customerId && phone) {
      const customer = await customers.findOneAndUpdate(
        { phone },
        { $setOnInsert: { phone, name: b.customerName || "" } },
        { upsert: true, returnDocument: "after" },
      );
      customerId = customer?.value?._id;
    }

    await bookings.updateOne(
      { _id: b._id },
      { $set: { paymentStatus: "Paid", paidAt, paidYmd, ...(customerId ? { customerId } : {}) } },
    );
    updated += 1;

    const total = sumTotal(b.services);
    const saleDoc = {
      bookingId: b._id,
      bookingCode: b.bookingCode || "",
      employeeName: b.employeeName || "",
      customerId,
      items: (b.services || []).map((s) => ({
        type: "service",
        kode: s.kode,
        nama: s.nama,
        harga: Number(s.harga) || 0,
        qty: 1,
      })),
      total,
      method: "Legacy",
      received: total,
      change: 0,
      paidAt,
      paidYmd,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await sales.insertOne(saleDoc);
      saleCreated += 1;
    } catch (err) {
      if (err?.code === 11000) {
        skippedSale += 1;
        continue;
      }
      throw err;
    }
  }

  console.log({ scanned, updated, saleCreated, skippedSale });
  console.log("Done.");
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error("Migration failed:", err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
