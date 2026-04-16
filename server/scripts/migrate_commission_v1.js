import "dotenv/config";
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required");

const saleSchema = new mongoose.Schema(
  {
    employeeName: { type: String, default: "" },
    total: { type: Number, default: 0 },
    status: { type: String, default: "Paid" },
    commissionType: { type: String },
    commissionValue: { type: Number },
    commissionEarned: { type: Number },
  },
  { strict: false, timestamps: true },
);
const commissionSettingSchema = new mongoose.Schema(
  { tipe: String, nilai: Number },
  { strict: false, timestamps: true },
);

const Sale = mongoose.model("Sale", saleSchema);
const CommissionSetting = mongoose.model("CommissionSetting", commissionSettingSchema);

const computeCommissionEarned = ({ total, setting }) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const tipe = setting?.tipe;
  const nilai = Number(setting?.nilai || 0);
  if (tipe === "rupiah") return Math.max(0, Math.round(nilai));
  return Math.max(0, Math.round((safeTotal * Math.max(0, nilai)) / 100));
};

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected. Backfilling commissionEarned...");

  const setting = (await CommissionSetting.findOne().lean()) || { tipe: "persentase", nilai: 15 };
  const cursor = Sale.find({
    status: "Paid",
    employeeName: { $exists: true, $ne: "" },
    $or: [{ commissionEarned: { $exists: false } }, { commissionEarned: null }],
  })
    .select("_id total employeeName")
    .cursor();

  const ops = [];
  let count = 0;
  for await (const s of cursor) {
    const commissionEarned = computeCommissionEarned({ total: s.total, setting });
    ops.push({
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: {
            commissionType: setting.tipe,
            commissionValue: Number(setting.nilai || 0),
            commissionEarned,
          },
        },
      },
    });
    if (ops.length >= 500) {
      await Sale.bulkWrite(ops, { ordered: false });
      count += ops.length;
      ops.length = 0;
      process.stdout.write(`\rUpdated ${count} sales...`);
    }
  }
  if (ops.length) {
    await Sale.bulkWrite(ops, { ordered: false });
    count += ops.length;
  }
  console.log(`\nDone. Updated ${count} sales.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

