/**
 * Sorting and selection of the south items displayed in a table, shared by the south detail and edition pages.
 * Pure functions returning new values, so that the pages can keep their state in signals.
 */

export type SouthItemSortColumn = 'name' | 'scanMode' | 'group' | 'enabled' | 'createdAt' | 'updatedAt';

export type SortState = 'none' | 'asc' | 'desc';

export interface SouthItemSort {
  column: SouthItemSortColumn;
  state: SortState;
}

/** Items are displayed in their original order until a column is sorted. */
export const NO_SOUTH_ITEM_SORT: SouthItemSort = { column: 'name', state: 'none' };

const NEXT_SORT_STATE: Record<SortState, SortState> = { none: 'asc', asc: 'desc', desc: 'none' };
const SORT_ICONS: Record<SortState, string> = { none: 'fa-sort', asc: 'fa-sort-up', desc: 'fa-sort-down' };

/** Clicking a column cycles through ascending, descending and no sort; clicking another column sorts it ascending. */
export function nextSouthItemSort(sort: SouthItemSort, column: SouthItemSortColumn): SouthItemSort {
  return { column, state: NEXT_SORT_STATE[sort.column === column ? sort.state : 'none'] };
}

export function southItemSortIcon(sort: SouthItemSort, column: SouthItemSortColumn): string {
  return SORT_ICONS[sort.column === column ? sort.state : 'none'];
}

/**
 * Returns a sorted copy of the items.
 * @param getValue the value of an item to compare for a column
 */
export function sortSouthItems<T>(
  items: Array<T>,
  sort: SouthItemSort,
  getValue: (item: T, column: SouthItemSortColumn) => string | number
): Array<T> {
  if (sort.state === 'none') {
    return items;
  }
  const direction = sort.state === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const aValue = getValue(a, sort.column);
    const bValue = getValue(b, sort.column);
    const comparison =
      typeof aValue === 'number' && typeof bValue === 'number' ? aValue - bValue : String(aValue).localeCompare(String(bValue));
    return comparison * direction;
  });
}

/** Selected items, by name. */
export type SouthItemSelection<T> = ReadonlyMap<string, T>;

export function toggleSouthItemSelection<T extends { name: string }>(selection: SouthItemSelection<T>, item: T): SouthItemSelection<T> {
  const newSelection = new Map(selection);
  if (newSelection.has(item.name)) {
    newSelection.delete(item.name);
  } else {
    newSelection.set(item.name, item);
  }
  return newSelection;
}

export function selectSouthItems<T extends { name: string }>(selection: SouthItemSelection<T>, items: Array<T>): SouthItemSelection<T> {
  const newSelection = new Map(selection);
  items.forEach(item => newSelection.set(item.name, item));
  return newSelection;
}
