# E-Commerce Order Processing Backend (FastAPI Micro-Level Architecture)

A highly structured, clean, and production-grade implementation of the E-Commerce Order Processing API.

## Architectural Breakdown (Separation of Concerns)

Our backend code has been refactored into a scalable micro-level modular layout:

*   **`app/config.py`**: Reads variables safely from the environment and centralizes system configurations (database strings, worker sleep frequencies, etc.).
*   **`app/database.py`**: Orchestrates connection pooling, SQLAlchemy declarative base initialization, and dependency injection helpers (`get_db`) to guarantee clean session cleanup and rollback operations.
*   **`app/models.py`**: Defines relational SQLAlchemy models (`OrderModel`, `OrderItemModel`) featuring cascading foreign keys for item cleanups.
*   **`app/schemas.py`**: Implements Pydantic validation schemas (`OrderCreate`, `OrderResponse`, etc.) to intercept invalid payloads (whitespace customer names, negative prices, zero quantities) before hitting the database.
*   **`app/worker.py`**: Hosts non-blocking asynchronous `asyncio` task lifespans to process database status transitions (`PENDING` -> `PROCESSING`) concurrently without locking main threads.
*   **`app/routers/orders.py`**: Handles clean REST endpoint mappings (`create`, `get`, `list`, `cancel`, `status`) to decouple network routing from initialization.
*   **`app/main.py`**: The central application bootloader, mounting lifespans and sub-routers.
*   **`tests/test_orders.py`**: Comprehensive, database-isolated unit tests utilizing an in-memory SQLite setup.

## Running the Backend

To boot the API microservice locally:
```bash
# Install dependencies
pip install -r requirements.txt

# Start the web server
uvicorn backend.app.main:app --reload --port 3000
```

## Running Backend Tests

To run the isolated unit and integration test suite:
```bash
pytest backend/tests/
```
