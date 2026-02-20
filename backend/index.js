const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');
const dotenv = require('dotenv');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}

const User = require('./models/User');
const WeeklyReport = require('./models/WeeklyReport');
const StatusUpdate = require('./models/StatusUpdate');
const { requireAuth, requireRole } = require('./middleware/auth');
const { clearSessionCookie, setSessionCookie } = require('./utils/session');
const { getWeekParts, resolveWeekFromQuery } = require('./utils/week');
const { buildInsightsPayload, resolveInsightsRange } = require('./utils/adminInsights');
const { buildStage1Payload, resolveStage1Range } = require('./utils/stage1PlanActual');
const { buildStage2Payload, resolveStage2Range } = require('./utils/stage2ActivityCompliance');
const { buildStage3Payload, resolveStage3Range } = require('./utils/stage3PlannedNotVisited');
const { buildInactiveAlert, buildJsvRepeatAlertsBySalesman } = require('./utils/jsvRepeatAlerts');
const {
  buildDefaultActualOutputRows,
  buildDefaultPlanningRows,
  ensureWeekRows,
  normalizeActualOutputRows,
  normalizePlanningRows,
} = require('./utils/weeklyReportRows');

const app = express();
const PORT = process.env.PORT || 5000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client();
const ADMIN_INSIGHTS_SECTION_IDS = [
  'visit-performance',
  'compliance-snapshot',
  'stage3-summary',
  'daily-trend',
  'stage3-reason-distribution',
  'stage3-weekly-trend',
  'weekly-summary',
  'monthly-rollup',
  'top-over-achievers',
  'top-under-achievers',
  'call-type-split',
  'customer-type-split',
  'compliance-by-salesperson',
  'admin-monitoring',
  'salesperson-rollup',
  'recent-activity',
  'stage3-salesperson-non-visit-rates',
  'stage3-repeated-non-visits',
  'stage3-detailed-drilldown',
];

function normalizeOrigin(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]+|['"]+$/g, '');

  if (!trimmed) {
    return null;
  }

  if (trimmed === '*') {
    return '*';
  }

  try {
    return new URL(trimmed).origin;
  } catch (_error) {
    return trimmed.replace(/\/+$/, '');
  }
}

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

console.log('CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

function buildSafeUser(user, options = {}) {
  if (!user) {
    return null;
  }

  const threshold = Number.isInteger(options.threshold) ? options.threshold : 3;

  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name || '',
    role: user.role,
    picture: user.picture || '',
    mainTeam: user.mainTeam || 'Unassigned',
    team: user.team || 'Unassigned',
    subTeam: user.subTeam || 'Unassigned',
    jsvRepeatAlert: options.jsvRepeatAlert || buildInactiveAlert(threshold),
  };
}

function hasDbConnection() {
  return mongoose.connection?.readyState === 1;
}

