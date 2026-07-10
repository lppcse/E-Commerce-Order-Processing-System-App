#!/usr/bin/env python3
"""
E-Commerce Order Processing System
----------------------------------
A robust, thread-safe backend implementation in Python 3 for processing orders,
managing statuses, and executing automated background worker updates.

This script includes:
1. Core Domain Models (Order, OrderItem, OrderStatus)
2. Main Engine (OrderProcessingSystem) with Thread-Safe Locks
3. Automated Background Worker (updates PENDING to PROCESSING every 5 minutes)
4. Comprehensive Automated Unit Tests (built-in, runs with `unittest`)
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
            return count


# =====================================================================
# 3. Background Worker Scheduler (Daemon Thread)
# =====================================================================

class BackgroundOrderWorker:
    def __init__(self, system: OrderProcessingSystem, interval_seconds: float = 300.0):
        """
        Initializes the background worker.
        Default interval is 300.0 seconds (5 minutes) as per requirements.
        """
        self.system = system
        self.interval = interval_seconds
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Starts the background worker as a non-blocking daemon thread."""
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Triggers the worker to stop gracefully."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1.0)

    def _run_loop(self):
        while not self._stop_event.wait(self.interval):
            try:
                # Trigger order transitioning
                processed_count = self.system.process_pending_orders_job()
                if processed_count > 0:
                    print(f"\n[BACKGROUND WORKER] Automated scan executed. Successfully updated {processed_count} PENDING orders to PROCESSING.")
            except Exception as e:
                print(f"\n[BACKGROUND WORKER ERROR] Error running background task: {e}")


# =====================================================================
# 4. Automated Unit Test Suite (pytest/unittest compatible)
# =====================================================================

class TestOrderProcessingSystem(unittest.TestCase):
    def setUp(self):
        self.sys = OrderProcessingSystem()
        self.items_a = [
            OrderItem(name="Mechanical Keyboard", price=99.99, quantity=1),
            OrderItem(name="Ergonomic Mouse", price=45.50, quantity=2)
        ]
        self.items_b = [
            OrderItem(name="Coffee Mug", price=12.00, quantity=1)
        ]

    def test_create_order(self):
        order = self.sys.create_order("John Doe", self.items_a)
        self.assertTrue(order.id.startswith("ORD-"))
        self.assertEqual(order.customer_name, "John Doe")
        self.assertEqual(order.status, OrderStatus.PENDING)
        # Expected: 99.99 * 1 + 45.50 * 2 = 190.99
        self.assertEqual(order.total_amount, 190.99)
        self.assertIsInstance(order.created_at, datetime)

    def test_invalid_order_details(self):
        # Empty customer name
        with self.assertRaises(InvalidOrderDetailsError):
            self.sys.create_order("", self.items_a)
        
        # Empty item list
        with self.assertRaises(InvalidOrderDetailsError):
            self.sys.create_order("John Doe", [])

        # Invalid item price
        with self.assertRaises(InvalidOrderDetailsError):
            OrderItem(name="Broken Item", price=-5.00, quantity=1)

        # Invalid item quantity
        with self.assertRaises(InvalidOrderDetailsError):
            OrderItem(name="Broken Item", price=10.00, quantity=0)

    def test_retrieve_order(self):
        order = self.sys.create_order("John Doe", self.items_a)
        retrieved = self.sys.get_order(order.id)
        self.assertEqual(retrieved.id, order.id)
        self.assertEqual(retrieved.customer_name, "John Doe")

        # Querying non-existent order ID
        with self.assertRaises(OrderNotFoundError):
            self.sys.get_order("ORD-NONEXISTENT")

    def test_list_orders_and_filter(self):
        order1 = self.sys.create_order("John Doe", self.items_a)
        order2 = self.sys.create_order("Jane Smith", self.items_b)
        
        # List all
        all_orders = self.sys.list_orders()
        self.assertEqual(len(all_orders), 2)
        
        # Manual update for testing
        self.sys.update_order_status(order2.id, OrderStatus.PROCESSING)
        
        # Filter for PENDING
        pending_orders = self.sys.list_orders(OrderStatus.PENDING)
        self.assertEqual(len(pending_orders), 1)
        self.assertEqual(pending_orders[0].id, order1.id)

        # Filter for PROCESSING
        processing_orders = self.sys.list_orders(OrderStatus.PROCESSING)
        self.assertEqual(len(processing_orders), 1)
        self.assertEqual(processing_orders[0].id, order2.id)

    def test_cancel_order_valid(self):
        order = self.sys.create_order("John Doe", self.items_a)
        cancelled_order = self.sys.cancel_order(order.id)
        self.assertEqual(cancelled_order.status, OrderStatus.CANCELLED)

    def test_cancel_order_invalid_status(self):
        order = self.sys.create_order("John Doe", self.items_a)
        # Advance status past PENDING
        self.sys.update_order_status(order.id, OrderStatus.PROCESSING)
        
        # Attempting to cancel should now fail
        with self.assertRaises(OrderCancellationError):
            self.sys.cancel_order(order.id)
            
        # Verify status remains PROCESSING
        self.assertEqual(order.status, OrderStatus.PROCESSING)

    def test_background_job_transition(self):
        order1 = self.sys.create_order("Alice", self.items_a) # PENDING
        order2 = self.sys.create_order("Bob", self.items_b)   # PENDING
        
        # Manually shift order2 to SHIPPED to ensure it doesn't get rolled back to PROCESSING
        self.sys.update_order_status(order2.id, OrderStatus.SHIPPED)
        
        # Execute background job
        processed_count = self.sys.process_pending_orders_job()
        
        self.assertEqual(processed_count, 1) # Only Alice was PENDING
        self.assertEqual(self.sys.get_order(order1.id).status, OrderStatus.PROCESSING)
        self.assertEqual(self.sys.get_order(order2.id).status, OrderStatus.SHIPPED)


