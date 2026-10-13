// Two effective roles in this system: 'admin' and everyone else ('user').
// Legacy role names (warehouse/sales/manager) are treated as staff-level 'user'.
const normalizeRole = (role) => (String(role || '').toLowerCase() === 'admin' ? 'admin' : 'user');

const requireRoles = (...allowedRoles) => {
  const allowed = allowedRoles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (allowed.length && !allowed.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ success: false, message: 'Admin access required for this action.' });
    }
    return next();
  };
};

const requireAdmin = requireRoles('admin');

module.exports = { requireRoles, requireAdmin, normalizeRole };