function normalizeCollapsedSectionIds(sectionIds = []) {
  if (!Array.isArray(sectionIds)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const sectionId of sectionIds) {
    if (typeof sectionId !== 'string') {
      continue;
    }
    const trimmed = sectionId.trim();
    if (!ADMIN_INSIGHTS_SECTION_IDS.includes(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

async function listJsvEligibleUsersForSalesperson(userId) {
  const currentUser = await User.findById(userId).select('_id subTeam').lean();
  if (!currentUser) {
    return [];
  }

  const subTeam = String(currentUser.subTeam || '').trim();
  if (!subTeam) {
    return [];
  }

  const users = await User.find({
    role: { $in: ['salesman', 'admin'] },
    subTeam,
    _id: { $ne: currentUser._id },
  })
    .select('_id name email role subTeam')
    .sort({ name: 1, email: 1 })
    .lean();

  return users.map((user) => ({
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'salesman',
    subTeam: user.subTeam || 'Unassigned',
  }));
}

function toExistingRowsByDate(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const date = String(row?.date || '');
    if (date) {
      map.set(date, row);
    }
  }
  return map;
}

function mapPlanningRowsForDisplay(rows, adminLabelById) {
  return (rows || []).map((row) => {
    const rawValue = String(row?.jsvWithWhom || '').trim();
    if (!rawValue || !adminLabelById.has(rawValue)) {
      return row;
    }

    return {
      ...row,
      jsvWithWhom: adminLabelById.get(rawValue),
    };
  });
}

async function getOrCreateCurrentWeekReport(salesmanId) {
  const week = getWeekParts();
  let report = await WeeklyReport.findOne({ salesmanId, weekKey: week.key });

  if (!report) {
    report = await WeeklyReport.create({
      salesmanId,
      weekKey: week.key,
      weekStartDateUtc: week.weekStartDateUtc,
      weekEndDateUtc: week.weekEndDateUtc,
      planningRows: buildDefaultPlanningRows(week),
      actualOutputRows: buildDefaultActualOutputRows(week),
      currentStatus: 'not_started',
      statusNote: '',
    });

    return { report, week };
  }

  const rowsChanged = ensureWeekRows(report, week);
  if (rowsChanged) {
    await report.save();
  }

  return { report, week };
}

function buildSalesmanWeekResponse(report, week, jsvEligibleUsers = []) {
  return {
    week: {
      key: week.key,
      startDate: week.startDate,
      endDate: week.endDate,
      timezone: week.timezone,
      isEditable: true,
    },
    planning: {
      rows: report.planningRows || [],
      submittedAt: report.planningSubmittedAt || null,
    },
    actualOutput: {
      rows: report.actualOutputRows || [],
      updatedAt: report.actualOutputUpdatedAt || null,
    },
    status: {
      value: report.currentStatus || 'not_started',
      note: report.statusNote || '',
      updatedAt: report.statusUpdatedAt || null,
    },
    jsvEligibleUsers,
    // Backward-compatible alias for one release cycle.
    jsvAdminUsers: jsvEligibleUsers,
  };
}

async function findOrCreateGoogleUser(payload) {
  const googleId = payload.sub;
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId });

  if (!user) {
    user = await User.findOne({ email });
  }

  if (!user) {
    user = await User.create({
      googleId,
      email,
      name: payload.name || '',
      picture: payload.picture || '',
      role: 'salesman',
    });

    return user;
  }

  let hasChanges = false;

  if (!user.googleId) {
    user.googleId = googleId;
    hasChanges = true;
  }

  if (payload.name && user.name !== payload.name) {
    user.name = payload.name;
    hasChanges = true;
  }

  if (payload.picture && user.picture !== payload.picture) {
    user.picture = payload.picture;
    hasChanges = true;
  }

  if (hasChanges) {
    await user.save();
  }

  return user;
}

app.get('/', (req, res) => {
  res.send('Flomic Backend API is running...');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy' });
});

app.get('/api/health', (req, res) => {
  const readyState = mongoose.connection?.readyState ?? 0;
  const dbConnected = readyState === 1;

  res.status(200).json({
    status: 'OK',
    serverTime: new Date().toISOString(),
    db: {
      connected: dbConnected,
      readyState,
    },
  });
});

app.post('/api/auth/google', async (req, res) => {
  const idToken = req.body?.idToken;

  if (typeof idToken !== 'string' || !idToken.trim()) {
    return res.status(400).json({ message: 'idToken is required' });
  }

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not configured' });
  }

  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Google token' });
  }

  if (!payload?.sub || !payload?.email) {
    return res.status(400).json({ message: 'Google token payload is incomplete' });
  }

  if (!payload.email_verified) {
    return res.status(403).json({ message: 'Google email must be verified' });
  }

  try {
    const user = await findOrCreateGoogleUser(payload);
    setSessionCookie(res, user);
    return res.status(200).json({ user: buildSafeUser(user) });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ message: 'Unable to complete sign-in' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const threshold = 3;
  const tokenUser = {
    id: req.auth.userId,
    email: req.auth.email || '',
    name: req.auth.name || '',
    role: req.auth.role || 'salesman',
    picture: '',
    mainTeam: 'Unassigned',
    team: 'Unassigned',
    subTeam: 'Unassigned',
    jsvRepeatAlert: buildInactiveAlert(threshold),
  };

  if (!hasDbConnection()) {
    return res.status(200).json({ user: tokenUser, source: 'token' });
  }

  try {
    const user = await User.findById(req.auth.userId);

    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Session user not found' });
    }

    const historicalReports = await WeeklyReport.find({
      salesmanId: user._id,
    })
      .select('salesmanId planningRows.customerName planningRows.contactType')
      .lean();
    const alertsBySalesman = buildJsvRepeatAlertsBySalesman({
      reports: historicalReports,
      threshold,
    });
    const userAlert = alertsBySalesman.get(String(user._id)) || buildInactiveAlert(threshold);

    // Keep JWT claims in sync with current DB role/profile.
    setSessionCookie(res, user);
    return res.status(200).json({
      user: buildSafeUser(user, { jsvRepeatAlert: userAlert, threshold }),
      source: 'database',
    });
  } catch (error) {
    console.error('Session lookup error:', error);
    return res.status(200).json({ user: tokenUser, source: 'token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ status: 'OK' });
});

app.get('/api/salesman/current-week', requireAuth, requireRole('salesman', 'admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  try {
    const { report, week } = await getOrCreateCurrentWeekReport(req.auth.userId);
    const jsvEligibleUsers = await listJsvEligibleUsersForSalesperson(req.auth.userId);
    return res.status(200).json(buildSalesmanWeekResponse(report, week, jsvEligibleUsers));
  } catch (error) {
    console.error('Current week fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch current week data' });
  }
});

