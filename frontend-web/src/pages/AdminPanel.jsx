import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { ShieldAlert, Users, Plus, Edit, Trash2, Key, CheckCircle2, FileText, Settings as SettingsIcon, Database, Download, Upload, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import MasterDataTab from '../components/MasterDataTab';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('master'); // 'master' | 'users' | 'audit' | 'settings' | 'backup'
  const [users, setUsers] = useState([]);
  const [activeAdminsCount, setActiveAdminsCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({
    companyName: 'Vaniki Crop Science',
    address: 'Plot 42, Industrial Area, Sector 3, Gujarat, India',
    contactPhone: '+91 98765 43210',
    contactEmail: 'operations@vanikicrop.com',
    gstNo: '24AAAAA0000A1Z5',
    lowStockThreshold: 20,
    qrPrefix: 'VNK',
    sessionTimeoutMinutes: 30,
    dispatchApprovalRequired: false
  });
  const [loading, setLoading] = useState(true);

  // User form modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
    phone: ''
  });

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Audit filter state
  const [auditFilter, setAuditFilter] = useState({ search: '', module: '', action: '' });

  // Notifications
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, [activeTab, auditFilter]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const uRes = await api.get('/admin/users');
        if (uRes.data.success) {
          setUsers(uRes.data.users);
          setActiveAdminsCount(uRes.data.activeAdminsCount || 0);
        }
      } else if (activeTab === 'audit') {
        const aRes = await api.get('/admin/audit-logs', { params: auditFilter });
        if (aRes.data.success) setAuditLogs(aRes.data.logs);
      } else if (activeTab === 'settings') {
        const sRes = await api.get('/admin/settings');
        if (sRes.data.success && sRes.data.settings) setSettings(sRes.data.settings);
      }
    } catch (err) {
      console.error('Fetch admin data error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const res = await api.post('/admin/users', newUser);
      if (res.data.success) {
        setMessage(res.data.message);
        setNewUser({ username: '', email: '', password: '', name: '', role: 'user', phone: '' });
        setShowCreateModal(false);
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/admin/users/${editingUser._id}`, editingUser);
      if (res.data.success) {
        setMessage(res.data.message);
        setShowEditUserModal(false);
        setEditingUser(null);
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleToggleUserStatus = async (userObj) => {
    const nextStatus = userObj.status === 'active' ? 'inactive' : 'active';
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/admin/users/${userObj._id}`, { status: nextStatus });
      if (res.data.success) {
        setMessage(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    try {
      const res = await api.post(`/admin/users/${resetModalUser._id}/reset-password`, { newPassword: newPasswordInput });
      if (res.data.success) {
        setMessage(res.data.message);
        setResetModalUser(null);
        setNewPasswordInput('');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;
    try {
      const res = await api.delete(`/admin/users/${id}`);
      if (res.data.success) {
        setMessage(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/admin/settings', settings);
      if (res.data.success) {
        setMessage('System settings saved successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Are you sure you want to permanently delete this audit log?')) return;
    try {
      const res = await api.delete(`/admin/audit-logs/${logId}`);
      if (res.data.success) {
        setMessage('Audit log deleted successfully.');
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleEditLog = async (log) => {
    const newDetails = window.prompt('Edit Audit Log Details:', log.details);
    if (newDetails === null || newDetails.trim() === '') return;
    try {
      const res = await api.put(`/admin/audit-logs/${log._id}`, { details: newDetails, action: log.action });
      if (res.data.success) {
        setMessage('Audit log updated successfully.');
        fetchAdminData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleBackupDownload = async () => {
    try {
      const token = localStorage.getItem('vaniki_token');
      const response = await fetch('/api/admin/backup', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vaniki_WMS_Backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage('Database JSON backup file downloaded successfully.');
    } catch (err) {
      alert('Backup failed: ' + err.message);
    }
  };

  const handleFileUploadRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        const res = await api.post('/admin/restore', { backupData });
        if (res.data.success) {
          setMessage(res.data.message);
        }
      } catch (err) {
        setError('Invalid backup JSON file content: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-700" />
            <span>Admin Master Control Panel & System Governance</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage users, role constraints, audit logs, system settings, database backup, and restore.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-700" />
            <span>Active Admins: {activeAdminsCount}/2 Allowed</span>
          </span>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('master')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'master' ? 'border-purple-700 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Master Data</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'users' ? 'border-purple-700 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit' ? 'border-purple-700 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'settings' ? 'border-purple-700 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>System Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'backup' ? 'border-purple-700 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Backup / Restore</span>
        </button>
      </div>

      {/* MASTER DATA TAB */}
      {activeTab === 'master' && (
        <MasterDataTab />
      )}

      {/* USER MANAGEMENT TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-purple-50 border border-purple-200 p-4 rounded-2xl">
            <div>
              <h3 className="font-extrabold text-xs text-purple-900">User Role Policy Enforcement</h3>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Maximum <strong>2 Active Admin Users</strong> permitted. At least <strong>1 Active Admin</strong> must remain. Warehouse staff are assigned <strong>User</strong> role.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>

          {/* User List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <h3 className="font-extrabold text-sm text-slate-900 mb-4">System User Accounts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Name / Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">@{u.username} • {u.email}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-emerald-100 text-[#0F6E56] border border-emerald-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {u.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-3 text-right space-x-3">
                        <button
                          onClick={() => {
                            setEditingUser({ ...u, password: '' });
                            setShowEditUserModal(true);
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setResetModalUser(u)}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="font-extrabold text-sm text-slate-900">System Activity Audit Trail</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search audit details..."
                value={auditFilter.search}
                onChange={(e) => setAuditFilter({ ...auditFilter, search: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-slate-500 font-medium">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{log.module || 'General'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-purple-700">{log.action}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {log.user} <span className="text-slate-400 font-normal">({log.role})</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{log.details}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditLog(log)}
                          className="text-slate-400 hover:text-purple-600 p-1 rounded transition-colors"
                          title="Edit Log"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log._id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Delete Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYSTEM SETTINGS TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="font-extrabold text-sm text-purple-700 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Global Warehouse Settings Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GST Number</label>
              <input
                type="text"
                value={settings.gstNo}
                onChange={(e) => setSettings({ ...settings, gstNo: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Low Stock Alert Threshold (Units)</label>
              <input
                type="number"
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-amber-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">QR ID Prefix</label>
              <input
                type="text"
                value={settings.qrPrefix}
                onChange={(e) => setSettings({ ...settings, qrPrefix: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Session Inactivity Timeout (Minutes)</label>
              <input
                type="number"
                value={settings.sessionTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
              />
            </div>

            <div className="flex items-center gap-3 bg-purple-50 p-4 rounded-xl border border-purple-200">
              <input
                type="checkbox"
                id="dispatchApproval"
                checked={settings.dispatchApprovalRequired}
                onChange={(e) => setSettings({ ...settings, dispatchApprovalRequired: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <label htmlFor="dispatchApproval" className="font-bold text-purple-900 cursor-pointer">
                Require Mandatory Admin Approval before Dispatch Completion
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow"
            >
              Save System Settings
            </button>
          </div>
        </form>
      )}

      {/* BACKUP & RESTORE TAB */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-sm text-purple-700 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database JSON Backup & Disaster Recovery Restore
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Download complete database snapshots or upload a JSON backup file to restore system inventory.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-purple-50 border border-purple-200 p-6 rounded-2xl space-y-4">
              <h4 className="font-bold text-xs text-purple-900">Download Database Backup</h4>
              <p className="text-[11px] text-purple-700">
                Exports Users, Products, Stock Boxes, Purchases, Sales Invoices, and Dealers to a timestamped JSON backup file.
              </p>
              <button
                onClick={handleBackupDownload}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Database JSON Backup</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-4">
              <h4 className="font-bold text-xs text-slate-900">Restore Database from File</h4>
              <p className="text-[11px] text-slate-600">
                Select a previously exported `.json` database backup file to restore records.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUploadRestore}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-extrabold text-slate-900 mb-4">Create System Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                >
                  <option value="user">User (Warehouse Daily Operations)</option>
                  <option value="admin">Admin (Full Control - Max 2 Allowed)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-sm font-extrabold text-slate-900 mb-4">Edit User Account</h2>
            <form onSubmit={handleEditUserSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  placeholder="Min 6 chars"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                >
                  <option value="user">User (Warehouse Daily Operations)</option>
                  <option value="admin">Admin (Full Control - Max 2 Allowed)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-sm font-extrabold text-slate-900 mb-2">Reset Password</h2>
            <p className="text-xs text-slate-500 mb-4">Reset password for <strong>@{resetModalUser.username}</strong></p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
