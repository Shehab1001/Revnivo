import hashlib
import html
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import monotonic
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response


CACHE_TTL_SECONDS = 30 * 60
REQUEST_TIMEOUT_SECONDS = 12
MAX_JOBS_PER_SOURCE = 10000
BULK_PAGE_SIZE = 100
MAX_BULK_PAGES = 150
MAX_TELUS_PAGES = 12

_cache = {"expires_at": 0.0, "payload": None}
_cache_lock = threading.Lock()
_source_results_cache = {}
_sync_state = {
    "refreshing": False,
    "started_at": 0.0,
    "completed_sources": 0,
    "total_sources": 0,
    "last_error": "",
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

JOB_SOURCES = [
    {
        "key": "alignerr",
        "name": "Alignerr",
        "listing_url": "https://www.alignerr.com/jobs",
        "browse_url": "https://www.alignerr.com/jobs",
        "mode": "alignerr",
        "detail_url_template": "https://www.alignerr.com/jobs/{id}",
        "description": "All public expert and AI training roles Revnivo can retrieve from Alignerr.",
    },
    {
        "key": "mercor",
        "name": "Mercor",
        "listing_url": "https://work.mercor.com/explore",
        "browse_url": "https://work.mercor.com/explore",
        "mode": "mercor",
        "api_url": "https://aws.api.mercor.com/work/listings-explore-page",
        "description": "Public project-based and talent-network opportunities from Mercor.",
    },
    {
        "key": "turing",
        "name": "Turing",
        "listing_url": "https://work.turing.com/jobs?sort=recommended",
        "browse_url": "https://work.turing.com/jobs?sort=recommended",
        "mode": "bulk_public",
        "description": "Public software, AI, science, business, finance, healthcare, and expert roles from Turing.",
    },
    {
        "key": "micro1",
        "name": "micro1",
        "listing_url": "https://www.micro1.ai/experts/opportunities",
        "browse_url": "https://www.micro1.ai/experts/opportunities",
        "mode": "micro1",
        "api_url": "https://public.api.micro1.ai/jobs",
        "description": "Public AI training opportunities from micro1 across expert domains.",
    },
    {
        "key": "outlier",
        "name": "Outlier",
        "listing_url": "https://app.outlier.ai/opportunities",
        "browse_url": "https://app.outlier.ai/opportunities",
        "mode": "public_page",
        "detail_url_template": "https://app.outlier.ai/opportunities/{id}",
        "description": "Public remote AI evaluation, coding, language, and specialist opportunities.",
    },
    {
        "key": "afterquery_experts",
        "name": "AfterQuery Experts",
        "listing_url": "https://experts.afterquery.com/apply",
        "browse_url": "https://experts.afterquery.com/apply",
        "mode": "public_page",
        "detail_url_template": "https://experts.afterquery.com/apply/{id}",
        "description": "Public expert opportunities exposed by the AfterQuery Experts application site.",
    },
    {
        "key": "afterquery_careers",
        "name": "AfterQuery Careers",
        "listing_url": "https://www.afterquery.com/careers",
        "browse_url": "https://www.afterquery.com/careers",
        "mode": "ashby",
        "api_url": "https://api.ashbyhq.com/posting-api/job-board/AfterQuery",
        "description": "Open engineering, research, operations, and business roles at AfterQuery.",
    },
    {
        "key": "dataannotation",
        "name": "DataAnnotation",
        "listing_url": "https://www.dataannotation.tech/",
        "browse_url": "https://www.dataannotation.tech/",
        "mode": "public_page",
        "description": "Public generalist, coding, language, and domain-expert AI training roles.",
    },
    {
        "key": "mindrift",
        "name": "Mindrift",
        "listing_url": "https://mindrift.ai/apply",
        "browse_url": "https://mindrift.ai/apply",
        "mode": "public_page",
        "description": "Public project-based AI training opportunities across expert domains.",
    },
    {
        "key": "crowdgen",
        "name": "CrowdGen by Appen",
        "listing_url": "https://crowdgen.com/home/",
        "extra_urls": [
            "https://crowdgen.com/experts/",
        ],
        "browse_url": "https://crowdgen.com/",
        "mode": "public_page",
        "description": "Public AI data, evaluation, annotation, language, and expert projects.",
    },
    {
        "key": "telus",
        "name": "TELUS Digital AI",
        "listing_url": (
            "https://jobs.telusdigital.com/search/jobs"
            "?cfm5=AI%20Community&ns_category=ai-community"
        ),
        "browse_url": (
            "https://jobs.telusdigital.com/search/jobs"
            "?cfm5=AI%20Community&ns_category=ai-community"
        ),
        "mode": "telus",
        "description": "AI Community and artificial-intelligence openings from TELUS Digital.",
    },
    {
        "key": "stellar",
        "name": "Stellar AI",
        "listing_url": "https://joinstellar.ai/apply/",
        "browse_url": "https://joinstellar.ai/apply/",
        "mode": "public_page",
        "description": "Public flexible AI training and software evaluation contracts.",
    },
    {
        "key": "oneforma",
        "name": "OneForma",
        "listing_url": "",
        "browse_url": "https://www.oneforma.com/jobs/",
        "mode": "account_only",
        "description": "Jobs are matched after sign-in using profile, country, language, and qualifications.",
    },
    {
        "key": "prolific",
        "name": "Prolific Expert Network",
        "listing_url": "https://www.prolific.com/expert-network",
        "browse_url": "https://www.prolific.com/expert-network",
        "mode": "public_page",
        "description": "Public example expert roles plus account-matched AI studies and tasks.",
    },
    {
        "key": "lxt",
        "name": "LXT",
        "listing_url": "https://www.lxt.ai/jobs/",
        "browse_url": "https://www.lxt.ai/jobs/",
        "mode": "public_page",
        "description": "AI data careers and contributor opportunities, including crowd work through partners.",
    },
]

SALARY_RE = re.compile(
    r"(?:up\s+to\s*)?"
    r"(?:USD\s*)?[\$£€]\s?[\d,.]+"
    r"(?:\s*(?:-|–|—|to)\s*(?:USD\s*)?[\$£€]?\s?[\d,.]+)?"
    r"\+?"
    r"(?:\s*(?:USD)?\s*/?\s*(?:hr|hour|day|task|project))?",
    re.IGNORECASE,
)
EMPLOYMENT_RE = re.compile(
    r"\b(full[- ]?time|part[- ]?time|contract|contractor|freelance|"
    r"intern(?:ship)?|temporary|project[- ]?based|hourly)\b",
    re.IGNORECASE,
)
JOB_PATH_RE = re.compile(
    r"/(?:jobs?|opportunities|positions?|careers?|apply)/[^/?#]+",
    re.IGNORECASE,
)
ID_RE = re.compile(r"^[0-9a-f-]{8,}$", re.IGNORECASE)

JOB_WORDS = {
    "accountant",
    "analyst",
    "annotator",
    "architect",
    "attorney",
    "auditor",
    "biologist",
    "chemist",
    "coder",
    "coding",
    "consultant",
    "contractor",
    "designer",
    "developer",
    "doctor",
    "editor",
    "educator",
    "engineer",
    "evaluator",
    "expert",
    "generalist",
    "intern",
    "lawyer",
    "linguist",
    "manager",
    "mathematician",
    "nurse",
    "physician",
    "rater",
    "researcher",
    "reviewer",
    "scientist",
    "specialist",
    "trainer",
    "transcriptionist",
    "translator",
    "writer",
}

NEGATIVE_TITLE_WORDS = {
    "about",
    "blog",
    "cookie",
    "faq",
    "home",
    "learn more",
    "login",
    "log in",
    "privacy",
    "sign in",
    "terms",
    "view all",
}


def clean_text(value):
    value = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", value).strip()


def strip_html(value):
    return clean_text(re.sub(r"<[^>]+>", " ", str(value or "")))


def safe_url(base_url, href):
    value = clean_text(href)
    if not value or value.startswith(("javascript:", "mailto:", "tel:", "#")):
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
    match = SALARY_RE.search(clean_text(text))
    return clean_text(match.group(0)) if match else ""


def detect_remote(text):
    lowered = clean_text(text).lower()
    return any(
        marker in lowered
        for marker in (
            "remote",
            "work from home",
            "work from anywhere",
            "fully remote",
        )
    )


def detect_employment(text):
    match = EMPLOYMENT_RE.search(clean_text(text))
    if not match:
        return ""

    value = match.group(1).lower().replace("-", " ")
    if value.startswith("intern"):
        return "Internship"
    if value == "contractor":
        return "Contract"
    if value == "project based":
        return "Project-based"
    return value.title()


def detect_category(title):
    lowered = clean_text(title).lower()
    categories = [
        (
            "Coding",
            [
                "software",
                "developer",
                "engineer",
                "coding",
                "python",
                "javascript",
                "programmer",
                "devops",
                "frontend",
                "backend",
                "machine learning",
            ],
        ),
        (
            "Languages",
            [
                "language",
                "linguist",
                "bilingual",
                "translator",
                "translation",
                "localization",
                "transcription",
                "arabic",
                "english",
                "french",
                "spanish",
                "german",
                "chinese",
                "japanese",
                "korean",
                "hindi",
                "portuguese",
            ],
        ),
        (
            "STEM",
            [
                "math",
                "physics",
                "chem",
                "biology",
                "scientist",
                "research",
                "statistics",
                "medical",
                "physician",
                "doctor",
                "nurse",
            ],
        ),
        (
            "Finance",
            [
                "finance",
                "account",
                "audit",
                "bank",
                "investment",
                "insurance",
                "tax",
                "trader",
                "equity",
                "portfolio",
            ],
        ),
        (
            "Legal",
            [
                "legal",
                "law",
                "attorney",
                "compliance",
                "paralegal",
                "counsel",
            ],
        ),
        (
            "Creative",
            [
                "design",
                "writer",
                "editor",
                "content",
                "video",
                "marketing",
            ],
        ),
        (
            "AI Training",
            [
                "ai trainer",
                "annotat",
                "evaluator",
                "reviewer",
                "labeler",
                "rater",
                "data analyst",
                "internet assessor",
            ],
        ),
    ]

    for category, keywords in categories:
        if any(keyword in lowered for keyword in keywords):
            return category
    return "Other"


def looks_like_title(text):
    value = clean_text(text)
    lowered = value.lower()

    if len(value) < 4 or len(value) > 180:
        return False
    if lowered in NEGATIVE_TITLE_WORDS:
        return False
    if any(lowered.startswith(prefix) for prefix in ("copyright", "©", "http")):
        return False

    words = set(re.findall(r"[a-z]+", lowered))
    return bool(words & JOB_WORDS)


def normalize_title(value):
    title = clean_text(value)
    if not title:
        return ""

    pay = extract_pay(title)
    if pay:
        title = clean_text(title.replace(pay, " "))

    title = re.sub(
        r"\b(?:Apply(?: now)?|View details?|View role|Learn more)\b.*$",
        "",
        title,
        flags=re.IGNORECASE,
    )
    title = re.sub(
        r"\b(?:Remote|Full[- ]?time|Part[- ]?time|Freelance|Contract)\b\s*$",
        "",
        title,
        flags=re.IGNORECASE,
    )
    title = title.strip(" -–—|•·")
    return title[:180]


def make_job(
    source,
    title,
    url,
    raw_text="",
    location="",
    pay="",
    employment_type="",
    category="",
):
    title = normalize_title(title)
    raw_text = clean_text(raw_text)

    if not title:
        return None

    resolved_url = safe_url(
        source.get("listing_url") or source["browse_url"],
        url,
    ) or source["browse_url"]

    location = clean_text(location)
    remote = detect_remote(
        " ".join([title, raw_text, location])
    )

    if not location and remote:
        location = "Remote"

    return {
        "id": job_id(source["key"], title, resolved_url),
        "platform": source["name"],
        "platform_key": source["key"],
        "title": title,
        "url": resolved_url,
        "location": location,
        "remote": remote,
        "pay": clean_text(pay) or extract_pay(raw_text),
        "employment_type": (
            clean_text(employment_type)
            or detect_employment(raw_text)
        ),
        "category": clean_text(category) or detect_category(title),
        "summary": raw_text[:420],
    }


def flatten_json(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from flatten_json(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from flatten_json(nested)


def parse_jobposting_json(source, soup):
    jobs = []

    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue

        try:
            payload = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue

        for item in flatten_json(payload):
            raw_type = item.get("@type")
            types = (
                raw_type
                if isinstance(raw_type, list)
                else [raw_type]
            )
            if "JobPosting" not in types:
                continue

            location = ""
            job_location = item.get("jobLocation")
            if isinstance(job_location, list):
                job_location = job_location[0] if job_location else None
            if isinstance(job_location, dict):
                address = job_location.get("address") or {}
                if isinstance(address, dict):
                    location = ", ".join(
                        clean_text(address.get(key))
                        for key in (
                            "addressLocality",
                            "addressRegion",
                            "addressCountry",
                        )
                        if clean_text(address.get(key))
                    )

            description = strip_html(
                item.get("description")
                or item.get("qualifications")
                or ""
            )
            pay = ""
            salary = item.get("baseSalary")
            if isinstance(salary, dict):
                value = salary.get("value")
                if isinstance(value, dict):
                    minimum = value.get("minValue")
                    maximum = value.get("maxValue")
                    unit = value.get("unitText")
                    currency = salary.get("currency") or "USD"
                    if minimum is not None or maximum is not None:
                        bounds = (
                            f"{minimum}-{maximum}"
                            if minimum is not None and maximum is not None
                            else str(minimum if minimum is not None else maximum)
                        )
                        pay = f"{currency} {bounds}"
                        if unit:
                            pay += f"/{clean_text(unit).lower()}"

            job = make_job(
                source,
                item.get("title") or item.get("name"),
                item.get("url") or source["browse_url"],
                description,
                location=location,
                pay=pay,
                employment_type=item.get("employmentType") or "",
            )
            if job:
                jobs.append(job)

    return jobs


def object_title(item):
    for key in (
        "jobTitle",
        "job_title",
        "listingTitle",
        "title",
        "positionTitle",
        "roleTitle",
        "displayName",
        "name",
    ):
        value = item.get(key)
        if isinstance(value, str) and looks_like_title(value):
            return value
    return ""


def object_identifier(item):
    for key in (
        "opportunityId",
        "listingId",
        "jobId",
        "job_id",
        "postingId",
        "positionId",
        "uuid",
        "id",
    ):
        value = item.get(key)
        if isinstance(value, (str, int)):
            value = clean_text(value)
            if value and len(value) >= 4:
                return value
    return ""


def object_url(source, item):
    for key in (
        "applyUrl",
        "applicationUrl",
        "jobUrl",
        "job_apply_url",
        "listingUrl",
        "externalUrl",
        "url",
        "href",
    ):
        value = item.get(key)
        if isinstance(value, str):
            resolved = safe_url(
                source.get("listing_url") or source["browse_url"],
                value,
            )
            if resolved:
                return resolved

    identifier = object_identifier(item)
    template = source.get("detail_url_template")
    if identifier and template:
        return template.format(id=identifier)

    return source["browse_url"]


def object_blob(item):
    pieces = []

    for key in (
        "description",
        "job_description",
        "descriptionPlain",
        "summary",
        "subtitle",
        "location",
        "locationName",
        "workplace",
        "skill",
        "category",
        "listingDomain",
        "commitment",
        "employmentType",
        "compensation",
        "pay",
        "rate",
        "rateMin",
        "rateMax",
        "payRateFrequency",
    ):
        value = item.get(key)
        if isinstance(value, str):
            pieces.append(strip_html(value))
        elif isinstance(value, (int, float)):
            pieces.append(str(value))

    return clean_text(" ".join(pieces))


def parse_embedded_json(source, soup):
    jobs = []
    seen_objects = set()

    scripts = soup.select(
        'script#__NEXT_DATA__, '
        'script[type="application/json"], '
        'script[data-hypernova-key], '
        'script[data-state]'
    )

    for script in scripts:
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw or len(raw) > 20_000_000:
            continue

        try:
            payload = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue

        for item in flatten_json(payload):
            title = object_title(item)
            if not title:
                continue

            fingerprint = (
                title.lower(),
                object_identifier(item),
            )
            if fingerprint in seen_objects:
                continue

            blob = object_blob(item)
            key_text = " ".join(
                str(key).lower()
                for key in item.keys()
            )
            looks_job_object = any(
                marker in key_text
                for marker in (
                    "job",
                    "opportun",
                    "position",
                    "role",
                    "opening",
                    "compensation",
                    "salary",
                    "location",
                )
            )
            if not looks_job_object and not extract_pay(blob):
                continue

            seen_objects.add(fingerprint)

            location = clean_text(
                item.get("location")
                or item.get("locationName")
                or item.get("workplace")
                or ""
            )
            if isinstance(item.get("location"), dict):
                location = clean_text(
                    item["location"].get("name")
                    or item["location"].get("displayName")
                    or ""
                )

            pay = clean_text(
                item.get("pay")
                or item.get("rate")
                or item.get("compensation")
                or ""
            )
            if isinstance(
                item.get("compensation"),
                dict,
            ):
                pay = object_blob(
                    item["compensation"]
                )

            job = make_job(
                source,
                title,
                object_url(source, item),
                blob,
                location=location,
                pay=pay,
                employment_type=(
                    item.get("employmentType")
                    or item.get("type")
                    or ""
                ),
                category=(
                    item.get("category")
                    or item.get("skill")
                    or ""
                ),
            )
            if job:
                jobs.append(job)

    return jobs


def element_url(source, element):
    anchor = (
        element
        if getattr(element, "name", None) == "a"
        else element.find("a", href=True)
    )
    if anchor and anchor.get("href"):
        return safe_url(
            source.get("listing_url") or source["browse_url"],
            anchor.get("href"),
        )

    return source["browse_url"]


def title_from_element(element):
    selectors = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        '[class*="title"]',
        '[class*="name"]',
        "strong",
        "b",
    ]

    for selector in selectors:
        candidate = element.select_one(selector)
        if candidate:
            value = normalize_title(
                candidate.get_text(" ", strip=True)
            )
            if looks_like_title(value):
                return value

    if getattr(element, "name", None) == "a":
        value = normalize_title(
            element.get_text(" ", strip=True)
        )
        if looks_like_title(value):
            return value

    return ""


def infer_location(text):
    value = clean_text(text)

    if detect_remote(value):
        remote_match = re.search(
            r"Remote(?:\s*[-–—]\s*)?([^|•·$]{0,120})",
            value,
            flags=re.IGNORECASE,
        )
        if remote_match:
            tail = clean_text(remote_match.group(1))
            if tail and not extract_pay(tail):
                return f"Remote - {tail[:100]}"
        return "Remote"

    location_match = re.search(
        r"\b(?:Location|Based in)\s*[:\-]\s*([^|•·$]{2,100})",
        value,
        flags=re.IGNORECASE,
    )
    return (
        clean_text(location_match.group(1))
        if location_match
        else ""
    )


def parse_dom_cards(source, soup):
    jobs = []
    seen_nodes = set()

    selectors = [
        "article",
        "li",
        '[class*="job"]',
        '[class*="role"]',
        '[class*="position"]',
        '[class*="opening"]',
        '[class*="opportun"]',
        '[class*="project"]',
        '[class*="card"]',
    ]

    for element in soup.select(", ".join(selectors)):
        marker = id(element)
        if marker in seen_nodes:
            continue
        seen_nodes.add(marker)

        text = clean_text(
            element.get_text(" ", strip=True)
        )
        if len(text) < 8 or len(text) > 1200:
            continue

        title = title_from_element(element)
        pay = extract_pay(text)

        if not title:
            continue

        has_job_signal = (
            pay
            or detect_remote(text)
            or detect_employment(text)
            or "apply" in text.lower()
            or "view details" in text.lower()
        )
        if not has_job_signal:
            continue

        job = make_job(
            source,
            title,
            element_url(source, element),
            text,
            location=infer_location(text),
            pay=pay,
        )
        if job:
            jobs.append(job)

    return jobs


def parse_anchor_roles(source, soup):
    jobs = []

    for anchor in soup.find_all("a", href=True):
        text = clean_text(
            anchor.get_text(" ", strip=True)
        )
        if len(text) < 4 or len(text) > 600:
            continue

        href = str(anchor.get("href") or "")
        url = safe_url(
            source.get("listing_url") or source["browse_url"],
            href,
        )
        if not url:
            continue

        parent = anchor.parent
        parent_text = clean_text(
            parent.get_text(" ", strip=True)
            if parent
            else text
        )
        pay = extract_pay(parent_text)
        title = normalize_title(text)

        path_signal = bool(
            JOB_PATH_RE.search(
                urlparse(url).path or ""
            )
        )

        if not looks_like_title(title):
            if pay:
                title = normalize_title(
                    re.split(
                        SALARY_RE,
                        parent_text,
                        maxsplit=1,
                    )[0]
                )
            if not looks_like_title(title):
                continue

        if not (
            path_signal
            or pay
            or "apply" in parent_text.lower()
            or "remote" in parent_text.lower()
        ):
            continue

        job = make_job(
            source,
            title,
            url,
            parent_text,
            location=infer_location(parent_text),
            pay=pay,
        )
        if job:
            jobs.append(job)

    return jobs


def parse_text_salary_roles(source, soup):
    jobs = []

    for element in soup.find_all(
        ["article", "li", "div", "section"]
    ):
        text = clean_text(
            element.get_text(" ", strip=True)
        )
        if (
            len(text) < 12
            or len(text) > 700
            or not extract_pay(text)
        ):
            continue

        heading = title_from_element(element)
        if not heading:
            before_pay = SALARY_RE.split(
                text,
                maxsplit=1,
            )[0]
            words = before_pay.split()
            heading = normalize_title(
                " ".join(words[-12:])
            )

        if not looks_like_title(heading):
            continue

        job = make_job(
            source,
            heading,
            element_url(source, element),
            text,
            location=infer_location(text),
        )
        if job:
            jobs.append(job)

    return jobs


def dedupe_jobs(jobs, max_items=None):
    result = []
    seen = set()

    for job in jobs:
        title_key = re.sub(
            r"[^a-z0-9]+",
            " ",
            job["title"].lower(),
        ).strip()
        key = (
            job["platform_key"],
            title_key,
            job["url"],
        )

        if key in seen:
            continue
        seen.add(key)
        result.append(job)

        if max_items and len(result) >= max_items:
            break

    return result


def request_url(url, expect_json=False):
    response = requests.get(
        url,
        headers={
            **REQUEST_HEADERS,
            **(
                {"Accept": "application/json"}
                if expect_json
                else {}
            ),
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response


def parse_public_page(source, url):
    from bs4 import BeautifulSoup

    response = request_url(url)
    soup = BeautifulSoup(
        response.text,
        "html.parser",
    )

    jobs = []
    jobs.extend(
        parse_jobposting_json(source, soup)
    )
    jobs.extend(
        parse_embedded_json(source, soup)
    )
    jobs.extend(
        parse_dom_cards(source, soup)
    )
    jobs.extend(
        parse_anchor_roles(source, soup)
    )
    jobs.extend(
        parse_text_salary_roles(source, soup)
    )

    return dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)


def fetch_public_source(source):
    urls = [
        source["listing_url"],
        *source.get("extra_urls", []),
    ]
    jobs = []
    errors = []

    for url in urls:
        try:
            jobs.extend(
                parse_public_page(source, url)
            )
        except (
            requests.RequestException,
            ImportError,
            ValueError,
        ) as exc:
            errors.append(
                f"{urlparse(url).netloc}: {exc.__class__.__name__}"
            )

    jobs = dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)

    return {
        **source,
        "status": (
            "live"
            if jobs
            else (
                "unavailable"
                if errors and len(errors) == len(urls)
                else "browse"
            )
        ),
        "jobs": jobs,
        "error": "; ".join(errors),
    }


def fetch_ashby_source(source):
    try:
        response = request_url(
            source["api_url"],
            expect_json=True,
        )
        payload = response.json()
        jobs = []

        for item in payload.get("jobs", []):
            if item.get("isListed") is False:
                continue

            location = clean_text(
                item.get("location") or ""
            )
            description = strip_html(
                item.get("descriptionPlain")
                or item.get("descriptionHtml")
                or ""
            )
            category = clean_text(
                item.get("department")
                or item.get("team")
                or ""
            )

            job = make_job(
                source,
                item.get("title"),
                item.get("jobUrl")
                or item.get("applyUrl")
                or source["browse_url"],
                description,
                location=location,
                employment_type=(
                    item.get("employmentType")
                    or ""
                ),
                category=category,
            )
            if job:
                jobs.append(job)

        return {
            **source,
            "status": "live" if jobs else "browse",
            "jobs": dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE),
            "error": "",
        }
    except (
        requests.RequestException,
        ValueError,
        json.JSONDecodeError,
    ) as exc:
        return {
            **source,
            "status": "unavailable",
            "jobs": [],
            "error": exc.__class__.__name__,
        }


def telus_urls():
    bases = [
        (
            "https://jobs.telusdigital.com/search/jobs"
            "?cfm5=AI%20Community&ns_category=ai-community"
        ),
        (
            "https://jobs.telusdigital.com/search/jobs"
            "?ns_category=artificial-intelligence"
        ),
    ]

    urls = []
    for base in bases:
        urls.append(base)
        for page in range(2, MAX_TELUS_PAGES + 1):
            urls.append(f"{base}&page={page}")
    return urls


def fetch_telus_source(source):
    jobs = []
    errors = []
    empty_pages = 0

    for url in telus_urls():
        try:
            page_jobs = parse_public_page(
                source,
                url,
            )
            before = len(jobs)
            jobs.extend(page_jobs)
            jobs = dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)

            if len(jobs) == before:
                empty_pages += 1
            else:
                empty_pages = 0

            if empty_pages >= 3:
                # A category has likely run out of pagination results.
                # Continue scanning because the URL list also contains the
                # second AI category.
                empty_pages = 0
        except (
            requests.RequestException,
            ImportError,
            ValueError,
        ) as exc:
            errors.append(
                f"{url}: {exc.__class__.__name__}"
            )

    jobs = dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)

    return {
        **source,
        "status": (
            "live"
            if jobs
            else (
                "unavailable"
                if errors
                else "browse"
            )
        ),
        "jobs": jobs,
        "error": "; ".join(errors[:3]),
    }



