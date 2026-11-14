import "dotenv/config";
import mongoose from "mongoose";
import { Membership } from "../models/Membership.model.js";
import { FaceEmbedding } from "../models/FaceEmbedding.model.js";

// One-off: before the "one active organization per person" rule, a person
// could hold several active memberships. For anyone who still does, keep one
// (an admin membership if they have one, otherwise the most recently
// updated) and turn the rest into "past" memberships. Then build the unique
// index that enforces the rule from now on.
//
// Run from the backend folder:  node src/scripts/enforceSingleActive.js

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const active = await Membership.find({ status: "active" }).sort({ updatedAt: -1 });

  const byPerson = new Map();
  for (const m of active) {
    const key = String(m.person);
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key).push(m);
  }

  let fixed = 0;
  for (const [personId, memberships] of byPerson) {
    if (memberships.length < 2) continue;

    const keep = memberships.find((m) => m.role === "admin") || memberships[0];
    const adminCount = memberships.filter((m) => m.role === "admin").length;
    if (adminCount > 1) {
      console.warn(`Person ${personId} is an admin of ${adminCount} organizations — only one is kept active, review manually.`);
    }

    for (const m of memberships) {
      if (m._id.equals(keep._id)) continue;

      await FaceEmbedding.deleteOne({ person: m.person, organization: m.organization });
      m.status = "past";
      m.leftAt = new Date();
      m.leftReason = "switched";
      m.isEnrolled = false;
      await m.save();
      fixed++;
      console.log(`Person ${personId}: membership ${m._id} (org ${m.organization}) -> past; kept ${keep._id}`);
    }
  }

  console.log(`Done. Turned ${fixed} extra active membership(s) into past.`);

  await Membership.syncIndexes();
  console.log("Membership indexes synced.");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});