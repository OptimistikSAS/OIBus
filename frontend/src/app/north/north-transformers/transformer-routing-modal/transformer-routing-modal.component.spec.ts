import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerRoutingModalComponent } from './transformer-routing-modal.component';

const group: SouthItemGroupDTO = {
  id: 'groupId1',
  standardSettings: { name: 'Group 1', scanMode: testData.scanMode.list[0] },
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

const south = testData.south.listLight[0];
const baseSouth = testData.south.list[0];
if (baseSouth.type !== 'folder-scanner') throw new Error('Expected a folder scanner in the test data');
const [baseItem] = baseSouth.items;
const item = (id: string, itemGroup: SouthItemGroupDTO | null, enabled = true): typeof baseItem => ({
  ...baseItem,
  id,
  name: id,
  enabled,
  group: itemGroup
});
const southConnector: SouthConnectorDTO = {
  ...baseSouth,
  items: [item('b-grouped', group), item('a-grouped', group), item('item-level', null), item('dropped', null, false)]
};
const transformer = (id: string, source: TransformerDTOWithOptions['source']): TransformerDTOWithOptions => ({
  id,
  transformer: testData.transformers.customList[0],
  options: {},
  source
});

class TransformerRoutingModalComponentTester {
  readonly fixture = TestBed.createComponent(TransformerRoutingModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly south = this.root.getByLabelText('Source');
  readonly summary = this.root.getByCss('#routing-summary');
  readonly groupRows = this.root.getByCss('tr.routing-group');
  readonly itemRows = this.root.getByCss('tr.routing-item');
  readonly search = this.root.getByLabelText('Search items...');
  readonly onlyDropped = this.root.getByLabelText('Only dropped items');
  readonly sendDropped = this.root.getByRole('button', { name: 'Send the dropped items' });
}

describe('TransformerRoutingModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    southConnectorService.findById.mockReturnValue(of(southConnector));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });
  });

  test('should show the transformer each item of a south is routed to, by group', async () => {
    const tester = new TransformerRoutingModalComponentTester();
    tester.component.prepare(
      testData.south.listLight,
      [
        transformer('items', {
          type: 'south',
          south,
          items: [
            {
              id: 'item-level',
              name: 'item-level',
              enabled: true,
              createdBy: baseItem.createdBy,
              updatedBy: baseItem.updatedBy,
              createdAt: '',
              updatedAt: ''
            }
          ]
        }),
        transformer('group', { type: 'south', south, group: { id: 'groupId1', name: 'Group 1' }, items: [], excludedItems: [] })
      ],
      south
    );

    expect(southConnectorService.findById).toHaveBeenCalledWith(south.id);
    await expect.element(tester.summary).toHaveTextContent('4 items, 1 of which are dropped');
    await expect.element(tester.groupRows).toHaveLength(2);
    await expect.element(tester.groupRows.nth(0)).toHaveTextContent('No group');
    await expect.element(tester.groupRows.nth(1)).toHaveTextContent('Group: Group 1');
    await expect.element(tester.itemRows).toHaveLength(4);
    await expect.element(tester.itemRows.nth(0)).toMatchTextContent('dropped Dropped: no transformer');
    await expect.element(tester.itemRows.nth(1)).toMatchTextContent(`item-level ${testData.transformers.customList[0].name}This item`);
    await expect.element(tester.itemRows.nth(2)).toMatchTextContent('a-grouped');
    await expect.element(tester.itemRows.nth(2)).toMatchTextContent('Its group');

    await tester.sendDropped.click();
    expect(activeModal.close).toHaveBeenCalledWith(south);
  });

  test('should filter the items', async () => {
    const tester = new TransformerRoutingModalComponentTester();
    tester.component.prepare(testData.south.listLight, [transformer('south', { type: 'south', south, items: [] })], south);
    await expect.element(tester.summary).toHaveTextContent('4 items, 0 of which are dropped');
    await expect.element(tester.itemRows.nth(0)).toMatchTextContent('All items');
    // every item is sent: nothing to send
    await expect.element(tester.sendDropped).not.toBeInTheDocument();

    await tester.search.fill('grouped');
    await expect.element(tester.itemRows).toHaveLength(2);
    await tester.onlyDropped.click();
    await expect.element(tester.root.getByText('No item to display')).toBeVisible();
  });

  test('should select the south to show', async () => {
    const tester = new TransformerRoutingModalComponentTester();
    tester.component.prepare(testData.south.listLight, [], null);
    await expect.element(tester.summary).not.toBeInTheDocument();

    await tester.south.selectOptions('South 1 (Folder scanner)');
    await expect.element(tester.summary).toHaveTextContent('4 items, 4 of which are dropped');
    await expect.element(tester.sendDropped).toBeVisible();

    await tester.south.selectOptions('');
    await expect.element(tester.summary).not.toBeInTheDocument();
    await tester.root.getByRole('button', { name: 'Close' }).click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
