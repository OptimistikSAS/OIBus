/**
 * Filtering, sorting and selection of the items displayed by the item table (south and history query items).
 * Pure functions returning new values, so that the table can keep its state in signals.
 */

/** What every item displayed in the table has. */
export interface TableItem {
  name: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SortOrder = 'none' | 'asc' | 'desc';

/** The sort of the table: a column (one of the built-in ones, or a column added by the page) and its order. */
export interface ItemSort {
  column: string | null;
  order: SortOrder;
}

/** Items are displayed in their original order until a column is sorted. */
export const NO_ITEM_SORT: ItemSort = { column: null, order: 'none' };

/** The built-in filter: a part of the name, and the enabled/disabled status (null for all). */
export interface ItemFilter {
  name: string | null;
  status: 'enabled' | 'disabled' | null;
}

/** Selected items, by name (unique among the items of a connector or of a history query). */
export type ItemSelection<T> = ReadonlyMap<string, T>;

const NEXT_SORT_ORDER: Record<SortOrder, SortOrder> = { none: 'asc', asc: 'desc', desc: 'none' };
const SORT_ICONS: Record<SortOrder, string> = { none: 'fa-sort', asc: 'fa-sort-up', desc: 'fa-sort-down' };

export function filterItems<T extends TableItem>(items: ReadonlyArray<T>, filter: ItemFilter): Array<T> {
  const searchText = (filter.name || '').toLowerCase();
  return items.filter(item => {
    if (searchText && !item.name.toLowerCase().includes(searchText)) return false;
    if (filter.status === 'enabled' && !item.enabled) return false;
    return !(filter.status === 'disabled' && item.enabled);
  });
}

/** Clicking a column cycles through ascending, descending and no sort; clicking another column sorts it ascending. */
export function nextItemSort(sort: ItemSort, column: string): ItemSort {
  return { column, order: NEXT_SORT_ORDER[sort.column === column ? sort.order : 'none'] };
}

export function itemSortIcon(sort: ItemSort, column: string): string {
  return SORT_ICONS[sort.column === column ? sort.order : 'none'];
}

/** The value compared to sort the built-in columns. */
export function builtInSortValue(item: TableItem, column: string): string | number {
  switch (column) {
    case 'enabled':
      return item.enabled ? 1 : 0;
    case 'createdAt':
      return item.createdAt || '';
    case 'updatedAt':
      return item.updatedAt || '';
    default:
      return item.name;
  }
}

/**
 * Returns a sorted copy of the items (or the items themselves when no column is sorted).
 * @param getValue the value of an item to compare for a column
 */
export function sortItems<T>(items: Array<T>, sort: ItemSort, getValue: (item: T, column: string) => string | number): Array<T> {
  const column = sort.column;
  if (!column || sort.order === 'none') {
    return items;
  }
  const direction = sort.order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const aValue = getValue(a, column);
    const bValue = getValue(b, column);
    const comparison =
      typeof aValue === 'number' && typeof bValue === 'number' ? aValue - bValue : String(aValue).localeCompare(String(bValue));
    return comparison * direction;
  });
}

export function toggleItemSelection<T extends TableItem>(selection: ItemSelection<T>, item: T): ItemSelection<T> {
  const newSelection = new Map(selection);
  if (newSelection.has(item.name)) {
    newSelection.delete(item.name);
  } else {
    newSelection.set(item.name, item);
  }
  return newSelection;
}

export function selectItems<T extends TableItem>(selection: ItemSelection<T>, items: ReadonlyArray<T>): ItemSelection<T> {
  const newSelection = new Map(selection);
  items.forEach(item => newSelection.set(item.name, item));
  return newSelection;
}
