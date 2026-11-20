# Vice Frame — Cover Art Maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Kausar56/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Kausar56/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Frame turns your own photos into GTA-style poster cover art: a collage of slanted panels with white poster borders, a Vice City sunset or neon colour grade, and big gradient caption lettering — exported as a PNG in the sizes posts actually use. It is a static web app with no build step and no network: open `app/index.html` from any static server (or run `node serve.ts` and visit http://localhost:8080) and everything runs on your machine. Photos are read locally in the browser and never uploaded.

## What it does

- **Multi-panel poster layouts.** Three panel grids — Vice Grid (five panels), Slash (three diagonal bands) and Mosaic (six panels) — drawn as slanted polygons that share their seams, with the warm-white poster borders and dark edges of a game cover.
- **Any photos, framed your way.** Load photos from your device, or start from the four bundled samples. Click a panel to select it, click a photo to drop it in, then drag the cover to pan the shot and scroll (or use the slider) to zoom. One photo can fill every panel at different crops, or every panel can hold a different photo. A Shuffle button deals your photos into the panels at random crops for instant variations.
- **Colour grades.** Vice Sunset, Neon Nights and Golden Hour washes are laid over each panel in soft-light and overlay passes — purple shadows, hot highlights — with a strength slider, plus a Clean grade that leaves photos nearly as shot.
- **Poster lettering.** The caption is drawn on canvas as heavy condensed-feeling capitals with a forward lean, a thick dark outline, a hard offset shadow and a white-hot → amber → hot-pink gradient fill, auto-sized to the cover. The subtitle sits in a glowing neon pill along the foot.
- **Exports that are ready to post.** One click writes a PNG at 1080 × 1080, 1080 × 1350 or 1920 × 1080. The preview canvas is kept at the export size, so what you see is exactly the file you get.

## How it is built

- `app/index.html` and `app/style.css` — the editor: a five-step control rail (photos, words, look, panel, export) beside the live cover.
- `app/src/cover.js` — the cover engine: layout geometry, per-panel photo fitting with pan/zoom clamping, the colour grades, panel borders, caption lettering and the subtitle badge. Pure canvas 2D; the same `drawCoverArt` renders the preview and the export.
- `app/src/main.js` — the editor wiring: photo tray, panel selection by clicking the poster itself, drag-to-pan and wheel zoom, shuffle, and the export download.
- `app/src/shots.js` — fixed `?shot=` scenes used to take the screenshots in `screenshots/` (including `?shot=export`, which exposes the exact PNG the Export button writes).
- `app/samples/` — four sample photos made with an image model, free to use: a boulevard portrait, a neon convertible, a speedboat aerial and a pier fisherman.
- `main.ts` — the hand-in program: copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-app.ts` library.

Everything is original: no Rockstar logos, artwork, characters or fonts. Lettering is drawn with canvas paths and system font stacks, and the app loads nothing from the network — every script, style and image it uses is a file in `app/`.
