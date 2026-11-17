/**
 * FaceCheck-in demo seeder  ->  backend/src/scripts/seedDemoData.js
 *
 * Run from the backend folder:   node src/scripts/seedDemoData.js
 * Settings come from backend/.env (no prompts).
 *
 * KEEPS: the organization (SEED_ORG_CODE), its admin(s) and the existing test user (SEED_USER_EMAIL), with their
 *        passwords and any real face embedding.
 * WIPES: every other person, membership, face embedding, and ALL attendance records.
 * SEEDS: SEED_MEMBER_COUNT new members (real-looking names, placeholder embeddings that never match at the kiosk)
 *        plus weekday attendance for them AND for the test user.
 * DATES: organization, admin and test user are back-dated so that
 *        organization < admin / members < first attendance record.
 */
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- load .env + models (works with default or named exports) ----------
try {
  const dotenv = await import("dotenv");
  (dotenv.default ?? dotenv).config({ path: path.resolve(here, "../../.env") });
} catch { /* dotenv not installed: rely on the shell environment */ }

const loadModel = async (file, name) => {
  const m = await import(pathToFileURL(path.join(here, "../models", file)).href);
  return m.default ?? m[name];
};
const Person = await loadModel("Person.model.js", "Person");
const Membership = await loadModel("Membership.model.js", "Membership");
const Organization = await loadModel("Organization.model.js", "Organization");
const FaceEmbedding = await loadModel("FaceEmbedding.model.js", "FaceEmbedding");
const AttendanceRecord = await loadModel("AttendanceRecord.model.js", "AttendanceRecord");

// ---------- helpers ----------
const env = (k, def) => (process.env[k] !== undefined && process.env[k] !== "" ? process.env[k] : def);
const need = (keys) => {
  const missing = keys.filter((k) => !env(k));
  if (missing.length) throw new Error(`Missing in .env: ${missing.join(", ")}`);
};
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const DAY = 86400000;

const FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Kabir", "Dhruv", "Karan", "Rahul", "Siddharth", "Pranav", "Harsh", "Yash", "Aman", "Nikhil", "Ankit", "Manish", "Varun", "Tanmay", "Shivam", "Priya", "Ananya", "Diya", "Aadhya", "Saanvi", "Kavya", "Riya", "Neha", "Pooja", "Sneha", "Isha", "Tanvi", "Meera", "Shreya", "Aisha", "Nandini", "Simran", "Anjali", "Divya", "Kritika", "Muskan", "Palak", "Ritika", "Shruti", "Vaishnavi"];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Yadav", "Mishra", "Tiwari", "Pandey", "Agarwal", "Jain", "Chauhan", "Rastogi", "Saxena", "Srivastava", "Bansal", "Mehta", "Kapoor", "Malhotra", "Bhatia", "Joshi", "Rawat", "Negi", "Thakur", "Rathore", "Chaudhary", "Dubey", "Shukla", "Tripathi", "Goel", "Arora", "Khanna", "Sinha", "Nair", "Reddy", "Iyer", "Das", "Bose", "Patel", "Shah"];

function makeNames(n) {
  const used = new Set(), out = [];
  while (out.length < n) {
    const f = pick(FIRST), l = pick(LAST), key = `${f} ${l}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ name: key, email: `${f}.${l}${randInt(1, 99)}@example.com`.toLowerCase() });
  }
  return out;
}
function randomEmbedding() {
  const v = Array.from({ length: 512 }, randn);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// same output format as computeLateBy in attendance.service.js ("12m late", "1h 5m late")
const lateText = (mins) => (mins < 60 ? `${mins}m late` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""} late`);
async function setTimestamps(Model, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    await Model.collection.bulkWrite(
      rows.slice(i, i + 1000).map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { createdAt: r.createdAt, updatedAt: r.updatedAt } } } })),
      { ordered: false }
    );
  }
}

