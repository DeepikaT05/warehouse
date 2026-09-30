import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Package,
  Search,
  Filter,
  History,
  Edit2,
  CheckCircle2,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw
} from 'lucide-react';

export function getPiecesPerPeti(packing) {
  if (!packing) return 10;
  const p = packing.toString().toUpperCase().trim();
  if (p.includes('160 GM') || p.includes('160GM') || p.includes('CURVE')) return 8;
  if (p.includes('1 LTR') || p.includes('1 LT') || p.includes('1 KG') || p.includes('1KG')) return 10;
  if (p.includes('500 ML') || p.includes('500 GM') || p.includes('500GM') || p.includes('500ML')) return 20;
  if (p.includes('250 ML') || p.includes('250 GM') || p.includes('250GM') || p.includes('250ML')) return 40;
  if (p.includes('100 ML') || p.includes('100 GM') || p.includes('100GM') || p.includes('100ML')) return 50;
  if (p.includes('150 ML') || p.includes('200 ML')) return 20;
  if (p.includes('300 ML') || p.includes('300 GM') || p.includes('400 ML') || p.includes('800 ML')) return 20;
  if (p.includes('4 KG') || p.includes('5 KG') || p.includes('4KG') || p.includes('5KG')) return 4;
  if (p.includes('8 GM') || p.includes('15 ML') || p.includes('30 GM') || p.includes('50 GM') || p.includes('75 GM')) return 100;
  return 10;
}

export function parsePetiWeights(packing, pcsPerPeti, totalCases, rawWeight) {
  let unitKgLtr = 1;
  let isLtr = true;
  const pMatch = (packing || '').match(/([\d.]+)\s*(LTR|LT|L\b|ML|GM|G\b|KG|KGS|BAG)/i);
  if (pMatch) {
    const val = parseFloat(pMatch[1]);
    const u = pMatch[2].toUpperCase();
    if (u === 'ML') {
      unitKgLtr = val / 1000;
      isLtr   = true;
    } else if (u === 'GM' || u === 'G') {
      unitKgLtr = val / 1000;
      isLtr = false;
    } else if (u.includes('LT') || u === 'L') {
      unitKgLtr = val;
      isLtr = true;
    } else {
      unitKgLtr = val;
      isLtr = false;
    }
  }

  const effConv = (pcsPerPeti && Number(pcsPerPeti) > 0) ? Number(pcsPerPeti) : 10;
  const numCases = Number(totalCases) > 0 ? Number(totalCases) : 1;
  let unitLabel = isLtr ? 'LTR' : 'KG';

  let totalVolNum = 0;
  let totalVolStr = '';
  if (rawWeight && String(rawWeight).match(/\d/)) {
    const rm = String(rawWeight).match(/([\d.]+)\s*([A-Za-z]+)?/);
    if (rm) {
      totalVolNum = parseFloat(rm[1]);
      const u = rm[2] ? rm[2].toUpperCase() : unitLabel;
      unitLabel = u.includes('LT') ? 'LTR' : (u.includes('KG') ? 'KG' : u);
      totalVolStr = `${totalVolNum} ${unitLabel}`;
    }
  }

  let caseWtNum = 0;
  if (totalVolNum > 0 && numCases > 0) {
    caseWtNum = Math.round((totalVolNum / numCases) * 1000) / 1000;
  } else {
    caseWtNum = Math.round(unitKgLtr * effConv * 1000) / 1000;
    totalVolNum = Math.round(caseWtNum * numCases * 1000) / 1000;
    totalVolStr = `${totalVolNum} ${unitLabel}`;
  }

  const caseWtStr = `${caseWtNum} ${unitLabel}`;

  return { caseWtStr, totalVolStr, unitLabel, caseWtNum };
}

