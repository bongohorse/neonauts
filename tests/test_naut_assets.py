"""Naut publication plans never delete or rewrite the archive source."""
import tempfile
import unittest
from pathlib import Path

from naut_assets import publish_naut_assets


class NautAssetPublicationTests(unittest.TestCase):
    def test_copy_only_references_and_share_byte_identical_images(self):
        with tempfile.TemporaryDirectory() as temp:
            static = Path(temp) / "static"
            output = Path(temp) / "dist"
            output.mkdir()
            first = static / "assets/nauts/one/icon.webp"
            second = static / "assets/nauts/two/icon.webp"
            other = static / "assets/nauts/two/skin.webp"
            orphan = static / "assets/nauts/one/orphan.webp"
            roster = static / "assets/nauts/roster.webp"
            for file, data in ((first, b"duplicate"), (second, b"duplicate"),
                               (other, b"unique"), (orphan, b"unreferenced"),
                               (roster, b"roster")):
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
            run_a = {"abilities": [{"image": "assets/nauts/one/icon.webp"}],
                     "items": [], "skins": {"default": {"image": "assets/nauts/two/skin.webp"}}}
            run_b = {"abilities": [{"image": "assets/nauts/two/icon.webp"}],
                     "items": [], "skins": {}}
            aliases = publish_naut_assets(
                static, output, [run_a, run_b],
                [{"image": "assets/nauts/roster.webp"}])
            shared = aliases["assets/nauts/one/icon.webp"]
            self.assertEqual(aliases["assets/nauts/two/icon.webp"], shared)
            self.assertTrue(shared.startswith("assets/nauts/shared/"))
            self.assertEqual((output/shared).read_bytes(), b"duplicate")
            self.assertEqual((output/aliases["assets/nauts/two/skin.webp"]).read_bytes(), b"unique")
            self.assertTrue((output/"assets/nauts/roster.webp").is_file())
            self.assertFalse((output/"assets/nauts/one/orphan.webp").exists())
            self.assertTrue(orphan.exists(), "source archive should stay intact")
            self.assertEqual(len(list((output/"assets/nauts").rglob("*.webp"))), 3)
            # A second build must not create additional or differently named files.
            self.assertEqual(publish_naut_assets(
                static, output, [run_a, run_b],
                [{"image": "assets/nauts/roster.webp"}]), aliases)

    def test_missing_referenced_art_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            static, output = Path(temp)/"static", Path(temp)/"output"
            output.mkdir()
            r = {"abilities": [], "items": [],
                 "skins": {"default": {"image": "assets/nauts/not-present.webp"}}}
            with self.assertRaisesRegex(ValueError, "Missing Naut image"):
                publish_naut_assets(static, output, [r], [])

    def test_unsafe_image_path_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            static, output = Path(temp)/"static", Path(temp)/"output"
            output.mkdir()
            r = {"abilities": [], "items": [],
                 "skins": {"default": {"image": "assets/nauts/../escape.webp"}}}
            with self.assertRaisesRegex(ValueError, "Unsafe Naut image path"):
                publish_naut_assets(static, output, [r], [])


if __name__ == "__main__":
    unittest.main()