app.put('/api/salesman/planning', requireAuth, requireRole('salesman', 'admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const { weekKey, rows, submitted } = req.body || {};
  const currentWeek = getWeekParts();

  if (weekKey && weekKey !== currentWeek.key) {
    return res.status(403).json({
      message: `Editing is only allowed for current IST week (${currentWeek.key})`,
    });
  }

  try {
    const { report } = await getOrCreateCurrentWeekReport(req.auth.userId);
    const jsvEligibleUsers = await listJsvEligibleUsersForSalesperson(req.auth.userId);
    const normalizedResult = normalizePlanningRows(rows, currentWeek, {
      allowedJsvUserIds: new Set(jsvEligibleUsers.map((member) => member.id)),
      existingRowsByDate: toExistingRowsByDate(report.planningRows || []),
      allowLegacyUnchanged: true,
    });
    if (normalizedResult.error) {
      return res.status(400).json({ message: normalizedResult.error });
    }

    report.planningRows = normalizedResult.rows;

    if (submitted === true) {
      report.planningSubmittedAt = new Date();
    }

    await report.save();

    return res.status(200).json({
      planning: {
        rows: report.planningRows,
        submittedAt: report.planningSubmittedAt || null,
      },
    });
  } catch (error) {
    console.error('Planning update error:', error);
    return res.status(500).json({ message: 'Unable to update planning rows' });
  }
});

app.put('/api/salesman/actual-output', requireAuth, requireRole('salesman', 'admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const { weekKey, rows } = req.body || {};
  const currentWeek = getWeekParts();

  if (weekKey && weekKey !== currentWeek.key) {
    return res.status(403).json({
      message: `Editing is only allowed for current IST week (${currentWeek.key})`,
    });
  }

  try {
    const { report } = await getOrCreateCurrentWeekReport(req.auth.userId);
    const normalizedResult = normalizeActualOutputRows(rows, currentWeek, {
      existingRowsByDate: toExistingRowsByDate(report.actualOutputRows || []),
      allowLegacyUnchanged: true,
    });
    if (normalizedResult.error) {
      return res.status(400).json({ message: normalizedResult.error });
    }

    report.actualOutputRows = normalizedResult.rows;
    report.actualOutputUpdatedAt = new Date();
    await report.save();

    return res.status(200).json({
      actualOutput: {
        rows: report.actualOutputRows,
        updatedAt: report.actualOutputUpdatedAt,
      },
    });
  } catch (error) {
    console.error('Actual output update error:', error);
    return res.status(500).json({ message: 'Unable to update actual output rows' });
  }
});

