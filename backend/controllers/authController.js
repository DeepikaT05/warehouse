const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { signToken } = require('../middleware/auth');
const { normalizeRole } = require('../middleware/rbac');

// Seed default user accounts if missing
const seedUsers = async () => {
  const seedAccounts = [
    { username: 'admin', email: 'admin@vanikicrop.com', name: 'System Admin', role: 'admin', pass: 'admin123' },
    { username: 'worker', email: 'worker@vanikicrop.com', name: 'Warehouse Worker', role: 'user', pass: 'worker123' },
    { username: 'warehouse1', email: 'warehouse1@vanikicrop.com', name: 'Warehouse Operator', role: 'user', pass: 'warehouse123' }
  ];

  for (const acc of seedAccounts) {
    const existing = await User.findOne({ username: acc.username });
    if (!existing) {
      await User.create({
        username: acc.username,
        email: acc.email,
        password: await bcrypt.hash(acc.pass, 10),
        name: acc.name,
        role: acc.role,
        status: 'active'
      });
      console.log(`[Auth Seed] Created missing account: ${acc.username} (${acc.role})`);
    }
  }
};

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  name: user.name,
  role: normalizeRole(user.role),
  phone: user.phone || '',
  status: user.status,
  lastLogin: user.lastLogin
});

// Brute-force guard: in-memory, per username+ip.
// ponytail: single-process counter; move to Redis if the API is ever run multi-instance.
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;
const attempts = new Map();

const attemptKey = (username, req) => `${username}|${req.ip}`;

const isLocked = (key) => {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (Date.now() - rec.first > LOCK_MS) { attempts.delete(key); return 0; }
  return rec.count >= MAX_ATTEMPTS ? Math.ceil((LOCK_MS - (Date.now() - rec.first)) / 1000) : 0;
};

const recordFailure = (key) => {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > LOCK_MS) attempts.set(key, { count: 1, first: Date.now() });
  else rec.count += 1;
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const key = attemptKey(cleanUsername, req);

    const lockedFor = isLocked(key);
    if (lockedFor) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`
      });
    }

    const user = await User.findOne({ username: cleanUsername });
    if (!user || !(await bcrypt.compare(String(password), user.password))) {
      recordFailure(key);
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Administrator.' });
    }

    attempts.delete(key);

    user.lastLogin = new Date();
    await user.save();

    // The token always carries the normalized role; the stored role is left untouched.
    const token = signToken({ ...user.toObject(), role: normalizeRole(user.role) });

    AuditLog.create({
      action: 'USER_LOGIN',
      user: user.username,
      role: normalizeRole(user.role),
      module: 'Auth',
      details: `User ${user.username} logged into system`,
      ipAddress: req.ip || '127.0.0.1'
    }).catch(e => console.error('AuditLog error:', e.message));

    return res.json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Session user no longer exists. Please log in again.' });
    }

    let user = null;
    if (mongoose.Types.ObjectId.isValid(req.user.id)) {
      user = await User.findById(req.user.id).select('-password').lean();
    } else if (req.user.username) {
      user = await User.findOne({ username: req.user.username }).select('-password').lean();
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Session user no longer exists. Please log in again.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Administrator.' });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const user = (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id))
      ? await User.findById(req.user.id)
      : (req.user?.username ? await User.findOne({ username: req.user.username }) : null);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    AuditLog.create({
      action: 'PASSWORD_CHANGED',
      user: user.username,
      role: normalizeRole(user.role),
      module: 'Auth',
      details: `User ${user.username} changed their password`
    }).catch(e => console.error('AuditLog error:', e.message));

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const user = (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id))
      ? await User.findById(req.user.id)
      : (req.user?.username ? await User.findOne({ username: req.user.username }) : null);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name) user.name = String(name).trim();
    if (email) user.email = String(email).toLowerCase().trim();
    if (phone !== undefined) user.phone = String(phone).trim();

    await user.save();

    AuditLog.create({
      action: 'PROFILE_UPDATED',
      user: user.username,
      role: normalizeRole(user.role),
      module: 'Auth',
      details: `User ${user.username} updated profile details`
    }).catch(e => console.error('AuditLog error:', e.message));

    return res.json({ success: true, message: 'Profile updated successfully.', user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'That email is already in use.' });
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { login, getMe, seedUsers, changePassword, updateProfile };
