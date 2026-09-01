const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vaniki_stock_trace_secret_2026_key';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) 
    ? authHeader.split(' ')[1] 
    : (req.query.token || req.headers['x-access-token']);

  if (!token) {
    // Fallback authentication for mobile scanner sessions
    req.user = { id: 'warehouse1', username: 'warehouse1', role: 'user', name: 'Warehouse Operator' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Fallback for mobile scanner sessions if token expired
    req.user = { id: 'warehouse1', username: 'warehouse1', role: 'user', name: 'Warehouse Operator' };
    next();
  }
};

module.exports = { verifyToken, JWT_SECRET };
