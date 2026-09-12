import { createScene } from './scene.js';
import { SECTIONS, renderPage } from './pages.js';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const $ = (id) => document.getElementById(id);

const loaderEl = $('loader');
const pctEl = $('pct');
const dotsEl = $('dots');
const labelEl = $('label');
const teaserEl = $('teaser');
const cardEl = $('card');
const cardLabel = $('cardLabel');
const menuEl = $('menu');
const menuToggle = $('menuToggle');
const pageEl = $('page');
const canvas = $('gl');

const app = await createScene(canvas, (p) => {
  pctEl.textContent = Math.round(p) + '%';
});
loaderEl.classList.add('done');

/* ── nav dots ─────────────────────────────────────────────────────────────── */
SECTIONS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', s.label);
  b.addEventListener('pointerenter', () => preview(i));
  b.addEventListener('pointerleave', () => preview(-1));
  b.addEventListener('focus', () => preview(i));
  b.addEventListener('click', () => go('/' + s.slug));
  dotsEl.append(b);
});
requestAnimationFrame(() => dotsEl.classList.add('in'));

function preview(i) {
  app.preview(i);
  const s = SECTIONS[i];
  labelEl.textContent = s ? s.label : '';
  labelEl.classList.toggle('on', !!s);
  teaserEl.textContent = s ? s.teaser : '';
  teaserEl.classList.toggle('on', !!s);
}
preview(-1);

/* ── menu inside the card ─────────────────────────────────────────────────── */
menuEl.innerHTML = SECTIONS.map((s) => `<a href="${BASE}/${s.slug}">${s.label}</a>`).join('');
menuToggle.addEventListener('click', () => {
  const open = menuEl.hidden;
  menuEl.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
});

/* ── routing ──────────────────────────────────────────────────────────────────
   One page with a small router rather than separate documents: the WebGL scene has
   to survive navigation for the canvas to shrink into the card instead of reloading. */
function go(path) {
  history.pushState({}, '', BASE + path);
  render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  go(a.getAttribute('href').slice(BASE.length) || '/');
});
addEventListener('popstate', render);

function render() {
  const slug = location.pathname.slice(BASE.length).replace(/^\/|\/$/g, '');
  const section = SECTIONS.find((s) => s.slug === slug);

  cardEl.hidden = !section;
  canvas.classList.toggle('mini', !!section);
  pageEl.hidden = !section;
  document.body.classList.toggle('on-page', !!section);
  menuEl.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');

  if (section) {
    cardLabel.textContent = section.label;
    pageEl.innerHTML = renderPage(section.slug);
    document.title = `${section.label} | TENTH`;
    app.lock(SECTIONS.indexOf(section));
  } else {
    pageEl.innerHTML = '';
    document.title = 'TENTH';
    app.lock(-1);
  }
  preview(-1);
  scrollTo(0, 0);
}

// the canvas is sized by CSS, so let the element itself tell the renderer
new ResizeObserver(() => app.resize()).observe(canvas);

render();
