import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ItemLightDTO, SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { ItemChecklistComponent, SHOWN_ITEMS_LIMIT } from './item-checklist.component';

const group = buildSouthItemGroup('groupId1', 'Group 1');
const [item1, item2] = testData.south.list[0].items;
const items: Array<SouthConnectorItemDTO> = [
  { ...item1, group },
  { ...item2, enabled: false }
];

class ItemChecklistComponentTester {
  readonly fixture = TestBed.createComponent(ItemChecklistComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly search = this.root.getByLabelText('Search items...');
  readonly selectMatching = this.root.getByLabelText('Select all the matching items');
  readonly count = this.root.getByCss('.selection-count');
  readonly selectedOnly = this.root.getByLabelText('Selected only');
  readonly clear = this.root.getByRole('button', { name: 'Clear' });
  readonly rows = this.root.getByCss('.checklist-item');

  constructor(checklistItems: ReadonlyArray<SouthConnectorItemDTO> = items, selection: Array<ItemLightDTO> = []) {
    this.fixture.componentRef.setInput('items', checklistItems);
    this.fixture.componentRef.setInput('groups', [group]);
    this.fixture.componentRef.setInput('scanModes', testData.scanMode.list);
    this.fixture.componentRef.setInput('selection', selection);
  }

  item(name: string) {
    return this.root.getByRole('checkbox', { name, exact: true });
  }

  selectedNames() {
    return this.fixture.componentInstance.selection().map(item => item.name);
  }
}

describe('ItemChecklistComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should list the items with their group and scan mode, and check them', async () => {
    const tester = new ItemChecklistComponentTester();

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.rows.nth(0)).toMatchTextContent(`item1Group 1${group.standardSettings.scanMode.name}`);
    await expect.element(tester.count).toHaveTextContent('0 of 2 items selected');
    await expect.element(tester.clear).not.toBeInTheDocument();

    await tester.item('item2').click();

    await expect.element(tester.item('item2')).toBeChecked();
    await expect.element(tester.count).toHaveTextContent('1 of 2 items selected');
    expect(tester.selectedNames()).toEqual(['item2']);
    await tester.item('item2').click();
    expect(tester.selectedNames()).toEqual([]);
  });

  test('should select and unselect all the matching items', async () => {
    const tester = new ItemChecklistComponentTester();
    await tester.root.getByLabelText('Status').selectOptions('Enabled');

    await tester.selectMatching.click();
    expect(tester.selectedNames()).toEqual(['item1']);
    await expect.element(tester.selectMatching).toBeChecked();

    // some of the matching items selected: the header checkbox is indeterminate
    await tester.root.getByLabelText('Status').selectOptions('All statuses');
    await expect.element(tester.selectMatching).toBePartiallyChecked();
    await tester.selectMatching.click();
    expect(tester.selectedNames()).toEqual(['item1', 'item2']);
    await tester.selectMatching.click();
    expect(tester.selectedNames()).toEqual([]);

    await tester.search.fill('nothing');
    await expect.element(tester.root.getByText('No items found')).toBeVisible();
    await expect.element(tester.selectMatching).toBeDisabled();
  });

  test('should show only the selected items, and clear the selection', async () => {
    const tester = new ItemChecklistComponentTester(items, [item2]);

    await tester.selectedOnly.click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.item('item2')).toBeChecked();

    await tester.clear.click();
    expect(tester.selectedNames()).toEqual([]);
    await expect.element(tester.rows).toHaveLength(0);
  });

  test('should tell the count with the given translation', async () => {
    const tester = new ItemChecklistComponentTester(items, [item1]);
    tester.fixture.componentRef.setInput('countKey', 'configuration.oibus.manifest.transformers.left-out-count');

    await expect.element(tester.count).toHaveTextContent('1 of 2 items left out');
  });

  test('should list the first items only, and select all the matching ones', async () => {
    const manyItems = Array.from({ length: SHOWN_ITEMS_LIMIT + 5 }, (_, index) => ({ ...item1, id: `id${index}`, name: `item${index}` }));
    const tester = new ItemChecklistComponentTester(manyItems);

    await expect.element(tester.rows).toHaveLength(SHOWN_ITEMS_LIMIT);
    await expect
      .element(tester.root.getByCss('#more-items'))
      .toHaveTextContent(`Showing the first ${SHOWN_ITEMS_LIMIT} of ${SHOWN_ITEMS_LIMIT + 5} items: search or filter to reach the others`);

    await tester.selectMatching.click();
    expect(tester.selectedNames()).toHaveLength(SHOWN_ITEMS_LIMIT + 5);
  });
});
