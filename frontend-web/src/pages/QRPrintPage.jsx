import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import StickerPrintView from '../components/StickerPrintView';
import { useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import {
  QrCode,
  Printer,
  Search,
  CheckSquare,
  Square,
  Grid,
  List,
  Layers,
  X,
  Filter,
  Check,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';

import { parsePetiWeights, matchesSearch, getPiecesPerPeti } from './StockManagement';

const QR_SUMMARY_CACHE_KEY = 'vaniki_qr_summary_cache_v5';
const QR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSummary() {
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('vaniki_qr_') && !k.includes('_v5')) {
        sessionStorage.removeItem(k);
      }
    });
    const raw = sessionStorage.getItem(QR_SUMMARY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < QR_CACHE_TTL_MS && Array.isArray(parsed.invoices)) {
        return parsed.invoices;
      }
    }
  } catch (e) {}
  return null;
}

function setCachedSummary(invoices) {
  try {
    sessionStorage.setItem(QR_SUMMARY_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      invoices
    }));
  } catch (e) {}
}

function clearQRSummaryCache() {
  try {
    sessionStorage.removeItem(QR_SUMMARY_CACHE_KEY);
  } catch (e) {}
}

// Generate exact 1-Sticker-Per-Peti records with correct single Peti weight
export function getInvoicePetis(group, loadedBoxes = []) {
  if (!group) return [];
  const totalPetis = group.cases || group.petiCount || 1;
  const pcsPerPeti = group.conversion || group.pcsPerPeti || getPiecesPerPeti(group.packing || group.weight) || 10;
  const caseInfo = parsePetiWeights(group.packing, pcsPerPeti, totalPetis, group.weight);

  const petis = [];

  if (loadedBoxes && loadedBoxes.length > 0) {
    for (let i = 0; i < loadedBoxes.length; i += pcsPerPeti) {
      const chunk = loadedBoxes.slice(i, i + pcsPerPeti);
      const petiNum = Math.floor(i / pcsPerPeti) + 1;
      const firstBox = chunk[0] || {};
      const lastBox = chunk[chunk.length - 1] || {};
      const qrId = firstBox.qrId || `VNK-P${petiNum}`;
      const petiTag = totalPetis > 1 ? ` (${petiNum}/${totalPetis})` : '';

      petis.push({
        _id: `${group.invoiceNo}_PETI_${petiNum}`,
        boxId: firstBox._id,
        invoiceNo: group.invoiceNo,
        purchaseInvoice: group.invoiceNo,
        petiNumber: petiNum,
        totalPetis,
        petiTitle: `Peti #${petiNum}${totalPetis > 1 ? ` (${petiNum} of ${totalPetis})` : ''}`,
        petiTag,
        petiWeight: caseInfo.caseWtStr,
        caseWtStr: caseInfo.caseWtStr,
        weight: `${caseInfo.caseWtStr}${petiTag}`,
        packing: group.packing,
        productName: group.productName || firstBox.productName,
        batchNumber: group.batchNumber || firstBox.batchNumber,
        warehouseLocation: group.warehouseLocation || firstBox.warehouseLocation || 'RAIPUR GODOWN',
        pieces: chunk.length,
        totalPieces: chunk.length,
        availablePieces: chunk.filter(b => b.status === 'available').length,
        qrId,
        firstQr: firstBox.qrId,
        lastQr: lastBox.qrId,
        status: chunk.some(b => b.status === 'available') ? 'available' : (firstBox.status || 'available'),
        boxes: chunk
      });
    }
  } else {
    let baseNum = null;
    let prefix = 'VNK-';
    let padLen = 5;
    if (group.firstQr) {
      const m = group.firstQr.match(/^(.*?)(\d+)$/);
      if (m) {
        prefix = m[1];
        baseNum = parseInt(m[2], 10);
        padLen = m[2].length;
      }
    }

    for (let petiNum = 1; petiNum <= totalPetis; petiNum++) {
      let qrId = `VNK-P${petiNum}`;
      if (baseNum !== null) {
        const offset = (petiNum - 1) * pcsPerPeti;
        qrId = `${prefix}${String(baseNum + offset).padStart(padLen, '0')}`;
      } else if (petiNum === 1 && group.firstQr) {
        qrId = group.firstQr;
      }
      const petiTag = totalPetis > 1 ? ` (${petiNum}/${totalPetis})` : '';

      petis.push({
        _id: `${group.invoiceNo}_PETI_${petiNum}`,
        invoiceNo: group.invoiceNo,
        purchaseInvoice: group.invoiceNo,
        petiNumber: petiNum,
        totalPetis,
        petiTitle: `Peti #${petiNum}${totalPetis > 1 ? ` (${petiNum} of ${totalPetis})` : ''}`,
        petiTag,
        petiWeight: caseInfo.caseWtStr,
        caseWtStr: caseInfo.caseWtStr,
        weight: `${caseInfo.caseWtStr}${petiTag}`,
        packing: group.packing,
        productName: group.productName,
        batchNumber: group.batchNumber,
        warehouseLocation: group.warehouseLocation || 'RAIPUR GODOWN',
        pieces: pcsPerPeti,
        totalPieces: pcsPerPeti,
        availablePieces: pcsPerPeti,
        qrId,
        firstQr: qrId,
        status: 'available',
        boxes: []
      });
    }
  }

  return petis;
}

