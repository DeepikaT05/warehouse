import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PurchaseEntry = lazy(() => import('./pages/PurchaseEntry'));
const QRPrintPage = lazy(() => import('./pages/QRPrintPage'));
const StockManagement = lazy(() => import('./pages/StockManagement'));
const ProductMaster = lazy(() => import('./pages/ProductMaster'));
const InvoiceUpload = lazy(() => import('./pages/InvoiceUpload'));
const BillHistory = lazy(() => import('./pages/BillHistory'));
const DealerMaster = lazy(() => import('./pages/DealerMaster'));
const DispatchVerify = lazy(() => import('./pages/DispatchVerify'));
const DeliveryStatement = lazy(() => import('./pages/DeliveryStatement'));
const ProductHistory = lazy(() => import('./pages/ProductHistory'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AssignedOrders = lazy(() => import('./pages/AssignedOrders'));
const DealerApprovalTracker = lazy(() => import('./pages/DealerApprovalTracker'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">
      Loading...
    </div>
  );
}

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
          <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/purchase" element={<AdminRoute><PurchaseEntry /></AdminRoute>} />
            <Route path="/qr-print" element={<AdminRoute><QRPrintPage /></AdminRoute>} />
            <Route path="/stock" element={<AdminRoute><StockManagement /></AdminRoute>} />
            <Route path="/products" element={<AdminRoute><ProductMaster /></AdminRoute>} />
            <Route path="/assigned-orders" element={<AssignedOrders />} />
            <Route path="/dealer-approval" element={<DealerApprovalTracker />} />
            <Route path="/invoices" element={<AdminRoute><InvoiceUpload /></AdminRoute>} />
            <Route path="/bill-history" element={<BillHistory />} />
            <Route path="/dealers" element={<AdminRoute><DealerMaster /></AdminRoute>} />
            <Route path="/dispatch-verify" element={<DispatchVerify />} />
            <Route path="/delivery-statement" element={<DeliveryStatement />} />
            <Route path="/history" element={<AdminRoute><ProductHistory /></AdminRoute>} />
            <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
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
