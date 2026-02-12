#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../models/User');
const WeeklyReport = require('../models/WeeklyReport');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in backend/.env');
  process.exit(1);
}

const TARGET_NAMES = ['KHUSHAL SINDHAV', 'DEVANSH TRIVEDI', 'Nfkxkx Xkxk'];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function deleteReportsForName(name) {
  const regex = new RegExp(`^${escapeRegExp(name)}$`, 'i');
  const user = await User.findOne({ name: regex });

  if (!user) {
    console.warn(`Skipping "${name}" – no matching user found.`);
    return;
  }

  const { deletedCount } = await WeeklyReport.deleteMany({ salesmanId: user._id });
  console.log(`Removed ${deletedCount} weekly report(s) for ${user.name} (${user.email}).`);
}

async function main() {
  console.log('Removing weekly reports for specific users...');
  await mongoose.connect(MONGODB_URI);

  try {
    for (const name of TARGET_NAMES) {
      await deleteReportsForName(name);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Report cleanup failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
