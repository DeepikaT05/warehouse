import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Package,
  QrCode,
  FileText,
  Users,
  ChevronRight,
  Loader2,
  Box,
  MapPin,
  Building2,
  Tag
} from 'lucide-react';

export default function GlobalSearchDropdown({ placeholder, className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], boxes: [], invoices: [], dealers: [] });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search results on query change (minimum 1 character)
  useEffect(() => {
    if (!query || !query.trim()) {
      setResults({ products: [], boxes: [], invoices: [], dealers: [] });
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/search', { params: { q: query.trim() } });
        if (res.data.success) {
          setResults(res.data.results);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search dropdown error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setResults({ products: [], boxes: [], invoices: [], dealers: [] });
    setIsOpen(false);
  };

  const handleSelectProduct = (product) => {
    setIsOpen(false);
    navigate(`/products?search=${encodeURIComponent(product.productCode || product.name)}`);
  };

  const handleSelectBox = (box) => {
    setIsOpen(false);
    navigate(`/history?qr=${encodeURIComponent(box.qrId)}`);
  };

  const handleSelectInvoice = (invoice) => {
    setIsOpen(false);
    navigate(`/stock?purchaseInvoice=${encodeURIComponent(invoice.invoiceNumber)}`);
  };

  const handleSelectDealer = (dealer) => {
    setIsOpen(false);
    navigate(`/dealers`);
  };

  const hasResults =
    results.products.length > 0 ||
    results.boxes.length > 0 ||
    results.invoices.length > 0 ||
    results.dealers.length > 0;

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      {/* Input Field */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim() && hasResults) setIsOpen(true);
          }}
          placeholder={placeholder || 'Search by product, QR ID, Invoice, Dealer...'}
          className="w-full bg-slate-100 hover:bg-slate-100/80 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] transition-all shadow-xs"
        />

        {loading ? (
          <Loader2 className="w-4 h-4 text-[#0F6E56] animate-spin absolute right-3" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full absolute right-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Floating Autocomplete Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-[480px] overflow-y-auto divide-y divide-slate-100">
          {!hasResults && !loading && (
            <div className="p-6 text-center text-slate-400 text-xs font-medium">
              No matching products, QR boxes, invoices, or dealers found for "{query}".
            </div>
          )}

          {/* SECTION 1: PRODUCTS */}
          {results.products.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-[10px] font-black text-[#0F6E56] uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>Products Catalog ({results.products.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.products.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => handleSelectProduct(p)}
                    className="p-2.5 rounded-xl hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#0F6E56] flex items-center justify-center font-bold text-xs shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 group-hover:text-[#0F6E56] transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Code: <span className="font-mono font-bold text-slate-700">{p.productCode}</span> | Category: {p.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-[#0F6E56]">
                        {p.availableStock || 0} Stock
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F6E56]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: STOCK BOXES & QR CODES */}
          {results.boxes.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-[10px] font-black text-[#0F6E56] uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>Stock QR Boxes ({results.boxes.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.boxes.map((b) => (
                  <div
                    key={b._id}
                    onClick={() => handleSelectBox(b)}
                    className="p-2.5 rounded-xl hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0F6E56] border border-emerald-200 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                        QR
                      </div>
                      <div>
                        <p className="text-xs font-mono font-black text-[#0F6E56]">
                          {b.qrId}
                        </p>
                        <p className="text-[10px] text-slate-600 font-medium">
                          {b.productName} | Batch: <span className="font-mono font-bold text-slate-800">{b.batchNumber}</span> | Rack: {b.warehouseLocation}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        b.status === 'available'
                          ? 'bg-emerald-100 text-[#0F6E56]'
                          : b.status === 'dispatched'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.status}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F6E56]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: PURCHASE INVOICES */}
          {results.invoices.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-[10px] font-black text-[#0F6E56] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Purchase Invoices ({results.invoices.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.invoices.map((inv) => (
                  <div
                    key={inv._id}
                    onClick={() => handleSelectInvoice(inv)}
                    className="p-2.5 rounded-xl hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-mono font-extrabold text-slate-900 group-hover:text-[#0F6E56]">
                          Invoice: {inv.invoiceNumber}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Manufacturer: {inv.manufacturer} | Quantity: {inv.quantity} Boxes
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F6E56]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: DEALERS */}
          {results.dealers.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-[10px] font-black text-[#0F6E56] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Dealers & Distributors ({results.dealers.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.dealers.map((d) => (
                  <div
                    key={d._id}
                    onClick={() => handleSelectDealer(d)}
                    className="p-2.5 rounded-xl hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 group-hover:text-[#0F6E56]">
                          {d.dealerName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Garage: {d.garageName} | {d.city}, {d.state} | Ph: {d.phone}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F6E56]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