app.get('/api/admin/stage3-planned-not-visited', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const rangeResult = resolveStage3Range(req.query || {});
  if (rangeResult.error) {
    return res.status(400).json({ message: rangeResult.error });
  }

  const salesmen = String(req.query?.salesmen || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const reasonCategory = String(req.query?.reasonCategory || '').trim().toLowerCase();
  const customer = String(req.query?.customer || '').trim();
  const mainTeam = String(req.query?.mainTeam || '').trim();
  const team = String(req.query?.team || '').trim();
  const subTeam = String(req.query?.subTeam || '').trim();
  const q = String(req.query?.q || '').trim();

  try {
    const userQuery = { role: { $in: ['salesman', 'admin'] } };
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');
      userQuery.$or = [{ name: regex }, { email: regex }];
    }

    const users = await User.find(userQuery)
      .select('_id name email mainTeam team subTeam')
      .sort({ name: 1, email: 1 })
      .lean();

    const userIds = users.map((u) => u._id);

    // To detect recurrence, we need more history than just the selected range.
    // We fetch reports starting from 8 weeks before range start.
    const fromDateObj = new Date(`${rangeResult.fromDate}T00:00:00.000Z`);
    const windowStartDate = new Date(fromDateObj.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    const reports =
      userIds.length === 0
        ? []
        : await WeeklyReport.find({
            salesmanId: { $in: userIds },
            weekStartDateUtc: {
              $gte: windowStartDate,
              $lte: new Date(`${rangeResult.toDate}T23:59:59.999Z`),
            },
          })
            .select('salesmanId planningRows actualOutputRows weekKey weekStartDateUtc')
            .lean();

    const payload = buildStage3Payload({
      users,
      reports,
      range: rangeResult,
      filters: {
        salesmen,
        reasonCategory,
        customer,
        mainTeam,
        team,
        subTeam,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('Stage 3 planned-not-visited fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch stage 3 data' });
  }
});

app.put('/api/salesman/current-status', requireAuth, requireRole('salesman', 'admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const { weekKey, status, note } = req.body || {};
  const allowedStatuses = ['not_started', 'in_progress', 'blocked', 'completed'];
  const currentWeek = getWeekParts();

  if (weekKey && weekKey !== currentWeek.key) {
    return res.status(403).json({
      message: `Editing is only allowed for current IST week (${currentWeek.key})`,
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Invalid status. Allowed values: not_started, in_progress, blocked, completed',
    });
  }

  const statusNote = String(note || '').trim().slice(0, 1000);

  try {
    const { report } = await getOrCreateCurrentWeekReport(req.auth.userId);
    report.currentStatus = status;
    report.statusNote = statusNote;
    report.statusUpdatedAt = new Date();
    await report.save();

    await StatusUpdate.create({
      salesmanId: req.auth.userId,
      weekKey: currentWeek.key,
      status,
      note: statusNote,
    });

    return res.status(200).json({
      status: {
        value: report.currentStatus,
        note: report.statusNote,
        updatedAt: report.statusUpdatedAt,
      },
    });
  } catch (error) {
    console.error('Current status update error:', error);
    return res.status(500).json({ message: 'Unable to update current status' });
  }
});

app.get('/api/admin/salesmen-status', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const q = String(req.query?.q || '').trim();
  const week = resolveWeekFromQuery(req.query?.week);

  if (!week) {
    return res.status(400).json({
      message: 'Invalid week query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD',
    });
  }

  const salesmanQuery = { role: { $in: ['salesman', 'admin'] } };

  if (q) {
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQ, 'i');
    salesmanQuery.$or = [{ name: regex }, { email: regex }];
  }

  try {
    const threshold = 3;
    const jsvUsers = await User.find({ role: { $in: ['salesman', 'admin'] } })
      .select('_id name email')
      .lean();
    const jsvLabelById = new Map(
      jsvUsers.map((member) => [String(member._id), member.name || member.email])
    );

    const salesmen = await User.find(salesmanQuery)
      .select('_id name email picture role')
      .sort({ name: 1, email: 1 })
      .lean();

    if (salesmen.length === 0) {
      return res.status(200).json({
        week: {
          key: week.key,
          startDate: week.startDate,
          endDate: week.endDate,
          isoWeek: week.isoWeek,
          timezone: week.timezone,
        },
        filters: {
          q,
        },
        total: 0,
        entries: [],
      });
    }

    const salesmanIds = salesmen.map((salesman) => salesman._id);
    const reports = await WeeklyReport.find({
      salesmanId: { $in: salesmanIds },
      weekKey: week.key,
    }).lean();
    const historicalReports = await WeeklyReport.find({
      salesmanId: { $in: salesmanIds },
    })
      .select('salesmanId planningRows.customerName planningRows.contactType')
      .lean();

    const reportBySalesmanId = new Map(
      reports.map((report) => [String(report.salesmanId), report])
    );
    const alertsBySalesman = buildJsvRepeatAlertsBySalesman({
      reports: historicalReports,
      threshold,
    });

    const entries = salesmen
      .map((salesman) => {
        const report = reportBySalesmanId.get(String(salesman._id));
        const jsvRepeatAlert =
          alertsBySalesman.get(String(salesman._id)) || buildInactiveAlert(threshold);

        return {
          salesman: {
            id: String(salesman._id),
            name: salesman.name || '',
            email: salesman.email,
            picture: salesman.picture || '',
            role: salesman.role,
            jsvRepeatAlert,
          },
          planning: {
            rows: mapPlanningRowsForDisplay(report?.planningRows || [], jsvLabelById),
            submittedAt: report?.planningSubmittedAt || null,
          },
          actualOutput: {
            rows: report?.actualOutputRows || [],
            updatedAt: report?.actualOutputUpdatedAt || null,
          },
          hasData: Boolean(report),
        };
      });



    return res.status(200).json({
      week: {
        key: week.key,
        startDate: week.startDate,
        endDate: week.endDate,
        isoWeek: week.isoWeek,
        timezone: week.timezone,
      },
      filters: {
        q,
      },
      total: entries.length,
      entries,
    });
  } catch (error) {
    console.error('Admin salesmen status fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch admin dashboard data' });
  }
});

