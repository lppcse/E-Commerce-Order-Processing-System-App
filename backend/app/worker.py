import asyncio
from datetime import datetime
from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import OrderModel, OrderStatus

worker_running = True

async def automatic_pending_processor():
    """
    Automated background worker running inside FastAPI's event loop context.
    Scans the database and transitions PENDING orders to PROCESSING status every N seconds.
    """
    global worker_running
    print(f"[BACKGROUND WORKER] Initialized. Scanning every {settings.BACKGROUND_WORKER_INTERVAL} seconds.")
    
    while worker_running:
        try:
            # Yield control to the event loop before running cycle
            await asyncio.sleep(settings.BACKGROUND_WORKER_INTERVAL)
            
            # Spin up an independent database session for the background cycle
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

def stop_worker():
    global worker_running
    worker_running = False
