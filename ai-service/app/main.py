"""TalentBridge AI service (FastAPI).

Endpoints
  GET  /health              service status
  POST /market/process      run the market CSV pipeline on a file the backend saved
  POST /explain/learning    wording for a learning plan (Gemini optional, deterministic fallback)
  POST /explain/match       wording for a match explanation (Gemini optional, deterministic fallback)
"""
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

load_dotenv()

from . import explain  # noqa: E402
from .market import process_csv  # noqa: E402
from .skills import DICTIONARY  # noqa: E402

app = FastAPI(title="TalentBridge AI Service", version="1.0.0")
ROOT = Path(__file__).resolve().parents[2]
ALLOWED = [Path(p).resolve() for p in os.getenv("MARKET_ALLOWED_DIRS", "").split(",") if p.strip()] or [
    Path(tempfile.gettempdir()).resolve(), (ROOT / "data").resolve()]


def check_token(token: str | None):
    expected = os.getenv("AI_SERVICE_TOKEN")
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="Invalid service token")


@app.get("/health")
def health():
    import spacy
    return {"status": "ok", "gemini": explain.gemini_enabled(), "spacy": spacy.__version__, "skills": len(DICTIONARY)}


class MarketReq(BaseModel):
    path: str = Field(..., max_length=1000)


@app.post("/market/process")
def market_process(req: MarketReq, x_service_token: str | None = Header(default=None)):
    check_token(x_service_token)
    p = Path(req.path).resolve()
    if not any(p == d or d in p.parents for d in ALLOWED):
        raise HTTPException(status_code=403, detail="Path is outside the allowed upload directories")
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        return process_csv(str(p))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class LearningReq(BaseModel):
    skill: str = Field(..., max_length=80)
    currentLevel: int = Field(..., ge=0, le=5)
    targetLevel: int = Field(..., ge=1, le=5)
    context: str = Field("your target role", max_length=200)
    critical: bool = False


@app.post("/explain/learning")
def explain_learning(req: LearningReq, x_service_token: str | None = Header(default=None)):
    check_token(x_service_token)
    return explain.learning_text(req.skill, req.currentLevel, req.targetLevel, req.context, req.critical)


class MatchReq(BaseModel):
    name: str = Field(..., max_length=120)
    project: str = Field(..., max_length=200)
    summary: str = Field(..., max_length=1000)
    strengths: list[str] = Field(default_factory=list, max_length=20)
    concerns: list[str] = Field(default_factory=list, max_length=20)


@app.post("/explain/match")
def explain_match(req: MatchReq, x_service_token: str | None = Header(default=None)):
    check_token(x_service_token)
    return explain.match_text(req.name, req.project, req.summary, req.strengths, req.concerns)
