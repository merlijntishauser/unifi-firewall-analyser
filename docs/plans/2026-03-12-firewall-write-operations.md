# Firewall Write Operations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toggle (enable/disable) and reorder (move up/down) operations for firewall rules, writing changes back to the UniFi controller.

**Architecture:** A thin HTTP wrapper in the backend bypasses the read-only unifi-topology library to make direct PUT requests to the UniFi V2 API. Two new endpoints expose toggle and swap-order operations. The frontend adds inline toggle switches and reorder arrows to rule cards in RulePanel, with a confirmation dialog before each action.

**Tech Stack:** Python/FastAPI/requests (backend), React/TypeScript/Tailwind (frontend), UniFi V2 API

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/app/services/firewall_writer.py` | Thin HTTP wrapper for write operations (auth, toggle, swap) |
| Create | `backend/tests/test_firewall_writer.py` | Unit tests for writer service |
| Modify | `backend/app/routers/rules.py` | Add PATCH toggle and PUT swap-order endpoints |
| Modify | `backend/tests/test_rules.py` | Add endpoint tests for toggle/swap-order |
| Modify | `frontend/src/api/types.ts` | Add request/response types for write operations |
| Modify | `frontend/src/api/client.ts` | Add `toggleRule` and `swapRuleOrder` API functions |
| Create | `frontend/src/components/ConfirmDialog.tsx` | Reusable confirmation modal |
| Create | `frontend/src/components/ConfirmDialog.test.tsx` | Tests for confirmation dialog |
| Modify | `frontend/src/components/RulePanel.tsx` | Add toggle switches, reorder arrows, confirmation flow |
| Modify | `frontend/src/components/RulePanel.test.tsx` | Tests for toggle/reorder UI |
| Modify | `frontend/src/App.tsx` | Pass `onRuleUpdated` refresh callback to RulePanel |
| Modify | `frontend/src/App.test.tsx` | Test that onRuleUpdated prop is passed |
| Modify | `frontend/e2e/fixtures.ts` | Add mock handlers for write endpoints |
| Modify | `frontend/e2e/app.spec.ts` | E2E tests for toggle and reorder |

---

## Chunk 1: Backend

### Task 1: Backend Writer Service

**Files:**
- Create: `backend/app/services/firewall_writer.py`
- Create: `backend/tests/test_firewall_writer.py`

**Context:** The unifi-topology library is read-only. This service makes direct HTTP calls to the UniFi V2 API using the `requests` library. It creates a fresh `requests.Session` per operation, authenticates using stored credentials, then performs the write. The UniFi controller is assumed to be UDM Pro (UniFi OS) since zone-based policies are only available on that platform.

**API patterns (from `unifi_topology/adapters/unifi_api.py`):**
- Auth: POST `{url}/api/auth/login` with `{"username": ..., "password": ...}`
- API base: `{url}/proxy/network`
- Policy GET: `GET {api_base}/v2/api/site/{site}/firewall-policies/{id}`
- Policy PUT: `PUT {api_base}/v2/api/site/{site}/firewall-policies/{id}` with full policy payload

- [ ] **Step 1: Write the failing tests for toggle_policy**

Create `backend/tests/test_firewall_writer.py`:

```python
from unittest.mock import MagicMock, patch

import pytest

from app.config import UnifiCredentials
from app.services.firewall_writer import WriteError, toggle_policy


def _creds() -> UnifiCredentials:
    return UnifiCredentials(
        url="https://192.168.1.1",
        username="admin",
        password="secret",
        site="default",
        verify_ssl=False,
    )


class TestTogglePolicy:
    def test_toggle_enables_policy(self) -> None:
        mock_session = MagicMock()
        # GET returns the policy
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {
            "_id": "policy-1",
            "name": "Test Rule",
            "enabled": False,
            "action": "ALLOW",
            "index": 100,
        }
        # PUT returns success
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        put_response.json.return_value = {"_id": "policy-1", "enabled": True}

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            toggle_policy(_creds(), "policy-1", enabled=True)

        # Verify PUT was called with enabled=True
        put_call = mock_session.put.call_args
        assert put_call is not None
        payload = put_call.kwargs.get("json") or put_call[1].get("json")
        assert payload["enabled"] is True

    def test_toggle_disables_policy(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {
            "_id": "policy-1",
            "name": "Test Rule",
            "enabled": True,
            "action": "ALLOW",
            "index": 100,
        }
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        put_response.json.return_value = {"_id": "policy-1", "enabled": False}

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            toggle_policy(_creds(), "policy-1", enabled=False)

        put_call = mock_session.put.call_args
        payload = put_call.kwargs.get("json") or put_call[1].get("json")
        assert payload["enabled"] is False

    def test_toggle_raises_on_get_failure(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 404
        get_response.json.return_value = {"error": "not found"}
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="404"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=True)

    def test_toggle_raises_on_put_failure(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "policy-1", "enabled": True, "index": 100}
        put_response = MagicMock()
        put_response.ok = False
        put_response.status_code = 400
        put_response.json.return_value = {"error": "bad request"}
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="400"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=False)

    def test_toggle_raises_on_expired_session(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 401
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="Session expired"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=True)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_firewall_writer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.firewall_writer'`

