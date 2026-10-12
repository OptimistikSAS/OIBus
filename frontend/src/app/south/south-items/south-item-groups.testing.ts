import { signal, WritableSignal } from '@angular/core';

import { Observable, of } from 'rxjs';
import { Mock, vi } from 'vitest';

import { SaveGroupCommand, SouthItemGroup, SouthItemGroups } from './south-item-groups';

/** The groups of a page, for the specs of the modals: the groups are saved and deleted in memory, like edit-south does. */
export interface FakeSouthItemGroups extends SouthItemGroups {
  readonly list: WritableSignal<ReadonlyArray<SouthItemGroup>>;
  readonly save: Mock<(command: SaveGroupCommand) => Observable<SouthItemGroup>>;
  readonly delete: Mock<(group: SouthItemGroup) => Observable<void>>;
}

/**
 * Creates the groups of a page. By default, `save` creates the group with the `created-<n>` id (or replaces the edited
 * one) and `delete` removes it: override them with `mockReturnValue` to simulate an error or a cancellation.
 */
export function fakeSouthItemGroups(initialGroups: ReadonlyArray<SouthItemGroup> = []): FakeSouthItemGroups {
  const list = signal<ReadonlyArray<SouthItemGroup>>(initialGroups);
  let created = 0;
  return {
    list,
    save: vi.fn((command: SaveGroupCommand) => {
      const group = command.mode === 'create' ? { ...command.group, id: `created-${++created}` } : command.group;
      list.update(groups => (command.mode === 'create' ? [...groups, group] : groups.map(g => (g.id === group.id ? group : g))));
      return of(group);
    }),
    delete: vi.fn((group: SouthItemGroup) => {
      list.update(groups => groups.filter(g => g.id !== group.id));
      return of(undefined);
    })
  };
}
