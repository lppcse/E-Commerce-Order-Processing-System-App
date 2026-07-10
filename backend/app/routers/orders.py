import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import OrderModel, OrderItemModel, OrderStatus
from backend.app.schemas import OrderCreate, OrderResponse, OrderStatusSchema

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/{order_id}", response_model=OrderResponse)
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


@router.get("", response_model=List[OrderResponse])
def list_all_orders(
    status_filter: Optional[OrderStatusSchema] = Query(None, alias="status"), 
    db: Session = Depends(get_db)
):
    """
    Retrieves all orders in the database, with optional filtering by status (Requirement #4).
    """
    query = db.query(OrderModel)
    if status_filter:
        query = query.filter(OrderModel.status == status_filter.value)
    
    # Sort with newest orders appearing first
    return query.order_by(OrderModel.created_at.desc()).all()


@router.post("/{order_id}/cancel", response_model=OrderResponse)
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


@router.post("/{order_id}/status", response_model=OrderResponse)
def manual_status_update(order_id: str, next_status: OrderStatusSchema, db: Session = Depends(get_db)):
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
