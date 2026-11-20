// Vice Frame cover engine: draws a multi-panel poster from photos, a colour grade and caption lettering.
// Everything is drawn on a 2D canvas at the export size, so the editor preview and the exported PNG are
// the same picture. Layouts are polygons in cover-relative coordinates (0..1 on both axes), so one layout
// works at 1080 x 1080, 1080 x 1350 and 1920 x 1080 alike.

// The panel layouts. Each panel is a polygon of [x, y] points; neighbouring panels share their vertices, so
// the slanted seams line up exactly and the white borders drawn over them read as one poster grid.
export const LAYOUTS = {
  vice: {
    label: 'Vice Grid',
    panels: [
      [[0, 0], [0.58, 0], [0.5, 0.51], [0, 0.56]], // hero, top left
      [[0.58, 0], [1, 0], [1, 0.46], [0.5, 0.51]], // top right
      [[0, 0.56], [0.36, 0.524], [0.3, 1], [0, 1]], // bottom left
      [[0.36, 0.524], [0.68, 0.492], [0.62, 1], [0.3, 1]], // bottom middle
      [[0.68, 0.492], [1, 0.46], [1, 1], [0.62, 1]], // bottom right
    ],
  },
  slash: {
    label: 'Slash',
    panels: [
      [[0, 0], [0.45, 0], [0.3, 1], [0, 1]],
      [[0.45, 0], [0.78, 0], [0.63, 1], [0.3, 1]],
      [[0.78, 0], [1, 0], [1, 1], [0.63, 1]],
    ],
  },
  mosaic: {
    label: 'Mosaic',
    panels: [
      [[0, 0], [0.36, 0], [0.32, 0.5], [0, 0.5]],
      [[0.36, 0], [0.68, 0], [0.64, 0.5], [0.32, 0.5]],
      [[0.68, 0], [1, 0], [1, 0.5], [0.64, 0.5]],
      [[0, 0.5], [0.32, 0.5], [0.38, 1], [0, 1]],
      [[0.32, 0.5], [0.64, 0.5], [0.7, 1], [0.38, 1]],
      [[0.64, 0.5], [1, 0.5], [1, 1], [0.7, 1]],
    ],
  },
};

// The colour grades. `filter` runs on the photo itself; `wash` is a top-to-bottom gradient laid over it in
// soft-light (and a fainter overlay pass) so shadows go purple and highlights go hot, the Vice City look.
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.38) contrast(1.09) brightness(1.03)',
    wash: [[0, '#3d0a63'], [0.45, '#c92a7e'], [0.78, '#ff5e3a'], [1, '#ffb03a']],
    floor: 'rgba(24, 2, 40, 0.42)',
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.6) contrast(1.14) brightness(0.99)',
    wash: [[0, '#00e5ff'], [0.5, '#2743c7'], [1, '#ff2ea6']],
    floor: 'rgba(2, 8, 34, 0.4)',
  },
  gold: {
    label: 'Golden Hour',
    filter: 'saturate(1.18) contrast(1.06) brightness(1.05) sepia(0.32)',
    wash: [[0, '#5a2d0c'], [0.55, '#c96a1e'], [1, '#ffd76a']],
    floor: 'rgba(43, 18, 2, 0.34)',
  },
  clean: {
    label: 'Clean',
    filter: 'saturate(1.06) contrast(1.03)',
    wash: null,
    floor: 'rgba(10, 6, 16, 0.16)',
  },
};

const DISPLAY_FONT = '"Arial Black", Impact, "Franklin Gothic Heavy", "Segoe UI", sans-serif';

/** The polygon of layout panel `index`, scaled to a w x h cover, as [x, y] pixel points. */
export function panelPolygon(layoutName, index, w, h) {
  return LAYOUTS[layoutName].panels[index].map(([x, y]) => [x * w, y * h]);
}

