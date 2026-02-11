const jwt = require('jsonwebtoken');

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'flomic_session';
const SESSION_TTL = process.env.SESSION_TTL || '7d';
const SESSION_COOKIE_MAX_AGE_MS = Number(
  process.env.SESSION_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000
);
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN;

function parseBoolean(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return undefined;
}

function getCookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFromEnv = parseBoolean(process.env.SESSION_COOKIE_SECURE);

  const options = {
    httpOnly: true,
    secure: secureFromEnv ?? isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };

  if (SESSION_COOKIE_DOMAIN) {
    options.domain = SESSION_COOKIE_DOMAIN;
  }

  return options;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set.');
  }

  return secret;
}

function createSessionToken(user) {
  return jwt.sign(
    {
      userId: String(user.id || user._id),
      email: user.email,
      name: user.name || '',
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: SESSION_TTL }
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function setSessionCookie(res, user) {
  const token = createSessionToken(user);
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getCookieBaseOptions(),
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, getCookieBaseOptions());
}

module.exports = {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  getCookieBaseOptions,
  setSessionCookie,
  verifySessionToken,
};