def add_query_params(url, **params):
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in params.items():
        if value is None:
            query.pop(key, None)
        else:
            query[key] = str(value)
    return urlunparse(
        parsed._replace(query=urlencode(query))
    )


def extract_reported_total(text):
    value = clean_text(text)
    candidates = []

    patterns = [
        r"Showing\s+[\d,]+\s+of\s+([\d,]+)\s+roles",
        r"All\s+([\d,]+)\s+(?:roles|jobs)",
        r"All\s+([\d,]+)\s+Priority\b",
        r"([\d,]+)\s+(?:open\s+)?(?:roles|jobs)",
    ]

    for pattern in patterns:
        for match in re.finditer(
            pattern,
            value,
            flags=re.IGNORECASE,
        ):
            try:
                candidates.append(
                    int(match.group(1).replace(",", ""))
                )
            except (TypeError, ValueError):
                continue

    return max(candidates) if candidates else 0


def payload_reported_total(payload):
    keys = {
        "total",
        "totalCount",
        "total_count",
        "totalJobs",
        "total_jobs",
        "count",
    }
    candidates = []

    for item in flatten_json(payload):
        for key in keys:
            value = item.get(key)
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)) and value >= 0:
                candidates.append(int(value))
            elif isinstance(value, str) and value.replace(",", "").isdigit():
                candidates.append(
                    int(value.replace(",", ""))
                )

    return max(candidates) if candidates else 0


