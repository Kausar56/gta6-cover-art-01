// Vice Frame editor: wires the page to the cover engine (./cover.js). Holds the cover being made — the
// photos loaded on this machine, one framing per panel, the words, the grade and the export size — and
// redraws the canvas on every change, so the preview is always the PNG the export button will write.
import { LAYOUTS, drawCoverArt, panelAtPoint, panelPolygon, polygonBox, clampPan } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const panelLabel = document.getElementById('panel-label');
const zoomSlider = document.getElementById('zoom');

const state = {
  layout: 'vice',
  grade: 'sunset',
  intensity: 0.85,
  caption: 'Sunset Heat',
  subtitle: 'Palm Shores',
  size: { w: 1080, h: 1080 },
  photos: [], // { img, name, url, sample }
  panels: [], // { photo, pan: {x, y}, zoom } per layout panel
  selected: 0,
};

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const blankFraming = () => ({ photo: -1, pan: { x: 0, y: 0 }, zoom: 1 });

/** Gives the current layout one framing per panel, keeping the framings that already exist by index. */
function rebuildPanels() {
  const count = LAYOUTS[state.layout].panels.length;
  state.panels = Array.from({ length: count }, (_, i) => state.panels[i] ?? blankFraming());
  if (state.selected >= count) state.selected = 0;
}

/** The state as the cover engine wants it: the same fields, with photo records unwrapped to their images. */
function coverState() {
  return { ...state, photos: state.photos.map((p) => p.img) };
}

/** Redraws the preview and the panel controls that mirror the selection. */
function redraw() {
  drawCoverArt(ctx, canvas.width, canvas.height, coverState());
  const framing = state.panels[state.selected];
  zoomSlider.value = framing ? framing.zoom : 1;
  const photoName = framing && framing.photo >= 0 ? state.photos[framing.photo]?.name : 'no photo yet';
  panelLabel.textContent = `Panel ${state.selected + 1} of ${state.panels.length} selected — ${photoName}. Click a photo to put it here; drag the cover to move it.`;
}

/** Adds a bundled sample photo (samples/<name>.jpg) to the tray, once, and returns its photo index. */
async function addSample(name) {
  const existing = state.photos.findIndex((p) => p.sample === name);
  if (existing >= 0) return existing;
  const url = `samples/${name}.jpg`;
  const img = await loadImage(url);
  state.photos.push({ img, name: `Sample: ${name}`, url, sample: name });
  renderTray();
  return state.photos.length - 1;
}

/** Adds photos the person picked from their device; they are read locally and never uploaded. */
async function addUserPhotos(files) {
  let firstAdded = -1;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    state.photos.push({ img, name: file.name.replace(/\.[^.]+$/, ''), url, sample: null });
    if (firstAdded < 0) firstAdded = state.photos.length - 1;
  }
  renderTray();
  return firstAdded;
}

/** Rebuilds the photo tray: one thumbnail per loaded photo; clicking one puts it in the selected panel. */
function renderTray() {
  const tray = document.getElementById('tray');
  tray.replaceChildren();
  state.photos.forEach((photo, i) => {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    img.title = `Put “${photo.name}” in panel ${state.selected + 1}`;
    img.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      redraw();
    });
    const cap = document.createElement('figcaption');
    cap.textContent = photo.name;
    fig.append(img, cap);
    tray.append(fig);
  });
}

/** Sets the export size: the canvas takes the size, so preview and export stay the same picture. */
function setSize(w, h) {
  state.size = { w, h };
  canvas.width = w;
  canvas.height = h;
  canvas.style.setProperty('--ar', String(w / h));
  redraw();
}

/** Renders the cover at the export size with editor marks off, on a fresh canvas. */
function renderExportCanvas() {
  const out = document.createElement('canvas');
  out.width = state.size.w;
  out.height = state.size.h;
  drawCoverArt(out.getContext('2d'), out.width, out.height, coverState(), { forExport: true });
  return out;
}

/** The exported PNG as a data URL — the same bytes the Export button downloads. */
function exportPngDataUrl() {
  return renderExportCanvas().toDataURL('image/png');
}

function exportPng() {
  renderExportCanvas().toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-frame-cover-${state.size.w}x${state.size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-frame-cover-${state.size.w}x${state.size.h}.png`;
  }, 'image/png');
}

// --- Controls -------------------------------------------------------------------------------

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  status.textContent = 'Reading your photos…';
  const first = await addUserPhotos(files);
  if (first >= 0 && state.panels[state.selected].photo < 0) state.panels[state.selected].photo = first;
  status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} loaded. Click a thumbnail to place it in a panel.`;
  redraw();
});

