# Assignment Report: E-commerce Order Processing System
### Built using AI Coding Assistants (Cursor AI & Gemini/ChatGPT)

This document provides a detailed overview of the system design, the development process guided by AI assistance, key issues identified, and how they were resolved to build a robust, production-ready system.

---

## 1. Architectural Design & Choices

The Order Processing System is designed around a **clean, thread-safe, and object-oriented architecture** using Python 3:

*   **OrderStatus (Enum)**: Enforces strict type-safety for order states: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, and `CANCELLED`.
*   **OrderItem (Dataclass)**: An immutable value object representing individual items. It includes post-initialization checks to ensure name validation, non-negative price, and positive integer quantities.
*   **Order (Dataclass)**: Represents an order containing ID, customer name, items, status, total amount, and timestamps. It guarantees monetary precision by auto-calculating and rounding totals on instantiation.
*   **OrderProcessingSystem (Engine)**: Manages the collection of orders. Uses a reentrant lock (`threading.Lock()`) to guarantee complete thread safety when concurrent users place or cancel orders while background tasks process them.
*   **BackgroundOrderWorker (Daemon Thread)**: A non-blocking daemon thread that acts as a background scheduler, scanning and updating `PENDING` orders to `PROCESSING` at specified intervals (configured for 5 minutes by default).

---

## 2. AI Collaboration Log (How AI was Utilized)

During the creation of this assignment, AI assistants (Cursor AI, Gemini, and ChatGPT) were used extensively as collaborative co-pilots across the software development lifecycle:

1.  **Architecture & Schema Design**: Prompted the AI to propose an elegant object-oriented schema using modern Python features (like `dataclasses` and `Enum`) rather than primitive dictionaries. This helped establish a strict domain model.
2.  **Concurrency Design**: Discussed with the AI how to safely run the "5-minute background update job" in a way that doesn't block incoming API requests or cause race conditions. The AI recommended a daemon thread running a loop with a `threading.Event` stop flag, paired with a mutex lock.
3.  **Test Case Drafting**: Utilized the AI to auto-generate a comprehensive test suite covering normal operations, edge cases (empty orders, negative prices), and state-transition rules.
4.  **Debugging & Optimization**: Passed error logs and edge cases to the AI to refine input validation and rounding logic.

---

## 3. Key Issues Identified & Corrected

Below are the major technical challenges identified during development and the solutions implemented to resolve them:

### Issue 1: Floating-Point Rounding & Financial Precision
*   **The Issue**: Adding up float values for items (e.g. `$9.99 * 3 + $5.50 * 1`) in Python can introduce binary floating-point inaccuracies (e.g., getting `35.470000000000006` instead of `35.47`). This causes broken assertions in tests and inaccurate invoice amounts.
*   **The Correction**: In the `Order` dataclass's `__post_init__` method, we introduced strict rounding: `self.total_amount = round(total, 2)`. This ensures that all order totals are clean, precise, and double-decimal-compliant.

### Issue 2: Thread Race Conditions on Shared Memory
*   **The Issue**: The background worker thread runs scans and updates statuses asynchronously. If a client tries to cancel or retrieve an order at the exact millisecond the background job is updating it, it could cause data inconsistency or dictionary mutation errors (`RuntimeError: dictionary changed size during iteration`).
*   **The Correction**: We integrated a mutex lock (`self._lock = threading.Lock()`) in the `OrderProcessingSystem` class. Every method that reads or writes to the order catalog (`create_order`, `get_order`, `cancel_order`, `process_pending_orders_job`) is wrapped in a thread-safe `with self._lock:` context manager, serializing data access.

### Issue 3: Status Transition Violation (Uncontrolled Cancellations)
*   **The Issue**: In a simple implementation, a customer might cancel an order that is already `SHIPPED` or `DELIVERED`, leading to logistics issues.
*   **The Correction**: We implemented strict guard clauses in the `cancel_order` method. It verifies that `order.status == OrderStatus.PENDING` first. If it is in any other status, it raises a custom `OrderCancellationError` exception, preserving order integrity.

### Issue 4: Graceful Shutdown of Background Threads
*   **The Issue**: Standard infinite loops (`while True: time.sleep(interval)`) in background threads cannot be stopped easily from outside, which makes running tests or cleanly exiting the application difficult, often causing the terminal to hang.
*   **The Correction**: We implemented a cooperative shutdown pattern. The background loop relies on a `threading.Event()` named `self._stop_event`. Instead of blocking on `time.sleep()`, the thread waits on `self._stop_event.wait(self.interval)`. Calling `worker.stop()` sets this event, waking up the thread instantly to exit cleanly.

---

## 4. How to Run & Verify

The Python script is fully self-contained and requires no external third-party packages, making it exceptionally lightweight and portable.

### Run the Interactive Simulator
Runs a live CLI demo representing orders being placed, processed by a simulated sped-up background worker, and validated for cancellation limits:
```bash
python order_processing_system.py
```

### Run the Core Unit Test Suite
Runs the comprehensive automated test suite validating 100% of the core requirements (creation, retrieval, status-specific cancellation, and automated background transitions):
```bash
python order_processing_system.py test
```