def structured_pay(item):
    minimum = item.get("rateMin")
    maximum = item.get("rateMax")
    frequency = clean_text(
        item.get("payRateFrequency")
        or item.get("rateFrequency")
        or ""
    ).lower()
    currency = clean_text(
        item.get("currency")
        or item.get("payCurrency")
        or "USD"
    ).upper()

    if minimum is None and maximum is None:
        return clean_text(
            item.get("pay")
            or item.get("compensation")
            or ""
        )

    if minimum is not None and maximum is not None:
        amount = (
            str(minimum)
            if str(minimum) == str(maximum)
            else f"{minimum}-{maximum}"
        )
    else:
        amount = str(
            minimum
            if minimum is not None
            else maximum
        )

    suffix = ""
    if frequency:
        aliases = {
            "hourly": "hr",
            "hour": "hr",
            "yearly": "yr",
            "annual": "yr",
            "task": "task",
            "project": "project",
        }
        suffix = f"/{aliases.get(frequency, frequency)}"

    symbol = "$" if currency == "USD" else f"{currency} "
    return f"{symbol}{amount}{suffix}"


def structured_location(item):
    location = item.get("location")
    if isinstance(location, str):
        return clean_text(location)

    if isinstance(location, dict):
        for key in (
            "displayName",
            "name",
            "formatted",
            "city",
        ):
            if clean_text(location.get(key)):
                return clean_text(location.get(key))

    for key in (
        "locationName",
        "workplace",
        "eligibleLocation",
        "eligibleLocations",
    ):
        value = item.get(key)
        if isinstance(value, str):
            return clean_text(value)
        if isinstance(value, list):
            names = [
                clean_text(
                    part.get("name")
                    if isinstance(part, dict)
                    else part
                )
                for part in value
            ]
            names = [
                name
                for name in names
                if name
            ]
            if names:
                return ", ".join(names[:4])

    return ""


