import pytest

from tests.conftest import sign_in


@pytest.mark.parametrize(
    "email",
    ["someone@gmail.com", "x@notusc.edu", "x@usc.edu.evil.com", "x@mail.usc.edu", "not-an-email"],
)
def test_only_usc_edu_addresses_can_request_codes(client, email):
    resp = client.post("/api/auth/request-code", json={"email": email})
    assert resp.status_code in (400, 403)


def test_usc_sign_in_flow(client):
    resp = client.post("/api/auth/request-code", json={"email": "  Tommy.Trojan@USC.edu "})
    body = resp.json()
    assert resp.status_code == 200
    assert body["email"] == "tommy.trojan@usc.edu"
    assert body["delivered_by_email"] is False
    assert len(body["demo_code"]) == 6

    session = client.post(
        "/api/auth/verify", json={"email": "tommy.trojan@usc.edu", "code": body["demo_code"]}
    ).json()
    headers = {"Authorization": f"Bearer {session['token']}"}
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["email"] == "tommy.trojan@usc.edu"
    assert me["is_usc_verified"] is True

    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_wrong_code_rejected_and_code_single_use(client):
    email = "wrong.code@usc.edu"
    code = client.post("/api/auth/request-code", json={"email": email}).json()["demo_code"]
    bad = "000000" if code != "000000" else "111111"
    assert client.post("/api/auth/verify", json={"email": email, "code": bad}).status_code == 401
    assert client.post("/api/auth/verify", json={"email": email, "code": code}).status_code == 200
    assert client.post("/api/auth/verify", json={"email": email, "code": code}).status_code == 401


def test_attempts_are_limited(client):
    email = "brute@usc.edu"
    code = client.post("/api/auth/request-code", json={"email": email}).json()["demo_code"]
    bad = "000000" if code != "000000" else "111111"
    for _ in range(5):
        client.post("/api/auth/verify", json={"email": email, "code": bad})
    assert client.post("/api/auth/verify", json={"email": email, "code": code}).status_code == 401


def test_me_requires_sign_in(client):
    assert client.get("/api/auth/me").status_code == 401
    assert sign_in(client, "helper@usc.edu")["Authorization"].startswith("Bearer ")
