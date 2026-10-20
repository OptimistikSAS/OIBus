import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ItemsMenuComponent } from './items-menu.component';

@Component({
  template: `<oib-items-menu
    [itemCount]="itemCount()"
    [groupCount]="groupCount()"
    (manageGroups)="events.push('groups')"
    (importItems)="events.push('import')"
    (exportItems)="events.push('export')"
    (deleteAllItems)="events.push('delete-all')"
  />`,
  imports: [ItemsMenuComponent]
})
class TestComponent {
  readonly itemCount = signal(2);
  readonly groupCount = signal<number | null>(null);
  readonly events: Array<string> = [];
}

class ItemsMenuComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly menu = this.root.getByRole('button', { name: 'More actions on the items' });
  readonly manageGroups = this.root.getByCss('#manage-groups-button');
  readonly importItems = this.root.getByRole('button', { name: 'Import' });
  readonly exportItems = this.root.getByRole('button', { name: 'Export' });
  readonly deleteAllItems = this.root.getByRole('button', { name: 'Delete all' });
}

describe('ItemsMenuComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should import, export and delete all the items', async () => {
    const tester = new ItemsMenuComponentTester();

    await tester.menu.click();
    await expect.element(tester.manageGroups).not.toBeInTheDocument();
    await tester.importItems.click();
    await tester.menu.click();
    await tester.exportItems.click();
    await tester.menu.click();
    await tester.deleteAllItems.click();

    expect(tester.host.events).toEqual(['import', 'export', 'delete-all']);
  });

  test('should manage the groups of items that can be grouped, with their count', async () => {
    const tester = new ItemsMenuComponentTester();
    tester.host.groupCount.set(3);

    await tester.menu.click();
    await expect.element(tester.manageGroups).toHaveTextContent('Manage groups3');
    await tester.manageGroups.click();

    expect(tester.host.events).toEqual(['groups']);
  });

  test('should not delete all the items when there is none, but still export them', async () => {
    const tester = new ItemsMenuComponentTester();
    tester.host.itemCount.set(0);

    await tester.menu.click();
    await expect.element(tester.deleteAllItems).toBeDisabled();
    await expect.element(tester.exportItems).toBeEnabled();
  });
});
