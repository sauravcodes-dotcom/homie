import os
import tempfile

# Isolated SQLite file per test run and offline AI providers.
# Must be set before the app is imported.
_tmp = tempfile.mkdtemp(prefix="homie-test-")
_db_file = os.path.join(_tmp, "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ.setdefault("ENVIRONMENT", "test")
os.environ["LLM_PROVIDER"] = "mock"
os.environ["EMBEDDING_PROVIDER"] = "hashing"
os.environ["EXTERNAL_REVIEWS_PROVIDER"] = "none"
os.environ["ADMIN_EMAILS"] = "admin@usc.edu"
os.environ["UPLOAD_DIR"] = os.path.join(_tmp, "uploads")
os.environ.pop("RESEND_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.database.session import Base, engine  # noqa: E402
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


@pytest.fixture
def login(monkeypatch):
    """An empty database (no demo seed) and a factory for signed-in clients.

    Each returned client sends its own bearer token, so one test can act as
    several students.
    """
    monkeypatch.setattr(get_settings(), "seed_demo_data", False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    def make(email: str, name: str = "") -> TestClient:
        c = TestClient(app)
        c.headers.update(sign_in(c, email))
        if name:
            assert c.patch("/api/auth/me", json={"full_name": name}).status_code == 200
        return c

    yield make
    app.dependency_overrides.clear()
    # Leave empty tables behind; the next `client` fixture re-seeds the demo data.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
