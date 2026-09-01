import React, { useState, useEffect, useMemo } from 'react';
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
  FileText
} from 'lucide-react';

export default function QRPrintPage() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchaseId');
  const purchaseInvoiceParam = searchParams.get('purchaseInvoice') || searchParams.get('invoice');
  const singleQrParam = searchParams.get('qrId') || searchParams.get('qr');

  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(singleQrParam || '');
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState(purchaseInvoiceParam || '');
  const [selectedBoxIds, setSelectedBoxIds] = useState([]);
  
  // Accordion State: { [invoiceNo]: boolean }
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // Default: 'grouped' (Purchase Invoice Accordion List View)
  const [printPreset, setPrintPreset] = useState(singleQrParam ? '1' : 'all');

  useEffect(() => {
    fetchBoxesToPrint();
  }, [purchaseId, purchaseInvoiceParam, singleQrParam]);

  const fetchBoxesToPrint = async () => {
    setLoading(true);
    try {
      let endpoint = '/stock';
      const params = {};

      if (purchaseId) {
        endpoint = `/purchases/${purchaseId}`;
      } else if (purchaseInvoiceParam) {
        params.purchaseInvoice = purchaseInvoiceParam;
      } else if (singleQrParam) {
        params.search = singleQrParam;
      }

      const res = await api.get(endpoint, { params });
      if (res.data.success) {
        const fetchedBoxes = purchaseId ? res.data.boxes : res.data.boxes;
        setBoxes(fetchedBoxes || []);

        if (fetchedBoxes && fetchedBoxes.length > 0) {
          if (singleQrParam) {
            const match = fetchedBoxes.find(b => b.qrId === singleQrParam || b._id === singleQrParam);
            if (match) {
              setSelectedBoxIds([match._id]);
            } else {
              setSelectedBoxIds(fetchedBoxes.map(b => b._id));
            }
          } else {
            setSelectedBoxIds(fetchedBoxes.map(b => b._id));
          }

          // Expand all invoices by default
          const initExpanded = {};
          fetchedBoxes.forEach(b => {
            const invKey = b.purchaseInvoice || 'Unassigned';
            initExpanded[invKey] = true;
          });
          setExpandedInvoices(initExpanded);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Unique Purchase Invoice IDs for the top filter dropdown
  const uniqueInvoices = useMemo(() => {
    const set = new Set();
    boxes.forEach(b => {
      if (b.purchaseInvoice) set.add(b.purchaseInvoice);
    });
    return Array.from(set).sort();
  }, [boxes]);

  // Filter boxes by search query and purchase invoice filter
  const filteredBoxes = useMemo(() => {
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
  }, [boxes, searchQuery, purchaseInvoiceFilter]);

  // Group filtered boxes by Purchase Invoice ID (matching Stock page design)
  const invoiceGroups = useMemo(() => {
    const map = new Map();
    filteredBoxes.forEach(box => {
      const invKey = box.purchaseInvoice || 'Unassigned Invoice';
      if (!map.has(invKey)) {
        map.set(invKey, {
          invoiceNo: invKey,
          productName: box.productName,
          batchNumber: box.batchNumber,
          weight: box.weight || '1 kg',
          warehouseLocation: box.warehouseLocation || 'Rack A1',
          boxes: []
        });
      }
      map.get(invKey).boxes.push(box);
    });
    return Array.from(map.values());
  }, [filteredBoxes]);

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

  const handleToggleInvoiceCheck = (group) => {
    const groupBoxIds = group.boxes.map(b => b._id);
    const isFullySelected = groupBoxIds.every(id => selectedBoxIds.includes(id));

    if (isFullySelected) {
      const removeSet = new Set(groupBoxIds);
      setSelectedBoxIds(prev => prev.filter(id => !removeSet.has(id)));
    } else {
      setSelectedBoxIds(prev => Array.from(new Set([...prev, ...groupBoxIds])));
    }
  };

  const handleToggleSelectBox = (boxId) => {
    setPrintPreset('custom');
    setSelectedBoxIds(prev =>
      prev.includes(boxId) ? prev.filter(id => id !== boxId) : [...prev, boxId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredBoxes.map(b => b._id);
    setSelectedBoxIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    setPrintPreset('all');
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = new Set(filteredBoxes.map(b => b._id));
    setSelectedBoxIds(prev => prev.filter(id => !filteredIds.has(id)));
    setPrintPreset('custom');
  };

  const handleSelectFirst1 = () => {
    if (filteredBoxes.length > 0) {
      const firstBox = filteredBoxes[0];
      setSelectedBoxIds([firstBox._id]);
      setPrintPreset('1');
    }
  };

  const handlePresetChange = (countStr) => {
    setPrintPreset(countStr);
    if (countStr === '1') {
      handleSelectFirst1();
    } else if (countStr === '50') {
      setSelectedBoxIds(boxes.slice(0, 50).map(b => b._id));
    } else if (countStr === '100') {
      setSelectedBoxIds(boxes.slice(0, 100).map(b => b._id));
    } else {
      setSelectedBoxIds(boxes.map(b => b._id));
    }
  };

  // Print Single QR immediately
  const handlePrintSingle = (boxId) => {
    setSelectedBoxIds([boxId]);
    setPrintPreset('1');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Print Entire Purchase Invoice Group
  const handlePrintInvoiceGroup = (group) => {
    const groupBoxIds = group.boxes.map(b => b._id);
    setSelectedBoxIds(prev => Array.from(new Set([...prev, ...groupBoxIds])));
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const boxesToRender = boxes.filter(b => selectedBoxIds.includes(b._id));
  const isAllFilteredSelected =
    filteredBoxes.length > 0 &&
    filteredBoxes.every(b => selectedBoxIds.includes(b._id));

  return (
    <div className="space-y-6">
      {/* Top Header & Global Print Button (no-print) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#0F6E56]" />
            <span>QR & Barcode Sticker Printing Studio</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Grouped by Purchase Invoice ID with accordion list view & instant batch printing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-200">
            <button
              onClick={() => handlePresetChange('1')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                printPreset === '1'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Select 1 sticker only"
            >
              1 Sticker
            </button>
            <button
              onClick={() => handlePresetChange('50')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                printPreset === '50'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              50
            </button>
            <button
              onClick={() => handlePresetChange('100')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                printPreset === '100'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              100
            </button>
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                printPreset === 'all'
                  ? 'bg-[#0F6E56] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({boxes.length})
            </button>
          </div>

          {/* Main Print Trigger Button */}
          <button
            onClick={handleTriggerPrint}
            disabled={boxesToRender.length === 0}
            className="bg-[#0F6E56] hover:bg-[#0B5442] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print {boxesToRender.length} Selected Sticker{boxesToRender.length === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium">
          Loading Stock QR Data...
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
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {isAllFilteredSelected ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#0F6E56]" />
                    <span>Select All ({filteredBoxes.length})</span>
                  </>
                )}
              </button>

              <button
                onClick={() => toggleExpandAll(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={() => toggleExpandAll(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
              >
                Collapse All
              </button>

              {/* View Switcher: Invoice Grouped Accordion List (Default) vs Sticker Grid vs Flat Table */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 ml-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
                    viewMode === 'grouped'
                      ? 'bg-white text-[#0F6E56] shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                  title="Purchase Invoice Accordion List View (Default)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Invoice List View</span>
                </button>

                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
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
                  className={`p-1.5 rounded-lg transition-all ${
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
                Selected <strong className="text-slate-900 font-black">{boxesToRender.length}</strong> of{' '}
                <strong className="text-slate-700">{boxes.length}</strong> QR stickers ({invoiceGroups.length} Purchase Invoices)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Layout Format: VANIKI 2" x 1" Standard Sticker Grid
            </span>
          </div>

          {/* 1. Purchase Invoice Accordion List View (DEFAULT MODE matching Stock Page Layout) */}
          {viewMode === 'grouped' && (
            <div className="no-print space-y-3">
              {invoiceGroups.map((group) => {
                const isExpanded = expandedInvoices[group.invoiceNo] !== false;
                const groupBoxIds = group.boxes.map(b => b._id);
                const selectedInGroupCount = groupBoxIds.filter(id => selectedBoxIds.includes(id)).length;
                const isFullySelected = selectedInGroupCount === groupBoxIds.length && groupBoxIds.length > 0;
                const isPartiallySelected = selectedInGroupCount > 0 && !isFullySelected;

                return (
                  <div
                    key={group.invoiceNo}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all hover:border-slate-300"
                  >
                    {/* Main Accordion Row Header (Matching Stock Page Design) */}
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
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Product: <strong className="text-slate-800">{group.productName}</strong> | Batch: <strong className="font-mono text-slate-700">{group.batchNumber}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Middle: Selected vs Total Badge */}
                      <div className="hidden md:block text-center">
                        <span className="text-xs font-bold text-slate-600">
                          {selectedInGroupCount} of {group.boxes.length} QR Stickers Selected
                        </span>
                      </div>

                      {/* Right: Print Invoice QRs Button & Count Badges */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintInvoiceGroup(group);
                          }}
                          className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                          title="Print all QR stickers for this Purchase Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Invoice QRs ({group.boxes.length})</span>
                        </button>

                        <div className="text-right hidden sm:block">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-[#0F6E56]">
                            {group.boxes.length} Boxes Total
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Dropdown Inner Details Table */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-3">
                        <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                          <span>STOCK BOX DETAILS FOR INVOICE #{group.invoiceNo}</span>
                          <span className="text-slate-400">{selectedInGroupCount} / {group.boxes.length} Selected</span>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3 w-10">Select</th>
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
                              {group.boxes.map((box) => {
                                const isSelected = selectedBoxIds.includes(box._id);
                                return (
                                  <tr
                                    key={box._id}
                                    className={`hover:bg-emerald-50/30 transition-colors ${
                                      isSelected ? 'bg-emerald-50/20' : 'opacity-75'
                                    }`}
                                  >
                                    <td className="py-3 px-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSelectBox(box._id)}
                                        className="w-4 h-4 accent-[#0F6E56] cursor-pointer rounded"
                                      />
                                    </td>
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
                                      {box.warehouseLocation}
                                    </td>
                                    <td className="py-3 px-3">
                                      <StatusBadge status={box.status} />
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handlePrintSingle(box._id)}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] font-bold text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 inline-flex border border-emerald-200 shadow-2xs"
                                        title="Print this single QR sticker"
                                      >
                                        <Printer className="w-3.5 h-3.5 text-[#0F6E56]" />
                                        <span>Print 1</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredBoxes.map((box) => {
                  const isSelected = selectedBoxIds.includes(box._id);
                  return (
                    <div
                      key={box._id}
                      onClick={() => handleToggleSelectBox(box._id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0F6E56] bg-emerald-50/50 shadow-sm ring-1 ring-[#0F6E56]'
                          : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-black text-[#0F6E56] text-[11px]">{box.qrId}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-[#0F6E56] rounded"
                        />
                      </div>
                      <p className="font-extrabold text-[11px] text-slate-800 truncate">{box.productName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Batch: {box.batchNumber}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Flat Box Table View */}
          {viewMode === 'table' && (
            <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10">Select</th>
                    <th className="py-2.5 px-3">QR ID</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Purchase Invoice</th>
                    <th className="py-2.5 px-3">Warehouse Rack</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBoxes.map((box) => {
                    const isSelected = selectedBoxIds.includes(box._id);
                    return (
                      <tr key={box._id} className={isSelected ? 'bg-emerald-50/20' : 'opacity-70'}>
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectBox(box._id)}
                            className="w-4 h-4 accent-[#0F6E56] cursor-pointer rounded"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono font-extrabold text-[#0F6E56]">{box.qrId}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{box.productName}</td>
                        <td className="py-3 px-3 font-medium text-slate-600">{box.batchNumber}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{box.purchaseInvoice}</td>
                        <td className="py-3 px-3 text-slate-600">{box.warehouseLocation}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintSingle(box._id)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] font-bold text-xs px-2.5 py-1 rounded-lg border border-emerald-200"
                          >
                            Print 1
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Printable Sticker View Component (Targeted by @media print) */}
          <div className="mt-8">
            <StickerPrintView
              boxes={boxesToRender}
              selectedBoxIds={selectedBoxIds}
              onToggleSelect={handleToggleSelectBox}
              onPrintSingle={handlePrintSingle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
