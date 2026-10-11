"""Release-level tests: immutable dependencies and stable public URL cutover."""
import json
import re
import tempfile
import unittest
from pathlib import Path
from lxml import html

from build import build
from check import check
from prepare_neocities_release import prepare, immutable_path, IMMUTABLE_PATTERN


class ImmutableReleaseTests(unittest.TestCase):
    def test_release_build_rewrites_every_runtime_reference(self):
        with tempfile.TemporaryDirectory() as temp:
            output = build(Path(temp) / "site")
            files = prepare(output)
            check(output)
            self.assertGreater(len(files), 1000)
            marker = json.loads((output / ".neonauts-build").read_text())
            self.assertTrue(marker["immutable_release"])
            with self.assertRaisesRegex(ValueError, "fresh"):
                prepare(output)
            self.assertFalse((output / "script.js").exists())
            self.assertFalse((output / "styles.css").exists())
            self.assertFalse((output / "roster-data.js").exists())
            self.assertFalse((output / "nauts/ayla/page-data.json").exists())
            self.assertFalse((output / "assets/logo.webp").exists())
            self.assertTrue((output / "players.json").is_file())
            for name, target in files.items():
                self.assertRegex(target, IMMUTABLE_PATTERN)
                self.assertTrue((output / target).is_file(), name)
                self.assertFalse((output / name).exists(), name)

            root = html.fromstring((output / "index.html").read_text())
            cards=root.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," goodie-card ")]')
            self.assertEqual(len(cards),9)
            for card in cards:
                snippet=html.fromstring(card.xpath('.//textarea')[0].text)
                download=card.xpath('.//a[@download]')[0]
                self.assertEqual(snippet.get('src'),
                    'https://YOUR-SITE.neocities.org/assets/goodies/'+download.get('download'))
                self.assertEqual((output/download.get('href')).read_bytes(),
                    (Path(__file__).parents[1]/'src/static/assets/goodies'/download.get('download')).read_bytes())
            scripts = root.xpath('//script[@src]/@src')
            self.assertTrue(any(s.startswith("script.") and s.endswith(".js") for s in scripts))
            self.assertTrue(any(s.startswith("roster-data.") for s in scripts))
            self.assertTrue(any("nauts/admiral-swiggins/page-data." in s for s in scripts))
            self.assertFalse(any("?v=" in s for s in scripts))
            roster_js = (output / files["roster-data.js"]).read_text()
            roster = json.loads(roster_js.removeprefix("const archiveData=").rstrip(";\n"))["roster"]
            self.assertEqual(sum(1 for naut in roster if naut["available"]), 34)
            for naut in roster:
                self.assertTrue((output / naut["image"]).is_file())
                if naut["available"]:
                    target = naut["dataUrl"]
                    self.assertTrue((output / target).is_file())
                    data = json.loads((output / target).read_text(encoding="utf-8"))
                    self.assertEqual(data["slug"], naut["slug"])
                    for obj in [*data["abilities"], *data["items"], *data["skins"].values()]:
                        if obj["image"]:
                            self.assertTrue((output / obj["image"]).is_file())
            maps_code = (output / files["maps-data.js"]).read_text()
            # Paths still start with assets/maps; their filename now carries
            # the 24-digit content hash before .webp.
            self.assertRegex(maps_code, r'assets/maps/ribbit-iv-splash\.[0-9a-f]{24}\.webp')
            self.assertNotIn('"assets/maps/ribbit-iv-splash.webp"', maps_code)
            self.assertIn('"assets/maps/ribbit-iv-splash.webp"', (Path(__file__).parents[1] / "src/static/maps-data.js").read_text())
            nav_code = (output / files["script.js"]).read_text()
            self.assertIn("selected?.dataUrl", nav_code)
            self.assertIn("sharedResources", nav_code)
            self.assertIn("location.assign(url.href)", nav_code)

    def test_unchanged_support_paths_are_identical_between_releases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old = build(root / "old")
            previous = prepare(old)
            new = build(root / "new")
            js = new / "script.js"
            js.write_text(js.read_text() + "\n// new nonbreaking release revision\n")
            following = prepare(new)
            self.assertNotEqual(previous["script.js"], following["script.js"])
            self.assertEqual(previous["styles.css"], following["styles.css"])
            self.assertEqual(previous["roster-data.js"], following["roster-data.js"])
            self.assertEqual(previous["assets/logo.webp"], following["assets/logo.webp"])
            self.assertTrue((old / previous["script.js"]).is_file())
            self.assertTrue((new / following["script.js"]).is_file())
            self.assertEqual(
                (old / previous["styles.css"]).read_bytes(),
                (new / following["styles.css"]).read_bytes())
            self.assertNotEqual((old / "index.html").read_bytes(),
                                (new / "index.html").read_bytes())
            with self.assertRaisesRegex(ValueError, "fresh"):
                prepare(new)

    def test_immutable_file_name_depends_on_all_bytes(self):
        first = immutable_path("script.js", b"hello")
        self.assertEqual(first, immutable_path("script.js", b"hello"))
        self.assertNotEqual(first, immutable_path("script.js", b"hello!"))
        self.assertRegex(first, IMMUTABLE_PATTERN)


if __name__ == "__main__":
    unittest.main()