document.getElementById('samples').addEventListener('click', async (e) => {
  const name = e.target.dataset?.sample;
  if (!name) return;
  const idx = await addSample(name);
  state.panels[state.selected].photo = idx;
  redraw();
});

document.getElementById('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('grade').addEventListener('change', (e) => { state.grade = e.target.value; redraw(); });
document.getElementById('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); redraw(); });
zoomSlider.addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});

document.getElementById('layouts').addEventListener('click', (e) => {
  const name = e.target.dataset?.layout;
  if (!name || name === state.layout) return;
  state.layout = name;
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('on', b.dataset.layout === name));
  rebuildPanels();
  redraw();
});

document.getElementById('sizes').addEventListener('click', (e) => {
  const spec = e.target.dataset?.size;
  if (!spec) return;
  const [w, h] = spec.split('x').map(Number);
  document.querySelectorAll('#sizes button').forEach((b) => b.classList.toggle('on', b.dataset.size === spec));
  setSize(w, h);
});

document.getElementById('fill-all').addEventListener('click', () => {
  const source = state.panels[state.selected].photo;
  if (source < 0) { status.textContent = 'Pick a photo for this panel first, then fill the rest with it.'; return; }
  state.panels.forEach((p) => { p.photo = source; });
  status.textContent = 'Every panel now shows that photo — drag each one to a different crop.';
  redraw();
});

document.getElementById('reset-frame').addEventListener('click', () => {
  const framing = state.panels[state.selected];
  framing.pan = { x: 0, y: 0 };
  framing.zoom = 1;
  redraw();
});

document.getElementById('export').addEventListener('click', exportPng);

// --- Direct manipulation on the cover ---------------------------------------------------------

function toCoverCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = toCoverCoords(e);
  const idx = panelAtPoint(state.layout, p.x, p.y, canvas.width, canvas.height);
  if (idx < 0) return;
  state.selected = idx;
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = toCoverCoords(e);
  const framing = state.panels[state.selected];
  if (framing.photo < 0) { drag = p; return; }
  const box = polygonBox(panelPolygon(state.layout, state.selected, canvas.width, canvas.height));
  framing.pan.x += (p.x - drag.x) / box.w;
  framing.pan.y += (p.y - drag.y) / box.h;
  const photo = state.photos[framing.photo];
  clampPan(framing, photo.img.naturalWidth, photo.img.naturalHeight, box);
  drag = p;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const framing = state.panels[state.selected];
  if (!framing || framing.photo < 0) return;
  e.preventDefault();
  framing.zoom = Math.min(3, Math.max(1, framing.zoom * (e.deltaY < 0 ? 1.07 : 0.93)));
  redraw();
}, { passive: false });

// --- The opening scene and the screenshot scenes ----------------------------------------------

/** The scene the editor opens with: the four samples spread over the Vice Grid, ready to rearrange. */
async function openDefaultScene() {
  const order = ['boulevard', 'car', 'boat', 'pier'];
  for (const name of order) await addSample(name);
  const assign = [0, 1, 3, 2, 1]; // boulevard hero, car top-right, pier, boat, car again closer
  state.panels.forEach((panel, i) => { panel.photo = assign[i] ?? -1; });
  state.panels[4].zoom = 1.7;
  state.panels[4].pan = { x: -0.12, y: 0.05 };
  state.panels[2].zoom = 1.25;
  redraw();
}

const api = {
  state,
  addSample,
  setSize,
  redraw,
  exportPngDataUrl,
  setLayout(name) {
    state.layout = name;
    document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('on', b.dataset.layout === name));
    rebuildPanels();
  },
  setTexts(caption, subtitle) {
    state.caption = caption;
    state.subtitle = subtitle;
    document.getElementById('caption').value = caption;
    document.getElementById('subtitle').value = subtitle;
  },
  setGrade(name, intensity) {
    state.grade = name;
    state.intensity = intensity;
    document.getElementById('grade').value = name;
  },
  assign(mapping) {
    mapping.forEach((photo, panel) => { if (state.panels[panel]) state.panels[panel].photo = photo; });
  },
  setFraming(panel, pan, zoom) {
    if (!state.panels[panel]) return;
    if (pan) state.panels[panel].pan = pan;
    if (zoom) state.panels[panel].zoom = zoom;
  },
  select(i) { state.selected = i; },
};

rebuildPanels();
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), api);
} else {
  openDefaultScene();
}
