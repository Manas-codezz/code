"""Tests run against an isolated temp DB — never the demo database."""
import tempfile
from pathlib import Path

from app.settings import settings

_tmp = Path(tempfile.mkdtemp(prefix="bgtest_"))
settings.database_path = str(_tmp / "test.db")
settings.upload_dir = str(_tmp / "uploads")
settings.llm_provider = "mock"   # tests never spend API tokens
