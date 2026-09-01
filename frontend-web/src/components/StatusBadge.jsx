import React from 'react';

export default function StatusBadge({ status }) {
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = status ? status.toUpperCase() : 'UNKNOWN';

  switch (status?.toLowerCase()) {
    case 'available':
      badgeStyle = 'bg-emerald-50 text-[#1D9E75] border-emerald-200 font-bold';
      label = 'AVAILABLE';
      break;
    case 'reserved':
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      label = 'RESERVED';
      break;
    case 'dispatched':
      badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
      label = 'DISPATCHED';
      break;
    case 'returned':
      badgeStyle = 'bg-red-50 text-red-700 border-red-200 font-bold';
      label = 'RETURNED';
      break;
    case 'verified':
      badgeStyle = 'bg-emerald-100 text-[#0F6E56] border-emerald-300 font-bold';
      label = 'VERIFIED';
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse"></span>
      {label}
    </span>
  );
}
