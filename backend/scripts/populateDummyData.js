#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../models/User');
const WeeklyReport = require('../models/WeeklyReport');
const {
  formatDateKey,
  getWeekFromKey,
  getWeekParts,
} = require('../utils/week');
const {
  buildDefaultPlanningRows,
  buildDefaultActualOutputRows,
} = require('../utils/weeklyReportRows');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in backend/.env');
  process.exit(1);
}

const USER_PROFILES = [
  { email: 'cust01@flomic.local', name: 'Riya Shah', googleId: 'dummy-google-id-01' },
  { email: 'cust02@flomic.local', name: 'Tanay Kapoor', googleId: 'dummy-google-id-02' },
  { email: 'cust03@flomic.local', name: 'Anaya Patel', googleId: 'dummy-google-id-03' },
  { email: 'cust04@flomic.local', name: 'Dev Mehta', googleId: 'dummy-google-id-04' },
  { email: 'cust05@flomic.local', name: 'Leena Varma', googleId: 'dummy-google-id-05' },
  { email: 'cust06@flomic.local', name: 'Sameer Rao', googleId: 'dummy-google-id-06' },
  { email: 'cust07@flomic.local', name: 'Vidya Joshi', googleId: 'dummy-google-id-07' },
  { email: 'cust08@flomic.local', name: 'Ayaan Iyer', googleId: 'dummy-google-id-08' },
  { email: 'cust09@flomic.local', name: 'Zara Kulkarni', googleId: 'dummy-google-id-09' },
  { email: 'cust10@flomic.local', name: 'Kabir Sethi', googleId: 'dummy-google-id-10' },
];

const STATUS_VALUES = ['not_started', 'in_progress', 'blocked', 'completed'];
const CONTACT_TYPES = ['nc', 'fc', 'sc', 'jsv', ''];
const CUSTOMER_NAMES = [
  'Violet Retail',
  'NorthWind Distributors',
  'Harbor Logistics',
  'BayDrop Traders',
  'Saffron Foods',
  'Peak Wellness',
  'Solaris Auto',
  'Cedar Pharma',
];
const LOCATION_AREAS = ['Andheri East', 'Kolkata Central', 'Pune Hinjewadi', 'Bengaluru Whitefield', 'Hyderabad Banjara Hills'];
const USER_METADATA = USER_PROFILES.map((profile, index) => ({
  nameTag: profile.name.split(' ')[0],
  baseOffset: index * 13,
  areaIndexBase: index,
  contactIndexBase: index,
  enquiriesSeed: index + 2,
}));

const WEEK_COUNT = 5;

function buildWeekSequence(count) {
  const currentWeek = getWeekParts();
  const weeks = [];

  for (let offset = 0; offset < count; offset += 1) {
    const startDate = new Date(currentWeek.weekStartDateUtc);
    startDate.setUTCDate(startDate.getUTCDate() - offset * 7);
    const key = formatDateKey(startDate);
    const week = getWeekFromKey(key);

    if (week) {
      weeks.push(week);
    }
  }

  return weeks;
}

function buildDummyPlanningRows(defaultRows, weekIndex, userIndex, meta) {
  return defaultRows.map((row, rowIndex) => {
    const sequence = meta.baseOffset + weekIndex * 7 + rowIndex;
    const contactType = CONTACT_TYPES[(meta.contactIndexBase + sequence) % CONTACT_TYPES.length];
    const customerType = ['targeted_budgeted', 'existing', ''][sequence % 3];
    const areaIndex = (meta.areaIndexBase + sequence * 2) % LOCATION_AREAS.length;
    const jsvLead = `Field Lead ${((sequence % 5) + 1)}`;

    return {
      ...row,
      customerName: `${CUSTOMER_NAMES[(sequence + userIndex) % CUSTOMER_NAMES.length]} - ${meta.nameTag}`,
      locationArea: `${LOCATION_AREAS[areaIndex]} Zone ${weekIndex + 1}`,
      customerType,
      contactType,
      jsvWithWhom: contactType === 'jsv' ? jsvLead : '',
    };
  });
}

