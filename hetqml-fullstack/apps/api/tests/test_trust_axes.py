"""Trust axis helpers: baseline literature anchors and catalog fallbacks."""

from __future__ import annotations

from hetqml_api.schemas import Selection
from hetqml_api.trust_axes import baseline_axis_value, compute_trust_extras


def test_baseline_axis_caps_ratio() -> None:
    sel = Selection(
        disease="Hypertension",
        compound="Lisinopril",
        gene="ACE",
        metaedge="CtD · Compound–treats–Disease",
    )
    v = baseline_axis_value(0.99, sel.metaedge)
    assert v == 0.99
    v_low = baseline_axis_value(0.10, sel.metaedge)
    assert 0.02 <= v_low < 0.5


def test_compute_trust_extras_deterministic_catalog() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    a = compute_trust_extras(sel, 0.62)
    b = compute_trust_extras(sel, 0.62)
    assert a == b
    assert all(0.0 <= x <= 1.0 for x in a)
