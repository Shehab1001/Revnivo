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

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0 Safari/537.36 RevnivoJobs/2.0"
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
        "mode": "bulk_public",
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


def fetch_source(source):
    mode = source["mode"]

    if mode == "account_only":
        return {
            **source,
            "status": "account_only",
            "jobs": [],
            "error": "",
        }

    if mode == "ashby":
        return fetch_ashby_source(source)

    if mode == "telus":
        return fetch_telus_source(source)

    return fetch_public_source(source)


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
                        "error": exc.__class__.__name__,
                    }
                )

    source_order = {
        source["key"]: index
        for index, source in enumerate(JOB_SOURCES)
    }
    source_results.sort(
        key=lambda item: source_order[item["key"]]
    )

    jobs = []
    sources = []

    for source in source_results:
        jobs.extend(source["jobs"])
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
        _cache["expires_at"] = (
            monotonic()
            + CACHE_TTL_SECONDS
        )

    return Response(
        {
            **payload,
            "cached": False,
        }
    )