def jobs_from_json_payload(source, payload):
    jobs = []
    seen_records = set()

    for item in flatten_json(payload):
        title = object_title(item)
        if not title:
            continue

        identifier = object_identifier(item)
        fingerprint = (
            title.lower(),
            identifier,
            clean_text(
                item.get("listingUrl")
                or item.get("job_apply_url")
                or item.get("jobUrl")
                or item.get("url")
                or ""
            ),
        )
        if fingerprint in seen_records:
            continue

        key_text = " ".join(
            str(key).lower()
            for key in item.keys()
        )
        if not any(
            marker in key_text
            for marker in (
                "job",
                "listing",
                "opportun",
                "position",
                "role",
                "salary",
                "rate",
                "compensation",
            )
        ):
            continue

        status_value = clean_text(
            item.get("job_status")
            or item.get("status")
            or ""
        ).lower()
        if status_value in {
            "closed",
            "inactive",
            "archived",
            "filled",
            "cancelled",
            "canceled",
        }:
            continue

        url = object_url(source, item)
        if (
            source["key"] == "mercor"
            and identifier
            and (
                not url
                or url == source["browse_url"]
            )
        ):
            url = (
                "https://work.mercor.com/jobs/"
                f"{identifier}"
            )

        blob = object_blob(item)
        category = clean_text(
            item.get("listingDomain")
            or item.get("department")
            or item.get("category")
            or item.get("skill")
            or ""
        )
        employment = clean_text(
            item.get("commitment")
            or item.get("employmentType")
            or item.get("employment_type")
            or ""
        )

        job = make_job(
            source,
            title,
            url,
            blob,
            location=structured_location(item),
            pay=structured_pay(item),
            employment_type=employment,
            category=category,
        )
        if job:
            jobs.append(job)
            seen_records.add(fingerprint)

    return dedupe_jobs(
        jobs,
        MAX_JOBS_PER_SOURCE,
    )


def discover_job_json_endpoints(base_url, raw_html):
    if not raw_html:
        return []

    decoded = raw_html.replace("\\/", "/")
    candidates = []

    absolute_pattern = re.compile(
        r'https?://[^"\'<>\\\s]+',
        re.IGNORECASE,
    )
    relative_pattern = re.compile(
        r'["\']((?:/api/|/v\d+/|/graphql)[^"\']+)["\']',
        re.IGNORECASE,
    )

    for match in absolute_pattern.finditer(decoded):
        candidates.append(
            match.group(0).rstrip("),;")
        )

    for match in relative_pattern.finditer(decoded):
        candidates.append(
            urljoin(base_url, match.group(1))
        )

    result = []
    seen = set()

    for candidate in candidates:
        lowered = candidate.lower()
        if not any(
            marker in lowered
            for marker in (
                "job",
                "role",
                "opportun",
                "listing",
                "position",
            )
        ):
            continue
        if any(
            lowered.endswith(ext)
            for ext in (
                ".js",
                ".css",
                ".png",
                ".jpg",
                ".jpeg",
                ".svg",
                ".webp",
            )
        ):
            continue

        candidate = html.unescape(candidate)
        if candidate in seen:
            continue
        seen.add(candidate)
        result.append(candidate)

        if len(result) >= 20:
            break

    return result


