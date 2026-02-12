const mongoose = require('mongoose');
const User = require('../models/User');
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
  return async (req, res, next) => {
    let role = req.auth?.role;

    // Use DB role as source of truth when available to avoid stale JWT role claims.
    if (mongoose.connection?.readyState === 1 && req.auth?.userId) {
      try {
        const user = await User.findById(req.auth.userId).select('role');

        if (!user) {
          return res.status(401).json({ message: 'Session user not found' });
        }

        role = user.role;
        req.auth.role = role;
      } catch (error) {
        return res.status(500).json({ message: 'Unable to verify user role' });
      }
    }

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