// ---------- main ----------
try {
  need(["SEED_ORG_CODE", "SEED_USER_EMAIL"]);
  const uri = env("MONGODB_URI") || env("MONGO_URI") || env("DATABASE_URL");
  if (!uri) throw new Error("Missing in .env: MONGODB_URI (or MONGO_URI / DATABASE_URL)");
  if (env("SEED_CONFIRM_WIPE") !== "YES") throw new Error("Set SEED_CONFIRM_WIPE=YES in .env to allow wiping persons, memberships, embeddings and attendance.");

  await mongoose.connect(uri);
  console.log(`Connected to database "${mongoose.connection.name}"\n`);

  // ----- existing organization, admin(s), test user -----
  const org = await Organization.findOne({ code: env("SEED_ORG_CODE").toUpperCase() });
  if (!org) throw new Error(`Organization ${env("SEED_ORG_CODE")} not found. Create it first (register through the app).`);

  const userEmail = env("SEED_USER_EMAIL").toLowerCase();
  const userPerson = await Person.findOne({ email: userEmail });
  if (!userPerson) throw new Error(`Test user ${userEmail} not found.`);
  const userMem = await Membership.findOne({ person: userPerson._id, organization: org._id, status: "active" });
  if (!userMem) throw new Error(`${userEmail} has no active membership in ${org.code}.`);
  if (userMem.role !== "member") throw new Error(`${userEmail} must have role "member" to have attendance (found "${userMem.role}").`);

  const adminFilter = { organization: org._id, role: "admin", status: "active" };
  const adminMems = await Membership.find(adminFilter);
  if (env("SEED_ADMIN_EMAIL")) {
    const ap = await Person.findOne({ email: env("SEED_ADMIN_EMAIL").toLowerCase() });
    if (!ap || !adminMems.some((m) => String(m.person) === String(ap._id))) throw new Error(`SEED_ADMIN_EMAIL is not an active admin of ${org.code}.`);
  }
  if (!adminMems.length) throw new Error(`${org.code} has no active admin.`);
  const keepIds = [userPerson._id, ...adminMems.map((m) => m.person)];
  console.log(`Organization "${org.name}" (${org.code}); keeping ${adminMems.length} admin(s) and test user ${userEmail}.`);

  // ----- settings -----
  const userAttendance = clamp(parseFloat(env("SEED_USER_ATTENDANCE", "0.88")), 0.05, 1);
  const userLateRate = clamp(parseFloat(env("SEED_USER_LATE_RATE", "0.12")), 0, 1); // share of his attended days that are late
  const sharedPassword = env("SEED_MEMBER_PASSWORD", "");
  const memberCount = parseInt(env("SEED_MEMBER_COUNT", "30"), 10);
  const days = parseInt(env("SEED_DAYS", "90"), 10);
  const defaultGrace = parseInt(env("SEED_GRACE_MINUTES", "10"), 10);

  // categories = the org's existing ones + anything listed in SEED_CATEGORIES (added to the org if missing)
  const wanted = env("SEED_CATEGORIES", "").split(",").map((x) => x.trim()).filter(Boolean);
  let categories = [...new Set([...(org.categories || []), ...wanted])];
  if (!categories.length) categories = ["Student", "Teacher"];
  if (!categories.includes(userMem.category)) categories = [userMem.category, ...categories];
  await Organization.updateOne({ _id: org._id }, { $set: { categories } });
  console.log(`Categories: ${categories.join(", ")}`);

  // ----- wipe everything except the kept people -----
  const keepEmbeddingOwners = keepIds;
  await AttendanceRecord.deleteMany({});
  await FaceEmbedding.deleteMany({ person: { $nin: keepEmbeddingOwners } });
  await Membership.deleteMany({ person: { $nin: keepIds } });
  await Person.deleteMany({ _id: { $nin: keepIds } });
  console.log("Old data wiped (organization, admin(s) and test user kept).");

  // ----- timeline (back-date the kept documents) -----
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today.getTime() - days * DAY);
  const orgCreatedAt = new Date(Math.min(new Date(org.createdAt || Date.now()).getTime(), windowStart.getTime() - 14 * DAY));
  const orgUpdatedAt = new Date(Math.max(new Date(org.updatedAt || 0).getTime(), orgCreatedAt.getTime() + DAY));
  await Organization.collection.updateOne({ _id: org._id }, { $set: { createdAt: orgCreatedAt, updatedAt: orgUpdatedAt } });

  const adminCreatedAt = new Date(orgCreatedAt.getTime() + 3600000);
  await setTimestamps(Person, adminMems.map((m) => ({ _id: m.person, createdAt: adminCreatedAt, updatedAt: adminCreatedAt })));
  await setTimestamps(Membership, adminMems.map((m) => ({ _id: m._id, createdAt: adminCreatedAt, updatedAt: adminCreatedAt })));

  const baseTimes = [540, 570, 510, 600]; // 09:00, 09:30, 08:30, 10:00 (minutes after midnight)
  const minJoin = Math.max(orgCreatedAt.getTime() + DAY, windowStart.getTime() - 14 * DAY);
  const maxJoin = windowStart.getTime() + 0.35 * days * DAY; // ~30% of members join during the window

  // ----- test user: make sure schedule + embedding exist, back-date, then profile -----
  const userCatIndex = Math.max(0, categories.indexOf(userMem.category));
  let userCheckIn = baseTimes[userCatIndex % baseTimes.length];
  if (userMem.checkInTime && /^\d{2}:\d{2}$/.test(userMem.checkInTime)) {
    const [h, m] = userMem.checkInTime.split(":").map(Number); userCheckIn = h * 60 + m;
  } else userMem.checkInTime = hhmm(userCheckIn);
  const userGrace = Number.isFinite(userMem.gracePeriodMinutes) ? userMem.gracePeriodMinutes : defaultGrace;
  userMem.gracePeriodMinutes = userGrace;
  await userMem.save();
  if (!(await FaceEmbedding.exists({ person: userPerson._id, organization: org._id }))) {
    await FaceEmbedding.create({ person: userPerson._id, organization: org._id, embedding: randomEmbedding() });
    await Membership.updateOne({ _id: userMem._id }, { $set: { isEnrolled: true } });
  }
  const userJoined = new Date(minJoin + 3600000);
  await setTimestamps(Person, [{ _id: userPerson._id, createdAt: userJoined, updatedAt: userJoined }]);
  await setTimestamps(Membership, [{ _id: userMem._id, createdAt: userJoined, updatedAt: userJoined }]);

  // ----- new members -----
  const taken = new Set([userEmail, ...(await Person.find({ _id: { $in: keepIds } }, "email")).map((p) => p.email)]);
  const others = makeNames(memberCount + 10).filter((p) => !taken.has(p.email)).slice(0, memberCount);
  const newProfiles = others.map((p) => {
    const r = Math.random();
    const propensity = r < 0.12 ? rand(0.35, 0.6) : r < 0.3 ? rand(0.6, 0.75) : r < 0.75 ? rand(0.75, 0.9) : rand(0.9, 0.99);
    const lr = Math.random();
    const lateRate = lr < 0.7 ? rand(0.02, 0.12) : lr < 0.88 ? rand(0.15, 0.35) : rand(0.4, 0.65); // mostly punctual, some often late, a few chronic
    const catIndex = randInt(0, categories.length - 1);
    const joinedAt = new Date(rand(minJoin, maxJoin)); joinedAt.setHours(randInt(9, 17), randInt(0, 59), 0, 0);
    return { ...p, propensity, category: categories[catIndex], checkIn: baseTimes[catIndex % baseTimes.length], grace: defaultGrace, lateRate, joinedAt };
  });
  const newPersons = [];
  for (const p of newProfiles) newPersons.push(await Person.create({ name: p.name, email: p.email, password: sharedPassword || null })); // hook hashes non-null passwords
  const newMems = await Membership.insertMany(newPersons.map((per, i) => ({
    person: per._id, organization: org._id, role: "member", category: newProfiles[i].category,
    checkInTime: hhmm(newProfiles[i].checkIn), gracePeriodMinutes: defaultGrace,
    status: "active", isActive: true, isEnrolled: true, isFlagged: false,
  })));
  const newEmb = await FaceEmbedding.insertMany(newPersons.map((per) => ({ person: per._id, organization: org._id, embedding: randomEmbedding() })));
  await setTimestamps(Person, newPersons.map((per, i) => ({ _id: per._id, createdAt: newProfiles[i].joinedAt, updatedAt: newProfiles[i].joinedAt })));
  await setTimestamps(Membership, newMems.map((m, i) => ({ _id: m._id, createdAt: newProfiles[i].joinedAt, updatedAt: newProfiles[i].joinedAt })));
  await setTimestamps(FaceEmbedding, newEmb.map((f, i) => {
    const t = new Date(newProfiles[i].joinedAt.getTime() + 600000);
    return { _id: f._id, createdAt: t, updatedAt: t };
  }));

  // ----- attendance: test user first, then new members -----
  const actors = [
    { person: userPerson, p: { name: userPerson.name, email: userPerson.email, propensity: userAttendance, category: userMem.category, checkIn: userCheckIn, grace: userGrace, lateRate: userLateRate, joinedAt: userJoined } },
    ...newPersons.map((per, i) => ({ person: per, p: newProfiles[i] })),
  ];
  const records = [];
  actors.forEach(({ person: per, p }) => {
    const firstDay = new Date(p.joinedAt); firstDay.setHours(0, 0, 0, 0); firstDay.setDate(firstDay.getDate() + 1);
    for (let t = Math.max(firstDay.getTime(), windowStart.getTime()); t < today.getTime(); t += DAY) {
      const day = new Date(t);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      if (Math.random() > p.propensity) continue;
      // late day: grace + 1..~60 min (skewed to small values); on-time day: 25 min early up to just inside the grace period
      const isLate = Math.random() < p.lateRate;
      const arrival = clamp(isLate ? p.checkIn + p.grace + 1 + Math.min(80, Math.round(-Math.log(1 - Math.random()) * 14)) : p.checkIn + Math.round(rand(-25, p.grace - 1)), 420, 840);
      const markedAt = new Date(day); markedAt.setHours(0, 0, randInt(0, 59), 0); markedAt.setMinutes(arrival);
      const lateMins = arrival - (p.checkIn + p.grace);
      const flagged = Math.random() < 0.04;
      records.push({
        person: per._id, organization: org._id,
        matchScore: +(flagged ? rand(0.41, 0.5) : clamp(0.64 + randn() * 0.07, 0.51, 0.93)).toFixed(4),
        category: p.category, memberName: p.name, memberEmail: p.email,
        isFlagged: flagged, lateBy: lateMins > 0 ? lateText(lateMins) : null,
        markedVia: Math.random() < 0.94 ? "kiosk" : "admin", markedAt,
      });
    }
  });
  const inserted = [];
  for (let i = 0; i < records.length; i += 1000) inserted.push(...(await AttendanceRecord.insertMany(records.slice(i, i + 1000))));
  await setTimestamps(AttendanceRecord, inserted.map((r) => ({ _id: r._id, createdAt: r.markedAt, updatedAt: r.markedAt })));

  const countBy = (id) => records.filter((r) => String(r.person) === String(id));
  if (!countBy(userPerson._id).length) throw new Error("No attendance generated for the test user (check SEED_DAYS and SEED_USER_ATTENDANCE).");
  console.log("\nAttendance per person:");
  actors.forEach(({ person: per, p }) => {
    const rs = countBy(per._id);
    console.log(`  ${p.name.padEnd(24)} ${String(rs.length).padStart(3)} days  late ${String(rs.filter((r) => r.lateBy).length).padStart(2)}${String(per._id) === String(userPerson._id) ? "   <- test user" : ""}`);
  });

  const first = records.reduce((m, r) => (r.markedAt < m ? r.markedAt : m), records[0].markedAt);
  const mine = records.filter((r) => String(r.person) === String(userPerson._id));
  console.log("\nDone.");
  console.log(`  Organization : ${org.name} (${org.code})  created ${orgCreatedAt.toDateString()}`);
  console.log(`  Test user    : ${userEmail}  (${mine.length} attendance records, ${mine.filter((r) => r.lateBy).length} late)`);
  console.log(`  New members  : ${newPersons.length}`);
  console.log(`  Attendance   : ${records.length} records in total, first on ${first.toDateString()}`);
  console.log(`  Late records : ${records.filter((r) => r.lateBy).length}, flagged: ${records.filter((r) => r.isFlagged).length}`);
} catch (err) {
  console.error("Seeding failed:", err.message || err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}