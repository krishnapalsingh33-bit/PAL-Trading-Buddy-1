from dataclasses import dataclass, field
from typing import Any


@dataclass
class PALReport:
    """
    Final macro/news intelligence response returned by PAL.

    PAL is focused on:
    - macro market context
    - TODAY-only current-day bias
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
    # TODAY — independent current-day intelligence
    # ==========================================================

    today: dict[str, Any] = field(
        default_factory=dict
    )

    # ==========================================================
    # Macro Intelligence — broader regime
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

    # ==========================================================
    # Optional compatibility/report fields
    # ==========================================================

    market_health: dict[str, Any] = field(
        default_factory=dict
    )

    pal: dict[str, Any] = field(
        default_factory=dict
    )

    execution: dict[str, Any] = field(
        default_factory=dict
    )

    ai_commentary: dict[str, Any] = field(
        default_factory=dict
    )

    summary: dict[str, Any] = field(
        default_factory=dict
    )
