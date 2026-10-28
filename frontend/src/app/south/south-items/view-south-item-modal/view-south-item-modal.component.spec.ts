import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemLastValue } from '@oibus/shared/domain/south-connector.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { ViewSouthItemModalComponent } from './view-south-item-modal.component';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list;
const southConnector = testData.south.list[0];
const [savedItem] = southConnector.items;

class ViewSouthItemModalComponentTester {
  readonly fixture = TestBed.createComponent(ViewSouthItemModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly cache = this.root.getByCss('#item-cache');
  readonly spinner = this.cache.getByRole('status');
  readonly error = this.cache.getByRole('alert');
  readonly fileRows = this.cache.getByCss('tbody tr');
  readonly groupCache = this.root.getByCss('#group-cache');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly editButton = this.root.getByRole('button', { name: 'Edit' });
  readonly test = this.root.getByCss('#item-test');
  readonly norths = this.root.getByCss('#item-norths');

  constructor(item: SouthConnectorItemDTO = savedItem, itemManifest: SouthConnectorManifest = manifest) {
    this.fixture.componentInstance.prepare(item, southConnector, itemManifest, scanModes, []);
  }

  /** The value of an entry of the cache, by its label */
  cached(label: string) {
    return this.cache
      .getByCss('.oib-summary-entry')
      .filter({ has: page.getByText(label, { exact: true }) })
      .getByRole('definition');
  }

  /** The value of a setting, by its label */
  setting(label: string) {
    return this.root
      .getByCss('#item-summary .oib-summary-entry')
      .filter({ has: page.getByText(label, { exact: true }) })
      .getByRole('definition');
  }
}

function buildLastValue(overrides: Partial<SouthItemLastValue> = {}): SouthItemLastValue {
  return {
    itemId: 'id1',
    itemName: 'item1',
    groupId: null,
    groupName: '',
    queryTime: '2024-01-01T12:00:00.000Z',
    value: { temperature: 21 },
    trackedInstant: '2024-01-02T12:00:00.000Z',
    ...overrides
  };
}

describe('ViewSouthItemModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        {
          provide: NorthConnectorService,
          useValue: createMock(NorthConnectorService, {
            list: () => of(testData.north.listLight),
            findById: (northId: string) => of(testData.north.list.find(north => north.id === northId)!),
            getNorthManifest: (type: OIBusNorthType) => of({ ...testData.north.manifest, id: type })
          })
        },
        { provide: TransformerService, useValue: createMock(TransformerService, { list: () => of(testData.transformers.customList) }) },
        { provide: HistoryQueryService, useValue: createMock(HistoryQueryService) },
        { provide: EngineService, useValue: createMock(EngineService, { getInfo: () => of(testData.engine.oIBusInfo) }) }
      ]
    });
  });

  test('should display the item and its settings while its cache is fetched', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    await expect.element(tester.title).toHaveTextContent('item1');
    await expect.element(tester.spinner).toBeVisible();
    await expect.element(tester.setting('Name')).toHaveTextContent('item1');
    await expect.element(tester.setting('Status')).toHaveTextContent('Enabled');
    await expect.element(tester.setting('Group')).toHaveTextContent('None');
    await expect.element(tester.setting('Schedule')).toHaveTextContent('scanMode1');
    await expect.element(tester.setting('Start time offset')).toHaveTextContent('0 ms');
    await expect.element(tester.root.getByCss('#settings-summary')).toBeInTheDocument();
    await expect.element(tester.test.getByText('Testing item')).toBeVisible();
    await expect.element(tester.test.getByRole('button', { name: 'Run test' })).toBeVisible();
  });

  test('should display the history settings of the group the item is synced with', async () => {
    const group = buildSouthItemGroup('group1', 'GroupA', scanModes[1], {
      historySettings: {
        startTimeOffset: 500,
        endTimeOffset: 600,
        maxReadInterval: 60,
        readDelay: 10,
        recoveryStrategy: 'newest',
        cachingStrategy: null
      }
    });
    const tester = new ViewSouthItemModalComponentTester({ ...savedItem, group, syncWithGroup: true });

    await expect.element(tester.setting('Group')).toHaveTextContent('GroupA');
    await expect.element(tester.setting('Schedule')).toHaveTextContent('scanMode2');
    await expect.element(tester.setting('Sync with group')).toHaveTextContent('Yes');
    await expect.element(tester.setting('Max read interval')).toHaveTextContent('60 s');
    await expect.element(tester.setting('Recovery strategy')).toHaveTextContent('From newest to oldest');
  });

  test('should display the caching settings of an IoT item', async () => {
    const tester = new ViewSouthItemModalComponentTester(
      { ...savedItem, cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 2 },
      { ...manifest, id: 'opcua' }
    );

    await expect.element(tester.setting('Caching strategy')).toHaveTextContent('Threshold');
    await expect.element(tester.setting('Threshold type')).toHaveTextContent('Absolute');
  });

  test('should display the item cache', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: buildLastValue(), groupLastValue: null });

    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.cached('Last Query Time')).toMatchTextContent('1 Jan 2024');
    await expect.element(tester.cached('Tracked Instant')).toMatchTextContent('2 Jan 2024');
    await expect.element(tester.cached('Cached Value')).toMatchTextContent('"temperature": 21');
    await expect.element(tester.fileRows).toHaveLength(0);
    await expect.element(tester.groupCache).not.toBeInTheDocument();
  });

  test('should display placeholders when nothing is cached', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ queryTime: null, trackedInstant: null, value: null }),
      groupLastValue: null
    });

    await expect.element(tester.cached('Last Query Time')).toHaveTextContent('No cached value');
    await expect.element(tester.cached('Tracked Instant')).toHaveTextContent('–');
    await expect.element(tester.cached('Cached Value')).toHaveTextContent('No cached value');
  });

  test('should display placeholders when the item has no last value', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: null, groupLastValue: null });

    await expect.element(tester.cached('Last Query Time')).toHaveTextContent('No cached value');
    await expect.element(tester.cached('Cached Value')).toHaveTextContent('No cached value');
  });

  test('should display the tracked files in a table', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({
        value: [
          { filename: 'file1.csv', modifiedTime: Date.parse('2024-01-03T12:00:00.000Z') },
          { filename: 'file2.csv', modifiedTime: Date.parse('2024-01-04T12:00:00.000Z') }
        ]
      }),
      groupLastValue: null
    });

    await expect.element(tester.fileRows).toHaveLength(2);
    await expect.element(tester.fileRows.nth(0)).toMatchTextContent('file1.csv');
    await expect.element(tester.fileRows.nth(0)).toMatchTextContent('3 Jan 2024');
    await expect.element(tester.fileRows.nth(1)).toMatchTextContent('file2.csv');
    await expect.element(tester.cache.getByText('2 file(s) tracked')).toBeVisible();
    await expect.element(tester.cache.getByCss('pre')).not.toBeInTheDocument();
  });

  test('should display an array of values which are not files as JSON', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({ itemLastValue: buildLastValue({ value: ['a', 'b'] }), groupLastValue: null });

    await expect.element(tester.cache.getByCss('pre')).toMatchTextContent('"a"');
    await expect.element(tester.fileRows).toHaveLength(0);
  });

  test('should display the group cache when the item belongs to a group', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA' }),
      groupLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA', trackedInstant: '2024-01-05T12:00:00.000Z', value: 'group' })
    });

    await expect.element(tester.groupCache.getByText('Group last tracked value')).toBeVisible();
    const groupValues = tester.groupCache.getByRole('definition');
    await expect.element(groupValues.nth(0)).toMatchTextContent('5 Jan 2024');
    await expect.element(groupValues.nth(1)).toMatchTextContent('"group"');
  });

  test('should display placeholders in the group cache when the group has no value', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setData({
      itemLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA' }),
      groupLastValue: buildLastValue({ groupId: 'group1', groupName: 'GroupA', trackedInstant: null, value: null })
    });

    const groupValues = tester.groupCache.getByRole('definition');
    await expect.element(groupValues.nth(0)).toHaveTextContent('–');
    await expect.element(groupValues.nth(1)).toHaveTextContent('No cached value');
  });

  test('should display an error in place of the cache', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    tester.fixture.componentInstance.setError('boom');

    await expect.element(tester.error).toHaveTextContent('Could not retrieve the last cached valueboom');
    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.setting('Name')).toHaveTextContent('item1');
  });

  test('should show the norths the data of the item is sent to, without attaching transformers', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    await expect.element(tester.norths.getByRole('listitem')).toHaveLength(2);
    await expect.element(tester.norths.getByRole('listitem').first()).toMatchTextContent(/my transformer 1this item/);
    await tester.norths.getByRole('listitem').nth(1).click();
    await expect.element(tester.norths.getByCss('#route-not-sent')).toBeVisible();
    await expect.element(tester.norths.getByRole('button', { name: 'Attach a transformer' })).not.toBeInTheDocument();
  });

  test('should close the modal to edit the item', async () => {
    const tester = new ViewSouthItemModalComponentTester();

    await tester.editButton.click();

    expect(activeModal.close).toHaveBeenCalled();
  });

  test.each([0, 1])('should dismiss the modal with the close button %i', async index => {
    const tester = new ViewSouthItemModalComponentTester();

    await tester.closeButton.nth(index).click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