/** The axis-aligned box a polygon sits in: photos are cover-fitted to this box, then clipped to the polygon. */
export function polygonBox(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** True when pixel point (x, y) falls inside the polygon (ray cast). Used to pick a panel by clicking it. */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The index of the layout panel under pixel point (x, y), or -1 when the point is on no panel. */
export function panelAtPoint(layoutName, x, y, w, h) {
  const count = LAYOUTS[layoutName].panels.length;
  for (let i = 0; i < count; i++) {
    if (pointInPolygon(x, y, panelPolygon(layoutName, i, w, h))) return i;
  }
  return -1;
}

/**
 * Keeps a panel's pan inside the range where its photo still covers the panel box: pan is stored as a
 * fraction of the box size, and the useful range shrinks as the drawn photo grows past the box.
 */
export function clampPan(framing, imgW, imgH, box) {
  const scale = Math.max(box.w / imgW, box.h / imgH) * framing.zoom;
  const spareX = Math.max(0, (imgW * scale - box.w) / 2 / box.w);
  const spareY = Math.max(0, (imgH * scale - box.h) / 2 / box.h);
  framing.pan.x = Math.min(spareX, Math.max(-spareX, framing.pan.x));
  framing.pan.y = Math.min(spareY, Math.max(-spareY, framing.pan.y));
  return framing;
}

/** Traces a polygon path on the context (without filling or stroking it). */
function tracePolygon(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/**
 * Draws one panel: its photo cover-fitted to the panel's box with the panel's pan and zoom, clipped to the
 * slanted polygon, with the cover's colour grade laid over it. A panel with no photo gets a dusk gradient
 * placeholder (and, in the editor, a hint that it is waiting for one).
 */
export function drawPanelPhoto(ctx, poly, photo, framing, grade, intensity, forExport) {
  const box = polygonBox(poly);
  ctx.save();
  tracePolygon(ctx, poly);
  ctx.clip();
  if (photo) {
    clampPan(framing, photo.naturalWidth, photo.naturalHeight, box);
    const scale = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight) * framing.zoom;
    const dw = photo.naturalWidth * scale;
    const dh = photo.naturalHeight * scale;
    const dx = box.x + box.w / 2 - dw / 2 + framing.pan.x * box.w;
    const dy = box.y + box.h / 2 - dh / 2 + framing.pan.y * box.h;
    ctx.filter = grade.filter;
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const dusk = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    dusk.addColorStop(0, '#31135c');
    dusk.addColorStop(0.55, '#7c1d68');
    dusk.addColorStop(1, '#e8542f');
    ctx.fillStyle = dusk;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    if (!forExport) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `700 ${Math.max(15, box.h * 0.055)}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('＋ ADD A PHOTO', box.x + box.w / 2, box.y + box.h / 2);
    }
  }
  applyColourGrade(ctx, box, grade, intensity);
  ctx.restore();
}

/**
 * Lays the grade over one panel: the wash gradient in soft-light so it tints rather than paints, a fainter
 * overlay pass for punch, and a dark floor gradient at the panel's foot so the poster's lower edge deepens.
 */
export function applyColourGrade(ctx, box, grade, intensity) {
  if (grade.wash) {
    const wash = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    for (const [at, colour] of grade.wash) wash.addColorStop(at, colour);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.9 * intensity;
    ctx.fillStyle = wash;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.35 * intensity;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const floor = ctx.createLinearGradient(0, box.y + box.h * 0.55, 0, box.y + box.h);
  floor.addColorStop(0, 'rgba(0, 0, 0, 0)');
  floor.addColorStop(1, grade.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

/**
 * Draws the poster's white panel borders: a dark edge under a warm-white line over every seam, then the
 * outer frame. In the editor the selected panel is ringed in cyan instead, so it is obvious which panel
 * the controls are framing.
 */
export function drawPanelBorders(ctx, layoutName, w, h, selected, forExport) {
  const count = LAYOUTS[layoutName].panels.length;
  const passes = [
    ['rgba(12, 6, 18, 0.9)', Math.max(5, w * 0.011)],
    ['#f7f1e3', Math.max(3, w * 0.0068)],
  ];
  for (const [style, width] of passes) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    for (let i = 0; i < count; i++) {
      tracePolygon(ctx, panelPolygon(layoutName, i, w, h));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#f7f1e3';
  ctx.lineWidth = Math.max(4, w * 0.008);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  if (!forExport && selected >= 0) {
    ctx.strokeStyle = '#22d8f2';
    ctx.lineWidth = Math.max(3, w * 0.005);
    ctx.setLineDash([w * 0.02, w * 0.012]);
    tracePolygon(ctx, panelPolygon(layoutName, selected, w, h));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * The caption lettering: condensed-feeling capitals (a slight forward lean and a tall, narrow scale), a
 * thick dark outline, a sunset gradient fill running white-hot through amber to hot pink, and a hard offset
 * shadow. The size shrinks until the words fit the cover's width.
 */
export function drawCaptionLettering(ctx, caption, w, h) {
  const text = caption.trim().toUpperCase();
  if (!text) return;
  let size = Math.min(w, h) * 0.155;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = () => { ctx.font = `900 ${size}px ${DISPLAY_FONT}`; };
  setFont();
  while (ctx.measureText(text).width > w * 0.9 && size > 14) {
    size *= 0.94;
    setFont();
  }
  const cx = w / 2;
  const baseline = size * 1.18;
  ctx.save();
  ctx.translate(cx, baseline);
  ctx.transform(1, 0, -0.07, 1, 0, 0); // the forward lean
  ctx.scale(0.94, 1.1); // tall and narrow
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.shadowColor = 'rgba(8, 2, 16, 0.55)';
  ctx.shadowOffsetX = size * 0.045;
  ctx.shadowOffsetY = size * 0.06;
  ctx.shadowBlur = size * 0.04;
  ctx.strokeStyle = '#17082e';
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  const fill = ctx.createLinearGradient(0, -size, 0, size * 0.25);
  fill.addColorStop(0, '#fff6c8');
  fill.addColorStop(0.38, '#ffc93d');
  fill.addColorStop(0.68, '#ff7a3d');
  fill.addColorStop(1, '#ff2e88');
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = size * 0.018;
  ctx.strokeText(text, 0, 0);
  ctx.restore();
}

/**
 * The subtitle, set like a small neon sign along the poster's foot: letterspaced capitals in ice blue with
 * a cyan glow, on a translucent dark pill so it stays readable over any photo.
 */
export function drawSubtitleBadge(ctx, subtitle, w, h) {
  const text = subtitle.trim().toUpperCase();
  if (!text) return;
  const size = Math.min(w, h) * 0.034;
  ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
  try { ctx.letterSpacing = `${size * 0.32}px`; } catch { /* older engines: spacing is a garnish */ }
  const tw = ctx.measureText(text).width;
  const padX = size * 0.9;
  const pillW = tw + padX * 2;
  const pillH = size * 1.9;
  const x = (w - pillW) / 2;
  const y = h - pillH - h * 0.035;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(10, 4, 26, 0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(64, 224, 255, 0.8)';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#19c8ee';
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = '#c9f6ff';
  ctx.fillText(text, w / 2, y + pillH / 2 + size * 0.04);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* as above */ }
}

/** A soft radial vignette over the whole poster, so the corners sink and the middle glows. */
function drawVignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const vig = ctx.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r);
  vig.addColorStop(0, 'rgba(8, 2, 18, 0)');
  vig.addColorStop(1, 'rgba(8, 2, 18, 0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** A dark scrim behind the caption so the lettering wins against bright skies in the top panels. */
function drawTitleScrim(ctx, w, h) {
  const scrim = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  scrim.addColorStop(0, 'rgba(10, 3, 24, 0.5)');
  scrim.addColorStop(1, 'rgba(10, 3, 24, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h * 0.3);
}

/**
 * Draws the whole cover described by `state` onto ctx at w x h. `state` carries the layout name, the grade
 * name and intensity, the caption and subtitle, the loaded photos, and one framing per panel
 * ({ photo: index into photos or -1, pan: {x, y}, zoom }). With forExport set, editor-only marks (the
 * selection ring, the add-a-photo hints) are left off: that is the picture the export button writes.
 */
export function drawCoverArt(ctx, w, h, state, { forExport = false } = {}) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.vice;
  ctx.fillStyle = '#1c0b30';
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((_, i) => {
    const framing = state.panels[i] ?? { photo: -1, pan: { x: 0, y: 0 }, zoom: 1 };
    const photo = framing.photo >= 0 ? state.photos[framing.photo] : null;
    drawPanelPhoto(ctx, panelPolygon(state.layout, i, w, h), photo ?? null, framing, grade, state.intensity, forExport);
  });
  drawVignette(ctx, w, h);
  drawPanelBorders(ctx, state.layout, w, h, state.selected, forExport);
  drawTitleScrim(ctx, w, h);
  drawCaptionLettering(ctx, state.caption, w, h);
  drawSubtitleBadge(ctx, state.subtitle, w, h);
}
