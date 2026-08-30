"""My Fam API - end-to-end backend tests hitting the public preview URL."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://virtual-parents.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Root / Home ---------------------------------------------------------
class TestRootAndHome:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert "My Fam" in r.json().get("message", "")

    def test_home_shape(self, s):
        r = s.get(f"{API}/home")
        assert r.status_code == 200
        data = r.json()
        assert "name" in data and isinstance(data["name"], str)
        assert "care" in data and isinstance(data["care"], dict)
        assert "conversations" in data
        convs = {c["conversation"] for c in data["conversations"]}
        assert convs == {"mom", "dad", "family"}


# --- Profile -------------------------------------------------------------
class TestProfile:
    def test_get_profile(self, s):
        r = s.get(f"{API}/profile")
        assert r.status_code == 200
        assert "name" in r.json()

    def test_update_profile_persists(self, s):
        original = s.get(f"{API}/profile").json()["name"]
        try:
            r = s.post(f"{API}/profile", json={"name": "TEST_Alex"})
            assert r.status_code == 200
            assert r.json()["name"] == "TEST_Alex"
            # verify persistence via GET
            assert s.get(f"{API}/profile").json()["name"] == "TEST_Alex"
        finally:
            s.post(f"{API}/profile", json={"name": original})


# --- Care ---------------------------------------------------------------
class TestCare:
    def test_care_get(self, s):
        r = s.get(f"{API}/care")
        assert r.status_code == 200
        d = r.json()
        for k in ("date", "meals", "water_glasses", "water_goal"):
            assert k in d

    def test_water_increment_and_clamp(self, s):
        start = s.get(f"{API}/care").json()["water_glasses"]
        r = s.post(f"{API}/care/water", json={"delta": 1})
        assert r.status_code == 200
        assert r.json()["water_glasses"] == min(12, start + 1)
        # rollback
        s.post(f"{API}/care/water", json={"delta": -1})

    def test_water_upper_clamp(self, s):
        start = s.get(f"{API}/care").json()["water_glasses"]
        r = s.post(f"{API}/care/water", json={"delta": 999})
        assert r.status_code == 200
        assert r.json()["water_glasses"] == 12
        # bring back to start
        s.post(f"{API}/care/water", json={"delta": start - 12})
        assert s.get(f"{API}/care").json()["water_glasses"] == start

    def test_water_lower_clamp(self, s):
        start = s.get(f"{API}/care").json()["water_glasses"]
        r = s.post(f"{API}/care/water", json={"delta": -999})
        assert r.status_code == 200
        assert r.json()["water_glasses"] == 0
        s.post(f"{API}/care/water", json={"delta": start})

    def test_meal_toggle(self, s):
        label = "TEST_Snack"
        r1 = s.post(f"{API}/care/meal", json={"label": label})
        assert r1.status_code == 200
        assert any(m["label"] == label for m in r1.json()["meals"])
        r2 = s.post(f"{API}/care/meal", json={"label": label})
        assert r2.status_code == 200
        assert not any(m["label"] == label for m in r2.json()["meals"])

    def test_sleep(self, s):
        r = s.post(f"{API}/care/sleep", json={"slept_well": True, "hours": 7.5})
        assert r.status_code == 200
        d = r.json()
        assert d["slept_well"] is True
        assert d["sleep_hours"] == 7.5
        # persistence
        d2 = s.get(f"{API}/care").json()
        assert d2["slept_well"] is True


# --- Messages -----------------------------------------------------------
class TestMessagesAndChat:
    def test_get_messages_ordered(self, s):
        r = s.get(f"{API}/messages", params={"conversation": "mom"})
        assert r.status_code == 200
        msgs = r.json()["messages"]
        times = [m["created_at"] for m in msgs]
        assert times == sorted(times)

    def test_chat_mom_single_reply(self, s):
        r = s.post(f"{API}/chat", json={"conversation": "mom", "text": "TEST hi mom"})
        assert r.status_code == 200
        replies = r.json()["replies"]
        assert len(replies) == 1
        assert replies[0]["sender"] == "mom"
        assert isinstance(replies[0]["text"], str) and len(replies[0]["text"]) > 0

    def test_chat_dad_single_reply(self, s):
        r = s.post(f"{API}/chat", json={"conversation": "dad", "text": "TEST hey dad"})
        assert r.status_code == 200
        replies = r.json()["replies"]
        assert len(replies) == 1
        assert replies[0]["sender"] == "dad"

    def test_chat_family_two_replies_mom_and_dad(self, s):
        r = s.post(f"{API}/chat", json={"conversation": "family", "text": "TEST hi both"})
        assert r.status_code == 200
        replies = r.json()["replies"]
        assert len(replies) == 2
        senders = {rp["sender"] for rp in replies}
        assert senders == {"mom", "dad"}
        # different perspectives => different text
        texts = [rp["text"] for rp in replies]
        assert texts[0] != texts[1]

    def test_chat_persists_messages(self, s):
        before = len(s.get(f"{API}/messages", params={"conversation": "dad"}).json()["messages"])
        s.post(f"{API}/chat", json={"conversation": "dad", "text": "TEST persist check"})
        after = len(s.get(f"{API}/messages", params={"conversation": "dad"}).json()["messages"])
        assert after >= before + 2  # user + dad reply


# --- Conversations ------------------------------------------------------
class TestConversations:
    def test_conversations_unread_flag(self, s):
        # send a msg so last is user (unread=False), then GET should mark last as parent after chat
        s.post(f"{API}/chat", json={"conversation": "mom", "text": "TEST unread flag"})
        r = s.get(f"{API}/conversations")
        assert r.status_code == 200
        convs = r.json()["conversations"]
        mom = next(c for c in convs if c["conversation"] == "mom")
        assert mom["unread"] is True  # last is mom reply


# --- TTS ----------------------------------------------------------------
class TestTTS:
    def test_tts_mom(self, s):
        r = s.get(f"{API}/tts", params={"persona": "mom", "text": "hello"}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r.content) > 500

    def test_tts_dad(self, s):
        r = s.get(f"{API}/tts", params={"persona": "dad", "text": "hello"}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r.content) > 500

    def test_tts_bad_persona(self, s):
        r = s.get(f"{API}/tts", params={"persona": "cousin", "text": "hi"})
        assert r.status_code == 400
