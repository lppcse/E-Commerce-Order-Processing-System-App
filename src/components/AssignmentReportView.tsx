/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Terminal, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const AssignmentReportView: React.FC = () => {
  return (
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
                  - <strong>Thread termination:</strong> Modified blocking <code>sleep()</code> to an interruptible signal event pattern.
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
                <span className="text-amber-400 font-bold">python order_processing_system.py</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 text-slate-300 p-2.5 rounded border border-slate-800 gap-1">
                <span>Run core automated unit tests:</span>
                <span className="text-amber-400 font-bold">python order_processing_system.py test</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
