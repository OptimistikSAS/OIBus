import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ItemLightDTO, SouthConnectorDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { TransformerSourcePreset } from '../edit-north-transformer-modal/edit-north-transformer-modal.component';
import { ItemAction, NorthSouthTransformersComponent } from './north-south-transformers.component';

const south = testData.south.listLight[0];
const baseSouth = testData.south.list[0];
if (baseSouth.type !== 'folder-scanner') throw new Error('Expected a folder scanner in the test data');
const [baseItem] = baseSouth.items;

const group: SouthItemGroupDTO = {
  id: 'groupId1',
  standardSettings: { name: 'Boilers', scanMode: testData.scanMode.list[0] },
  historySettings: {
    startTimeOffset: null,
    endTimeOffset: null,
    maxReadInterval: null,
    readDelay: null,
    recoveryStrategy: null,
    cachingStrategy: null
  },
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  createdAt: '',
  updatedAt: ''
};
const item = (id: string, inGroup: boolean, enabled = true): typeof baseItem => ({
  ...baseItem,
  id,
  name: id,
  enabled,
  group: inGroup ? group : null
});
const light = (id: string): ItemLightDTO => ({
  id,
  name: id,
  enabled: true,
  createdBy: baseItem.createdBy,
  updatedBy: baseItem.updatedBy,
  createdAt: baseItem.createdAt,
  updatedAt: baseItem.updatedAt
});
const groupItems = Array.from({ length: 25 }, (_, index) => item(`boiler-${String(index).padStart(2, '0')}`, true));
const southConnector: SouthConnectorDTO = {
  ...baseSouth,
  groups: [group],
  items: [...groupItems, item('pump', false), item('valve', false, false)]
};
const link = (id: string, source: Partial<Extract<TransformerDTOWithOptions['source'], { type: 'south' }>>): TransformerDTOWithOptions => ({
  id,
  transformer: testData.north.list[0].transformers[0].transformer,
  options: {},
  source: { type: 'south', south, items: [], ...source }
});

class NorthSouthTransformersComponentTester {
  readonly fixture = TestBed.createComponent(NorthSouthTransformersComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly groups = this.root.getByCss('.routing-group');
  readonly items = this.root.getByCss('.routing-item');
  readonly search = this.root.getByLabelText('Search items...');
  readonly added = vi.fn<(preset: TransformerSourcePreset) => void>();
  readonly edited = vi.fn<(transformer: TransformerDTOWithOptions) => void>();
  readonly removed = vi.fn<(transformer: TransformerDTOWithOptions) => void>();
  readonly audited = vi.fn<(transformer: TransformerDTOWithOptions) => void>();
  readonly excluded = vi.fn<(action: ItemAction) => void>();
  readonly removedItems = vi.fn<(action: ItemAction) => void>();

  constructor(transformers: Array<TransformerDTOWithOptions>, canAudit = false, loaded: SouthConnectorDTO | null = southConnector) {
    this.fixture.componentRef.setInput('south', south);
    this.fixture.componentRef.setInput('southConnector', loaded);
    this.fixture.componentRef.setInput('transformers', transformers);
    this.fixture.componentRef.setInput('canAudit', canAudit);
    this.component.add.subscribe(this.added);
    this.component.edit.subscribe(this.edited);
    this.component.remove.subscribe(this.removed);
    this.component.audit.subscribe(this.audited);
    this.component.exclude.subscribe(this.excluded);
    this.component.removeItem.subscribe(this.removedItems);
  }

  group(name: string) {
    return this.groups.filter({ hasText: name });
  }

  item(name: string) {
    return this.items.filter({ hasText: name });
  }

  async toggle(name: string) {
    await this.group(name)
      .getByRole('button', { name: /the groups and items/ })
      .click();
  }
}

describe('NorthSouthTransformersComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should wait for the south to be loaded', async () => {
    const tester = new NorthSouthTransformersComponentTester([], false, null);

    await expect.element(tester.root.getByCss('oib-loading-spinner')).toBeInTheDocument();

    tester.fixture.componentRef.setInput('southConnector', southConnector);
    await expect.element(tester.groups).toHaveLength(2);
  });

