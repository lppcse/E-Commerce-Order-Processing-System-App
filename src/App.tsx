/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Terminal, FileCode, FileText } from 'lucide-react';
import { Order, OrderStatus, SystemLog, SystemConfig } from './types';

// Micro-level architecture components
import { OrderForm } from './components/OrderForm';
import { BackgroundWorkerConfig } from './components/BackgroundWorkerConfig';
import { OrderSearch } from './components/OrderSearch';
import { OrderList } from './components/OrderList';
import { SystemConsoleLogs } from './components/SystemConsoleLogs';
import { PythonReferenceCode } from './components/PythonReferenceCode';
import { AssignmentReportView } from './components/AssignmentReportView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'python' | 'report'>('dashboard');

  // Dashboard state polled from full-stack backend APIs
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [config, setConfig] = useState<SystemConfig>({ workerIntervalMs: 10000, workerEnabled: true });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
    const interval = setInterval(fetchData, 1500); // Snappy real-time simulation polling
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Cancel Order handler
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

  // Move Status manually for demo simulation
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

  // Reset/Re-Seed Data
  const handleResetDatabase = async () => {
    if (confirm("Are you sure you want to reset the system database and seed sample data? This will revert all modified states.")) {
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
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Terminal size={15} /> System Monitor
            </button>
            <button 
              id="tab-btn-python"
              onClick={() => setActiveTab('python')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'python' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <FileCode size={15} /> Python Code
            </button>
            <button 
              id="tab-btn-report"
              onClick={() => setActiveTab('report')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <FileText size={15} /> Assignment Report
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN (Form, Config, and ID Search) */}
            <div className="lg:col-span-5 space-y-6">
              <OrderForm onOrderCreated={fetchData} />
              
              <BackgroundWorkerConfig 
                config={config} 
                onUpdateConfig={handleUpdateConfig} 
                onResetDatabase={handleResetDatabase}
              />
              
              <OrderSearch />
            </div>

            {/* RIGHT COLUMN (Records Record List & Logs Console) */}
            <div className="lg:col-span-7 space-y-6">
              <OrderList 
                orders={orders}
                statusFilter={statusFilter}
                onFilterChange={setStatusFilter}
                onCancelOrder={handleCancelOrder}
                onManualStatusMove={handleManualStatusMove}
              />

              <SystemConsoleLogs 
                logs={logs}
                onClearLogs={handleClearLogs}
              />
            </div>

          </div>
        )}

        {activeTab === 'python' && <PythonReferenceCode />}

        {activeTab === 'report' && <AssignmentReportView />}
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
