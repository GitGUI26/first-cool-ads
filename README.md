# Site + private browser

## Run it
    node server.js            # Node 18+, no npm install needed
    # open http://localhost:8080   (BROWSER tab in the top bar = proxy browser)

Optional: `PROXY_KEY=somesecret node server.js` makes the proxy ask for a key (do this if you host it publicly,
otherwise anyone can use your server as an open proxy). `PORT=3000` changes the port.

Hosting: needs a Node host (Render, Railway, Fly, a VPS, your own PC). Static hosts (GitHub Pages, Cloudflare Pages)
serve the games fine but the browser tab will say the proxy isn't reachable.

## Deploy free on Render
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
Does: sites see the server instead of your device; cookies + referrers are stripped; private/local addresses are blocked.
Doesn't: encrypt anything from whoever runs the server, or work on heavy sites (YouTube, Google login, anything that
builds URLs in complex JS). For better compatibility swap in Ultraviolet or Scramjet on this same server.

## Ads

There are none. The site ships without Adsterra units, AdSense tags or an `ads.txt`.

## Thumbnails for the added games
113 games were added (`games/pack/` and `games/mgg/`). Most have a generated title-card thumbnail; to replace them with
real screenshots run `python tools/make_thumbs.py` on your own PC (instructions inside the file).
