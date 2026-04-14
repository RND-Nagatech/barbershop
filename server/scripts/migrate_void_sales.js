import "dotenv/config";
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI is required in environment variables");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const sales = db.collection("sales");

  console.log("Connected. Updating existing sales missing status -> Paid");
  const statusResult = await sales.updateMany(
    { $or: [{ status: { $exists: false } }, { status: "" }] },
    { $set: { status: "Paid" } },
  );
  console.log({ matched: statusResult.matchedCount, modified: statusResult.modifiedCount });

  console.log("Rebuilding indexes for voidable sales...");
  const indexes = await sales.indexes();
  const oldUnique = indexes.find((i) => i.key?.bookingId === 1 && i.unique);
  if (oldUnique?.name && oldUnique.name !== "_id_") {
    console.log(`Dropping old unique index: ${oldUnique.name}`);
    await sales.dropIndex(oldUnique.name);
  }

  console.log("Creating partial unique index on bookingId where status=Paid");
  await sales.createIndex(
    { bookingId: 1 },
    { unique: true, name: "bookingId_1_paid_unique", partialFilterExpression: { status: "Paid" } },
  );

  console.log("Ensuring indexes: paidYmd_1");
  await sales.createIndex({ paidYmd: 1 }, { name: "paidYmd_1" });

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

