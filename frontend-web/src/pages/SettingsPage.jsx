import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Settings, User, Lock, CheckCircle2, AlertCircle, Building2, Eye, EyeOff, Save, Edit3, X } from 'lucide-react';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';

  // User Profile Form States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Sync profile fields on mount or user change
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Change Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility Eye Toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setProfileLoading(true);

    try {
      const res = await api.put('/auth/profile', {
        name,
        email,
        phone
      });

      if (res.data.success) {
        setMessage('User profile updated successfully!');
        if (updateUser) updateUser(res.data.user);
        setIsEditingProfile(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      if (res.data.success) {
        setMessage('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#0F6E56]" />
            <span>Account & Application Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your account security, profile information, and system preferences.
          </p>
        </div>

        <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border ${
          isAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-[#0F6E56] border-emerald-200'
        }`}>
          Role: {user?.role?.toUpperCase() || 'USER'}
        </span>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-[#0F6E56]" />
              <span>User Profile Information</span>
            </h2>

            {!isEditingProfile ? (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="text-xs font-bold text-[#0F6E56] hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setName(user?.name || '');
                  setEmail(user?.email || '');
                  setPhone(user?.phone || '');
                }}
                className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {!isEditingProfile ? (
            /* Read-Only Profile View */
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Full Name</span>
                <p className="font-bold text-slate-800 text-sm">{user?.name}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Username</span>
                <p className="font-bold font-mono text-slate-800">@{user?.username}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Email Address</span>
                <p className="font-medium text-slate-700">{user?.email}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Phone Number</span>
                <p className="font-medium text-slate-700">{user?.phone || 'Not provided'}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Role Access Level</span>
                <p className="font-extrabold text-[#0F6E56] capitalize">{user?.role} Access Level</p>
              </div>
            </div>
          ) : (
            /* Editable Profile Form */
            <form onSubmit={handleProfileUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Username (System Assigned)</label>
                <input
                  type="text"
                  disabled
                  value={`@${user?.username}`}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Access Level</label>
                <input
                  type="text"
                  disabled
                  value={`${user?.role?.toUpperCase()} Access Level`}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-bold text-[#0F6E56] cursor-not-allowed"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex-1 bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{profileLoading ? 'Saving Profile...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#0F6E56]" />
            <span>Change Password</span>
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">New Password *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="Enter new password (min 6 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all mt-2"
            >
              {passwordLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Company Info Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-4 h-4 text-[#0F6E56]" />
          <span>Vaniki Crop Science Company Information</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-800">Organization</span>
            <p>Vaniki Crop Science Ltd.</p>
          </div>
          <div>
            <span className="font-bold text-slate-800">System Version</span>
            <p>Vaniki Stock Trace WMS v1.0.0</p>
          </div>
          <div>
            <span className="font-bold text-slate-800">Support Email</span>
            <p>support@vanikicrop.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

