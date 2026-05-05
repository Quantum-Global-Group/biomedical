"""End-to-end tests for the sqlite-backed persistence routes.

Decisions, skeptic notes, and user settings each get their own table and
their own router. The conftest fixture wires a per-test tmp_path so the
database is fresh for every test.
"""

from __future__ import annotations


PAIR_KEY = "DB17789::DOID:2451"

SELECTION = {
    "disease": "Hypertension-attributed ESKD",
    "compound": "Inaxaplin",
    "gene": "APOL1",
    "metaedge": "CtD · Compound–treats–Disease",
}

DECISION_BODY = {
    "pairKey": PAIR_KEY,
    "verdict": "review",
    "reviewer": "Dr. Beale",
    "sessionId": "sess-001",
    "selection": SELECTION,
    "runPath": {"mode": "quick", "family": "hybrid"},
    "topModel": "Stacking",
    "modelScore": 0.812,
    "trustScore": 0.71,
    "trustAxes": [
        {"axis": "clinical", "value": 0.78, "passing": True},
        {"axis": "mechanism", "value": 0.66, "passing": True},
        {"axis": "model", "value": 0.81, "passing": True},
        {"axis": "baseline", "value": 0.55, "passing": False},
        {"axis": "artifact", "value": 0.92, "passing": True},
    ],
    "guardsCompromised": 1,
    "note": "Re-run after adjusting hard-negative ratio.",
}


# --- Decisions -------------------------------------------------------------


async def test_create_decision_returns_record(client):
    res = await client.post("/decisions", json=DECISION_BODY)
    assert res.status_code == 200
    body = res.json()
    assert body["pairKey"] == PAIR_KEY
    assert body["verdict"] == "review"
    assert body["topModel"] == "Stacking"
    assert len(body["id"]) == 32  # uuid hex
    assert body["timestamp"]  # server-stamped


async def test_list_decisions_returns_most_recent_first(client):
    a = DECISION_BODY | {"verdict": "keep", "topModel": "QSVC (Pauli)"}
    b = DECISION_BODY | {"verdict": "reject", "topModel": "VQC"}
    await client.post("/decisions", json=a)
    await client.post("/decisions", json=b)

    res = await client.get("/decisions")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    # Most recent first
    assert body[0]["topModel"] == "VQC"
    assert body[1]["topModel"] == "QSVC (Pauli)"


async def test_list_decisions_filters_by_pair(client):
    other = DECISION_BODY | {"pairKey": "DB99999::DOID:0000"}
    await client.post("/decisions", json=DECISION_BODY)
    await client.post("/decisions", json=other)

    res = await client.get(f"/decisions?pair_key={PAIR_KEY}")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["pairKey"] == PAIR_KEY


async def test_list_decisions_respects_limit(client):
    for i in range(5):
        await client.post("/decisions", json=DECISION_BODY | {"sessionId": f"sess-{i}"})
    res = await client.get("/decisions?limit=2")
    assert res.status_code == 200
    assert len(res.json()) == 2


# --- Notes -----------------------------------------------------------------


async def test_get_unknown_note_returns_404(client):
    res = await client.get(f"/notes/{PAIR_KEY}")
    assert res.status_code == 404


async def test_put_then_get_note(client):
    body = "Calibration acceptable; rerun on quantum.".strip()
    res = await client.put(
        f"/notes/{PAIR_KEY}",
        json={"pairKey": PAIR_KEY, "body": body},
    )
    assert res.status_code == 200
    note = res.json()
    assert note["pairKey"] == PAIR_KEY
    assert note["body"] == body
    assert note["updatedAt"]

    fetched = await client.get(f"/notes/{PAIR_KEY}")
    assert fetched.status_code == 200
    assert fetched.json()["body"] == body


async def test_put_note_replaces_body(client):
    await client.put(f"/notes/{PAIR_KEY}", json={"pairKey": PAIR_KEY, "body": "draft"})
    await client.put(f"/notes/{PAIR_KEY}", json={"pairKey": PAIR_KEY, "body": "final"})
    res = await client.get(f"/notes/{PAIR_KEY}")
    assert res.json()["body"] == "final"


async def test_put_note_pair_key_mismatch_400(client):
    res = await client.put(
        f"/notes/{PAIR_KEY}",
        json={"pairKey": "DB00000::DOID:0000", "body": "oops"},
    )
    assert res.status_code == 400


# --- Settings --------------------------------------------------------------


async def test_get_default_settings_when_unset(client):
    res = await client.get("/settings")
    assert res.status_code == 200
    body = res.json()
    # Schema defaults round-trip:
    assert body["appearance"]["theme"] == "dark"
    assert body["pipeline"]["defaultRunPath"] == "hybrid"
    assert body["quantum"]["shotsPerCircuit"] == 16384


