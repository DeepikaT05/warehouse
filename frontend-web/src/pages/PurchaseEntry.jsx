import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  Upload,
  CheckCircle,
  QrCode,
  FileText,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Loader2,
  X,
  Calculator,
  IndianRupee,
  Scale,
  RefreshCw,
  Database,
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  Download
} from 'lucide-react';

export default function PurchaseEntry() {
  const navigate = useNavigate();
  const todayDate = new Date().toISOString().split('T')[0];

  // Helper to parse master packing strings (e.g. "10 kg/case", "5 Ltr/case", "500 ml")
  const parseMasterPacking = (str) => {
    if (!str) return { value: 10, unit: 'kg', customText: '' };
    const trimmed = String(str).trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(kg|ltr|liter|litres|ml|box|boxes|unit|units)?(?:\/case|\/box)?$/i);
    if (match) {
      let u = (match[2] || 'kg').toLowerCase();
      if (u === 'liter' || u === 'litres') u = 'ltr';
      if (u === 'units' || u === 'boxes') u = 'box';
      return {
        value: parseFloat(match[1]) || 10,
        unit: ['kg', 'ltr', 'ml', 'box'].includes(u) ? u : 'custom',
        customText: trimmed
      };
    }
    return { value: 10, unit: 'custom', customText: trimmed };
  };

  const getPiecesPerPeti = (packing) => {
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
  };

  // Helper to create a new item row with defaults
  const createNewItem = (id = Date.now()) => ({
    id,
    productName: '',
    technicalName: '',
    hsnCode: '',
    batchNumber: '',
    packing: '1 LTR',
    mfgDate: todayDate,
    expDate: '',
    cases: 8,
    pcsPerCase: 10,
    casePackingValue: 10,
    casePackingUnit: 'ltr',
    customCasePacking: '',
    casePacking: '10 Ltr/case',
    quantity: 80,
    weight: '1 LTR',
    costRate: '',
    costUnit: 'box',
    purchaseCost: '',
    customCostUnit: '',
    customCostQty: '',
    totalPrice: '',
    warehouseLocation: 'RAIPUR GODOWN',
    remarks: ''
  });

  // Comprehensive calculation helper for a single product item with bidirectional Peti & Stock auto-sync
  const recalculateItem = (item, field, value) => {
    const updated = { ...item, [field]: value };

    // 0. When product name changes -> look up official conversion from Product Master
    if (field === 'productName' && value) {
      const cleanVal = value.trim().toLowerCase();
      const matched = productList.find(p => p.name?.trim().toLowerCase() === cleanVal);
      if (matched) {
        if (matched.conversion && Number(matched.conversion) > 0) {
          updated.pcsPerCase = Number(matched.conversion);
          updated.conversion = Number(matched.conversion);
        }
        if (matched.packingSize) {
          updated.packing = matched.packingSize;
          updated.weight = matched.packingSize;
        }
        if (matched.hsnCode) updated.hsnCode = matched.hsnCode;
        if (matched.description) updated.technicalName = matched.description;
        const numCases = parseFloat(updated.cases) || 0;
        if (numCases > 0 && updated.pcsPerCase > 0) {
          updated.quantity = Math.round(numCases * updated.pcsPerCase);
        }
      }
    }

    // 1. When packing changes -> auto-set pieces per peti from product master if known, else fallback
    if (field === 'packing' && value) {
      const matched = productList.find(p => p.name?.trim().toLowerCase() === (updated.productName || '').trim().toLowerCase());
      const defaultPcs = (matched && matched.conversion > 0) ? matched.conversion : getPiecesPerPeti(value);
      updated.pcsPerCase = defaultPcs;
      updated.conversion = defaultPcs;
      const numCases = parseFloat(updated.cases) || 0;
      if (numCases > 0) {
        updated.quantity = Math.round(numCases * defaultPcs);
      }
    }

    // 2. When Peti (cases) changes -> auto-calculate Total Stock (quantity)
    if (field === 'cases') {
      const parsedCases = parseFloat(value);
      if (!isNaN(parsedCases)) {
        const pcs = parseFloat(updated.pcsPerCase) || getPiecesPerPeti(updated.packing);
        updated.quantity = Math.round(parsedCases * pcs);
      }
    }

    // 3. When Pieces per Peti (pcsPerCase) changes -> recalculate Total Stock
    if (field === 'pcsPerCase') {
      const pcs = parseFloat(value);
      if (!isNaN(pcs) && pcs > 0) {
        const numCases = parseFloat(updated.cases) || 0;
        if (numCases > 0) {
          updated.quantity = Math.round(numCases * pcs);
        }
      }
    }

    // 4. When Total Stock (quantity) changes -> auto-calculate Peti (cases)
    if (field === 'quantity') {
      const totalStock = parseFloat(value);
      if (!isNaN(totalStock)) {
        const pcs = parseFloat(updated.pcsPerCase) || getPiecesPerPeti(updated.packing);
        if (pcs > 0) {
          updated.cases = Math.round((totalStock / pcs) * 100) / 100;
        }
      }
    }

    const numCases = Math.max(1, parseFloat(updated.cases) || 1);
    const numPieces = Math.max(1, parseInt(updated.quantity, 10) || 1);
    const pcsPerCase = parseFloat(updated.pcsPerCase) || 10;
    const costUnit = updated.costUnit || 'box';

    // Format casePacking string
    updated.casePacking = `${pcsPerCase} ${updated.packing || 'units'}/case`;

    // Keep weight synced with packing
    if (updated.packing && updated.packing.trim()) {
      updated.weight = updated.packing.trim();
    }

    // Cost & Total Calculations
    if (field === 'totalPrice') {
      const total = parseFloat(value);
      if (isNaN(total) || value === '') {
        updated.totalPrice = value;
        updated.purchaseCost = '';
        updated.costRate = '';
      } else {
        const perPiece = numPieces > 0 ? (total / numPieces) : 0;
        updated.purchaseCost = Math.round(perPiece * 100) / 100;
        if (costUnit === 'box' || costUnit === 'piece') {
          updated.costRate = updated.purchaseCost;
        } else if (costUnit === 'case') {
          updated.costRate = numCases > 0 ? Math.round((total / numCases) * 100) / 100 : total;
        } else if (costUnit === 'total') {
          updated.costRate = total;
        }
        updated.totalPrice = value;
      }
    } else {
      const rate = parseFloat(updated.costRate);
      if (isNaN(rate) || updated.costRate === '') {
        updated.purchaseCost = '';
        updated.totalPrice = '';
      } else {
        let perPiece = 0;
        if (costUnit === 'box' || costUnit === 'piece') {
          perPiece = rate;
        } else if (costUnit === 'case') {
          perPiece = pcsPerCase > 0 ? (rate / pcsPerCase) : rate;
        } else if (costUnit === 'total') {
          perPiece = numPieces > 0 ? (rate / numPieces) : rate;
        } else {
          perPiece = rate;
        }

        perPiece = Math.round(perPiece * 100) / 100;
        updated.purchaseCost = perPiece;

        const total = costUnit === 'total' ? rate : (costUnit === 'case' ? Math.round(rate * numCases * 100) / 100 : Math.round(perPiece * numPieces * 100) / 100);
        updated.totalPrice = total;
      }
    }

    return updated;
  };

  const [headerData, setHeaderData] = useState({
    invoiceNumber: '',
    purchaseDate: todayDate,
    manufacturer: '',
    invoiceDate: todayDate,
    transport: '',
    lrNumber: ''
  });

  const [items, setItems] = useState([createNewItem(1)]);

  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const [result, setResult] = useState(null);
  const [billFileName, setBillFileName] = useState('');

  // Tally Integration State
  const [tallyStatus, setTallyStatus] = useState(null);
  const [tallySyncing, setTallySyncing] = useState(false);
  const [uploadingTallyFile, setUploadingTallyFile] = useState(false);
  const [tallySyncMessage, setTallySyncMessage] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // Default to 'list' so user immediately sees all purchases
  const [purchaseList, setPurchaseList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pushingToTallyId, setPushingToTallyId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const tallyFileInputRef = React.useRef(null);

  useEffect(() => {
    fetchTallyStatus();
    fetchPurchases();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data && res.data.success) {
        setProductList(res.data.products || []);
      }
    } catch (e) {
      console.warn('Failed to load products in PurchaseEntry:', e);
    }
  };

  const fetchTallyStatus = async () => {
    try {
      const res = await api.get('/purchases/tally/status');
      if (res.data && res.data.success) {
        setTallyStatus(res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch Tally status:', e.message);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoadingPurchases(true);
      const res = await api.get('/purchases');
      if (res.data && res.data.success) {
        setPurchaseList(res.data.purchases || []);
      }
    } catch (e) {
      console.error('Failed to load purchases:', e);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const handleTallyFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingTallyFile(true);
      setTallySyncMessage(`Reading ${file.name} and generating QR StockBoxes...`);
      const formData = new FormData();
      formData.append('tallyFile', file);
      const res = await api.post('/purchases/tally/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setTallySyncMessage(res.data.message || 'Tally stock file successfully imported!');
        await fetchPurchases();
        setActiveTab('list');
      }
    } catch (err) {
      console.error('Tally file upload failed:', err);
      setTallySyncMessage(err.response?.data?.message || err.message || 'Failed to import Tally file');
    } finally {
      setUploadingTallyFile(false);
      if (tallyFileInputRef.current) tallyFileInputRef.current.value = '';
      setTimeout(() => setTallySyncMessage(''), 10000);
    }
  };

  const handleSyncTally = async () => {
    try {
      setTallySyncing(true);
      setTallySyncMessage('Checking local Tally bridge on port 9191...');
      
      // Try local printer/tally bridge first if running on local PC
      let syncedViaBridge = false;
      try {
        const localBridgeRes = await fetch('http://127.0.0.1:9191/tally-status', { signal: AbortSignal.timeout(2000) });
        if (localBridgeRes.ok) {
          const bridgeData = await localBridgeRes.json();
          if (bridgeData.online && bridgeData.activeHost) {
            setTallySyncMessage(`Local Tally detected at ${bridgeData.activeHost}. Exporting vouchers...`);
            const exportXml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>Voucher Register</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVCURRENTCOMPANY>VANIKI CROP SCIENCE PVT. LTD.</SVCURRENTCOMPANY><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
            const proxyRes = await fetch(`http://127.0.0.1:9191/tally-proxy?host=${encodeURIComponent(bridgeData.activeHost)}`, {
              method: 'POST',
              body: exportXml,
              signal: AbortSignal.timeout(15000)
            });
            if (proxyRes.ok) {
              const xmlText = await proxyRes.text();
              const serverRes = await api.post('/purchases/tally/sync-xml', { xmlString: xmlText, autoGenerateBoxes: true });
              setTallySyncMessage(serverRes.data.message || 'Synced directly from local Tally bridge!');
              syncedViaBridge = true;
            }
          }
        }
      } catch (bridgeErr) {
        console.log('Local bridge check skipped:', bridgeErr.message);
      }

      if (!syncedViaBridge) {
        setTallySyncMessage('Connecting to Tally server...');
        const res = await api.post('/purchases/tally/sync', { autoGenerateBoxes: true });
        if (res.data && res.data.success) {
          setTallySyncMessage(res.data.message || 'Purchases successfully synced from Tally!');
        }
      }

      await fetchPurchases();
      setActiveTab('list');
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to sync from Tally';
      if (msg.includes('EHOSTUNREACH') || msg.includes('fetch failed')) {
        setTallySyncMessage('Tally local LAN IP (192.168.1.43) par chal raha hai. Aap upar diye gaye "Import Tally File" button se bhi file drop kar sakte hain ya laptop par background printer service chalu rakhein.');
      } else {
        setTallySyncMessage(msg);
      }
    } finally {
      setTallySyncing(false);
      setTimeout(() => setTallySyncMessage(''), 12000);
    }
  };

  const handlePushToTally = async (id) => {
    try {
      setPushingToTallyId(id);
      const res = await api.post(`/purchases/tally/push/${id}`);
      if (res.data && res.data.success) {
        alert('Successfully pushed to Tally!');
        await fetchPurchases();
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to push to Tally');
    } finally {
      setPushingToTallyId(null);
    }
  };

  const handleDownloadPdf = async (purchaseId, invoiceNumber) => {
    try {
      setDownloadingPdfId(purchaseId);
      const res = await api.get(`/purchases/${purchaseId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Purchase_${invoiceNumber || purchaseId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to generate PDF voucher: ' + (err.response?.data?.message || err.message));
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleHeaderChange = (e) => {
    setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = recalculateItem(updated[index], field, value);
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      createNewItem(Date.now() + Math.random())
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setBillFileName(file.name);
    setOcrLoading(true);
    setOcrSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('billFile', file);

      const res = await api.post('/purchases/ocr-extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const ocr = res.data.ocrData;

        // Auto-fill header fields
        setHeaderData(prev => ({
          ...prev,
          invoiceNumber: ocr.invoiceNumber || prev.invoiceNumber,
          manufacturer: ocr.manufacturer || prev.manufacturer,
          purchaseDate: ocr.purchaseDate || prev.purchaseDate,
          invoiceDate: ocr.purchaseDate || prev.invoiceDate,
          transport: ocr.transport || prev.transport,
          lrNumber: ocr.lrNumber || prev.lrNumber
        }));

        // Auto-fill product line items with smart packing parsing
        if (Array.isArray(ocr.items) && ocr.items.length > 0) {
          const formattedItems = ocr.items.map((item, idx) => {
            const rawCases = item.cases || item.quantity || 10;
            const parsedPacking = parseMasterPacking(item.casePacking || item.packing || item.weight);
            const rawCost = parseFloat(item.purchaseCost) || 0;
            const initialItem = {
              id: Date.now() + idx,
              productName: item.productName || '',
              technicalName: item.technicalName || '',
              hsnCode: item.hsnCode || '',
              batchNumber: item.batchNumber || `BATCH-${Date.now().toString().slice(-4)}`,
              packing: item.packing || item.weight || '1 kg',
              mfgDate: item.mfgDate || todayDate,
              expDate: item.expDate || '',
              cases: rawCases,
              casePackingValue: parsedPacking.value,
              casePackingUnit: parsedPacking.unit,
              customCasePacking: parsedPacking.unit === 'custom' ? parsedPacking.customText : '',
              casePacking: item.casePacking || `${parsedPacking.value} ${parsedPacking.unit}/case`,
              quantity: item.quantity || rawCases,
              weight: item.packing || item.weight || `${parsedPacking.value} ${parsedPacking.unit}`,
              costRate: rawCost > 0 ? rawCost : '',
              costUnit: 'box',
              purchaseCost: rawCost > 0 ? rawCost : '',
              totalPrice: rawCost > 0 ? Math.round(rawCost * rawCases * 100) / 100 : '',
              warehouseLocation: item.warehouseLocation || 'Rack A1',
              remarks: item.remarks || ''
            };
            return initialItem;
          });
          setItems(formattedItems);
        }

        setOcrSuccessMsg(`Gemini 3.8 Flash AI extracted Invoice #${ocr.invoiceNumber || ''} with ${ocr.items?.length || 1} product line item(s)! Review and submit below.`);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('AI OCR extraction notice: ' + (err.response?.data?.message || err.message || 'Please fill in details manually.'));
    } finally {
      setOcrLoading(false);
    }
  };

  const totalBoxesCount = items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
  const totalInvoicePrice = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        ...headerData,
        items: items.map(item => {
          const effectivePacking = (item.packing && item.packing.trim()) || (item.weight && item.weight.trim()) || '1 kg';
          return {
            ...item,
            packing: effectivePacking,
            weight: effectivePacking,
            quantity: parseInt(item.quantity, 10) || parseInt(item.cases, 10) || 1,
            cases: parseInt(item.cases, 10) || parseInt(item.quantity, 10) || 1,
            conversion: parseInt(item.pcsPerCase, 10) || 10,
            purchaseCost: parseFloat(item.purchaseCost) || 0,
            totalPrice: parseFloat(item.totalPrice) || (parseFloat(item.purchaseCost) * (parseInt(item.quantity, 10) || 1)) || 0,
            costRate: parseFloat(item.costRate) || parseFloat(item.purchaseCost) || 0,
            costUnit: item.costUnit || 'box'
          };
        })
      };

      const res = await api.post('/purchases', payload);
      if (res.data.success) {
        setResult(res.data);
        fetchPurchases();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-[#0F6E56]" />
            <span>Purchase Entry & Stock Intake</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log manufacturer invoices, multi-unit master packing, cost calculations & auto-generate box QR codes
          </p>
        </div>
      </div>

      {/* Tally Live Sync Banner & Quick Action */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Tally Live Sync & Auto Purchase Integration
              </h3>
              {tallyStatus?.online ? (
                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected: {tallyStatus.activeCompany || 'VANIKI CROP SCIENCE'} ({tallyStatus.host}:{tallyStatus.port})
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                  Tally Offline ({tallyStatus?.host || '192.168.1.43'}:{tallyStatus?.port || 9000})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Tally me darz sabhi purchase bills yahan auto-sync hote hain, aur yahan ki gayi nayi entry seedhe Tally me save hoti hai.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="file"
            ref={tallyFileInputRef}
            accept=".xls,.xlsx,.xml"
            onChange={handleTallyFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadingTallyFile || tallySyncing}
            onClick={() => tallyFileInputRef.current?.click()}
            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
            title="Import Tally Stock Summary (.xls/.xlsx) or Voucher XML directly"
          >
            {uploadingTallyFile ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{uploadingTallyFile ? 'Importing File...' : 'Import Tally File (Excel / XML)'}</span>
          </button>

          <button
            type="button"
            disabled={tallySyncing || uploadingTallyFile}
            onClick={handleSyncTally}
            className="bg-[#0F6E56] hover:bg-[#084D3C] text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${tallySyncing ? 'animate-spin' : ''}`} />
            <span>{tallySyncing ? 'Syncing...' : 'Sync Purchases from Tally'}</span>
          </button>
        </div>
      </div>

      {tallySyncMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-[#0F6E56] rounded-xl p-3 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{tallySyncMessage}</span>
          </div>
          <button onClick={() => setTallySyncMessage('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'new'
                ? 'border-[#0F6E56] text-[#0F6E56]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackagePlus className="w-4 h-4" />
            <span>New Purchase & Inward</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('list'); fetchPurchases(); }}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-[#0F6E56] text-[#0F6E56]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Synced Purchases & Bills ({purchaseList.length})</span>
          </button>
        </div>
      </div>

      {/* OCR Progress / Scanner Status */}
      {ocrLoading && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 text-center space-y-2 animate-pulse">
          <Loader2 className="w-8 h-8 text-[#0F6E56] animate-spin mx-auto" />
          <h4 className="font-extrabold text-xs text-[#0F6E56] uppercase tracking-wider">
            Gemini 3.8 Flash AI Scanning Bill...
          </h4>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Extracting invoice number, manufacturer, product brands, batches, master packing & quantities directly from document.
          </p>
        </div>
      )}

      {ocrSuccessMsg && !ocrLoading && (
        <div className="bg-gradient-to-r from-emerald-500 to-[#0F6E56] text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-black tracking-wide">AI OCR Extraction Complete</h4>
              <p className="text-xs text-white/90 font-medium">{ocrSuccessMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setOcrSuccessMsg('')}
            className="text-white/80 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border-2 border-[#1D9E75] rounded-2xl p-6 shadow-md text-slate-900 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#0F6E56]">Purchase Bill Logged & QR Generated!</h3>
              <p className="text-xs text-slate-600 font-medium">{result.message}</p>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Boxes</span>
              <p className="font-black text-slate-900 text-lg">{result.totalBoxesGenerated}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">First QR ID</span>
              <p className="font-mono font-bold text-[#0F6E56]">{result.firstQrId}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Last QR ID</span>
              <p className="font-mono font-bold text-[#0F6E56]">{result.lastQrId}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(result.purchase._id, result.purchase.invoiceNumber)}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-2.5 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Bill PDF</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/qr-print?purchaseId=${result.purchase._id}`)}
                className="flex-1 bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs py-2 px-2.5 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Print QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Card */}
      {activeTab === 'new' && (
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Bill Upload / Gemini OCR Section */}
        <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-5 text-center transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-[#0F6E56] text-white mx-auto flex items-center justify-center shadow-md mb-2">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-extrabold text-slate-800">
            Smart AI Bill OCR (Gemini 3.8 Flash)
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload Manufacturer Purchase Bill (PDF or JPG/PNG) to automatically extract and populate all fields
          </p>
          <input
            type="file"
            id="bill-file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileUpload}
            disabled={ocrLoading}
          />
          <label
            htmlFor="bill-file"
            className={`mt-3 inline-flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md transition-all ${
              ocrLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{ocrLoading ? 'Scanning with Gemini AI...' : (billFileName ? `Selected: ${billFileName} (Click to re-scan)` : 'Upload Bill for Instant AI Fill')}</span>
          </label>
        </div>

        {/* Section 1: Purchase & Transport Info */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-100 pb-1 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#0F6E56]" />
            <span>1. Invoice & Transport Details</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                name="invoiceNumber"
                value={headerData.invoiceNumber}
                onChange={handleHeaderChange}
                placeholder="e.g. INV-2026-991"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Manufacturer *</label>
              <input
                type="text"
                required
                name="manufacturer"
                value={headerData.manufacturer}
                onChange={handleHeaderChange}
                placeholder="e.g. Vaniki Crop Science Labs"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={headerData.purchaseDate}
                onChange={handleHeaderChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transport Company</label>
              <input
                type="text"
                name="transport"
                value={headerData.transport}
                onChange={handleHeaderChange}
                placeholder="e.g. VRL Logistics"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">LR Number</label>
              <input
                type="text"
                name="lrNumber"
                value={headerData.lrNumber}
                onChange={handleHeaderChange}
                placeholder="e.g. LR-88471"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Dynamic Product & Box Specifications with + Add Product Button */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0F6E56]" />
              <span>2. Product Specifications ({items.length} Product Item{items.length === 1 ? '' : 's'})</span>
            </h3>

            <button
              type="button"
              onClick={handleAddItem}
              className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Item</span>
            </button>
          </div>

          {items.map((item, index) => {
            const numCases = Number(item.cases) || Number(item.quantity) || 0;
            const packVal = Number(item.casePackingValue) || 0;
            const totalUnits = numCases * packVal;

            return (
              <div
                key={item.id}
                className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4 relative shadow-2xs hover:border-emerald-300 transition-colors"
              >
                {/* Line Item Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-extrabold text-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#0F6E56] text-[11px] flex items-center justify-center font-black">
                      {index + 1}
                    </span>
                    <span>Product Line Item #{index + 1}</span>
                    {item.productName && (
                      <span className="text-slate-500 font-semibold truncate max-w-xs">
                        — {item.productName}
                      </span>
                    )}
                  </span>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      title="Remove this product item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs">
                  {/* Product Name, Technical Name, HSN */}
                  <div className="md:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">
                      Product Name (Brand) *
                      {item.pcsPerCase ? (
                        <span className="ml-2 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          📦 {item.pcsPerCase} Pcs / Peti
                        </span>
                      ) : null}
                    </label>
                    <input
                      type="text"
                      required
                      list="purchase-products-datalist"
                      value={item.productName}
                      onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                      placeholder="e.g. AMBITION 1LTR, CURVE 160GM"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                    <datalist id="purchase-products-datalist">
                      {productList.map(p => (
                        <option key={p._id || p.name} value={p.name}>
                          {p.name} ({p.packingSize || ''} • 1 Peti = {p.conversion || 10} Pcs)
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">
                      Technical / Chemical Name <span className="text-[10px] text-slate-400 font-normal">(Auto AI / Manual)</span>
                    </label>
                    <input
                      type="text"
                      value={item.technicalName || ''}
                      onChange={(e) => handleItemChange(index, 'technicalName', e.target.value)}
                      placeholder="e.g. Chlorantraniliprole 18.5% SC"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">HSN / SAC Code</label>
                    <input
                      type="text"
                      value={item.hsnCode}
                      onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                      placeholder="e.g. 38089910"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  {/* Batch, Packing, Mfg Date, Expiry Date */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Batch Number *</label>
                    <input
                      type="text"
                      required
                      value={item.batchNumber}
                      onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)}
                      placeholder="e.g. BATCH-2026A"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Packing (Unit Size) *</label>
                    <input
                      type="text"
                      required
                      value={item.packing}
                      onChange={(e) => handleItemChange(index, 'packing', e.target.value)}
                      placeholder="e.g. 500ml / 1 kg / 5 Ltr"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Mfg Date</label>
                    <input
                      type="date"
                      value={item.mfgDate}
                      onChange={(e) => handleItemChange(index, 'mfgDate', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={item.expDate}
                      onChange={(e) => handleItemChange(index, 'expDate', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>
                </div>

                {/* Row 2: Peti (Cases) & Total Stock (Quantity) Auto-Calculation */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs pt-2 border-t border-slate-200/60 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-100/80">
                  {/* Field 1: Peti (No. of Cases) */}
                  <div className="md:col-span-4">
                    <label className="block font-extrabold text-slate-800 mb-1 flex items-center justify-between">
                      <span>📦 Peti (No. of Cases) *</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">Peti Count</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      value={item.cases}
                      onChange={(e) => handleItemChange(index, 'cases', e.target.value)}
                      placeholder="e.g. 8"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56] shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Number of Petis received
                    </span>
                  </div>

                  {/* Field 2: Pieces per Peti (Pack Size) */}
                  <div className="md:col-span-4">
                    <label className="block font-extrabold text-slate-800 mb-1 flex items-center justify-between">
                      <span>🍾 Pieces per Peti (Pack Size) *</span>
                      <span className="text-[10px] font-bold text-slate-500">Auto-filled</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.pcsPerCase || 10}
                      onChange={(e) => handleItemChange(index, 'pcsPerCase', e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      1 Peti = {item.pcsPerCase || 10} {item.packing || 'bottles'}
                    </span>
                  </div>

                  {/* Field 3: Total Stock (Pieces / QR Count) */}
                  <div className="md:col-span-4">
                    <label className="block font-extrabold text-slate-800 mb-1 flex items-center justify-between">
                      <span>🔢 Total Stock (Pieces / QR Count) *</span>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">Auto-Synced</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="e.g. 80"
                      className="w-full bg-emerald-100/70 border border-emerald-400 rounded-xl px-3 py-2 text-xs font-black text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56] shadow-2xs"
                    />
                    <span className="text-[10px] text-[#0F6E56] font-bold mt-1 block">
                      ✓ {item.cases || 0} Peti × {item.pcsPerCase || 10} = {item.quantity || 0} Total Pieces (QR Codes)
                    </span>
                  </div>
                </div>

                {/* Row 3: Purchase Cost with Dropdown + Total Price */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs pt-1 border-t border-slate-200/60">
                  {/* Purchase Cost Input + Dropdown (per kg, per ltr, per ml, per box, custom) */}
                  <div className="md:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">
                      Purchase Cost / Rate
                    </label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.costRate}
                          onChange={(e) => handleItemChange(index, 'costRate', e.target.value)}
                          placeholder="e.g. 50 or 450"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        />
                      </div>
                      <select
                        value={item.costUnit}
                        onChange={(e) => handleItemChange(index, 'costUnit', e.target.value)}
                        className="w-40 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] cursor-pointer"
                      >
                        <option value="box">per Box / Case</option>
                        <option value="kg">per Kg</option>
                        <option value="ltr">per Liter (Ltr)</option>
                        <option value="ml">per ML</option>
                        <option value="total">Total Amount (₹)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {/* Custom Cost Parameter Section */}
                    {item.costUnit === 'custom' && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Custom Cost Parameters</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Rate (₹)</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-[10px]">₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.costRate}
                                onChange={(e) => handleItemChange(index, 'costRate', e.target.value)}
                                placeholder="e.g. 150"
                                className="w-full bg-white border border-amber-300 rounded-lg pl-6 pr-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Per Unit (e.g. per Piece, per Strip)</label>
                            <input
                              type="text"
                              value={item.customCostUnit || ''}
                              onChange={(e) => handleItemChange(index, 'customCostUnit', e.target.value)}
                              placeholder="e.g. Piece, Strip, Sachet"
                              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Qty per Case</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.customCostQty || ''}
                              onChange={(e) => handleItemChange(index, 'customCostQty', e.target.value)}
                              placeholder="e.g. 12"
                              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-600 block">
                          {item.costRate && item.customCostQty
                            ? `₹${Number(item.costRate).toLocaleString('en-IN')}/${item.customCostUnit || 'unit'} × ${item.customCostQty} = ₹${(Number(item.costRate) * Number(item.customCostQty)).toLocaleString('en-IN')}/case`
                            : 'Enter rate, unit name and quantity per case to calculate cost'
                          }
                        </span>
                      </div>
                    )}
                    {item.costUnit !== 'custom' && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {item.costRate ? (
                          item.costUnit === 'box'
                            ? `Rate: ₹${Number(item.costRate).toLocaleString('en-IN')}/box`
                            : item.costUnit === 'total'
                            ? `Total: ₹${Number(item.costRate).toLocaleString('en-IN')} (₹${Number(item.purchaseCost || 0).toLocaleString('en-IN')}/box)`
                            : `₹${Number(item.costRate).toLocaleString('en-IN')} / ${item.costUnit} × ${item.casePackingValue || 0} ${item.casePackingUnit} = ₹${Number(item.purchaseCost || 0).toLocaleString('en-IN')}/box`
                        ) : (
                          'Enter rate and choose per kg, per ltr, per ml, per box, or custom'
                        )}
                      </span>
                    )}
                  </div>

                  {/* Calculated Cost Per Box */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Purchase Cost (per box)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="any"
                        value={item.purchaseCost}
                        onChange={(e) => handleItemChange(index, 'purchaseCost', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Cost logged per QR sticker</span>
                  </div>

                  {/* NEW Total Price field requested by user */}
                  <div className="md:col-span-4">
                    <label className="block font-bold text-[#0F6E56] mb-1 flex items-center justify-between">
                      <span>Total Price (This Item) *</span>
                      <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                        Auto Calculated
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-800 font-black">₹</span>
                      <input
                        type="number"
                        step="any"
                        value={item.totalPrice}
                        onChange={(e) => handleItemChange(index, 'totalPrice', e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full bg-emerald-50 border border-emerald-300 rounded-xl pl-7 pr-3 py-2 text-xs font-black text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] shadow-2xs"
                      />
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                      {item.totalPrice ? `${item.cases || item.quantity || 1} Cases × ₹${item.purchaseCost || 0} = ₹${Number(item.totalPrice).toLocaleString('en-IN')}` : 'Auto-computed from rate × quantity'}
                    </span>
                  </div>
                </div>

                {/* Live Item Summary Card */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="text-slate-500 font-medium">Boxes:</span>
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-900 font-black">
                        {item.cases || item.quantity || 0} Cases
                      </span>
                    </div>

                    {item.casePackingUnit !== 'custom' && (
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className="text-slate-500 font-medium">Net Quantity:</span>
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-900 font-black">
                          {totalUnits.toLocaleString()} {item.casePackingUnit}
                        </span>
                      </div>
                    )}

                    {Number(item.purchaseCost) > 0 && (
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className="text-slate-500 font-medium">Cost/Box:</span>
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-900 font-black">
                          ₹{Number(item.purchaseCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Product Item Total:</span>
                    <span className="text-sm font-black text-[#0F6E56] bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                      ₹{Number(item.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Row 4: Warehouse Location & Remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Warehouse Location / Rack</label>
                    <input
                      type="text"
                      value={item.warehouseLocation}
                      onChange={(e) => handleItemChange(index, 'warehouseLocation', e.target.value)}
                      placeholder="e.g. Rack A1-Bay 2"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                      placeholder="Optional notes or supplier details..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Another Product Secondary Action */}
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 text-[#0F6E56] font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Product to Invoice</span>
          </button>
        </div>

        {/* Submit & Grand Total Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
            <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Products: </span>
              <span className="text-slate-900 font-black">{items.length}</span>
            </div>
            <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-[#0F6E56]">
              <span className="font-medium">Total Boxes (QR Stickers): </span>
              <span className="font-black text-sm">{totalBoxesCount} Boxes</span>
            </div>
            {totalInvoicePrice > 0 && (
              <div className="bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-950">
                <span className="font-medium">Total Bill Amount: </span>
                <span className="font-black text-sm">₹{totalInvoicePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#0F6E56] hover:bg-[#0B5442] disabled:opacity-50 text-white font-extrabold text-xs px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>
              {loading
                ? 'Saving Purchase & Generating QRs...'
                : `Save Purchase & Generate ${totalBoxesCount} QR Stickers`}
            </span>
          </button>
        </div>
      </form>
      )}

      {/* Synced Purchases Table Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, supplier or product name..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <button
              type="button"
              disabled={loadingPurchases}
              onClick={fetchPurchases}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPurchases ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Manufacturer / Supplier</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Batch No</th>
                  <th className="py-3 px-4">Boxes / Qty</th>
                  <th className="py-3 px-4">Tally Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseList
                  .filter(p => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.invoiceNumber?.toLowerCase().includes(q) ||
                      p.manufacturer?.toLowerCase().includes(q) ||
                      p.productName?.toLowerCase().includes(q) ||
                      p.batchNumber?.toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const isSynced = p.tallySyncStatus === 'synced';
                    return (
                      <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {p.manufacturer}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#0F6E56]">
                          <div>{p.productName}</div>
                          {p.packing && (
                            <span className="inline-block text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                              {p.packing}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {p.batchNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">
                            {p.cases || (p.conversion && p.conversion > 0 ? Math.round(p.quantity / p.conversion) : p.quantity)}{' '}
                            <span className="text-slate-500 font-bold text-[11px]">Cases</span>
                          </div>
                          <div className="text-slate-400 font-medium text-[10px]">
                            {p.quantity} {p.unit || 'Ltr'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isSynced ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                              <Check className="w-3 h-3" />
                              Tally Synced {p.tallyVoucherNumber ? `(#${p.tallyVoucherNumber})` : ''}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={pushingToTallyId === p._id}
                              onClick={() => handlePushToTally(p._id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300 transition cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${pushingToTallyId === p._id ? 'animate-spin' : ''}`} />
                              Push to Tally
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={downloadingPdfId === p._id}
                              onClick={() => handleDownloadPdf(p._id, p.invoiceNumber)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Download Purchase Bill & Goods Inward Note PDF"
                            >
                              {downloadingPdfId === p._id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F6E56]" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-slate-600" />
                              )}
                              <span>Bill PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/qr-print?purchaseInvoice=${encodeURIComponent(p.invoiceNumber)}`)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-200 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Print QR</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {purchaseList.length === 0 && !loadingPurchases && (
              <div className="p-8 text-center text-slate-500">
                <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No purchases found yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click "Sync Purchases from Tally" above to import all vouchers.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
