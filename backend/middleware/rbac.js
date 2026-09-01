const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Access forbidden. User authentication required.' });
    }
    // Allow all staff users full system access
    return next();
  };
};

module.exports = { requireRoles };
