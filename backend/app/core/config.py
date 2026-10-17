from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(str(ROOT_ENV), ".env"), extra="ignore")

    database_url: str = "postgresql://postgres:password@localhost:5432/postgres"
    gateway_token: str = "change-me-long-random"
    sim_token: str = "change-me-long-random"
    beacon_site_id: int = 1
    upload_dir: str = "./uploads"
    public_url: str = ""


settings = Settings()