- [ ] **Step 3: Write the toggle_policy implementation**

Create `backend/app/services/firewall_writer.py`:

```python
"""Write operations for UniFi firewall policies.

Thin HTTP wrapper that bypasses the read-only unifi-topology library
for mutation operations (toggle, reorder).  Assumes UDM Pro (UniFi OS)
since zone-based policies are only available on that platform.
"""

from __future__ import annotations

import requests

from app.config import UnifiCredentials


class WriteError(Exception):
    """A write operation to the UniFi controller failed."""


def _build_api_base(url: str) -> str:
    """Build the API base URL for UDM Pro."""
    return f"{url.rstrip('/')}/proxy/network"


def _get_session(credentials: UnifiCredentials) -> requests.Session:
    """Create an authenticated requests.Session."""
    if not credentials.verify_ssl:
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()
    login_url = f"{credentials.url.rstrip('/')}/api/auth/login"
    try:
        resp = session.post(
            login_url,
            json={"username": credentials.username, "password": credentials.password},
            verify=credentials.verify_ssl,
        )
    except requests.RequestException as exc:
        raise WriteError(f"Authentication failed: {exc}") from exc
    if not resp.ok:
        raise WriteError(f"Authentication failed (HTTP {resp.status_code})")
    return session


def _get_v2(
    session: requests.Session,
    url: str,
    path: str,
    *,
    verify_ssl: bool,
) -> dict[str, object]:
    """GET a single resource from a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.get(full_url, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        raise WriteError(f"GET {path} failed (HTTP {response.status_code})")
    payload = response.json()
    if isinstance(payload, list):
        if len(payload) != 1:
            raise WriteError(f"Expected single policy, got {len(payload)}")
        return payload[0]
    return payload


def _get_v2_list(
    session: requests.Session,
    url: str,
    path: str,
    *,
    verify_ssl: bool,
) -> list[dict[str, object]]:
    """GET a list of resources from a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.get(full_url, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        raise WriteError(f"GET {path} failed (HTTP {response.status_code})")
    payload = response.json()
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    raise WriteError(f"Unexpected response format for {path}")


def _put_v2(
    session: requests.Session,
    url: str,
    path: str,
    payload: dict[str, object],
    *,
    verify_ssl: bool,
) -> None:
    """PUT to a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.put(full_url, json=payload, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise WriteError(f"PUT {path} failed (HTTP {response.status_code}): {detail}")


def toggle_policy(
    credentials: UnifiCredentials,
    policy_id: str,
    *,
    enabled: bool,
) -> None:
    """Toggle a firewall policy's enabled state."""
    session = _get_session(credentials)
    path = f"/v2/api/site/{credentials.site}/firewall-policies/{policy_id}"
    policy = _get_v2(session, credentials.url, path, verify_ssl=credentials.verify_ssl)
    policy["enabled"] = enabled
    _put_v2(session, credentials.url, path, policy, verify_ssl=credentials.verify_ssl)


def swap_policy_order(
    credentials: UnifiCredentials,
    policy_id_a: str,
    policy_id_b: str,
) -> None:
    """Swap the index (priority) of two firewall policies."""
    session = _get_session(credentials)
    base_path = f"/v2/api/site/{credentials.site}/firewall-policies"
    all_policies = _get_v2_list(session, credentials.url, base_path, verify_ssl=credentials.verify_ssl)

    policy_a = next((p for p in all_policies if p.get("_id") == policy_id_a), None)
    policy_b = next((p for p in all_policies if p.get("_id") == policy_id_b), None)

    if not policy_a or not policy_b:
        missing = [pid for pid, p in [(policy_id_a, policy_a), (policy_id_b, policy_b)] if not p]
        raise WriteError(f"Policy not found: {', '.join(missing)}")

    idx_a = policy_a["index"]
    idx_b = policy_b["index"]
    policy_a["index"] = idx_b
    policy_b["index"] = idx_a

    _put_v2(session, credentials.url, f"{base_path}/{policy_id_a}", policy_a, verify_ssl=credentials.verify_ssl)
    _put_v2(session, credentials.url, f"{base_path}/{policy_id_b}", policy_b, verify_ssl=credentials.verify_ssl)
```

