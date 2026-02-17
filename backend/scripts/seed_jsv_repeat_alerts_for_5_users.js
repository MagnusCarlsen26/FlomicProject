#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../models/User');
const WeeklyReport = require('../models/WeeklyReport');
const { getWeekParts } = require('../utils/week');
const {
  buildDefaultActualOutputRows,
  buildDefaultPlanningRows,
  ensureWeekRows,
} = require('../utils/weeklyReportRows');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const TARGET_USER_COUNT = 5;
const REQUIRED_REPEAT_COUNT = 4;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in backend/.env');
  process.exit(1);
}

async function getOrCreateCurrentWeekReport(userId, week) {
  let report = await WeeklyReport.findOne({ salesmanId: userId, weekKey: week.key });

  if (!report) {
    report = await WeeklyReport.create({
      salesmanId: userId,
      weekKey: week.key,
      weekStartDateUtc: week.weekStartDateUtc,
      weekEndDateUtc: week.weekEndDateUtc,
      planningRows: buildDefaultPlanningRows(week),
      actualOutputRows: buildDefaultActualOutputRows(week),
      currentStatus: 'not_started',
      statusNote: '',
    });
    return report;
  }

  const rowsChanged = ensureWeekRows(report, week);
  if (rowsChanged) {
    await report.save();
  }

  return report;
}

function applyRepeatedJsvRows(rows, customerName, adminId) {
  const nextRows = [...rows];
  const limit = Math.min(REQUIRED_REPEAT_COUNT, nextRows.length);

  for (let i = 0; i < limit; i += 1) {
    nextRows[i] = {
      ...nextRows[i],
      customerName,
      contactType: 'jsv',
      jsvWithWhom: adminId || '',
    };
  }

  return nextRows;
}

async function run() {
  console.log('Seeding JSV repeat-customer alerts for 5 users...');
  await mongoose.connect(MONGODB_URI);

  try {
    const week = getWeekParts();
    const users = await User.find({ role: { $in: ['salesman', 'admin'] } })
      .select('_id name email')
      .sort({ name: 1, email: 1 })
      .limit(TARGET_USER_COUNT)
      .lean();

    if (users.length < TARGET_USER_COUNT) {
      throw new Error(`Need at least ${TARGET_USER_COUNT} users with salesman/admin role`);
    }

    const firstAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
    const adminId = firstAdmin ? String(firstAdmin._id) : '';

    for (let index = 0; index < users.length; index += 1) {
      const user = users[index];
      const report = await getOrCreateCurrentWeekReport(user._id, week);
      const customerName = `JSV Alert Customer ${index + 1}`;
      report.planningRows = applyRepeatedJsvRows(report.planningRows || [], customerName, adminId);
      report.planningSubmittedAt = report.planningSubmittedAt || new Date();
      await report.save();

      console.log(
        `Updated ${user.email} (${user.name || 'Unnamed'}) with ${REQUIRED_REPEAT_COUNT} JSV rows for "${customerName}".`
      );
    }

    console.log('Seeding complete.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('JSV alert seeding failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
