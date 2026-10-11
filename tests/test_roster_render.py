import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image, ImageDraw
from check_roster_render import check_roster_pixels, BACKGROUND


class RosterRenderTests(unittest.TestCase):
    def test_missing_last_row_cannot_hide_in_global_dark_art_allowance(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);image_path=root/'roster.png';metadata=root/'centers.json'
            centers=[{'slug':str(i),'spriteIndex':i,'x':10+i*20,'y':10,
                      'width':20,'height':20} for i in range(34)]
            metadata.write_text(json.dumps(centers))
            image=Image.new('RGB',(680,20),'white')
            with patch('builtins.print'):
                image.save(image_path);check_roster_pixels(image_path,metadata)
                # One dark earlier portrait remains allowed.
                ImageDraw.Draw(image).rectangle((0,0,19,19),fill=BACKGROUND)
                image.save(image_path);check_roster_pixels(image_path,metadata)
                ImageDraw.Draw(image).rectangle((580,0,679,19),fill=BACKGROUND)
                image.save(image_path)
                with self.assertRaisesRegex(AssertionError,'Last-row atlas portraits missing'):
                    check_roster_pixels(image_path,metadata)
