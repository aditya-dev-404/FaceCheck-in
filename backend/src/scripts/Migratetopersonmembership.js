// backend/scripts/migrateToPersonMembership.js
//
// One-time migration for the Option A refactor (User -> Person + Membership).
// Run manually, NOT part of app startup:
//   node scripts/migrateToPersonMembership.js
//
// Trick that keeps this safe: every new Person is created with the SAME _id
// as the old User document it came from. So FaceEmbedding/AttendanceRecord
// references don't need their VALUES touched — only the field NAME changes
// (user -> person), via $rename. No re-hashing, no re-capturing faces.
//
// Safety: nothing destructive happens to the original `users` collection.
// It's renamed to `users_backup_pre_migration` at the very end, only after
// counts are verified to match. Take a full mongodump before running this
// regardless.

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const users = await db.collection("users").find({}).toArray();
  console.log(`Found ${users.length} existing User documents.`);

  if (users.length === 0) {
    console.log("Nothing to migrate.");
    return mongoose.disconnect();
  }

  const persons = users.map((u) => ({
    _id: u._id, // <-- same _id as the old User, on purpose
    name: u.name,
    email: u.email,
    password: u.password, // already bcrypt-hashed, copied as-is
    avatarUrl: u.avatarUrl ?? null,
    avatarPublicId: u.avatarPublicId ?? null,
    refreshToken: u.refreshToken ?? null,
    resetPasswordToken: u.resetPasswordToken ?? null,
    resetPasswordExpires: u.resetPasswordExpires ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  const memberships = users.map((u) => ({
    person: u._id,
    organization: u.organization,
    role: u.role,
    category: u.category,
    isEnrolled: u.isEnrolled ?? false,
    isActive: u.isActive ?? true,
    isFlagged: u.isFlagged ?? false,
    flagReason: u.flagReason ?? null,
    flaggedAt: u.flaggedAt ?? null,
    flaggedImageUrl: u.flaggedImageUrl ?? null,
    flaggedImagePublicId: u.flaggedImagePublicId ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  // insertMany on the raw collection — no Mongoose middleware involved,
  // so the already-hashed password is inserted verbatim (no double-hash).
  await db.collection("persons").insertMany(persons);
  console.log(`Inserted ${persons.length} Person documents.`);

  await db.collection("memberships").insertMany(memberships);
  console.log(`Inserted ${memberships.length} Membership documents.`);

// Drop the old unique index on `user` before renaming — $rename would
// otherwise collide on duplicate null values as it processes docs one by one.
try {
  await db.collection("faceembeddings").dropIndex("user_1");
  console.log("Dropped old 'user_1' index on faceembeddings.");
} catch (err) {
  console.log("No 'user_1' index to drop (already gone) — continuing.");
}

  // Repoint FaceEmbedding.user -> FaceEmbedding.person (same value, new field name).
  const faceEmbeddingResult = await db
    .collection("faceembeddings")
    .updateMany({}, { $rename: { user: "person" } });
  console.log(
    `Renamed 'user' -> 'person' on ${faceEmbeddingResult.modifiedCount} FaceEmbedding documents.`
  );

  // Repoint AttendanceRecord.user -> AttendanceRecord.person (same value, new field name).
  const attendanceResult = await db
    .collection("attendancerecords")
    .updateMany({}, { $rename: { user: "person" } });
  console.log(
    `Renamed 'user' -> 'person' on ${attendanceResult.modifiedCount} AttendanceRecord documents.`
  );

  // Verify before touching the original collection.
  const personCount = await db.collection("persons").countDocuments();
  const membershipCount = await db.collection("memberships").countDocuments();

  if (personCount !== users.length || membershipCount !== users.length) {
    console.error(
      "COUNT MISMATCH — stopping before renaming users collection. " +
        `Expected ${users.length}, got persons=${personCount}, memberships=${membershipCount}.`
    );
    return mongoose.disconnect();
  }

  await db.collection("users").rename("users_backup_pre_migration");
  console.log(
    "Verified counts match. Renamed 'users' -> 'users_backup_pre_migration' (not deleted)."
  );

  await mongoose.disconnect();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});