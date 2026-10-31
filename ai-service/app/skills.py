"""Curated skill dictionary + spaCy PhraseMatcher based extractor/normaliser."""
import json
import os
import re
from pathlib import Path

import spacy
from spacy.matcher import PhraseMatcher

ROOT = Path(__file__).resolve().parents[2]
DICT_PATH = Path(os.getenv("SKILL_DICTIONARY_PATH", ROOT / "shared" / "skill_dictionary.json"))

with open(DICT_PATH, encoding="utf-8") as f:
    DICTIONARY = json.load(f)

ALIAS_TO_SLUG = {a.lower(): d["slug"] for d in DICTIONARY for a in d["aliases"]}
SLUG_TO_NAME = {d["slug"]: d["name"] for d in DICTIONARY}

# Blank English pipeline: tokenizer only (no model download needed), fast and deterministic.
nlp = spacy.blank("en")
matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
for slug in {d["slug"] for d in DICTIONARY}:
    aliases = [a for d in DICTIONARY if d["slug"] == slug for a in d["aliases"]]
    matcher.add(slug, [nlp.make_doc(a) for a in aliases])

# Very short / ambiguous aliases are only accepted as a whole comma-separated token, never inside text.
AMBIGUOUS = {"go", "ml", "js", "ts", "qa", "iac", "c#", "rest", "security", "architecture", "testing", "spring", "node"}
_clean_re = re.compile(r"\(.*?\)")


def normalise_token(t: str) -> str:
    t = _clean_re.sub("", t.lower())
    t = re.sub(r"[^a-z0-9+#./ -]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def extract(skills_text: str, title: str):
    """Return ({slug: raw_text}, [unmatched tokens])."""
    found = {}
    unmatched = []
    for tok in re.split(r"[,;|]", skills_text or ""):
        n = normalise_token(tok)
        if not n:
            continue
        if n in ALIAS_TO_SLUG:
            found.setdefault(ALIAS_TO_SLUG[n], tok.strip())
            continue
        doc = nlp.make_doc(n)
        hits = [(nlp.vocab.strings[mid], doc[s:e].text) for mid, s, e in matcher(doc)]
        hits = [(slug, txt) for slug, txt in hits if txt.lower() not in AMBIGUOUS]
        if hits:
            for slug, _ in hits:
                found.setdefault(slug, tok.strip())
        else:
            unmatched.append(n)
    tdoc = nlp.make_doc(title or "")
    for mid, s, e in matcher(tdoc):
        txt = tdoc[s:e].text.lower()
        if txt in AMBIGUOUS or len(txt) < 3 and txt not in {"aws", "gcp", "sql", "c++"}:
            continue
        found.setdefault(nlp.vocab.strings[mid], f"title:{txt}")
    return found, unmatched
