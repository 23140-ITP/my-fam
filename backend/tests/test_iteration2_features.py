"""My Fam API - Iteration 2 tests: Settings, Daily Check-In, Notes."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://virtual-parents.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


DEFAULTS = {
    "mom_name": "Mom",
    "dad_name": "Dad",
    "mom_warmth": "balanced",
    "dad_warmth": "balanced",
    "mom_voice": "coral",
    "dad_voice": "onyx",
}


def _reset_settings(sess):
    sess.post(f"{API}/settings", json=dict(DEFAULTS))


# --- Settings -----------------------------------------------------------
class TestSettings:
    def test_get_settings_shape_and_defaults(self, s):
        _reset_settings(s)
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        for k in ("user_name", "mom_name", "dad_name", "mom_warmth", "dad_warmth", "mom_voice", "dad_voice"):
            assert k in d, f"missing key {k}"
        assert d["mom_name"] == "Mom"
        assert d["dad_name"] == "Dad"
        assert d["mom_warmth"] == "balanced"
        assert d["dad_warmth"] == "balanced"
        assert d["mom_voice"] == "coral"
        assert d["dad_voice"] == "onyx"

    def test_update_partial_persists(self, s):
        try:
            r = s.post(f"{API}/settings", json={"mom_name": "Mama", "dad_warmth": "firm", "mom_voice": "shimmer"})
            assert r.status_code == 200
            d = r.json()
            assert d["mom_name"] == "Mama"
            assert d["dad_warmth"] == "firm"
            assert d["mom_voice"] == "shimmer"
            # dad_name should remain default
            assert d["dad_name"] == "Dad"
            # persistence via GET
            g = s.get(f"{API}/settings").json()
            assert g["mom_name"] == "Mama"
            assert g["dad_warmth"] == "firm"
            assert g["mom_voice"] == "shimmer"
        finally:
            _reset_settings(s)

    def test_invalid_warmth_and_voice_ignored(self, s):
        try:
            # first set something valid
            s.post(f"{API}/settings", json={"mom_warmth": "gentle", "mom_voice": "shimmer"})
            r = s.post(f"{API}/settings", json={"mom_warmth": "spicy", "mom_voice": "not-a-voice"})
            assert r.status_code == 200
            d = r.json()
            # Values must not have been overwritten
            assert d["mom_warmth"] == "gentle"
            assert d["mom_voice"] == "shimmer"
        finally:
            _reset_settings(s)

    def test_home_reflects_mom_name(self, s):
        try:
            s.post(f"{API}/settings", json={"mom_name": "Mama"})
            h = s.get(f"{API}/home")
            assert h.status_code == 200
            assert h.json()["settings"]["mom_name"] == "Mama"
        finally:
            _reset_settings(s)

    def test_chat_uses_internal_sender_keys(self, s):
        try:
            s.post(f"{API}/settings", json={"mom_name": "Mama"})
            r = s.post(f"{API}/chat", json={"conversation": "mom", "text": "TEST hi"})
            assert r.status_code == 200
            replies = r.json()["replies"]
            assert len(replies) == 1
            assert replies[0]["sender"] == "mom"  # internal key, not name
        finally:
            _reset_settings(s)


# --- TTS voice override -------------------------------------------------
class TestTtsVoiceOverride:
    def test_tts_default(self, s):
        r = s.get(f"{API}/tts", params={"persona": "mom", "text": "hi"}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r.content) > 500

    def test_tts_voice_override(self, s):
        r = s.get(f"{API}/tts", params={"persona": "mom", "text": "hi", "voice": "shimmer"}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r.content) > 500


# --- Check-in ------------------------------------------------------------
class TestCheckin:
    def test_checkin_flow(self, s):
        r = s.get(f"{API}/checkin")
        assert r.status_code == 200
        d = r.json()
        for k in ("date", "responded", "mom_prompt", "dad_prompt", "mom_name", "dad_name"):
            assert k in d
        assert isinstance(d["mom_prompt"], str) and len(d["mom_prompt"]) > 0
        assert isinstance(d["dad_prompt"], str) and len(d["dad_prompt"]) > 0
        # Respond
        rr = s.post(f"{API}/checkin/respond", json={"response": "I slept well"})
        assert rr.status_code == 200
        assert rr.json().get("ok") is True
        # subsequent GET
        d2 = s.get(f"{API}/checkin").json()
        assert d2["responded"] is True


# --- Notes ---------------------------------------------------------------
class TestNotes:
    def _cleanup(self, s, ids):
        for nid in ids:
            try:
                s.delete(f"{API}/notes/{nid}")
            except Exception:
                pass

    def test_notes_full_lifecycle(self, s):
        created_ids = []
        try:
            # Baseline: whatever notes currently exist
            initial = s.get(f"{API}/notes")
            assert initial.status_code == 200
            assert "notes" in initial.json()
            initial_ids = {n["id"] for n in initial.json()["notes"]}

            # Create
            payload = {
                "conversation": "mom",
                "sender": "mom",
                "text": "TEST keepsake message",
                "message_id": "TEST_mid_1",
                "created_at": "2026-01-05T10:00:00+00:00",
            }
            r = s.post(f"{API}/notes", json=payload)
            assert r.status_code == 200
            note = r.json()
            assert note["sender"] == "mom"
            assert note["text"] == "TEST keepsake message"
            assert note["message_id"] == "TEST_mid_1"
            created_ids.append(note["id"])

            # Idempotency
            r2 = s.post(f"{API}/notes", json=payload)
            assert r2.status_code == 200
            assert r2.json()["id"] == note["id"]

            # GET
            g = s.get(f"{API}/notes").json()["notes"]
            new_ids = {n["id"] for n in g} - initial_ids
            assert note["id"] in new_ids
            # Only one new note (idempotent)
            assert len([n for n in g if n["message_id"] == "TEST_mid_1"]) == 1

            # Delete (soft)
            d = s.delete(f"{API}/notes/{note['id']}")
            assert d.status_code == 200
            assert d.json().get("ok") is True
            g2 = s.get(f"{API}/notes").json()["notes"]
            assert not any(n["id"] == note["id"] for n in g2)
        finally:
            self._cleanup(s, created_ids)

    def test_notes_rejects_user_sender(self, s):
        payload = {
            "conversation": "mom",
            "sender": "user",
            "text": "TEST user cannot save",
            "message_id": "TEST_mid_user",
        }
        r = s.post(f"{API}/notes", json=payload)
        assert r.status_code == 400
