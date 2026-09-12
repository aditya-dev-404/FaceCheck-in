import "dotenv/config";
import mongoose from "mongoose";
import { Organization } from "../models/Organization.model.js";
import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { FaceEmbedding } from "../models/FaceEmbedding.model.js";
import { AttendanceRecord } from "../models/AttendanceRecord.model.js";

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

function computeLateBy(markedAt, checkInTime, gracePeriodMinutes) {
  if (!checkInTime) return null;

  const [hours, minutes] = checkInTime.split(":").map(Number);
  const threshold = new Date(markedAt);
  threshold.setHours(hours, minutes + (gracePeriodMinutes || 0), 0, 0);

  const diffMs = markedAt - threshold;
  if (diffMs <= 0) return null;

  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m late`;
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  return m > 0 ? `${h}h ${m}m late` : `${h}h late`;
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

  const members = []; // each entry: { person, membership }

  for (const category of categories) {
    for (let i = 1; i <= MEMBERS_PER_CATEGORY; i++) {
      const name = `${category} Seed Member ${i}`;
      const email = `seed.${category.toLowerCase().replace(/\s+/g, "")}.${i}@facecheckin.test`;

      let person = await Person.findOne({ email });
      if (!person) {
        person = await Person.create({
          name,
          email,
          password: SEED_PASSWORD, // pre-save hook hashes it once
        });
      }

      let membership = await Membership.findOne({ person: person._id, organization: org._id });
      if (!membership) {
        // Fixed check-in time of 09:00 with a 10-minute grace period for
        // every seeded member, so late-entry data has something realistic
        // to compare against.
        membership = await Membership.create({
          person: person._id,
          organization: org._id,
          role: "member",
          category,
          status: "active",
          isEnrolled: true,
          isActive: true,
          checkInTime: "09:00",
          gracePeriodMinutes: 10,
        });

        await FaceEmbedding.create({
          person: person._id,
          organization: org._id,
          embedding: randomEmbedding(),
        });
      }

      members.push({ person, membership });
    }
  }

  console.log(`Seeded/found ${members.length} members across ${categories.length} categories.`);

  const today = new Date();
  const records = [];

  for (const { person, membership } of members) {
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

      const lateBy = computeLateBy(markedAt, membership.checkInTime, membership.gracePeriodMinutes);

      records.push({
        person: person._id,
        organization: org._id,
        matchScore: Number(matchScore.toFixed(4)),
        category: membership.category,
        memberName: person.name,
        memberEmail: person.email,
        isFlagged,
        lateBy,
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