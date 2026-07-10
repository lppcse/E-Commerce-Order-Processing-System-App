import asyncio
from fastapi import FastAPI
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.routers import orders
from backend.app.worker import automatic_pending_processor, stop_worker

# Initialize relational database schemas/tables
def init_db():
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="E-Commerce Order Processing API (Modular)",
    description="A robust, highly scalable, and modular FastAPI service with SQLAlchemy ORM and async background scanning workers.",
    version="2.0.0"
)

@app.on_event("startup")
async def startup_event():
    # Setup initial database tables
    init_db()
    # Spin up background worker task
    asyncio.create_task(automatic_pending_processor())

@app.on_event("shutdown")
async def shutdown_event():
    # Instruct background loop to stop gracefully
    stop_worker()
    print("[SERVER] App shutting down. Background worker disabled.")

# Register sub-routers
app.include_router(orders.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}
