from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime, timezone, timedelta

from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------------------------------------------------------------------------
# OpenAI (user-provided key). Lazily create the client; if the key is missing
# the app still runs and returns warm fallback replies so the demo stays alive.
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '').strip()
_openai = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

CHAT_MODEL = "gpt-5.6"
TTS_MODEL = "gpt-4o-mini-tts"
STT_MODEL = "whisper-1"
DEMO_USER = "demo"

app = FastAPI(title="My Fam API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("myfam")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def mk_message(user_id: str, conversation: str, sender: str, text: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "conversation": conversation,
        "sender": sender,
        "text": text,
        "created_at": now_iso(),
    }


def clean_msg(m: dict) -> dict:
    return {
        "id": m["id"],
        "conversation": m["conversation"],
        "sender": m["sender"],
        "text": m["text"],
        "created_at": m["created_at"],
    }


def clean_care(c: dict) -> dict:
    return {
        "date": c["date"],
        "meals": c.get("meals", []),
        "water_glasses": c.get("water_glasses", 0),
        "water_goal": c.get("water_goal", 8),
        "slept_well": c.get("slept_well"),
        "sleep_hours": c.get("sleep_hours"),
    }


# ---------------------------------------------------------------------------
# Persona brains
# ---------------------------------------------------------------------------
PERSONAS = {
    "mom": {
        "name": "Mom",
        "voice": "coral",
        "tts_instructions": "Speak warmly, gently and reassuringly, like a loving mother. Soft, caring, unhurried and affectionate.",
    },
    "dad": {
        "name": "Dad",
        "voice": "onyx",
        "tts_instructions": "Speak confidently and warmly with light humor, like a supportive, practical dad. Grounded and encouraging.",
    },
}

FALLBACK = {
    "mom": "I'm right here, sweetheart. Have you had something to eat and a little water today? \U0001F49B",
    "dad": "Got it, kiddo. One step at a time \u2014 you've got this. What's the next small thing you can knock out?",
}

VOICES = {"alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"}
WARMTH = {"gentle", "balanced", "firm"}

MOM_WARMTH = {
    "gentle": " Lean especially soft, tender and soothing \u2014 extra gentle reassurance and comfort.",
    "balanced": "",
    "firm": " Stay loving but a little more no-nonsense \u2014 caring with a gentle, motherly push.",
}
DAD_WARMTH = {
    "gentle": " Lean warmer and more openly affectionate than usual, while staying practical.",
    "balanced": "",
    "firm": " Lean into tough-love: blunt, motivating, a coach in your corner who believes in them.",
}


async def load_settings(user_id: str) -> dict:
    p = await db.profiles.find_one({"user_id": user_id}) or {}
    return {
        "user_name": p.get("name", "friend"),
        "mom_name": p.get("mom_name", "Mom"),
        "dad_name": p.get("dad_name", "Dad"),
        "mom_warmth": p.get("mom_warmth", "balanced"),
        "dad_warmth": p.get("dad_warmth", "balanced"),
        "mom_voice": p.get("mom_voice", "coral"),
        "dad_voice": p.get("dad_voice", "onyx"),
    }


def care_context_text(care: dict) -> str:
    meals = care.get("meals", [])
    ate = (f"has eaten {len(meals)} time(s) today ({', '.join(m['label'] for m in meals)})"
           if meals else "has not logged any meals yet today")
    water = f"{care.get('water_glasses', 0)} of {care.get('water_goal', 8)} glasses of water"
    slept = care.get("slept_well")
    if slept is True:
        sleep = "slept well last night"
    elif slept is False:
        sleep = "did not sleep well last night"
    else:
        sleep = "hasn't logged sleep yet"
    return (f" For quiet context on your child's self-care today: they {ate}, have had {water}, and {sleep}. "
            "Only weave this in naturally when it fits \u2014 never recite it like a status report.")