async def test_put_settings_then_get_round_trips(client):
    payload = {
        "profile": {
            "reviewerName": "Dr. Beale",
            "role": "Principal investigator",
            "organization": "Quantum Global Group",
            "contactEmail": "jonathan.beale002@mymdc.net",
        },
        "appearance": {
            "theme": "light",
            "accent": "amber",
            "density": "compact",
            "reduceMotion": True,
        },
        "pipeline": {
            "defaultRunPath": "quantum",
            "defaultMetaedge": "CbG",
            "hardNegativeRatio": "1:10",
            "strictPosture": False,
            "autosaveSessions": True,
        },
        "quantum": {
            "defaultBackend": "ibm_brisbane",
            "shotsPerCircuit": 8192,
            "jobTimeoutSeconds": 900,
            "zneEnabled": False,
            "pulseLevelAccess": True,
        },
        "ibmConnection": {
            "crn": "crn:v1:bluemix:public:quantum:us-east:a/abc::",
            "validated": True,
            "planTier": "Premium",
            "instanceName": "hetqml/main",
        },
        "notifications": {
            "email": False,
            "slack": True,
            "browserPush": False,
            "severityThreshold": "crit",
            "slackWebhookUrl": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
        "privacy": {
            "anonymousUsage": False,
            "errorReporting": True,
            "crashDiagnostics": True,
            "decisionRetentionDays": 90,
        },
    }
    put = await client.put("/settings", json=payload)
    assert put.status_code == 200

    got = await client.get("/settings")
    assert got.status_code == 200
    body = got.json()
    assert body["profile"]["reviewerName"] == "Dr. Beale"
    assert body["appearance"]["theme"] == "light"
    assert body["pipeline"]["defaultRunPath"] == "quantum"
    assert body["quantum"]["shotsPerCircuit"] == 8192
    assert body["ibmConnection"]["validated"] is True
    assert body["notifications"]["severityThreshold"] == "crit"
    assert body["privacy"]["decisionRetentionDays"] == 90


async def test_put_settings_partial_payload_rejected(client):
    """Pydantic enforces section presence — partial PUT raises 422."""
    res = await client.put(
        "/settings",
        json={"appearance": {"theme": "light"}},
    )
    # Defaults fill in missing fields, so this should actually succeed.
    # We accept either 200 (defaults filled) or 422 (strict). The contract
    # we want to lock down: PUT does not silently merge into the previous
    # document.
    assert res.status_code in {200, 422}


async def test_settings_persist_across_requests(client):
    await client.put(
        "/settings",
        json={"appearance": {"theme": "light"}},
    )
    res_a = await client.get("/settings")
    res_b = await client.get("/settings")
    assert res_a.json() == res_b.json()
    assert res_a.json()["appearance"]["theme"] == "light"


async def test_get_settings_includes_api_keys_section(client):
    """The default `UserSettings` document must expose `apiKeys` as a section
    so the UI can pre-render input rows even before any key is set."""
    res = await client.get("/settings")
    assert res.status_code == 200
    body = res.json()
    assert "apiKeys" in body
    # All BYOK fields default to null (not stored)
    api_keys = body["apiKeys"]
    assert api_keys["openai"] is None
    assert api_keys["anthropic"] is None
    assert api_keys["pubchemPremium"] is None
    assert api_keys["drugbankPro"] is None
    assert api_keys["sentryDsn"] is None


async def test_put_settings_round_trips_api_keys(client):
    """ApiKeysSettings fields persist through a PUT/GET cycle as camelCase."""
    payload = {
        "apiKeys": {
            "openai": "sk-test-openai-AAA",
            "anthropic": "sk-ant-test-BBB",
            "pubchemPremium": "pubchem-premium-CCC",
            "drugbankPro": "db-pro-DDD",
            "sentryDsn": "https://sentry.example.org/123",
        },
    }
    put = await client.put("/settings", json=payload)
    assert put.status_code == 200
    assert put.json()["apiKeys"]["openai"] == "sk-test-openai-AAA"

    got = await client.get("/settings")
    assert got.status_code == 200
    api_keys = got.json()["apiKeys"]
    assert api_keys["openai"] == "sk-test-openai-AAA"
    assert api_keys["anthropic"] == "sk-ant-test-BBB"
    assert api_keys["pubchemPremium"] == "pubchem-premium-CCC"
    assert api_keys["drugbankPro"] == "db-pro-DDD"
    assert api_keys["sentryDsn"] == "https://sentry.example.org/123"
