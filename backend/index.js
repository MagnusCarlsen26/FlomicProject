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

function buildSafeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name || '',
    role: user.role,
    picture: user.picture || '',
  };
}

function hasDbConnection() {
  return mongoose.connection?.readyState === 1;
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

function buildSalesmanWeekResponse(report, week) {
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
  const tokenUser = {
    id: req.auth.userId,
    email: req.auth.email || '',
    name: req.auth.name || '',
    role: req.auth.role || 'salesman',
    picture: '',
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

    // Keep JWT claims in sync with current DB role/profile.
    setSessionCookie(res, user);
    return res.status(200).json({ user: buildSafeUser(user), source: 'database' });
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
    return res.status(200).json(buildSalesmanWeekResponse(report, week));
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

  const normalizedResult = normalizePlanningRows(rows, currentWeek);
  if (normalizedResult.error) {
    return res.status(400).json({ message: normalizedResult.error });
  }

  try {
    const { report } = await getOrCreateCurrentWeekReport(req.auth.userId);
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

  const normalizedResult = normalizeActualOutputRows(rows, currentWeek);
  if (normalizedResult.error) {
    return res.status(400).json({ message: normalizedResult.error });
  }

  try {
    const { report } = await getOrCreateCurrentWeekReport(req.auth.userId);
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

    const reportBySalesmanId = new Map(
      reports.map((report) => [String(report.salesmanId), report])
    );

    const entries = salesmen
      .map((salesman) => {
        const report = reportBySalesmanId.get(String(salesman._id));

        return {
          salesman: {
            id: String(salesman._id),
            name: salesman.name || '',
            email: salesman.email,
            picture: salesman.picture || '',
            role: salesman.role,
          },
          planning: {
            rows: report?.planningRows || [],
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
