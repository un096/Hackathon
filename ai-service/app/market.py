"""Market pipeline: ingestion -> cleaning -> skill extraction -> normalisation -> demand analytics (+ optional forecast)."""
from collections import Counter

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from .skills import extract

COLS = {
    "id": ["job_link", "job_id", "id", "url"],
    "title": ["job_title", "title", "position"],
    "company": ["company", "company_name", "employer"],
    "location": ["job_location", "location", "city"],
    "country": ["search_country", "country"],
    "level": ["job_level", "seniority", "level"],
    "type": ["job_type", "work_type", "employment_type"],
    "date": ["first_seen", "posted_at", "date_posted", "date", "posted"],
    "skills": ["job_skills", "skills", "skill_list"],
}
MIN_WEEKS_FOR_FORECAST = 8


def _resolve(columns):
    lower = {c.lower().strip(): c for c in columns}
    out = {}
    for key, names in COLS.items():
        out[key] = next((lower[n] for n in names if n in lower), None)
    return out


def forecast(postings):
    """Weekly linear-trend forecast per skill, only if the data spans >= MIN_WEEKS_FOR_FORECAST weeks."""
    rows = [(p["postedAt"], s["slug"]) for p in postings if p["postedAt"] for s in p["skills"]]
    if not rows:
        return [], "No posting dates available; forecasting disabled."
    df = pd.DataFrame(rows, columns=["date", "slug"])
    df["week"] = pd.to_datetime(df["date"]).dt.to_period("W").dt.start_time
    weeks = sorted(df["week"].unique())
    if len(weeks) < MIN_WEEKS_FOR_FORECAST:
        span = (pd.to_datetime(df["date"]).max() - pd.to_datetime(df["date"]).min()).days + 1
        return [], f"Not enough history to forecast: {span}-day span ({len(weeks)} week(s)); at least {MIN_WEEKS_FOR_FORECAST} weeks required."
    out = []
    top = df["slug"].value_counts().head(10).index
    for slug in top:
        series = df[df.slug == slug].groupby("week").size().reindex(weeks, fill_value=0)
        X = np.arange(len(series)).reshape(-1, 1)
        model = LinearRegression().fit(X, series.values)
        for h in range(1, 5):
            pred = max(0.0, float(model.predict([[len(series) - 1 + h]])[0]))
            period = (weeks[-1] + pd.Timedelta(weeks=h)).strftime("%Y-%m-%d")
            out.append({"slug": slug, "period": period, "count": round(pred, 1)})
    return out, "Weekly linear-trend forecast (scikit-learn LinearRegression), 4 weeks ahead."


def process_csv(path: str):
    rows_read = 0
    dropped = 0
    seen = set()
    postings = []
    unmatched = Counter()
    for chunk in pd.read_csv(path, chunksize=20000, dtype=str, keep_default_na=False, on_bad_lines="skip"):
        cols = _resolve(chunk.columns)
        if not cols["title"] or not cols["skills"]:
            raise ValueError("CSV must contain a job title column and a skills column (e.g. job_title, job_skills)")
        rows_read += len(chunk)
        # Cleaning
        chunk = chunk.apply(lambda c: c.str.strip())
        for _, r in chunk.iterrows():
            title = r[cols["title"]]
            skills = r[cols["skills"]]
            ext_id = (r[cols["id"]] if cols["id"] else "") or f"row-{rows_read}-{_}"
            if not title or not skills or ext_id in seen:
                dropped += 1
                continue
            seen.add(ext_id)
            found, miss = extract(skills, title)
            unmatched.update(miss)
            date = r[cols["date"]] if cols["date"] else ""
            dt = pd.to_datetime(date, errors="coerce") if date else pd.NaT
            postings.append({
                "externalId": ext_id[:500], "title": title[:300],
                "company": (r[cols["company"]][:200] if cols["company"] else None) or None,
                "location": (r[cols["location"]][:200] if cols["location"] else None) or None,
                "country": (r[cols["country"]] if cols["country"] else None) or None,
                "jobLevel": (r[cols["level"]] if cols["level"] else None) or None,
                "jobType": (r[cols["type"]] if cols["type"] else None) or None,
                "postedAt": None if pd.isna(dt) else dt.strftime("%Y-%m-%dT00:00:00.000Z"),
                "skills": [{"slug": s, "raw": raw[:200]} for s, raw in found.items()],
            })
    fc, note = forecast(postings)
    return {
        "rowsRead": rows_read, "rowsDropped": dropped, "postings": postings,
        "unmatchedTop": [{"term": t, "count": c} for t, c in unmatched.most_common(25)],
        "forecast": fc, "forecastNote": note, "extractor": "spaCy PhraseMatcher + curated dictionary",
    }
