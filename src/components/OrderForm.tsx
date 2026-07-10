/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { OrderItem } from '../types';

interface OrderFormProps {
  onOrderCreated: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ onOrderCreated }) => {
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', price: 0, quantity: 1 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const addItemRow = () => {
    setItems([...items, { name: '', price: 0, quantity: 1 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

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

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreateSuccess(null);

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
        setCustomerName('');
        setItems([{ name: '', price: 0, quantity: 1 }]);
        onOrderCreated();
        setTimeout(() => setCreateSuccess(null), 4000);
      }
    } catch (err) {
      setFormError("Network error occurred.");
    }
  };

  return (
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
  );
};
