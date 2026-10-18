"""
Replace the generated title-card thumbnails with real screenshots of each game.
Run this on your own computer (it needs a real browser):

    pip install playwright pillow
    playwright install chromium
    python tools/make_thumbs.py            # screenshots every game that has a generated thumbnail (images/g_*.jpg)
    python tools/make_thumbs.py --only bloons   # only games whose file name contains "bloons"

It starts a tiny local web server, opens each new game, waits a few seconds, and saves a 640x360 JPG over
images/g_<name>.jpg. Games that need a click to start will show their start screen - that's fine.
(Note: not tested by the person who wrote it - if a game's screenshot looks blank, delete that jpg's change and re-run with --wait 8.)
"""
import argparse, http.server, socketserver, threading, os, re, io, sys
from PIL import Image
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--only', default='')
ap.add_argument('--wait', type=float, default=5.0)
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

games = open('js/games.js', encoding='utf-8').read()
items = re.findall(r'url: "(games/(?:pack|mgg)/[^"]+)", image: "(images/g_[^"]+\.jpg)"', games)
items = [(u, i) for u, i in items if a.only.lower() in u.lower()]
print(len(items), 'games')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    for u, img in items:
        try:
            pg.goto(f'http://127.0.0.1:{port}/{u}', wait_until='load', timeout=30000)
            pg.wait_for_timeout(int(a.wait * 1000))
            im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB').resize((640, 360), Image.LANCZOS)
            im.save(img, 'JPEG', quality=82, optimize=True)
            print('ok  ', u)
        except Exception as e:
            print('FAIL', u, e)
    b.close()