function buildDummyActualOutputRows(defaultRows, weekIndex, userIndex, meta) {
  return defaultRows.map((row, rowIndex) => {
    const sequence = meta.baseOffset + weekIndex * 9 + rowIndex;
    const visitedFlag = (sequence + rowIndex) % 4;
    const visited = visitedFlag === 0 ? 'no' : 'yes';
    const enquiriesReceived = ((sequence % 6) + meta.enquiriesSeed + rowIndex) % 7;
    const shipmentsConverted = Math.max(0, Math.min(enquiriesReceived, enquiriesReceived - ((weekIndex + rowIndex) % 3)));
    const suffix = `${meta.nameTag}-${weekIndex + 1}-${rowIndex + 1}`;

    return {
      ...row,
      visited,
      notVisitedReason:
        visited === 'no' ? `Client office closed unexpectedly (${suffix})` : '',
      enquiriesReceived,
      shipmentsConverted,
    };
  });
}

function buildStatus(weekIndex, userIndex, weekKey, meta) {
  const value = STATUS_VALUES[(weekIndex + userIndex) % STATUS_VALUES.length];
  return {
    currentStatus: value,
    statusNote: `Update for ${weekKey} by ${meta.nameTag}`,
  };
}

async function ensureUser(profile) {
  let user = await User.findOne({ email: profile.email });

  if (!user) {
    const created = await User.create({ ...profile, role: 'salesman' });
    return created;
  }

  const fields = ['name', 'picture', 'role', 'googleId'];
  let changed = false;

  for (const field of fields) {
    if (profile[field] && user[field] !== profile[field]) {
      user[field] = profile[field];
      changed = true;
    }
  }

  if (changed) {
    await user.save();
  }

  return user;
}

async function upsertWeekReport(user, week, weekIndex, userIndex) {
  const meta = USER_METADATA[userIndex] || USER_METADATA[0];
  const planningRows = buildDummyPlanningRows(
    buildDefaultPlanningRows(week),
    weekIndex,
    userIndex,
    meta
  );
  const actualRows = buildDummyActualOutputRows(
    buildDefaultActualOutputRows(week),
    weekIndex,
    userIndex,
    meta
  );
  const status = buildStatus(weekIndex, userIndex, week.key, meta);
  const timestamp = new Date(week.weekEndDateUtc);

  await WeeklyReport.findOneAndUpdate(
    { salesmanId: user._id, weekKey: week.key },
    {
      salesmanId: user._id,
      weekKey: week.key,
      weekStartDateUtc: week.weekStartDateUtc,
      weekEndDateUtc: week.weekEndDateUtc,
      planningRows,
      actualOutputRows: actualRows,
      planningSubmittedAt: timestamp,
      actualOutputUpdatedAt: timestamp,
      currentStatus: status.currentStatus,
      statusNote: status.statusNote,
      statusUpdatedAt: timestamp,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

async function main() {
  console.log('Running Flomic dummy-data seeder...');
  await mongoose.connect(MONGODB_URI);

  try {
    const weeks = buildWeekSequence(WEEK_COUNT);

    if (weeks.length < WEEK_COUNT) {
      throw new Error('Unable to resolve week range for seeding');
    }

    let reportCount = 0;

    for (let userIndex = 0; userIndex < USER_PROFILES.length; userIndex += 1) {
      const normalizedProfile = {
        ...USER_PROFILES[userIndex],
        email: USER_PROFILES[userIndex].email.toLowerCase(),
        role: 'salesman',
      };

      const user = await ensureUser(normalizedProfile);

      for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
        await upsertWeekReport(user, weeks[weekIndex], weekIndex, userIndex);
        reportCount += 1;
      }
    }

    console.log(`Seeded ${USER_PROFILES.length} users and ${reportCount} weekly reports.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Seeder failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
