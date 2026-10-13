const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vaniki_stock_trace_secret_2026_key';
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '30d';

const readToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return req.headers['x-access-token'] || req.query.token || null;
};

// Real verification. No silent fallback user: an invalid token is a 401 so the
// client can refresh/redirect to login instead of silently acting as someone else.
const verifyToken = (req, res, next) => {
  const token = readToken(req);

  if (!token) {
    return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication required. Please log in.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: expired ? 'Session expired. Please log in again.' : 'Invalid session token. Please log in again.'
    });
  }
};

const signToken = (user) => jwt.sign(
  { id: String(user._id), username: user.username, role: user.role, name: user.name },
  JWT_SECRET,
  { expiresIn: TOKEN_TTL }
);

module.exports = { verifyToken, signToken, JWT_SECRET, TOKEN_TTL };
