import hashlib
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import monotonic
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from rest_framework.decorators import api_view
from rest_framework.response import Response


CACHE_TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 9
MAX_JOBS_PER_SOURCE = 150

_cache = {"expires_at": 0.0, "payload": None}
_cache_lock = threading.Lock()

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0 Safari/537.36 RevnivoJobs/1.0"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

JOB_SOURCES = [
    {
        "key": "alignerr",
        "name": "Alignerr",
        "listing_url": "https://www.alignerr.com/jobs",
        "browse_url": "https://www.alignerr.com/jobs",
        "host": "alignerr.com",
        "mode": "anchors",
        "href_contains": ["/jobs/"],
        "exclude_paths": ["/jobs", "/jobs/"],
        "description": "Expert and general AI training roles from Alignerr.",
    },
    {
        "key": "outlier",
        "name": "Outlier",
        "listing_url": "https://app.outlier.ai/opportunities",
        "browse_url": "https://app.outlier.ai/opportunities",
        "host": "outlier.ai",
        "mode": "anchors",
        "href_contains": ["/opportunities/", "/experts/"],
        "exclude_paths": ["/opportunities", "/opportunities/"],
        "description": "Remote AI evaluation, coding, language, and specialist work.",
    },
    {
        "key": "afterquery",
        "name": "AfterQuery Experts",
        "listing_url": "https://experts.afterquery.com/apply",
        "browse_url": "https://experts.afterquery.com/apply",
        "host": "afterquery.com",
        "mode": "anchors",
        "href_contains": ["/apply/"],
        "exclude_paths": ["/apply", "/apply/"],
        "description": "Remote expert work creating and evaluating frontier AI training data.",
    },
    {
        "key": "dataannotation",
        "name": "DataAnnotation",
        "listing_url": "https://www.dataannotation.tech/",
        "browse_url": "https://www.dataannotation.tech/",
        "host": "dataannotation.tech",
        "mode": "salary_anchors",
        "href_contains": ["/"],
        "exclude_paths": ["/"],
        "description": "Remote generalist, coding, language, and domain-expert AI training roles.",
    },
    {
        "key": "mindrift",
        "name": "Mindrift",
        "listing_url": "https://mindrift.ai/apply",
        "browse_url": "https://mindrift.ai/apply",
        "host": "mindrift.ai",
        "mode": "opportunity_text",
        "href_contains": ["/apply", "/project/", "/opportunities"],
        "exclude_paths": ["/apply"],
        "description": "Project-based AI training opportunities across many expert domains.",
    },
    {
        "key": "crowdgen",
        "name": "CrowdGen by Appen",
        "listing_url": "https://crowdgen.com/home/",
        "browse_url": "https://crowdgen.com/",
        "host": "crowdgen.com",
        "mode": "project_anchors",
        "href_contains": ["/"],
        "exclude_paths": ["/", "/home/"],
        "description": "AI data, evaluation, annotation, language, and expert projects.",
    },
    {
        "key": "telus",
        "name": "TELUS Digital AI Community",
        "listing_url": "https://jobs.telusdigital.com/search/jobs",
        "browse_url": "https://jobs.telusdigital.com/search/jobs",
        "host": "jobs.telusdigital.com",
        "mode": "telus",
        "href_contains": ["/job/", "/jobs/"],
        "exclude_paths": ["/search/jobs", "/jobs/search"],
        "description": "AI Community and artificial-intelligence openings from TELUS Digital.",
    },
    {
        "key": "stellar",
        "name": "Stellar AI",
        "listing_url": "https://joinstellar.ai/apply/",
        "browse_url": "https://joinstellar.ai/apply/",
        "host": "joinstellar.ai",
        "mode": "anchors",
        "href_contains": ["/apply/"],
        "exclude_paths": ["/apply", "/apply/"],
        "description": "Flexible AI training and coding-agent evaluation contracts.",
    },
    {
        "key": "oneforma",
        "name": "OneForma",
        "listing_url": "",
        "browse_url": "https://www.oneforma.com/jobs/",
        "host": "oneforma.com",
        "mode": "directory",
        "href_contains": [],
        "exclude_paths": [],
        "description": "Profile-matched AI data, language, annotation, and evaluation projects.",
    },
    {
        "key": "prolific",
        "name": "Prolific Expert Network",
        "listing_url": "",
        "browse_url": "https://www.prolific.com/expert-network",
        "host": "prolific.com",
        "mode": "directory",
        "href_contains": [],
        "exclude_paths": [],
        "description": "Expert and AI-tasker studies matched inside a verified participant account.",
    },
    {
        "key": "lxt",
        "name": "LXT",
        "listing_url": "",
        "browse_url": "https://www.lxt.ai/jobs/",
        "host": "lxt.ai",
        "mode": "directory",
        "href_contains": [],
        "exclude_paths": [],
        "description": "Flexible AI data collection, labeling, and transcription opportunities.",
    },
]

