from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import requests


class TreasuryYieldProvider:
    """Official U.S. Treasury daily par-yield provider for 2Y/10Y."""

    XML_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
    TEXT_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView"

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (official Treasury rates)",
            "Accept": "application/xml,text/xml,text/html,*/*",
        })

    @staticmethod
    def _number(value: Any) -> float | None:
        if value in (None, "", "N/A"):
            return None
        try:
            number = float(str(value).replace(",", "").strip())
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1].upper()

    @classmethod
    def _rows_from_xml(cls, xml: str) -> dict[str, list[dict[str, Any]]]:
        observations = {"us_2y": [], "us_10y": []}
        root = ET.fromstring(xml)
        for entry in root.iter():
            if cls._local_name(entry.tag) != "ENTRY":
                continue
            fields: dict[str, str] = {}
            for child in entry.iter():
                name = cls._local_name(child.tag)
                if child is entry:
                    continue
                text = (child.text or "").strip()
                if text:
                    fields[name] = text
            date = fields.get("NEW_DATE") or fields.get("DATE")
            if not date:
                continue
            two = cls._number(fields.get("BC_2YEAR"))
            ten = cls._number(fields.get("BC_10YEAR"))
            if two is not None:
                observations["us_2y"].append({"date": date, "value": two, "source": "U.S. Department of the Treasury", "series": "2-Year Treasury Par Yield"})
            if ten is not None:
                observations["us_10y"].append({"date": date, "value": ten, "source": "U.S. Department of the Treasury", "series": "10-Year Treasury Par Yield"})
        return {key: rows[-24:] for key, rows in observations.items() if rows}

    @classmethod
    def _rows_from_text(cls, html: str) -> dict[str, list[dict[str, Any]]]:
        observations = {"us_2y": [], "us_10y": []}
        # Drupal's TextView can change markup, so locate a table containing the
        # maturity headings instead of assuming the first table is the yield table.
        for table_html in re.findall(r"<table[^>]*>(.*?)</table>", html, flags=re.I | re.S):
            headers = [re.sub(r"<[^>]+>", "", cell).strip().lower().replace("\xa0", " ") for cell in re.findall(r"<th[^>]*>(.*?)</th>", table_html, flags=re.I | re.S)]
            if "2 yr" not in headers or "10 yr" not in headers or "date" not in headers:
                continue
            date_index = headers.index("date")
            two_index = headers.index("2 yr")
            ten_index = headers.index("10 yr")
            for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, flags=re.I | re.S):
                cells = [re.sub(r"<[^>]+>", "", cell).strip() for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.I | re.S)]
                if len(cells) <= max(date_index, two_index, ten_index):
                    continue
                date = cells[date_index]
                two = cls._number(cells[two_index])
                ten = cls._number(cells[ten_index])
                if two is not None:
                    observations["us_2y"].append({"date": date, "value": two, "source": "U.S. Department of the Treasury", "series": "2-Year Treasury Par Yield"})
                if ten is not None:
                    observations["us_10y"].append({"date": date, "value": ten, "source": "U.S. Department of the Treasury", "series": "10-Year Treasury Par Yield"})
            if observations["us_2y"] or observations["us_10y"]:
                break
        return {key: rows[-24:] for key, rows in observations.items() if rows}

    def get_snapshot(self) -> dict[str, list[dict[str, Any]]]:
        year = datetime.now(timezone.utc).year
        try:
            response = self.session.get(self.XML_URL, params={"data": "daily_treasury_yield_curve", "field_tdr_date_value": year}, timeout=self.timeout_seconds)
            response.raise_for_status()
            rows = self._rows_from_xml(response.text)
            if rows:
                return rows
        except Exception:
            pass

        response = self.session.get(self.TEXT_URL, params={"type": "daily_treasury_yield_curve", "field_tdr_date_value": year}, timeout=self.timeout_seconds)
        response.raise_for_status()
        rows = self._rows_from_text(response.text)
        if not rows:
            raise RuntimeError("Treasury XML and TextView contained no usable 2Y/10Y observations.")
        return rows
