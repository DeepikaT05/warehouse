import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PurchaseEntry from './pages/PurchaseEntry';
import QRPrintPage from './pages/QRPrintPage';
import StockManagement from './pages/StockManagement';
import ProductMaster from './pages/ProductMaster';
import InvoiceUpload from './pages/InvoiceUpload';
import DealerMaster from './pages/DealerMaster';
import DispatchVerify from './pages/DispatchVerify';
import DeliveryStatement from './pages/DeliveryStatement';
import ProductHistory from './pages/ProductHistory';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';
import AdminPanel from './pages/AdminPanel';
import AssignedOrders from './pages/AssignedOrders';
import StockPicking from './pages/StockPicking';
import DealerApprovalTracker from './pages/DealerApprovalTracker';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
        Initializing Vaniki Stock Trace WMS System...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <Navbar />
      <div className="flex flex-1 h-[calc(100vh-61px)] overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto h-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/purchase" element={<AdminRoute><PurchaseEntry /></AdminRoute>} />
            <Route path="/qr-print" element={<AdminRoute><QRPrintPage /></AdminRoute>} />
            <Route path="/stock" element={<AdminRoute><StockManagement /></AdminRoute>} />
            <Route path="/products" element={<AdminRoute><ProductMaster /></AdminRoute>} />
            <Route path="/assigned-orders" element={<AssignedOrders />} />
            <Route path="/stock-picking/:id" element={<StockPicking />} />
            <Route path="/dealer-approval" element={<DealerApprovalTracker />} />
            <Route path="/invoices" element={<AdminRoute><InvoiceUpload /></AdminRoute>} />
            <Route path="/dealers" element={<AdminRoute><DealerMaster /></AdminRoute>} />
            <Route path="/dispatch-verify" element={<DispatchVerify />} />
            <Route path="/delivery-statement" element={<DeliveryStatement />} />
            <Route path="/history" element={<AdminRoute><ProductHistory /></AdminRoute>} />
            <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
