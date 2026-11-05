# Project instructions

## Test on Render every time

The deployed site is https://rcms-gmk0.onrender.com/. Any change affecting the UI, layout, ads, browser behavior, or routing must be verified on that live URL after Render deploys it. Do not treat localhost-only checks as final validation. For responsive changes, test both a desktop width and a mobile width.

For a fresh responsive page load, open a non-JavaScript Render page such as `/p/health` at the target viewport, then navigate to the homepage. The site has a page-wide `beforeunload` handler that can block ordinary test navigation.

## Protect ad revenue

Keep every existing Adsterra unit and key unless the user explicitly asks to remove or replace them. Do not add popunders or extra ad units as part of unrelated work.
