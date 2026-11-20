// Fixed scenes for screenshots, driven by the query string:
//   ?shot=editor  the editor with photos loaded and a panel selected
//   ?shot=cover   the cover alone, filling the window
//   ?shot=export  like cover, and window.__exportedPng holds the PNG data URL the Export button writes
// Scene parameters: photos=car,boat (sample names, loaded in order), assign=0,1,1 (photo index per panel),
// frames=4,-0.12,0.05,1.7 (panel, pan x, pan y, zoom; repeatable), layout, grade, intensity, caption,
// subtitle, size=1920x1080, select. window.__shotReady is set once the scene is painted.

const DEFAULT_PHOTOS = ['boulevard', 'car', 'boat', 'pier'];
const DEFAULT_ASSIGN = [0, 1, 3, 2, 1];
// The opening scene's signature crops: the pier panel pushed in a little, the last car panel tight.
const DEFAULT_FRAMES = ['2,0,0,1.25', '4,-0.12,0.05,1.7'];

export async function runShot(shot, query, api) {
  if (shot === 'cover' || shot === 'export') document.body.classList.add('shot-cover');

  const size = (query.get('size') ?? '1080x1080').split('x').map(Number);
  api.setSize(size[0], size[1]);
  api.setLayout(query.get('layout') ?? 'vice');
  api.setGrade(query.get('grade') ?? 'sunset', Number(query.get('intensity') ?? 0.85));
  api.setTexts(query.get('caption') ?? 'Sunset Heat', query.get('subtitle') ?? 'Palm Shores');

  const names = (query.get('photos') ?? DEFAULT_PHOTOS.join(',')).split(',').filter(Boolean);
  for (const name of names) await api.addSample(name);

  const assign = (query.get('assign') ?? DEFAULT_ASSIGN.join(',')).split(',').map(Number);
  api.assign(assign);
  const frames = query.getAll('frames');
  for (const frame of frames.length ? frames : DEFAULT_FRAMES) {
    const [panel, x, y, zoom] = frame.split(',').map(Number);
    api.setFraming(panel, { x, y }, zoom);
  }
  api.select(Number(query.get('select') ?? 0));
  api.redraw();

  if (shot === 'export') window.__exportedPng = api.exportPngDataUrl();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