export function groupBoxesIntoPetis(boxes, invoiceCases, packing, conversion, rawWeight) {
  if (!boxes || boxes.length === 0) return [];
  let pcsPerPeti = 0;
  if (conversion && Number(conversion) > 0) {
    pcsPerPeti = Number(conversion);
  } else {
    const boxWithConv = boxes.find(b => b.conversion && Number(b.conversion) > 0);
    if (boxWithConv) {
      pcsPerPeti = Number(boxWithConv.conversion);
    } else {
      pcsPerPeti = getPiecesPerPeti(packing || boxes[0]?.packing || boxes[0]?.weight);
    }
  }
  if (!pcsPerPeti || pcsPerPeti <= 0) pcsPerPeti = 10;

  const pw = parsePetiWeights(packing, pcsPerPeti, invoiceCases, rawWeight || '');
  const petis = [];
  for (let i = 0; i < boxes.length; i += pcsPerPeti) {
    const chunk = boxes.slice(i, i + pcsPerPeti);
    const petiNum = Math.floor(i / pcsPerPeti) + 1;
    const availableCount = chunk.filter(b => b.status === 'available').length;
    petis.push({
      petiNumber: petiNum,
      petiTitle: `Peti #${petiNum}`,
      petiWeight: pw.caseWtStr,
      totalPieces: chunk.length,
      availablePieces: availableCount,
      firstQr: chunk[0]?.qrId,
      lastQr: chunk[chunk.length - 1]?.qrId,
      boxes: chunk
    });
  }
  return petis;
}

const SUMMARY_CACHE_KEY = 'vaniki_stock_summary_cache_v9';
const BOXES_CACHE_PREFIX = 'vaniki_stock_boxes_v9_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory fallback
let memSummaryCache = null;
const memBoxesCache = new Map();

function getCachedSummary() {
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('vaniki_stock_') && !k.includes('_v9')) {
        sessionStorage.removeItem(k);
      }
    });
    const raw = sessionStorage.getItem(SUMMARY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (e) {}
  if (memSummaryCache && Date.now() - memSummaryCache.timestamp < CACHE_TTL_MS) {
    return memSummaryCache.data;
  }
  return null;
}

function setCachedSummary(data) {
  const payload = { timestamp: Date.now(), data };
  memSummaryCache = payload;
  try {
    sessionStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function getCachedInvoiceBoxes(invoiceNo) {
  try {
    const raw = sessionStorage.getItem(BOXES_CACHE_PREFIX + invoiceNo);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.boxes)) {
        return parsed.boxes;
      }
    }
  } catch (e) {}
  if (memBoxesCache.has(invoiceNo)) {
    const item = memBoxesCache.get(invoiceNo);
    if (Date.now() - item.timestamp < CACHE_TTL_MS) {
      return item.boxes;
    }
  }
  return null;
}

function setCachedInvoiceBoxes(invoiceNo, boxes) {
  memBoxesCache.set(invoiceNo, { timestamp: Date.now(), boxes });
  try {
    sessionStorage.setItem(BOXES_CACHE_PREFIX + invoiceNo, JSON.stringify({
      timestamp: Date.now(),
      boxes
    }));
  } catch (e) {}
}

function clearAllStockCache() {
  memSummaryCache = null;
  memBoxesCache.clear();
  try {
    sessionStorage.removeItem(SUMMARY_CACHE_KEY);
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith(BOXES_CACHE_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    });
  } catch (e) {}
}

