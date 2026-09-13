import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { AttendanceRecord } from "../models/AttendanceRecord.model.js";

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function workingDaysBetween(from, to) {
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isWeekday(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count || 1; // avoid divide-by-zero
}

function defaultRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Parses lateBy strings like "12m late" / "1h 5m late" into total minutes. Returns 0 for null/on-time.
function parseLateMinutes(lateBy) {
  if (!lateBy) return 0;
  const hMatch = lateBy.match(/(\d+)h/);
  const mMatch = lateBy.match(/(\d+)m/);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  return hours * 60 + minutes;
}

export async function getOrganizationAnalytics(organizationId, query) {
  const { from, to } = defaultRange(query);
  const workingDays = workingDaysBetween(from, to);

  const [memberMemberships, dailyTrend, flaggedTrend, categoryCounts] = await Promise.all([
    Membership.find({ organization: organizationId, role: "member", status: "active", isEnrolled: true })
      .populate("person", "name")
      .select("person category"),
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$markedAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$markedAt" } },
          total: { $sum: 1 },
          flagged: { $sum: { $cond: ["$isFlagged", 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  // Membership -> flat {personId, name, category}, dropping any orphaned membership with no linked Person.
  const members = memberMemberships
    .filter((m) => m.person)
    .map((m) => ({ personId: m.person._id, name: m.person.name, category: m.category }));

  const totalEnrolled = members.length || 1;

  const dailyTrendWithRate = dailyTrend.map((d) => ({
    date: d._id,
    present: d.count,
    rate: Number((d.count / totalEnrolled).toFixed(3)),
  }));

  const flaggedTrendFormatted = flaggedTrend.map((d) => ({
    date: d._id,
    total: d.total,
    flagged: d.flagged,
    rate: Number((d.flagged / d.total).toFixed(3)),
  }));

  const categoryMemberCounts = {};
  for (const m of members) {
    categoryMemberCounts[m.category] = (categoryMemberCounts[m.category] || 0) + 1;
  }
  const byCategory = categoryCounts.map((c) => {
    const memberCount = categoryMemberCounts[c._id] || 1;
    return {
      category: c._id,
      avgRate: Number((c.count / (memberCount * workingDays)).toFixed(3)),
    };
  });

  const perUserCounts = await AttendanceRecord.aggregate([
    { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$person", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(perUserCounts.map((r) => [String(r._id), r.count]));

  const leaderboard = members
    .map((m) => ({
      userId: m.personId,
      name: m.name,
      category: m.category,
      rate: Number(((countMap.get(String(m.personId)) || 0) / workingDays).toFixed(3)),
    }))
    .sort((a, b) => b.rate - a.rate);

  const topPerformers = leaderboard.slice(0, 5);
  const bottomPerformers = leaderboard.slice(-5).reverse();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const [todayRecords, totalFlagsThisMonth, totalRecordsInRange, allMembershipsForToday] = await Promise.all([
    AttendanceRecord.find({ organization: organizationId, markedAt: { $gte: todayStart } }).select("person"),
    AttendanceRecord.countDocuments({ organization: organizationId, isFlagged: true, markedAt: { $gte: monthStart } }),
    AttendanceRecord.countDocuments({ organization: organizationId, markedAt: { $gte: from, $lte: to } }),
    Membership.find({ organization: organizationId, status: "active", isEnrolled: true })
      .populate("person", "name")
      .select("person category"),
  ]);

  const checkedInTodayIds = new Set(todayRecords.map((r) => String(r.person)));
  const todayStatus = allMembershipsForToday
    .filter((m) => m.person)
    .map((m) => ({
      userId: m.person._id,
      name: m.person.name,
      category: m.category,
      checkedIn: checkedInTodayIds.has(String(m.person._id)),
    }));

  // Late-entry stats (lateBy is null for on-time / no checkInTime assigned).
  const [lateTrendRaw, lateCategoryCounts, lateRecords] = await Promise.all([
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$markedAt" } },
          total: { $sum: 1 },
          late: { $sum: { $cond: [{ $ne: ["$lateBy", null] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to }, lateBy: { $ne: null } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    AttendanceRecord.find({
      organization: organizationId,
      markedAt: { $gte: from, $lte: to },
      lateBy: { $ne: null },
    }).select("lateBy"),
  ]);

  const lateTrend = lateTrendRaw.map((d) => ({
    date: d._id,
    total: d.total,
    late: d.late,
    rate: Number((d.late / d.total).toFixed(3)),
  }));

  const lateCategoryMap = new Map(lateCategoryCounts.map((c) => [c._id, c.count]));
  const totalCategoryMap = new Map(categoryCounts.map((c) => [c._id, c.count]));
  const lateByCategory = [...totalCategoryMap.keys()].map((category) => {
    const total = totalCategoryMap.get(category) || 1;
    const late = lateCategoryMap.get(category) || 0;
    return { category, lateRate: Number((late / total).toFixed(3)) };
  });

  const totalLateInRange = lateRecords.length;
  const overallLateRate = totalRecordsInRange ? Number((totalLateInRange / totalRecordsInRange).toFixed(3)) : 0;
  const avgLateMinutes = totalLateInRange
    ? Math.round(lateRecords.reduce((sum, r) => sum + parseLateMinutes(r.lateBy), 0) / totalLateInRange)
    : 0;

  return {
    range: { from, to },
    summary: {
      totalMembers: members.length,
      avgAttendanceRate: Number((totalRecordsInRange / (totalEnrolled * workingDays)).toFixed(3)),
      todayCheckins: checkedInTodayIds.size,
      totalFlagsThisMonth,
      lateRate: overallLateRate,
    },
    dailyTrend: dailyTrendWithRate,
    flaggedTrend: flaggedTrendFormatted,
    byCategory,
    allMembers: leaderboard,
    todayStatus,
    topPerformers,
    bottomPerformers,
    lateStats: { overallLateRate, avgLateMinutes },
    lateTrend,
    lateByCategory,
  };
}

export async function getMemberAnalytics(personId, organizationId, query) {
  const { from, to } = defaultRange(query);
  const workingDays = workingDaysBetween(from, to);

  const [me, myMembership] = await Promise.all([
    Person.findById(personId).select("name"),
    Membership.findOne({ person: personId, organization: organizationId }).select("category"),
  ]);

  const records = await AttendanceRecord.find({
    person: personId,
    organization: organizationId,
    markedAt: { $gte: from, $lte: to },
  }).select("markedAt lateBy");

  const weekBuckets = {};
  for (const r of records) {
    const key = isoWeekKey(r.markedAt);
    weekBuckets[key] = (weekBuckets[key] || 0) + 1;
  }
  const weeklyTrend = Object.entries(weekBuckets)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([week, count]) => ({ week, present: count }));

  const myRate = Number((records.length / workingDays).toFixed(3));

  const categoryMemberships = await Membership.find({
    organization: organizationId,
    role: "member",
    status: "active",
    isEnrolled: true,
    category: myMembership?.category,
  }).select("person");

  const categoryUserIds = categoryMemberships.map((m) => m.person);
  const categoryCounts = await AttendanceRecord.aggregate([
    {
      $match: {
        organization: organizationId,
        person: { $in: categoryUserIds },
        markedAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: "$person", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(categoryCounts.map((r) => [String(r._id), r.count]));
  const categoryRates = categoryUserIds.map((id) => (countMap.get(String(id)) || 0) / workingDays);
  const categoryAvgRate = Number(
    (categoryRates.reduce((s, r) => s + r, 0) / (categoryRates.length || 1)).toFixed(3)
  );

  const sortedDesc = [...categoryRates].sort((a, b) => b - a);
  const myRank = sortedDesc.findIndex((r) => r <= myRate) + 1;

  const lateRecords = records.filter((r) => r.lateBy);
  const myLateRate = Number((lateRecords.length / (records.length || 1)).toFixed(3));
  const myAvgLateMinutes = lateRecords.length
    ? Math.round(lateRecords.reduce((sum, r) => sum + parseLateMinutes(r.lateBy), 0) / lateRecords.length)
    : 0;

  return {
    range: { from, to },
    name: me?.name,
    myRate,
    categoryAvgRate,
    rank: myRank || categoryUserIds.length,
    totalInCategory: categoryUserIds.length,
    weeklyTrend,
    lateRate: myLateRate,
    avgLateMinutes: myAvgLateMinutes,
  };
}