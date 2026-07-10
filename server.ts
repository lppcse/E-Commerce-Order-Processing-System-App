/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Order, OrderStatus, SystemLog, SystemConfig } from "./src/types";

// Setup unique log IDs and order IDs
let logCounter = 1;
const generateLogId = () => `LOG-${Date.now()}-${logCounter++}`;

const generateOrderId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${num}`;
};

// In-Memory Database
let orders: Order[] = [];
let systemLogs: SystemLog[] = [];

// System Config (Default to 10 seconds for demo convenience, but we explain it's 5 minutes officially)
let systemConfig: SystemConfig = {
  workerIntervalMs: 10000, // 10 seconds for interactive demo, can be adjusted in UI
  workerEnabled: true,
};

let workerInterval: NodeJS.Timeout | null = null;

// Helper to add system logs
const addLog = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
  const log: SystemLog = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    type,
    message,
  };
  systemLogs.unshift(log); // New logs at the top
  // Keep logs to a reasonable limit
  if (systemLogs.length > 200) {
    systemLogs = systemLogs.slice(0, 200);
  }
  console.log(`[${log.timestamp}] [${type.toUpperCase()}] ${message}`);
};

// Seed initial database
const seedDatabase = () => {
  const now = new Date();
  
  orders = [
    {
      id: "ORD-5101",
      customerName: "Alice Vance",
      items: [
        { name: "Wireless Ergonomic Mouse", price: 45.00, quantity: 1 },
        { name: "Mechanical Keyboard (Cherry MX Red)", price: 89.99, quantity: 1 }
      ],
      status: "PENDING",
      totalAmount: 134.99,
      createdAt: new Date(now.getTime() - 2 * 60000).toISOString(), // 2 mins ago
      updatedAt: new Date(now.getTime() - 2 * 60000).toISOString(),
    },
    {
      id: "ORD-3042",
      customerName: "Bob Smith",
      items: [
        { name: "Leatherbound Notebook", price: 18.50, quantity: 2 },
        { name: "Sleek Fountain Pen", price: 24.00, quantity: 1 }
      ],
      status: "PROCESSING",
      totalAmount: 61.00,
      createdAt: new Date(now.getTime() - 15 * 60000).toISOString(), // 15 mins ago
      updatedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
    },
    {
      id: "ORD-9823",
      customerName: "Charlie Brown",
      items: [
        { name: "Organic Espresso Roast (12oz)", price: 15.99, quantity: 2 },
        { name: "Double-Walled Glass Coffee Mug", price: 14.50, quantity: 1 }
      ],
      status: "SHIPPED",
      totalAmount: 46.48,
      createdAt: new Date(now.getTime() - 120 * 60000).toISOString(), // 2 hours ago
      updatedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: "ORD-4112",
      customerName: "Diana Prince",
      items: [
        { name: "Noise-Cancelling Over-Ear Headphones", price: 199.99, quantity: 1 }
      ],
      status: "DELIVERED",
      totalAmount: 199.99,
      createdAt: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(now.getTime() - 18 * 3600 * 1000).toISOString(),
    },
    {
      id: "ORD-8711",
      customerName: "Ethan Hunt",
      items: [
        { name: "Outdoor Sport GPS Smartwatch", price: 149.00, quantity: 1 }
      ],
      status: "CANCELLED",
      totalAmount: 149.00,
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(), // 4 hours ago
      updatedAt: new Date(now.getTime() - 3.5 * 3600 * 1000).toISOString(),
    }
  ];

  systemLogs = [];
  addLog("info", "Database initialized with seed data.");
  addLog("info", "Order Processing Background Worker stands ready.");
};

// Core background worker logic
const processPendingOrders = () => {
  addLog("info", "Background job execution started: scanning for PENDING orders...");
  
  const pendingOrders = orders.filter(o => o.status === "PENDING");
  
  if (pendingOrders.length === 0) {
    addLog("info", "Background job finished: No PENDING orders found to process.");
    return;
  }
  
  let count = 0;
  orders = orders.map(order => {
    if (order.status === "PENDING") {
      count++;
      addLog("success", `Background job: Auto-transitional status update for Order ${order.id} from PENDING to PROCESSING.`);
      return {
        ...order,
        status: "PROCESSING" as OrderStatus,
        updatedAt: new Date().toISOString()
      };
    }
    return order;
  });
  
  addLog("success", `Background job execution complete: successfully transitioned ${count} PENDING order(s) to PROCESSING.`);
};

// Manage Background Worker Timer Lifecycle
const startBackgroundWorker = (intervalMs: number) => {
  if (workerInterval) {
    clearInterval(workerInterval);
  }
  
  if (systemConfig.workerEnabled) {
    addLog("info", `Background worker timer started/updated. Running scans every ${(intervalMs / 1000).toFixed(1)} seconds.`);
    workerInterval = setInterval(() => {
      processPendingOrders();
    }, intervalMs);
  } else {
    addLog("warning", "Background worker timer is currently disabled.");
  }
};

// Seed immediately on startup
seedDatabase();
startBackgroundWorker(systemConfig.workerIntervalMs);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());

  // API Routes
  
  // 1. Create an Order
  app.post("/api/orders", (req, res) => {
    try {
      const { customerName, items } = req.body;
      
      if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
        return res.status(400).json({ error: "Customer name is required" });
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Order must contain at least one item" });
      }
      
      // Validate items
      for (const item of items) {
        if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
          return res.status(400).json({ error: "Each item must have a valid name" });
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          return res.status(400).json({ error: "Each item must have a valid, non-negative price" });
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          return res.status(400).json({ error: "Each item must have a positive integer quantity" });
        }
      }
      
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const roundedTotal = Math.round((totalAmount + Number.EPSILON) * 100) / 100;
      
      const newOrder: Order = {
        id: generateOrderId(),
        customerName: customerName.trim(),
        items: items.map(item => ({
          name: item.name.trim(),
          price: item.price,
          quantity: item.quantity
        })),
        status: "PENDING",
        totalAmount: roundedTotal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      orders.unshift(newOrder); // Add to the beginning so it shows up first
      
      addLog("success", `Order ${newOrder.id} successfully created for customer '${newOrder.customerName}' with total $${roundedTotal.toFixed(2)}.`);
      
      res.status(201).json(newOrder);
    } catch (err: any) {
      addLog("error", `Failed to create order: ${err.message}`);
      res.status(500).json({ error: "Internal server error occurred while creating order" });
    }
  });

  // 2. Retrieve all orders (optionally filtered by status)
  app.get("/api/orders", (req, res) => {
    try {
      const { status } = req.query;
      
      if (status) {
        const uppercaseStatus = String(status).toUpperCase();
        const validStatuses: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
        
        if (!validStatuses.includes(uppercaseStatus as any)) {
          return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(", ")}` });
        }
        
        const filtered = orders.filter(o => o.status === uppercaseStatus);
        return res.json(filtered);
      }
      
      res.json(orders);
    } catch (err: any) {
      addLog("error", `Failed to retrieve orders: ${err.message}`);
      res.status(500).json({ error: "Internal server error occurred while listing orders" });
    }
  });

  // 3. Retrieve order details by ID
  app.get("/api/orders/:id", (req, res) => {
    try {
      const { id } = req.params;
      const order = orders.find(o => o.id.toUpperCase() === id.toUpperCase());
      
      if (!order) {
        return res.status(404).json({ error: `Order with ID '${id}' was not found.` });
      }
      
      res.json(order);
    } catch (err: any) {
      addLog("error", `Failed to retrieve order ${req.params.id}: ${err.message}`);
      res.status(500).json({ error: "Internal server error occurred while retrieving order details" });
    }
  });

  // 4. Cancel an Order
  app.post("/api/orders/:id/cancel", (req, res) => {
    try {
      const { id } = req.params;
      const index = orders.findIndex(o => o.id.toUpperCase() === id.toUpperCase());
      
      if (index === -1) {
        return res.status(404).json({ error: `Order with ID '${id}' was not found.` });
      }
      
      const order = orders[index];
      
      if (order.status !== "PENDING") {
        addLog("warning", `Cancel request rejected: Order ${order.id} cannot be cancelled because it is in '${order.status}' status (only PENDING is permitted).`);
        return res.status(400).json({ 
          error: `Cannot cancel order. Only orders in 'PENDING' status can be cancelled. Current status is '${order.status}'.` 
        });
      }
      
      const updatedOrder: Order = {
        ...order,
        status: "CANCELLED",
        updatedAt: new Date().toISOString()
      };
      
      orders[index] = updatedOrder;
      
      addLog("success", `Customer successfully cancelled Order ${order.id}.`);
      
      res.json(updatedOrder);
    } catch (err: any) {
      addLog("error", `Failed to cancel order ${req.params.id}: ${err.message}`);
      res.status(500).json({ error: "Internal server error occurred while cancelling order" });
    }
  });

  // 5. Update order status manually (useful for shifting to SHIPPED/DELIVERED in demo)
  app.post("/api/orders/:id/status", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required in request body" });
      }
      
      const uppercaseStatus = String(status).toUpperCase();
      const validStatuses: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
      
      if (!validStatuses.includes(uppercaseStatus as any)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      
      const index = orders.findIndex(o => o.id.toUpperCase() === id.toUpperCase());
      
      if (index === -1) {
        return res.status(404).json({ error: `Order with ID '${id}' was not found.` });
      }
      
      const order = orders[index];
      const oldStatus = order.status;
      
      const updatedOrder: Order = {
        ...order,
        status: uppercaseStatus as OrderStatus,
        updatedAt: new Date().toISOString()
      };
      
      orders[index] = updatedOrder;
      
      addLog("info", `Manual status update for Order ${order.id} from '${oldStatus}' to '${uppercaseStatus}'.`);
      
      res.json(updatedOrder);
    } catch (err: any) {
      addLog("error", `Failed to update status for order ${req.params.id}: ${err.message}`);
      res.status(500).json({ error: "Internal server error occurred while updating status" });
    }
  });

  // System Routes (for monitoring and controlling background worker)
  app.get("/api/system/logs", (req, res) => {
    res.json(systemLogs);
  });

  app.post("/api/system/logs/clear", (req, res) => {
    systemLogs = [];
    addLog("info", "System logs cleared.");
    res.json({ success: true });
  });

  app.get("/api/system/config", (req, res) => {
    res.json(systemConfig);
  });

  app.post("/api/system/config", (req, res) => {
    try {
      const { workerIntervalMs, workerEnabled } = req.body;
      
      if (typeof workerEnabled === 'boolean') {
        systemConfig.workerEnabled = workerEnabled;
      }
      
      if (typeof workerIntervalMs === 'number' && workerIntervalMs >= 1000) {
        systemConfig.workerIntervalMs = workerIntervalMs;
      }
      
      addLog("info", `System settings updated. Worker: ${systemConfig.workerEnabled ? 'ENABLED' : 'DISABLED'}, Interval: ${(systemConfig.workerIntervalMs / 1000).toFixed(1)} seconds.`);
      
      startBackgroundWorker(systemConfig.workerIntervalMs);
      
      res.json(systemConfig);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  app.post("/api/system/trigger-worker", (req, res) => {
    try {
      addLog("info", "Manual background job trigger received from user interface.");
      processPendingOrders();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to manually trigger background worker" });
    }
  });

  app.post("/api/system/reset", (req, res) => {
    seedDatabase();
    res.json({ success: true, orders, systemLogs });
  });

  // Vite middleware / Static Asset serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
