/**
 * Finds the index of an item being edited in its in-memory list. Unsaved items all share an empty id, so the
 * lookup is done by reference first (the tables display slices of the same list), then by non-empty id, and
 * finally by name (unique among the items of a connector).
 */
export function findItemIndex<T extends { id?: string | null; name: string }>(items: Array<T>, item: T): number {
  const index = items.indexOf(item);
  if (index !== -1) {
    return index;
  }
  if (item.id) {
    const idIndex = items.findIndex(i => i.id === item.id);
    if (idIndex !== -1) {
      return idIndex;
    }
  }
  return items.findIndex(i => i.name === item.name);
}
