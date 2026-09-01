import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Plus,
  Upload,
  Play,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Package,
  X,
  FileText,
  User,
  Building2
} from 'lucide-react';

export default function AssignedOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Admin Bill Upload Form Toggle & State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tallyFileName, setTallyFileName] = useState('');

  const initialBillState = {
    invoiceNo: '',
    orderId: '',
    dealerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [
      { productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }
    ]
  };

  const [billForm, setBillForm] = useState(initialBillState);

  useEffect(() => {
    fetchOrders();
    fetchDealers();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/orders', { params: { status: statusFilter } });
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Fetch assigned orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDealers = async () => {
    try {
      const res = await api.get('/dealers');
      if (res.data.success) {
        setDealers(res.data.dealers);
      }
    } catch (err) {
      console.error('Fetch dealers error:', err);
    }
  };

  // Bill Upload Form Handlers
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billForm.items];
    updatedItems[index][field] = value;
    setBillForm({ ...billForm, items: updatedItems });
  };

  const handleAddItemRow = () => {
    setBillForm({
      ...billForm,
      items: [...billForm.items, { productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }]
    });
  };

  const handleRemoveItemRow = (index) => {
    if (billForm.items.length === 1) return;
    const updatedItems = billForm.items.filter((_, idx) => idx !== index);
    setBillForm({ ...billForm, items: updatedItems });
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTallyFileName(file.name);
      // Auto-generate invoice/order numbers for simulation
      setBillForm(prev => ({
        ...prev,
        invoiceNo: `TALLY-${Math.floor(1000 + Math.random() * 9000)}`,
        orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`
      }));
    }
  };

  const handleCreateBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.dealerId) {
      alert('Please select a dealer from the dropdown!');
      return;
    }

    setUploading(true);
    try {
      const res = await api.post('/invoices', billForm);
      if (res.data.success) {
        alert(`Sales Bill #${billForm.invoiceNo} uploaded and assigned to warehouse operator!`);
        setShowUploadForm(false);
        setBillForm(initialBillState);
        setTallyFileName('');
        fetchOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStartPicking = async (orderId) => {
    try {
      await api.post(`/user/orders/${orderId}/start-picking`);
      navigate(`/stock-picking/${orderId}`);
    } catch (err) {
      navigate(`/stock-picking/${orderId}`);
    }
  };

  const getStatusBadge = (orderStatus) => {
    switch (orderStatus) {
      case 'new':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">NEW ASSIGNED BILL</span>;
      case 'viewed':
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">VIEWED</span>;
      case 'picking_started':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">PICKING IN PROGRESS</span>;
      case 'picking_completed':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">PICKING COMPLETED</span>;
      case 'warehouse_verified':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">WAREHOUSE VERIFIED</span>;
      case 'invoice_generated':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">INVOICE GENERATED</span>;
      case 'sent_to_dealer':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">SENT TO DEALER</span>;
      case 'dealer_approved':
      case 'completed':
        return <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">COMPLETED</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">{orderStatus?.toUpperCase()}</span>;
    }
  };

  const filteredOrders = orders.filter(o => 
    !search ||
    o.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    o.dealerName.toLowerCase().includes(search.toLowerCase()) ||
    (o.garageName && o.garageName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#0F6E56]" />
            <span>Assigned Dealer Bills & Orders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Admin uploads dealer bills here, which appear on the warehouse user panel for instant stock picking and scan verification.
          </p>
        </div>

        {/* Admin Only Bill Upload Action */}
        {isAdmin && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            {showUploadForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showUploadForm ? 'Close Bill Form' : 'Upload / Log New Sales Bill'}</span>
          </button>
        )}
      </div>

      {/* Admin Bill Upload Expandable Form (Admin Only) */}
      {isAdmin && showUploadForm && (
        <form onSubmit={handleCreateBillSubmit} className="bg-white border-2 border-[#0F6E56] rounded-2xl p-6 shadow-lg space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-sm text-[#0F6E56] flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Admin Sales Bill Upload & Assignment</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Assigns order directly to warehouse panel</span>
          </div>

          {/* Tally File Drag & Drop Box */}
          <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-4 text-center">
            <Upload className="w-6 h-6 text-[#0F6E56] mx-auto mb-1" />
            <p className="text-xs font-bold text-slate-800">Upload Tally Export / Excel Bill Document</p>
            <input
              type="file"
              id="tally-file-assigned"
              className="hidden"
              accept=".xlsx,.xls,.csv,.pdf,.xml"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="tally-file-assigned"
              className="mt-2 inline-block bg-white border border-emerald-300 text-[#0F6E56] font-bold text-xs px-4 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              {tallyFileName ? `File: ${tallyFileName}` : 'Choose Tally / Excel File'}
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                value={billForm.invoiceNo}
                onChange={(e) => setBillForm({ ...billForm, invoiceNo: e.target.value })}
                placeholder="e.g. SL-INV-2026-901"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Order ID</label>
              <input
                type="text"
                value={billForm.orderId}
                onChange={(e) => setBillForm({ ...billForm, orderId: e.target.value })}
                placeholder="e.g. ORD-8812"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Assign Dealer / Garage *</label>
              <select
                required
                value={billForm.dealerId}
                onChange={(e) => setBillForm({ ...billForm, dealerId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              >
                <option value="">-- Select Dealer Master --</option>
                {dealers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.dealerName} ({d.garageName}) - {d.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-slate-700">Products & Quantities to Pick</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            {billForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="col-span-5">
                  <input
                    type="text"
                    required
                    placeholder="Product Name"
                    value={item.productName}
                    onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-3">
                  <input
                    type="text"
                    required
                    placeholder="Batch Number"
                    value={item.batchNumber}
                    onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="text-red-500 hover:text-red-700 font-bold text-xs p-1"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{uploading ? 'Uploading Bill...' : 'Save & Assign Bill to User Panel'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search order number, dealer name, garage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] w-full md:w-auto focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
        >
          <option value="">All Order Statuses</option>
          <option value="new">New Assigned Orders</option>
          <option value="picking_started">Picking in Progress</option>
          <option value="picking_completed">Picking Completed</option>
          <option value="sent_to_dealer">Sent to Dealer</option>
          <option value="completed">Completed Orders</option>
        </select>
      </div>

      {/* User Panel: Assigned Orders List with Pick Order Buttons */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading assigned dealer bills...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-medium">
            No assigned dealer bills match your search criteria. Click "Upload / Log New Sales Bill" above to add one.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const totalItems = order.items?.reduce((acc, i) => acc + (i.quantity || i.requestedQuantity || 0), 0) || 0;
            const totalPicked = order.pickedItems?.length || 0;
            const isPickingDone = (totalItems > 0 && totalPicked >= totalItems) || ['picking_completed', 'warehouse_verified', 'invoice_generated', 'sent_to_dealer', 'completed'].includes(order.orderStatus);

            return (
              <div key={order._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-emerald-300 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-[#0F6E56]">Bill #{order.invoiceNo}</span>
                      {getStatusBadge(order.orderStatus)}
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#0F6E56]" />
                      <span>Dealer: {order.dealerName} {order.garageName ? `(${order.garageName})` : ''}</span>
                    </p>
                  </div>

                  {/* PROMINENT PICK ORDER BUTTON / PICKING COMPLETED BADGE */}
                  <div className="flex items-center gap-2">
                    {isPickingDone ? (
                      <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-4 py-2.5 rounded-xl border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Picking Completed</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartPicking(order._id)}
                        className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 animate-pulse"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>{order.orderStatus === 'new' || order.orderStatus === 'viewed' ? 'Pick Order (Start Scanning)' : 'Continue Picking Order'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/dispatch-verify?orderId=${order._id}`)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify & Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Product lines summary & Picking Progress */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Assigned Products & Quantities:</span>
                    <ul className="mt-1 space-y-1 font-semibold text-slate-700">
                      {order.items?.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <span>{item.productName} (Batch: {item.batchNumber})</span>
                          <strong className="text-[#0F6E56] font-bold">{(item.quantity || item.requestedQuantity || 0)} units</strong>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Stock Picking Progress:</span>
                    <div className="mt-1.5 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div
                        className="bg-[#0F6E56] h-full rounded-full transition-all"
                        style={{ width: `${totalItems > 0 ? Math.min(100, (totalPicked / totalItems) * 100) : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] font-extrabold text-slate-700 mt-1">
                      {totalPicked} of {totalItems} units picked ({totalItems > 0 ? Math.round((totalPicked / totalItems) * 100) : 0}%)
                    </p>
                  </div>

                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Bill Date:</span>
                      <p className="font-bold text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>

                    {order.dealerApproved && (
                      <span className="text-emerald-700 font-extrabold text-[11px]">
                        ✓ Dealer Approved receiving on {new Date(order.dealerApprovedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
