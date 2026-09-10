import { User } from "../models/User.model.js";
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

export async function getOrganizationAnalytics(organizationId, query) {
  const { from, to } = defaultRange(query);
  const workingDays = workingDaysBetween(from, to);

  const [members, dailyTrend, flaggedTrend, categoryCounts] = await Promise.all([
    User.find({ organization: organizationId, role: "member", isEnrolled: true }).select("name category"),
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
    AttendanceRecord.aggregate([
      { $match: { organization: organizationId, markedAt: { $gte: from, $lte: to } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]).then((r) => r), // placeholder, replaced below
  ]);

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
    { $group: { _id: "$user", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(perUserCounts.map((r) => [String(r._id), r.count]));

  const leaderboard = members
    .map((m) => ({
      userId: m._id,
      name: m.name,
      category: m.category,
      rate: Number(((countMap.get(String(m._id)) || 0) / workingDays).toFixed(3)),
    }))
    .sort((a, b) => b.rate - a.rate);

  const topPerformers = leaderboard.slice(0, 5);
  const bottomPerformers = leaderboard.slice(-5).reverse();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const [todayRecords, totalFlagsThisMonth, totalRecordsInRange, allUsersForToday] = await Promise.all([
    AttendanceRecord.find({ organization: organizationId, markedAt: { $gte: todayStart } }).select("user"),
    AttendanceRecord.countDocuments({ organization: organizationId, isFlagged: true, markedAt: { $gte: monthStart } }),
    AttendanceRecord.countDocuments({ organization: organizationId, markedAt: { $gte: from, $lte: to } }),
    User.find({ organization: organizationId, isEnrolled: true }).select("name category"),
  ]);

  const checkedInTodayIds = new Set(todayRecords.map((r) => String(r.user)));
  const todayStatus = allUsersForToday.map((m) => ({
    userId: m._id,
    name: m.name,
    category: m.category,
    checkedIn: checkedInTodayIds.has(String(m._id)),
  }));

  return {
    range: { from, to },
    summary: {
      totalMembers: members.length,
      avgAttendanceRate: Number((totalRecordsInRange / (totalEnrolled * workingDays)).toFixed(3)),
      todayCheckins: checkedInTodayIds.size,
      totalFlagsThisMonth,
    },
    dailyTrend: dailyTrendWithRate,
    flaggedTrend: flaggedTrendFormatted,
    byCategory,
    allMembers: leaderboard,
    todayStatus,
    topPerformers,
    bottomPerformers,
  };
}

export async function getMemberAnalytics(userId, organizationId, query) {
  const { from, to } = defaultRange(query);
  const workingDays = workingDaysBetween(from, to);

  const me = await User.findById(userId).select("name category");
  const records = await AttendanceRecord.find({
    user: userId,
    organization: organizationId,
    markedAt: { $gte: from, $lte: to },
  }).select("markedAt");

  const weekBuckets = {};
  for (const r of records) {
    const key = isoWeekKey(r.markedAt);
    weekBuckets[key] = (weekBuckets[key] || 0) + 1;
  }
  const weeklyTrend = Object.entries(weekBuckets)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([week, count]) => ({ week, present: count }));

  const myRate = Number((records.length / workingDays).toFixed(3));

  const categoryMembers = await User.find({
    organization: organizationId,
    role: "member",
    isEnrolled: true,
    category: me.category,
  }).select("_id");

  const categoryUserIds = categoryMembers.map((m) => m._id);
  const categoryCounts = await AttendanceRecord.aggregate([
    {
      $match: {
        organization: organizationId,
        user: { $in: categoryUserIds },
        markedAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: "$user", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(categoryCounts.map((r) => [String(r._id), r.count]));
  const categoryRates = categoryUserIds.map((id) => (countMap.get(String(id)) || 0) / workingDays);
  const categoryAvgRate = Number(
    (categoryRates.reduce((s, r) => s + r, 0) / (categoryRates.length || 1)).toFixed(3)
  );

  const sortedDesc = [...categoryRates].sort((a, b) => b - a);
  const myRank = sortedDesc.findIndex((r) => r <= myRate) + 1;

  return {
    range: { from, to },
    myRate,
    categoryAvgRate,
    rank: myRank || categoryUserIds.length,
    totalInCategory: categoryUserIds.length,
    weeklyTrend,
  };
}