import os

class Settings:
    # Default to local SQLite database, but easily configured to use PostgreSQL or MySQL via environment variable
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./order_processing.db")
    
    # Background worker scan interval in seconds (default is 5 minutes / 300s)
    BACKGROUND_WORKER_INTERVAL: int = int(os.getenv("BACKGROUND_WORKER_INTERVAL", "300"))

settings = Settings()