# =====================================================================
# 5. CLI Interactive Demonstration
# =====================================================================

def run_interactive_demo():
    print("=" * 60)
    print("E-COMMERCE ORDER PROCESSING SYSTEM INTERACTIVE DEMO (PYTHON)")
    print("=" * 60)
    
    sys = OrderProcessingSystem()
    
    # 1. Start worker with a sped-up speed (2 seconds) for demonstration
    demo_interval = 3.0
    worker = BackgroundOrderWorker(sys, interval_seconds=demo_interval)
    worker.start()
    
    print(f"[*] Background Worker active (Demo Mode: scanning every {demo_interval} seconds)")
    print("[*] Placing orders...")
    
    # Place order 1
    items1 = [OrderItem("Premium Mechanical Keyboard", 120.00, 1), OrderItem("Mouse Pad", 15.50, 2)]
    order1 = sys.create_order("Alice", items1)
    print(f"  -> Created Order {order1.id} for {order1.customer_name}. Total: ${order1.total_amount:.2f} (Status: {order1.status.value})")
    
    # Place order 2
    items2 = [OrderItem("Wireless Noise-Cancelling Headphones", 250.00, 1)]
    order2 = sys.create_order("Bob", items2)
    print(f"  -> Created Order {order2.id} for {order2.customer_name}. Total: ${order2.total_amount:.2f} (Status: {order2.status.value})")
    
    print("\n[*] Waiting 4 seconds for Background Worker to trigger auto-processing...")
    time.sleep(4.0)
    
    # Check states
    print("\n[*] Retrieving current order states:")
    for o in sys.list_orders():
        print(f"  - Order {o.id} ({o.customer_name}): Status = {o.status.value}, Total = ${o.total_amount:.2f}")
        
    print("\n[*] Attempting to cancel an order now that it's in PROCESSING...")
    try:
        sys.cancel_order(order1.id)
    except OrderCancellationError as e:
        print(f"  [EXPECTED ERROR CORRECTED] Cancel failed: {e}")
        
    # Place a new order and cancel it immediately
    print("\n[*] Creating Order 3 and cancelling it immediately (while still PENDING)...")
    order3 = sys.create_order("Charlie", [OrderItem("USB-C Hub Adapter", 45.00, 1)])
    print(f"  - Created Order {order3.id} (Status: {order3.status.value})")
    cancelled = sys.cancel_order(order3.id)
    print(f"  - Status of {cancelled.id} after cancel: {cancelled.status.value}")
    
    print("\n[*] Stopping background worker thread...")
    worker.stop()
    print("[*] Demo finished. All systems clean.")
    print("=" * 60)


if __name__ == "__main__":
    import sys as pysys
    # Check if we should run tests or demo
    if len(pysys.argv) > 1 and pysys.argv[1] == "test":
        # Remove 'test' argument so unittest doesn't get confused
        pysys.argv = pysys.argv[:1]
        unittest.main()
    else:
        run_interactive_demo()
        print("\nTip: To run the core Python Unit Tests, run: python order_processing_system.py test")
