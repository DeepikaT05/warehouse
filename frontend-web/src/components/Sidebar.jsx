import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  PackagePlus,
  QrCode,
  Boxes,
  Users,
  CheckCircle2,
  Truck,
  History,
  BarChart3,
  PackageCheck,
  Settings,
  FileSpreadsheet,
  FileText,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-full flex flex-col justify-between p-4 no-print select-none shrink-0 overflow-y-auto">
      <div className="space-y-4">
        {/* Navigation Category Header */}
        <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#0F6E56] bg-emerald-50/80 border border-emerald-100 rounded-xl mb-3 flex items-center justify-between shadow-2xs">
          <span>{isAdmin ? 'ADMIN CONTROL PANEL' : 'WAREHOUSE OPERATIONS'}</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isAdmin ? 'text-purple-800 bg-purple-100' : 'text-emerald-800 bg-emerald-200'}`}>
            {isAdmin ? 'ADMIN' : 'WORKER'}
          </span>
        </div>

        <nav className="space-y-1">
          {/* Dashboard (common) */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </NavLink>

          {/* ADMIN ONLY MASTER CONTROLS */}
          {isAdmin ? (
            <>
              <NavLink
                to="/purchase"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>Purchase Entry & Inward</span>
              </NavLink>

              <NavLink
                to="/qr-print"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>QR Sticker Printing</span>
              </NavLink>

              <NavLink
                to="/stock"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Boxes className="w-4 h-4 shrink-0" />
                <span>Stock Inventory & Verification</span>
              </NavLink>

              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <PackageCheck className="w-4 h-4 shrink-0" />
                <span>Product Master Catalog</span>
              </NavLink>

              <NavLink
                to="/dealers"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Dealer Directory</span>
              </NavLink>

              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <History className="w-4 h-4 shrink-0" />
                <span>Product Traceability</span>
              </NavLink>

              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Activity Reports</span>
              </NavLink>

              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Admin Panel</span>
              </NavLink>
            </>
          ) : (
            /* WORKER ONLY DISPATCH WORKFLOW MENU ITEMS */
            <>
              <NavLink
                to="/assigned-orders"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#0F6E56]" />
                <span>Assigned Bills & Stock Picking</span>
              </NavLink>

              <NavLink
                to="/dispatch-verify"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0F6E56]" />
                <span>Dispatch Verification & QR Scan</span>
              </NavLink>

              <NavLink
                to="/delivery-statement"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Truck className="w-4 h-4 shrink-0 text-[#0F6E56]" />
                <span>Delivery Statements</span>
              </NavLink>

              <NavLink
                to="/dealer-approval"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                    isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <FileText className="w-4 h-4 shrink-0 text-[#0F6E56]" />
                <span>Dealer Approval & Bilty Status</span>
              </NavLink>
            </>
          )}

          {/* Common Settings Link */}
          <div className="pt-2 mt-2 border-t border-slate-100">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                  isActive ? 'bg-[#0F6E56] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>My Settings</span>
            </NavLink>
          </div>
        </nav>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center mt-4 shrink-0">
        <p className="text-xs font-extrabold text-slate-800">Vaniki Stock Trace v1.0</p>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">
          Role: <span className="font-bold text-[#0F6E56] uppercase">{user?.role || 'USER'}</span>
        </p>
      </div>
    </aside>
  );
}
