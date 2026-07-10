/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Order } from '../types';

export const OrderSearch: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchResult(null);
    if (!searchId.trim()) return;

    try {
      const res = await fetch(`/api/orders/${searchId.trim()}`);
      const body = await res.json();
      if (res.ok) {
        setSearchResult(body);
      } else {
        setSearchError(body.error || "Order not found");
      }
    } catch (err) {
      setSearchError("Failed to fetch order details.");
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SHIPPED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div id="card-search-order" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
        <Info size={16} className="text-indigo-500" /> Fetch Specific Order (Requirement #2)
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Test API endpoint lookup `GET /api/orders/:id` directly.
      </p>
      <form onSubmit={handleSearchOrder} className="flex gap-2">
        <input 
          id="input-search-id"
          type="text" 
          placeholder="e.g. ORD-5101"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button 
          id="btn-search-submit"
          type="submit"
          className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Lookup
        </button>
      </form>

      {searchError && (
        <div className="mt-2.5 p-2 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-100">
          {searchError}
        </div>
      )}

      {searchResult && (
        <div className="mt-3 p-3 bg-slate-50 text-xs rounded-lg border border-slate-200 space-y-1.5">
          <div className="flex justify-between font-semibold">
            <span className="text-indigo-600 font-mono">{searchResult.id}</span>
            <span className={`px-1.5 py-0.2 rounded border text-[10px] ${getStatusStyle(searchResult.status)}`}>
              {searchResult.status}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Customer: <strong className="text-slate-800">{searchResult.customerName}</strong>
          </div>
          <div className="text-[11px] text-slate-500">
            Total: <strong className="text-slate-800">${searchResult.totalAmount.toFixed(2)}</strong>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1">
            <div className="font-semibold text-slate-700 text-[10px] uppercase mb-1">Items Included:</div>
            {searchResult.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-[11px] text-slate-600 font-mono">
                <span>{it.quantity}x {it.name}</span>
                <span>${(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
