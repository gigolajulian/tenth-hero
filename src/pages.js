/* Section content. Deliberately structural — the copy is filler and the imagery is
   placeholder blocks at real aspect ratios, so the layouts can be judged and the
   real material dropped in without touching any of this. */

export const SECTIONS = [
  {
    slug: 'work',
    label: 'Work',
    teaser: 'Selected projects, objects and collaborations.',
  },
  {
    slug: 'about',
    label: 'About',
    teaser: 'A studio working between artefact and instrument.',
  },
  {
    slug: 'contact',
    label: 'Contact',
    teaser: 'Reach any of the three studios.',
  },
];

// ratio drives the placeholder's aspect; the grid reads as photography without any
const TILES = [
  1.4, 0.75, 1, 0.8, 1.5, 0.72, 1.1, 0.68, 1.33, 0.8, 1, 1.45,
];

const tile = (r, i) =>
  `<figure class="tile" style="aspect-ratio:${r}"><span>${String(i + 1).padStart(2, '0')}</span></figure>`;

const PAGES = {
  work: () => `
    <header class="lede">
      <p>Selected projects, objects and collaborations. Placeholder copy — a paragraph
      at the same length and weight the real introduction will run to, so the column
      measure and the gap below it can be judged.</p>
    </header>
    <div class="grid">${TILES.map(tile).join('')}</div>
    <div class="lede">
      <p>A second block, set after the grid the way the reference breaks a long index
      into passages rather than running it unbroken.</p>
    </div>
    <div class="grid">${TILES.slice(0, 6).map(tile).join('')}</div>
  `,

  about: () => `
    <header class="lede">
      <p>Placeholder introduction. One paragraph at display size, carrying the weight
      the real opening statement will carry, set to the same measure as the reference.</p>
      <p>A second paragraph at body size. Filler standing in for the studio description
      — what the practice does, who it works with, and the ground it covers. Long enough
      to show how the column behaves at this width and how the leading reads across
      several lines of continuous text.</p>
      <p>A third paragraph, shorter, to close the passage before the first image.</p>
    </header>
    <figure class="tile wide" style="aspect-ratio:2.1"><span>Studio</span></figure>
    <div class="lede">
      <p>Text resumes under the full-bleed image. In the reference this is where the
      practice's history and its way of working are set out, broken by imagery rather
      than headings.</p>
    </div>
    <div class="grid two">
      <figure class="tile" style="aspect-ratio:0.8"><span>01</span></figure>
      <figure class="tile" style="aspect-ratio:0.8"><span>02</span></figure>
    </div>
  `,

  contact: () => `
    <header class="lede">
      <p>Placeholder contact introduction — one line naming the studios and how to
      reach them.</p>
    </header>
    <div class="offices">
      ${['First Studio', 'Second Studio', 'Third Studio']
        .map(
          (name, i) => `
        <address>
          <strong>${name}</strong>
          <span>Street name ${10 + i}</span>
          <span>00000 City</span>
          <span>Country</span>
          <a href="mailto:hello@example.com">hello@example.com</a>
        </address>`
        )
        .join('')}
    </div>
  `,
};

export function renderPage(slug) {
  const page = PAGES[slug];
  if (!page) return '';
  return `${page()}
    <footer class="page-foot">
      <span>&copy; 26 TENTH</span>
      <a href="mailto:hello@example.com">hello@example.com</a>
      <a href="#">Imprint</a>
      <a href="#">Privacy</a>
      <a href="#">Instagram</a>
    </footer>`;
}