  test('should show the groups of the south and the transformer each item goes through', async () => {
    const groupLink = link('group', { group: { id: 'groupId1', name: 'Boilers' }, excludedItems: [light('boiler-00')] });
    const itemLink = link('items', { items: [light('pump'), light('boiler-01')] });
    const tester = new NorthSouthTransformersComponentTester(
      [groupLink, itemLink, link('south', { excludedItems: [light('valve')] })],
      true
    );

    await expect.element(tester.groups).toHaveLength(2);
    await expect.element(tester.group('Boilers')).toMatchTextContent('my transformer 1except 1 items');
    // boiler-00 is left out of the group transformer, but sent by the one of all the items
    await expect.element(tester.group('Boilers').getByCss('.routing-sent')).toHaveTextContent('my transformer 1');
    await expect.element(tester.group('No group')).toMatchTextContent('1 dropped');
    await expect.element(tester.group('No group')).toMatchTextContent('from all items: my transformer 1');
    await expect.element(tester.items).toHaveLength(0);

    await tester.toggle('Boilers');
    await expect.element(tester.items).toHaveLength(20);
    await expect.element(tester.item('boiler-00')).toMatchTextContent('my transformer 1from all items');
    await expect.element(tester.item('boiler-01')).toMatchTextContent('shared with 1 other item(s)');
    await expect.element(tester.item('boiler-02')).toMatchTextContent('my transformer 1from its group');
    await expect.element(tester.item('boiler-02').getByCss('.routing-sent')).toBeVisible();
    await tester.root.getByRole('link', { name: '2' }).click();
    await expect.element(tester.items).toHaveLength(5);

    await tester.toggle('No group');
    await expect.element(tester.item('valve').getByCss('.routing-dropped')).toHaveTextContent('Dropped');
    await expect.element(tester.item('valve').getByCss('.fa-minus-circle')).toBeVisible();
    await tester.toggle('Boilers');
    await expect.element(tester.items).toHaveLength(2);

    await tester.group('Boilers').getByRole('button', { name: 'Edit transformer' }).click();
    expect(tester.edited).toHaveBeenCalledWith(groupLink);
    await tester.group('Boilers').getByRole('button', { name: 'Delete transformer' }).click();
    expect(tester.removed).toHaveBeenCalledWith(groupLink);
    await tester.group('Boilers').getByRole('button', { name: 'View transformer audit history' }).click();
    expect(tester.audited).toHaveBeenCalledWith(groupLink);
    await tester.item('pump').getByRole('button', { name: 'Edit transformer' }).click();
    expect(tester.edited).toHaveBeenCalledWith(itemLink);
    await tester.item('pump').getByRole('button', { name: 'Remove this item from the transformer' }).click();
    expect(tester.removedItems).toHaveBeenCalledWith({ transformer: itemLink, item: expect.objectContaining({ id: 'pump' }) });
  });

  test('should offer to add a transformer to the groups and items without one', async () => {
    const tester = new NorthSouthTransformersComponentTester([]);

    await tester.group('Boilers').getByRole('button', { name: 'Add' }).click();
    expect(tester.added).toHaveBeenCalledWith({ dataSourceType: 'south', south, group: { id: 'groupId1', name: 'Boilers' } });

    await tester.toggle('No group');
    await tester.item('pump').getByRole('button', { name: 'Add' }).click();
    expect(tester.added).toHaveBeenLastCalledWith({ dataSourceType: 'south', south, items: [expect.objectContaining({ id: 'pump' })] });
  });

  test('should offer to override or exclude an item inheriting a transformer', async () => {
    const southLink = link('south', {});
    const tester = new NorthSouthTransformersComponentTester([southLink]);
    await tester.toggle('No group');

    await tester.item('pump').getByRole('button', { name: 'Override' }).click();
    expect(tester.added).toHaveBeenCalledWith({ dataSourceType: 'south', south, items: [expect.objectContaining({ id: 'pump' })] });
    await tester.item('pump').getByRole('button', { name: 'Exclude' }).click();
    expect(tester.excluded).toHaveBeenCalledWith({ transformer: southLink, item: expect.objectContaining({ id: 'pump' }) });
  });

  test('should search the items of every group', async () => {
    const tester = new NorthSouthTransformersComponentTester([]);

    await tester.search.fill('boiler-1');
    await expect.element(tester.items).toHaveLength(10);
    await tester.search.fill('nothing');
    await expect.element(tester.root.getByText('No item')).toHaveLength(2);
  });
});
