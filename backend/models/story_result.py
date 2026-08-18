from dataclasses import dataclass, field
from typing import Any


@dataclass
class StoryResult:

    # ----------------------------------
    # Higher Timeframe Trend
    # ----------------------------------

    weekly_trend: str = ""
    daily_trend: str = ""
    h4_trend: str = ""

    # ----------------------------------
    # Overall Bias
    # ----------------------------------

    htf_bias: str = ""

    # ----------------------------------
    # Individual Stories
    # ----------------------------------

    weekly_story: str = ""
    daily_story: str = ""
    h4_story: str = ""

    # ----------------------------------
    # Liquidity
    # ----------------------------------

    current_objective: Any = None
    next_objective: Any = None

    liquidity_story: str = ""

    # ----------------------------------
    # Manipulation
    # ----------------------------------

    manipulation_story: str = ""

    # ----------------------------------
    # Displacement
    # ----------------------------------

    displacement_story: str = ""

    # ----------------------------------
    # Market Expectation
    # ----------------------------------

    expectation: str = ""

    # ----------------------------------
    # Final Story
    # ----------------------------------

    market_story: str = ""

    # ----------------------------------
    # Summary
    # ----------------------------------

    summary: list[str] = field(default_factory=list)

    # ----------------------------------
    # Confidence
    # ----------------------------------

    confidence: int = 0 