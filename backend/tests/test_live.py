from tests.test_product import PROFILE


def test_mutual_save_is_a_match(login):
    a, b = login("a@usc.edu", "Ana Li"), login("b@usc.edu", "Ben Ro")
    a.put("/api/profile", json=PROFILE)
    b.put("/api/profile", json=PROFILE)
    a_id = a.get("/api/auth/me").json()["id"]
    b_id = b.get("/api/auth/me").json()["id"]

    first = a.post("/api/swipes", json={"target_type": "user", "target_id": b_id, "action": "save"})
    assert first.status_code == 200 and first.json() == {"mutual": False}
    passed = b.post(
        "/api/swipes", json={"target_type": "user", "target_id": a_id, "action": "pass"}
    )
    assert passed.json() == {"mutual": False}
    back = b.post("/api/swipes", json={"target_type": "user", "target_id": a_id, "action": "save"})
    assert back.json() == {"mutual": True}


def test_typing_and_read_receipts(login):
    a, b = login("a@usc.edu", "Ana Li"), login("b@usc.edu", "Ben Ro")
    b.put("/api/profile", json=PROFILE)
    b_id = b.get("/api/auth/me").json()["id"]
    conv = a.post("/api/conversations", json={"user_id": b_id, "body": "Hey!"}).json()
    url = f"/api/conversations/{conv['id']}"

    assert a.get(url).json()["other_read_up_to"] is None
    assert b.post(f"{url}/typing").status_code == 204
    seen = a.get(url).json()
    assert seen["other_typing"] is True

    thread = b.get(url).json()  # b opens it: a's message is now read
    b.post(f"{url}/messages", json={"body": "Hi"})
    after = a.get(url).json()
    assert after["other_typing"] is False
    assert after["other_read_up_to"] == thread["messages"][0]["id"]
