const CHART_COLOR_COUNT = 12;

/**
 * Attribution de couleur par ordre de première apparition (pas par hash) :
 * garantit que chaque source a une couleur différente de ses voisines tant
 * que le nombre de sources distinctes ne dépasse pas la palette, et reste
 * stable/cohérente entre le graphique, la légende et le tableau des
 * transactions au sein d'une même session.
 */
const assignedIndex = new Map<string, number>();
let nextIndex = 0;

function colorIndexForSource(label: string): number {
  let index = assignedIndex.get(label);
  if (index === undefined) {
    index = nextIndex % CHART_COLOR_COUNT;
    assignedIndex.set(label, index);
    nextIndex += 1;
  }
  return index;
}

export function sourceLabel(source: string, medium: string): string {
  return `${source} / ${medium}`;
}

/** Couleur pleine (utilisée par le graphique et les badges), stable pour un même libellé de source. */
export function colorForSource(label: string): string {
  return `var(--chart-${colorIndexForSource(label) + 1})`;
}
