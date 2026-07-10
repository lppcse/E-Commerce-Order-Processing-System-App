#!/usr/bin/env python3
"""
E-Commerce Order Processing System (FastAPI + SQLAlchemy + SQLite/PostgreSQL)
----------------------------------------------------------------------------
A modern, robust, and production-ready web application demonstrating a
FastAPI wrapper around the E-Commerce Order Processing System.

Features:
1. Database persistence via SQLAlchemy (SQLite by default, compatible with PostgreSQL).
2. Pydantic request/response schema validation.
3. Automated background worker running concurrently inside the FastAPI lifespan loop.
4. Clean validation, status progression checks, and transaction management.
5. Fully integrated Unit Tests using FastAPI's TestClient and an in-memory SQLite database.
"""

import os
import random
import asyncio
from datetime import datetime
from enum import Enum
from typing import List, Optional

# Third-party imports (standard in modern FastAPI stack)
# Note: These can be installed via 'pip install fastapi uvicorn sqlalchemy pydantic'
try:
    from fastapi import FastAPI, Depends, HTTPException, Query, status, BackgroundTasks
    from pydantic import BaseModel, Field, field_validator
    from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker, Session, relationship
    from fastapi.testclient import TestClient
except ImportError:
    # Fallback placeholders for static review if dependencies are not locally installed in user environment
    pass

# =====================================================================
# 1. Database Configuration
# =====================================================================

# Default to local SQLite file for absolute ease of use with zero configuration, 
# but allow seamless override to PostgreSQL via environment variables.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./order_processing.db")

# SQLite needs specific connect_args to support multi-threading safely
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# =====================================================================
# 2. SQLAlchemy ORM Models
# =====================================================================

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class OrderModel(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default=OrderStatus.PENDING.value)
    total_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Core relationship mapping to items. cascade ensures orphan items are cleaned up on deletion
    items = relationship("OrderItemModel", back_populates="order", cascade="all, delete-orphan", lazy="joined")


class OrderItemModel(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)

    order = relationship("OrderModel", back_populates="items")


# Create tables on startup (if using SQLite)
def init_db():
    Base.metadata.create_all(bind=engine)


# Dependency injection to obtain database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================================
# 3. Pydantic Validation Schemas
# =====================================================================

