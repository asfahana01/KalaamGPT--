import io
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from services.did_avatar import DidAvatarError, _request, create_talk, get_talk


class FakeResponse:
    def __init__(self, body):
        self.body = json.dumps(body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self):
        return self.body


class DidAvatarTests(unittest.TestCase):
    @patch("services.did_avatar.urlopen")
    def test_create_talk_sends_synthetic_voice_and_image(self, urlopen):
        urlopen.return_value = FakeResponse({"id": "tlk_123", "status": "created"})

        result = create_talk(
            "api-user:api-password",
            "https://example.test/avatar.jpg",
            "Hello there.",
            "en-IN-PrabhatNeural",
            0.9,
        )

        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(result["status"], "created")
        self.assertEqual(request.full_url, "https://api.d-id.com/talks")
        self.assertEqual(
            payload["script"]["provider"],
            {
                "type": "microsoft",
                "voice_id": "en-IN-PrabhatNeural",
                "voice_config": {"rate": "0.9"},
            },
        )
        self.assertEqual(payload["source_url"], "https://example.test/avatar.jpg")
        self.assertTrue(request.get_header("Authorization").startswith("Basic "))

    @patch("services.did_avatar.urlopen")
    def test_get_talk_quotes_provider_id(self, urlopen):
        urlopen.return_value = FakeResponse({"status": "started"})

        result = get_talk("api-user:api-password", "tlk/a")

        self.assertEqual(result["status"], "started")
        self.assertEqual(urlopen.call_args.args[0].full_url, "https://api.d-id.com/talks/tlk%2Fa")

    def test_rejects_malformed_api_key(self):
        with self.assertRaises(DidAvatarError):
            create_talk("", "https://example.test/avatar.jpg", "Hello.", "en-IN-PrabhatNeural", 0.9)

    @patch("services.did_avatar.urlopen")
    def test_402_insufficient_credits_is_classified_without_raw_body(self, urlopen):
        urlopen.side_effect = HTTPError(
            "https://api.d-id.com/talks",
            402,
            "Payment Required",
            {},
            io.BytesIO(json.dumps({
                "kind": "InsufficientCreditsError",
                "description": "not enough credits",
                "internal": "private provider diagnostic",
            }).encode("utf-8")),
        )

        with self.assertRaises(DidAvatarError) as raised:
            _request("api-user:api-password", "/talks", {"text": "hello"})

        error = raised.exception
        self.assertEqual(error.status_code, 402)
        self.assertEqual(error.category, "insufficient_credits")
        self.assertEqual(error.provider_kind, "InsufficientCreditsError")
        self.assertIn("insufficient credits", str(error).lower())
        self.assertNotIn("private provider diagnostic", str(error))

    @patch("services.did_avatar.urlopen")
    def test_402_without_known_detail_does_not_assume_insufficient_credits(self, urlopen):
        urlopen.side_effect = HTTPError(
            "https://api.d-id.com/talks",
            402,
            "Payment Required",
            {},
            io.BytesIO(json.dumps({
                "kind": "AccountRestrictionError",
                "description": "account action required",
            }).encode("utf-8")),
        )

        with self.assertRaises(DidAvatarError) as raised:
            _request("api-user:api-password", "/talks", {"text": "hello"})

        error = raised.exception
        self.assertEqual(error.status_code, 402)
        self.assertEqual(error.category, "payment_required")
        self.assertEqual(error.provider_kind, "AccountRestrictionError")
        self.assertNotIn("account action required", str(error))

    @patch("services.did_avatar.urlopen")
    def test_other_provider_status_does_not_expose_raw_description(self, urlopen):
        urlopen.side_effect = HTTPError(
            "https://api.d-id.com/talks",
            401,
            "Unauthorized",
            {},
            io.BytesIO(json.dumps({
                "kind": "AuthorizationError",
                "description": "private provider diagnostic",
            }).encode("utf-8")),
        )

        with self.assertRaises(DidAvatarError) as raised:
            _request("api-user:api-password", "/talks", {"text": "hello"})

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.category, "provider_error")
        self.assertNotIn("private provider diagnostic", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
