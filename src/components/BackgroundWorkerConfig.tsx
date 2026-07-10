/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { SystemConfig } from '../types';

interface BackgroundWorkerConfigProps {
  config: SystemConfig;
  onUpdateConfig: (enabled: boolean, intervalMs: number) => void;
  onResetDatabase: () => void;
}

export const BackgroundWorkerConfig: React.FC<BackgroundWorkerConfigProps> = ({
  config,
  onUpdateConfig,
  onResetDatabase,
}) => {
  const [workerActionLoading, setWorkerActionLoading] = useState(false);

  const handleManualWorkerTrigger = async () => {
    setWorkerActionLoading(true);
    try {
      await fetch('/api/system/trigger-worker', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setWorkerActionLoading(false), 600);
    }
  };

  return (
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
          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
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
              onClick={() => onUpdateConfig(!config.workerEnabled, config.workerIntervalMs)}
              className={`mt-1 text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${config.workerEnabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
            >
              {config.workerEnabled ? '● ACTIVE (TIMER ON)' : '○ OFF (PAUSED)'}
            </button>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Cycle Frequency</span>
            <select 
              id="select-worker-interval"
              value={config.workerIntervalMs}
              onChange={(e) => onUpdateConfig(config.workerEnabled, parseInt(e.target.value))}
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
            onClick={onResetDatabase}
            className="text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            Reset & Re-Seed System
          </button>
          <span className="text-[11px] text-slate-400 italic flex items-center select-none">
            Auto-polls: 1.5s
          </span>
        </div>
      </div>
    </div>
  );
};
