#!/usr/bin/env python3
"""Validate and incrementally publish the generated site using the Neocities API.

Never deletes remote files. No network writes in --dry-run mode.
"""
import argparse
import hashlib
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://neocities.org/api"
# Neocities documents a 100 MB limit for each multipart request. Rack's
# default limit is 128 file parts; leave headroom for either server setting.
MAX_REQUEST_BYTES = 90 * 1024 * 1024
MAX_FILES_PER_REQUEST = 100
BETWEEN_BATCHES_SECONDS = 2
MIN_UPDATE_INTERVAL_SECONDS = 10 * 60
ALLOWED_EXTENSIONS = frozenset({
    ".html", ".htm", ".css", ".js", ".mjs", ".json", ".webp",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".avif",
    ".woff", ".woff2", ".ttf", ".eot", ".txt", ".xml",
    ".webmanifest", ".map",
})


def expected_site(config_path):
    settings = json.loads(config_path.read_text(encoding="utf-8"))
    url = urlsplit(settings.get("siteUrl", ""))
    if (url.scheme != "https" or not url.hostname or
            not url.hostname.endswith(".neocities.org") or
            url.path not in ("", "/") or url.query or url.fragment or url.username):
        raise ValueError("site.config.json must identify an HTTPS *.neocities.org site origin")
    name = url.hostname.removesuffix(".neocities.org")
    if not name or "." in name:
        raise ValueError("Invalid Neocities site name in siteUrl")
    return name


def api_json(endpoint, key, data=None, content_type=None):
    headers = {"Authorization": "Bearer " + key, "User-Agent": "neonauts-deploy/1"}
    if content_type:
        headers["Content-Type"] = content_type
    request = Request(API + endpoint, data=data, headers=headers,
                      method="POST" if data is not None else "GET")
    try:
        with urlopen(request, timeout=180) as response:
            answer = json.load(response)
    except HTTPError as error:
        # Do not print the token or untrusted response bodies.
        raise RuntimeError(f"Neocities API {endpoint} failed with HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"Neocities API {endpoint} connection failed") from error
    if not isinstance(answer, dict) or answer.get("result") != "success":
        error_type = answer.get("error_type", "invalid_response") if isinstance(answer, dict) else "invalid_response"
        raise RuntimeError(f"Neocities API {endpoint} refused the request: {error_type}")
    return answer


def collect_files(directory):
    if not directory.is_dir():
        raise ValueError("Missing build output directory")
    files = []
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Refusing symlink in build: {path}")
        if not path.is_file():
            continue
        relative = path.relative_to(directory)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported Neocities file extension: {relative.as_posix()}")
        if path.stat().st_size > MAX_REQUEST_BYTES - 4096:
            raise ValueError(f"File exceeds safe Neocities upload limit: {relative.as_posix()}")
        files.append((relative.as_posix(), path))
    if not files or not any(name == "index.html" for name, _ in files):
        raise ValueError("Expected a built site with a root index.html")
    return files


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remote_files(answer):
    files = answer.get("files")
    if not isinstance(files, list):
        raise RuntimeError("Neocities file listing is incomplete")
    result = {}
    for item in files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise RuntimeError("Invalid Neocities file listing")
        if item.get("is_directory"):
            continue
        if (not isinstance(item.get("sha1_hash"), str) or
                len(item["sha1_hash"]) != 40 or
                not isinstance(item.get("size"), int)):
            raise RuntimeError("Neocities file listing lacks required hash or size")
        result[item["path"].lstrip("/")] = item
    return result


def multipart(files, boundary):
    body = bytearray()
    for name, path in files:
        if any(ch in name for ch in ('"', "\r", "\n")):
            raise ValueError("Unsafe upload filename")
        body.extend(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n'.encode()
        )
        body.extend(path.read_bytes())
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    return bytes(body)


def is_entrypoint(name):
    """HTML is published last; live URLs must not point at missing new assets."""
    return name.lower().endswith((".html", ".htm"))


def publication_order(file):
    name, _ = file
    # Put the root homepage last within the final HTML group.
    return (int(is_entrypoint(name)), int(name == "index.html"), name)


def batches(changed):
    """Preflight phase-isolated upload batches before any network mutation."""
    groups = []
    group = []
    estimated = 4096
    group_is_html = None
    for name, path in changed:
        estimated_part = path.stat().st_size + len(name.encode("utf-8")) * 2 + 512
        html_phase = is_entrypoint(name)
        if group and (len(group) >= MAX_FILES_PER_REQUEST or
                      estimated + estimated_part > MAX_REQUEST_BYTES or
                      group_is_html != html_phase):
            groups.append(group)
            group = []
            estimated = 4096
        if not group:
            group_is_html = html_phase
        if estimated + estimated_part > MAX_REQUEST_BYTES:
            raise ValueError(f"Upload file too large: {name}")
        group.append((name, path))
        estimated += estimated_part
    if group:
        groups.append(group)
    return groups


def verify_remote_manifest(pairs, key, label):
    """Fail closed when Neocities has not retained the just-uploaded files.

    Reading the API listing (rather than a CDN response) avoids a stale
    public-edge cache check. It does not make multi-request upload atomic.
    """
    if not pairs:
        return
    remote = remote_files(api_json("/list", key))
    mismatches = []
    for name, path in pairs:
        item = remote.get(name)
        if (not item or item["sha1_hash"].lower() != sha1_file(path) or
                item["size"] != path.stat().st_size):
            mismatches.append(name)
    if mismatches:
        raise RuntimeError(f"Neocities {label} verification failed for "
                           f"{len(mismatches)} files (first: {mismatches[0]}). "
                           "Publication is incomplete; retry after checking the API.")
    print(f"Verified {len(pairs)} {label} files using Neocities /list.")


def seconds_until_safe_update(last_updated, now=None):
    if not last_updated:
        return 0
    try:
        updated = parsedate_to_datetime(last_updated)
        if updated.tzinfo is None:
            # RFC 2822's -0000 denotes UTC clock time with an unknown
            # original local timezone. Python deliberately parses it as
            # naive; Neocities commonly emits this valid UTC representation.
            if not isinstance(last_updated, str) or not last_updated.strip().endswith(" -0000"):
                raise ValueError("Missing timezone")
            updated = updated.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError) as error:
        raise RuntimeError("Invalid last_updated timestamp from Neocities") from error
    now = now or datetime.now(timezone.utc)
    return max(0, MIN_UPDATE_INTERVAL_SECONDS - (now - updated).total_seconds())


