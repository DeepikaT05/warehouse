const User = require('../models/User');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Dealer = require('../models/Dealer');
const SalesInvoice = require('../models/SalesInvoice');
const Dispatch = require('../models/Dispatch');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');

// -------------------------------------------------------------
// USER MANAGEMENT & ROLE POLICY (MAX 2 ACTIVE ADMINS RULE)
// -------------------------------------------------------------
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const activeAdminsCount = await User.countDocuments({ role: 'admin', status: 'active' });
    return res.json({ success: true, users, activeAdminsCount, maxAdminsAllowed: 2 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, email, password, name, role, phone } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Please fill all required user creation fields.' });
    }

    const requestedRole = (role && role.toLowerCase() === 'admin') ? 'admin' : 'user';

    // Enforce Max 2 Active Admins rule
    if (requestedRole === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins >= 2) {
        return res.status(400).json({
          success: false,
          message: 'Maximum limit of 2 active Admin users reached! Deactivate an existing Admin before adding a new one.'
        });
      }
    }

    const existing = await User.findOne({ $or: [{ username: username.toLowerCase().trim() }, { email: email.toLowerCase().trim() }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username or Email already exists!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name,
      role: requestedRole,
      phone: phone || '',
      status: 'active'
    });

    await AuditLog.create({
      action: 'USER_CREATED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'UserManagement',
      details: `Created user ${username} with role ${requestedRole}`
    });

    return res.status(201).json({
      success: true,
      message: `User ${username} created successfully as ${requestedRole.toUpperCase()}`,
      user: { id: newUser._id, username: newUser.username, email: newUser.email, name: newUser.name, role: newUser.role }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, name, username, email, phone, password } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newRole = role ? (role.toLowerCase() === 'admin' ? 'admin' : 'user') : user.role;
    const newStatus = status || user.status;

    // Check if promoting to Admin
    if (newRole === 'admin' && (user.role !== 'admin' || user.status !== 'active') && newStatus === 'active') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active', _id: { $ne: user._id } });
      if (activeAdmins >= 2) {
        return res.status(400).json({
          success: false,
          message: 'Maximum limit of 2 active Admin users reached! Deactivate an existing Admin user first.'
        });
      }
    }

    // Prevent deactivating or demoting the last active Admin
    if (user.role === 'admin' && user.status === 'active' && (newStatus === 'inactive' || newRole !== 'admin')) {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate or demote the last remaining active Admin user! At least 1 active Admin is required.'
        });
      }
    }

    if (name) user.name = name;
    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    user.status = newStatus;
    user.role = newRole;
    await user.save();

    await AuditLog.create({
      action: 'USER_UPDATED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'UserManagement',
      details: `Updated user ${user.username} status to ${user.status}, role to ${user.role}`
    });

    return res.json({ success: true, message: `User ${user.username} updated successfully`, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await AuditLog.create({
      action: 'ADMIN_RESET_PASSWORD',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'UserManagement',
      details: `Admin reset password for user ${user.username}`
    });

    return res.json({ success: true, message: `Password for user ${user.username} reset successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin' && user.status === 'active') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last remaining active Admin user!'
        });
      }
    }

    await User.findByIdAndDelete(id);

    await AuditLog.create({
      action: 'USER_DELETED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'UserManagement',
      details: `Deleted user ${user.username}`
    });

    return res.json({ success: true, message: `User ${user.username} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// AUDIT LOGS MODULE
// -------------------------------------------------------------
const getAuditLogs = async (req, res) => {
  try {
    const { module, user, action, search, limit } = req.query;
    const filter = {};

    if (module) filter.module = module;
    if (user) filter.user = { $regex: user, $options: 'i' };
    if (action) filter.action = action;
    if (search) {
      filter.$or = [
        { details: { $regex: search, $options: 'i' } },
        { user: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const maxLimit = parseInt(limit, 10) || 150;
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(maxLimit);

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findByIdAndDelete(id);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    return res.json({ success: true, message: 'Audit log deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { details, action } = req.body;
    const log = await AuditLog.findByIdAndUpdate(id, { details, action }, { new: true });
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    return res.json({ success: true, message: 'Audit log updated successfully.', log });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// SETTINGS MODULE
// -------------------------------------------------------------
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    settings.updatedBy = req.user?.username || 'admin';
    settings.updatedAt = new Date();
    await settings.save();

    await AuditLog.create({
      action: 'SETTINGS_UPDATED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Settings',
      details: 'Updated global system settings'
    });

    return res.json({ success: true, message: 'Settings saved successfully', settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// BACKUP & RESTORE MODULE
// -------------------------------------------------------------
const backupDatabase = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const products = await Product.find();
    const stockBoxes = await StockBox.find();
    const dealers = await Dealer.find();
    const purchases = await Purchase.find();
    const salesInvoices = await SalesInvoice.find();
    const dispatches = await Dispatch.find();
    const settings = await Settings.findOne();

    const backupData = {
      app: 'Vaniki Stock Trace Warehouse Inventory',
      version: '1.0.0',
      exportedAt: new Date(),
      exportedBy: req.user?.username || 'admin',
      collections: {
        users,
        products,
        stockBoxes,
        dealers,
        purchases,
        salesInvoices,
        dispatches,
        settings
      }
    };

    await AuditLog.create({
      action: 'DATABASE_BACKUP',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Backup',
      details: `Generated database backup JSON export (${stockBoxes.length} stock boxes)`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="vaniki_wms_backup_${Date.now()}.json"`);
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const restoreDatabase = async (req, res) => {
  try {
    const { backupData } = req.body;
    if (!backupData || !backupData.collections) {
      return res.status(400).json({ success: false, message: 'Invalid backup file payload structure.' });
    }

    const { stockBoxes, dealers, purchases, salesInvoices, dispatches } = backupData.collections;

    if (Array.isArray(dealers) && dealers.length > 0) {
      for (const d of dealers) {
        await Dealer.findByIdAndUpdate(d._id, d, { upsert: true });
      }
    }

    if (Array.isArray(stockBoxes) && stockBoxes.length > 0) {
      for (const box of stockBoxes) {
        await StockBox.findByIdAndUpdate(box._id, box, { upsert: true });
      }
    }

    await AuditLog.create({
      action: 'DATABASE_RESTORE',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Backup',
      details: `Restored database records from backup file payload`
    });

    return res.json({
      success: true,
      message: `Database records restored successfully!`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin Master Soft Delete / Hard Delete
const deleteStockBox = async (req, res) => {
  try {
    const { id } = req.params;
    const box = await StockBox.findById(id);
    if (!box) return res.status(404).json({ success: false, message: 'Box not found' });

    box.isDeleted = true;
    box.deletedAt = new Date();
    box.deletedBy = req.user?.username || 'admin';
    await box.save();

    await AuditLog.create({
      action: 'STOCK_SOFT_DELETED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Stock',
      details: `Soft deleted Stock Box QR: ${box.qrId}`
    });

    return res.json({ success: true, message: `Box ${box.qrId} soft deleted from stock.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// MASTER DATA MANAGEMENT (ADMIN ONLY CRUD)
// -------------------------------------------------------------
const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findByIdAndUpdate(id, req.body, { new: true });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    
    await AuditLog.create({
      action: 'ADMIN_UPDATE_PURCHASE', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Updated purchase ${purchase.invoiceNumber}`
    });
    return res.json({ success: true, message: 'Purchase updated successfully', purchase });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findByIdAndDelete(id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    
    await AuditLog.create({
      action: 'ADMIN_DELETE_PURCHASE', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Deleted purchase ${purchase.invoiceNumber}`
    });
    return res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateStockBox = async (req, res) => {
  try {
    const { id } = req.params;
    const box = await StockBox.findByIdAndUpdate(id, req.body, { new: true });
    if (!box) return res.status(404).json({ success: false, message: 'Box not found' });
    
    await AuditLog.create({
      action: 'ADMIN_UPDATE_BOX', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Updated box ${box.qrId}`
    });
    return res.json({ success: true, message: 'Box updated successfully', box });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateDealer = async (req, res) => {
  try {
    const { id } = req.params;
    const dealer = await Dealer.findByIdAndUpdate(id, req.body, { new: true });
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    
    await AuditLog.create({
      action: 'ADMIN_UPDATE_DEALER', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Updated dealer ${dealer.dealerName}`
    });
    return res.json({ success: true, message: 'Dealer updated successfully', dealer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteDealer = async (req, res) => {
  try {
    const { id } = req.params;
    const dealer = await Dealer.findByIdAndDelete(id);
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    
    await AuditLog.create({
      action: 'ADMIN_DELETE_DEALER', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Deleted dealer ${dealer.dealerName}`
    });
    return res.json({ success: true, message: 'Dealer deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatch = await Dispatch.findByIdAndUpdate(id, req.body, { new: true });
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });
    
    await AuditLog.create({
      action: 'ADMIN_UPDATE_DISPATCH', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Updated dispatch ${dispatch._id}`
    });
    return res.json({ success: true, message: 'Dispatch updated successfully', dispatch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatch = await Dispatch.findByIdAndDelete(id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });
    
    await AuditLog.create({
      action: 'ADMIN_DELETE_DISPATCH', user: req.user?.username || 'admin', role: 'admin', module: 'MasterData', details: `Deleted dispatch ${dispatch._id}`
    });
    return res.json({ success: true, message: 'Dispatch deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getAuditLogs,
  getSettings,
  updateSettings,
  backupDatabase,
  restoreDatabase,
  deleteStockBox,
  updatePurchase,
  deletePurchase,
  updateStockBox,
  updateDealer,
  deleteDealer,
  updateDispatch,
  deleteDispatch,
  deleteAuditLog,
  updateAuditLog
};
