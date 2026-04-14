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

const run = async () => {
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const bookings = db.collection("bookings");
  const queueCounters = db.collection("queuecounters");

  console.log("Connected. Checking existing indexes...");
  const bookingIndexes = await bookings.indexes();
  const bookingCodeIndex = bookingIndexes.find((idx) => idx.key?.bookingCode === 1);
  if (bookingCodeIndex?.name && bookingCodeIndex.name !== "_id_") {
    console.log(`Dropping old index: ${bookingCodeIndex.name}`);
    await bookings.dropIndex(bookingCodeIndex.name);
  }

  console.log("Ensuring new booking index (unique): { tgl_system: 1, bookingCode: 1 }");
  await bookings.createIndex(
    { tgl_system: 1, bookingCode: 1 },
    { unique: true, name: "tgl_system_1_bookingCode_1" },
  );

  console.log("Ensuring queue counter index (unique): { date: 1 }");
  await queueCounters.createIndex({ date: 1 }, { unique: true, name: "date_1" });

  // Optional: warm up today's counter doc so preview works immediately.
  const today = formatJakartaYmd();
  await queueCounters.updateOne({ date: today }, { $setOnInsert: { date: today, seq: 0 } }, { upsert: true });

  console.log("Migration done.");
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

