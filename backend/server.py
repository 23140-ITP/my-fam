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


def mom_system(care_ctx: str, group: bool) -> str:
    base = (
        "You are Mom in a private family messaging app called My Fam. You are texting your grown-up child who "
        "lives far from home and misses you. You are warm, deeply caring, nurturing and emotionally supportive. "
        "You gently check whether they've eaten, had enough water and slept, and you comfort and reassure them. "
        "Use natural, affectionate texting language and occasional loving nicknames like 'sweetheart', 'honey' or "
        "'my love' (not in every message). Text the way a real mom texts: warm and short, 1-3 sentences. Use at "
        "most one emoji, and only when it feels natural. Never say you are an AI or a language model unless the "
        "user directly asks."
    )
    if group:
        base += (" You are in the family group chat with Dad and your child. Reply only as yourself (Mom), in your "
                 "own voice and perspective; do not speak for Dad.")
    return base + care_ctx


def dad_system(care_ctx: str, group: bool) -> str:
    base = (
        "You are Dad in a private family messaging app called My Fam. You are texting your grown-up child who "
        "lives far from home. You are practical, direct, encouraging and lightly humorous. You give clear advice "
        "and concrete, actionable next steps, and you sneak in the occasional gentle dad joke. Text the way a real "
        "dad texts: grounded and short, 1-3 sentences. Rarely use emojis. Never say you are an AI or a language "
        "model unless the user directly asks."
    )
    if group:
        base += (" You are in the family group chat with Mom and your child. Reply only as yourself (Dad), in your "
                 "own voice and perspective; do not speak for Mom.")
    return base + care_ctx


def build_messages(persona: str, text: str, history: List[dict], care: dict, group: bool) -> List[dict]:
    care_ctx = care_context_text(care)
    system = mom_system(care_ctx, group) if persona == "mom" else dad_system(care_ctx, group)
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
            label = "Dad" if sender == "dad" else "Mom"
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
    return {"name": prof["name"], "care": clean_care(care), "conversations": convs}


@api_router.post("/chat")
async def chat(payload: ChatIn):
    day = today_str()
    care = await get_or_create_care(payload.user_id, day)
    history = await db.messages.find(
        {"user_id": payload.user_id, "conversation": payload.conversation}
    ).sort("created_at", 1).to_list(200)

    await db.messages.insert_one(dict(mk_message(payload.user_id, payload.conversation, "user", payload.text)))

    replies = []
    if payload.conversation == "family":
        mom_text = await run_in_threadpool(
            complete, "mom", build_messages("mom", payload.text, history, care, group=True))
        dad_text = await run_in_threadpool(
            complete, "dad", build_messages("dad", payload.text, history, care, group=True))
        mm = mk_message(payload.user_id, "family", "mom", mom_text)
        dm = mk_message(payload.user_id, "family", "dad", dad_text)
        await db.messages.insert_many([dict(mm), dict(dm)])
        replies = [clean_msg(mm), clean_msg(dm)]
    else:
        persona = payload.conversation
        text = await run_in_threadpool(
            complete, persona, build_messages(persona, payload.text, history, care, group=False))
        rm = mk_message(payload.user_id, persona, persona, text)
        await db.messages.insert_one(dict(rm))
        replies = [clean_msg(rm)]

    return {"replies": replies}


@api_router.get("/tts")
async def tts(persona: str, text: str):
    if persona not in PERSONAS:
        raise HTTPException(400, "unknown persona")
    text = (text or "").strip()[:1000]
    if not text:
        raise HTTPException(400, "empty text")
    if _openai is None:
        raise HTTPException(503, "voice unavailable")
    cfg = PERSONAS[persona]

    def synth() -> bytes:
        r = _openai.audio.speech.create(
            model=TTS_MODEL,
            voice=cfg["voice"],
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
