/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Info, Ban } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderListProps {
  orders: Order[];
  statusFilter: string;
  onFilterChange: (filter: string) => void;
  onCancelOrder: (id: string) => void;
  onManualStatusMove: (id: string, status: OrderStatus) => void;
}

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  statusFilter,
  onFilterChange,
  onCancelOrder,
  onManualStatusMove,
}) => {
  const getStatusStyle = (status: OrderStatus) => {
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
    <div id="card-orders-list" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950 text-base flex items-center gap-2">
            Active Orders Record ({orders.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Filtered by status to prove Requirement #4
          </p>
        </div>
        
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((filt) => (
            <button
              id={`filter-btn-${filt}`}
              key={filt}
              onClick={() => onFilterChange(filt)}
              className={`text-[10px] px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${statusFilter === filt ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {filt}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Info className="mx-auto text-slate-300 mb-2" size={32} />
          <p className="text-sm font-medium">No orders found matching status filter.</p>
          <p className="text-xs mt-1">Place an order or reset the database to begin simulation.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.map((order) => (
            <div key={order.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 select-all">
                    {order.id}
                  </span>
                  <span className="font-medium text-slate-800 text-sm">
                    {order.customerName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                  <span className="text-sm font-bold text-slate-900 bg-indigo-50/50 px-2.5 py-0.5 rounded border border-indigo-100">
                    ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items Sub-Row */}
              <div className="pl-1 text-xs text-slate-500 space-y-1 my-3 bg-slate-50 p-2.5 rounded border border-slate-100">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Items included:</div>
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center font-mono text-[11px] text-slate-600">
                    <span>{it.quantity}x {it.name} <span className="text-slate-400">@ ${it.price.toFixed(2)} each</span></span>
                    <span>${(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Timestamps & Control Action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 gap-3">
                <div>
                  Created: {new Date(order.createdAt).toLocaleTimeString()} | Updated: {new Date(order.updatedAt).toLocaleTimeString()}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {/* Cancellation Rule Guard: Only enable cancellation if PENDING (Requirement #5) */}
                  {order.status === 'PENDING' ? (
                    <button
                      id={`btn-cancel-order-${order.id}`}
                      onClick={() => onCancelOrder(order.id)}
                      className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded font-medium transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Ban size={12} /> Cancel Order
                    </button>
                  ) : (
                    <span className="text-slate-400 italic text-[10px] mr-1 select-none">
                      Cancel locked (not PENDING)
                    </span>
                  )}

                  {/* Demo Status progression helper */}
                  {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Advance:</span>
                      {order.status === 'PENDING' && (
                        <button
                          id={`btn-prog-proc-${order.id}`}
                          onClick={() => onManualStatusMove(order.id, 'PROCESSING')}
                          className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold hover:bg-blue-100 cursor-pointer"
                        >
                          To Processing
                        </button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <button
                          id={`btn-prog-ship-${order.id}`}
                          onClick={() => onManualStatusMove(order.id, 'SHIPPED')}
                          className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold hover:bg-indigo-100 cursor-pointer"
                        >
                          To Shipped
                        </button>
                      )}
                      {order.status === 'SHIPPED' && (
                        <button
                          id={`btn-prog-deliv-${order.id}`}
                          onClick={() => onManualStatusMove(order.id, 'DELIVERED')}
                          className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold hover:bg-green-100 cursor-pointer"
                        >
                          To Delivered
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
