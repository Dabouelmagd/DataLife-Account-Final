"""
WebSocket authentication.

The notification and sync sockets accepted anyone who knew (or guessed) a
user id / company id and pushed that user's notifications or that company's
live updates to them. A socket now needs the same staff JWT as the REST API:
either `?token=` in the URL or, preferably (keeps it out of proxy logs), a
first message `{"type": "auth", "token": "..."}` within AUTH_TIMEOUT seconds.
Anything else is closed with code 4401.
"""
import asyncio
import json
from typing import Optional

AUTH_TIMEOUT = 5
CLOSE_UNAUTHORIZED = 4401


def _verify(token: str) -> Optional[dict]:
    from services.auth_service import verify_token
    if not token:
        return None
    payload = verify_token(token)
    if not payload or not payload.get("user_id"):
        return None
    # «معاينة بوابة الموظف» tokens read the employee portal over REST only;
    # the company sync socket would push live company data to them
    from services.route_permissions import is_preview_token
    if is_preview_token(payload):
        return None
    return payload


async def authenticate_websocket(websocket) -> Optional[dict]:
    """Accept the socket and return the token payload, or close it (4401) and
    return None."""
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token:
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT)
        except Exception:
            raw = ""
        try:
            msg = json.loads(raw)
            token = msg.get("token") if isinstance(msg, dict) and msg.get("type") == "auth" else None
        except Exception:
            token = None
    payload = _verify(token)
    if not payload:
        try:
            await websocket.close(code=CLOSE_UNAUTHORIZED)
        except Exception:
            pass
        return None
    return payload


async def reject(websocket) -> None:
    try:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
    except Exception:
        pass
