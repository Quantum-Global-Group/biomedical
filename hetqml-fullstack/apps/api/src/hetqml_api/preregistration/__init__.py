"""Preregistration / bootstrap-CI parsing utilities.

The `/preregistration/status` router consumes `parse_bootstrap_ci_report`
to turn the human-edited `bootstrap_ci_analysis.md` artifact into typed
`BootstrapCIReport` payloads for H1 and H1b. The parser is permissive —
when a hypothesis section is missing or malformed it returns ``None``
instead of raising, so a partial GPU run still lands the rest of the
report.
"""

from hetqml_api.preregistration.parser import (
    BootstrapParseResult,
    parse_bootstrap_ci_report,
)

__all__ = ["BootstrapParseResult", "parse_bootstrap_ci_report"]
