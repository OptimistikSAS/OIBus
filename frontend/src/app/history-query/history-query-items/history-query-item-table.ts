/**
 * Filtering, sorting and selection of the history query items displayed in a table, shared by the history query detail
 * and edition pages. Pure functions returning new values, so that the pages can keep their state in signals.
 */

export type ItemSortColumn = 'name' | 'enabled' | 'createdAt' | 'updatedAt';

/** The sort of the table: a column and its order (none, ascending or descending) */
export interface ItemSort {
  column: ItemSortColumn | null;
  order: 'none' | 'asc' | 'desc';
}

export const NO_ITEM_SORT: ItemSort = { column: null, order: 'none' };

/** The items filter: a name part and an enabled/disabled status (null for all) */
export interface ItemFilter {
  name: string | null;
  status: string | null;
}

interface TableItem {
  name: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function filterItems<T extends TableItem>(items: Array<T>, filter: ItemFilter): Array<T> {
  const searchText = (filter.name || '').toLowerCase();
  return items.filter(item => {
    if (searchText && !item.name.toLowerCase().includes(searchText)) return false;
    if (filter.status === 'enabled' && !item.enabled) return false;
    if (filter.status === 'disabled' && item.enabled) return false;
    return true;
  });
}

export function sortItems<T extends TableItem>(items: Array<T>, sort: ItemSort): Array<T> {
  if (!sort.column || sort.order === 'none') {
    return items;
  }
  const direction = sort.order === 'asc' ? 1 : -1;
  switch (sort.column) {
    case 'name':
      return [...items].sort((a, b) => a.name.localeCompare(b.name) * direction);
    case 'enabled':
      return [...items].sort((a, b) => (Number(a.enabled) - Number(b.enabled)) * direction);
    case 'createdAt':
      return [...items].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * direction);
    case 'updatedAt':
      return [...items].sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || '') * direction);
  }
}

/** Clicking a column header cycles its order (none, ascending, descending), and resets the order of the other columns */
export function nextItemSort(sort: ItemSort, column: ItemSortColumn): ItemSort {
  const currentOrder = sort.column === column ? sort.order : 'none';
  const nextOrder = currentOrder === 'none' ? 'asc' : currentOrder === 'asc' ? 'desc' : 'none';
  return { column, order: nextOrder };
}

export function itemSortIcon(sort: ItemSort, column: ItemSortColumn): string {
  if (sort.column !== column || sort.order === 'none') {
    return 'fa-sort';
  }
  return sort.order === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

/** Selects or unselects an item (identified by its name, unique in a history query) */
export function toggleItemSelection<T extends TableItem>(selection: ReadonlyMap<string, T>, item: T): ReadonlyMap<string, T> {
  const newSelection = new Map(selection);
  if (newSelection.has(item.name)) {
    newSelection.delete(item.name);
  } else {
    newSelection.set(item.name, item);
  }
  return newSelection;
}

/** Adds the given items to the selection */
export function selectItems<T extends TableItem>(selection: ReadonlyMap<string, T>, items: Array<T>): ReadonlyMap<string, T> {
  const newSelection = new Map(selection);
  items.forEach(item => newSelection.set(item.name, item));
  return newSelection;
}
