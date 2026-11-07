"""Unit tests for the DOE PDF reader. Run: python -m unittest discover scripts/doe"""

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import doe_parse as dp  # noqa: E402
from import_doe_prices import LinkParser  # noqa: E402

TODAY = date(2026, 11, 7)


class ParseWeek(unittest.TestCase):
    def check(self, text, start, end):
        self.assertEqual(dp.parse_week(text, TODAY), (start, end), text)

    def test_formats_seen_in_doe_pdfs(self):
        self.check("(For the week of October 20-26, 2026)", date(2026, 10, 20), date(2026, 10, 26))
        self.check("(For the week of October 27 - November 2, 2026)", date(2026, 10, 27), date(2026, 11, 2))
        self.check("(FOR THE PERIOD OF OCTOBER 27-NOVEMBER 02, 2026)", date(2026, 10, 27), date(2026, 11, 2))
        self.check("(FOR THE PERIOD OF OCTOBER R 13-19, 2026)", date(2026, 10, 13), date(2026, 10, 19))
        self.check("(For the week: Tuesday - Monday / October 20-26, 2026)", date(2026, 10, 20), date(2026, 10, 26))
        self.check("(FOR THE PERIOD OF AUGUST 25 - 31, 2026)", date(2026, 8, 25), date(2026, 8, 31))

    def test_listing_link_text(self):
        self.check("October 26 to November 2", date(2026, 10, 26), date(2026, 11, 2))
        self.check("September 29 to Oct 5", date(2026, 9, 29), date(2026, 10, 5))

    def test_missing_year_uses_the_most_recent_past_one(self):
        self.check("For the week: Tuesday - Monday I September 1-7", date(2026, 9, 1), date(2026, 9, 7))
        # In early January, a December week is last year's.
        self.assertEqual(
            dp.parse_week("December 29 - January 4", date(2027, 1, 6)),
            (date(2026, 12, 29), date(2027, 1, 4)),
        )
        self.assertEqual(dp.parse_week("December 15-21", date(2027, 1, 6)), (date(2026, 12, 15), date(2026, 12, 21)))

    def test_rejects_non_weeks(self):
        self.assertIsNone(dp.parse_week("Region IV - A Calabarzon", TODAY))
        self.assertIsNone(dp.parse_week("October 1-30, 2026", TODAY))  # a month, not a week
        self.assertIsNone(dp.parse_week("February 30-31, 2026", TODAY))
        self.assertIsNone(dp.parse_week("December 1-7, 2026", TODAY))  # in the future


class RegionOf(unittest.TestCase):
    def test_headings(self):
        self.assertEqual(dp.region_of("PREVAILING RETAIL PUMP PRICES (REGION III)"), "III")
        self.assertEqual(dp.region_of("REGION IV-A (CALABARZON)"), "IV-A")
        self.assertEqual(dp.region_of("Region IV - B Mimaropa"), "IV-B")
        self.assertEqual(dp.region_of("REGION V - BICOL"), "V")
        self.assertEqual(dp.region_of("NCR Price Monitoring"), "NCR")
        self.assertEqual(dp.region_of("Cordillera Administrative Region"), "CAR")
        self.assertEqual(dp.region_of("REGION I - ILOCOS"), "I")
        self.assertEqual(dp.region_of("REGION II"), "II")
        self.assertIsNone(dp.region_of("Price monitoring of liquid fuels"))

    def test_first_heading_wins(self):
        self.assertEqual(dp.region_of("REGION III ... continued from Region II"), "III")

    def test_listing_hints(self):
        self.assertEqual(dp.region_hint("ncr", "October 20 to 26"), "NCR")
        self.assertEqual(dp.region_hint("south-luzon", "Region IV - A Calabarzon"), "IV-A")
        self.assertIsNone(dp.region_hint("north-luzon", "October 20 to 26"))


NCR_TABLE = [
    ["CITY", "PRODUCT", "PETRON", "SHELL", "INDEPENDENT OVERALL RANGE", None, "COMMON PRICE"],
    ["Caloocan\nCity", "RON 95", "80.00 - 82.00", "81.00", "79.00 - 80.00", "77.70 - 95.10", "82.40"],
    ["", "RON 91", "", "", "", "76.70 - 87.50", "86.90"],
    ["", "RON 100", "", "", "", "90.00 - 99.00", "95.00"],
    ["", "DIESEL", "", "", "", "0.00 - 0.00", "None"],
    ["", "KEROSENE", "", "", "", "116.00 - 120.00", "#N/A"],
    ["Makati City", "DIESEL PLUS", "", "", "", "96.00 - 99.00", "97.50"],
    ["short row"],
]