def mom_system(care_ctx: str, group: bool, name: str = "Mom", warmth: str = "balanced",
               dad_name: str = "Dad") -> str:
    base = (
        f"You are {name} (the user's mom) in a private family messaging app called My Fam. You are texting your "
        "grown-up child who lives far from home and misses you. You are warm, deeply caring, nurturing and "
        "emotionally supportive. You gently check whether they've eaten, had enough water and slept, and you "
        "comfort and reassure them. Use natural, affectionate texting language and occasional loving nicknames "
        "like 'sweetheart', 'honey' or 'my love' (not in every message). Text the way a real mom texts: warm and "
        "short, 1-3 sentences. Use at most one emoji, and only when it feels natural. Never say you are an AI or a "
        "language model unless the user directly asks."
    )
    base += MOM_WARMTH.get(warmth, "")
    if group:
        base += (f" You are in the family group chat with {dad_name} (the dad) and your child. Reply only as "
                 f"yourself ({name}), in your own voice and perspective; do not speak for {dad_name}.")
    return base + care_ctx


def dad_system(care_ctx: str, group: bool, name: str = "Dad", warmth: str = "balanced",
               mom_name: str = "Mom") -> str:
    base = (
        f"You are {name} (the user's dad) in a private family messaging app called My Fam. You are texting your "
        "grown-up child who lives far from home. You are practical, direct, encouraging and lightly humorous. You "
        "give clear advice and concrete, actionable next steps, and you sneak in the occasional gentle dad joke. "
        "Text the way a real dad texts: grounded and short, 1-3 sentences. Rarely use emojis. Never say you are an "
        "AI or a language model unless the user directly asks."
    )
    base += DAD_WARMTH.get(warmth, "")
    if group:
        base += (f" You are in the family group chat with {mom_name} (the mom) and your child. Reply only as "
                 f"yourself ({name}), in your own voice and perspective; do not speak for {mom_name}.")
    return base + care_ctx


def build_messages(persona: str, text: str, history: List[dict], care: dict, group: bool,
                   settings: dict) -> List[dict]:
    care_ctx = care_context_text(care)
    if persona == "mom":
        system = mom_system(care_ctx, group, settings["mom_name"], settings["mom_warmth"], settings["dad_name"])
    else:
        system = dad_system(care_ctx, group, settings["dad_name"], settings["dad_warmth"], settings["mom_name"])
    out = [{"role": "system", "content": system}]
    for m in history[-16:]:
        sender = m.get("sender")
        content = (m.get("text") or "")[:2000]
        if not content:
            continue
        if sender == "user":
            out.append({"role": "user", "content": content})
        elif sender == persona:
            out.append({"role": "assistant", "content": content})
        else:
            label = settings["dad_name"] if sender == "dad" else settings["mom_name"]
            out.append({"role": "user", "content": f"[{label}]: {content}"})
    out.append({"role": "user", "content": text})
    return out


def complete(persona: str, messages: List[dict]) -> str:
    if _openai is None:
        return FALLBACK[persona]
    try:
        resp = _openai.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            max_completion_tokens=400,
        )
        return (resp.choices[0].message.content or "").strip() or FALLBACK[persona]
    except Exception as exc:  # noqa: BLE001 - external boundary, degrade gracefully
        logger.error("OpenAI chat error (%s): %s", persona, exc)
        return FALLBACK[persona]


# ---------------------------------------------------------------------------
# Care storage
# ---------------------------------------------------------------------------
async def get_or_create_care(user_id: str, day: str) -> dict:
    doc = await db.care_logs.find_one({"user_id": user_id, "date": day})
    if not doc:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "date": day,
            "meals": [],
            "water_glasses": 0,
            "water_goal": 8,
            "slept_well": None,
            "sleep_hours": None,
            "updated_at": now_iso(),
        }
        await db.care_logs.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ChatIn(BaseModel):
    conversation: Literal["mom", "dad", "family"]
    text: str = Field(min_length=1, max_length=4000)
    user_id: str = DEMO_USER


