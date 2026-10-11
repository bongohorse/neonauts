"""Offline safety tests for the Neocities deployment client (no live API calls)."""
import hashlib
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import call, patch

from deploy_neocities import (
    MAX_FILES_PER_REQUEST, audit_orphans, batches, collect_files, deploy, expected_site,
    is_entrypoint, multipart, publication_order, remote_files, seconds_until_safe_update,
)


class NeocitiesDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.dist = self.root / "dist"
        self.dist.mkdir()
        (self.dist / "index.html").write_text("<h1>test</h1>", encoding="utf-8")
        (self.dist / ".neonauts-build").write_text("{}")
        self.config = self.root / "site.config.json"
        self.config.write_text(json.dumps({"siteUrl": "https://awesomenauts.neocities.org"}))
        self.fake_key = patch.dict(os.environ, {"NEOCITIES_API_KEY": "test-only-key"})
        self.fake_key.start()
        self.addCleanup(self.fake_key.stop)
        self.check = patch("check.check")
        self.check.start()
        self.addCleanup(self.check.stop)

    @staticmethod
    def info(site="awesomenauts", updated=None, supporter=False):
        return {"result": "success", "info": {
            "sitename": site, "last_updated": updated, "supporter": supporter}}

    @staticmethod
    def listing(*entries):
        return {"result": "success", "files": list(entries)}

    @staticmethod
    def remote(name, contents):
        return {"path": name, "is_directory": False,
                "sha1_hash": hashlib.sha1(contents).hexdigest(), "size": len(contents)}

    @patch("deploy_neocities.api_json")
    def test_orphan_audit_lists_remote_only_files_without_writing(self, api):
        api.side_effect = [self.info(), self.listing(
            self.remote("index.html", (self.dist/"index.html").read_bytes()),
            self.remote("manual/keep.txt", b"manual"),
            self.remote("assets/old.webp", b"old"),
        )]
        with patch("builtins.print") as printer:
            orphans = audit_orphans(self.dist, config_path=self.config)
        self.assertEqual(orphans, [("assets/old.webp", 3), ("manual/keep.txt", 6)])
        self.assertEqual([c.args[0] for c in api.call_args_list], ["/info", "/list"])
        output = "\\n".join(" ".join(map(str, call.args)) for call in printer.call_args_list)
        self.assertIn("remote-only files: 2", output)
        self.assertIn("AUDIT ONLY", output)

    @patch("deploy_neocities.api_json")
    def test_orphan_audit_never_crosses_site_identity(self, api):
        api.return_value = self.info(site="not-the-owner")
        with self.assertRaisesRegex(RuntimeError, "does not belong"):
            audit_orphans(self.dist, config_path=self.config)
        self.assertEqual(api.call_count, 1)

    def test_expected_site_and_refuse_unexpected_origin(self):
        self.assertEqual(expected_site(self.config), "awesomenauts")
        for bad in ("http://awesomenauts.neocities.org",
                    "https://example.org",
                    "https://awesomenauts.neocities.org/subdir",
                    "https://awesomenauts.neocities.org?token=hi"):
            self.config.write_text(json.dumps({"siteUrl": bad}))
            with self.assertRaises(ValueError):
                expected_site(self.config)

    def test_invalid_upload_extension_or_missing_index(self):
        (self.dist / "source.exe").write_bytes(b"not a website asset")
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            collect_files(self.dist)
        (self.dist / "source.exe").unlink()
        (self.dist / "index.html").unlink()
        with self.assertRaisesRegex(ValueError, "index.html"):
            collect_files(self.dist)

    def test_multipart_contains_original_site_paths(self):
        nested = self.dist / "nauts" / "ayla"
        nested.mkdir(parents=True)
        picture = nested / "index.html"
        picture.write_bytes(b"naut")
        result = multipart([("nauts/ayla/index.html", picture)], "test-boundary")
        self.assertIn(b'name="nauts/ayla/index.html"', result)
        self.assertIn(b"naut\r\n--test-boundary--", result)
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            multipart([('bad"name.html', picture)], "test-boundary")

    def test_batch_preflight_never_exceeds_100_files(self):
        files = []
        for number in range(211):
            name = f"file-{number:03d}.txt"
            path = self.dist / name
            path.write_bytes(b"1")
            files.append((name, path))
        groups = batches(files)
        self.assertEqual([len(g) for g in groups], [100, 100, 11])
        self.assertLessEqual(max(len(g) for g in groups), MAX_FILES_PER_REQUEST)

    def test_remote_response_requires_hash_and_size(self):
        with self.assertRaisesRegex(RuntimeError, "hash or size"):
            remote_files(self.listing({"path": "index.html", "is_directory": False}))
        self.assertEqual(remote_files(self.listing(
            self.remote("index.html", b"abc")))["index.html"]["size"], 3)

    @patch("deploy_neocities.api_json")
    @patch("deploy_neocities.time.sleep")
    def test_dry_run_reports_changes_without_uploads_or_sleep(self, sleep, api):
        api.side_effect = [self.info(updated="Sun, 11 Oct 2026 01:00:00 +0000"),
                           self.listing(self.remote("old.html", b"keep"))]
        changed = deploy(self.dist, dry_run=True, config_path=self.config)
        self.assertEqual(changed, 1)
        self.assertEqual(api.call_count, 2)
        self.assertEqual([c.args[0] for c in api.call_args_list], ["/info", "/list"])
        sleep.assert_not_called()

    @patch("deploy_neocities.api_json")
    def test_wrong_api_key_site_fails_before_listing_or_upload(self, api):
        api.return_value = self.info(site="someone-else")
        with self.assertRaisesRegex(RuntimeError, "does not belong"):
            deploy(self.dist, config_path=self.config)
        self.assertEqual(api.call_count, 1)

    @patch("deploy_neocities.api_json")
    def test_unchanged_files_are_skipped(self, api):
        body = (self.dist / "index.html").read_bytes()
        api.side_effect = [self.info(), self.listing(self.remote("index.html", body))]
        self.assertEqual(deploy(self.dist, config_path=self.config), 0)
        self.assertEqual(api.call_count, 2)

    @patch("deploy_neocities.api_json")
    def test_only_changed_files_are_uploaded_and_remote_only_preserved(self, api):
        (self.dist / "extra.json").write_text('{"new":true}')
        same = (self.dist / "index.html").read_bytes()
        api.side_effect = [self.info(), self.listing(
            self.remote("index.html", same), self.remote("old.html", b"keep")),
            {"result": "success"},
            self.listing(self.remote("index.html", same),
                         self.remote("extra.json", b'{"new":true}'),
                         self.remote("old.html", b"keep"))]
        self.assertEqual(deploy(self.dist, config_path=self.config), 1)
        self.assertEqual([c.args[0] for c in api.call_args_list],
                         ["/info", "/list", "/upload", "/list"])
        data = api.call_args_list[-2].kwargs["data"]
        self.assertIn(b'name="extra.json"', data)
        self.assertNotIn(b'name="index.html"', data)
        self.assertNotIn(b'name="old.html"', data)

    @patch("deploy_neocities.api_json")
    def test_free_space_guard_prevents_upload(self, api):
        remote = self.remote("old.txt", b"old")
        remote["size"] = 1024 ** 3
        api.side_effect = [self.info(), self.listing(remote)]
        with self.assertRaisesRegex(RuntimeError, "free-plan"):
            deploy(self.dist, config_path=self.config)
        self.assertEqual(api.call_count, 2)

    def test_ten_minute_interval_uses_official_timestamp(self):
        current = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(
            seconds_until_safe_update("Sun, 11 Oct 2026 11:55:00 +0000", current), 300)
        self.assertEqual(
            seconds_until_safe_update("Sun, 11 Oct 2026 11:40:00 +0000", current), 0)
        # Neocities also emits RFC2822 -0000. The email parser deliberately
        # returns a naive datetime for this valid UTC-clock representation.
        self.assertEqual(
            seconds_until_safe_update("Sun, 11 Oct 2026 11:55:00 -0000", current), 300)
        self.assertEqual(
            seconds_until_safe_update("Sun, 11 Oct 2026 11:40:00 -0000", current), 0)
        with self.assertRaisesRegex(RuntimeError, "Invalid last_updated"):
            seconds_until_safe_update("Sun, 11 Oct 2026 11:55:00", current)
        self.assertEqual(seconds_until_safe_update(None, current), 0)

    @patch("deploy_neocities.api_json")
    @patch("deploy_neocities.seconds_until_safe_update", return_value=5)
    @patch("deploy_neocities.time.sleep")
    def test_rate_guard_waits_before_first_upload(self, sleep, interval, api):
        api.side_effect = [self.info(), self.listing(), {"result": "success"},
                           self.listing(self.remote("index.html", (self.dist/"index.html").read_bytes()))]
        self.assertEqual(deploy(self.dist, config_path=self.config), 1)
        sleep.assert_called_once_with(5)
        self.assertEqual(api.call_args_list[-2].args[0], "/upload")


    def test_publication_plan_is_phase_isolated_and_homepage_last(self):
        for file in ("assets/new.webp", "roster-data.js", "nauts/ayla/index.html",
                     "index.html", "404.html"):
            path = self.dist / file
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"test")
        entries = [(p.relative_to(self.dist).as_posix(), p)
                   for p in self.dist.rglob("*") if p.is_file() and not p.name.startswith(".")]
        ordered = sorted(entries, key=publication_order)
        self.assertFalse(any(is_entrypoint(name) for name, _ in ordered[:2]))
        self.assertEqual(ordered[-1][0], "index.html")
        groups = batches(ordered)
        self.assertTrue(all(len({is_entrypoint(name) for name, _ in group}) == 1
                            for group in groups))
        self.assertTrue(all(not is_entrypoint(name) for group in groups[:-1] for name, _ in group))
        self.assertTrue(all(is_entrypoint(name) for name, _ in groups[-1]))

    def test_interrupted_dependency_upload_never_publishes_html_and_retry_works(self):
        # 101 support files force two API requests. A failure in request #2
        # must not reach the index.html publication stage.
        for i in range(101):
            (self.dist / f"support-{i:03d}.js").write_text(f"let a{i}=1;")
        remote = {}
        state = {"uploads": 0, "fail_second": True}

        def fake_api(endpoint, key, data=None, content_type=None):
            if endpoint == "/info":
                return self.info()
            if endpoint == "/list":
                return self.listing(*[
                    self.remote(name, contents) for name, contents in sorted(remote.items())
                ])
            self.assertEqual(endpoint, "/upload")
            state["uploads"] += 1
            if state["fail_second"] and state["uploads"] == 2:
                raise RuntimeError("Simulated Neocities API failure")
            import re
            names = [name.decode() for name in re.findall(rb'Content-Disposition: form-data; name="([^"]+)"', data)]
            for name in names:
                remote[name] = (self.dist / name).read_bytes()
            return {"result": "success"}

        with patch("deploy_neocities.api_json", side_effect=fake_api), patch("deploy_neocities.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "Simulated"):
                deploy(self.dist, config_path=self.config)
            self.assertEqual(len(remote), 100, "first dependency batch should have been published")
            self.assertNotIn("index.html", remote, "the public entrypoint must not change early")
            state["fail_second"] = False
            self.assertEqual(deploy(self.dist, config_path=self.config), 2)
            self.assertEqual(len(remote), 102)
            self.assertEqual(remote["index.html"], (self.dist / "index.html").read_bytes())

    def test_api_listing_disagreement_blocks_html_publication(self):
        (self.dist / "features.js").write_bytes(b"critical new dependency")
        uploads = []

        def fake_api(endpoint, key, data=None, content_type=None):
            if endpoint == "/info":
                return self.info()
            if endpoint == "/list":
                return self.listing()  # Simulates upload accepted but missing on server.
            uploads.append(data)
            return {"result": "success"}

        with patch("deploy_neocities.api_json", side_effect=fake_api), patch("deploy_neocities.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "supporting verification failed"):
                deploy(self.dist, config_path=self.config)
        self.assertEqual(len(uploads), 1)
        self.assertIn(b'name="features.js"', uploads[0])
        self.assertNotIn(b'name="index.html"', uploads[0])

    def test_post_upload_manifest_mismatch_fails_job(self):
        uploads = []

        def fake_api(endpoint, key, data=None, content_type=None):
            if endpoint == "/info":
                return self.info()
            if endpoint == "/list":
                return self.listing()
            uploads.append(data)
            return {"result": "success"}

        with patch("deploy_neocities.api_json", side_effect=fake_api), patch("deploy_neocities.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "published verification failed"):
                deploy(self.dist, config_path=self.config)
        self.assertEqual(len(uploads), 1)


    @patch("deploy_neocities.api_json")
    def test_rejects_mutable_support_paths_when_immutable_required(self, api):
        with self.assertRaisesRegex(ValueError, "prepared immutable root"):
            deploy(self.dist, config_path=self.config, require_immutable=True)
        self.assertEqual(api.call_count, 0)
        (self.dist / ".neonauts-build").write_text(
            json.dumps({"base_path":"/","immutable_release":True}))
        (self.dist / "script.js").write_bytes(b"mutable")
        with self.assertRaisesRegex(ValueError, "mutable supporting filename"):
            deploy(self.dist, config_path=self.config, require_immutable=True)
        self.assertEqual(api.call_count, 0)

    @patch("deploy_neocities.api_json")
    def test_existing_immutable_remote_bytes_must_not_be_overwritten(self, api):
        (self.dist / ".neonauts-build").write_text(
            json.dumps({"base_path":"/","immutable_release":True}))
        content = b"immutable v1"
        name = "script." + hashlib.sha256(content).hexdigest()[:24] + ".js"
        (self.dist / name).write_bytes(content)
        api.side_effect = [self.info(), self.listing(self.remote(name, b"tampered"))]
        with self.assertRaisesRegex(RuntimeError, "Immutable resource has different remote bytes"):
            deploy(self.dist, config_path=self.config, require_immutable=True)
        self.assertEqual([c.args[0] for c in api.call_args_list], ["/info", "/list"])

    def test_html_cutover_failure_keeps_old_immutable_resources_for_retry(self):
        (self.dist / ".neonauts-build").write_text(
            json.dumps({"base_path":"/","immutable_release":True}))
        previous = b"old asset bytes"
        newer = b"new asset bytes"
        old_name = "script." + hashlib.sha256(previous).hexdigest()[:24] + ".js"
        new_name = "script." + hashlib.sha256(newer).hexdigest()[:24] + ".js"
        (self.dist / new_name).write_bytes(newer)
        (self.dist / "index.html").write_text(f'<script src="{new_name}"></script>')
        remote = {old_name: previous, "index.html": b'<script src="' + old_name.encode() + b'"></script>'}
        state = {"stop_html": True}

        def api(endpoint, key, data=None, content_type=None):
            if endpoint == "/info":
                return self.info()
            if endpoint == "/list":
                return self.listing(*(self.remote(name, body) for name, body in remote.items()))
            self.assertEqual(endpoint, "/upload")
            import re
            names = [x.decode() for x in re.findall(
                rb'Content-Disposition: form-data; name="([^"]+)"', data)]
            if state["stop_html"] and "index.html" in names:
                raise RuntimeError("Simulated HTML cutover failure")
            for name in names:
                remote[name] = (self.dist / name).read_bytes()
            return {"result":"success"}

        with patch("deploy_neocities.api_json", side_effect=api), \
             patch("deploy_neocities.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "Simulated HTML cutover failure"):
                deploy(self.dist, config_path=self.config, require_immutable=True)
            self.assertEqual(remote[old_name], previous)
            self.assertEqual(remote[new_name], newer)
            self.assertIn(old_name.encode(), remote["index.html"])
            state["stop_html"] = False
            self.assertEqual(deploy(self.dist, config_path=self.config, require_immutable=True), 1)
            self.assertIn(new_name.encode(), remote["index.html"])
            self.assertEqual(remote[old_name], previous)


if __name__ == "__main__":
    unittest.main()
