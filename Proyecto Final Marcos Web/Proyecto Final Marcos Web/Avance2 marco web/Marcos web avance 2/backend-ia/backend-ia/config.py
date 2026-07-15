import os
from dotenv import load_dotenv
from pathlib import Path

# Ruta absoluta del archivo .env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

class Config:
    DATABASE_URL = os.getenv("DATABASE_URL")
    SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "https://marlet-ia-production.up.railway.app/api")
    MODEL_PATH = os.getenv("MODEL_PATH", "./models/lightfm_model.pkl")
    
class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = DevelopmentConfig() if os.getenv("ENV") == "development" else ProductionConfig()