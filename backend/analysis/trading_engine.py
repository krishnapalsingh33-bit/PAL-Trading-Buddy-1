from analysis.alignment_engine import AlignmentEngine
from analysis.grade_engine import GradeEngine


class TradingEngine:
    """Lightweight trading workflow wrapper.

    This module is currently not part of the live PAL API path. It remains
    importable so the backend compilation pass succeeds without placeholder
    syntax from the original scaffold.
    """

    def __init__(self):
        self.alignment_engine = AlignmentEngine()
        self.grade_engine = GradeEngine()

    def grade_and_execute(self, result):
        """Apply the existing grade engine and expose the A+ execute flag."""
        result.setup_grade = self.grade_engine.build(result)
        result.execute = result.setup_grade == "A+"
        return result
