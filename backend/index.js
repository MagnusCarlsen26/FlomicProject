const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const User = require('./models/User');
const { requireAuth } = require('./middleware/auth');
const { clearSessionCookie, setSessionCookie } = require('./utils/session');

const app = express();
const PORT = process.env.PORT || 5000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
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

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});

const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.warn('MONGODB_URI is not set. Skipping MongoDB connection.');
} else {
  mongoose
    .connect(mongoURI)
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });
}
