import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Search,
  Filter,
  History,
  Edit2,
  CheckCircle2,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  List,
  Package,
  Trash2,
  X
} from 'lucide-react';

export default function StockManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [boxes, setBoxes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Date Filter Defaults to 'all' so existing inventory is always loaded by default
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dateFilterMode, setDateFilterMode] = useState('all'); // 'all' | 'today' | 'custom'
  const [customDate, setCustomDate] = useState(todayStr);

  // Filters - Initialized from URL query params if present
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState(searchParams.get('purchaseInvoice') || '');
  const [product, setProduct] = useState('');
  const [batch, setBatch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [rack, setRack] = useState('');
  const [status, setStatus] = useState('');

  // Accordion State: { [invoiceNo]: boolean }
  const [expandedInvoices, setExpandedInvoices] = useState({});

  const [editingBox, setEditingBox] = useState(null);
  const [editLocation, setEditLocation] = useState('');

  const fetchStock = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (purchaseInvoiceFilter) params.purchaseInvoice = purchaseInvoiceFilter;
      if (product) params.product = product;
      if (batch) params.batch = batch;
      if (manufacturer) params.manufacturer = manufacturer;
      if (rack) params.rack = rack;
      if (status) params.status = status;

      // Apply Date Filter based on selected mode
      if (dateFilterMode === 'today') {
        params.date = todayStr;
      } else if (dateFilterMode === 'custom' && customDate) {
        params.date = customDate;
      }

      const res = await api.get('/stock', { params });
      if (res.data.success) {
        setBoxes(res.data.boxes);
        setSummary(res.data.summary);

        // Expand all invoices by default
        const initExpanded = {};
        res.data.boxes.forEach(b => {
          const invKey = b.purchaseInvoice || 'Unassigned';
          initExpanded[invKey] = true;
        });
        setExpandedInvoices(initExpanded);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlInvoice = searchParams.get('purchaseInvoice');
    const urlSearch = searchParams.get('search');
    if (urlInvoice !== null && urlInvoice !== purchaseInvoiceFilter) {
      setPurchaseInvoiceFilter(urlInvoice);
    }
    if (urlSearch !== null && urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchStock();
  }, [purchaseInvoiceFilter, product, batch, manufacturer, rack, status, dateFilterMode, customDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStock();
  };

  // Extract all unique Purchase Invoice IDs for the dropdown filter
  const uniqueInvoices = useMemo(() => {
    const set = new Set();
    boxes.forEach(b => {
      if (b.purchaseInvoice) set.add(b.purchaseInvoice);
    });
    return Array.from(set).sort();
  }, [boxes]);

  // Group boxes by Purchase Invoice ID
  const invoiceGroups = useMemo(() => {
    const map = new Map();
    boxes.forEach(box => {
      const invKey = box.purchaseInvoice || 'Unassigned Invoice';
      if (!map.has(invKey)) {
        map.set(invKey, {
          invoiceNo: invKey,
          productName: box.productName,
          batchNumber: box.batchNumber,
          weight: box.weight || '1 kg',
          boxes: []
        });
      }
      map.get(invKey).boxes.push(box);
    });
    return Array.from(map.values());
  }, [boxes]);

  const toggleInvoiceExpand = (invoiceNo) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [invoiceNo]: !prev[invoiceNo]
    }));
  };

  const toggleExpandAll = (expand) => {
    const newStates = {};
    invoiceGroups.forEach(g => {
      newStates[g.invoiceNo] = expand;
    });
    setExpandedInvoices(newStates);
  };

  const handleSaveRack = async (boxId) => {
    if (!isAdmin) {
      alert('Permission Denied! Editing stock rack locations is restricted to Admin.');
      return;
    }
    try {
      const res = await api.put(`/stock/${boxId}`, { warehouseLocation: editLocation });
      if (res.data.success) {
        setEditingBox(null);
        fetchStock();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBox = async (boxId, qrId) => {
    if (!window.confirm(`Are you sure you want to delete stock box QR "${qrId}"?`)) return;
    try {
      const res = await api.delete(`/stock/${boxId}`);
      if (res.data.success) {
        fetchStock();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteInvoice = async (invoiceNo) => {
    if (!window.confirm(`Are you sure you want to delete ALL stock boxes for Purchase Invoice "${invoiceNo}"?`)) return;
    try {
      const res = await api.delete(`/stock/invoice/${encodeURIComponent(invoiceNo)}`);
      if (res.data.success) {
        fetchStock();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#0F6E56]" />
            <span>Stock Inventory Verification & Tracking</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Grouped by Purchase Invoice with Accordion Dropdowns & Date Filtering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleExpandAll(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={() => toggleExpandAll(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-bold">
        <div 
          onClick={() => setStatus('')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === '' ? 'bg-[#0F6E56] text-white border-[#0F6E56] shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Total Stock</span>
          <p className="text-xl font-black mt-1">{summary?.total || 0}</p>
        </div>

        <div 
          onClick={() => setStatus('available')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'available' ? 'bg-[#1D9E75] text-white border-[#1D9E75] shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Available</span>
          <p className="text-xl font-black mt-1">{summary?.available || 0}</p>
        </div>

        <div 
          onClick={() => setStatus('reserved')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'reserved' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Reserved</span>
          <p className="text-xl font-black mt-1">{summary?.reserved || 0}</p>
        </div>

        <div 
          onClick={() => setStatus('dispatched')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'dispatched' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Dispatched</span>
          <p className="text-xl font-black mt-1">{summary?.dispatched || 0}</p>
        </div>

        <div 
          onClick={() => setStatus('returned')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'returned' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Returned</span>
          <p className="text-xl font-black mt-1">{summary?.returned || 0}</p>
        </div>
      </div>

      {/* Filter Toolbar with Purchase Invoice Dropdown & Date Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-slate-800">
            <Filter className="w-4 h-4 text-[#0F6E56]" />
            <span>Stock Search & Invoice Filters</span>
          </div>

          {/* Date Filter Modes (Default: Today) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-bold border border-slate-200">
            <button
              onClick={() => setDateFilterMode('today')}
              className={`px-3 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
                dateFilterMode === 'today'
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Today (Default)</span>
            </button>
            <button
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1 rounded-lg text-xs transition-all ${
                dateFilterMode === 'all'
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => setDateFilterMode('custom')}
              className={`px-3 py-1 rounded-lg text-xs transition-all ${
                dateFilterMode === 'custom'
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Date
            </button>

            {dateFilterMode === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs text-slate-800 focus:outline-none"
              />
            )}
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
          {/* Main Search */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search QR ID, Barcode, Product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          {/* MAIN PURCHASE INVOICE ID DROPDOWN FILTER */}
          <div className="relative">
            <select
              value={purchaseInvoiceFilter}
              onChange={(e) => setPurchaseInvoiceFilter(e.target.value)}
              className="w-full bg-emerald-50/70 border border-emerald-200 text-[#0F6E56] font-extrabold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] cursor-pointer"
            >
              <option value="">All Purchase Invoice IDs</option>
              {uniqueInvoices.map((inv) => (
                <option key={inv} value={inv}>
                  Invoice: {inv}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <input
            type="text"
            placeholder="By Product..."
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />

          {/* Batch Filter */}
          <input
            type="text"
            placeholder="By Batch..."
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="dispatched">Dispatched</option>
            <option value="returned">Returned</option>
          </select>
        </form>
      </div>

      {/* Accordion Expandable Invoice Table Container (Matching Reference Layout) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">
            Loading Stock Inventory Accordion...
          </div>
        ) : (
          <div className="space-y-3">
            {invoiceGroups.map((group) => {
              const isExpanded = expandedInvoices[group.invoiceNo] !== false;
              const availableCount = group.boxes.filter(b => b.status === 'available').length;

              return (
                <div
                  key={group.invoiceNo}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all hover:border-slate-300"
                >
                  {/* Main Accordion Row Header (Matching Reference Design) */}
                  <div
                    onClick={() => toggleInvoiceExpand(group.invoiceNo)}
                    className="p-4 bg-slate-50/90 hover:bg-slate-100/90 cursor-pointer flex items-center justify-between gap-4 select-none transition-colors border-b border-slate-100"
                  >
                    {/* Left: Expand Arrow + Invoice Info */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-800 p-1 rounded-lg transition-transform"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-[#0F6E56]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-[#0F6E56] flex items-center justify-center font-black">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 font-mono tracking-tight">
                            Purchase Invoice: <span className="text-[#0F6E56]">{group.invoiceNo}</span>
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Product: <strong className="text-slate-800">{group.productName}</strong> | Batch: <strong className="font-mono text-slate-700">{group.batchNumber}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Middle: Request/Box Count Badge */}
                    <div className="hidden md:block text-center">
                      <span className="text-xs font-bold text-slate-500">
                        {group.boxes.length} stock box{group.boxes.length === 1 ? '' : 'es'}
                      </span>
                    </div>

                    {/* Right: Delete Invoice Button (Admin Only) + Available / Total Badges */}
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(group.invoiceNo);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                          title="Delete all stock for this purchase invoice (Admin Only)"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden md:inline">Delete Invoice</span>
                        </button>
                      )}

                      <div className="text-right hidden sm:block">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-[#0F6E56]">
                          {group.boxes.length} Boxes Total
                        </span>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {availableCount} Available
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Dropdown Inner Details Table */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-3">
                      <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>STOCK BOX DETAILS FOR INVOICE #{group.invoiceNo}</span>
                        <span className="text-slate-400">Total {group.boxes.length} QR Stickers</span>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">QR ID</th>
                              <th className="py-2.5 px-3">Product Name</th>
                              <th className="py-2.5 px-3">Batch Number</th>
                              <th className="py-2.5 px-3">Weight</th>
                              <th className="py-2.5 px-3">Warehouse Rack</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.boxes.map((box) => (
                              <tr key={box._id} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="py-3 px-3 font-mono font-extrabold text-[#0F6E56]">
                                  {box.qrId}
                                </td>
                                <td className="py-3 px-3 font-bold text-slate-900">
                                  {box.productName}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-600">
                                  {box.batchNumber}
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  {box.weight || '1 kg'}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700">
                                  {editingBox === box._id && isAdmin ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={editLocation}
                                        onChange={(e) => setEditLocation(e.target.value)}
                                        className="w-24 bg-white border border-[#0F6E56] px-1.5 py-0.5 text-xs rounded"
                                      />
                                      <button
                                        onClick={() => handleSaveRack(box._id)}
                                        className="text-emerald-700 hover:text-emerald-900 font-bold p-0.5"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span>{box.warehouseLocation}</span>
                                      {isAdmin && (
                                        <button
                                          onClick={() => {
                                            setEditingBox(box._id);
                                            setEditLocation(box.warehouseLocation);
                                          }}
                                          className="text-slate-400 hover:text-[#0F6E56] p-0.5"
                                          title="Edit Rack Location (Admin Only)"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <StatusBadge status={box.status} />
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/history?qr=${box.qrId}`)}
                                      className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1 inline-flex"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      <span>Trace</span>
                                    </button>

                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBox(box._id, box.qrId)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                        title="Delete this stock box (Admin Only)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {invoiceGroups.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                No purchase invoice stock records match your filter criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}




