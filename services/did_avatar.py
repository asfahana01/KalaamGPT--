"""Small server-side client for D-ID's photo-avatar video API."""

import base64
import json
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


API_BASE_URL = "https://api.d-id.com"


class DidAvatarError(Exception):
    """Raised when D-ID cannot create or retrieve a talking-avatar video."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        provider_kind: str | None = None,
        category: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.provider_kind = provider_kind
        self.category = category or "provider_error"


def _read_provider_error(error: HTTPError) -> DidAvatarError:
    try:
        payload = json.loads(error.read().decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, OSError):
        payload = {}

    if not isinstance(payload, dict):
        payload = {}
    kind = payload.get("kind")
    if not isinstance(kind, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{0,63}", kind):
        kind = None
    description = payload.get("description")
    if not isinstance(description, str):
        description = ""
    normalized_description = description.lower()

    if error.code == 402:
        if kind == "InsufficientCreditsError" or "not enough credits" in normalized_description:
            return DidAvatarError(
                "D-ID reports insufficient credits for video generation. Check account credits and billing.",
                status_code=402,
                provider_kind=kind or "InsufficientCreditsError",
                category="insufficient_credits",
            )
        return DidAvatarError(
            "D-ID requires an account or payment action for video generation. Check the account's billing, plan access, and credits.",
            status_code=402,
            provider_kind=kind,
            category="payment_required",
        )

    return DidAvatarError(
        f"Avatar provider returned HTTP {error.code}.",
        status_code=error.code,
        provider_kind=kind,
    )

def _authorization_header(api_key: str) -> str:
    if ":" not in api_key:
        raise DidAvatarError("D-ID API key must use the API_USER:API_PASSWORD format.")
    encoded_key = base64.b64encode(api_key.encode("utf-8")).decode("ascii")
    return f"Basic {encoded_key}"


def _request(api_key: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Authorization": _authorization_header(api_key)}
    if body is not None:
        headers["Content-Type"] = "application/json"

    request = Request(f"{API_BASE_URL}{path}", data=body, headers=headers)
    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise _read_provider_error(error) from error
    except (URLError, TimeoutError, OSError) as error:
        raise DidAvatarError("Could not connect to the avatar provider.", category="network_error") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DidAvatarError("Avatar provider returned an invalid response.") from error

    if not isinstance(result, dict):
        raise DidAvatarError("Avatar provider returned an invalid response.")
    return result


def create_talk(
    api_key: str,
    source_url: str,
    text: str,
    voice_id: str,
    rate: float,
) -> dict[str, Any]:
    return _request(
        api_key,
        "/talks",
        {
            "source_url": source_url,
            "script": {
                "type": "text",
                "input": text,
                "provider": {
                    "type": "microsoft",
                    "voice_id": voice_id,
                    "voice_config": {"rate": str(rate)},
                },
            },
        },
    )


def get_talk(api_key: str, talk_id: str) -> dict[str, Any]:
    return _request(api_key, f"/talks/{quote(talk_id, safe='')}")