export default function QRPrintPage() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchaseId');
  const purchaseInvoiceParam = searchParams.get('purchaseInvoice') || searchParams.get('invoice');
  const singleQrParam = searchParams.get('qrId') || searchParams.get('qr');

  // Invoices summary list (for lightweight 15KB instant load)
  const [invoicesSummary, setInvoicesSummary] = useState(() => getCachedSummary() || []);
  
  // Explicitly loaded boxes (when filtered, searched, or on-demand loaded)
  const [boxes, setBoxes] = useState([]);
  
  // On-demand loaded boxes map per invoice: { [invoiceNo]: Array<Box> }
  const [invoiceBoxesMap, setInvoiceBoxesMap] = useState({});
  const [loadingBoxesMap, setLoadingBoxesMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [downloadingPdfInv, setDownloadingPdfInv] = useState(null);
  const [searchQuery, setSearchQuery] = useState(singleQrParam || '');
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState(purchaseInvoiceParam || '');
  
  // Selection state tracks Peti labels (1 per Peti, not per bottle!)
  const [selectedPetiIds, setSelectedPetiIds] = useState([]);
  const [expandedBottlePetis, setExpandedBottlePetis] = useState({});
  
  // Accordion State: { [invoiceNo]: boolean } - COLLAPSED BY DEFAULT
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' (Default) | 'grid' | 'table'
  const [printPreset, setPrintPreset] = useState(singleQrParam ? '1' : 'all');
  
  const [isLocalPrinterReady, setIsLocalPrinterReady] = useState(false);
  const [checkingPrinter, setCheckingPrinter] = useState(false);
  const [detectedPrinterName, setDetectedPrinterName] = useState('TSC TE244');
  const [forceDirectMode, setForceDirectMode] = useState(() => {
    try {
      return localStorage.getItem('vaniki_force_direct_mode') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showPrinterHelpModal, setShowPrinterHelpModal] = useState(false);
  const [printingStatus, setPrintingStatus] = useState(null);
  const [printerFormat, setPrinterFormat] = useState(() => {
    try {
      return localStorage.getItem('vaniki_qr_printer_format') || 'tsc-2up-50x25';
    } catch (e) {
      return 'tsc-2up-50x25';
    }
  });

  const isDirectActive = isLocalPrinterReady || forceDirectMode;

  const toggleForceDirectMode = () => {
    setForceDirectMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('vaniki_force_direct_mode', next ? 'true' : 'false');
      } catch (e) {}
      return next;
    });
  };

  // Check local printer daemon on port 9191
  useEffect(() => {
    checkLocalPrinter();
    const interval = setInterval(checkLocalPrinter, 4000);
    return () => clearInterval(interval);
  }, []);

  const checkLocalPrinter = async () => {
    setCheckingPrinter(true);
    let ready = false;
    let printerName = null;
    const endpoints = [
      'http://127.0.0.1:9191/status',
      'http://localhost:9191/status'
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(ep, { method: 'GET', mode: 'cors', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.connected !== false) {
            ready = true;
            printerName = data.printer || data.detectedPrinter || 'TSC TE244';
            break;
          }
        }
      } catch (e) {}
    }

    setIsLocalPrinterReady(ready);
    if (printerName) setDetectedPrinterName(printerName);
    setCheckingPrinter(false);
    return ready;
  };

  const handleTestDirectPrint = async () => {
    setPrintingStatus({ type: 'loading', message: 'Sending test sticker directly to TSC TE244...' });
    const endpoints = [
      'http://127.0.0.1:9191/test-print',
      'http://localhost:9191/test-print'
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(ep, { method: 'GET', mode: 'cors', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            setIsLocalPrinterReady(true);
            setPrintingStatus({ type: 'success', message: `Test sticker printed on ${data.printer || 'TSC TE244'}!` });
            setTimeout(() => setPrintingStatus(null), 3500);
            return;
          }
        }
      } catch (e) {}
    }

    setPrintingStatus({
      type: 'error',
      message: 'Daemon not reachable on 127.0.0.1:9191. Please check if start-service.bat is running.'
    });
    setTimeout(() => setPrintingStatus(null), 4500);
  };

  // Inject dynamic @page size for TSC thermal rolls vs sheet paper
  useEffect(() => {
    let styleEl = document.getElementById('qr-print-page-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'qr-print-page-style';
      document.head.appendChild(styleEl);
    }

    let pageCss = '';
    if (printerFormat === 'tsc-50x50') {
      pageCss = `@media print { @page { size: 50mm 50mm; margin: 0mm !important; } }`;
    } else if (printerFormat === 'tsc-50x25') {
      pageCss = `@media print { @page { size: 50mm 25mm; margin: 0mm !important; } }`;
    } else if (printerFormat === 'tsc-100x50') {
      pageCss = `@media print { @page { size: 100mm 50mm; margin: 0mm !important; } }`;
    } else if (printerFormat === 'tsc-2up-50x25') {
      pageCss = `@media print { @page { size: 105mm 25mm; margin: 0mm !important; } }`;
    } else {
      pageCss = `@media print { @page { size: A4 portrait; margin: 8mm !important; } }`;
    }

    styleEl.innerHTML = pageCss;

    try {
      localStorage.setItem('vaniki_qr_printer_format', printerFormat);
    } catch (e) {}
  }, [printerFormat]);

  // Main data fetching function
  const fetchBoxesToPrint = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      clearQRSummaryCache();
      setInvoiceBoxesMap({});
    }

    setLoading(true);
    try {
      const extractAndSelectPetis = (fetchedBoxes, targetQr = null) => {
        const map = new Map();
        fetchedBoxes.forEach(box => {
          const invKey = box.purchaseInvoice || 'Unassigned Invoice';
          if (!map.has(invKey)) {
            map.set(invKey, {
              invoiceNo: invKey,
              productName: box.productName,
              batchNumber: box.batchNumber,
              packing: box.packing || box.weight || '1 kg',
              weight: box.weight || box.packing || '1 kg',
              cases: box.cases || 1,
              conversion: box.conversion || 10,
              warehouseLocation: box.warehouseLocation || 'RAIPUR GODOWN',
              boxes: []
            });
          }
          map.get(invKey).boxes.push(box);
        });

        const petis = [];
        map.forEach(grp => {
          grp.totalBoxes = grp.boxes.length;
          grp.petiCount = Math.max(1, Math.ceil(grp.totalBoxes / (grp.conversion || 10)));
          petis.push(...getInvoicePetis(grp, grp.boxes));
        });

        if (targetQr) {
          const match = petis.find(p => p.qrId === targetQr || p.boxes?.some(b => b.qrId === targetQr || b._id === targetQr));
          if (match) setSelectedPetiIds([match._id]);
          else setSelectedPetiIds(petis.map(p => p._id));
        } else {
          setSelectedPetiIds(petis.map(p => p._id));
        }
      };

      // 1. Single QR parameter
      if (singleQrParam) {
        const res = await api.get('/stock', { params: { search: singleQrParam.trim(), limit: 100 } });
        if (res.data?.success) {
          const fetched = res.data.boxes || [];
          setBoxes(fetched);
          extractAndSelectPetis(fetched, singleQrParam.trim());
        }
      }
      // 2. Specific Purchase ID parameter
      else if (purchaseId) {
        const res = await api.get(`/purchases/${purchaseId}`);
        if (res.data?.success) {
          const fetched = res.data.boxes || [];
          setBoxes(fetched);
          extractAndSelectPetis(fetched);
        }
      }
      // 3. Specific Purchase Invoice filter / param
      else if (purchaseInvoiceFilter || purchaseInvoiceParam) {
        const invNo = purchaseInvoiceFilter || purchaseInvoiceParam;
        const res = await api.get('/stock', { params: { purchaseInvoice: invNo, limit: 2000 } });
        if (res.data?.success) {
          const fetched = res.data.boxes || [];
          setBoxes(fetched);
          extractAndSelectPetis(fetched);
        }
      }
      // 4. Free-text Search
      else if (searchQuery.trim()) {
        const res = await api.get('/stock', { params: { search: searchQuery.trim(), limit: 500 } });
        if (res.data?.success) {
          const fetched = res.data.boxes || [];
          setBoxes(fetched);
          extractAndSelectPetis(fetched);
        }
      }
      // 5. DEFAULT MODE: Load fast invoice summary (15KB, ~40ms!)
      else {
        if (!forceRefresh) {
          const cached = getCachedSummary();
          if (cached && cached.length > 0) {
            setInvoicesSummary(cached);
            setLoading(false);
            return;
          }
        }

        const res = await api.get('/stock/invoices-summary');
        if (res.data?.success) {
          const invs = res.data.invoices || [];
          setInvoicesSummary(invs);
          setCachedSummary(invs);
        }
        setBoxes([]);
        setSelectedPetiIds([]);
      }
    } catch (err) {
      console.error('Failed to load QR print data:', err);
    } finally {
      setLoading(false);
    }
  }, [purchaseId, purchaseInvoiceParam, purchaseInvoiceFilter, singleQrParam, searchQuery]);

  useEffect(() => {
    fetchBoxesToPrint();
  }, [fetchBoxesToPrint]);

  // Unique Purchase Invoice IDs for the top filter dropdown
  const uniqueInvoices = useMemo(() => {
    const set = new Set();
    invoicesSummary.forEach(inv => { if (inv.invoiceNo) set.add(inv.invoiceNo); });
    boxes.forEach(b => { if (b.purchaseInvoice) set.add(b.purchaseInvoice); });
    return Array.from(set).sort();
  }, [invoicesSummary, boxes]);

  // Determine if in summary list mode (default) vs explicit boxes mode
  const isSummaryMode = !purchaseId && !purchaseInvoiceParam && !purchaseInvoiceFilter && !singleQrParam && !searchQuery.trim();

  // Combine explicitly loaded boxes + any on-demand loaded invoice boxes
  const allLoadedBoxes = useMemo(() => {
    const map = new Map();
    boxes.forEach(b => map.set(b._id, b));
    Object.values(invoiceBoxesMap).forEach(list => {
      if (Array.isArray(list)) list.forEach(b => map.set(b._id, b));
    });
    return Array.from(map.values());
  }, [boxes, invoiceBoxesMap]);

  // Filter boxes by search query and purchase invoice filter
  const filteredBoxes = useMemo(() => {
    if (isSummaryMode) return [];
    return boxes.filter(b => {
      if (purchaseInvoiceFilter && b.purchaseInvoice !== purchaseInvoiceFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (b.qrId && b.qrId.toLowerCase().includes(q)) ||
        (b.productName && b.productName.toLowerCase().includes(q)) ||
        (b.batchNumber && b.batchNumber.toLowerCase().includes(q)) ||
        (b.purchaseInvoice && b.purchaseInvoice.toLowerCase().includes(q))
      );
    });
  }, [boxes, searchQuery, purchaseInvoiceFilter, isSummaryMode]);

  // Group invoices for the grouped accordion view
  const invoiceGroups = useMemo(() => {
    if (isSummaryMode) {
      let list = invoicesSummary.map(inv => ({
        invoiceNo: inv.invoiceNo,
        productName: inv.productName,
        batchNumber: inv.batchNumber,
        packing: inv.packing || inv.weight || '1 kg',
        weight: inv.weight || inv.packing || '1 kg',
        cases: inv.cases || inv.petiCount || 1,
        conversion: inv.conversion || inv.pcsPerPeti || 10,
        warehouseLocation: inv.warehouseLocation || 'RAIPUR GODOWN',
        totalBoxes: inv.totalBoxes,
        petiCount: inv.cases || inv.petiCount || Math.max(1, Math.ceil(inv.totalBoxes / 10)),
        firstQr: inv.firstQr,
        lastQr: inv.lastQr,
        boxes: invoiceBoxesMap[inv.invoiceNo] || []
      }));

      if (searchQuery && searchQuery.trim()) {
        const term = searchQuery.trim();
        list = list.filter(inv => {
          const combined = `${inv.invoiceNo} ${inv.productName} ${inv.batchNumber} ${inv.packing} ${inv.weight} ${inv.warehouseLocation}`;
          return matchesSearch(combined, term);
        });
      }

      return list;
    }

    // In filtered boxes mode, group the returned boxes
    const map = new Map();
    filteredBoxes.forEach(box => {
      const invKey = box.purchaseInvoice || 'Unassigned Invoice';
      if (!map.has(invKey)) {
        map.set(invKey, {
          invoiceNo: invKey,
          productName: box.productName,
          batchNumber: box.batchNumber,
          packing: box.packing || box.weight || '1 kg',
          weight: box.weight || box.packing || '1 kg',
          cases: box.cases || 1,
          conversion: box.conversion || 10,
          warehouseLocation: box.warehouseLocation || 'Rack A1',
          totalBoxes: 0,
          petiCount: 0,
          firstQr: box.qrId,
          lastQr: box.qrId,
          boxes: []
        });
      }
      const grp = map.get(invKey);
      grp.boxes.push(box);
      grp.totalBoxes += 1;
      grp.lastQr = box.qrId;
      grp.petiCount = Math.max(1, Math.ceil(grp.totalBoxes / (grp.conversion || 10)));
    });
    return Array.from(map.values());
  }, [isSummaryMode, invoicesSummary, invoiceBoxesMap, filteredBoxes, searchQuery]);

  // All Petis across all displayed invoices (1 sticker per Peti)
  const allAvailablePetis = useMemo(() => {
    const list = [];
    invoiceGroups.forEach(group => {
      const loadedBoxes = invoiceBoxesMap[group.invoiceNo] || group.boxes || [];
      const petis = getInvoicePetis(group, loadedBoxes);
      list.push(...petis);
    });
    return list;
  }, [invoiceGroups, invoiceBoxesMap]);

  const petisToRender = useMemo(() => {
    if (selectedPetiIds.length === 0) return [];
    const set = new Set(selectedPetiIds);
    return allAvailablePetis.filter(p => set.has(p._id));
  }, [allAvailablePetis, selectedPetiIds]);

  const totalPetisCount = allAvailablePetis.length;

  const isAllFilteredSelected = useMemo(() => {
    return allAvailablePetis.length > 0 && allAvailablePetis.every(p => selectedPetiIds.includes(p._id));
  }, [allAvailablePetis, selectedPetiIds]);

  // Toggle invoice accordion & lazily load its boxes on demand!
  const toggleInvoiceExpand = async (invoiceNo) => {
    const nextState = !expandedInvoices[invoiceNo];
    setExpandedInvoices(prev => ({
      ...prev,
      [invoiceNo]: nextState
    }));

    if (nextState && (!invoiceBoxesMap[invoiceNo] || invoiceBoxesMap[invoiceNo].length === 0)) {
      setLoadingBoxesMap(prev => ({ ...prev, [invoiceNo]: true }));
      try {
        const res = await api.get('/stock', { params: { purchaseInvoice: invoiceNo, limit: 2000 } });
        if (res.data?.success && res.data.boxes?.length > 0) {
          const fetched = res.data.boxes;
          setInvoiceBoxesMap(prev => ({ ...prev, [invoiceNo]: fetched }));
          const targetGroup = invoiceGroups.find(g => g.invoiceNo === invoiceNo);
          if (targetGroup) {
            const petis = getInvoicePetis(targetGroup, fetched);
            setSelectedPetiIds(prev => Array.from(new Set([...prev, ...petis.map(p => p._id)])));
          }
        }
      } catch (err) {
        console.error('Failed to load boxes for invoice:', err);
      } finally {
        setLoadingBoxesMap(prev => ({ ...prev, [invoiceNo]: false }));
      }
    }
  };

  const toggleExpandAll = (expand) => {
    const newStates = {};
    invoiceGroups.forEach(g => {
      newStates[g.invoiceNo] = expand;
    });
    setExpandedInvoices(newStates);
  };

  const handleToggleInvoiceCheck = async (group) => {
    let grpBoxes = invoiceBoxesMap[group.invoiceNo] || group.boxes || [];
    
    if (grpBoxes.length === 0) {
      setLoadingBoxesMap(prev => ({ ...prev, [group.invoiceNo]: true }));
      try {
        const res = await api.get('/stock', { params: { purchaseInvoice: group.invoiceNo, limit: 2000 } });
        if (res.data?.success && res.data.boxes?.length > 0) {
          grpBoxes = res.data.boxes;
          setInvoiceBoxesMap(prev => ({ ...prev, [group.invoiceNo]: grpBoxes }));
        }
      } catch (e) {}
      finally {
        setLoadingBoxesMap(prev => ({ ...prev, [group.invoiceNo]: false }));
      }
    }

    const groupPetis = getInvoicePetis(group, grpBoxes);
    const groupPetiIds = groupPetis.map(p => p._id);
    const isFullySelected = groupPetiIds.length > 0 && groupPetiIds.every(id => selectedPetiIds.includes(id));

    if (isFullySelected) {
      const removeSet = new Set(groupPetiIds);
      setSelectedPetiIds(prev => prev.filter(id => !removeSet.has(id)));
    } else {
      setSelectedPetiIds(prev => Array.from(new Set([...prev, ...groupPetiIds])));
    }
  };

  const handleToggleSelectPeti = (petiId) => {
    setPrintPreset('custom');
    setSelectedPetiIds(prev =>
      prev.includes(petiId) ? prev.filter(id => id !== petiId) : [...prev, petiId]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedPetiIds(allAvailablePetis.map(p => p._id));
    setPrintPreset('all');
  };

  const handleDeselectAllFiltered = () => {
    setSelectedPetiIds([]);
    setPrintPreset('custom');
  };

  const handleSelectFirst1 = () => {
    if (allAvailablePetis.length > 0) {
      setSelectedPetiIds([allAvailablePetis[0]._id]);
      setPrintPreset('1');
    }
  };

  const handlePresetChange = (countStr) => {
    setPrintPreset(countStr);
    if (countStr === '1') {
      handleSelectFirst1();
    } else if (countStr === '10') {
      setSelectedPetiIds(allAvailablePetis.slice(0, 10).map(p => p._id));
    } else if (countStr === '50') {
      setSelectedPetiIds(allAvailablePetis.slice(0, 50).map(p => p._id));
    } else if (countStr === '100') {
      setSelectedPetiIds(allAvailablePetis.slice(0, 100).map(p => p._id));
    } else {
      setSelectedPetiIds(allAvailablePetis.map(p => p._id));
    }
  };

  const printBoxesDirectly = async (boxesToPrint) => {
    if (!boxesToPrint || boxesToPrint.length === 0) return;

    if (isDirectActive) {
      setPrintingStatus({
        type: 'loading',
        title: 'Printing Peti Labels',
        message: `Sending ${boxesToPrint.length} Peti sticker(s) directly to ${detectedPrinterName || 'TSC TE244'}...`,
        logs: [
          `Preparing ${boxesToPrint.length} Peti sticker(s) in TSPL 2-Across layout`,
          `Connecting to local printer daemon on http://127.0.0.1:9191/print-boxes...`
        ]
      });
      
      const endpoints = [
        'http://127.0.0.1:9191/print-boxes',
        'http://localhost:9191/print-boxes'
      ];

      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(ep, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boxes: boxesToPrint }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
              setIsLocalPrinterReady(true);
              setPrintingStatus({
                type: 'success',
                title: 'Print Command Delivered!',
                message: `Successfully sent ${boxesToPrint.length} Peti sticker(s) to ${data.printer || detectedPrinterName || 'TSC TE244'}!`,
                logs: [
                  `Connected to local service on port 9191: 200 OK`,
                  `Transmitted TSPL command directly to printer spooler`,
                  `Printer: ${data.printer || detectedPrinterName || 'TSC TE244'}`,
                  `Total labels queued: ${boxesToPrint.length} Peti sticker(s)`
                ]
              });
              setTimeout(() => setPrintingStatus(null), 3500);
              return;
            }
          }
        } catch (err) {}
      }

      setPrintingStatus({
        type: 'error',
        title: 'Local Printer Service Unreachable',
        message: 'Could not connect to Windows Printer Service on port 9191. Opening standard browser print dialog...',
        logs: [
          `Attempted connection to http://127.0.0.1:9191/print-boxes`,
          `Ensure 'windows-printer-service' is running on your Windows PC.`,
          `Switching to standard browser print dialog in 2 seconds...`
        ]
      });
      setTimeout(() => {
        setPrintingStatus(null);
        window.print();
      }, 2500);
      return;
    }

    setPrintingStatus({
      type: 'info',
      title: 'Opening Print Preview',
      message: `Preparing ${boxesToPrint.length} Peti sticker(s) for browser printing...`,
      logs: [
        `Labels to print: ${boxesToPrint.length}`,
        `Printer Format: ${printerFormat}`,
        `Opening system print dialog...`
      ]
    });
    setTimeout(() => {
      setPrintingStatus(null);
      window.print();
    }, 1200);
  };

  // Print Single Peti immediately
  const handlePrintSinglePeti = (peti) => {
    if (!peti) return;

    if (isDirectActive) {
      printBoxesDirectly([peti]);
    } else {
      setSelectedPetiIds([peti._id]);
      setPrintPreset('1');
      setPrintingStatus({
        type: 'info',
        title: 'Printing Single Peti',
        message: `Selected ${peti.petiTitle || 'Peti'} (${peti.qrId || ''}). Opening print dialog...`,
        logs: [
          `Product: ${peti.productName}`,
          `Peti ID: ${peti.qrId}`,
          `Weight: ${peti.petiWeight || peti.caseWtStr || peti.weight || ''}`,
          `Opening browser print dialog...`
        ]
      });
      setTimeout(() => {
        setPrintingStatus(null);
        window.print();
      }, 1200);
    }
  };

  // Test Print 1 Peti on Left label of 2-Across roll
  const handleSelectFirst1AndPrint = () => {
    if (allAvailablePetis.length > 0) {
      const firstPeti = allAvailablePetis[0];
      if (isDirectActive) {
        printBoxesDirectly([firstPeti]);
      } else {
        setSelectedPetiIds([firstPeti._id]);
        setPrintPreset('1');
        setPrintingStatus({
          type: 'info',
          title: 'Test Print 1 Peti',
          message: `Testing 1 Peti label (${firstPeti.qrId || ''}). Opening print dialog...`,
          logs: [
            `Target: ${firstPeti.productName}`,
            `Peti ID: ${firstPeti.qrId}`,
            `Opening browser print dialog...`
          ]
        });
        setTimeout(() => {
          setPrintingStatus(null);
          window.print();
        }, 1200);
      }
    }
  };

  // Print Entire Purchase Invoice Group (Peti stickers only)
  const handlePrintInvoiceGroup = async (group) => {
    let boxesToPrint = invoiceBoxesMap[group.invoiceNo] || group.boxes || [];
    if (boxesToPrint.length === 0) {
      setPrintingStatus({
        type: 'loading',
        title: 'Loading Petis...',
        message: `Fetching stock boxes for invoice ${group.invoiceNo}...`,
        logs: [
          `Querying /stock?purchaseInvoice=${group.invoiceNo}`,
          `Please wait...`
        ]
      });
      try {
        const res = await api.get('/stock', { params: { purchaseInvoice: group.invoiceNo, limit: 2000 } });
        if (res.data?.success && res.data.boxes?.length > 0) {
          boxesToPrint = res.data.boxes;
          setInvoiceBoxesMap(prev => ({ ...prev, [group.invoiceNo]: boxesToPrint }));
        }
      } catch (err) {
        setPrintingStatus({
          type: 'error',
          title: 'Failed to Load',
          message: 'Failed to load stickers for printing',
          logs: [err.message || 'Network error']
        });
        setTimeout(() => setPrintingStatus(null), 3000);
        return;
      }
    }

    const petis = getInvoicePetis(group, boxesToPrint);
    if (petis && petis.length > 0) {
      if (isDirectActive) {
        printBoxesDirectly(petis);
      } else {
        const petiIds = petis.map(p => p._id);
        setSelectedPetiIds(prev => Array.from(new Set([...prev, ...petiIds])));
        setPrintingStatus({
          type: 'info',
          title: 'Invoice Print Preview',
          message: `Preparing ${petis.length} Peti stickers for invoice ${group.invoiceNo}...`,
          logs: [
            `Invoice: #${group.invoiceNo}`,
            `Product: ${group.productName || 'Multiple'}`,
            `Total Petis: ${petis.length}`,
            `Opening browser print dialog...`
          ]
        });
        setTimeout(() => {
          setPrintingStatus(null);
          window.print();
        }, 1200);
      }
    }
  };

  const handleDownloadBillPdf = async (e, invoiceNo) => {
    e.stopPropagation();
    try {
      setDownloadingPdfInv(invoiceNo);
      const res = await api.get(`/purchases/${encodeURIComponent(invoiceNo)}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Purchase_${invoiceNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to generate PDF voucher: ' + (err.response?.data?.message || err.message));
    } finally {
      setDownloadingPdfInv(null);
    }
  };

  const handleTriggerPrint = () => {
    if (isDirectActive) {
      printBoxesDirectly(petisToRender);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Global Print Button (no-print) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#0F6E56]" />
            <span>Peti QR & Barcode Sticker Printing Studio</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            1 Sticker Per Peti (Carton) • Direct 1-Click Print for TSC TE244
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-200">
            <button
              onClick={() => handlePresetChange('1')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                printPreset === '1'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Select 1 Peti label only"
            >
              1 Peti
            </button>
            <button
              onClick={() => handlePresetChange('10')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                printPreset === '10'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              10
            </button>
            <button
              onClick={() => handlePresetChange('50')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                printPreset === '50'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              50
            </button>
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                printPreset === 'all'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalPetisCount})
            </button>
          </div>

          {/* Test Print 1 Peti Button */}
          <button
            onClick={handleSelectFirst1AndPrint}
            disabled={allAvailablePetis.length === 0}
            className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Print 1 Peti sticker on Left label of roll"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isDirectActive ? 'Direct Print 1 Peti' : 'Test Print 1 Peti'}</span>
          </button>

          {/* Main Print Trigger Button */}
          <button
            onClick={handleTriggerPrint}
            disabled={petisToRender.length === 0}
            className="bg-[#0F6E56] hover:bg-[#0B5442] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isDirectActive ? 'Direct Print' : 'Print'} {petisToRender.length} Selected Peti Label{petisToRender.length === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>



      {/* TSC TE244 & Label Roll Setup Bar (no-print) */}
      <div className="no-print bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-bold">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Attached Printer & 2-Across Thermal Roll Setup
              </h3>
              {isDirectActive ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {detectedPrinterName || 'TSC TE244'} Connected (1-Click Direct Print)
                  </span>
                  <button
                    type="button"
                    onClick={handleTestDirectPrint}
                    className="text-[10px] bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow cursor-pointer transition"
                    title="Send 1 test label directly to thermal printer"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    Test Printer Output
                  </button>
                  <button
                    type="button"
                    onClick={toggleForceDirectMode}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer transition ${
                      forceDirectMode
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Toggle Force Direct Mode"
                  >
                    Direct USB: {forceDirectMode ? 'Forced ON' : 'Auto'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] bg-slate-700 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-600">
                    Browser Print Mode
                  </span>
                  <button
                    type="button"
                    onClick={toggleForceDirectMode}
                    className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition"
                    title="Force direct 1-click print if script is already running on this laptop"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    Turn ON Direct USB Mode
                  </button>
                  <button
                    type="button"
                    onClick={handleTestDirectPrint}
                    className="text-[10px] bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow cursor-pointer transition"
                    title="Send test sticker directly"
                  >
                    Test Printer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrinterHelpModal(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-1 cursor-pointer bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/60"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Direct Print Help
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await checkLocalPrinter();
                      if (!ok) setShowPrinterHelpModal(true);
                    }}
                    title="Test local printer connection"
                    className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer border border-slate-700"
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingPrinter ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              {isDirectActive
                ? `Direct TSC USB mode is ACTIVE! Clicking print will immediately output stickers on ${detectedPrinterName || 'TSC TE244'} with 0 browser popups.`
                : 'Aapke roll ke hisaab se 2-Across (Left / Right) stickers print honge. Laptop par direct 1-click print ke liye "Turn ON Direct USB Mode" dabayein ya start-service.bat chalu karein.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
          <span className="text-[11px] font-bold text-slate-300 pl-2">Roll Mode:</span>
          <select
            value={printerFormat}
            onChange={(e) => setPrinterFormat(e.target.value)}
            className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] cursor-pointer"
          >
            <option value="tsc-2up-50x25">TSC 2-Across Roll (2 Labels Side-by-Side) - Default</option>
            <option value="tsc-50x50">TSC 1-Across Roll (50mm × 50mm / 2" × 2")</option>
            <option value="tsc-50x25">TSC 1-Across Roll (50mm × 25mm / 2" × 1")</option>
            <option value="tsc-100x50">TSC Large Roll (100mm × 50mm / 4" × 2")</option>
            <option value="sheet-a4">A4 Paper Sheet (Multi-Sticker Grid)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0F6E56]" />
          <span>Loading QR Print Studio...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Control Bar: Search Input, Purchase Invoice Filter & View Switcher (no-print) */}
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Product Name, Batch Number, or QR ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* MAIN PURCHASE INVOICE ID DROPDOWN FILTER */}
            <div className="w-full md:w-56">
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

            {/* Bulk Selection & Expand Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={
                  isAllFilteredSelected
                    ? handleDeselectAllFiltered
                    : handleSelectAllFiltered
                }
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isAllFilteredSelected ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#0F6E56]" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              <button
                onClick={() => toggleExpandAll(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={() => toggleExpandAll(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Collapse All
              </button>
              <button
                onClick={() => fetchBoxesToPrint(true)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Refresh and invalidate cache"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#0F6E56] ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {/* View Switcher */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 ml-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === 'grouped'
                      ? 'bg-white text-[#0F6E56] shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                  title="Purchase Invoice Accordion List View (Default)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Invoice View</span>
                </button>

                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#0F6E56] shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sticker Grid Preview View"
                >
                  <Grid className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-[#0F6E56] shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Flat Box Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Selected Count Banner (no-print) */}
          <div className="no-print bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-bold text-[#0F6E56] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#0F6E56]" />
              <span>
                Selected <strong className="text-slate-900 font-black">{petisToRender.length}</strong> of{' '}
                <strong className="text-slate-700">{totalPetisCount}</strong> Peti Labels ({invoiceGroups.length} Purchase Invoices)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Layout Format: 1 Sticker per Peti (TSC 2" x 1" Standard)
            </span>
          </div>

          {/* 1. Purchase Invoice Accordion List View (DEFAULT MODE) */}
          {viewMode === 'grouped' && (
            <div className="no-print space-y-3">
              {invoiceGroups.map((group) => {
                const isExpanded = Boolean(expandedInvoices[group.invoiceNo]);
                const currentBoxes = invoiceBoxesMap[group.invoiceNo] || group.boxes || [];
                const isLoadingCurrent = Boolean(loadingBoxesMap[group.invoiceNo]);
                const groupPetis = getInvoicePetis(group, currentBoxes);
                const groupPetiIds = groupPetis.map(p => p._id);
                const selectedInGroupCount = groupPetiIds.filter(id => selectedPetiIds.includes(id)).length;
                const isFullySelected = groupPetiIds.length > 0 && selectedInGroupCount === groupPetiIds.length;
                const isPartiallySelected = selectedInGroupCount > 0 && !isFullySelected;
                const caseInfo = parsePetiWeights(group.packing, group.conversion || 20, group.cases || group.petiCount, group.weight);

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
                      {/* Left: Checkbox + Expand Arrow + Invoice Info */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isFullySelected}
                          ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleInvoiceCheck(group);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-[#0F6E56] cursor-pointer rounded"
                        />

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
                            <span>| Har Peti: <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-extrabold">{caseInfo.caseWtStr} ({group.conversion || 20} Pcs)</strong></span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Print Invoice Petis Button, Bill PDF & 1-Line Unified Badge (NO 2-line wrapping!) */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={downloadingPdfInv === group.invoiceNo}
                          onClick={(e) => handleDownloadBillPdf(e, group.invoiceNo)}
                          className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="Download Inward Voucher & Bill PDF for this Invoice"
                        >
                          {downloadingPdfInv === group.invoiceNo ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F6E56]" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                          )}
                          <span>Bill PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintInvoiceGroup(group);
                          }}
                          className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="Print 1 sticker per Peti for this Purchase Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Peti Labels ({group.cases || group.petiCount})</span>
                        </button>

                        {/* 1-Line Unified Stock Badge (Never wraps into 2 lines) */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs shadow-2xs whitespace-nowrap">
                          <span className="font-extrabold text-slate-900">
                            📦 {group.cases || group.petiCount} Peti
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="font-black bg-[#0F6E56] text-white px-2 py-0.5 rounded-md">
                            {caseInfo.totalVolStr}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="font-extrabold text-slate-800">
                            {selectedInGroupCount}/{groupPetis.length} Petis Sel
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            1 Peti = {caseInfo.caseWtStr} ({group.conversion || 20} Pcs)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Dropdown Inner Details Table (Peti Rows) */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-3">
                        <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                          <span>PETI DETAILS FOR INVOICE #{group.invoiceNo} (1 STICKER PER PETI)</span>
                          <span className="text-slate-400">{selectedInGroupCount} / {groupPetis.length} Petis Selected</span>
                        </div>

                        {isLoadingCurrent ? (
                          <div className="py-6 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-[#0F6E56]" />
                            <span>Loading Petis for Invoice #{group.invoiceNo}...</span>
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3 w-10">Select</th>
                                  <th className="py-2.5 px-3">Peti #</th>
                                  <th className="py-2.5 px-3">QR ID</th>
                                  <th className="py-2.5 px-3">Product Name</th>
                                  <th className="py-2.5 px-3">Batch Number</th>
                                  <th className="py-2.5 px-3">Peti Weight</th>
                                  <th className="py-2.5 px-3">Bottles / Pcs</th>
                                  <th className="py-2.5 px-3">Warehouse Rack</th>
                                  <th className="py-2.5 px-3">Status</th>
                                  <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {groupPetis.map((peti) => {
                                  const isSelected = selectedPetiIds.includes(peti._id);
                                  const areBottlesShown = Boolean(expandedBottlePetis[peti._id]);
                                  return (
                                    <React.Fragment key={peti._id}>
                                      <tr
                                        className={`hover:bg-emerald-50/30 transition-colors ${
                                          isSelected ? 'bg-emerald-50/20' : 'opacity-75'
                                        }`}
                                      >
                                        <td className="py-3 px-3">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectPeti(peti._id)}
                                            className="w-4 h-4 accent-[#0F6E56] cursor-pointer rounded"
                                          />
                                        </td>
                                        <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold">
                                            {peti.petiTitle}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 font-mono font-extrabold text-[#0F6E56]">
                                          {peti.qrId}
                                        </td>
                                        <td className="py-3 px-3 font-bold text-slate-900">
                                          {peti.productName}
                                        </td>
                                        <td className="py-3 px-3 font-medium text-slate-600 font-mono">
                                          {peti.batchNumber}
                                        </td>
                                        <td className="py-3 px-3">
                                          <span className="font-extrabold text-emerald-950 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded text-xs">
                                            {peti.petiWeight}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            <span>{peti.totalPieces} Pcs</span>
                                            {peti.boxes && peti.boxes.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => setExpandedBottlePetis(prev => ({ ...prev, [peti._id]: !prev[peti._id] }))}
                                                className="text-[10px] text-[#0F6E56] hover:underline font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer"
                                                title="View individual bottle barcodes in this Peti"
                                              >
                                                {areBottlesShown ? 'Hide' : 'View'} QRs
                                              </button>
                                            )}
                                          </div>
                                          {peti.firstQr && peti.lastQr && (
                                            <span className="text-[10px] text-slate-400 block font-mono">
                                              ({peti.firstQr} - {peti.lastQr})
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 px-3 font-medium text-slate-700">
                                          {peti.warehouseLocation || 'RAIPUR GODOWN'}
                                        </td>
                                        <td className="py-3 px-3">
                                          <StatusBadge status={peti.status} />
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => handlePrintSinglePeti(peti)}
                                            className="bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] font-bold text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 inline-flex border border-emerald-200 shadow-2xs cursor-pointer"
                                            title={`Print sticker for ${peti.petiTitle}`}
                                          >
                                            <Printer className="w-3.5 h-3.5 text-[#0F6E56]" />
                                            <span>Print Peti</span>
                                          </button>
                                        </td>
                                      </tr>

                                      {/* Inner Bottle QRs preview if toggled */}
                                      {areBottlesShown && peti.boxes && peti.boxes.length > 0 && (
                                        <tr className="bg-slate-50/80">
                                          <td colSpan={10} className="p-3 pl-12">
                                            <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                                              <div className="font-bold text-slate-600 mb-1.5 text-[11px] flex items-center justify-between">
                                                <span>Bottles in {peti.petiTitle} ({peti.boxes.length} items):</span>
                                                <span className="text-slate-400 font-normal">Each bottle belongs to this Peti sticker</span>
                                              </div>
                                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                                {peti.boxes.map((b) => (
                                                  <span
                                                    key={b._id}
                                                    className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200"
                                                  >
                                                    {b.qrId}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {invoiceGroups.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
                  No purchase invoice stock records match your filter criteria.
                </div>
              )}
            </div>
          )}

          {/* 2. Grid Preview View */}
          {viewMode === 'grid' && (
            <div className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              {allAvailablePetis.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No Petis available to display in grid view.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {allAvailablePetis.map((peti) => {
                    const isSelected = selectedPetiIds.includes(peti._id);
                    return (
                      <div
                        key={peti._id}
                        onClick={() => handleToggleSelectPeti(peti._id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0F6E56] bg-emerald-50/50 shadow-sm ring-1 ring-[#0F6E56]'
                            : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono font-black text-[#0F6E56] text-[11px]">{peti.qrId}</span>
                          <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {peti.petiTitle}
                          </span>
                        </div>
                        <p className="font-extrabold text-[11px] text-slate-800 truncate">{peti.productName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">Batch: {peti.batchNumber}</p>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-black text-emerald-800">Wt: {peti.petiWeight}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{peti.totalPieces} Pcs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. Flat Peti Table View */}
          {viewMode === 'table' && (
            <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
              {allAvailablePetis.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No Petis available to display in table view.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10">Select</th>
                      <th className="py-2.5 px-3">Peti #</th>
                      <th className="py-2.5 px-3">QR ID</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Batch Number</th>
                      <th className="py-2.5 px-3">Peti Weight</th>
                      <th className="py-2.5 px-3">Purchase Invoice</th>
                      <th className="py-2.5 px-3">Bottles / Pcs</th>
                      <th className="py-2.5 px-3">Warehouse Rack</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allAvailablePetis.map((peti) => {
                      const isSelected = selectedPetiIds.includes(peti._id);
                      return (
                        <tr
                          key={peti._id}
                          className={`hover:bg-emerald-50/30 transition-colors ${
                            isSelected ? 'bg-emerald-50/20' : 'opacity-75'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectPeti(peti._id)}
                              className="w-4 h-4 accent-[#0F6E56] cursor-pointer rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold">
                              {peti.petiTitle}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-[#0F6E56]">
                            {peti.qrId}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {peti.productName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {peti.batchNumber}
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-800">
                            {peti.petiWeight}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {peti.purchaseInvoice}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600">
                            {peti.totalPieces} Pcs
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {peti.warehouseLocation || 'RAIPUR GODOWN'}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handlePrintSinglePeti(peti)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] font-bold text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 inline-flex border border-emerald-200 cursor-pointer shadow-2xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Peti</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Printable Sticker View (Only rendered during print) */}
          <div className="print-only">
            <StickerPrintView
              boxes={petisToRender}
              selectedBoxIds={selectedPetiIds}
              printerFormat={printerFormat}
            />
          </div>
        </div>
      )}

      {/* Front-and-Center Print Status & Live Logs Modal */}
      {printingStatus && (
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden transform scale-100 transition-all">
            {/* Modal Header */}
            <div className={`p-4 flex items-center justify-between text-white ${
              printingStatus.type === 'loading'
                ? 'bg-amber-600'
                : printingStatus.type === 'success'
                ? 'bg-[#0F6E56]'
                : printingStatus.type === 'error'
                ? 'bg-rose-600'
                : 'bg-slate-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  {printingStatus.type === 'loading' ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : printingStatus.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : printingStatus.type === 'error' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Printer className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">
                    {printingStatus.title || (printingStatus.type === 'loading' ? 'Printing in Progress...' : printingStatus.type === 'success' ? 'Print Success!' : printingStatus.type === 'error' ? 'Print Error' : 'Print Preview')}
                  </h3>
                  <p className="text-white/80 text-[11px] font-medium">
                    {detectedPrinterName || 'TSC TE244'} • 2-Across 50x25mm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintingStatus(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Status & Live Logs */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-900 leading-snug">
                  {printingStatus.message}
                </p>
              </div>

              {/* Console / Terminal Style Live Logs Box */}
              {printingStatus.logs && printingStatus.logs.length > 0 && (
                <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1.5 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1 font-sans font-bold uppercase tracking-wider">
                    <span>Print Dispatch Log</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      port 9191
                    </span>
                  </div>
                  {printingStatus.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 select-none font-bold">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {printingStatus.type === 'error' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPrintingStatus(null);
                      setShowPrinterHelpModal(true);
                    }}
                    className="text-xs font-bold text-[#0F6E56] hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Windows Service (.zip)</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {printingStatus.type === 'loading' ? 'Transmitting data to printer...' : 'Ready'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPrintingStatus(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {printingStatus.type === 'loading' ? 'Dismiss' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printer Help & Windows Service Download Modal */}
      {showPrinterHelpModal && (
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm">Windows Printer Service Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrinterHelpModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="font-medium text-slate-600">
                To print directly to TSC TE244 thermal printer in 1 click without any browser print popup, run the background service on your Windows PC:
              </p>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-900">3 Easy Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium">
                  <li>Download and extract <b>windows-printer-service.zip</b>.</li>
                  <li>Right-click <b>install-auto-startup.bat</b> and click <b>Run as administrator</b>.</li>
                  <li>It runs automatically in background 24/7 on port 9191!</li>
                </ol>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <a
                  href="/windows-printer-service.zip"
                  download="windows-printer-service.zip"
                  className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold px-4 py-2 rounded-xl transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Service (.zip)</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowPrinterHelpModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