class OrderItemBase(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the catalog item")
    price: float = Field(..., ge=0, description="Price per unit of the item")
    quantity: int = Field(..., gt=0, description="Quantity being purchased")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Item name cannot consist solely of whitespace.")
        return v.strip()


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Name of ordering customer")
    items: List[OrderItemCreate] = Field(..., min_items=1, description="List of items in the order")

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Customer name cannot be empty or only whitespace.")
        return v.strip()


class OrderResponse(BaseModel):
    id: str
    customer_name: str
    status: OrderStatus
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True


# =====================================================================
# 4. FastAPI Application Setup
# =====================================================================

app = FastAPI(
    title="E-Commerce Order Processing API",
    description="A robust FastAPI REST service with SQLAlchemy SQLite/PostgreSQL persistence and dynamic background worker task processing.",
    version="1.0.0"
)

# Background worker configuration
# In production, this runs every 5 minutes (300 seconds). For local testing or demonstration,
# you can set BACKGROUND_WORKER_INTERVAL=10 to view updates instantly.
WORKER_INTERVAL = int(os.getenv("BACKGROUND_WORKER_INTERVAL", "300"))
worker_running = True


async def automatic_pending_processor():
    """
    Automated background worker running inside FastAPI's event loop context.
    Scans the database and transitions PENDING orders to PROCESSING status every N seconds.
    """
    global worker_running
    print(f"[BACKGROUND WORKER] Initialized. Scanning every {WORKER_INTERVAL} seconds.")
    
    while worker_running:
        try:
            # Yield control to the event loop before running cycle
            await asyncio.sleep(WORKER_INTERVAL)
            
            # Spin up an independent database session for the background thread execution
            db = SessionLocal()
            try:
                pending_orders = db.query(OrderModel).filter(OrderModel.status == OrderStatus.PENDING.value).all()
                if pending_orders:
                    count = 0
                    for order in pending_orders:
                        order.status = OrderStatus.PROCESSING.value
                        order.updated_at = datetime.utcnow()
                        count += 1
                    db.commit()
                    print(f"[BACKGROUND WORKER SUCCESS] Executed automated batch scan. Auto-transitioned {count} order(s) from PENDING to PROCESSING.")
                else:
                    print("[BACKGROUND WORKER INFO] Executed automated batch scan. Found 0 PENDING orders.")
            except Exception as ex:
                print(f"[BACKGROUND WORKER ERROR] Database transaction failed: {ex}")
                db.rollback()
            finally:
                db.close()
        except asyncio.CancelledError:
            print("[BACKGROUND WORKER] Graceful shutdown request received.")
            break
        except Exception as e:
            print(f"[BACKGROUND WORKER EXCEPTION] Unexpected error in loop: {e}")


@app.on_event("startup")
async def startup_event():
    # Initialize SQLite database schema
    init_db()
    # Start the non-blocking background processor task
    asyncio.create_task(automatic_pending_processor())


@app.on_event("shutdown")
async def shutdown_event():
    global worker_running
    worker_running = False
    print("[SERVER] Shutting down application. Background worker disabled.")


# =====================================================================
# 5. REST API Endpoints
# =====================================================================

@app.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    """
    Places a new customer order.
    The order is placed in PENDING status, and its total amount is computed on the fly.
    """
    # 1. Generate unique human-readable ID
    order_id = f"ORD-{random.randint(100000, 999999)}"
    
    # 2. Compute the total amount safely with rounding protection
    total = sum(item.price * item.quantity for item in order_data.items)
    rounded_total = round(total, 2)
    
    # 3. Create the parent Order Model
    db_order = OrderModel(
        id=order_id,
        customer_name=order_data.customer_name,
        status=OrderStatus.PENDING.value,
        total_amount=rounded_total,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # 4. Create child items
    for item in order_data.items:
        db_item = OrderItemModel(
            name=item.name,
            price=item.price,
            quantity=item.quantity,
            order_id=order_id
        )
        db_order.items.append(db_item)
        
    db.add(db_order)
    try:
        db.commit()
        db.refresh(db_order)
    except Exception as ex:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insertion failed: {ex}"
        )
        
    return db_order


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_details(order_id: str, db: Session = Depends(get_db)):
    """
    Fetches details of a specific order by its order ID (Requirement #2).
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id.strip()).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' was not found in the records."
        )
    return order


@app.get("/orders", response_model=List[OrderResponse])
def list_all_orders(status_filter: Optional[OrderStatus] = Query(None, alias="status"), db: Session = Depends(get_db)):
    """
    Retrieves all orders in the database, with optional filtering by status (Requirement #4).
    """
    query = db.query(OrderModel)
    if status_filter:
        query = query.filter(OrderModel.status == status_filter.value)
    
    # Sort with newest orders appearing first
    return query.order_by(OrderModel.created_at.desc()).all()


@app.post("/orders/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(order_id: str, db: Session = Depends(get_db)):
    """
    Allows a customer to cancel an order, but ONLY if it is still in PENDING status (Requirement #5).
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id.strip()).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' does not exist."
        )
        
    if order.status != OrderStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order. Only orders in 'PENDING' status can be cancelled. Current status is '{order.status}'."
        )
        
    order.status = OrderStatus.CANCELLED.value
    order.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(order)
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save cancellation status.")
        
    return order