def require_immutable_release(directory):
    state = json.loads((directory / ".neonauts-build").read_text(encoding="utf-8"))
    if state.get("base_path") != "/" or state.get("immutable_release") is not True:
        raise ValueError("Refusing Neocities upload without a prepared immutable root release")
    files = collect_files(directory)
    for name, _ in files:
        if is_entrypoint(name) or name == "players.json":
            continue
        if not re.search(r"\.[0-9a-f]{24}\.[a-z0-9]+$", name):
            raise ValueError(f"Refusing mutable supporting filename: {name}")


def deploy(directory, dry_run=False, config_path=ROOT / "site.config.json",
           require_immutable=False):
    from check import check
    directory = Path(directory)
    if require_immutable:
        require_immutable_release(directory)
    check(directory)
    files = collect_files(directory)
    site = expected_site(config_path)
    key = os.environ.get("NEOCITIES_API_KEY")
    if not key:
        raise ValueError("NEOCITIES_API_KEY is required; configure the GitHub Actions secret")

    info = api_json("/info", key).get("info")
    if not isinstance(info, dict) or info.get("sitename") != site:
        raise RuntimeError(f"API key does not belong to configured site {site!r}; refused to deploy")
    remote = remote_files(api_json("/list", key))
    if require_immutable:
        # A URL addressed by its content hash must never be overwritten.
        for name, path in files:
            if is_entrypoint(name) or name == "players.json":
                continue
            item = remote.get(name)
            if item and (item["sha1_hash"].lower() != sha1_file(path) or
                         item["size"] != path.stat().st_size):
                raise RuntimeError(f"Immutable resource has different remote bytes: {name}")
    changed = sorted(((name, path) for name, path in files
                      if remote.get(name, {}).get("sha1_hash", "").lower() != sha1_file(path)
                      or remote.get(name, {}).get("size") != path.stat().st_size),
                     key=publication_order)
    remote_only = len(set(remote) - {name for name, _ in files})
    groups = batches(changed)
    bytes_to_upload = sum(path.stat().st_size for _, path in changed)
    print(f"Verified Neocities site: {site}. Local files: {len(files)}; changed/new: "
          f"{len(changed)} ({bytes_to_upload} bytes); unchanged: {len(files) - len(changed)}; "
          f"remote-only (preserved): {remote_only}. Requests needed: {len(groups)}.")

    # The free plan has 1 GB storage. Check the sum without deleting foreign files.
    if info.get("supporter") is False:
        current_bytes = sum(item["size"] for item in remote.values())
        projected_bytes = current_bytes + sum(path.stat().st_size -
                            remote.get(name, {}).get("size", 0) for name, path in changed)
        if projected_bytes > 1024 ** 3:
            raise RuntimeError("Projected Neocities storage exceeds free-plan 1 GB limit")
    if dry_run:
        print("DRY RUN: No files uploaded or deleted.")
        return len(changed)
    if not changed:
        print("No changes; skipped publishing.")
        return 0

    wait = seconds_until_safe_update(info.get("last_updated"))
    if wait:
        print(f"Respecting ten-minute Neocities update interval: waiting {wait:.0f} seconds.")
        time.sleep(wait)

    # Neocities does not provide an atomic multi-file transaction. Publish
    # supporting assets/data before entrypoint HTML; abort if the API listing
    # does not confirm all required supporting files before the HTML cutover.
    dependencies = [(name, path) for name, path in files if not is_entrypoint(name)]
    changed_dependencies = [(name, path) for name, path in changed if not is_entrypoint(name)]
    changed_html = [(name, path) for name, path in changed if is_entrypoint(name)]
    uploaded = 0
    verified_dependencies = False
    for index, group in enumerate(groups, 1):
        html_phase = is_entrypoint(group[0][0])
        if html_phase and changed_html and changed_dependencies and not verified_dependencies:
            verify_remote_manifest(dependencies, key, "supporting")
            verified_dependencies = True
        if index > 1:
            time.sleep(BETWEEN_BATCHES_SECONDS)
        boundary = "neonauts-" + uuid.uuid4().hex
        data = multipart(group, boundary)
        if len(data) > MAX_REQUEST_BYTES:
            raise RuntimeError("Multipart body exceeds the safe upload limit")
        stage = "HTML entrypoints" if html_phase else "supporting files"
        print(f"Publishing package {index}/{len(groups)} ({stage}, {len(group)} files).")
        try:
            api_json("/upload", key, data=data,
                     content_type=f"multipart/form-data; boundary={boundary}")
        except Exception:
            print(f"STOPPED: {uploaded}/{len(changed)} changed files confirmed "
                  "before failure. Remote state may be partial; next run "
                  "re-lists hashes and only retries missing/changed files.")
            raise
        uploaded += len(group)
        print(f"Uploaded package {index}/{len(groups)} ({len(group)} files).")
    verify_remote_manifest(files, key, "published")
    print(f"Deployment finished and verified: {len(changed)} changed files. "
          "No remote files deleted.")
    return len(changed)


