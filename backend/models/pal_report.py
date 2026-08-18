from dataclasses import dataclass, field
from typing import Any


@dataclass
class PALReport:
    """
    Final macro/news intelligence response returned by PAL.

    PAL is focused on:
    - macro market context
    - important economic events
    - recent macro catalysts
    - market risks
    - concise fundamental intelligence

    PAL does NOT expose trading strategy or execution data.
    """

    # ==========================================================
    # Basic Information
    # ==========================================================

    symbol: str = ""

    timestamp: str = ""

    success: bool = True

    # ==========================================================
    # Macro Intelligence
    # ==========================================================

    macro: dict[str, Any] = field(
        default_factory=dict
    )

    # ==========================================================
    # News Intelligence
    # ==========================================================

    news: dict[str, Any] = field(
        default_factory=dict
    )