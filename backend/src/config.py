import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agroprice")
PORT = int(os.getenv("PORT", "8000"))
ODEPA_BASE_URL = os.getenv("ODEPA_BASE_URL", "https://www.odepa.gob.cl/wp-content/uploads")
HISTORICAL_START_DATE = os.getenv("HISTORICAL_START_DATE", "2023-01-01")
