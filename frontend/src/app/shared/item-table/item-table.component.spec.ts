import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgbDropdownItem } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing';
import { builtInSortValue, ItemSelection } from './item-table';
import { ItemTableComponent } from './item-table.component';
import { ITEM_TABLE_TEMPLATES } from './item-table-templates';

interface TestItem {
  name: string;
  enabled: boolean;
  group: string;
  createdAt?: string;
  createdBy?: { friendlyName: string };
  updatedAt?: string;
  updatedBy?: { friendlyName: string };
}

const buildItem = (name: string, enabled: boolean, group: string, createdAt = '2024-01-01T00:00:00.000Z'): TestItem => ({
  name,
  enabled,
  group,
  createdAt,
  createdBy: { friendlyName: 'creator' },
  updatedAt: createdAt,
  updatedBy: { friendlyName: 'editor' }
});

@Component({
  template: `
    <oib-item-table
      [items]="items()"
      translationPrefix="south.items"
      [showDates]="showDates()"
      [extraFilter]="groupFilter()"
      [sortValue]="sortValue"
      [(selection)]="selection"
      (enableSelected)="enableSelected()"
      (disableSelected)="disableSelected()"
      (deleteSelected)="deleteSelected()"
      (itemHover)="hovered.set($event)"
    >
      <ng-template oibItemTableFilters>
        <button type="button" id="only-group-a" (click)="onlyGroupA()">Only group A</button>
      </ng-template>
      <ng-template oibItemTableHeaders let-sortIcon="sortIcon" let-toggleSort="toggleSort">
        <th>
          <button type="button" class="group-sort" (click)="toggleSort('group')">
            Group
            <span class="fa-solid {{ sortIcon('group') }}" aria-hidden="true"></span>
          </button>
        </th>
      </ng-template>
      <ng-template [oibItemTableCells]="items()" let-item>
        <td class="group-cell">{{ item.group }}</td>
      </ng-template>
      <ng-template oibItemTableMassActions>
        <button type="button" ngbDropdownItem (click)="moveSelected()">Move</button>
      </ng-template>
      <ng-template [oibItemTableActions]="items()" let-item>
        <button type="button" [attr.aria-label]="'Edit ' + item.name" (click)="edit(item)">Edit</button>
      </ng-template>
    </oib-item-table>
  `,
  imports: [ItemTableComponent, ...ITEM_TABLE_TEMPLATES, NgbDropdownItem],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class HostComponent {
  readonly items = signal<Array<TestItem>>([
    buildItem('item b', true, 'B'),
    buildItem('item a', false, 'A'),
    buildItem('item c', true, 'A')
  ]);
  readonly showDates = signal(true);
  readonly groupFilter = signal<(item: TestItem) => boolean>(() => true);
  readonly selection = signal<ItemSelection<TestItem>>(new Map());
  readonly hovered = signal<TestItem | null>(null);
  readonly sortValue = (item: TestItem, column: string) => (column === 'group' ? item.group : builtInSortValue(item, column));
  readonly enableSelected = vi.fn();
  readonly disableSelected = vi.fn();
  readonly deleteSelected = vi.fn();
  readonly moveSelected = vi.fn();
  readonly edit = vi.fn();

  onlyGroupA() {
    this.groupFilter.set(item => item.group === 'A');
  }
}

class ItemTableTester {
  readonly fixture = TestBed.createComponent(HostComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly search = this.root.getByRole('textbox', { name: 'Search' });
  readonly status = this.root.getByRole('combobox', { name: 'Status' });
  readonly rows = this.root.getByCss('tbody tr');
  readonly selectAll = this.root.getByRole('button', { name: 'Select all' });
  readonly unselectAll = this.root.getByRole('button', { name: 'Unselect all' });
  readonly massActions = this.root.getByCss('#mass-actions-dropdown');
  readonly headers = this.root.getByCss('thead th');
  readonly menu = this.root.getByCss('.dropdown-menu');

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  sortBy(column: 'Status' | 'Name' | 'Created') {
    return this.root.getByCss('thead').getByRole('button', { name: column, exact: true });
  }

  async expectItems(...names: Array<string>) {
    await expect.element(this.rows).toHaveLength(names.length);
    expect(this.rows.elements().map(row => row.querySelectorAll('td')[2].textContent!.trim())).toEqual(names);
  }
}

describe('ItemTableComponent', () => {
  let tester: ItemTableTester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), provideCurrentUser()] });
    tester = new ItemTableTester();
  });

  test('should display the items with the columns of the page and the actions', async () => {
    await tester.expectItems('item b', 'item a', 'item c');
    await expect.element(tester.row('item a')).toMatchTextContent(/Disabled\s*item a\s*A/);
    await expect.element(tester.row('item a').getByCss('oib-audit-info')).toBeVisible();
    expect(tester.headers.elements().map(header => header.textContent!.trim())).toEqual(['', 'Status', 'Name', 'Group', 'Updated', '']);

    await tester.row('item c').getByRole('button', { name: 'Edit item c' }).click();

    expect(tester.host.edit).toHaveBeenCalledWith(tester.host.items()[2]);
  });

  test('should hide the dates', async () => {
    tester.host.showDates.set(false);

    await expect.element(tester.headers).toHaveLength(5);
    await expect.element(tester.root.getByRole('button', { name: 'Created' })).not.toBeInTheDocument();
  });

  test('should filter by name, status and the filter of the page', async () => {
    await tester.search.fill('item a');
    await tester.expectItems('item a');

    await tester.search.fill('');
    await tester.status.selectOptions('Enabled');
    await tester.expectItems('item b', 'item c');

    await tester.root.getByRole('button', { name: 'Only group A' }).click();
    await tester.expectItems('item c');

    await tester.search.fill('unknown');
    await expect.element(tester.root.getByText('No items match the search criteria')).toBeInTheDocument();
  });

  test('should tell when there is no item', async () => {
    tester.host.items.set([]);

    await expect.element(tester.root.getByText('No items has been defined on this connector yet')).toBeInTheDocument();
    await expect.element(tester.selectAll).not.toBeInTheDocument();
  });

  test.each([
    { column: 'Name', ascending: ['item a', 'item b', 'item c'], descending: ['item c', 'item b', 'item a'] },
    { column: 'Status', ascending: ['item a', 'item b', 'item c'], descending: ['item b', 'item c', 'item a'] }
  ] as const)('should sort by $column, then back to the original order', async ({ column, ascending, descending }) => {
    await tester.sortBy(column).click();
    await tester.expectItems(...ascending);
    await expect.element(tester.sortBy(column).getByCss('.fa-sort-up')).toBeInTheDocument();

    await tester.sortBy(column).click();
    await tester.expectItems(...descending);
    await expect.element(tester.sortBy(column).getByCss('.fa-sort-down')).toBeInTheDocument();

    await tester.sortBy(column).click();
    await tester.expectItems('item b', 'item a', 'item c');
  });

  test('should sort a column of the page', async () => {
    await tester.root.getByCss('.group-sort').click();

    await tester.expectItems('item a', 'item c', 'item b');
    await expect.element(tester.root.getByCss('.group-sort .fa-sort-up')).toBeInTheDocument();
  });

  test('should paginate, go back to the first page when filtering and stay on a valid page when items are removed', async () => {
    const items = Array.from({ length: 25 }, (_, index) => buildItem(`item ${String(index).padStart(2, '0')}`, true, 'A'));
    tester.host.items.set(items);
    await expect.element(tester.rows).toHaveLength(20);

    await tester.root.getByRole('link', { name: '2' }).click();
    await expect.element(tester.rows).toHaveLength(5);

    tester.host.items.set(items.slice(0, 22));
    await expect.element(tester.rows).toHaveLength(2);

    tester.host.items.set(items.slice(0, 10));
    await expect.element(tester.rows).toHaveLength(10);
    await expect.element(tester.row('item 00')).toBeInTheDocument();

    tester.host.items.set(items);
    await tester.root.getByRole('link', { name: '2' }).click();
    await tester.search.fill('item');
    await expect.element(tester.rows).toHaveLength(20);
  });

  test('should select items and run the actions on the selection', async () => {
    await tester.row('item a').getByRole('checkbox').click();
    await expect.element(tester.massActions).toHaveTextContent('Mass actions (1 items)');
    expect([...tester.host.selection().keys()]).toEqual(['item a']);

    await tester.selectAll.click();
    expect([...tester.host.selection().keys()]).toEqual(['item a', 'item b', 'item c']);
    await expect.element(tester.selectAll).toBeDisabled();

    await tester.massActions.click();
    await tester.menu.getByRole('button', { name: 'Enable' }).click();
    await tester.menu.getByRole('button', { name: 'Disable' }).click();
    await tester.menu.getByRole('button', { name: 'Move' }).click();
    await tester.menu.getByRole('button', { name: 'Delete' }).click();
    expect(tester.host.enableSelected).toHaveBeenCalledOnce();
    expect(tester.host.disableSelected).toHaveBeenCalledOnce();
    expect(tester.host.moveSelected).toHaveBeenCalledOnce();
    expect(tester.host.deleteSelected).toHaveBeenCalledOnce();

    await tester.unselectAll.click();
    expect(tester.host.selection().size).toBe(0);
    await expect.element(tester.massActions).not.toBeInTheDocument();
  });

  test('should reflect a selection cleared by the page', async () => {
    await tester.row('item a').getByRole('checkbox').click();
    await expect.element(tester.row('item a').getByRole('checkbox')).toBeChecked();

    tester.host.selection.set(new Map());

    await expect.element(tester.row('item a').getByRole('checkbox')).not.toBeChecked();
  });

  test('should emit the hovered item', async () => {
    await tester.row('item c').hover();

    expect(tester.host.hovered()).toEqual(tester.host.items()[2]);
  });
});
