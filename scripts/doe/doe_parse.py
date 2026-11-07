"""Read the DOE's weekly "Price Monitoring of Liquid Fuels" PDFs.

Each PDF has one table per page: [province,] city, product, a column per brand, the overall
price range and the common price. Layouts differ a little between field offices, so columns
are found by their header text. Everything here is pure (no network) so it can be unit-tested.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

# Regions the app covers, with the words that identify them in a page heading.
# Longer Roman numerals come first so "REGION III" isn't read as "REGION I".
REGION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("NCR", re.compile(r"\bNCR\b|NATIONAL\s+CAPITAL\s+REGION|METRO\s+MANILA", re.I)),
    ("IV-A", re.compile(r"REGION\s*IV\s*-?\s*A\b|CALABARZON", re.I)),
    ("IV-B", re.compile(r"REGION\s*IV\s*-?\s*B\b|MIMAROPA", re.I)),
    ("III", re.compile(r"REGION\s*III\b|CENTRAL\s+LUZON", re.I)),
    ("V", re.compile(r"REGION\s*V\b|BICOL", re.I)),
    # Regions the app doesn't cover yet. Recognised so their pages aren't credited to the
    # previous page's region.
    ("CAR", re.compile(r"\bCAR\b|CORDILLERA", re.I)),
    ("II", re.compile(r"REGION\s*II\b|CAGAYAN\s+VALLEY", re.I)),
    ("I", re.compile(r"REGION\s*I\b|ILOCOS", re.I)),
]
COVERED_REGIONS = {"NCR", "III", "IV-A", "IV-B", "V"}

# Product names as printed (spaces removed, upper case) -> the app's fuel codes.
PRODUCTS = {
    "RON97": "GAS97",
    "RON95": "GAS95",
    "RON91": "GAS91",
    "DIESEL": "DIESEL",
    "DIESELPLUS": "DIESEL_PLUS",
    "KEROSENE": "KEROSENE",
}

MIN_PRICE = 20.0
MAX_PRICE = 300.0

MONTHS = {
    m: i + 1
    for i, m in enumerate(
        [
            "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
        ]
    )
}
_MONTH = r"(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)"
# "October 20-26, 2026", "OCTOBER 27-NOVEMBER 02, 2026", "October 27 - November 2, 2026",
# "OCTOBER R 13-19, 2026" (a stray letter from the PDF), "September 1-7" (no year).
WEEK_RE = re.compile(
    r"\b" + _MONTH
    + r"\.?\s+(?:[A-Z]\s+)?(\d{1,2})\s*(?:-|–|—|TO)\s*(?:"
    + _MONTH
    + r"\.?\s+)?(\d{1,2})(?:\s*,?\s*(\d{4}))?",
    re.I,
)

RANGE_RE = re.compile(r"(\d{1,3}(?:\.\d{1,2})?)\s*-\s*(\d{1,3}(?:\.\d{1,2})?)")
NUMBER_RE = re.compile(r"^\d{1,3}(?:\.\d{1,2})?$")


@dataclass
class Row:
    area: str
    fuel_type: str
    price_min: float
    price_max: float
    common_price: float | None

    def as_json(self) -> dict:
        return {
            "area": self.area,
            "fuel_type": self.fuel_type,
            "price_min": self.price_min,
            "price_max": self.price_max,
            "common_price": self.common_price,
        }


@dataclass
class Report:
    week_start: date | None = None
    week_end: date | None = None
    rows: dict[str, list[Row]] = field(default_factory=dict)  # region code -> rows


def clean(cell: object) -> str:
    return re.sub(r"\s+", " ", str(cell or "").replace("\n", " ")).strip()


def region_of(text: str) -> str | None:
    """The region named first in a page's text, or None."""
    best: tuple[int, str] | None = None
    for code, pattern in REGION_PATTERNS:
        m = pattern.search(text)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), code)
    return best[1] if best else None