class WaterIn(BaseModel):
    delta: int
    user_id: str = DEMO_USER


class MealIn(BaseModel):
    label: str
    user_id: str = DEMO_USER


class SleepIn(BaseModel):
    slept_well: bool
    hours: Optional[float] = None
    user_id: str = DEMO_USER


class ProfileIn(BaseModel):
    name: str
    user_id: str = DEMO_USER


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "My Fam API", "voice_enabled": _openai is not None}


@api_router.get("/profile")
async def get_profile(user_id: str = DEMO_USER):
    p = await db.profiles.find_one({"user_id": user_id})
    if not p:
        p = {"user_id": user_id, "name": "friend", "created_at": now_iso()}
        await db.profiles.insert_one(dict(p))
    return {"name": p.get("name", "friend")}


@api_router.post("/profile")
async def set_profile(payload: ProfileIn):
    name = (payload.name or "").strip()[:40] or "friend"
    await db.profiles.update_one({"user_id": payload.user_id}, {"$set": {"name": name}}, upsert=True)
    return {"name": name}


@api_router.get("/care")
async def get_care(user_id: str = DEMO_USER):
    care = await get_or_create_care(user_id, today_str())
    return clean_care(care)


@api_router.post("/care/water")
async def care_water(payload: WaterIn):
    day = today_str()
    care = await get_or_create_care(payload.user_id, day)
    new_val = max(0, min(12, care.get("water_glasses", 0) + payload.delta))
    await db.care_logs.update_one(
        {"user_id": payload.user_id, "date": day},
        {"$set": {"water_glasses": new_val, "updated_at": now_iso()}},
    )
    care["water_glasses"] = new_val
    return clean_care(care)


@api_router.post("/care/meal")
async def care_meal(payload: MealIn):
    day = today_str()
    care = await get_or_create_care(payload.user_id, day)
    meals = care.get("meals", [])
    labels = [m["label"] for m in meals]
    if payload.label in labels:
        meals = [m for m in meals if m["label"] != payload.label]  # toggle off
    else:
        meals = meals + [{"label": payload.label, "time": now_iso()}]
    await db.care_logs.update_one(
        {"user_id": payload.user_id, "date": day},
        {"$set": {"meals": meals, "updated_at": now_iso()}},
    )
    care["meals"] = meals
    return clean_care(care)


@api_router.post("/care/sleep")
async def care_sleep(payload: SleepIn):
    day = today_str()
    await get_or_create_care(payload.user_id, day)
    await db.care_logs.update_one(
        {"user_id": payload.user_id, "date": day},
        {"$set": {"slept_well": payload.slept_well, "sleep_hours": payload.hours, "updated_at": now_iso()}},
    )
    care = await get_or_create_care(payload.user_id, day)
    return clean_care(care)


@api_router.get("/messages")
async def get_messages(conversation: str, user_id: str = DEMO_USER):
    docs = await db.messages.find(
        {"user_id": user_id, "conversation": conversation}
    ).sort("created_at", 1).to_list(500)
    return {"messages": [clean_msg(d) for d in docs]}


@api_router.get("/conversations")
async def get_conversations(user_id: str = DEMO_USER):
    out = []
    for conv in ["mom", "dad", "family"]:
        doc = await db.messages.find(
            {"user_id": user_id, "conversation": conv}
        ).sort("created_at", -1).limit(1).to_list(1)
        last = doc[0] if doc else None
        out.append({
            "conversation": conv,
            "last_text": last["text"] if last else "",
            "last_sender": last["sender"] if last else "",
            "last_time": last["created_at"] if last else None,
            "unread": bool(last and last["sender"] != "user"),
        })
    return {"conversations": out}


