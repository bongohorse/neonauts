"""Fail-closed outbound URL validation for saved Wiki imports and builds."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from build import ROOT, page_data
from import_naut import import_naut
from url_policy import require_wiki_url, validate_naut_urls


class WikiUrlPolicyTests(unittest.TestCase):
    def test_accepts_known_https_wiki_entries(self):
        values=[
            "https://awesomenauts.fandom.com/wiki/Admiral_Swiggins",
            "https://awesomenauts.fandom.com/wiki/Anchor_Swing/Ink_Spray",
            "https://awesomenauts.fandom.com/wiki/Foo?tab=items#section",
            "https://awesomenauts.fandom.com:443/wiki/Clunk",
        ]
        for value in values:
            with self.subTest(value=value):
                self.assertEqual(require_wiki_url(value), value)

    def test_rejects_injected_and_malformed_urls(self):
        bad=[
            None, "", 42, True,
            "javascript:alert(1)", "data:text/html,%3Cscript%3E",
            "file:///etc/passwd", "//awesomenauts.fandom.com/wiki/Gnaw",
            "/wiki/Gnaw", "http://awesomenauts.fandom.com/wiki/Gnaw",
            "https://evil.example/wiki/Gnaw",
            "https://awesomenauts.fandom.com.evil.example/wiki/Gnaw",
            "https://awesomenauts.fandom.com@evil.example/wiki/Gnaw",
            "https://evil.example@awesomenauts.fandom.com/wiki/Gnaw",
            "https://awesomenauts.fandom.com:444/wiki/Gnaw",
            "https://awesomenauts.fandom.com:invalid/wiki/Gnaw",
            "https://awesomenauts.fandom.com/wiki/",
            "https://awesomenauts.fandom.com/about",
            "https://awesomenauts.fandom.com\\@evil.example/wiki/Gnaw",
            " https://awesomenauts.fandom.com/wiki/Gnaw ",
            "https://awesomenauts.fandom.com/wi\nki/Gnaw",
            "https://awesomenauts.fandom.com/wiki/"+"a"*4096,
        ]
        for value in bad:
            with self.subTest(value=value), self.assertRaises(ValueError):
                require_wiki_url(value)

    def test_validate_every_existing_naut_dataset(self):
        sources=sorted((ROOT / "data/nauts").glob("*.json"))
        self.assertEqual(len(sources),34)
        for path in sources:
            data=json.loads(path.read_text(encoding="utf-8"))
            self.assertIs(validate_naut_urls(data),data)

    def test_old_source_json_cannot_bypass_import_validation(self):
        data=json.loads((ROOT/"data/nauts/ayla.json").read_text(encoding="utf-8"))
        for mutation in (lambda d: d["source"].update(url="javascript:alert(1)"),
                         lambda d: d["items"][0].update(source_url="data:text/html,hi"),
                         lambda d: d["abilities"][0].update(source_url="file:///unsafe")):
            forged=copy.deepcopy(data)
            mutation(forged)
            with self.assertRaises(ValueError):
                validate_naut_urls(forged)
            with self.assertRaises(ValueError):
                page_data(forged,{})
        forged=copy.deepcopy(data)
        forged["slug"]="adversarial-url-import"
        forged["items"][0]["source_url"]="javascript:alert(1)"
        with tempfile.TemporaryDirectory() as temp:
            with patch("import_naut.extract",return_value=forged):
                with self.assertRaises(ValueError):
                    import_naut(Path(temp)/"untrusted.html")
        self.assertFalse((ROOT/"data/nauts/adversarial-url-import.json").exists())


if __name__ == "__main__":
    unittest.main()
