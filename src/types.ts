/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface SystemConfig {
  workerIntervalMs: number; // Interval in milliseconds for the background worker
  workerEnabled: boolean;
}
