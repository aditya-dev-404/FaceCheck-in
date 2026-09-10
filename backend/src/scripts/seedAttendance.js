import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Organization } from "../models/organization.model.js";
import { User } from "../models/user.model.js";
import { FaceEmbedding } from "../models/faceEmbedding.model.js";
import { AttendanceRecord } from "../models/attendanceRecord.model.js";

const MEMBERS_PER_CATEGORY = 5;
const DAYS_BACK = 90;
const SEED_PASSWORD = "Seed@12345";

function randomEmbedding() {
  const vec = Array.from({ length: 512 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

async function run() {
  const orgCode = process.argv[2];
  if (!orgCode) {
    console.error("Usage: node scripts/seedAttendance.js <orgCode>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const org = await Organization.findOne({ code: orgCode });
  if (!org) {
    console.error(`No organization found with code ${orgCode}`);
    process.exit(1);
  }

  const categories = org.categories?.length ? org.categories : ["General"];
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const members = [];
  for (const category of categories) {
    for (let i = 1; i <= MEMBERS_PER_CATEGORY; i++) {
      const name = `${category} Seed Member ${i}`;
      const email = `seed.${category.toLowerCase().replace(/\s+/g, "")}.${i}@facecheckin.test`;

      const existing = await User.findOne({ email, organization: org._id });
      if (existing) {
        members.push(existing);
        continue;
      }

      const user = await User.create({
        organization: org._id,
        name,
        email,
        password: passwordHash,
        role: "member",
        category,
        isEnrolled: true,
        isActive: true,
      });

      await FaceEmbedding.create({
        user: user._id,
        organization: org._id,
        embedding: randomEmbedding(),
      });

      members.push(user);
    }
  }

  console.log(`Seeded/found ${members.length} members across ${categories.length} categories.`);

  const today = new Date();
  const records = [];

  for (const member of members) {
    // each member gets their own baseline attendance rate, 80-97%, so the
    // dashboard shows real variance instead of a flat line
    const baseRate = 0.80 + Math.random() * 0.17;

    for (let d = DAYS_BACK; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      if (!isWeekday(date)) continue;

      if (Math.random() > baseRate) continue; // absent that day

      const markedAt = new Date(date);
      markedAt.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

      const isFlagged = Math.random() < 0.03; // ~3% flagged, matches real threshold behavior
      const matchScore = isFlagged
        ? 0.40 + Math.random() * 0.10 // between MATCH_THRESHOLD and FLAG_THRESHOLD
        : 0.60 + Math.random() * 0.35;

      records.push({
        user: member._id,
        organization: org._id,
        matchScore: Number(matchScore.toFixed(4)),
        category: member.category,
        memberName: member.name,
        memberEmail: member.email,
        isFlagged,
        markedVia: "kiosk",
        markedAt,
      });
    }
  }

  await AttendanceRecord.insertMany(records);
  console.log(`Inserted ${records.length} attendance records over ${DAYS_BACK} days.`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});