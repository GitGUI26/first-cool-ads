#!/usr/bin/env python3
"""
Build the whole site into ONE html file (site.html).

    python3 tools/build_single.py                       # uses the default games address below
    python3 tools/build_single.py --base https://you.github.io/repo/
    python3 tools/build_single.py --base ""             # games sit next to the html file

What goes inside the file: the page, all CSS and JS, the logo, the startup loader, the ads code and a
built-in (proxy-free) browser. What can't: the games themselves (500+ MB), so the file loads them, and
their thumbnails, from the address set in ASSET_BASE at the top of the file. Re-run this script after
changing anything in index.html, css/, js/ or scripts/.
"""
import argparse, base64, io, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BASE = 'https://gitgui26.github.io/first-cool-ads/'

ap = argparse.ArgumentParser()
ap.add_argument('--base', default=DEFAULT_BASE)
ap.add_argument('--out', default=os.path.join(ROOT, 'site.html'))
a = ap.parse_args()


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def safe_js(s):   # make text safe to sit inside an inline <script>
    return s.replace('</script', '<\\/script').replace('<!--', '<\\x21--')


def safe_css(s):
    return s.replace('</style', '<\\/style')


def sub1(text, old, new):
    if old not in text:
        sys.exit('build error: could not find: ' + old[:70])
    return text.replace(old, new, 1)


html = read('index.html')

# ---- logo -> data URI (shrunk; it is only ever shown small) ----
im = Image.open(os.path.join(ROOT, 'images/logo.png')).convert('RGBA')
if im.width > 480:
    im = im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS)
buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
logo = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

# ---- CSS ----
html = sub1(html, '<link href="css/style.css?v=3" rel="stylesheet">', '<style>\n' + safe_css(read('css/style.css')) + '\n</style>')

# ---- startup loader: inline instead of loading loader.html ----
html = sub1(html, 'src="loader.html"', 'id="siteStartupLoaderFrame"')

# ---- logo in markup (set from script so the data URI is stored only once) ----
assert 'src="images/logo.png?v=2"' in html
html = html.replace('src="images/logo.png?v=2"', 'src=""')

# ---- BROWSER tab: open the built-in browser instead of going to browser/ ----
html = sub1(html, "onclick=\"window.location.href='browser/'\"", 'onclick="openBuiltInBrowser()"')

# ---- ads script in <head> ----
html = sub1(html, '<script src="js/ads.js?v=4"></script>', '<script>\n' + safe_js(read('js/ads.js')) + '\n</script>')

# ---- config + early setup, first thing in <head> ----
config = '''<script>
/* ===== SETTINGS =====
   ASSET_BASE = where the games/ and images/ folders live (your GitHub Pages address, ending in "/").
   Use "" if this file sits in the same folder as games/ and images/. */
var ASSET_BASE = %s;
/* ===================== */
window.__LOGO = %s;
window.__ASSET = function (p) { return (!p || /^(https?:|data:|blob:|\\/\\/)/i.test(p)) ? p : ASSET_BASE + p; };
</script>
''' % (json.dumps(a.base), json.dumps(logo))
html = sub1(html, '<head>', '<head>\n' + config)

# ---- bottom scripts ----
games_js = read('js/games.js')
main_js = read('js/main.js')
main_js = main_js.replace('"images/logo.png?v=2"', 'window.__LOGO')

loader_html = read('loader.html')
browser_html = read('browser/index.html')

# built-in browser: same page, but it opens sites directly in a frame (no proxy server)
browser_html = browser_html.replace('<link rel="icon" href="../cuh.png">', '')
browser_html = sub1(browser_html, 'href="../"', 'href="#" onclick="parent.postMessage({type:\'close-browser\'},\'*\');return false"')
browser_html = sub1(browser_html, "const enc=u=>'../p?u='+encodeURIComponent(u);", 'const enc=u=>u;')
browser_html = sub1(browser_html, "t.frame.setAttribute('referrerpolicy','no-referrer');",
                    "t.frame.setAttribute('referrerpolicy','no-referrer');t.frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals');")
i = browser_html.index('async function boot()')
j = browser_html.index('boot();', i + 30)
browser_html = browser_html[:i] + (
    "function boot(){newTab();online=true;notice('Note: many websites (Google, YouTube, most big sites) refuse to open inside "
    "another page, so they will show blank or an error. That is a browser limit, not a bug.',false)}\n") + browser_html[j:]
browser_html = re.sub(r"<p>Pages are fetched by this site's server.*?</p>",
                      "<p>Sites open directly in a frame here. Sites that allow being embedded will load; many popular ones do not.</p>",
                      browser_html, flags=re.S)

bottom = '''<script>
%(starfield)s
</script>
<script>
%(games)s
</script>
<script>
/* games and thumbnails live at ASSET_BASE */
games.forEach(function (g) { if (g.url) g.url = __ASSET(g.url); if (g.image) g.image = __ASSET(g.image); });
(function () {
  document.querySelectorAll('img.logo, img.home-logo').forEach(function (l) { l.src = window.__LOGO; });
  var f = document.getElementById('siteStartupLoaderFrame');
  if (f) f.srcdoc = %(loader)s;
})();
window.__BROWSER_HTML = %(browser)s;
function openBuiltInBrowser() {
  var o = document.getElementById('builtInBrowser');
  if (!o) {
    o = document.createElement('div');
    o.id = 'builtInBrowser';
    o.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:#0f1115';
    var fr = document.createElement('iframe');
    fr.style.cssText = 'width:100%%;height:100%%;border:0';
    fr.srcdoc = window.__BROWSER_HTML;
    o.appendChild(fr);
    document.body.appendChild(o);
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'close-browser') o.style.display = 'none';
    });
  } else { o.style.display = 'block'; }
}
</script>
<script>
%(main)s
</script>''' % {
    'starfield': safe_js(read('scripts/starfield.js')),
    'games': safe_js(games_js),
    'loader': safe_js(json.dumps(loader_html)),
    'browser': safe_js(json.dumps(browser_html)),
    'main': safe_js(main_js),
}
old_bottom = ('  <script src="scripts/starfield.js"></script>\n'
              '  <script src="js/games.js"></script>\n'
              '  <script src="js/main.js"></script>')
html = sub1(html, old_bottom, bottom)

with open(a.out, 'w', encoding='utf-8') as f:
    f.write(html)
print('wrote', a.out, round(os.path.getsize(a.out) / 1024), 'KB')
left = re.findall(r'(?:src|href)="(?:css|js|scripts|images|games|browser)/[^"]*"', html)
print('leftover relative references in markup:', left or 'none')
