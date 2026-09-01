const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

const AuditLog = require('../models/AuditLog');

// Seed default user accounts if missing
const seedUsers = async () => {
  const seedAccounts = [
    { username: 'admin', email: 'admin@vanikicrop.com', name: 'System Admin', role: 'admin', pass: 'admin123' },
    { username: 'worker', email: 'worker@vanikicrop.com', name: 'Warehouse Worker', role: 'user', pass: 'worker123' }
  ];

  for (const acc of seedAccounts) {
    const existing = await User.findOne({ username: acc.username });
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(acc.pass, salt);
      await User.create({
        username: acc.username,
        email: acc.email,
        password: hashedPassword,
        name: acc.name,
        role: acc.role,
        status: 'active'
      });
      console.log(`[Auth Seed] Seeded missing account: ${acc.username} (${acc.role})`);
    }
  }
};


const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    // Standardize user role safely
    const normalizedRole = user.role ? user.role.toLowerCase() : 'user';

    const token = jwt.sign(
      { id: user._id, username: user.username, role: normalizedRole, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    try {
      await AuditLog.create({
        action: 'USER_LOGIN',
        user: user.username,
        role: normalizedRole,
        module: 'Auth',
        details: `User ${user.username} logged into system`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } catch (auditErr) {
      console.error('AuditLog error:', auditErr.message);
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: normalizedRole,
        phone: user.phone || '',
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const normalizedRole = user.role.toLowerCase() === 'admin' ? 'admin' : 'user';
    return res.json({ success: true, user: { ...user.toObject(), role: normalizedRole } });
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
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      user: user.username,
      role: user.role,
      module: 'Auth',
      details: `User ${user.username} changed their password`
    });

    return res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone.trim();

    await user.save();

    try {
      await AuditLog.create({
        action: 'PROFILE_UPDATED',
        user: user.username,
        role: user.role,
        module: 'Auth',
        details: `User ${user.username} updated profile details`
      });
    } catch (auditErr) {
      console.error('AuditLog error:', auditErr.message);
    }

    const normalizedRole = user.role ? user.role.toLowerCase() : 'user';

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: normalizedRole,
        phone: user.phone || '',
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { login, getMe, seedUsers, changePassword, updateProfile };

