# Site + private browser

## Run it
    python3 -m http.server 8300  # static site; the BROWSER tab uses the edge proxy
    # open http://localhost:8300

Or run the original Node server for a self-hosted local proxy:
    node server.js            # Node 18+, no npm install needed
    # open http://localhost:8080

Optional: `PROXY_KEY=somesecret node server.js` makes the local proxy ask for a key. `PORT=3000` changes its port.

Hosting: GitHub Pages, Cloudflare Pages and other static hosts serve the games and the BROWSER tab. The BROWSER tab
uses the hosted edge proxy at `https://site-f38c0cecdb6f42f890f9ef76a1463c3c.freebuff.page`; its source is in `proxy/`.
To use a Node proxy instead, run `server.js` and change `PROXY` in `browser/index.html` to that origin.

## Optional: deploy a Node proxy on Render
1. Push this folder to GitHub.
2. render.com -> New -> Blueprint (it reads `render.yaml`) or New -> Web Service (Runtime Node, Start Command `node server.js`, Free plan).
3. Set the `PROXY_KEY` environment variable (the blueprint generates one; find it under Environment). Visitors to the BROWSER tab are asked for it once.
Free instances sleep after ~15 min idle, so the first load can take about a minute.

## Add the games
    python3 tools/add_games.py --dry-run      # preview (clones both repos, needs git + internet)
    python3 tools/add_games.py                # import everything, skipping duplicates
    python3 tools/add_games.py --max-mb 25    # skip huge games to keep the site small
Duplicates are detected by normalized title and by identical file contents, against your existing games and
within the new ones. Re-running is safe.

## What the proxy does / doesn't do
Does: sites see the edge proxy instead of your device; cookies + referrers are stripped; private/local addresses are blocked.
Doesn't: encrypt anything from whoever runs the proxy, or work on heavy sites (YouTube, Google login, anything that
builds URLs in complex JS). For better compatibility swap in Ultraviolet or Scramjet on the same proxy.

## Ads

There are none. The site ships without Adsterra units, AdSense tags or an `ads.txt`.

## Thumbnails for the added games
113 games were added (`games/pack/` and `games/mgg/`). Most have a generated title-card thumbnail; to replace them with
real screenshots run `python tools/make_thumbs.py` on your own PC (instructions inside the file).
