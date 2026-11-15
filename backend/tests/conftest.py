import os
import tempfile

# Isolated SQLite file per test run and offline AI providers.
# Must be set before the app is imported.
_db_file = os.path.join(tempfile.mkdtemp(prefix="homie-test-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ.setdefault("ENVIRONMENT", "test")
os.environ["DEMO_LISTING_COUNT"] = "200"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["EMBEDDING_PROVIDER"] = "hashing"
os.environ.pop("RESEND_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    # Context manager runs the lifespan: tables are created and demo data seeded.
    with TestClient(app) as c:
        yield c


def sign_in(client: TestClient, email: str) -> dict[str, str]:
    code = client.post("/api/auth/request-code", json={"email": email}).json()["demo_code"]
    token = client.post("/api/auth/verify", json={"email": email, "code": code}).json()["token"]
    return {"Authorization": f"Bearer {token}"}