app.get('/api/admin/salesmen', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  try {
    const salesmen = await User.find({ role: { $in: ['salesman', 'admin'] } })
      .select('_id name email picture role')
      .sort({ name: 1, email: 1 })
      .lean();

    return res.status(200).json({
      total: salesmen.length,
      salesmen: salesmen.map((s) => ({
        id: String(s._id),
        name: s.name || '',
        email: s.email,
        picture: s.picture || '',
        role: s.role,
      })),
    });
  } catch (error) {
    console.error('Fetch salesmen error:', error);
    return res.status(500).json({ message: 'Unable to fetch salesmen' });
  }
});

app.get('/api/admin/insights/preferences', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  try {
    const user = await User.findById(req.auth.userId).select('preferences.adminInsights.collapsedSectionIds').lean();
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Session user not found' });
    }

    const rawCollapsedSectionIds = user?.preferences?.adminInsights?.collapsedSectionIds;
    const collapsedSectionIds = Array.isArray(rawCollapsedSectionIds)
      ? normalizeCollapsedSectionIds(rawCollapsedSectionIds)
      : null;
    return res.status(200).json({ collapsedSectionIds });
  } catch (error) {
    console.error('Admin insights preferences fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch admin insights preferences' });
  }
});

app.put('/api/admin/insights/preferences', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const collapsedSectionIds = normalizeCollapsedSectionIds(req.body?.collapsedSectionIds || []);

  try {
    const user = await User.findById(req.auth.userId).select('preferences');
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Session user not found' });
    }

    user.preferences = user.preferences || {};
    user.preferences.adminInsights = user.preferences.adminInsights || {};
    user.preferences.adminInsights.collapsedSectionIds = collapsedSectionIds;
    user.markModified('preferences');
    await user.save();

    return res.status(200).json({ collapsedSectionIds });
  } catch (error) {
    console.error('Admin insights preferences update error:', error);
    return res.status(500).json({ message: 'Unable to save admin insights preferences' });
  }
});

app.get('/api/admin/insights', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const q = String(req.query?.q || '').trim();
  const salesmenIds = String(req.query?.salesmen || '').trim().split(',').filter(Boolean);

  const rangeResult = resolveInsightsRange({
    from: req.query?.from,
    to: req.query?.to,
  });

  if (rangeResult.error) {
    return res.status(400).json({ message: rangeResult.error });
  }

  const salesmanQuery = { role: { $in: ['salesman', 'admin'] } };

  if (salesmenIds.length > 0) {
    salesmanQuery._id = { $in: salesmenIds };
  } else if (q) {
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQ, 'i');
    salesmanQuery.$or = [{ name: regex }, { email: regex }];
  }

  try {
    const users = await User.find(salesmanQuery)
      .select('_id name email picture role')
      .sort({ name: 1, email: 1 })
      .lean();

    if (users.length === 0) {
      return res.status(200).json(
        buildInsightsPayload({
          users,
          reports: [],
          range: rangeResult,
        })
      );
    }

    const userIds = users.map((user) => user._id);
    const reports = await WeeklyReport.find({
      salesmanId: { $in: userIds },
      weekStartDateUtc: {
        $gte: rangeResult.fromWeek.weekStartDateUtc,
        $lte: rangeResult.toWeek.weekStartDateUtc,
      },
    }).lean();

    return res.status(200).json(
      buildInsightsPayload({
        users,
        reports,
        range: rangeResult,
      })
    );
  } catch (error) {
    console.error('Admin insights fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch admin insights data' });
  }
});

