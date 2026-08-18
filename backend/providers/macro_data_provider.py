from __future__ import annotations

import csv
import io
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)


class MacroDataProvider:
    """Fetch official/public macro observations without making PAL depend on one source."""

    BLS