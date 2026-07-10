from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.schemas import OrderStatusSchema

# Setup an isolated in-memory SQLite database specifically for test executions
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Apply the SQLAlchemy dependency override on the FastAPI instance
app.dependency_overrides[get_db] = override_get_db

# Create the DB tables in the in-memory schema
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_create_order_valid():
    payload = {
        "customer_name": "Lokesh Kumar",
        "items": [
            {"name": "Gaming Mouse", "price": 49.99, "quantity": 1},
            {"name": "Mousepad XL", "price": 19.50, "quantity": 2}
        ]
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["customer_name"] == "Lokesh Kumar"
    assert data["status"] == "PENDING"
    assert data["total_amount"] == 88.99 # 49.99 * 1 + 19.50 * 2
    assert len(data["items"]) == 2


def test_create_order_invalid_customer():
    payload = {
        "customer_name": "   ",
        "items": [{"name": "Item A", "price": 5.00, "quantity": 1}]
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422


def test_create_order_invalid_price():
    payload = {
        "customer_name": "John Doe",
        "items": [{"name": "Item A", "price": -12.50, "quantity": 1}]
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422


def test_get_order_details():
    # 1. Place a valid order
    payload = {
        "customer_name": "Alice Cooper",
        "items": [{"name": "Concert Ticket", "price": 120.00, "quantity": 1}]
    }
    create_res = client.post("/api/orders", json=payload)
    order_id = create_res.json()["id"]

    # 2. Fetch details
    response = client.get(f"/api/orders/{order_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == order_id
    assert data["customer_name"] == "Alice Cooper"


def test_get_nonexistent_order():
    response = client.get("/api/orders/ORD-000000")
    assert response.status_code == 404


def test_cancel_pending_order():
    # 1. Create a fresh order
    payload = {
        "customer_name": "Bob Dylan",
        "items": [{"name": "Harmonica", "price": 35.00, "quantity": 1}]
    }
    create_res = client.post("/api/orders", json=payload)
    order_id = create_res.json()["id"]

    # 2. Cancel order
    cancel_res = client.post(f"/api/orders/{order_id}/cancel")
    assert cancel_res.status_code == 200
    data = cancel_res.json()
    assert data["status"] == "CANCELLED"


def test_cancel_non_pending_order_fails():
    # 1. Create order
    payload = {
        "customer_name": "Charlie Chaplin",
        "items": [{"name": "Bowler Hat", "price": 45.00, "quantity": 1}]
    }
    create_res = client.post("/api/orders", json=payload)
    order_id = create_res.json()["id"]

    # 2. Move status to SHIPPED
    move_res = client.post(f"/api/orders/{order_id}/status?next_status=SHIPPED")
    assert move_res.status_code == 200

    # 3. Attempt to cancel (should fail)
    cancel_res = client.post(f"/api/orders/{order_id}/cancel")
    assert cancel_res.status_code == 400
    assert "Only orders in 'PENDING' status can be cancelled" in cancel_res.json()["detail"]


def test_list_all_and_filter():
    # Fetch all
    response = client.get("/api/orders")
    assert response.status_code == 200
    all_orders = response.json()
    assert len(all_orders) >= 1

    # Filter by CANCELLED
    response_cancelled = client.get("/api/orders?status=CANCELLED")
    assert response_cancelled.status_code == 200
    for order in response_cancelled.json():
        assert order["status"] == "CANCELLED"