@app.post("/orders/{order_id}/status", response_model=OrderResponse)
def manual_status_update(order_id: str, next_status: OrderStatus, db: Session = Depends(get_db)):
    """
    Utility endpoint to manually transition an order status (e.g. to SHIPPED or DELIVERED).
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id.strip()).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' was not found."
        )
        
    order.status = next_status.value
    order.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database write failure.")
        
    return order


# =====================================================================
# 6. Automated Unit Tests (FastAPI TestClient + In-Memory SQLite)
# =====================================================================

def run_api_unit_tests():
    """
    Constructs an isolated, independent environment with an in-memory SQLite database
    and executes unit tests validating every business constraint under the API surface.
    """
    print("\n" + "="*60)
    print("FASTAPI API ENDPOINT UNIT TESTS (IN-MEMORY SQLITE)")
    print("="*60)
    
    # 1. Setup in-memory SQLite database specifically for test isolated scope
    TEST_DATABASE_URL = "sqlite:///:memory:"
    test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    # Create tables in memory
    Base.metadata.create_all(bind=test_engine)
    
    # Override standard database dependency injection in FastAPI app
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    
    # Disable the automatic background task for tests so we can evaluate things deterministically
    global WORKER_INTERVAL
    WORKER_INTERVAL = 999999
    
    client = TestClient(app)
    
    # Test Order Payload Setup
    valid_payload = {
        "customer_name": "Diana Ross",
        "items": [
            {"name": "Mechanical Keyboard", "price": 99.99, "quantity": 1},
            {"name": "USB-C Braided Cable", "price": 12.50, "quantity": 2}
        ]
    }
    
    # TEST 1: Place a valid order
    print("[*] TEST 1: Placing a valid order via POST /orders...")
    response = client.post("/orders", json=valid_payload)
    assert response.status_code == 201
    order_data = response.json()
    order_id = order_data["id"]
    print(f"  -> SUCCESS! Created Order: {order_id} (Status: {order_data['status']}, Total: ${order_data['total_amount']})")
    assert order_data["status"] == "PENDING"
    assert order_data["total_amount"] == 124.99  # 99.99 * 1 + 12.50 * 2
    
    # TEST 2: Validation constraints (empty customer name)
    print("[*] TEST 2: Testing payload validation (empty customer name)...")
    invalid_payload = {
        "customer_name": "  ",
        "items": [{"name": "Item A", "price": 5.00, "quantity": 1}]
    }
    response = client.post("/orders", json=invalid_payload)
    assert response.status_code == 422
    print("  -> SUCCESS! Correctly blocked placement request with status 422 (Unprocessable Entity).")

    # TEST 3: Validation constraints (negative pricing)
    print("[*] TEST 3: Testing payload validation (negative price)...")
    invalid_price = {
        "customer_name": "Valid Name",
        "items": [{"name": "Item A", "price": -10.0, "quantity": 1}]
    }
    response = client.post("/orders", json=invalid_price)
    assert response.status_code == 422
    print("  -> SUCCESS! Validation correctly blocked negative prices.")

    # TEST 4: Fetch order details by ID
    print(f"[*] TEST 4: Retrieving order {order_id} details via GET /orders/{{id}}...")
    response = client.get(f"/orders/{order_id}")
    assert response.status_code == 200
    retrieved = response.json()
    assert retrieved["id"] == order_id
    assert retrieved["customer_name"] == "Diana Ross"
    print(f"  -> SUCCESS! Correctly fetched. Items Count: {len(retrieved['items'])}")

    # TEST 5: Fetch non-existent order
    print("[*] TEST 5: Retrieving non-existent order...")
    response = client.get("/orders/ORD-000000")
    assert response.status_code == 404
    print("  -> SUCCESS! Correctly returned status code 404.")

    # TEST 6: List orders and filter by status
    print("[*] TEST 6: Listing orders with status filtering via GET /orders...")
    # List all
    response = client.get("/orders")
    assert len(response.json()) >= 1
    # Filter by PENDING
    response_pending = client.get("/orders?status=PENDING")
    assert len(response_pending.json()) >= 1
    # Filter by PROCESSING (should be empty initially)
    response_processing = client.get("/orders?status=PROCESSING")
    assert len(response_processing.json()) == 0
    print("  -> SUCCESS! Status filtering constraints completely validated.")

    # TEST 7: Manual status update
    print(f"[*] TEST 7: Manually transitioning Order {order_id} status to SHIPPED...")
    response = client.post(f"/orders/{order_id}/status?next_status=SHIPPED")
    assert response.status_code == 200
    updated_order = response.json()
    assert updated_order["status"] == "SHIPPED"
    print(f"  -> SUCCESS! Status manually transitioned from PENDING to SHIPPED.")

    # TEST 8: Cancel order rule constraint (should fail now that status is SHIPPED)
    print(f"[*] TEST 8: Attempting to cancel Order {order_id} in SHIPPED status...")
    response = client.post(f"/orders/{order_id}/cancel")
    assert response.status_code == 400
    error_msg = response.json()["detail"]
    print(f"  -> SUCCESS! Cancel correctly blocked with status 400. Reason: '{error_msg}'")

    # TEST 9: Cancel valid order (creating a fresh PENDING order first)
    print("[*] TEST 9: Placing a new order and cancelling it while PENDING...")
    fresh_order = client.post("/orders", json=valid_payload).json()
    fresh_id = fresh_order["id"]
    response = client.post(f"/orders/{fresh_id}/cancel")
    assert response.status_code == 200
    cancelled_order = response.json()
    assert cancelled_order["status"] == "CANCELLED"
    print(f"  -> SUCCESS! Fresh Order {fresh_id} was successfully cancelled.")

    # Clean up dependency injection overrides
    app.dependency_overrides.clear()
    print("="*60)
    print("ALL API ENDPOINT UNIT TESTS PASSED SUCCESSFULLY!")
    print("="*60 + "\n")


if __name__ == "__main__":
    import sys
    # Check if we should run tests or boot the uvicorn web server
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        run_api_unit_tests()
    else:
        # Boot local web server automatically using uvicorn
        try:
            import uvicorn
            print("\n[*] Starting Local FastAPI Web Server...")
            print("[*] Interactive Swagger UI Documentation available at: http://127.0.0.1:8000/docs")
            print("[*] Re-run with 'python order_processing_fastapi.py test' to execute SQLAlchemy-isolated tests.\n")
            uvicorn.run("order_processing_fastapi:app", host="127.0.0.1", port=8000, reload=True)
        except ImportError:
            print("[ERROR] Please install 'uvicorn' using: pip install uvicorn")
            print("Or run tests with: python order_processing_fastapi.py test")