- [ ] **Step 4: Run toggle tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_firewall_writer.py::TestTogglePolicy -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing tests for swap_policy_order**

Append to `backend/tests/test_firewall_writer.py`:

```python
from app.services.firewall_writer import swap_policy_order


class TestSwapPolicyOrder:
    def test_swap_exchanges_indices(self) -> None:
        mock_session = MagicMock()
        # GET returns list of policies
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [
            {"_id": "policy-a", "name": "Rule A", "index": 100},
            {"_id": "policy-b", "name": "Rule B", "index": 200},
            {"_id": "policy-c", "name": "Rule C", "index": 300},
        ]
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            swap_policy_order(_creds(), "policy-a", "policy-b")

        # Two PUT calls should have been made
        assert mock_session.put.call_count == 2
        first_put = mock_session.put.call_args_list[0]
        second_put = mock_session.put.call_args_list[1]
        first_payload = first_put.kwargs.get("json") or first_put[1].get("json")
        second_payload = second_put.kwargs.get("json") or second_put[1].get("json")
        # Indices should be swapped
        assert first_payload["index"] == 200
        assert second_payload["index"] == 100

    def test_swap_raises_when_policy_not_found(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [
            {"_id": "policy-a", "name": "Rule A", "index": 100},
        ]
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="not found"),
        ):
            swap_policy_order(_creds(), "policy-a", "policy-missing")

    def test_swap_raises_on_expired_session(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 401
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="Session expired"),
        ):
            swap_policy_order(_creds(), "policy-a", "policy-b")
```

- [ ] **Step 6: Run swap tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_firewall_writer.py::TestSwapPolicyOrder -v`
Expected: PASS (3 tests)

- [ ] **Step 7: Write the failing tests for authentication**

Append to `backend/tests/test_firewall_writer.py`:

```python
class TestAuthentication:
    def test_toggle_authenticates_with_controller(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "p1", "enabled": True, "index": 1}
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response
        auth_response = MagicMock()
        auth_response.ok = True
        mock_session.post.return_value = auth_response

        with patch("app.services.firewall_writer.requests.Session", return_value=mock_session):
            toggle_policy(_creds(), "p1", enabled=False)

        mock_session.post.assert_called_once()
        call_args = mock_session.post.call_args
        assert "/api/auth/login" in call_args[0][0]
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        assert payload["username"] == "admin"
        assert payload["password"] == "secret"

    def test_raises_on_auth_failure(self) -> None:
        mock_session = MagicMock()
        auth_response = MagicMock()
        auth_response.ok = False
        auth_response.status_code = 401
        mock_session.post.return_value = auth_response

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            pytest.raises(WriteError, match="Authentication failed"),
        ):
            toggle_policy(_creds(), "p1", enabled=True)

    def test_raises_on_connection_error(self) -> None:
        import requests as req

        mock_session = MagicMock()
        mock_session.post.side_effect = req.ConnectionError("refused")

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            pytest.raises(WriteError, match="Authentication failed"),
        ):
            toggle_policy(_creds(), "p1", enabled=True)
```

- [ ] **Step 8: Run all writer tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_firewall_writer.py -v`
Expected: PASS (11 tests)

- [ ] **Step 9: Run mypy on the writer service**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run mypy app/services/firewall_writer.py`
Expected: PASS with no errors. Fix any type errors before proceeding.

- [ ] **Step 10: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add backend/app/services/firewall_writer.py backend/tests/test_firewall_writer.py
git commit -m "feat: add firewall writer service for toggle and reorder operations"
```

---

### Task 2: Backend Endpoints

**Files:**
- Modify: `backend/app/routers/rules.py`
- Modify: `backend/tests/test_rules.py`

**Context:** Add two new endpoints to the existing rules router. Follow the same pattern as existing endpoints: check credentials, get config, call service, handle errors. The `WriteError` exception from the writer service maps to HTTP 502 (controller communication error).