SALARY_RE = re.compile(
    r"(?:up to\s*)?\$\s?[\d,.]+(?:\s*(?:-|–|to)\s*\$?\s?[\d,.]+)?\+?"
    r"(?:\s*(?:USD)?\s*/\s*(?:hr|hour))?",
    re.IGNORECASE,
)
HOURLY_RE = re.compile(
    r"\$\s?[\d,.]+(?:\s*(?:-|–|to)\s*\$?\s?[\d,.]+)?\+?\s*/\s*(?:hr|hour)",
    re.IGNORECASE,
)
EMPLOYMENT_RE = re.compile(
    r"\b(full[- ]?time|part[- ]?time|contract|freelance|intern(?:ship)?|temporary)\b",
    re.IGNORECASE,
)


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def safe_url(base_url, href):
    value = clean_text(href)
    if not value or value.startswith(("javascript:", "mailto:", "#")):
        return ""
    result = urljoin(base_url, value)
    parsed = urlparse(result)
    if parsed.scheme not in {"http", "https"}:
        return ""
    return result


def job_id(source_key, title, url):
    raw = f"{source_key}|{title}|{url}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]


def extract_pay(text):
    match = HOURLY_RE.search(text) or SALARY_RE.search(text)
    return clean_text(match.group(0)) if match else ""


def detect_remote(text):
    lowered = text.lower()
    return "remote" in lowered or "work from home" in lowered


def detect_employment(text):
    match = EMPLOYMENT_RE.search(text)
    if not match:
        return ""
    value = match.group(1).lower().replace("-", " ")
    if value.startswith("intern"):
        return "Internship"
    return value.title()


def detect_category(title):
    lowered = title.lower()
    categories = [
        ("Coding", ["software", "developer", "engineer", "coding", "python", "javascript", "programmer"]),
        ("Languages", ["language", "linguist", "bilingual", "translator", "translation", "localization", "arabic", "english", "french", "spanish", "german", "chinese", "japanese", "korean"]),
        ("STEM", ["math", "physics", "chem", "biology", "scientist", "research", "statistics", "medical", "physician", "doctor"]),
        ("Finance", ["finance", "account", "audit", "bank", "investment", "insurance", "tax"]),
        ("Legal", ["legal", "law", "attorney", "compliance"]),
        ("Creative", ["design", "writer", "editor", "content", "video", "marketing"]),
        ("AI Training", ["ai trainer", "annotat", "evaluator", "reviewer", "labeler", "rater"]),
    ]
    for category, keywords in categories:
        if any(keyword in lowered for keyword in keywords):
            return category
    return "Other"


def looks_like_job_text(text):
    lowered = text.lower()
    if len(text) < 8 or len(text) > 650:
        return False

    negative = [
        "privacy policy",
        "terms of",
        "cookie",
        "sign in",
        "log in",
        "learn more",
        "view all",
        "about us",
        "contact us",
        "frequently asked",
    ]
    if any(term in lowered for term in negative):
        return False

    positive = [
        "expert",
        "engineer",
        "trainer",
        "evaluator",
        "specialist",
        "annotator",
        "reviewer",
        "research",
        "developer",
        "writer",
        "designer",
        "analyst",
        "scientist",
        "linguist",
        "transcription",
        "project",
    ]
    return any(term in lowered for term in positive)


def title_from_text(text):
    value = clean_text(text)
    value = re.sub(r"\bApply(?: now)?\b.*$", "", value, flags=re.IGNORECASE).strip(" -–|")
    pay = extract_pay(value)
    if pay:
        value = value.replace(pay, " ").strip()
    value = re.sub(
        r"\b(Remote|Contract|Freelance|Full[- ]?time|Part[- ]?time|Intern(?:ship)?)\b.*$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" -–|")
    if len(value) > 160:
        value = value[:157].rstrip() + "..."
    return value


def make_job(source, title, url, raw_text="", location="", pay="", employment_type=""):
    title = clean_text(title)
    raw_text = clean_text(raw_text)
    if not title:
        return None

    return {
        "id": job_id(source["key"], title, url),
        "platform": source["name"],
        "platform_key": source["key"],
        "title": title,
        "url": url or source["browse_url"],
        "location": clean_text(location) or ("Remote" if detect_remote(raw_text) else ""),
        "remote": detect_remote(raw_text) or clean_text(location).lower() == "remote",
        "pay": clean_text(pay) or extract_pay(raw_text),
        "employment_type": clean_text(employment_type) or detect_employment(raw_text),
        "category": detect_category(title),
        "summary": raw_text[:320],
    }


def parse_anchor_jobs(source, soup):
    jobs = []
    seen = set()

    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "")
        url = safe_url(source["listing_url"], href)
        if not url:
            continue

        parsed = urlparse(url)
        path = parsed.path or "/"
        if path in source.get("exclude_paths", []):
            continue

        if source["href_contains"] and not any(
            token in href or token in path
            for token in source["href_contains"]
        ):
            continue

        text = clean_text(anchor.get_text(" ", strip=True))
        parent_text = clean_text(
            anchor.parent.get_text(" ", strip=True)
            if anchor.parent
            else text
        )
        candidate_text = parent_text if len(parent_text) <= 650 else text

        if source["mode"] == "salary_anchors":
            if not extract_pay(candidate_text) and not looks_like_job_text(text):
                continue
        elif source["mode"] == "project_anchors":
            if "project" not in candidate_text.lower() and not looks_like_job_text(text):
                continue
        elif source["mode"] == "telus":
            if not looks_like_job_text(text):
                continue
        elif not looks_like_job_text(text):
            continue

        title = title_from_text(text or candidate_text)
        if not title or len(title) < 5:
            continue

        key = (title.lower(), url)
        if key in seen:
            continue
        seen.add(key)

        item = make_job(source, title, url, candidate_text)
        if item:
            jobs.append(item)

        if len(jobs) >= MAX_JOBS_PER_SOURCE:
            break

    return jobs