// Smart search matcher with phonetic support (e.g. veda <-> vida, vigen <-> vegen)
export function matchesSearch(text, term) {
  if (!term || !term.trim()) return true;
  if (!text) return false;

  const tOrig = text.toString().toLowerCase();
  const qOrig = term.toString().toLowerCase().trim();
  if (tOrig.includes(qOrig)) return true;

  const normalizePhonetics = (str) =>
    str
      .replace(/v[ei]+da|w[ei]+da/gi, 'vida')
      .replace(/v[ei]+gen|w[ei]+gen/gi, 'vigen');

  const clean = (str) =>
    normalizePhonetics(str)
      .replace(/[-_.,/()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tClean = clean(tOrig);
  const qClean = clean(qOrig);

  if (tClean.includes(qClean)) return true;

  // Also alphanumeric condensed match (e.g. 'vida70' matching 'vida-70' or 'vida 70')
  const tAlpha = tOrig.replace(/[^a-z0-9]/g, '').replace(/v[ei]+da|w[ei]+da/gi, 'vida');
  const qAlpha = qOrig.replace(/[^a-z0-9]/g, '').replace(/v[ei]+da|w[ei]+da/gi, 'vida');
  if (qAlpha && tAlpha.includes(qAlpha)) return true;

  // Multi-token: all tokens in search query must match
  const tokens = qClean.split(' ').filter(Boolean);
  if (tokens.length > 0) {
    const allMatch = tokens.every(tok => {
      const tokAlpha = tok.replace(/[^a-z0-9]/g, '');
      return tClean.includes(tok) || tOrig.includes(tok) || (tokAlpha && tAlpha.includes(tokAlpha));
    });
    if (allMatch) return true;
  }

  return false;
}

export default function StockManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Read initial data from cache if available for instant 0ms render
  const initialCache = useMemo(() => getCachedSummary(), []);

  const [invoices, setInvoices] = useState(() => initialCache?.invoices || []);
  const [summary, setSummary] = useState(() => initialCache?.summary || null);
  const [loading, setLoading] = useState(() => !initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Boxes loaded on demand per invoice: { [invoiceNo]: Array<Box> }
  const [invoiceBoxes, setInvoiceBoxes] = useState({});
  const [loadingBoxes, setLoadingBoxes] = useState({});

  // Accordion State: { [invoiceNo]: boolean } - COLLAPSED BY DEFAULT
  const [expandedInvoices, setExpandedInvoices] = useState({});

  // Peti-level Accordion State: { [`${invoiceNo}_p_${petiNum}`]: boolean }
  const [expandedPetis, setExpandedPetis] = useState({});

  const togglePetiExpand = (invoiceNo, petiNum) => {
    const key = `${invoiceNo}_p_${petiNum}`;
    setExpandedPetis(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllPetisInInvoice = (invoiceNo, petis, expand) => {
    const updates = {};
    petis.forEach(p => {
      updates[`${invoiceNo}_p_${p.petiNumber}`] = expand;
    });
    setExpandedPetis(prev => ({ ...prev, ...updates }));
  };

  // Search Results mode (when user searches a specific QR / Barcode)
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchedBoxes, setSearchedBoxes] = useState([]);

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

  const [editingBox, setEditingBox] = useState(null);
  const [editLocation, setEditLocation] = useState('');

  // Check if current filter is default state
  const isDefaultFilters = useCallback(() => {
    return (
      !search &&
      !purchaseInvoiceFilter &&
      !product &&
      !batch &&
      !manufacturer &&
      !rack &&
      !status &&
      dateFilterMode === 'all'
    );
  }, [search, purchaseInvoiceFilter, product, batch, manufacturer, rack, status, dateFilterMode]);

  // Main stock fetch function
  const fetchStock = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      clearAllStockCache();
      setIsRefreshing(true);
    } else if (!initialCache && !summary) {
      setLoading(true);
    }

    try {
      // 1. If searching for a specific QR, barcode, or text keyword:
      if (search && search.trim()) {
        setIsSearchMode(true);
        const res = await api.get('/stock', {
          params: {
            search: search.trim(),
            purchaseInvoice: purchaseInvoiceFilter || undefined,
            product: product || undefined,
            batch: batch || undefined,
            manufacturer: manufacturer || undefined,
            rack: rack || undefined,
            status: status || undefined,
            limit: 1000
          }
        });
        if (res.data?.success) {
          const found = res.data.boxes || [];
          setSearchedBoxes(found);
          if (res.data.summary) setSummary(res.data.summary);

          // Auto-expand invoices that contain search results
          const autoExpand = {};
          found.forEach(b => {
            const inv = b.purchaseInvoice || 'Unassigned';
            autoExpand[inv] = true;
          });
          setExpandedInvoices(autoExpand);
        }
        return;
      }

      setIsSearchMode(false);

      // 2. Check cache if default filters and not forced
      if (!forceRefresh && isDefaultFilters()) {
        const cached = getCachedSummary();
        if (cached && cached.invoices && cached.invoices.length > 0) {
          setInvoices(cached.invoices);
          setSummary(cached.summary);
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      // 3. Otherwise fetch invoices summary from lightweight endpoint (~15KB, ~40ms)
      const params = {};
      if (purchaseInvoiceFilter) params.purchaseInvoice = purchaseInvoiceFilter;
      if (product) params.product = product;
      if (batch) params.batch = batch;
      if (manufacturer) params.manufacturer = manufacturer;
      if (rack) params.rack = rack;
      if (status) params.status = status;

      if (dateFilterMode === 'today') {
        params.date = todayStr;
      } else if (dateFilterMode === 'custom' && customDate) {
        params.date = customDate;
      }

      const res = await api.get('/stock/invoices-summary', { params });
      if (res.data?.success) {
        const invs = res.data.invoices || [];
        const summ = res.data.summary || null;

        setInvoices(invs);
        setSummary(summ);

        // Cache if default filters
        if (isDefaultFilters()) {
          setCachedSummary({ invoices: invs, summary: summ });
        }
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    search,
    purchaseInvoiceFilter,
    product,
    batch,
    manufacturer,
    rack,
    status,
    dateFilterMode,
    customDate,
    todayStr,
    isDefaultFilters,
    initialCache,
    summary
  ]);

  // Sync URL search params
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

  // Fetch when filters change
  useEffect(() => {
    fetchStock();
  }, [purchaseInvoiceFilter, product, batch, manufacturer, rack, status, dateFilterMode, customDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStock();
  };

  const handleManualRefresh = () => {
    fetchStock(true);
  };

  // Unique Invoices for the top dropdown filter
  const uniqueInvoices = useMemo(() => {
    const set = new Set();
    invoices.forEach(inv => {
      if (inv.invoiceNo) set.add(inv.invoiceNo);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Group search results by invoice if in search mode
  const searchInvoiceGroups = useMemo(() => {
    if (!isSearchMode) return [];
    const map = new Map();
    searchedBoxes.forEach(box => {
      const invKey = box.purchaseInvoice || 'Unassigned';
      if (!map.has(invKey)) {
        map.set(invKey, {
          invoiceNo: invKey,
          productName: box.productName,
          batchNumber: box.batchNumber,
          packing: box.packing || box.weight || '1 kg',
          weight: box.weight || box.packing || '1 kg',
          warehouseLocation: box.warehouseLocation || 'RAIPUR GODOWN',
          totalBoxes: 0,
          availableBoxes: 0,
          conversion: Number(box.conversion) || 0,
          boxes: []
        });
      }
      const grp = map.get(invKey);
      grp.boxes.push(box);
      grp.totalBoxes += 1;
      if (box.status === 'available') grp.availableBoxes += 1;
      if (!grp.conversion && box.conversion && Number(box.conversion) > 0) {
        grp.conversion = Number(box.conversion);
      }
      const pcsPerPeti = grp.conversion || (box.conversion && Number(box.conversion)) || getPiecesPerPeti(grp.packing || grp.weight);
      grp.conversion = pcsPerPeti;
      grp.petiCount = Math.max(1, Math.ceil(grp.totalBoxes / pcsPerPeti));
    });
    return Array.from(map.values());
  }, [isSearchMode, searchedBoxes]);

  // Display groups: either search groups or the invoice summaries, filtered instantly by search input in real time
  const displayGroups = useMemo(() => {
    if (search && search.trim()) {
      const term = search.trim();
      if (isSearchMode && searchInvoiceGroups.length > 0) {
        return searchInvoiceGroups.filter(group => {
          const combined = `${group.invoiceNo || ''} ${group.productName || ''} ${group.batchNumber || ''} ${group.packing || ''} ${group.warehouseLocation || ''} ${group.weight || ''} ${group.firstQr || ''} ${group.lastQr || ''}`;
          return matchesSearch(combined, term);
        });
      }
      return invoices.filter(group => {
        const combined = `${group.invoiceNo || ''} ${group.productName || ''} ${group.batchNumber || ''} ${group.packing || ''} ${group.warehouseLocation || ''} ${group.weight || ''} ${group.firstQr || ''} ${group.lastQr || ''}`;
        return matchesSearch(combined, term);
      });
    }

    return invoices;
  }, [isSearchMode, searchInvoiceGroups, invoices, search]);

  // Toggle single accordion on click/tap - Loads boxes on demand!
  const toggleInvoiceExpand = async (invoiceNo) => {
    const nextState = !expandedInvoices[invoiceNo];
    setExpandedInvoices(prev => ({
      ...prev,
      [invoiceNo]: nextState
    }));

    // If expanding, fetch/load boxes for this invoice if not yet loaded
    if (nextState && !isSearchMode) {
      if (invoiceBoxes[invoiceNo] && invoiceBoxes[invoiceNo].length > 0) {
        return;
      }

      // Check cache first
      const cached = getCachedInvoiceBoxes(invoiceNo);
      if (cached && cached.length > 0) {
        setInvoiceBoxes(prev => ({ ...prev, [invoiceNo]: cached }));
        return;
      }

      // Fetch on demand
      setLoadingBoxes(prev => ({ ...prev, [invoiceNo]: true }));
      try {
        const res = await api.get('/stock', {
          params: { purchaseInvoice: invoiceNo, limit: 2000 }
        });
        if (res.data?.success) {
          const fetched = res.data.boxes || [];
          setInvoiceBoxes(prev => ({ ...prev, [invoiceNo]: fetched }));
          setCachedInvoiceBoxes(invoiceNo, fetched);
        }
      } catch (err) {
        console.error(`Failed to fetch boxes for invoice ${invoiceNo}:`, err);
      } finally {
        setLoadingBoxes(prev => ({ ...prev, [invoiceNo]: false }));
      }
    }
  };

  const toggleExpandAll = async (expand) => {
    const newStates = {};
    displayGroups.forEach(g => {
      newStates[g.invoiceNo] = expand;
    });
    setExpandedInvoices(newStates);

    // If expanding all and not in search mode, optionally fetch first few uncached
    if (expand && !isSearchMode) {
      for (const g of displayGroups.slice(0, 10)) {
        if (!invoiceBoxes[g.invoiceNo]) {
          const cached = getCachedInvoiceBoxes(g.invoiceNo);
          if (cached) {
            setInvoiceBoxes(prev => ({ ...prev, [g.invoiceNo]: cached }));
          } else {
            api.get('/stock', { params: { purchaseInvoice: g.invoiceNo, limit: 1000 } })
              .then(res => {
                if (res.data?.success) {
                  const b = res.data.boxes || [];
                  setInvoiceBoxes(prev => ({ ...prev, [g.invoiceNo]: b }));
                  setCachedInvoiceBoxes(g.invoiceNo, b);
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  };

  const handleSaveRack = async (boxId, invoiceNo) => {
    if (!isAdmin) {
      alert('Permission Denied! Editing stock rack locations is restricted to Admin.');
      return;
    }
    try {
      const res = await api.put(`/stock/${boxId}`, { warehouseLocation: editLocation });
      if (res.data?.success) {
        setEditingBox(null);
        // Invalidate cache for this invoice
        if (invoiceNo) {
          try {
            sessionStorage.removeItem(BOXES_CACHE_PREFIX + invoiceNo);
            memBoxesCache.delete(invoiceNo);
          } catch (e) {}
          // Update in state
          setInvoiceBoxes(prev => {
            const list = prev[invoiceNo] || [];
            return {
              ...prev,
              [invoiceNo]: list.map(b => b._id === boxId ? { ...b, warehouseLocation: editLocation } : b)
            };
          });
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteBox = async (boxId, qrId, invoiceNo) => {
    if (!window.confirm(`Are you sure you want to delete stock box QR "${qrId}"?`)) return;
    try {
      const res = await api.delete(`/stock/${boxId}`);
      if (res.data?.success) {
        if (invoiceNo) {
          try {
            sessionStorage.removeItem(BOXES_CACHE_PREFIX + invoiceNo);
            sessionStorage.removeItem(SUMMARY_CACHE_KEY);
            memBoxesCache.delete(invoiceNo);
            memSummaryCache = null;
          } catch (e) {}
          setInvoiceBoxes(prev => {
            const list = prev[invoiceNo] || [];
            return {
              ...prev,
              [invoiceNo]: list.filter(b => b._id !== boxId)
            };
          });
          setInvoices(prev => prev.map(inv => inv.invoiceNo === invoiceNo ? { ...inv, totalBoxes: Math.max(0, inv.totalBoxes - 1) } : inv));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteInvoice = async (invoiceNo) => {
    if (!window.confirm(`Are you sure you want to delete ALL stock boxes for Purchase Invoice "${invoiceNo}"?`)) return;
    try {
      const res = await api.delete(`/stock/invoice/${encodeURIComponent(invoiceNo)}`);
      if (res.data?.success) {
        clearAllStockCache();
        fetchStock(true);
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
          {/* Manual Refresh / Cache Invalidate Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh cache and fetch latest stock from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0F6E56] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => toggleExpandAll(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={() => toggleExpandAll(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
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
          <p className="text-xl font-black mt-1">{summary?.total ?? 0}</p>
        </div>

        <div 
          onClick={() => setStatus('available')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'available' ? 'bg-[#1D9E75] text-white border-[#1D9E75] shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Available</span>
          <p className="text-xl font-black mt-1">{summary?.available ?? 0}</p>
        </div>

        <div 
          onClick={() => setStatus('reserved')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'reserved' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Reserved</span>
          <p className="text-xl font-black mt-1">{summary?.reserved ?? 0}</p>
        </div>

        <div 
          onClick={() => setStatus('dispatched')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'dispatched' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Dispatched</span>
          <p className="text-xl font-black mt-1">{summary?.dispatched ?? 0}</p>
        </div>

        <div 
          onClick={() => setStatus('returned')} 
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            status === 'returned' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
          }`}
        >
          <span className="text-[10px] uppercase opacity-80">Returned</span>
          <p className="text-xl font-black mt-1">{summary?.returned ?? 0}</p>
        </div>
      </div>

      {/* Filter Toolbar with Purchase Invoice Dropdown & Date Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-slate-800">
            <Filter className="w-4 h-4 text-[#0F6E56]" />
            <span>Stock Search & Invoice Filters</span>
          </div>

          {/* Date Filter Modes */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-bold border border-slate-200">
            <button
              onClick={() => setDateFilterMode('today')}
              className={`px-3 py-1 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                dateFilterMode === 'today'
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Today</span>
            </button>
            <button
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => setDateFilterMode('custom')}
              className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
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
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (!val.trim()) {
                  setIsSearchMode(false);
                }
              }}
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="dispatched">Dispatched</option>
            <option value="returned">Returned</option>
          </select>
        </form>
      </div>

      {/* Accordion Expandable Invoice Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#0F6E56]" />
            <span>Loading Stock Inventory...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {displayGroups.map((group) => {
              // COLLAPSED BY DEFAULT: only open if explicit boolean true
              const isExpanded = Boolean(expandedInvoices[group.invoiceNo]);
              const groupBoxes = isSearchMode ? (group.boxes || []) : (invoiceBoxes[group.invoiceNo] || []);
              const isLoadingCurrentBoxes = Boolean(loadingBoxes[group.invoiceNo]);
              const caseInfo = parsePetiWeights(group.packing, group.conversion || group.pcsPerPeti || 20, group.cases || group.petiCount || 1, group.weight);

              return (
                <div
                  key={group.invoiceNo}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all hover:border-slate-300"
                >
                  {/* Main Accordion Row Header */}
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
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>Product: <strong className="text-slate-900 font-bold">{group.productName}</strong></span>
                          <span>| Batch: <strong className="font-mono text-slate-700">{group.batchNumber}</strong></span>
                          {group.packing && (
                            <span>| Packing: <strong className="text-[#0F6E56] font-bold">{group.packing}</strong></span>
                          )}
                          <span>| Total Stock: <strong className="text-emerald-950 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded font-black">{caseInfo.totalVolStr}</strong></span>
                          <span>| Har Peti: <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-extrabold">{caseInfo.caseWtStr} ({group.conversion || group.pcsPerPeti || 20} Pcs)</strong></span>
                          {group.warehouseLocation && (
                            <span>| Location: <strong className="text-slate-600">{group.warehouseLocation}</strong></span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Delete Button + Unified 1-Line Clean Badges (NO 2-line wrapping!) */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(group.invoiceNo);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer whitespace-nowrap"
                          title="Delete all stock for this purchase invoice (Admin Only)"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden xl:inline">Delete Invoice</span>
                        </button>
                      )}

                      {/* 1-Line Unified Badge (Never wraps into 2 lines) */}
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs shadow-2xs whitespace-nowrap">
                        <span className="font-extrabold text-slate-900">
                          📦 {group.cases || group.petiCount || Math.max(1, Math.ceil(group.totalBoxes / 10))} Peti
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="font-black bg-[#0F6E56] text-white px-2 py-0.5 rounded-md">
                          {caseInfo.totalVolStr}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="font-extrabold text-slate-800">
                          {group.totalBoxes} Pieces
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          1 Peti = {caseInfo.caseWtStr} ({group.conversion || group.pcsPerPeti || 20} Pcs)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Dropdown Inner Details (Grouped into Petis) */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-3">
                      {isLoadingCurrentBoxes ? (
                        <div className="py-6 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#0F6E56]" />
                          <span>Loading stock boxes for Invoice #{group.invoiceNo}...</span>
                        </div>
                      ) : groupBoxes.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 font-medium">
                          No stock boxes found for this invoice.
                        </div>
                      ) : (() => {
                        const petis = groupBoxesIntoPetis(groupBoxes, group.cases || group.petiCount, group.packing || group.weight, group.conversion || group.pcsPerPeti || groupBoxes[0]?.conversion, group.weight);

                        return (
                          <div className="space-y-3">
                            <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                              <span>PETI LIST FOR INVOICE #{group.invoiceNo} (TOTAL {petis.length} PETI = {caseInfo.totalVolStr} • {groupBoxes.length} PIECES • 1 PETI = {caseInfo.caseWtStr})</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAllPetisInInvoice(group.invoiceNo, petis, true);
                                  }}
                                  className="text-[10px] font-bold text-[#0F6E56] hover:underline cursor-pointer"
                                >
                                  Expand All Petis
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAllPetisInInvoice(group.invoiceNo, petis, false);
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                                >
                                  Collapse All Petis
                                </button>
                              </div>
                            </div>

                            {/* List of Petis */}
                            <div className="space-y-2.5">
                              {petis.map((peti) => {
                                const petiKey = `${group.invoiceNo}_p_${peti.petiNumber}`;
                                const isPetiExpanded = Boolean(expandedPetis[petiKey]);

                                return (
                                  <div
                                    key={peti.petiNumber}
                                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
                                  >
                                    {/* Peti Card Header */}
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePetiExpand(group.invoiceNo, peti.petiNumber);
                                      }}
                                      className="p-3 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between gap-3 select-none transition-colors border-b border-slate-100"
                                    >
                                      <div className="flex items-center gap-3">
                                        <button type="button" className="text-slate-400 hover:text-slate-700">
                                          {isPetiExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-[#0F6E56]" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                          )}
                                        </button>

                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0F6E56] flex items-center justify-center font-bold">
                                          <Package className="w-4 h-4" />
                                        </div>

                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-xs text-slate-900 font-mono">
                                              {peti.petiTitle} ({peti.petiNumber} of {petis.length})
                                            </span>
                                            <span className="text-xs font-black text-[#0F6E56] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
                                              {peti.petiWeight} ({peti.totalPieces} Pieces)
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                            QR Range: <strong className="text-[#0F6E56]">{peti.firstQr}</strong> → <strong className="text-[#0F6E56]">{peti.lastQr}</strong>
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                          {peti.availablePieces} / {peti.totalPieces} Available
                                        </span>
                                        <button
                                          type="button"
                                          className="text-xs font-bold text-[#0F6E56] hover:text-[#0B5442] flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer"
                                        >
                                          <span>{isPetiExpanded ? 'Hide Products' : 'View Products'}</span>
                                          {isPetiExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Individual Products inside this Peti */}
                                    {isPetiExpanded && (
                                      <div className="p-3 bg-white">
                                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                                          <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                                              <tr>
                                                <th className="py-2 px-3">QR ID</th>
                                                <th className="py-2 px-3">Product Name</th>
                                                <th className="py-2 px-3">Batch Number</th>
                                                <th className="py-2 px-3">Packing / Weight</th>
                                                <th className="py-2 px-3">Warehouse Rack</th>
                                                <th className="py-2 px-3">Status</th>
                                                <th className="py-2 px-3 text-right">Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                              {peti.boxes.map((box) => (
                                                <tr key={box._id} className="hover:bg-emerald-50/30 transition-colors">
                                                  <td className="py-2.5 px-3 font-mono font-extrabold text-[#0F6E56]">
                                                    {box.qrId}
                                                  </td>
                                                  <td className="py-2.5 px-3 font-bold text-slate-900">
                                                    {box.productName}
                                                  </td>
                                                  <td className="py-2.5 px-3 font-medium text-slate-600">
                                                    {box.batchNumber}
                                                  </td>
                                                  <td className="py-2.5 px-3">
                                                    <span className="font-bold text-slate-800">
                                                      {box.packing || box.weight || '1 kg'}
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-3 font-medium text-slate-700">
                                                    {editingBox === box._id && isAdmin ? (
                                                      <div className="flex items-center gap-1">
                                                        <input
                                                          type="text"
                                                          value={editLocation}
                                                          onChange={(e) => setEditLocation(e.target.value)}
                                                          className="w-24 bg-white border border-[#0F6E56] px-1.5 py-0.5 text-xs rounded"
                                                        />
                                                        <button
                                                          onClick={() => handleSaveRack(box._id, group.invoiceNo)}
                                                          className="text-emerald-700 hover:text-emerald-900 font-bold p-0.5 cursor-pointer"
                                                        >
                                                          <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div className="flex items-center gap-1">
                                                        <span>{box.warehouseLocation || 'RAIPUR GODOWN'}</span>
                                                        {isAdmin && (
                                                          <button
                                                            onClick={() => {
                                                              setEditingBox(box._id);
                                                              setEditLocation(box.warehouseLocation || 'RAIPUR GODOWN');
                                                            }}
                                                            className="text-slate-400 hover:text-[#0F6E56] p-0.5 cursor-pointer"
                                                            title="Edit Rack Location (Admin Only)"
                                                          >
                                                            <Edit2 className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="py-2.5 px-3">
                                                    <StatusBadge status={box.status} />
                                                  </td>
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                      <button
                                                        type="button"
                                                        onClick={() => navigate(`/history?qr=${box.qrId}`)}
                                                        className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1 inline-flex cursor-pointer"
                                                      >
                                                        <History className="w-3.5 h-3.5" />
                                                        <span>Trace</span>
                                                      </button>

                                                      {isAdmin && (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteBox(box._id, box.qrId, group.invoiceNo)}
                                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
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
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {displayGroups.length === 0 && (
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
