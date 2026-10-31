"""Natural-language explanations. Gemini is optional and only rewrites wording of facts
computed by the deterministic engines; it never decides levels, rankings or deployments."""
import os

import httpx

LEVELS = {0: "Not verified", 1: "Beginner", 2: "Elementary", 3: "Intermediate", 4: "Advanced", 5: "Expert"}


def gemini_enabled() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def _gemini(prompt: str) -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    try:
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3, "maxOutputTokens": 220}},
            timeout=8.0,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        return text or None
    except Exception:  # network/quota errors -> deterministic fallback
        return None


def learning_text(skill, current, target, context, critical):
    rules = (
        f"Your verified {skill} level is L{current} ({LEVELS.get(current)}); {context} needs L{target} ({LEVELS.get(target)}). "
        f"Close the {target - current}-level gap with the practical tasks below, then re-take the {skill} assessment so your Skill Passport can verify the new level."
    )
    prompt = (
        "You are a concise engineering career coach. In at most 3 sentences, explain to an employee why this learning plan matters "
        "and how to approach it. Do not invent numbers, courses or deadlines beyond the facts given.\n"
        f"Facts: skill={skill}; verified level=L{current}; required level=L{target}; context={context}; critical requirement={critical}."
    )
    g = _gemini(prompt)
    return {"text": g, "source": "gemini"} if g else {"text": rules, "source": "rules"}


def match_text(name, project, summary, strengths, concerns):
    rules = summary
    prompt = (
        "Rewrite this talent-matching result as a short, neutral paragraph (max 4 sentences) for a hiring manager. "
        "Use only the facts listed; do not add opinions, rankings or recommendations beyond them.\n"
        f"Candidate: {name}. Project: {project}. Summary: {summary}. Strengths: {'; '.join(strengths)}. Concerns: {'; '.join(concerns)}."
    )
    g = _gemini(prompt)
    return {"text": g, "source": "gemini"} if g else {"text": rules, "source": "rules"}
