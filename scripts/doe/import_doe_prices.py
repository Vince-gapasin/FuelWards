"""Import the DOE's weekly pump prices into FuelWards.

Runs on a schedule in GitHub Actions (.github/workflows/doe-prices.yml):
  1. Reads the DOE's listing pages for Metro Manila, North Luzon and South Luzon.
  2. Downloads PDFs it hasn't imported yet (and re-checks recent ones, because the DOE
     sometimes reuses a file name for a new week).
  3. Reads each PDF's price tables and sends each region's rows to the database function
     ingest_doe_prices(), which only accepts the DOE import token.
  4. Fails (so GitHub emails the repository owner) if an upload fails or no region has a
     week that ended in the last 10 days.

Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DOE_INGEST_TOKEN (not needed with --dry-run).
Usage: python scripts/doe/import_doe_prices.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import doe_parse  # noqa: E402

LISTING = "https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/{}-pump-prices"
PAGES = ["ncr", "north-luzon", "south-luzon"]
USER_AGENT = "FuelWards-DOE-importer (+https://github.com/Vince-gapasin/FuelWards)"
RECHECK_DAYS = 14  # files whose imported week ended this recently are downloaded again
OLDEST_DAYS = 35  # links dated older than this aren't worth downloading (the app shows 4 weeks)
STALE_DAYS = 10
MANILA = timezone(timedelta(hours=8))


class LinkParser(HTMLParser):
    """Collects (href, text) for every link to a PDF."""

    def __init__(self, base: str) -> None:
        super().__init__()
        self.base = base
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            href = dict(attrs).get("href") or ""
            if urllib.parse.urlparse(href).path.lower().endswith(".pdf"):
                self._href = urllib.parse.urljoin(self.base, href)
                self._text = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href:
            self.links.append((self._href, " ".join("".join(self._text).split())))
            self._href = None


def fetch(url: str, timeout: int = 90) -> bytes:
    last: Exception | None = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"could not download {url}: {last}")


class Api:
    def __init__(self, url: str, key: str, token: str | None) -> None:
        self.url = url.rstrip("/")
        self.key = key
        self.token = token

    def _request(self, path: str, body: object | None = None) -> object:
        req = urllib.request.Request(
            self.url + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"apikey": self.key, "Content-Type": "application/json", "Accept": "application/json"},
            method="GET" if body is None else "POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.loads(res.read() or b"null")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{path}: HTTP {e.code} {e.read().decode(errors='replace')[:300]}") from e

    def imports(self) -> list[dict]:
        return self._request("/rest/v1/doe_price_imports?select=source_url,region,week_start,week_end")  # type: ignore[return-value]

    def ingest(self, report: dict) -> int:
        return self._request("/rest/v1/rpc/ingest_doe_prices", {"p_token": self.token, "p_report": report})  # type: ignore[return-value]


def read_pdf(path: Path):
    import pdfplumber  # imported here so the unit tests don't need it

    with pdfplumber.open(path) as pdf:
        return [(page.extract_text() or "", page.extract_tables()) for page in pdf.pages]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="parse and print, but don't upload")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    token = os.environ.get("DOE_INGEST_TOKEN")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required", file=sys.stderr)
        return 2
    if not args.dry_run and not token:
        print("DOE_INGEST_TOKEN is required (or use --dry-run)", file=sys.stderr)
        return 2
    api = Api(url, key, token)
    today = datetime.now(MANILA).date()

    imported: dict[str, date] = {}  # source_url -> latest week_end imported from it
    latest: dict[str, date] = {}  # region -> latest week_end
    try:
        previous = api.imports()
    except RuntimeError as e:
        if not args.dry_run:
            raise
        print(f"(dry run: can't read past imports, treating all as new: {e})")
        previous = []
    for row in previous:
        end = date.fromisoformat(row["week_end"])
        imported[row["source_url"]] = max(end, imported.get(row["source_url"], end))
        latest[row["region"]] = max(end, latest.get(row["region"], end))

    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for page in PAGES:
            listing = LISTING.format(page)
            parser = LinkParser(listing)
            parser.feed(fetch(listing).decode("utf-8", errors="replace"))
            print(f"{page}: {len(parser.links)} PDF links")
            for href, text in dict.fromkeys(parser.links):
                done = imported.get(href)
                if done and done < today - timedelta(days=RECHECK_DAYS):
                    continue
                link_week = doe_parse.parse_week(text, today)
                if link_week and link_week[1] < today - timedelta(days=OLDEST_DAYS):
                    continue
                path = Path(tmp) / "report.pdf"
                try:
                    path.write_bytes(fetch(href))
                    pages = read_pdf(path)
                except Exception as e:  # a broken file shouldn't stop the other regions
                    print(f"  ! {text}: {e}")
                    continue
                report = doe_parse.parse_pages(pages, today, doe_parse.region_hint(page, text))
                if not report.week_start or not report.week_end:
                    scanned = not any(t.strip() for t, _ in pages)
                    print(f"  - {text}: {'scanned image, no readable text' if scanned else 'no week found'}")
                    continue
                if report.week_end < today - timedelta(days=OLDEST_DAYS):
                    continue
                if not report.rows:
                    print(f"  - {text} ({report.week_start}): no tables for the app's regions")
                    continue
                for region, rows in report.rows.items():
                    label = f"{region} {report.week_start}..{report.week_end}: {len(rows)} rows"
                    payload = {
                        "region": region,
                        "week_start": report.week_start.isoformat(),
                        "week_end": report.week_end.isoformat(),
                        "source_url": href,
                        "rows": [r.as_json() for r in rows],
                    }
                    if args.dry_run:
                        print(f"  = {label} (dry run)")
                        latest[region] = max(report.week_end, latest.get(region, report.week_end))
                        continue
                    try:
                        stored = api.ingest(payload)
                        print(f"  + {label}, stored {stored}")
                        latest[region] = max(report.week_end, latest.get(region, report.week_end))
                    except RuntimeError as e:
                        failures += 1
                        print(f"  ! {label}: {e}")

    print("\nLatest week per region:")
    for region in sorted(doe_parse.COVERED_REGIONS):
        end = latest.get(region)
        print(f"  {region:5} {end.isoformat() if end else 'none'}")
    fresh = [r for r, end in latest.items() if end >= today - timedelta(days=STALE_DAYS)]
    if failures:
        print(f"\n{failures} upload(s) failed", file=sys.stderr)
        return 1
    if not args.dry_run and not fresh:
        print(f"\nNo region has prices from the last {STALE_DAYS} days. Has the DOE page changed?", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