def parse_week(text: str, today: date) -> tuple[date, date] | None:
    """The monitoring week stated in a PDF's heading.

    When the year is missing, the year that puts the week closest to today (and not in the
    future) is used.
    """
    for m in WEEK_RE.finditer(text):
        m1, d1, m2, d2, year = m.groups()
        start_month = MONTHS[m1[:3].upper()]
        end_month = MONTHS[(m2 or m1)[:3].upper()]
        candidates = [int(year)] if year else [today.year, today.year - 1]
        for y in candidates:
            try:
                end = date(y, end_month, int(d2))
                start_year = y - 1 if start_month > end_month else y
                start = date(start_year, start_month, int(d1))
            except ValueError:
                continue
            if not 0 <= (end - start).days <= 13:
                continue
            if end > today + timedelta(days=7):
                continue
            return start, end
    return None


def fuel_code(product: str) -> str | None:
    key = re.sub(r"[^A-Z0-9]", "", product.upper())
    return PRODUCTS.get(key)


def to_price(value: str) -> float | None:
    value = value.replace(",", "").strip()
    if not NUMBER_RE.match(value):
        return None
    price = float(value)
    return price if MIN_PRICE <= price <= MAX_PRICE else None


def parse_range(value: str) -> tuple[float, float] | None:
    m = RANGE_RE.search(value.replace(",", ""))
    if not m:
        return None
    lo, hi = float(m.group(1)), float(m.group(2))
    if not (MIN_PRICE <= lo <= hi <= MAX_PRICE):
        return None
    return lo, hi


def parse_table(table: list[list[object]]) -> list[Row]:
    """Rows of one price table. Tables without the expected columns give no rows."""
    if not table:
        return []
    header = [clean(c).upper() for c in table[0]]
    if "PRODUCT" not in header:
        return []
    product_col = header.index("PRODUCT")
    range_col = next((i for i, h in enumerate(header) if "OVERALL" in h or h == "RANGE"), None)
    common_col = next((i for i, h in enumerate(header) if h.startswith("COMMON")), None)
    if range_col is None or common_col is None:
        return []
    # In some PDFs the header cell reads "INDEPENDENT OVERALL RANGE" because two header cells
    # merged; the range figures are then in the next column.
    if "INDEPENDENT" in header[range_col] and range_col + 1 < common_col:
        range_col += 1

    area_cols = list(range(product_col))
    carried = [""] * product_col  # area cells are merged down, so remember the last one seen
    rows: list[Row] = []
    for raw in table[1:]:
        cells = [clean(c) for c in raw]
        if len(cells) != len(header):
            continue
        for i in area_cols:
            if cells[i]:
                carried[i] = cells[i]
        fuel = fuel_code(cells[product_col])
        area = " / ".join(a for a in carried if a)
        if not fuel or not area:
            continue
        price_range = parse_range(cells[range_col])
        if not price_range:
            continue  # "0.00 - 0.00" or blank: not sold or not monitored that week
        lo, hi = price_range
        common = to_price(cells[common_col])
        if common is not None and not lo <= common <= hi:
            common = None
        rows.append(Row(area=area.title(), fuel_type=fuel, price_min=lo, price_max=hi, common_price=common))
    return rows


def parse_pages(pages: list[tuple[str, list[list[list[object]]]]], today: date, default_region: str | None) -> Report:
    """pages: (page text, tables on the page) for every page of one PDF."""
    report = Report()
    region = default_region
    for text, tables in pages:
        if report.week_start is None:
            week = parse_week(text, today)
            if week:
                report.week_start, report.week_end = week
        region = region_of(text) or region
        if region not in COVERED_REGIONS:
            continue
        for table in tables:
            rows = parse_table(table)
            if rows:
                report.rows.setdefault(region, []).extend(rows)
    for region, rows in report.rows.items():
        report.rows[region] = dedupe(rows)
    return report


def dedupe(rows: list[Row]) -> list[Row]:
    """One row per city and fuel (the first one printed)."""
    seen: set[tuple[str, str]] = set()
    out: list[Row] = []
    for r in rows:
        key = (r.area, r.fuel_type)
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def region_hint(page: str, link_text: str) -> str | None:
    """The region a listing link is for, when the PDF itself doesn't say."""
    if page == "ncr":
        return "NCR"
    return region_of(link_text) if page == "south-luzon" else None
