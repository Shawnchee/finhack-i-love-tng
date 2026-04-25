from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Config(BaseSettings):
    app_name: str = "TNG Fraud Detection API"
    debug: bool = False

    # Database
    # Local dev: leave DATABASE_URL unset → falls back to SQLite
    # Production: DATABASE_URL=postgresql://user:pass@apsara-endpoint:5432/dbname
    database_url: str = ""
    db_name: str = "test.db"

    # LLM (fraud scan)
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = "ilmu-mini-v3"
    llm_reasoning_effort: str = ""

    # Reddit (fraud scan scraper)
    reddit_client_id: str = ""
    reddit_client_secret: str = ""

    # Telegram (fraud scan scraper)
    telegram_api_id: str = ""
    telegram_api_hash: str = ""
    telegram_session_string: str = ""

    # AWS / S3 / SageMaker (behavioral)
    aws_region: str = "ap-southeast-1"
    s3_data_bucket: str = ""
    s3_model_bucket: str = ""
    sagemaker_endpoint_name: str = ""
    sagemaker_role_arn: str = ""

    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///./{self.db_name}"


config = Config()
