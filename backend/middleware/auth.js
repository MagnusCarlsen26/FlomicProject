const { SESSION_COOKIE_NAME, verifySessionToken } = require('../utils/session');

function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    req.auth = verifySessionToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.auth?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