@api_router.get("/home")
async def get_home(user_id: str = DEMO_USER):
    prof = await get_profile(user_id)
    care = await get_or_create_care(user_id, today_str())
    convs = (await get_conversations(user_id))["conversations"]
    return {
        "name": prof["name"],
        "settings": await load_settings(user_id),
        "care": clean_care(care),
        "conversations": convs,
    }


@api_router.post("/chat")
async def chat(payload: ChatIn):
    day = today_str()
    care = await get_or_create_care(payload.user_id, day)
    settings = await load_settings(payload.user_id)
    history = await db.messages.find(
        {"user_id": payload.user_id, "conversation": payload.conversation}
    ).sort("created_at", 1).to_list(200)

    await db.messages.insert_one(dict(mk_message(payload.user_id, payload.conversation, "user", payload.text)))

    replies = []
    if payload.conversation == "family":
        mom_text = await run_in_threadpool(
            complete, "mom", build_messages("mom", payload.text, history, care, True, settings))
        dad_text = await run_in_threadpool(
            complete, "dad", build_messages("dad", payload.text, history, care, True, settings))
        mm = mk_message(payload.user_id, "family", "mom", mom_text)
        dm = mk_message(payload.user_id, "family", "dad", dad_text)
        await db.messages.insert_many([dict(mm), dict(dm)])
        replies = [clean_msg(mm), clean_msg(dm)]
    else:
        persona = payload.conversation
        text = await run_in_threadpool(
            complete, persona, build_messages(persona, payload.text, history, care, False, settings))
        rm = mk_message(payload.user_id, persona, persona, text)
        await db.messages.insert_one(dict(rm))
        replies = [clean_msg(rm)]

    return {"replies": replies}


@api_router.get("/tts")
async def tts(persona: str, text: str, voice: Optional[str] = None):
    if persona not in PERSONAS:
        raise HTTPException(400, "unknown persona")
    text = (text or "").strip()[:1000]
    if not text:
        raise HTTPException(400, "empty text")
    if _openai is None:
        raise HTTPException(503, "voice unavailable")
    cfg = PERSONAS[persona]
    settings = await load_settings(DEMO_USER)
    chosen = voice if voice in VOICES else settings["mom_voice" if persona == "mom" else "dad_voice"]

    def synth() -> bytes:
        r = _openai.audio.speech.create(
            model=TTS_MODEL,
            voice=chosen,
            input=text,
            instructions=cfg["tts_instructions"],
            response_format="mp3",
        )
        return r.content

    try:
        audio = await run_in_threadpool(synth)
    except Exception as exc:  # noqa: BLE001
        logger.error("TTS error: %s", exc)
        raise HTTPException(502, "tts failed")
    return Response(content=audio, media_type="audio/mpeg")


@api_router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if _openai is None:
        raise HTTPException(503, "voice unavailable")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "audio too large")
    fname = file.filename or "recording.m4a"
    ctype = file.content_type or "audio/m4a"

    def run():
        return _openai.audio.transcriptions.create(
            model=STT_MODEL,
            file=(fname, data, ctype),
            response_format="json",
        )

    try:
        res = await run_in_threadpool(run)
    except Exception as exc:  # noqa: BLE001
        logger.error("STT error: %s", exc)
        raise HTTPException(502, "transcription failed")
    return {"text": getattr(res, "text", "") or ""}


# ---------------------------------------------------------------------------
# Family settings, daily check-in, and saved notes
# ---------------------------------------------------------------------------
def clean_note(n: dict) -> dict:
    return {
        "id": n["id"],
        "conversation": n["conversation"],
        "sender": n["sender"],
        "text": n["text"],
        "message_id": n["message_id"],
        "created_at": n["created_at"],
        "saved_at": n["saved_at"],
    }


def checkin_prompts(settings: dict) -> tuple:
    h = datetime.now(timezone.utc).hour
    part = "Morning" if h < 12 else "Afternoon" if h < 18 else "Evening"
    who = settings["user_name"]
    mom_prompt = f"{part}, {who}. Did you manage to sleep okay, sweetheart?"
    dad_prompt = "Have you eaten something yet today, kiddo?"
    return mom_prompt, dad_prompt