PROVINCE_TABLE = [
    ["PROVINCE", "CITY/MUNICIPALITY", "PRODUCT", "OVERALL RANGE", "COMMON PRICE"],
    ["CAVITE", "BACOOR", "RON 97", "95.70 - 97.80", "99.00"],
    ["", "", "DIESEL", "88.00 - 92.00", "90.10"],
    ["", "IMUS", "DIESEL", "87.50 - 91.00", "89.00"],
    ["", "", "DIESEL", "10.00 - 12.00", "11.00"],
    ["", "", "RON 91", "85.00 - 80.00", "82.00"],
]


class ParseTable(unittest.TestCase):
    def test_ncr_layout(self):
        rows = dp.parse_table(NCR_TABLE)
        self.assertEqual(
            [(r.area, r.fuel_type, r.price_min, r.price_max, r.common_price) for r in rows],
            [
                ("Caloocan City", "GAS95", 77.7, 95.1, 82.4),
                ("Caloocan City", "GAS91", 76.7, 87.5, 86.9),
                ("Caloocan City", "KEROSENE", 116.0, 120.0, None),
                ("Makati City", "DIESEL_PLUS", 96.0, 99.0, 97.5),
            ],
        )

    def test_province_layout_and_bad_values(self):
        rows = dp.parse_table(PROVINCE_TABLE)
        self.assertEqual(
            [(r.area, r.fuel_type, r.price_min, r.price_max, r.common_price) for r in rows],
            [
                # A common price outside the range is dropped, the range is kept.
                ("Cavite / Bacoor", "GAS97", 95.7, 97.8, None),
                ("Cavite / Bacoor", "DIESEL", 88.0, 92.0, 90.1),
                ("Cavite / Imus", "DIESEL", 87.5, 91.0, 89.0),
                # Impossible prices and reversed ranges are skipped.
            ],
        )

    def test_tables_without_price_columns_are_ignored(self):
        self.assertEqual(dp.parse_table([["NAME", "ADDRESS"], ["a", "b"]]), [])
        self.assertEqual(dp.parse_table([]), [])


class ParsePages(unittest.TestCase):
    def test_regions_carry_over_and_other_regions_are_skipped(self):
        pages = [
            ("For the week: Tuesday - Monday / October 20-26, 2026\nREGION II", [PROVINCE_TABLE]),
            ("REGION III", [PROVINCE_TABLE]),
            ("(continued)", [NCR_TABLE]),
        ]
        report = dp.parse_pages(pages, TODAY, None)
        self.assertEqual((report.week_start, report.week_end), (date(2026, 10, 20), date(2026, 10, 26)))
        self.assertEqual(list(report.rows), ["III"])
        self.assertEqual(len(report.rows["III"]), 3 + 4)

    def test_default_region_and_duplicates(self):
        pages = [("(For the week of October 20-26, 2026)", [NCR_TABLE, NCR_TABLE])]
        report = dp.parse_pages(pages, TODAY, "NCR")
        self.assertEqual(len(report.rows["NCR"]), 4)

    def test_rows_match_the_database_function(self):
        row = dp.parse_table(NCR_TABLE)[0].as_json()
        self.assertEqual(set(row), {"area", "fuel_type", "price_min", "price_max", "common_price"})


class Links(unittest.TestCase):
    def test_collects_pdf_links(self):
        p = LinkParser("https://doe.gov.ph/x/ncr-pump-prices")
        p.feed(
            '<a href="https://cdn.test/a%20b.pdf?prefix=dev%2Fmedia"><span>October 20</span> to 26</a>'
            '<a href="/docs/old.PDF">Old</a><a href="/about">About</a>'
        )
        self.assertEqual(
            p.links,
            [
                ("https://cdn.test/a%20b.pdf?prefix=dev%2Fmedia", "October 20 to 26"),
                ("https://doe.gov.ph/docs/old.PDF", "Old"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