- [ ] **Step 1: Write the failing tests for toggle endpoint**

Append to `backend/tests/test_rules.py`:

```python
from unittest.mock import patch

from app.services.firewall_writer import WriteError


@pytest.mark.anyio
async def test_toggle_requires_credentials(client: AsyncClient) -> None:
    resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": False})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_toggle_calls_writer(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.toggle_policy") as mock_toggle:
        resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": False})
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_toggle.assert_called_once()
    call_kwargs = mock_toggle.call_args
    assert call_kwargs[0][1] == "rule-1"  # policy_id
    assert call_kwargs[1]["enabled"] is False


@pytest.mark.anyio
async def test_toggle_returns_502_on_write_error(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.toggle_policy", side_effect=WriteError("controller error")):
        resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": True})
    assert resp.status_code == 502
    assert "controller error" in resp.json()["detail"]
```

- [ ] **Step 2: Run toggle endpoint tests to verify they fail**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_rules.py::test_toggle_requires_credentials tests/test_rules.py::test_toggle_calls_writer tests/test_rules.py::test_toggle_returns_502_on_write_error -v`
Expected: FAIL (endpoint not defined)

- [ ] **Step 3: Implement toggle endpoint**

Edit `backend/app/routers/rules.py` -- add imports and endpoint:

At the top, add to imports:
```python
from pydantic import BaseModel

from app.services.firewall_writer import WriteError, toggle_policy, swap_policy_order
```

After the existing `list_zone_pairs` function, add:

```python
class ToggleRequest(BaseModel):
    enabled: bool