class SettingsIn(BaseModel):
    user_name: Optional[str] = None
    mom_name: Optional[str] = None
    dad_name: Optional[str] = None
    mom_warmth: Optional[str] = None
    dad_warmth: Optional[str] = None
    mom_voice: Optional[str] = None
    dad_voice: Optional[str] = None
    user_id: str = DEMO_USER


class CheckinIn(BaseModel):
    response: str
    user_id: str = DEMO_USER


class NoteIn(BaseModel):
    conversation: str
    sender: str
    text: str
    message_id: str
    created_at: Optional[str] = None
    user_id: str = DEMO_USER


@api_router.get("/settings")
async def get_settings(user_id: str = DEMO_USER):
    return await load_settings(user_id)


@api_router.post("/settings")
async def update_settings(payload: SettingsIn):
    updates: dict = {}
    if payload.user_name is not None:
        updates["name"] = payload.user_name.strip()[:40] or "friend"
    if payload.mom_name is not None:
        updates["mom_name"] = payload.mom_name.strip()[:20] or "Mom"
    if payload.dad_name is not None:
        updates["dad_name"] = payload.dad_name.strip()[:20] or "Dad"
    if payload.mom_warmth in WARMTH:
        updates["mom_warmth"] = payload.mom_warmth
    if payload.dad_warmth in WARMTH:
        updates["dad_warmth"] = payload.dad_warmth
    if payload.mom_voice in VOICES:
        updates["mom_voice"] = payload.mom_voice
    if payload.dad_voice in VOICES:
        updates["dad_voice"] = payload.dad_voice
    if updates:
        await db.profiles.update_one({"user_id": payload.user_id}, {"$set": updates}, upsert=True)
    return await load_settings(payload.user_id)


@api_router.get("/checkin")
async def get_checkin(user_id: str = DEMO_USER):
    day = today_str()
    settings = await load_settings(user_id)
    doc = await db.checkins.find_one({"user_id": user_id, "date": day})
    mom_prompt, dad_prompt = checkin_prompts(settings)
    return {
        "date": day,
        "responded": bool(doc and doc.get("responded")),
        "response": (doc or {}).get("response"),
        "mom_prompt": mom_prompt,
        "dad_prompt": dad_prompt,
        "mom_name": settings["mom_name"],
        "dad_name": settings["dad_name"],
    }


