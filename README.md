# D2 — direction 2 (EBADUDU)

Portfolio site built from Figma page "direction 2". Shares the same works as D1 but none of its code or styles.

## Pages
- `index.html` — begin animation (cards scatter → gather → stack → the first work fills the screen), then full-screen slides of 6 works with the vertical dots on the right and a green "VIEW ALL MY WORK" pill
- `work.html` — every work as a card, three across, tags inside each card; a green "VIEW MY WORK" pill follows the cursor; works with a video play it on hover
- `project.html?p=<slug>` — full-screen cover with the title, the words, images in tight rows, next work

## Editing
- Words, years, tags, which works are slides / in the intro deck: `data.js` (`SLIDES`, `INTRO_DECK`)
- Images/videos: `assets/work/<slug>/`, listed in `media.js` (same files as D1, built by `D1/tools/build-assets.ps1`)

## Run locally
```
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8782
```
then open http://localhost:8782

Requirements for this site: `prompt/requirements.md`.