@router.patch("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, body: ToggleRequest) -> dict[str, str]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None
    try:
        toggle_policy(credentials, rule_id, enabled=body.enabled)
    except WriteError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok"}
```

- [ ] **Step 4: Run toggle endpoint tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_rules.py::test_toggle_requires_credentials tests/test_rules.py::test_toggle_calls_writer tests/test_rules.py::test_toggle_returns_502_on_write_error -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing tests for swap-order endpoint**

Append to `backend/tests/test_rules.py`:

```python
@pytest.mark.anyio
async def test_swap_order_requires_credentials(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/rules/reorder",
        json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_swap_order_calls_writer(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.swap_policy_order") as mock_swap:
        resp = await client.put(
            "/api/rules/reorder",
            json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_swap.assert_called_once()
    args = mock_swap.call_args[0]
    assert args[1] == "rule-1"
    assert args[2] == "rule-2"


@pytest.mark.anyio
async def test_swap_order_returns_502_on_write_error(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.swap_policy_order", side_effect=WriteError("swap failed")):
        resp = await client.put(
            "/api/rules/reorder",
            json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
        )
    assert resp.status_code == 502
    assert "swap failed" in resp.json()["detail"]
```

- [ ] **Step 6: Implement swap-order endpoint**

Add to `backend/app/routers/rules.py` after the toggle endpoint:

```python
class SwapOrderRequest(BaseModel):
    policy_id_a: str
    policy_id_b: str


@router.put("/rules/reorder")
async def reorder_rules(body: SwapOrderRequest) -> dict[str, str]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None
    try:
        swap_policy_order(credentials, body.policy_id_a, body.policy_id_b)
    except WriteError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok"}
```

- [ ] **Step 7: Run all rules tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest tests/test_rules.py -v`
Expected: PASS (all tests including new ones)

- [ ] **Step 8: Run mypy on the modified router**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run mypy app/routers/rules.py`
Expected: PASS

- [ ] **Step 9: Run all backend tests**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/backend && uv run pytest`
Expected: PASS (all existing + new tests)

- [ ] **Step 10: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add backend/app/routers/rules.py backend/tests/test_rules.py
git commit -m "feat: add toggle and swap-order endpoints for firewall rules"
```

---

## Chunk 2: Frontend

### Task 3: Frontend API Types and Client

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add write operation types**

Add to the end of `frontend/src/api/types.ts`:

```typescript
export interface ToggleRuleRequest {
  enabled: boolean;
}

export interface SwapOrderRequest {
  policy_id_a: string;
  policy_id_b: string;
}
```

- [ ] **Step 2: Add API client functions**

Add two new methods to the `api` object in `frontend/src/api/client.ts`:

```typescript
toggleRule: (ruleId: string, enabled: boolean) =>
  fetchJson(`/rules/${ruleId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  }),
swapRuleOrder: (policyIdA: string, policyIdB: string) =>
  fetchJson("/rules/reorder", {
    method: "PUT",
    body: JSON.stringify({ policy_id_a: policyIdA, policy_id_b: policyIdB }),
  }),
```

Also add `ToggleRuleRequest` and `SwapOrderRequest` to the import list at the top (if type-checked elsewhere).

- [ ] **Step 3: Run tsc to verify types compile**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat: add toggleRule and swapRuleOrder API client functions"
```

---

### Task 4: Confirmation Dialog Component

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Create: `frontend/src/components/ConfirmDialog.test.tsx`

**Context:** A simple modal dialog used before any write operation. Must have a backdrop, title, message, confirm button, and cancel button. Follow existing styling patterns from the codebase (Tailwind dark mode tokens, font tokens).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ConfirmDialog.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    title: "Confirm Action",
    message: "Are you sure?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();
  });

  it("renders title and message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirm Action")).toBeVisible();
    expect(screen.getByText("Are you sure?")).toBeVisible();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses custom confirm label", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, disable" />);
    expect(screen.getByRole("button", { name: "Yes, disable" })).toBeVisible();
  });

  it("calls onCancel when backdrop clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("confirm-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ConfirmDialog**

Create `frontend/src/components/ConfirmDialog.tsx`:

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      data-testid="confirm-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text">
          {title}
        </h3>
        <p className="mt-2 text-xs text-gray-600 dark:text-noc-text-secondary">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-noc-border text-gray-700 dark:text-noc-text-secondary hover:bg-gray-50 dark:hover:bg-noc-raised cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-ub-blue text-white hover:bg-ub-blue-light cursor-pointer transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Run tsc**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx
git commit -m "feat: add reusable confirmation dialog component"
```

---

### Task 5: RulePanel Toggle and Reorder UI

**Files:**
- Modify: `frontend/src/components/RulePanel.tsx`
- Modify: `frontend/src/App.tsx`

**Context:** Add inline toggle switch and reorder arrows to rule card headers in RulePanel. Both actions show a ConfirmDialog before executing. After a successful write, call `onRuleUpdated` (passed from App.tsx) to refetch all data.

Important implementation details:
- Toggle and reorder controls must use `e.stopPropagation()` to prevent triggering rule expand/collapse
- Predefined rules (`rule.predefined === true`) should NOT show toggle or reorder controls
- The first rule should not have a "move up" button; the last rule should not have a "move down" button
- Show loading state on the affected rule while the write is in progress
- Show error toast if the write fails

- [ ] **Step 1: Add `onRuleUpdated` prop to RulePanel**

Edit `frontend/src/components/RulePanel.tsx`:

Update the `RulePanelProps` interface:
```typescript
interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  aiConfigured: boolean;
  onClose: () => void;
  onRuleUpdated: () => void;
}
```

Add `onRuleUpdated` to the destructured props in the default export function signature.

- [ ] **Step 2: Add state for confirmation dialog and write operations**

Add to the `RulePanelState` interface:
```typescript
writeLoading: string | null; // rule ID currently being written
writeError: string | null;
```

Add to `initialState`:
```typescript
writeLoading: null,
writeError: null,
```

Add state for the confirm dialog (use `useState` since it's UI-only state):
```typescript
const [confirmAction, setConfirmAction] = useState<{
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
} | null>(null);
```

- [ ] **Step 3: Add toggle handler**

Add handler function inside the `RulePanel` component:

```typescript
function handleToggle(rule: Rule) {
  setConfirmAction({
    title: `${rule.enabled ? "Disable" : "Enable"} Rule`,
    message: `${rule.enabled ? "Disable" : "Enable"} "${rule.name}"? This change applies immediately to the controller.`,
    confirmLabel: rule.enabled ? "Disable" : "Enable",
    action: async () => {
      dispatch({ writeLoading: rule.id, writeError: null });
      try {
        await api.toggleRule(rule.id, !rule.enabled);
        onRuleUpdated();
      } catch (err) {
        dispatch({ writeError: err instanceof Error ? err.message : "Toggle failed" });
      } finally {
        dispatch({ writeLoading: null });
      }
    },
  });
}
```

- [ ] **Step 4: Add swap handler**

Add handler function inside the `RulePanel` component:

```typescript
function handleSwap(ruleA: Rule, ruleB: Rule, direction: "up" | "down") {
  const target = direction === "up" ? ruleB : ruleA;
  setConfirmAction({
    title: `Move Rule ${direction === "up" ? "Up" : "Down"}`,
    message: `Move "${target.name}" ${direction}? This changes rule evaluation order on the controller.`,
    confirmLabel: `Move ${direction}`,
    action: async () => {
      dispatch({ writeLoading: target.id, writeError: null });
      try {
        await api.swapRuleOrder(ruleA.id, ruleB.id);
        onRuleUpdated();
      } catch (err) {
        dispatch({ writeError: err instanceof Error ? err.message : "Reorder failed" });
      } finally {
        dispatch({ writeLoading: null });
      }
    },
  });
}
```

- [ ] **Step 5: Add toggle switch and reorder controls to rule card header**

In the rule card's header `div` (the one with `flex items-center justify-between gap-1`), between the rule name and the action badges, add controls. Only show for non-predefined rules.

Inside the `shrink-0` div that contains badges, add before the existing badges:

```tsx
{!rule.predefined && (
  <>
    {idx > 0 && (
      <button
        aria-label={`Move ${rule.name} up`}
        onClick={(e) => { e.stopPropagation(); handleSwap(sortedRules[idx - 1], rule, "up"); }}
        disabled={state.writeLoading !== null}
        className="p-0.5 text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text disabled:opacity-30 cursor-pointer transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7.5l3.5-3.5 3.5 3.5" /></svg>
      </button>
    )}
    {idx < sortedRules.length - 1 && (
      <button
        aria-label={`Move ${rule.name} down`}
        onClick={(e) => { e.stopPropagation(); handleSwap(rule, sortedRules[idx + 1], "down"); }}
        disabled={state.writeLoading !== null}
        className="p-0.5 text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text disabled:opacity-30 cursor-pointer transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" /></svg>
      </button>
    )}
    <button
      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
      onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
      disabled={state.writeLoading !== null}
      className="relative w-7 h-4 rounded-full cursor-pointer transition-colors disabled:opacity-30"
      style={{ backgroundColor: rule.enabled ? "var(--color-status-success)" : "var(--color-noc-text-dim, #9ca3af)" }}
    >
      <span className={`absolute top-0.5 ${rule.enabled ? "left-3.5" : "left-0.5"} w-3 h-3 rounded-full bg-white shadow transition-all`} />
    </button>
  </>
)}
```

- [ ] **Step 6: Add loading indicator on affected rule**

In the rule card, if `state.writeLoading === rule.id`, add a subtle pulsing overlay or opacity change. Modify the rule card's outer div className to include:

```tsx
${state.writeLoading === rule.id ? "opacity-60 pointer-events-none animate-pulse" : ""}
```

- [ ] **Step 7: Add write error display**

After the rules list section, add:

```tsx
{state.writeError && (
  <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
    {state.writeError}
  </div>
)}
```

- [ ] **Step 8: Add ConfirmDialog render**

At the end of the RulePanel return, after the closing `</div>`, add:

```tsx
<ConfirmDialog
  open={confirmAction !== null}
  title={confirmAction?.title ?? ""}
  message={confirmAction?.message ?? ""}
  confirmLabel={confirmAction?.confirmLabel}
  onConfirm={async () => {
    const action = confirmAction?.action;
    setConfirmAction(null);
    if (action) await action();
  }}
  onCancel={() => setConfirmAction(null)}
/>
```

Add the import at the top:
```typescript
import ConfirmDialog from "./ConfirmDialog";
```

**Important:** The ConfirmDialog must be rendered outside the scrollable panel container. Change the RulePanel return from `return (<div className="w-[400px]...">...</div>)` to:
```tsx
return (
  <>
    <div className="w-[400px]...">...</div>
    <ConfirmDialog ... />
  </>
);
```

- [ ] **Step 9: Pass `onRuleUpdated` from App.tsx**

Edit `frontend/src/App.tsx`:

Find where `<RulePanel>` is rendered and add the `onRuleUpdated` prop:

```tsx
<RulePanel
  pair={selectedPair}
  sourceZoneName={...}
  destZoneName={...}
  aiConfigured={aiConfigured}
  onClose={...}
  onRuleUpdated={refresh}
/>
```

The `refresh` function already exists from `useFirewallData`.

- [ ] **Step 10: Run tsc**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/src/components/RulePanel.tsx frontend/src/App.tsx
git commit -m "feat: add toggle and reorder controls to rule panel"
```

---

### Task 6: Frontend Tests for Toggle and Reorder

**Files:**
- Modify: `frontend/src/components/RulePanel.test.tsx`
- Modify: `frontend/src/App.test.tsx`

**Context:** The test file uses `vi.mock("../api/client")` with an explicit factory. The `makeRule()` helper defaults to `id: "r1"` and the `renderPanel()` helper needs updating. The `makePair()` helper is already available.

- [ ] **Step 1: Update mock factory and renderPanel helper**

In `frontend/src/components/RulePanel.test.tsx`, update the mock factory (lines 6-11) to include the new API functions:

```typescript
vi.mock("../api/client", () => ({
  api: {
    simulate: vi.fn(),
    analyzeWithAi: vi.fn(),
    toggleRule: vi.fn(),
    swapRuleOrder: vi.fn(),
  },
}));
```

Update the `renderPanel` helper (lines 72-82) to include `onRuleUpdated`:

```typescript
function renderPanel(pair?: ZonePair, sourceZoneName = "External", destZoneName = "Internal", aiConfigured = false, onRuleUpdated = vi.fn()) {
  return render(
    <RulePanel
      pair={pair ?? makePair()}
      sourceZoneName={sourceZoneName}
      destZoneName={destZoneName}
      aiConfigured={aiConfigured}
      onClose={onClose}
      onRuleUpdated={onRuleUpdated}
    />,
  );
}
```

- [ ] **Step 2: Add toggle tests to RulePanel.test.tsx**

Add a new test group:

```typescript
describe("toggle", () => {
  it("shows toggle switch for non-predefined rules", () => {
    render(
      <RulePanel
        pair={makePair([makeRule()])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Disable Test Rule/)).toBeInTheDocument();
  });

  it("hides toggle for predefined rules", () => {
    render(
      <RulePanel
        pair={makePair([makeRule({ predefined: true, name: "Built-in" })])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/Disable Built-in/)).not.toBeInTheDocument();
  });

  it("shows confirm dialog when toggle clicked", async () => {
    render(
      <RulePanel
        pair={makePair([makeRule()])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Disable Test Rule/));
    expect(screen.getByText(/Disable "Test Rule"/)).toBeVisible();
  });

  it("calls toggleRule API on confirm", async () => {
    const onRuleUpdated = vi.fn();
    vi.mocked(api.toggleRule).mockResolvedValue(undefined);
    render(
      <RulePanel
        pair={makePair([makeRule()])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={onRuleUpdated}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Disable Test Rule/));
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    await waitFor(() => {
      expect(api.toggleRule).toHaveBeenCalledWith("r1", false);
    });
    await waitFor(() => {
      expect(onRuleUpdated).toHaveBeenCalled();
    });
  });

  it("does not call API when cancel clicked", () => {
    render(
      <RulePanel
        pair={makePair([makeRule()])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Disable Test Rule/));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.toggleRule).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add reorder tests to RulePanel.test.tsx**

```typescript
describe("reorder", () => {
  it("shows move down button on first rule, no move up", () => {
    render(
      <RulePanel
        pair={makePair([makeRule({ index: 100 }), makeRule({ id: "r2", name: "Rule 2", index: 200 })])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Move Test Rule down/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Move Test Rule up/)).not.toBeInTheDocument();
  });

  it("shows move up button on last rule, no move down", () => {
    render(
      <RulePanel
        pair={makePair([makeRule({ index: 100 }), makeRule({ id: "r2", name: "Rule 2", index: 200 })])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Move Rule 2 up/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Move Rule 2 down/)).not.toBeInTheDocument();
  });

  it("calls swapRuleOrder API on confirm", async () => {
    const onRuleUpdated = vi.fn();
    vi.mocked(api.swapRuleOrder).mockResolvedValue(undefined);
    render(
      <RulePanel
        pair={makePair([makeRule({ index: 100 }), makeRule({ id: "r2", name: "Rule 2", index: 200 })])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={onRuleUpdated}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Move Test Rule down/));
    fireEvent.click(screen.getByRole("button", { name: /Move down/ }));
    await waitFor(() => {
      expect(api.swapRuleOrder).toHaveBeenCalledWith("r1", "r2");
    });
    await waitFor(() => {
      expect(onRuleUpdated).toHaveBeenCalled();
    });
  });

  it("hides reorder buttons for predefined rules", () => {
    render(
      <RulePanel
        pair={makePair([
          makeRule({ index: 100 }),
          makeRule({ id: "r2", name: "Built-in", index: 200, predefined: true }),
        ])}
        sourceZoneName="Internal"
        destZoneName="External"
        aiConfigured={false}
        onClose={vi.fn()}
        onRuleUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/Move Built-in/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Update existing RulePanel tests to include onRuleUpdated prop**

All existing `<RulePanel>` renders in the test file need `onRuleUpdated={vi.fn()}` added. This is a mechanical find-and-replace:

Search for `onClose={` and add `onRuleUpdated={vi.fn()}` after each `onClose` prop.

- [ ] **Step 4: Run RulePanel tests**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx vitest run src/components/RulePanel.test.tsx`
Expected: PASS (all existing + new tests)

- [ ] **Step 5: Update App.test.tsx mock factory**

The `App.test.tsx` mock factory (lines 7-24) uses an explicit list of API functions. Add the new functions:

```typescript
// Add to the api mock object in App.test.tsx:
toggleRule: vi.fn(),
swapRuleOrder: vi.fn(),
```

Insert these after the `analyzeWithAi: vi.fn(),` line in the mock factory.

- [ ] **Step 6: Run all frontend tests**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx vitest run --coverage`
Expected: PASS with coverage >= 95% thresholds

- [ ] **Step 7: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/src/components/RulePanel.test.tsx frontend/src/App.test.tsx
git commit -m "test: add toggle and reorder tests for RulePanel"
```

---

### Task 7: E2E Tests

**Files:**
- Modify: `frontend/e2e/fixtures.ts`
- Modify: `frontend/e2e/app.spec.ts`

**Context:** The e2e tests use `page.route()` to mock all API calls at browser level. Add mock handlers for the two new endpoints and write tests for the toggle and reorder flows.

- [ ] **Step 1: Add mock handlers for write endpoints**

In `frontend/e2e/fixtures.ts`, inside the `mockApi` function, add route handlers:

```typescript
// Toggle rule
await page.route("**/api/rules/*/toggle", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
);

// Swap rule order
await page.route("**/api/rules/reorder", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
);
```

- [ ] **Step 2: Add e2e test for toggle flow**

Add to `frontend/e2e/app.spec.ts`:

```typescript
test.describe("rule toggle", () => {
  test("toggle shows confirm dialog and completes", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    // Find and click a toggle switch (aria-label contains "Disable" or "Enable")
    const toggle = page.getByLabel(/Disable|Enable/).first();
    await toggle.click();

    // Confirm dialog should appear
    await expect(page.getByText(/This change applies immediately/)).toBeVisible();

    // Click confirm
    await page.getByRole("button", { name: /Disable|Enable/ }).click();

    // Dialog should close
    await expect(page.getByText(/This change applies immediately/)).not.toBeVisible();
  });
});
```

- [ ] **Step 3: Add e2e test for reorder flow**

```typescript
test.describe("rule reorder", () => {
  test("move down shows confirm dialog and completes", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    // Find a "move down" button
    const moveDown = page.getByLabel(/Move .+ down/).first();
    await moveDown.click();

    // Confirm dialog
    await expect(page.getByText(/changes rule evaluation order/)).toBeVisible();

    // Confirm
    await page.getByRole("button", { name: /Move down/ }).click();
    await expect(page.getByText(/changes rule evaluation order/)).not.toBeVisible();
  });
});
```

- [ ] **Step 4: Run e2e tests**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend && npx playwright test`
Expected: PASS

- [ ] **Step 5: Run all quality checks**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser && make ci`
Expected: PASS (all linting, type checking, tests, complexity)

- [ ] **Step 6: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/e2e/fixtures.ts frontend/e2e/app.spec.ts
git commit -m "test: add e2e tests for rule toggle and reorder"
```

---

## Known Risks

1. **UniFi V2 API contract for PUT**: The PUT endpoint and payload format for `/v2/api/site/{site}/firewall-policies/{id}` is inferred from GET responses. Needs verification against a real controller. If the API requires specific fields or a different shape, `firewall_writer.py` will need adjustment.

2. **Predefined rules**: The controller may reject attempts to modify predefined rules. The UI prevents this, but the backend should also handle it gracefully if it happens.

3. **Concurrent writes**: If two users modify rules simultaneously, the last write wins. No optimistic locking is implemented. Acceptable for v1 since this is a single-user tool.

4. **Partial failure during swap**: `swap_policy_order` performs two sequential PUTs. If the first succeeds but the second fails, rule indices will be inconsistent. A manual refresh and retry should recover. Acceptable for v1.