app.get('/api/admin/stage1-plan-actual', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const rangeResult = resolveStage1Range(req.query || {});
  if (rangeResult.error) {
    return res.status(400).json({ message: rangeResult.error });
  }

  const salesmen = String(req.query?.salesmen || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const callType = String(req.query?.callType || '').trim().toLowerCase();
  const customerType = String(req.query?.customerType || '').trim().toLowerCase();
  const mainTeam = String(req.query?.mainTeam || '').trim();
  const team = String(req.query?.team || '').trim();
  const subTeam = String(req.query?.subTeam || '').trim();
  const q = String(req.query?.q || '').trim();

  try {
    const userQuery = { role: { $in: ['salesman', 'admin'] } };
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');
      userQuery.$or = [{ name: regex }, { email: regex }];
    }

    const users = await User.find(userQuery)
      .select('_id name email mainTeam team subTeam')
      .sort({ name: 1, email: 1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const rangeWeekStart = resolveWeekFromQuery(rangeResult.fromDate);
    const rangeWeekEnd = resolveWeekFromQuery(rangeResult.toDate);

    const reports =
      userIds.length === 0
        ? []
        : await WeeklyReport.find({
            salesmanId: { $in: userIds },
            weekStartDateUtc: {
              $gte: rangeWeekStart.weekStartDateUtc,
              $lte: rangeWeekEnd.weekStartDateUtc,
            },
          })
            .select('salesmanId planningRows actualOutputRows weekKey')
            .lean();

    const payload = buildStage1Payload({
      users,
      reports,
      range: rangeResult,
      filters: {
        salesmen,
        callType,
        customerType,
        mainTeam,
        team,
        subTeam,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('Stage 1 plan-vs-actual fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch stage 1 plan-vs-actual data' });
  }
});

app.get('/api/admin/stage2-activity-compliance', requireAuth, requireRole('admin'), async (req, res) => {
  if (!hasDbConnection()) {
    return res.status(503).json({ message: 'Database is not connected' });
  }

  const rangeResult = resolveStage2Range(req.query || {});
  if (rangeResult.error) {
    return res.status(400).json({ message: rangeResult.error });
  }

  const salesmenIds = String(req.query?.salesmen || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const mainTeam = String(req.query?.mainTeam || '').trim();
  const team = String(req.query?.team || '').trim();
  const subTeam = String(req.query?.subTeam || '').trim();
  const q = String(req.query?.q || '').trim();

  try {
    const userQuery = { role: { $in: ['salesman', 'admin'] } };
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');
      userQuery.$or = [{ name: regex }, { email: regex }];
    }

    if (salesmenIds.length > 0) {
      userQuery._id = { $in: salesmenIds };
    }
    if (mainTeam) userQuery.mainTeam = mainTeam;
    if (team) userQuery.team = team;
    if (subTeam) userQuery.subTeam = subTeam;

    const users = await User.find(userQuery)
      .select('_id name email mainTeam team subTeam role picture')
      .sort({ name: 1, email: 1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const reports =
      userIds.length === 0
        ? []
        : await WeeklyReport.find({
            salesmanId: { $in: userIds },
            weekKey: rangeResult.key,
          })
            .select('salesmanId planningRows actualOutputRows weekKey')
            .lean();

    const payload = buildStage2Payload({
      users,
      reports,
      range: rangeResult,
      filters: {
        salesmen: salesmenIds,
        mainTeam,
        team,
        subTeam,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('Stage 2 activity compliance fetch error:', error);
    return res.status(500).json({ message: 'Unable to fetch stage 2 activity compliance data' });
  }
});


function normalizeMongoUri(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/^['"]+|['"]+$/g, '');
}

function getMongoUriFromEnv() {
  const rawValue = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '';
  return normalizeMongoUri(rawValue);
}

async function startServer() {
  const mongoURI = getMongoUriFromEnv();

  if (!mongoURI) {
    console.error(
      'MongoDB connection skipped: set MONGODB_URI (or MONGO_URI / DATABASE_URL) in the runtime environment.'
    );
    process.exit(1);
  }

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB runtime error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB disconnected');
  });

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
}

startServer();
