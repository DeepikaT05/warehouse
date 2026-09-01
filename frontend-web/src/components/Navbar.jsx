import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Shield, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlobalSearchDropdown from './GlobalSearchDropdown';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Brand Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-[#0F6E56] text-white p-2.5 rounded-xl shadow-md flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">
              VANIKI <span className="text-[#0F6E56]">STOCK TRACE</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Warehouse Inventory & QR Verification</p>
          </div>
        </div>

        {/* Live Multi-Entity Autocomplete Search Dropdown */}
        <div className="hidden md:block w-96">
          <GlobalSearchDropdown placeholder="Search product, QR ID, invoice, dealer (live)..." />
        </div>

        {/* User Profile & Role Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-100">
            <div className="w-7 h-7 rounded-full bg-[#0F6E56] text-white flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">{user?.name || 'User'}</p>
              <span className="text-[10px] font-semibold tracking-wide uppercase text-[#0F6E56] bg-emerald-100/60 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                {user?.role || 'Operator'}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