def discover_script_job_endpoints(base_url, soup):
    """Discover the public jobs endpoint used by modern Load More UIs."""
    script_urls = []
    for script in soup.find_all("script", src=True):
        src = safe_url(base_url, script.get("src"))
        if not src or src in script_urls:
            continue
        script_urls.append(src)
        if len(script_urls) >= 40:
            break

    endpoints = []
    seen = set()

    def add_endpoint(value):
        value = html.unescape(clean_text(value))
        value = value.replace("\\u002F", "/").replace("\\/", "/")
        if not value.startswith(("http://", "https://")):
            return
        lowered = value.lower()
        if not any(
            word in lowered
            for word in ("job", "role", "opportun", "listing", "position")
        ):
            return
        if value in seen:
            return
        seen.add(value)
        endpoints.append(value)

    for script_url in script_urls:
        try:
            response = requests.get(
                script_url,
                headers=REQUEST_HEADERS,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except requests.RequestException:
            continue

        if len(response.content) > 8_000_000:
            continue

        normalized = (
            response.text
            .replace("\\u002F", "/")
            .replace("\\/", "/")
        )

        api_hosts = set(
            match.group(0).rstrip("/")
            for match in re.finditer(
                r"https://[a-zA-Z0-9.-]+(?:alignerr|labelbox)[a-zA-Z0-9.-]*\.[a-zA-Z]{2,}",
                normalized,
            )
        )

        absolute_url_pattern = re.compile(
            r"""https?://[^"\'<>\s]+""",
            flags=re.IGNORECASE,
        )
        for match in absolute_url_pattern.finditer(normalized):
            add_endpoint(
                match.group(0).rstrip("),;}")
            )

        relative_pattern = re.compile(
            r"""["\']((?:/api/|/v\d+/|/public/|/jobs?|/roles?|/opportunities?)[^"\']*)["\']""",
            flags=re.IGNORECASE,
        )
        relative_paths = set(
            match.group(1)
            for match in relative_pattern.finditer(normalized)
            if any(
                word in match.group(1).lower()
                for word in ("job", "role", "opportun", "listing", "position")
            )
        )

        for path in relative_paths:
            add_endpoint(urljoin(base_url, path))
            for host in api_hosts:
                add_endpoint(
                    urljoin(host + "/", path.lstrip("/"))
                )

        if len(endpoints) >= 40:
            break

    return endpoints[:40]

def payload_next_cursor(payload):
    cursor_keys = {
        "nextCursor",
        "next_cursor",
        "nextPageToken",
        "next_page_token",
        "pageToken",
        "continuationToken",
        "continuation_token",
    }
    for item in flatten_json(payload):
        for key in cursor_keys:
            value = item.get(key)
            if isinstance(value, (str, int)) and clean_text(value):
                return clean_text(value)
    return ""


def discover_alignerr_openapi_endpoints():
    endpoints = []
    seen = set()
    specs = [
        "https://api.alignerr.com/openapi.json",
        "https://api.alignerr.com/swagger.json",
        "https://api.alignerr.com/api-docs",
        "https://api.alignerr.com/v1/openapi.json",
    ]

    for spec_url in specs:
        try:
            payload = request_json(spec_url)
        except (
            requests.RequestException,
            ValueError,
            json.JSONDecodeError,
        ):
            continue

        paths = payload.get("paths")
        if not isinstance(paths, dict):
            continue

        for path, operations in paths.items():
            if not isinstance(path, str):
                continue
            lowered = path.lower()
            if not any(
                word in lowered
                for word in ("job", "role", "opportun", "listing", "position")
            ):
                continue
            if isinstance(operations, dict) and "get" not in operations:
                continue

            endpoint = urljoin(
                "https://api.alignerr.com/",
                path.lstrip("/"),
            )
            if "{" in endpoint or endpoint in seen:
                continue
            seen.add(endpoint)
            endpoints.append(endpoint)

    return endpoints

def alignerr_fallback_endpoints():
    return [
        "https://api.alignerr.com/jobs",
        "https://api.alignerr.com/public/jobs",
        "https://api.alignerr.com/api/jobs",
        "https://api.alignerr.com/v1/jobs",
        "https://api.alignerr.com/roles",
        "https://api.alignerr.com/opportunities",
    ]

def request_json(url, *, method="get", params=None, body=None, headers=None):
    merged_headers = {
        **REQUEST_HEADERS,
        "Accept": "application/json",
        **(headers or {}),
    }

    if method == "post":
        response = requests.post(
            url,
            headers=merged_headers,
            params=params,
            json=body,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    else:
        response = requests.get(
            url,
            headers=merged_headers,
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    response.raise_for_status()
    return response.json()


def fetch_json_endpoint_pages(source, endpoint):
    all_jobs = []
    reported_total = 0

    # First try the endpoint exactly as published. Some public feeds return
    # their complete dataset without pagination parameters.
    try:
        payload = request_json(endpoint)
        all_jobs.extend(
            jobs_from_json_payload(
                source,
                payload,
            )
        )
        all_jobs = dedupe_jobs(
            all_jobs,
            MAX_JOBS_PER_SOURCE,
        )
        reported_total = max(
            reported_total,
            payload_reported_total(payload),
        )
    except (
        requests.RequestException,
        ValueError,
        json.JSONDecodeError,
    ):
        pass

    if reported_total and len(all_jobs) >= reported_total:
        return all_jobs, reported_total

    # Cursor pagination is common on modern React/Next.js job boards.
    cursor_jobs = []
    cursor = ""
    seen_cursors = set()
    for _ in range(MAX_BULK_PAGES):
        params = {"limit": 500}
        if cursor:
            params["cursor"] = cursor

        try:
            payload = request_json(
                endpoint,
                params=params,
            )
        except (
            requests.RequestException,
            ValueError,
            json.JSONDecodeError,
        ):
            break

        page_jobs = jobs_from_json_payload(
            source,
            payload,
        )
        reported_total = max(
            reported_total,
            payload_reported_total(payload),
        )

        before = len(cursor_jobs)
        cursor_jobs.extend(page_jobs)
        cursor_jobs = dedupe_jobs(
            cursor_jobs,
            MAX_JOBS_PER_SOURCE,
        )

        next_cursor = payload_next_cursor(payload)
        if reported_total and len(cursor_jobs) >= reported_total:
            break
        if not next_cursor or next_cursor in seen_cursors:
            break
        if len(cursor_jobs) == before and cursor:
            break

        seen_cursors.add(next_cursor)
        cursor = next_cursor

    if len(cursor_jobs) > len(all_jobs):
        all_jobs = cursor_jobs

    if reported_total and len(all_jobs) >= reported_total:
        return all_jobs, reported_total

    strategies = [
        lambda page: {"page": page, "limit": 1000},
        lambda page: {"page": page, "pageSize": 1000},
        lambda page: {"page": page, "perPage": 1000},
        lambda page: {"page": page, "per_page": 1000},
        lambda page: {"offset": (page - 1) * 1000, "limit": 1000},
        lambda page: {"skip": (page - 1) * 1000, "limit": 1000},
    ]

    for params_for_page in strategies:
        strategy_jobs = []
        no_growth = 0

        for page in range(1, MAX_BULK_PAGES + 1):
            try:
                payload = request_json(
                    endpoint,
                    params=params_for_page(page),
                )
            except (
                requests.RequestException,
                ValueError,
                json.JSONDecodeError,
            ):
                break

            page_jobs = jobs_from_json_payload(
                source,
                payload,
            )
            reported_total = max(
                reported_total,
                payload_reported_total(payload),
            )

            before = len(strategy_jobs)
            strategy_jobs.extend(page_jobs)
            strategy_jobs = dedupe_jobs(
                strategy_jobs,
                MAX_JOBS_PER_SOURCE,
            )

            if len(strategy_jobs) == before:
                no_growth += 1
            else:
                no_growth = 0

            if reported_total and len(strategy_jobs) >= reported_total:
                break
            if no_growth >= 2 or not page_jobs:
                break

        if len(strategy_jobs) > len(all_jobs):
            all_jobs = strategy_jobs

        if reported_total and len(all_jobs) >= reported_total:
            break

    return (
        dedupe_jobs(
            all_jobs,
            MAX_JOBS_PER_SOURCE,
        ),
        reported_total,
    )

def parse_public_response(source, response):
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(
        response.text,
        "html.parser",
    )
    jobs = []
    jobs.extend(
        parse_jobposting_json(source, soup)
    )
    jobs.extend(
        parse_embedded_json(source, soup)
    )
    jobs.extend(
        parse_dom_cards(source, soup)
    )
    jobs.extend(
        parse_anchor_roles(source, soup)
    )
    jobs.extend(
        parse_text_salary_roles(source, soup)
    )
    return (
        dedupe_jobs(
            jobs,
            MAX_JOBS_PER_SOURCE,
        ),
        soup,
    )


def nearest_embedded_string(window, center, keys):
    key_pattern = "|".join(re.escape(key) for key in keys)
    pattern = re.compile(
        rf'"(?:{key_pattern})"\s*:\s*"((?:\\.|[^"])*)"',
        flags=re.IGNORECASE,
    )
    candidates = []
    for match in pattern.finditer(window):
        value = clean_text(
            match.group(1)
            .replace("\\n", " ")
            .replace("\\t", " ")
            .replace("\\\"", '"')
        )
        if value:
            candidates.append(
                (
                    abs(match.start() - center),
                    value,
                )
            )
    if not candidates:
        return ""
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def parse_alignerr_embedded_jobs(source, raw_html):
    """Extract every job object serialized into Alignerr Next.js flight data."""
    if not raw_html:
        return []

    normalized = html.unescape(raw_html)
    normalized = (
        normalized
        .replace("\\u002F", "/")
        .replace("\\u002f", "/")
        .replace("\\u0022", '"')
        .replace("\\/", "/")
        .replace("\\\"", '"')
    )

    job_pattern = re.compile(
        r"/(?:en/)?jobs/([0-9a-f]{8}-[0-9a-f-]{20,})",
        flags=re.IGNORECASE,
    )
    jobs = []
    seen_ids = set()

    for match in job_pattern.finditer(normalized):
        identifier = match.group(1).lower()
        if identifier in seen_ids:
            continue

        start = max(0, match.start() - 6000)
        end = min(len(normalized), match.end() + 6000)
        window = normalized[start:end]
        center = match.start() - start

        title = nearest_embedded_string(
            window,
            center,
            (
                "jobTitle",
                "job_title",
                "title",
                "roleTitle",
                "name",
            ),
        )
        if not looks_like_title(title):
            continue

        description = nearest_embedded_string(
            window,
            center,
            (
                "description",
                "summary",
                "subtitle",
            ),
        )
        category = nearest_embedded_string(
            window,
            center,
            (
                "category",
                "jobCategory",
                "domain",
            ),
        )
        location = nearest_embedded_string(
            window,
            center,
            (
                "location",
                "locationName",
                "city",
            ),
        )

        context = clean_text(" ".join([title, description, window[:1500]]))
        job = make_job(
            source,
            title,
            f"https://www.alignerr.com/jobs/{identifier}",
            description or context,
            location=location or infer_location(context),
            pay=extract_pay(window),
            category=category,
        )
        if job:
            jobs.append(job)
            seen_ids.add(identifier)

    return dedupe_jobs(
        jobs,
        MAX_JOBS_PER_SOURCE,
    )

def parse_alignerr_raw_links(source, raw_html):
    """Fallback parser for SSR HTML when the DOM/card structure changes."""
    if not raw_html:
        return []

    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    soup = BeautifulSoup(raw_html, "html.parser")
    jobs = []
    seen = set()
    job_href = re.compile(
        r"/(?:[a-z]{2}/)?jobs/([0-9a-f]{8}-[0-9a-f-]{20,})",
        flags=re.IGNORECASE,
    )

    for anchor_tag in soup.find_all("a", href=True):
        href = clean_text(anchor_tag.get("href"))
        match = job_href.search(href)
        if not match:
            continue

        identifier = match.group(1).lower()
        if identifier in seen:
            continue

        # Look for the smallest surrounding card-like node with enough text.
        node = anchor_tag
        card_text = ""
        for _ in range(6):
            if node is None:
                break
            text_value = clean_text(node.get_text(" ", strip=True))
            if 8 <= len(text_value) <= 1200:
                card_text = text_value
            node = getattr(node, "parent", None)

        title = ""
        for candidate in (
            anchor_tag.select_one("h1"),
            anchor_tag.select_one("h2"),
            anchor_tag.select_one("h3"),
            anchor_tag.select_one("h4"),
            anchor_tag.select_one("strong"),
        ):
            if candidate:
                title = normalize_title(candidate.get_text(" ", strip=True))
                if title:
                    break

        if not title:
            title = normalize_title(anchor_tag.get_text(" ", strip=True))

        if not title:
            continue

        job = make_job(
            source,
            title,
            f"https://www.alignerr.com/jobs/{identifier}",
            card_text or title,
            location=infer_location(card_text),
            pay=extract_pay(card_text),
        )
        if job:
            jobs.append(job)
            seen.add(identifier)

    return dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)

def parse_alignerr_visible_jobs(source, soup):
    """Parse Alignerr cards directly; this guarantees the visible batch."""
    jobs = []
    seen = set()
    pattern = re.compile(
        r"/(?:en/)?jobs/([0-9a-f]{8}-[0-9a-f-]{20,})",
        flags=re.IGNORECASE,
    )

    for anchor in soup.find_all("a", href=True):
        href = clean_text(anchor.get("href"))
        match = pattern.search(href)
        if not match:
            continue

        identifier = match.group(1).lower()
        if identifier in seen:
            continue

        url = f"https://www.alignerr.com/jobs/{identifier}"

        # Alignerr cards may put title and metadata on nested elements or on
        # the entire link. Walk up a few levels to capture pay/remote text.
        candidates = []
        node = anchor
        for _ in range(4):
            if node is None:
                break
            text_value = clean_text(
                node.get_text(" ", strip=True)
            )
            if text_value:
                candidates.append(text_value)
            node = getattr(node, "parent", None)

        anchor_text = clean_text(
            anchor.get_text(" ", strip=True)
        )
        card_text = min(
            (text for text in candidates if len(text) >= len(anchor_text)),
            key=len,
            default=anchor_text,
        )

        title = ""
        for selector in ("h1", "h2", "h3", "h4", "h5", "strong", "b"):
            heading = anchor.select_one(selector)
            if heading:
                title = normalize_title(
                    heading.get_text(" ", strip=True)
                )
                if title:
                    break

        if not title:
            # On Alignerr the link text commonly starts with the role title.
            title = normalize_title(anchor_text)

        if not title:
            continue

        pay = extract_pay(card_text)
        location = infer_location(card_text)
        job = make_job(
            source,
            title,
            url,
            card_text,
            location=location,
            pay=pay,
        )
        if job:
            jobs.append(job)
            seen.add(identifier)

    return dedupe_jobs(jobs, MAX_JOBS_PER_SOURCE)


ALIGNERR_LINKEDIN_COMPANY_ID = "102053983"
ALIGNERR_LINKEDIN_BATCH_SIZE = 25
ALIGNERR_LINKEDIN_MAX_START = 7500
ALIGNERR_LINKEDIN_WORKERS = 10


def parse_linkedin_alignerr_jobs(source, html_text):
    """Parse public LinkedIn guest-search cards for the Alignerr company."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    soup = BeautifulSoup(html_text, "html.parser")
    jobs = []
    seen = set()

    cards = soup.select(
        "li, .base-card, .base-search-card, .job-search-card"
    )
    for card in cards:
        link = (
            card.select_one("a.base-card__full-link[href]")
            or card.select_one("a[href*=\"/jobs/view/\"]")
        )
        if not link:
            continue

        url = safe_url(
            "https://www.linkedin.com/",
            link.get("href"),
        )
        if not url:
            continue

        company_node = (
            card.select_one(".base-search-card__subtitle")
            or card.select_one("h4")
        )
        company = clean_text(
            company_node.get_text(" ", strip=True)
            if company_node
            else ""
        )
        if company and "alignerr" not in company.lower():
            continue

        title_node = (
            card.select_one(".base-search-card__title")
            or card.select_one("h3")
            or link
        )
        title = clean_text(
            title_node.get_text(" ", strip=True)
            if title_node
            else ""
        )
        if not title:
            continue

        location_node = (
            card.select_one(".job-search-card__location")
            or card.select_one("[class*=location]")
        )
        location = clean_text(
            location_node.get_text(" ", strip=True)
            if location_node
            else ""
        )

        salary_node = (
            card.select_one(".job-search-card__salary-info")
            or card.select_one("[class*=salary]")
        )
        salary = clean_text(
            salary_node.get_text(" ", strip=True)
            if salary_node
            else ""
        )

        card_text = clean_text(
            card.get_text(" ", strip=True)
        )
        job = make_job(
            source,
            title,
            url,
            card_text,
            location=location,
            pay=salary or extract_pay(card_text),
        )
        if not job:
            continue

        # LinkedIn view URLs can contain tracking parameters. The numeric
        # job id is the stable identity for de-duplication.
        match = re.search(r"/jobs/view/(?:[^/?-]+-)?(\d+)", url)
        stable_key = (
            match.group(1)
            if match
            else url.split("?", 1)[0]
        )
        if stable_key in seen:
            continue
        seen.add(stable_key)
        jobs.append(job)

    return jobs


def fetch_alignerr_linkedin_page(source, start):
    search_url = "https://www.linkedin.com/jobs/search/"
    api_url = (
        "https://www.linkedin.com/jobs-guest/jobs/api/"
        "seeMoreJobPostings/search"
    )
    params = {
        "f_C": ALIGNERR_LINKEDIN_COMPANY_ID,
        "start": start,
    }

    session = requests.Session()
    session.headers.update(
        {
            **REQUEST_HEADERS,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    # LinkedIn guest search is more reliable after the normal search page
    # establishes its public cookies. Failure here is non-fatal.
    try:
        session.get(
            search_url,
            params={"f_C": ALIGNERR_LINKEDIN_COMPANY_ID},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        pass

    response = session.get(
        api_url,
        params=params,
        headers={
            "Referer": (
                "https://www.linkedin.com/jobs/search/"
                f"?f_C={ALIGNERR_LINKEDIN_COMPANY_ID}"
            ),
            "X-Requested-With": "XMLHttpRequest",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return parse_linkedin_alignerr_jobs(
        source,
        response.text,
    )

def fetch_all_alignerr_linkedin_jobs(source, reported_total=0):
    """Fetch the complete public Alignerr company listing in waves."""
    jobs = []
    seen_urls = set()
    consecutive_empty_pages = 0
    next_start = 0

    # Fetch in small concurrent waves so 5k+ listings do not take minutes.
    while next_start <= ALIGNERR_LINKEDIN_MAX_START:
        starts = list(
            range(
                next_start,
                min(
                    next_start
                    + ALIGNERR_LINKEDIN_BATCH_SIZE
                    * ALIGNERR_LINKEDIN_WORKERS,
                    ALIGNERR_LINKEDIN_MAX_START + 1,
                ),
                ALIGNERR_LINKEDIN_BATCH_SIZE,
            )
        )
        if not starts:
            break

        page_results = {}
        with ThreadPoolExecutor(
            max_workers=ALIGNERR_LINKEDIN_WORKERS
        ) as executor:
            futures = {
                executor.submit(
                    fetch_alignerr_linkedin_page,
                    source,
                    start,
                ): start
                for start in starts
            }
            for future in as_completed(futures):
                start = futures[future]
                try:
                    page_results[start] = future.result()
                except requests.RequestException:
                    page_results[start] = []

        wave_added = 0
        for start in starts:
            page_jobs = page_results.get(start, [])
            if not page_jobs:
                consecutive_empty_pages += 1
            else:
                consecutive_empty_pages = 0

            for job in page_jobs:
                stable_url = job["url"].split("?", 1)[0]
                if stable_url in seen_urls:
                    continue
                seen_urls.add(stable_url)
                jobs.append(job)
                wave_added += 1

        jobs = dedupe_jobs(
            jobs,
            MAX_JOBS_PER_SOURCE,
        )

        if reported_total and len(jobs) >= reported_total:
            break
        if consecutive_empty_pages >= 4:
            break
        if wave_added == 0:
            # One whole 10-page wave returned nothing; the board is done or
            # LinkedIn is rate-limiting the guest endpoint.
            break

        next_start = starts[-1] + ALIGNERR_LINKEDIN_BATCH_SIZE

    return jobs

def fetch_alignerr_source(source):
    jobs = []
    errors = []
    reported_total = 0
    soup = None
    raw_html = ""

    try:
        response = request_url(source["listing_url"])
        raw_html = response.text
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(raw_html, "html.parser")

        jobs.extend(
            parse_alignerr_visible_jobs(source, soup)
        )
        jobs.extend(
            parse_alignerr_raw_links(source, raw_html)
        )
        jobs.extend(
            parse_alignerr_embedded_jobs(source, raw_html)
        )
        jobs = dedupe_jobs(
            jobs,
            MAX_JOBS_PER_SOURCE,
        )

        reported_total = max(
            extract_reported_total(
                soup.get_text(" ", strip=True)
            ),
            extract_reported_total(raw_html),
        )
    except (
        requests.RequestException,
        ImportError,
        ValueError,
    ) as exc:
        errors.append(
            f"page: {exc.__class__.__name__}"
        )

    endpoints = []
    endpoints.extend(
        discover_job_json_endpoints(
            source["listing_url"],
            raw_html,
        )
    )
    if soup is not None:
        endpoints.extend(
            discover_script_job_endpoints(
                source["listing_url"],
                soup,
            )
        )
    endpoints.extend(
        discover_alignerr_openapi_endpoints()
    )
    endpoints.extend(
        alignerr_fallback_endpoints()
    )

    seen_endpoints = set()
    for endpoint in endpoints:
        endpoint = clean_text(endpoint)
        if not endpoint or endpoint in seen_endpoints:
            continue
        seen_endpoints.add(endpoint)

        endpoint_jobs, endpoint_total = fetch_json_endpoint_pages(
            source,
            endpoint,
        )
        jobs.extend(endpoint_jobs)
        jobs = dedupe_jobs(
            jobs,
            MAX_JOBS_PER_SOURCE,
        )
        reported_total = max(
            reported_total,
            endpoint_total,
        )

        if reported_total and len(jobs) >= reported_total:
            break

    # Alignerr is intentionally sourced only from alignerr.com/jobs and
    # the public data/endpoints referenced by that page. Do not merge
    # third-party copies of Alignerr listings into this source.

    complete = bool(
        reported_total
        and len(jobs) >= reported_total
    )

    return {
        **source,
        "status": (
            "live"
            if jobs and (complete or not reported_total)
            else ("partial" if jobs else "unavailable")
        ),
        "jobs": jobs,
        "reported_total": reported_total,
        "complete": complete,
        "error": "; ".join(errors[:3]),
    }

def fetch_bulk_public_source(source):
    jobs = []
    errors = []
    reported_total = 0
    raw_html = ""
    soup = None

    try:
        response = request_url(
            source["listing_url"]
        )
        raw_html = response.text
        base_jobs, soup = parse_public_response(
            source,
            response,
        )
        jobs.extend(base_jobs)

        if source["key"] == "alignerr":
            jobs.extend(
                parse_alignerr_embedded_jobs(
                    source,
                    raw_html,
                )
            )
            jobs = dedupe_jobs(
                jobs,
                MAX_JOBS_PER_SOURCE,
            )

        reported_total = max(
            reported_total,
            extract_reported_total(
                soup.get_text(" ", strip=True)
            ),
            extract_reported_total(raw_html),
        )
    except (
        requests.RequestException,
        ImportError,
        ValueError,
    ) as exc:
        errors.append(
            f"base: {exc.__class__.__name__}"
        )

    endpoints = discover_job_json_endpoints(
        source["listing_url"],
        raw_html,
    )

    if source["key"] == "alignerr" and soup is not None:
        endpoints.extend(
            discover_script_job_endpoints(
                source["listing_url"],
                soup,
            )
        )
        endpoints.extend(
            discover_alignerr_openapi_endpoints()
        )
        endpoints.extend(
            alignerr_fallback_endpoints()
        )

    deduped_endpoints = []
    seen_endpoints = set()
    for endpoint in endpoints:
        endpoint = clean_text(endpoint)
        if not endpoint or endpoint in seen_endpoints:
            continue
        seen_endpoints.add(endpoint)
        deduped_endpoints.append(endpoint)

    for endpoint in deduped_endpoints:
        endpoint_jobs, endpoint_total = (
            fetch_json_endpoint_pages(
                source,
                endpoint,
            )
        )
        jobs.extend(endpoint_jobs)
        jobs = dedupe_jobs(
            jobs,
            MAX_JOBS_PER_SOURCE,
        )
        reported_total = max(
            reported_total,
            endpoint_total,
        )

        if reported_total and len(jobs) >= reported_total:
            break

    if not (
        reported_total
        and len(jobs) >= reported_total
    ):
        pagination_strategies = [
            lambda page: add_query_params(
                source["listing_url"],
                page=page,
            ),
            lambda page: add_query_params(
                source["listing_url"],
                offset=(page - 1) * 60,
                limit=60,
            ),
            lambda page: add_query_params(
                source["listing_url"],
                skip=(page - 1) * 60,
                limit=60,
            ),
        ]

        for build_url in pagination_strategies:
            strategy_found_new = False
            no_growth = 0

            for page in range(2, MAX_BULK_PAGES + 1):
                try:
                    response = request_url(
                        build_url(page)
                    )
                    page_jobs, soup = (
                        parse_public_response(
                            source,
                            response,
                        )
                    )
                except (
                    requests.RequestException,
                    ImportError,
                    ValueError,
                ):
                    break

                reported_total = max(
                    reported_total,
                    extract_reported_total(
                        soup.get_text(
                            " ",
                            strip=True,
                        )
                    ),
                )

                before = len(jobs)
                jobs.extend(page_jobs)
                jobs = dedupe_jobs(
                    jobs,
                    MAX_JOBS_PER_SOURCE,
                )

                if len(jobs) > before:
                    strategy_found_new = True
                    no_growth = 0
                else:
                    no_growth += 1

                if (
                    reported_total
                    and len(jobs) >= reported_total
                ):
                    break
                if no_growth >= 2:
                    break

            if strategy_found_new:
                break

    jobs = dedupe_jobs(
        jobs,
        MAX_JOBS_PER_SOURCE,
    )
    complete = bool(
        reported_total
        and len(jobs) >= reported_total
    )

    return {
        **source,
        "status": (
            "live"
            if jobs and (
                complete
                or not reported_total
            )
            else (
                "partial"
                if jobs
                else (
                    "unavailable"
                    if errors
                    else "browse"
                )
            )
        ),
        "jobs": jobs,
        "reported_total": reported_total,
        "complete": complete,
        "error": "; ".join(errors[:3]),
    }


def mercor_job_from_item(source, item):
    title = clean_text(
        item.get("title")
        or item.get("jobTitle")
        or item.get("listingTitle")
        or ""
    )
    if not title:
        return None

    identifier = clean_text(
        item.get("listingId")
        or item.get("id")
        or ""
    )
    url = clean_text(
        item.get("listingUrl")
        or item.get("url")
        or ""
    )
    if not url and identifier:
        url = (
            "https://work.mercor.com/jobs/"
            f"{identifier}"
        )

    return make_job(
        source,
        title,
        url or source["browse_url"],
        clean_text(
            item.get("description")
            or item.get("summary")
            or ""
        ),
        location=structured_location(item),
        pay=structured_pay(item),
        employment_type=clean_text(
            item.get("commitment")
            or ""
        ),
        category=clean_text(
            item.get("listingDomain")
            or item.get("category")
            or ""
        ),
    )


def mercor_jobs_from_payload(source, payload):
    jobs = []

    for item in flatten_json(payload):
        identifier = clean_text(
            item.get("listingId")
            or ""
        )
        if not identifier:
            continue

        status_value = clean_text(
            item.get("status") or ""
        ).lower()
        if status_value in {
            "closed",
            "inactive",
            "archived",
            "filled",
        }:
            continue

        job = mercor_job_from_item(
            source,
            item,
        )
        if job:
            jobs.append(job)

    return dedupe_jobs(
        jobs,
        MAX_JOBS_PER_SOURCE,
    )


def fetch_mercor_source(source):
    endpoint = source["api_url"]
    headers = {
        "Origin": "https://work.mercor.com",
        "Referer": "https://work.mercor.com/explore",
    }

    request_modes = [
        (
            "get",
            lambda page: {
                "page": page,
                "limit": 100,
                "orderBy": "newest",
            },
        ),
        (
            "post",
            lambda page: {
                "page": page,
                "limit": 100,
                "orderBy": "newest",
            },
        ),
        (
            "post",
            lambda page: {
                "pagination": {
                    "page": page,
                    "limit": 100,
                },
                "orderBy": "newest",
            },
        ),
        (
            "post",
            lambda page: {
                "offset": (page - 1) * 100,
                "limit": 100,
                "orderBy": "newest",
            },
        ),
    ]

    best_jobs = []
    reported_total = 0
    errors = []

    for method, payload_for_page in request_modes:
        jobs = []
        no_growth = 0
        mode_worked = False

        for page in range(1, MAX_BULK_PAGES + 1):
            payload_or_params = payload_for_page(
                page
            )
            try:
                if method == "post":
                    payload = request_json(
                        endpoint,
                        method="post",
                        body=payload_or_params,
                        headers=headers,
                    )
                else:
                    payload = request_json(
                        endpoint,
                        params=payload_or_params,
                        headers=headers,
                    )
            except (
                requests.RequestException,
                ValueError,
                json.JSONDecodeError,
            ) as exc:
                if page == 1:
                    errors.append(
                        f"{method}: {exc.__class__.__name__}"
                    )
                break

            page_jobs = mercor_jobs_from_payload(
                source,
                payload,
            )
            if page_jobs:
                mode_worked = True

            reported_total = max(
                reported_total,
                payload_reported_total(payload),
            )

            before = len(jobs)
            jobs.extend(page_jobs)
            jobs = dedupe_jobs(
                jobs,
                MAX_JOBS_PER_SOURCE,
            )

            if len(jobs) == before:
                no_growth += 1
            else:
                no_growth = 0

            if reported_total and len(jobs) >= reported_total:
                break
            if no_growth >= 2 or not page_jobs:
                break

        if len(jobs) > len(best_jobs):
            best_jobs = jobs

        if (
            mode_worked
            and (
                not reported_total
                or len(best_jobs) >= reported_total
            )
        ):
            break

    if not best_jobs:
        fallback = fetch_bulk_public_source(
            {
                **source,
                "mode": "bulk_public",
            }
        )
        best_jobs = fallback["jobs"]
        reported_total = max(
            reported_total,
            fallback.get("reported_total", 0),
        )

    complete = bool(
        reported_total
        and len(best_jobs) >= reported_total
    )

    return {
        **source,
        "status": (
            "live"
            if best_jobs and (
                complete
                or not reported_total
            )
            else (
                "partial"
                if best_jobs
                else "unavailable"
            )
        ),
        "jobs": dedupe_jobs(
            best_jobs,
            MAX_JOBS_PER_SOURCE,
        ),
        "reported_total": reported_total,
        "complete": complete,
        "error": "; ".join(errors[:3]),
    }


def micro1_job_from_item(source, item):
    if clean_text(
        item.get("job_status")
        or ""
    ).lower() == "closed":
        return None

    return make_job(
        source,
        item.get("job_title")
        or item.get("title")
        or "",
        item.get("job_apply_url")
        or source["browse_url"],
        strip_html(
            item.get("job_description")
            or item.get("description")
            or ""
        ),
        location=structured_location(item),
        category=clean_text(
            item.get("category")
            or item.get("department")
            or ""
        ),
    )


def fetch_micro1_source(source):
    api_key = settings.MICRO1_API_KEY

    if api_key:
        jobs = []
        reported_total = 0
        page_size = 100

        for page in range(
            1,
            MAX_BULK_PAGES + 1,
        ):
            try:
                payload = request_json(
                    source["api_url"],
                    params={
                        "page": page,
                        "limit": page_size,
                    },
                    headers={
                        "x-api-key": api_key,
                    },
                )
            except (
                requests.RequestException,
                ValueError,
                json.JSONDecodeError,
            ):
                break

            data = payload.get("data")
            if not isinstance(data, list):
                data = []

            reported_total = max(
                reported_total,
                payload_reported_total(payload),
            )
            page_jobs = [
                job
                for item in data
                if isinstance(item, dict)
                for job in [
                    micro1_job_from_item(
                        source,
                        item,
                    )
                ]
                if job
            ]

            before = len(jobs)
            jobs.extend(page_jobs)
            jobs = dedupe_jobs(
                jobs,
                MAX_JOBS_PER_SOURCE,
            )

            if not data:
                break
            if len(jobs) == before:
                break
            if len(data) < page_size:
                break
            if reported_total and len(jobs) >= reported_total:
                break

        if jobs:
            complete = bool(
                reported_total
                and len(jobs) >= reported_total
            )
            return {
                **source,
                "status": (
                    "live"
                    if complete
                    or not reported_total
                    else "partial"
                ),
                "jobs": jobs,
                "reported_total": reported_total,
                "complete": complete,
                "error": "",
            }

    fallback = fetch_bulk_public_source(
        {
            **source,
            "mode": "bulk_public",
        }
    )

    return {
        **source,
        **{
            key: value
            for key, value in fallback.items()
            if key not in source
        },
        "status": (
            fallback["status"]
            if fallback["jobs"]
            else (
                "api_key_needed"
                if not api_key
                else fallback["status"]
            )
        ),
        "jobs": fallback["jobs"],
        "reported_total": fallback.get(
            "reported_total",
            0,
        ),
        "complete": fallback.get(
            "complete",
            False,
        ),
        "error": fallback.get(
            "error",
            "",
        ),
    }


def fetch_source(source):
    mode = source["mode"]

    if mode == "account_only":
        return {
            **source,
            "status": "account_only",
            "jobs": [],
            "reported_total": 0,
            "complete": False,
            "error": "",
        }

    if mode == "ashby":
        return fetch_ashby_source(source)

    if mode == "telus":
        return fetch_telus_source(source)

    if mode == "alignerr":
        return fetch_alignerr_source(source)

    if mode == "bulk_public":
        return fetch_bulk_public_source(source)

    if mode == "mercor":
        return fetch_mercor_source(source)

    if mode == "micro1":
        return fetch_micro1_source(source)

    return fetch_public_source(source)


def payload_from_source_results(source_results):
    source_order = {
        source["key"]: index
        for index, source in enumerate(JOB_SOURCES)
    }
    ordered = sorted(
        source_results,
        key=lambda item: source_order.get(
            item["key"],
            len(source_order),
        ),
    )

    jobs = []
    sources = []

    completed_keys = {
        source["key"]
        for source in ordered
    }

    for source in ordered:
        jobs.extend(source.get("jobs", []))
        sources.append(
            {
                "key": source["key"],
                "name": source["name"],
                "browse_url": source["browse_url"],
                "description": source["description"],
                "status": source["status"],
                "job_count": len(source.get("jobs", [])),
                "reported_total": source.get("reported_total", 0),
                "complete": bool(source.get("complete")),
                "error": source.get("error", ""),
            }
        )

    # Keep every configured platform visible while its source is still
    # syncing so the UI does not jump between 0 and N platform cards.
    for source in JOB_SOURCES:
        if source["key"] in completed_keys:
            continue
        sources.append(
            {
                "key": source["key"],
                "name": source["name"],
                "browse_url": source["browse_url"],
                "description": source["description"],
                "status": "syncing",
                "job_count": 0,
                "reported_total": 0,
                "complete": False,
                "error": "",
            }
        )

    sources.sort(
        key=lambda item: source_order.get(
            item["key"],
            len(source_order),
        )
    )

    jobs = dedupe_jobs(jobs)
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
        "account_only_sources": sum(
            1
            for source in sources
            if source["status"] == "account_only"
        ),
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
    }


def empty_jobs_payload():
    return payload_from_source_results([])


def build_jobs_payload():
    source_results = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(
                fetch_source,
                source,
            ): source
            for source in JOB_SOURCES
        }

        for future in as_completed(futures):
            source = futures[future]
            try:
                source_results.append(
                    future.result()
                )
            except Exception as exc:
                source_results.append(
                    {
                        **source,
                        "status": "unavailable",
                        "jobs": [],
                        "reported_total": 0,
                        "complete": False,
                        "error": exc.__class__.__name__,
                    }
                )

    return payload_from_source_results(
        source_results
    )


def refresh_jobs_cache():
    """Refresh sources without blocking the HTTP request that started it."""
    global _source_results_cache

    fresh_results = {}

    try:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(
                    fetch_source,
                    source,
                ): source
                for source in JOB_SOURCES
            }

            for future in as_completed(futures):
                source = futures[future]
                try:
                    result = future.result()
                except Exception as exc:
                    result = {
                        **source,
                        "status": "unavailable",
                        "jobs": [],
                        "reported_total": 0,
                        "complete": False,
                        "error": exc.__class__.__name__,
                    }

                fresh_results[source["key"]] = result

                with _cache_lock:
                    # Keep old results for sources that have not finished yet,
                    # while replacing each source immediately as it completes.
                    progressive = dict(_source_results_cache)
                    progressive.update(fresh_results)
                    _source_results_cache = progressive
                    _cache["payload"] = payload_from_source_results(
                        list(progressive.values())
                    )
                    _cache["expires_at"] = (
                        monotonic()
                        + CACHE_TTL_SECONDS
                    )
                    _sync_state["completed_sources"] = len(fresh_results)

        with _cache_lock:
            _source_results_cache = dict(fresh_results)
            _cache["payload"] = payload_from_source_results(
                list(fresh_results.values())
            )
            _cache["expires_at"] = (
                monotonic()
                + CACHE_TTL_SECONDS
            )
    except Exception as exc:
        with _cache_lock:
            _sync_state["last_error"] = (
                f"{type(exc).__name__}: {exc}"
            )
    finally:
        with _cache_lock:
            _sync_state["refreshing"] = False


def start_jobs_refresh():
    with _cache_lock:
        if _sync_state["refreshing"]:
            return False

        _sync_state.update(
            {
                "refreshing": True,
                "started_at": monotonic(),
                "completed_sources": 0,
                "total_sources": len(JOB_SOURCES),
                "last_error": "",
            }
        )

    thread = threading.Thread(
        target=refresh_jobs_cache,
        name="revnivo-jobs-refresh",
        daemon=True,
    )
    thread.start()
    return True

@api_view(["GET"])
def jobs_feed(request):
    force_refresh = str(
        request.query_params.get(
            "refresh",
            "",
        )
    ).lower() in {
        "1",
        "true",
        "yes",
    }

    now = monotonic()
    with _cache_lock:
        payload = _cache["payload"]
        cache_expired = (
            payload is None
            or now >= _cache["expires_at"]
        )
        currently_refreshing = _sync_state["refreshing"]

    should_refresh = (
        force_refresh
        or cache_expired
    )

    if should_refresh and not currently_refreshing:
        start_jobs_refresh()

    with _cache_lock:
        payload = _cache["payload"] or empty_jobs_payload()
        sync_snapshot = dict(_sync_state)

    return Response(
        {
            **payload,
            "cached": _cache["payload"] is not None,
            "refreshing": sync_snapshot["refreshing"],
            "sync_completed_sources": sync_snapshot["completed_sources"],
            "sync_total_sources": sync_snapshot["total_sources"],
            "sync_error": sync_snapshot["last_error"],
        }
    )

