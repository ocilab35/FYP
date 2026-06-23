from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://vhms:vhms_secret@localhost:5432/virtual_hospital"
    SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 25
    APP_TIMEZONE: str = "Asia/Karachi"

    # Blockchain verification layer
    BLOCKCHAIN_ENABLED: bool = True
    BLOCKCHAIN_RPC_URL: str = "http://127.0.0.1:8545"
    BLOCKCHAIN_CONTRACT_ADDRESS: str = ""
    BLOCKCHAIN_PRIVATE_KEY: str = ""
    BLOCKCHAIN_GAS_LIMIT: int = 500_000
    BLOCKCHAIN_MAX_FEE_GWEI: int = 30

    # Qwen AI platform (keys only in .env — never expose to frontend)
    QWEN_API_KEY: str = ""
    QWEN_MODEL: str = "qwen-plus"
    QWEN_VISION_MODEL: str = "qwen-vl-plus"
    QWEN_BASE_URL: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    QWEN_TIMEOUT: int = 120
    QWEN_TEMPERATURE: float = 0.3
    QWEN_MAX_TOKENS: int = 4096
    AI_ENABLED: bool = True

    # Polar Payment (sandbox/production — keys only in .env)
    POLAR_API_KEY: str = ""
    POLAR_WEBHOOK_SECRET: str = ""
    POLAR_ENVIRONMENT: str = "sandbox"
    POLAR_AI_SUBSCRIPTION_PRODUCT_ID: str = ""
    POLAR_APPOINTMENT_PRODUCT_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    AI_SUBSCRIPTION_AMOUNT_PKR: float = 2000.0
    AI_SUBSCRIPTION_DAYS: int = 30

    @property
    def qwen_enabled(self) -> bool:
        return self.AI_ENABLED and bool(self.QWEN_API_KEY.strip())

    @property
    def polar_enabled(self) -> bool:
        return bool(self.POLAR_API_KEY.strip())

    @property
    def polar_api_base(self) -> str:
        if self.POLAR_ENVIRONMENT.lower() == "production":
            return "https://api.polar.sh/v1"
        return "https://sandbox-api.polar.sh/v1"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.ENVIRONMENT == "development":
            for port in range(3000, 3010):
                origins.extend(
                    [
                        f"http://localhost:{port}",
                        f"http://127.0.0.1:{port}",
                    ]
                )
        return list(dict.fromkeys(origins))


settings = Settings()
