const CHART_COLOR_COUNT = 5;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorIndexForSource(label: string): number {
  return hashString(label) % CHART_COLOR_COUNT;
}

export function sourceLabel(source: string, medium: string): string {
  return `${source} / ${medium}`;
}

/** Couleur pleine (utilisée par le graphique et les badges), stable pour un même libellé de source. */
export function colorForSource(label: string): string {
  return `var(--chart-${colorIndexForSource(label) + 1})`;
}
