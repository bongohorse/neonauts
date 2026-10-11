"""Strict policy for external URLs imported from Awesomenauts Wiki snapshots.

Source HTML is untrusted input; HTML escaping alone doesn't make an href safe.
"""
from urllib.parse import urlsplit

WIKI_HOST = "awesomenauts.fandom.com"
MAX_URL_LENGTH = 4096


def require_wiki_url(value, context="Wiki URL"):
    if type(value) is not str or not value or len(value) > MAX_URL_LENGTH:
        raise ValueError(f"{context}: missing or oversized external Wiki URL")
    if value != value.strip() or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError(f"{context}: whitespace/control characters are not allowed")
    if "\\" in value:
        raise ValueError(f"{context}: backslashes are forbidden in external URLs")
    try:
        parsed = urlsplit(value)
        allowed = (
            parsed.scheme == "https"
            and parsed.hostname == WIKI_HOST
            and parsed.port in (None, 443)
            and parsed.username is None
            and parsed.password is None
            and parsed.path.startswith("/wiki/")
            and len(parsed.path) > len("/wiki/")
        )
    except ValueError:
        allowed = False
    if not allowed:
        raise ValueError(f"{context}: expected an absolute HTTPS URL on {WIKI_HOST}/wiki/")
    return value


def validate_naut_urls(data):
    """Validate all canonical and linked source URLs before writing or building."""
    slug = data.get("slug", "unknown") if isinstance(data, dict) else "unknown"
    require_wiki_url(data["source"]["url"], f"{slug}: canonical source")
    for group in ("abilities", "items"):
        for index, record in enumerate(data[group], 1):
            require_wiki_url(record["source_url"], f"{slug}: {group}[{index}] source")
    return data
