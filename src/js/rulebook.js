// Rulebook content, shared by the header button, the Help modal, and (later)
// the tutorial. Kept as one source of truth so the wording never drifts.

const rules = [
  {
    n: 1,
    key: 'No three in a row',
    icon: 'align-justify',
    text: 'No three identical symbols may sit next to each other in a line — horizontally or vertically. Two in a row is fine; a third is not.',
    demo: ['s', 's', 'm'],
    demoNote: 'Two Suns, then it must break.',
  },
  {
    n: 2,
    key: 'Balance',
    icon: 'scale',
    text: 'Every row and every column must hold an equal number of Suns and Moons — exactly half each.',
    demo: ['s', 'm', 's', 'm'],
    demoNote: 'Half Suns, half Moons.',
  },
  {
    n: 3,
    key: 'Equals ( = )',
    icon: 'equal',
    text: 'Two cells joined by an = on their shared edge must hold the same symbol.',
    demo: ['s', '=', 's'],
    demoNote: 'Same on both sides.',
  },
  {
    n: 4,
    key: 'Cross ( × )',
    icon: 'x',
    text: 'Two cells joined by a × on their shared edge must hold opposite symbols.',
    demo: ['s', 'x', 'm'],
    demoNote: 'Opposites on each side.',
  },
];

function glyph(tok) {
  if (tok === 's') return `<i data-lucide="sun" class="text-sun" style="width:20px;height:20px"></i>`;
  if (tok === 'm') return `<i data-lucide="moon" class="text-moon" style="width:18px;height:18px"></i>`;
  if (tok === '=' || tok === 'x') {
    return `<span class="font-mono text-ink-muted text-sm">${tok === '=' ? '=' : '×'}</span>`;
  }
  return '';
}

function demoStrip(demo) {
  const items = demo.map((tok) => {
    const isConstraint = tok === '=' || tok === 'x';
    if (isConstraint) return `<span class="px-0.5">${glyph(tok)}</span>`;
    return `<span class="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-2">${glyph(tok)}</span>`;
  }).join('');
  return `<div class="flex items-center gap-1.5">${items}</div>`;
}

function ruleCard(r) {
  return `
    <div class="rounded-xl border border-line bg-surface-2/50 p-4">
      <div class="flex items-center gap-3 mb-2">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-3 text-moon font-mono text-sm">${r.n}</span>
        <h3 class="font-display text-lg text-ink">${r.key}</h3>
      </div>
      <p class="text-sm text-ink-muted mb-3">${r.text}</p>
      <div class="flex items-center gap-3">
        ${demoStrip(r.demo)}
        <span class="text-xs text-ink-faint">${r.demoNote}</span>
      </div>
    </div>`;
}

/** HTML string for the rulebook body. */
export function rulebookBody() {
  return `
    <p class="mb-4 text-ink-muted">
      Tango is a logic puzzle on an even-sized grid. Every cell is a
      <span class="text-sun">Sun</span> or a <span class="text-moon">Moon</span>.
      Every puzzle has exactly one solution, reachable by pure logic — never by guessing.
    </p>
    <div class="grid sm:grid-cols-2 gap-3">
      ${rules.map(ruleCard).join('')}
    </div>`;
}

export { rules };
