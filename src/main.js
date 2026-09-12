import { createScene } from './scene.js';

// placeholder until the client's sections are settled
const SECTIONS = [
  { label: 'Origin', teaser: 'A studio working between artefact and instrument.' },
  { label: 'Studio', teaser: 'Ten years of building objects that outlast their brief.' },
  { label: 'Contact', teaser: 'Berlin, and wherever the work needs to happen.' },
];

const loaderEl = document.getElementById('loader');
const pctEl = document.getElementById('pct');
const dotsEl = document.getElementById('dots');
const labelEl = document.getElementById('label');
const teaserEl = document.getElementById('teaser');

const app = await createScene(document.getElementById('gl'), (p) => {
  pctEl.textContent = Math.round(p) + '%';
});
loaderEl.classList.add('done');
requestAnimationFrame(() => dotsEl.classList.add('in'));

function show(i) {
  app.preview(i);
  const s = SECTIONS[i];
  labelEl.textContent = s ? s.label : '';
  labelEl.classList.toggle('on', !!s);
  teaserEl.textContent = s ? s.teaser : '';
  teaserEl.classList.toggle('on', !!s);
}

function sync() {
  [...dotsEl.children].forEach((b, i) => b.setAttribute('aria-current', String(app.locked === i)));
  show(app.locked);
}

SECTIONS.slice(0, app.count).forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', s.label);
  b.addEventListener('pointerenter', () => show(i));
  b.addEventListener('pointerleave', () => show(app.locked));
  b.addEventListener('focus', () => show(i));
  b.addEventListener('click', () => {
    app.lock(app.locked === i ? -1 : i);
    sync();
  });
  dotsEl.append(b);
});

app.onLock = sync;
show(-1);

window.__app = app;