def parse_text_opportunities(source, soup):
    jobs = parse_anchor_jobs(source, soup)
    if jobs:
        return jobs

    # Some project boards render role text with the Apply button separated from
    # the title. Look for compact text blocks containing a pay rate and an
    # opportunity-shaped title. These fall back to the platform browse URL.
    seen = set()
    for tag in soup.find_all(["article", "li", "div"]):
        text = clean_text(tag.get_text(" ", strip=True))
        if len(text) < 12 or len(text) > 420:
            continue
        if not extract_pay(text) or not looks_like_job_text(text):
            continue

        title = title_from_text(text)
        if not title or title.lower() in seen:
            continue

        seen.add(title.lower())
        item = make_job(source, title, source["browse_url"], text)
        if item:
            jobs.append(item)
        if len(jobs) >= MAX_JOBS_PER_SOURCE:
            break

    return jobs


def fetch_source(source):
    if source["mode"] == "directory":
        return {
            **source,
            "status": "directory",
            "jobs": [],
            "error": "",
        }

    try:
        response = requests.get(
            source["listing_url"],
            headers=REQUEST_HEADERS,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        if source["mode"] == "opportunity_text":
            jobs = parse_text_opportunities(source, soup)
        else:
            jobs = parse_anchor_jobs(source, soup)

        return {
            **source,
            "status": "live" if jobs else "browse",
            "jobs": jobs,
            "error": "",
        }
    except requests.RequestException as exc:
        return {
            **source,
            "status": "unavailable",
            "jobs": [],
            "error": exc.__class__.__name__,
        }


def build_jobs_payload():
    source_results = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(fetch_source, source): source
            for source in JOB_SOURCES
        }
        for future in as_completed(futures):
            source_results.append(future.result())

    source_order = {
        source["key"]: index
        for index, source in enumerate(JOB_SOURCES)
    }
    source_results.sort(
        key=lambda item: source_order[item["key"]]
    )

    jobs = []
    sources = []
    seen = set()

    for source in source_results:
        for item in source["jobs"]:
            duplicate_key = (
                item["platform_key"],
                item["title"].lower(),
                item["url"],
            )
            if duplicate_key in seen:
                continue
            seen.add(duplicate_key)
            jobs.append(item)

        sources.append(
            {
                "key": source["key"],
                "name": source["name"],
                "browse_url": source["browse_url"],
                "description": source["description"],
                "status": source["status"],
                "job_count": len(source["jobs"]),
                "error": source["error"],
            }
        )

    jobs.sort(
        key=lambda item: (
            item["platform"].lower(),
            item["title"].lower(),
        )
    )

    return {
        "jobs": jobs,
        "sources": sources,
        "total": len(jobs),
        "live_sources": sum(
            1
            for source in sources
            if source["status"] == "live"
        ),
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
    }


@api_view(["GET"])
def jobs_feed(request):
    force_refresh = str(
        request.query_params.get("refresh", "")
    ).lower() in {"1", "true", "yes"}

    now = monotonic()
    with _cache_lock:
        if (
            not force_refresh
            and _cache["payload"] is not None
            and now < _cache["expires_at"]
        ):
            return Response(
                {
                    **_cache["payload"],
                    "cached": True,
                }
            )

    payload = build_jobs_payload()

    with _cache_lock:
        _cache["payload"] = payload
        _cache["expires_at"] = monotonic() + CACHE_TTL_SECONDS

    return Response(
        {
            **payload,
            "cached": False,
        }
    )
