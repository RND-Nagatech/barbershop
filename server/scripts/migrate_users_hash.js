import "dotenv/config";
import mongoose from "mongoose";
import crypto from "crypto";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI is required in environment variables");
  process.exit(1);
}

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384$r=8$p=1$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
};

const run = async () => {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const users = db.collection("users");

  const cursor = users.find({ password: { $type: "string", $not: /^\s*scrypt\$/ } });
  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    scanned += 1;
    const plain = String(user.password || "");
    if (!plain) continue;
    await users.updateOne({ _id: user._id }, { $set: { password: hashPassword(plain) } });
    updated += 1;
  }

  console.log({ scanned, updated });
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