@api_router.post("/checkin/respond")
async def respond_checkin(payload: CheckinIn):
    day = today_str()
    await db.checkins.update_one(
        {"user_id": payload.user_id, "date": day},
        {"$set": {"responded": True, "response": payload.response[:200], "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/notes")
async def get_notes(user_id: str = DEMO_USER):
    docs = await db.notes.find(
        {"user_id": user_id, "deleted_at": None}
    ).sort("saved_at", -1).to_list(200)
    return {"notes": [clean_note(d) for d in docs]}


@api_router.post("/notes")
async def add_note(payload: NoteIn):
    if payload.sender not in ("mom", "dad"):
        raise HTTPException(400, "only parent messages can be saved")
    existing = await db.notes.find_one(
        {"user_id": payload.user_id, "message_id": payload.message_id, "deleted_at": None})
    if existing:
        return clean_note(existing)
    note = {
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "conversation": payload.conversation,
        "sender": payload.sender,
        "text": payload.text,
        "message_id": payload.message_id,
        "created_at": payload.created_at or now_iso(),
        "saved_at": now_iso(),
        "deleted_at": None,
    }
    await db.notes.insert_one(dict(note))
    return clean_note(note)


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user_id: str = DEMO_USER):
    await db.notes.update_one(
        {"user_id": user_id, "id": note_id},
        {"$set": {"deleted_at": now_iso()}},
    )
    return {"ok": True}


class ReactionIn(BaseModel):
    conversation: str
    message_id: str
    emoji: str = "\u2764\ufe0f"
    user_id: str = DEMO_USER


@api_router.get("/reactions")
async def get_reactions(conversation: str, user_id: str = DEMO_USER):
    docs = await db.reactions.find(
        {"user_id": user_id, "conversation": conversation, "active": True}
    ).to_list(500)
    return {"reactions": [{"message_id": d["message_id"], "emoji": d.get("emoji", "\u2764\ufe0f")} for d in docs]}


@api_router.post("/reactions/toggle")
async def toggle_reaction(payload: ReactionIn):
    doc = await db.reactions.find_one({"user_id": payload.user_id, "message_id": payload.message_id})
    if doc:
        same = bool(doc.get("active")) and doc.get("emoji") == payload.emoji
        new_active = not same  # re-picking the same emoji clears it; a new emoji replaces it
        await db.reactions.update_one(
            {"_id": doc["_id"]},
            {"$set": {"active": new_active, "emoji": payload.emoji, "updated_at": now_iso()}},
        )
        return {"message_id": payload.message_id, "reacted": new_active, "emoji": payload.emoji}
    await db.reactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "conversation": payload.conversation,
        "message_id": payload.message_id,
        "emoji": payload.emoji,
        "active": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    return {"message_id": payload.message_id, "reacted": True, "emoji": payload.emoji}


# ---------------------------------------------------------------------------
# Seed a warm, believable demo on first boot (idempotent)
# ---------------------------------------------------------------------------
async def seed_demo():
    if not await db.profiles.find_one({"user_id": DEMO_USER}):
        await db.profiles.insert_one({"user_id": DEMO_USER, "name": "Alex", "created_at": now_iso()})

    care = await get_or_create_care(DEMO_USER, today_str())
    if (not care.get("seeded") and care.get("water_glasses", 0) == 0
            and not care.get("meals") and care.get("slept_well") is None):
        await db.care_logs.update_one(
            {"user_id": DEMO_USER, "date": today_str()},
            {"$set": {
                "water_glasses": 3,
                "meals": [{"label": "Breakfast", "time": now_iso()}],
                "slept_well": True,
                "sleep_hours": 7.0,
                "seeded": True,
                "updated_at": now_iso(),
            }},
        )

    if await db.messages.count_documents({"user_id": DEMO_USER}) == 0:
        base = datetime.now(timezone.utc) - timedelta(hours=3)

        def ts(mins):
            return (base + timedelta(minutes=mins)).isoformat()

        seeds = [
            ("mom", "mom", "Good morning, sweetheart \u2600\ufe0f Did you sleep okay?", 0),
            ("mom", "user", "Morning mom! Slept alright, just a bit tired", 4),
            ("mom", "mom", "Aw honey. Have a proper breakfast and a big glass of water for me, okay? \U0001F49B", 6),
            ("dad", "dad", "Morning, kiddo. How's the week shaping up?", 10),
            ("dad", "user", "Busy. Lots going on at work", 14),
            ("dad", "dad", "One thing at a time. Write down your top 3 for today and knock 'em out. You've got this.", 16),
            ("family", "user", "Miss you both \u2764\ufe0f", 30),
            ("family", "mom", "We miss you too, my love. So much.", 31),
            ("family", "dad", "Miss you kiddo. When are you visiting? The fridge is fully stocked \U0001F604", 33),
        ]
        docs = [{
            "id": str(uuid.uuid4()),
            "user_id": DEMO_USER,
            "conversation": conv,
            "sender": sender,
            "text": text,
            "created_at": ts(m),
        } for conv, sender, text, m in seeds]
        await db.messages.insert_many(docs)


@app.on_event("startup")
async def on_startup():
    try:
        await seed_demo()
    except Exception as exc:  # noqa: BLE001
        logger.error("seed error: %s", exc)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
