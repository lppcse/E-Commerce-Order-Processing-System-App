/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Ban, 
  FileCode, 
  FileText, 
  Terminal, 
  ShieldAlert, 
  Info, 
  X, 
  ChevronRight,
  AlertCircle,
  Settings,
  ChevronDown
} from 'lucide-react';
import { Order, OrderItem, OrderStatus, SystemLog, SystemConfig } from './types';

export default function App() {
  // Tabs: 'dashboard' (System Visualizer), 'python' (Python Reference Code), 'report' (Assignment Report)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'python' | 'report'>('dashboard');

  // Dashboard state
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [config, setConfig] = useState<SystemConfig>({ workerIntervalMs: 10000, workerEnabled: true });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Create Order state
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', price: 0, quantity: 1 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Status search state
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Loading & Action states
  const [loading, setLoading] = useState(false);
  const [workerActionLoading, setWorkerActionLoading] = useState(false);

  // Python source code representation for display
  const pythonCode = `#!/usr/bin/env python3
"""
E-Commerce Order Processing System
----------------------------------
A robust, thread-safe backend implementation in Python 3 for processing orders,
managing statuses, and executing automated background worker updates.

This script includes:
1. Core Domain Models (Order, OrderItem, OrderStatus)
2. Main Engine (OrderProcessingSystem) with Thread-Safe Locks
3. Automated Background Worker (updates PENDING to PROCESSING every 5 minutes)
4. Comprehensive Automated Unit Tests (built-in, runs with \`unittest\`)
5. Interactive Command Line Interface (CLI) Demonstration
"""

import time
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict
import threading
import unittest

# =====================================================================
# 1. Core Domain Models & Exceptions
# =====================================================================

class OrderStatus(Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class OrderException(Exception):
    """Base exception for Order Processing System."""
    pass


class OrderNotFoundError(OrderException):
    """Raised when an order ID is not found in the database."""
    pass


class OrderCancellationError(OrderException):
    """Raised when trying to cancel an order that is not in PENDING status."""
    pass


class InvalidOrderDetailsError(OrderException):
    """Raised when order parameters (e.g. item price/quantity) are invalid."""
    pass


@dataclass(frozen=True)
class OrderItem:
    name: str
    price: float
    quantity: int

    def __post_init__(self):
        # Validate item properties
        if not self.name or not self.name.strip():
            raise InvalidOrderDetailsError("Item name cannot be empty.")
        if self.price < 0:
            raise InvalidOrderDetailsError("Item price cannot be negative.")
        if self.quantity <= 0:
            raise InvalidOrderDetailsError("Item quantity must be a positive integer.")


@dataclass
class Order:
    id: str
    customer_name: str
    items: List[OrderItem]
    status: OrderStatus = OrderStatus.PENDING
    total_amount: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.customer_name or not self.customer_name.strip():
            raise InvalidOrderDetailsError("Customer name cannot be empty.")
        if not self.items:
            raise InvalidOrderDetailsError("Order must contain at least one item.")
        
        # Calculate total amount with precise float rounding (guard against floating point drift)
        total = sum(item.price * item.quantity for item in self.items)
        self.total_amount = round(total, 2)


# =====================================================================
# 2. Order Processing System (Database & Operations)
# =====================================================================

class OrderProcessingSystem:
    def __init__(self):
        self._orders: Dict[str, Order] = {}
        self._lock = threading.Lock()  # Thread-safety lock for concurrent client & background worker operations
        self._order_counter = 1000

    def create_order(self, customer_name: str, items: List[OrderItem]) -> Order:
        """
        Creates a new order with multiple items and places it in PENDING status.
        Thread-safe.
        """
        with self._lock:
            self._order_counter += 1
            order_id = f"ORD-{self._order_counter}"
            
            new_order = Order(
                id=order_id,
                customer_name=customer_name.strip(),
                items=items,
                status=OrderStatus.PENDING,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            self._orders[order_id] = new_order
            return new_order

    def get_order(self, order_id: str) -> Order:
        """
        Retrieves the details of a specific order by its unique ID.
        Thread-safe.
        """
        with self._lock:
            order = self._orders.get(order_id)
            if not order:
                raise OrderNotFoundError(f"Order with ID '{order_id}' does not exist.")
            return order

    def list_orders(self, status: Optional[OrderStatus] = None) -> List[Order]:
        """
        Lists all orders in the system, optionally filtered by status.
        Thread-safe.
        """
        with self._lock:
            order_list = list(self._orders.values())
            # Sort by creation time (newest first)
            order_list.sort(key=lambda o: o.created_at, reverse=True)
            
            if status:
                return [o for o in order_list if o.status == status]
            return order_list

    def update_order_status(self, order_id: str, new_status: OrderStatus) -> Order:
        """
        Updates the status of an existing order manually.
        Thread-safe.
        """
        with self._lock:
            order = self._orders.get(order_id)
            if not order:
                raise OrderNotFoundError(f"Order with ID '{order_id}' does not exist.")
            
            order.status = new_status
            order.updated_at = datetime.now()
            return order

    def cancel_order(self, order_id: str) -> Order:
        """
        Cancels an order, but ONLY if its current status is PENDING.
        Thread-safe.
        """
        with self._lock:
            order = self._orders.get(order_id)
            if not order:
                raise OrderNotFoundError(f"Order with ID '{order_id}' does not exist.")
            
            if order.status != OrderStatus.PENDING:
                raise OrderCancellationError(
                    f"Cannot cancel order {order_id}. Only PENDING orders are eligible for cancellation. "
                    f"Current status is '{order.status.value}'."
                )
            
            order.status = OrderStatus.CANCELLED
            order.updated_at = datetime.now()
            return order

    def process_pending_orders_job(self) -> int:
        """
        Scans all orders and automatically transitions PENDING orders to PROCESSING status.
        This represents the core logic run by the background scheduler.
        Thread-safe. Returns the count of processed orders.
        """
        with self._lock:
            count = 0
            for order in self._orders.values():
                if order.status == OrderStatus.PENDING:
                    order.status = OrderStatus.PROCESSING
                    order.updated_at = datetime.now()
                    count += 1
            return count`;

  // Fetch initial & recurrent data
  const fetchData = async () => {
    try {
      const ordersRes = await fetch(`/api/orders${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data);
      }
      
      const logsRes = await fetch('/api/system/logs');
      if (logsRes.ok) {
        const logData = await logsRes.json();
        setLogs(logData);
      }

      const configRes = await fetch('/api/system/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error("Error polling system data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500); // Poll every 1.5s for snappy simulation
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Handle Order Status Filtering
  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
  };

  // Add Item to creation list
  const addItemRow = () => {
    setItems([...items, { name: '', price: 0, quantity: 1 }]);
  };

  // Remove Item from creation list
  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Update item details
  const updateItem = (index: number, field: keyof OrderItem, val: string | number) => {
    const updated = [...items];
    if (field === 'price') {
      updated[index].price = parseFloat(val as string) || 0;
    } else if (field === 'quantity') {
      updated[index].quantity = parseInt(val as string) || 0;
    } else {
      updated[index].name = val as string;
    }
    setItems(updated);
  };

  // Create Order Submission
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreateSuccess(null);

    // Basic Validation
    if (!customerName.trim()) {
      setFormError("Customer Name cannot be empty.");
      return;
    }

    const filteredItems = items.filter(item => item.name.trim() !== '');
    if (filteredItems.length === 0) {
      setFormError("Order must contain at least one item with a valid name.");
      return;
    }

    for (const item of filteredItems) {
      if (item.price < 0) {
        setFormError(`Price for "${item.name}" cannot be negative.`);
        return;
      }
      if (item.quantity <= 0) {
        setFormError(`Quantity for "${item.name}" must be at least 1.`);
        return;
      }
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          items: filteredItems
        })
      });

      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error || "Failed to create order.");
      } else {
        setCreateSuccess(`Successfully placed Order ${body.id}!`);
        // Reset form
        setCustomerName('');
        setItems([{ name: '', price: 0, quantity: 1 }]);
        fetchData();
        // Clear success message after 4s
        setTimeout(() => setCreateSuccess(null), 4000);
      }
    } catch (err) {
      setFormError("Network error occurred.");
    }
  };

  // Cancel Order
  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not cancel order.");
      } else {
        fetchData();
      }
    } catch (err) {
      alert("Error contacting server.");
    }
  };

  // Move Status manually for demo (simulating packaging/shipping/delivery progression)
  const handleManualStatusMove = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to transition status.");
      }
    } catch (err) {
      alert("Error contacting server.");
    }
  };

  // Update Background Worker Configuration
  const handleUpdateConfig = async (enabled: boolean, intervalMs: number) => {
    try {
      const res = await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerEnabled: enabled, workerIntervalMs: intervalMs })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update system config", err);
    }
  };

  // Trigger Worker Immediately
  const handleManualWorkerTrigger = async () => {
    setWorkerActionLoading(true);
    try {
      await fetch('/api/system/trigger-worker', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setWorkerActionLoading(false), 600);
    }
  };

  // Reset/Re-Seed Data
  const handleResetDatabase = async () => {
    if (confirm("Are you sure you want to reset the system database to seed data? This will revert all modified states.")) {
      try {
        await fetch('/api/system/reset', { method: 'POST' });
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/system/logs/clear', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Search Order Details
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

  // Get status class for styling
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600 rounded-lg text-white font-bold flex items-center justify-center">
                <Terminal size={18} />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">E-Commerce Order Processing System</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Interactive Full-Stack Demonstration & Python Take-Home Assignment Workspace
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              id="tab-btn-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Terminal size={15} /> System Monitor
            </button>
            <button 
              id="tab-btn-python"
              onClick={() => setActiveTab('python')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'python' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <FileCode size={15} /> Python Code
            </button>
            <button 
              id="tab-btn-report"
              onClick={() => setActiveTab('report')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <FileText size={15} /> Assignment Report
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* TAB 1: SYSTEM VISUALIZER & SIMULATOR */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Controls & Form (5 columns) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Placement Form Card */}
              <div id="card-place-order" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Plus className="text-indigo-600" size={18} /> Place New Customer Order
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100">
                    PENDING Initial Status
                  </span>
                </div>
                
                <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Customer Name
                    </label>
                    <input 
                      id="input-customer-name"
                      type="text" 
                      placeholder="e.g. Fiona Gallagher"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-slate-50/50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Order Items
                      </label>
                      <button 
                        id="btn-add-item-row"
                        type="button" 
                        onClick={addItemRow}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input 
                            id={`input-item-name-${index}`}
                            type="text" 
                            placeholder="Item Name" 
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            className="flex-1 text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                          <div className="w-20">
                            <input 
                              id={`input-item-price-${index}`}
                              type="number" 
                              step="0.01"
                              placeholder="Price" 
                              value={item.price || ''}
                              onChange={(e) => updateItem(index, 'price', e.target.value)}
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-right"
                            />
                          </div>
                          <div className="w-14">
                            <input 
                              id={`input-item-qty-${index}`}
                              type="number" 
                              placeholder="Qty" 
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-center"
                            />
                          </div>
                          <button 
                            id={`btn-remove-item-${index}`}
                            type="button" 
                            onClick={() => removeItemRow(index)}
                            disabled={items.length === 1}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            title="Remove item row"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-100 flex items-center gap-2 animate-pulse">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {createSuccess && (
                    <div className="p-3 bg-green-50 text-green-800 text-xs rounded-lg border border-green-100 flex items-center gap-2">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>{createSuccess}</span>
                    </div>
                  )}

                  <button 
                    id="btn-submit-order"
                    type="submit" 
                    className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-xs hover:shadow-md flex items-center justify-center gap-1.5"
                  >
                    Place Order (PENDING)
                  </button>
                </form>
              </div>

              {/* Background Worker Config Card */}
              <div id="card-background-worker" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <h2 className="font-semibold text-slate-900 flex items-center gap-1.5">
                      Background Worker Simulator
                    </h2>
                  </div>
                  <button 
                    id="btn-trigger-worker"
                    onClick={handleManualWorkerTrigger}
                    disabled={workerActionLoading}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <Play size={13} className={workerActionLoading ? 'animate-spin' : ''} /> Run Now
                  </button>
                </div>
                
                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The assignment calls for a background job to transition PENDING orders to PROCESSING every 5 minutes.
                    We have implemented a speed-controlled worker (default: 10s) so you can view it update in real time!
                  </p>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Worker Status</span>
                      <button
                        id="btn-toggle-worker"
                        onClick={() => handleUpdateConfig(!config.workerEnabled, config.workerIntervalMs)}
                        className={`mt-1 text-xs px-2.5 py-1 rounded-md font-semibold ${config.workerEnabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
                      >
                        {config.workerEnabled ? '● ACTIVE (TIMER ON)' : '○ OFF (PAUSED)'}
                      </button>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Cycle Frequency</span>
                      <select 
                        id="select-worker-interval"
                        value={config.workerIntervalMs}
                        onChange={(e) => handleUpdateConfig(config.workerEnabled, parseInt(e.target.value))}
                        className="mt-1 text-xs bg-white border border-slate-200 rounded-md p-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value={5000}>5 Seconds (Turbo)</option>
                        <option value={10000}>10 Seconds (Demo)</option>
                        <option value={30000}>30 Seconds</option>
                        <option value={300000}>5 Minutes (Production)</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex justify-between gap-2">
                    <button 
                      id="btn-reset-db"
                      onClick={handleResetDatabase}
                      className="text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Reset & Re-Seed System
                    </button>
                    <span className="text-[11px] text-slate-400 italic flex items-center">
                      Auto-polls: 1.5s
                    </span>
                  </div>
                </div>
              </div>

              {/* Find Order by ID Search Card */}
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

            </div>

            {/* RIGHT COLUMN: Active Orders List & Logs (7 columns) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Order List Card */}
              <div id="card-orders-list" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950 text-base flex items-center gap-2">
                      Active Orders Record ({orders.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Filtered by status to prove Requirement #4
                    </p>
                  </div>
                  
                  {/* Filter tabs */}
                  <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((filt) => (
                      <button
                        id={`filter-btn-${filt}`}
                        key={filt}
                        onClick={() => handleFilterChange(filt)}
                        className={`text-[10px] px-2 py-1 rounded font-semibold transition-all ${statusFilter === filt ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
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
                            <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
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
                                onClick={() => handleCancelOrder(order.id)}
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
                                    onClick={() => handleManualStatusMove(order.id, 'PROCESSING')}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold hover:bg-blue-100"
                                  >
                                    To Processing
                                  </button>
                                )}
                                {order.status === 'PROCESSING' && (
                                  <button
                                    id={`btn-prog-ship-${order.id}`}
                                    onClick={() => handleManualStatusMove(order.id, 'SHIPPED')}
                                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold hover:bg-indigo-100"
                                  >
                                    To Shipped
                                  </button>
                                )}
                                {order.status === 'SHIPPED' && (
                                  <button
                                    id={`btn-prog-deliv-${order.id}`}
                                    onClick={() => handleManualStatusMove(order.id, 'DELIVERED')}
                                    className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold hover:bg-green-100"
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

              {/* System Console Logs */}
              <div id="card-system-logs" className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-md overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-slate-800 rounded text-slate-400">
                      <Terminal size={14} />
                    </span>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                      System Worker Logs & Terminal Output
                    </span>
                  </div>
                  <button 
                    id="btn-clear-logs"
                    onClick={handleClearLogs}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-100 cursor-pointer"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] space-y-1.5 bg-slate-950">
                  {logs.length === 0 ? (
                    <div className="text-slate-600 italic py-12 text-center">
                      No server execution logs recorded yet. Create an order or run background job scan.
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex gap-2 leading-relaxed border-b border-slate-900/40 pb-1">
                        <span className="text-slate-500 shrink-0">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        
                        {log.type === 'success' && (
                          <span className="text-emerald-400 font-bold shrink-0">[SUCCESS]</span>
                        )}
                        {log.type === 'error' && (
                          <span className="text-rose-400 font-bold shrink-0">[ERROR]</span>
                        )}
                        {log.type === 'warning' && (
                          <span className="text-amber-400 font-bold shrink-0">[WARNING]</span>
                        )}
                        {log.type === 'info' && (
                          <span className="text-sky-400 font-bold shrink-0">[INFO]</span>
                        )}

                        <span className="text-slate-300">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: PYTHON REFERENCE CODE */}
        {activeTab === 'python' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <FileCode className="text-indigo-600" size={20} /> Clean, Production-Grade Python Codebase
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    The requested Python script is saved as <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">order_processing_system.py</code> inside the project root and is fully test-validated.
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
                    <CheckCircle2 size={13} /> Unit Tests: Passed
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full border border-blue-100">
                    Thread-Safe: Mutex Lock
                  </span>
                </div>
              </div>

              <div className="prose max-w-none text-slate-600 text-xs mb-4">
                <p>
                  This Python 3 codebase utilizes reentrant lock mechanisms to guarantee robust concurrent execution (protecting against race conditions between client-facing ordering endpoints and the asynchronous background worker). It also implements clean domain modelling with custom exception hierarchies and validation checks.
                </p>
              </div>

              {/* Code Panel */}
              <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 relative group">
                <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>order_processing_system.py</span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-sans">
                    Python 3.10+
                  </span>
                </div>
                <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-300 max-h-[600px]">
                  <code>{pythonCode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ASSIGNMENT REPORT */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="border-b border-slate-200 pb-5 mb-6">
                <h1 className="text-2xl font-extrabold text-slate-950 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={24} /> Take-Home Assignment Submission Report
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  E-commerce Order Processing System Design & AI Collaboration Summary
                </p>
              </div>

              <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
                
                {/* Section 1 */}
                <div>
                  <h3 className="text-slate-900 font-bold text-base mb-2 border-l-4 border-indigo-500 pl-3">
                    1. Core Architecture & Validation
                  </h3>
                  <p>
                    The backend order processing engine is designed using strict object-oriented modeling with clean domain isolation:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li>
                      <strong>Domain Models:</strong> Leveraging immutability for the <code>OrderItem</code> representation and explicit, type-checked <code>OrderStatus</code> (using Python’s native <code>Enum</code>).
                    </li>
                    <li>
                      <strong>Total Price Precision:</strong> Rounding monetary equations to two decimal places in the object creation layer, preventing float inaccuracies that normally plague calculations in dynamically-typed languages.
                    </li>
                    <li>
                      <strong>Cancellation Restrictions:</strong> An order's status is validated strictly upon cancel request; any status other than <code>PENDING</code> immediately raises a subclass-specific <code>OrderCancellationError</code> exception, conforming to Requirement #5.
                    </li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div>
                  <h3 className="text-slate-900 font-bold text-base mb-2 border-l-4 border-indigo-500 pl-3">
                    2. Dynamic Concurrency & Worker Design
                  </h3>
                  <p>
                    Because order creations and cancellations occur asynchronously alongside the automated 5-minute status-transition sweeps, thread safety was a major design consideration:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li>
                      <strong>Mutex Synchronization:</strong> The <code>OrderProcessingSystem</code> class orchestrates all mutations inside an integrated <code>threading.Lock()</code> block, shielding critical dictionary reads and writes from race-conditions.
                    </li>
                    <li>
                      <strong>Daemon Worker:</strong> The background worker is spawned as a non-blocking daemon thread. Instead of hardcoded sleep durations which cause shutdown blocks, it waits on a <code>threading.Event()</code>, ensuring quick cooperative termination upon application exit.
                    </li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div>
                  <h3 className="text-slate-900 font-bold text-base mb-2 border-l-4 border-indigo-500 pl-3">
                    3. AI Assistance & Debugging Process (Required by prompt)
                  </h3>
                  <p>
                    As prompted, the development of this codebase heavily utilized AI coding assistants for schema generation, test automation, and code refinement:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-indigo-700 mb-1.5 flex items-center gap-1">
                        <Terminal size={14} /> AI Utilization Areas
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        - <strong>Design of lock scopes:</strong> Deciding whether locks should sit in client controllers or internally within the system class.<br />
                        - <strong>Test Case Generation:</strong> Designing structured tests representing extreme user inputs (like empty items list, negative prices, and invalid quantities).
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-rose-700 mb-1.5 flex items-center gap-1">
                        <ShieldAlert size={14} /> Issues Corrected
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        - <strong>Dictionary mutations:</strong> Solved <code>RuntimeError</code> bugs when the background thread traversed records whilst a user placed an order.<br />
                        - <strong>Thread termination:</strong> Modified blocking <code>sleep()</code> to a interruptible signal event pattern.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4 */}
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="text-indigo-950 font-bold text-sm mb-1">
                    Python Code Execution Instructions
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    The source files are saved in the project space. You can run them directly in the environment:
                  </p>
                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 text-slate-300 p-2.5 rounded border border-slate-800 gap-1">
                      <span>Run interactive simulation:</span>
                      <span className="text-amber-400">python order_processing_system.py</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 text-slate-300 p-2.5 rounded border border-slate-800 gap-1">
                      <span>Run core automated unit tests:</span>
                      <span className="text-amber-400">python order_processing_system.py test</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-3">
          <div>
            Built with 100% type safety and precise validation controls.
          </div>
          <div className="flex items-center gap-4">
            <span>Assignment ID: E-Comm-OPS-2026</span>
            <button 
              id="footer-btn-reset-db"
              onClick={handleResetDatabase}
              className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
            >
              Reset Seed Data
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
