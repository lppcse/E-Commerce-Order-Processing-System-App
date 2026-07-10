/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Terminal } from 'lucide-react';
import { SystemLog } from '../types';

interface SystemConsoleLogsProps {
  logs: SystemLog[];
  onClearLogs: () => void;
}

export const SystemConsoleLogs: React.FC<SystemConsoleLogsProps> = ({ logs, onClearLogs }) => {
  return (
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
          onClick={onClearLogs}
          className="text-[11px] font-medium text-slate-400 hover:text-slate-100 cursor-pointer"
        >
          Clear Logs
        </button>
      </div>

      <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] space-y-1.5 bg-slate-950">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-12 text-center select-none">
            No server execution logs recorded yet. Create an order or run background job scan.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 leading-relaxed border-b border-slate-900/40 pb-1 select-all">
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
  );
};