def audit_orphans(directory, config_path=ROOT / "site.config.json"):
    """Read-only report; remote-only does NOT imply safely deletable."""
    from check import check
    check(directory)
    files = collect_files(directory)
    site = expected_site(config_path)
    key = os.environ.get("NEOCITIES_API_KEY")
    if not key:
        raise ValueError("NEOCITIES_API_KEY is required to inspect Neocities")
    info = api_json("/info", key).get("info")
    if not isinstance(info, dict) or info.get("sitename") != site:
        raise RuntimeError(f"API key does not belong to configured site {site!r}; refused to inspect")
    remote = remote_files(api_json("/list", key))
    local_names = {name for name, _ in files}
    orphaned = [(name, record["size"]) for name, record in remote.items()
                if name not in local_names]
    orphaned.sort()
    print(f"Read-only Neocities audit for {site}. Local files: {len(files)}; "
          f"remote-only files: {len(orphaned)}; remote-only bytes: "
          f"{sum(size for _, size in orphaned)}.")
    for name, size in orphaned:
        # Quote untrusted remote names so special characters cannot forge log lines.
        print(f"  {json.dumps(name, ensure_ascii=True)}: {size} bytes")
    print("AUDIT ONLY: No files were uploaded or deleted. Remote-only files "
          "may belong to cached older releases or user-owned content; "
          "do not delete without a separate reviewed retention plan.")
    return orphaned


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=ROOT / "dist")
    parser.add_argument("--dry-run", action="store_true", help="Read remote state; never upload")
    parser.add_argument("--audit-orphans", action="store_true",
                        help="List remote files absent from this build; never delete or upload")
    parser.add_argument("--require-immutable", action="store_true",
                        help="Reject unversioned build output and remote immutable-path collisions")
    args = parser.parse_args()
    if args.audit_orphans:
        audit_orphans(args.directory)
    else:
        deploy(args.directory, dry_run=args.dry_run, require_immutable=args.require_immutable)
