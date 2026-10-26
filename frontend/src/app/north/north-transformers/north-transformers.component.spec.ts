import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { ItemLightDTO, SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';
import { StandardTransformerDTO, TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { NorthTransformersComponent } from './north-transformers.component';

const [south1, , south3] = testData.south.listLight;
const customTransformer = testData.north.list[0].transformers[0].transformer;

const standard = (functionName: string, inputType: StandardTransformerDTO['inputType'], withOptions = false): StandardTransformerDTO => ({
  id: functionName,
  type: 'standard',
  functionName,
  inputType,
  outputType: 'file',
  manifest: {
    type: 'object',
    key: 'options',
    translationKey: '',
    attributes: withOptions
      ? [
          {
            type: 'string',
            key: 'topic',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.point-id',
            defaultValue: null,
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 4, displayInViewMode: true }
          }
        ]
      : [],
    enablingConditions: [],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
});

const toItemLight = (item: SouthConnectorItemDTO): ItemLightDTO => ({
  id: item.id,
  name: item.name,
  enabled: item.enabled,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

class NorthTransformersComponentTester {
  readonly fixture = TestBed.createComponent(NorthTransformersComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('.source-row');
  readonly dataSourceRow = this.root.getByCss('.data-source-row');
  readonly addButton = this.root.getByRole('button', { name: 'Add a transformer' });
  readonly search = this.root.getByLabelText('Search sources');
  readonly noSource = this.root.getByText('No source matches');
  readonly emitted: Array<Array<TransformerDTOWithOptions> | null> = [];

  constructor(
    northConnector: NorthConnectorDTO | null,
    saveChangesDirectly: boolean,
    transformers: Array<TransformerDTO> = [customTransformer]
  ) {
    this.fixture.componentRef.setInput('northManifest', testData.north.manifest);
    this.fixture.componentRef.setInput('transformers', transformers);
    this.fixture.componentRef.setInput('certificates', testData.certificates.list);
    this.fixture.componentRef.setInput('scanModes', testData.scanMode.list);
    this.fixture.componentRef.setInput('northConnector', northConnector);
    this.fixture.componentRef.setInput('saveChangesDirectly', saveChangesDirectly);
    this.fixture.componentInstance.inMemoryTransformersWithOptions.subscribe(value => this.emitted.push(value));
  }

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  /** A filter chip: of the transformer status, of the status or of the type of the souths */
  filterChip(kind: 'status' | 'enabled' | 'type', label: string) {
    return this.root.getByCss(`.${kind}-filter`).filter({ hasText: new RegExp(`^${label}`) });
  }

  /** Expands a south, then the group of its items without group */
  async expandItems(name: string) {
    await this.row(name).getByRole('button', { name: 'Show the groups and items' }).click();
    await this.root.getByCss('.routing-group').getByRole('button', { name: 'Show the groups and items' }).click();
  }

  item(name: string) {
    return this.root.getByCss('.routing-item').filter({ hasText: name });
  }
}

describe('NorthTransformersComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditNorthTransformerModalComponent | AuditHistoryModalComponent>;
  let northConnector: NorthConnectorDTO;
  let newTransformer: TransformerDTOWithOptions;

  function createFakeEditModal() {
    return createMock(EditNorthTransformerModalComponent, { directSave: signal(true), existingTransformers: signal([]) });
  }

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    southConnectorService.list.mockReturnValue(of(testData.south.listLight));
    southConnectorService.findById.mockImplementation(southId => of(testData.south.list.find(south => south.id === southId)!));
    northConnectorService.addOrEditTransformer.mockImplementation((_northId, transformer) => of(transformer));
    northConnectorService.removeTransformer.mockReturnValue(of(undefined));
    confirmationService.confirm.mockReturnValue(of(undefined));

    northConnector = structuredClone(testData.north.list[0]);
    newTransformer = {
      id: 'temp_1',
      transformer: testData.north.list[0].transformers[2].transformer,
      options: {},
      source: { type: 'oianalytics-setpoint' }
    };

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should list every source, with the transformer its data goes through', async () => {
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await expect.element(tester.rows).toHaveLength(5);
    // only one of the two items of South 1 has a transformer: its items are loaded to tell it
    await expect.element(tester.row('South 1').getByCss('.routing-partial')).toHaveTextContent('Partly sent');
    expect(southConnectorService.findById).toHaveBeenCalledTimes(1);
    expect(southConnectorService.findById).toHaveBeenCalledWith('southId1');
    await expect.element(tester.row('South 1')).toMatchTextContent('1 transformer(s) for groups or items');
    await expect.element(tester.row('South 2').getByCss('.routing-sent')).toHaveTextContent('my transformer 3');
    await expect.element(tester.row('South 2')).toMatchTextContent('my transformer 3All items');
    await expect.element(tester.row('South 3').getByCss('.routing-dropped')).toHaveTextContent('Dropped');
    await expect.element(tester.row('South 3').getByRole('button', { name: 'Other…' })).toBeVisible();
    await expect.element(tester.row('OIBus API')).toMatchTextContent('Partly sent');
    await expect.element(tester.dataSourceRow).toMatchTextContent('dataSourceId1my transformer 2');
    // no standard transformer takes setpoints, but a custom one could
    await expect.element(tester.row('OIAnalytics setpoints')).toMatchTextContent('Dropped');
    await expect.element(tester.row('OIAnalytics setpoints').getByRole('button', { name: 'Other…' })).toBeVisible();
    await expect.element(tester.row('South 2').getByRole('button', { name: 'View transformer audit history' })).toBeVisible();
  });

  test('should filter the sources', async () => {
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await expect.element(tester.filterChip('status', 'Partly sent')).toMatchTextContent('Partly sent2');
    await tester.filterChip('status', 'Dropped').click();
    await expect.element(tester.rows).toHaveLength(2);
    await tester.filterChip('status', 'Partly sent').click();
    await expect.element(tester.rows).toHaveLength(4);
    await tester.filterChip('status', 'Dropped').click();
    await expect.element(tester.rows).toHaveLength(2);
    await tester.root.getByRole('button', { name: 'Clear' }).click();
    await expect.element(tester.rows).toHaveLength(5);

    // the OIBus API and the OIAnalytics setpoints have no status nor type
    await tester.filterChip('enabled', 'Disabled').click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.rows).toMatchTextContent('South 2');
    await tester.root.getByRole('button', { name: 'Clear' }).click();

    await tester.filterChip('type', 'OPC UA').click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.rows).toMatchTextContent('South 3');
    await tester.filterChip('type', 'Folder scanner').click();
    await expect.element(tester.rows).toHaveLength(2);
    await tester.root.getByRole('button', { name: 'Clear' }).click();

    await tester.search.fill('south 3');
    await expect.element(tester.rows).toHaveLength(1);
    await tester.search.fill('nothing');
    await expect.element(tester.noSource).toBeVisible();
  });

  test('should show a south as sent when all its items have a transformer', async () => {
    const source = northConnector.transformers[0].source;
    if (source.type !== 'south') throw new Error('Expected a south source');
    source.items.push(toItemLight(testData.south.list[0].items[1]));
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await expect.element(tester.row('South 1').getByCss('.routing-sent')).toHaveTextContent('Sent');
    await expect.element(tester.row('South 1')).toMatchTextContent('1 transformer(s) for groups or items');
  });

  test('should show the options of a transformer displayed in view mode', async () => {
    const oianalytics: StandardTransformerDTO = {
      ...standard('record-list-to-oianalytics', 'record-list'),
      outputType: 'oianalytics',
      manifest: {
        ...standard('record-list-to-oianalytics', 'record-list').manifest,
        attributes: [
          {
            type: 'string',
            key: 'pointIdColumn',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.point-id-column',
            defaultValue: 'pointId',
            validators: [],
            displayProperties: { row: 0, columns: 4, displayInViewMode: false }
          },
          {
            type: 'string-select',
            key: 'precision',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp.precision',
            defaultValue: 'ms',
            selectableValues: ['ms', 's', 'min', 'hr'],
            validators: [],
            displayProperties: { row: 1, columns: 4, displayInViewMode: true }
          }
        ]
      }
    };
    northConnector.transformers[2] = {
      ...northConnector.transformers[2],
      transformer: oianalytics,
      options: { pointIdColumn: 'id', precision: 's' }
    };
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await expect.element(tester.row('South 2').getByCss('.transformer-options')).toMatchTextContent('Timestamp precision: Second');
  });

  test('should flag the transformers which are never used', async () => {
    northConnector.transformers.push({ ...northConnector.transformers[2], id: 'shadowed' });
    const tester = new NorthTransformersComponentTester(northConnector, false);

    await expect.element(tester.row('South 2').getByCss('.routing-chip.routing-unused')).toHaveTextContent('my transformer 3');
  });

  describe('in memory', () => {
    test('should add a transformer', async () => {
      const fakeModal = createFakeEditModal();
      modalService.mockClosedModal(fakeModal, newTransformer);
      const tester = new NorthTransformersComponentTester(null, false);

      await tester.addButton.click();

      expect(fakeModal.directSave()).toBe(false);
      expect(fakeModal.existingTransformers()).toEqual([]);
      expect(fakeModal.prepareForCreation).toHaveBeenCalledWith(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [customTransformer],
        testData.north.manifest.types,
        null
      );
      expect(tester.emitted).toEqual([[newTransformer]]);
      expect(northConnectorService.addOrEditTransformer).not.toHaveBeenCalled();
    });

    test('should add a transformer for a source', async () => {
      const fakeModal = createFakeEditModal();
      modalService.mockDismissedModal(fakeModal);
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.row('South 3').getByRole('button', { name: 'Other…' }).click();
      expect(fakeModal.prepareForCreation.mock.calls[0][5]).toEqual({ dataSourceType: 'south', south: south3 });

      await tester.row('OIBus API').getByRole('button', { name: 'Other…' }).click();
      expect(fakeModal.prepareForCreation.mock.calls[1][5]).toEqual({ dataSourceType: 'oibus-api', south: undefined });
    });

    test('should add the obvious transformer of a source in one click', async () => {
      const json = standard('record-list-to-json', 'record-list');
      const tester = new NorthTransformersComponentTester(northConnector, false, [customTransformer, json, standard('file', 'file', true)]);

      // the file transformer needs its options to be set: it cannot be added in one click
      await expect.element(tester.row('OIBus API').getByCss('.quick-add')).not.toBeInTheDocument();
      await tester.row('South 3').getByRole('button', { name: 'JSON' }).click();

      expect(tester.emitted).toEqual([
        [
          ...northConnector.transformers,
          {
            id: expect.stringMatching(/^temp_/),
            transformer: json,
            options: {},
            source: { type: 'south', south: south3, items: [], excludedItems: [] }
          }
        ]
      ]);
      await expect.element(tester.row('South 3')).toMatchTextContent('JSONAll items');
    });

    test('should edit a transformer at its place in the list', async () => {
      const editedTransformer: TransformerDTOWithOptions = { ...northConnector.transformers[2], options: { field: 'value' } };
      const fakeModal = createFakeEditModal();
      modalService.mockClosedModal(fakeModal, editedTransformer);
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.row('South 2').getByRole('button', { name: 'Edit transformer' }).click();

      expect(fakeModal.prepareForEdition.mock.calls[0][5]).toEqual(northConnector.transformers[2]);
      expect(tester.emitted).toEqual([[northConnector.transformers[0], northConnector.transformers[1], editedTransformer]]);
    });

    test('should delete a transformer, after confirmation', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, false);

      confirmationService.confirm.mockReturnValueOnce(of());
      await tester.dataSourceRow.getByRole('button', { name: 'Delete transformer' }).click();
      expect(tester.emitted).toEqual([]);

      await tester.dataSourceRow.getByRole('button', { name: 'Delete transformer' }).click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'north.transformers.confirm-deletion' });
      expect(tester.emitted).toEqual([[northConnector.transformers[0], northConnector.transformers[2]]]);
      expect(northConnectorService.removeTransformer).not.toHaveBeenCalled();
    });

    test('should leave an item out of the transformer of its south', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, false);
      await tester.expandItems('South 2');

      await expect.element(tester.item('item3')).toMatchTextContent('my transformer 3from all items');
      await tester.item('item3').getByRole('button', { name: 'Exclude' }).click();

      const item3 = toItemLight(testData.south.list[1].items[0]);
      const [, , excluding] = tester.emitted[0]!;
      expect(excluding.source).toEqual({ ...northConnector.transformers[2].source, excludedItems: [item3] });
      await expect.element(tester.item('item3')).toMatchTextContent('Dropped');
      await expect.element(tester.row('South 2')).toMatchTextContent('All items, except 1');
      // the excluded item is dropped: the transformer of all the items only sends part of the data of the south
      await expect.element(tester.row('South 2').getByCss('.routing-partial')).toHaveTextContent('my transformer 3');
    });

    test('should add an item to the transformer of the same options instead of adding one', async () => {
      const item2 = toItemLight(testData.south.list[0].items[1]);
      modalService.mockClosedModal(createFakeEditModal(), {
        ...northConnector.transformers[0],
        id: 'temp_2',
        source: { type: 'south', south: south1, items: [item2] }
      });
      const tester = new NorthTransformersComponentTester(northConnector, false);
      await tester.expandItems('South 1');

      await tester.item('item2').getByRole('button', { name: 'Add' }).click();

      const [merged] = tester.emitted[0]!;
      expect(merged.id).toBe('northTransformerId1');
      expect(merged.source.type === 'south' && merged.source.items.map(item => item.id)).toEqual(['southItemId1', 'southItemId2']);
      await expect.element(tester.item('item2')).toMatchTextContent('shared with 1 other item(s)');

      // removing an item from the shared transformer keeps it for the other one
      await tester.item('item2').getByRole('button', { name: 'Remove this item from the transformer' }).click();
      const [remaining] = tester.emitted[1]!;
      expect(remaining.source.type === 'south' && remaining.source.items.map(item => item.id)).toEqual(['southItemId1']);
    });

    test('should add a transformer for an item when the one of the other items has different options', async () => {
      const item2 = toItemLight(testData.south.list[0].items[1]);
      const override: TransformerDTOWithOptions = {
        ...northConnector.transformers[0],
        id: 'temp_2',
        options: { other: true },
        source: { type: 'south', south: south1, items: [item2] }
      };
      modalService.mockClosedModal(createFakeEditModal(), override);
      const tester = new NorthTransformersComponentTester(northConnector, false);
      await tester.expandItems('South 1');

      await tester.item('item2').getByRole('button', { name: 'Add' }).click();

      expect(tester.emitted).toEqual([[...northConnector.transformers, override]]);
    });

    test('should delete the transformer of the last item removed from it', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, false);
      await tester.expandItems('South 1');

      await tester.item('item1').getByRole('button', { name: 'Remove this item from the transformer' }).click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(tester.emitted).toEqual([[northConnector.transformers[1], northConnector.transformers[2]]]);
    });
  });

  describe('saved directly', () => {
    test('should add a transformer', async () => {
      const fakeModal = createFakeEditModal();
      modalService.mockClosedModal(fakeModal, newTransformer);
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.addButton.click();

      expect(fakeModal.directSave()).toBe(true);
      expect(northConnectorService.addOrEditTransformer).toHaveBeenCalledWith('northId1', { ...newTransformer, id: '' });
      // the modal result is not mutated
      expect(newTransformer.id).toBe('temp_1');
      expect(notificationService.success).toHaveBeenCalledWith('north.transformers.added');
      // the parent reloads the connector
      expect(tester.emitted).toEqual([northConnector.transformers]);
    });

    test('should edit a transformer', async () => {
      const editedTransformer: TransformerDTOWithOptions = { ...northConnector.transformers[1], options: { field: 'value' } };
      modalService.mockClosedModal(createFakeEditModal(), editedTransformer);
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.dataSourceRow.getByRole('button', { name: 'Edit transformer' }).click();

      expect(northConnectorService.addOrEditTransformer).toHaveBeenCalledWith('northId1', editedTransformer);
      expect(notificationService.success).toHaveBeenCalledWith('north.transformers.edited');
      expect(tester.emitted).toHaveLength(1);
    });

    test('should delete a transformer', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.row('South 2').getByRole('button', { name: 'Delete transformer' }).click();

      expect(northConnectorService.removeTransformer).toHaveBeenCalledWith('northId1', 'northTransformerId3');
      expect(notificationService.success).toHaveBeenCalledWith('north.transformers.removed');
      expect(tester.emitted).toEqual([[northConnector.transformers[0], northConnector.transformers[1]]]);
    });

    test('should open the audit history of a transformer', async () => {
      const fakeModal = createMock(AuditHistoryModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.row('South 2').getByRole('button', { name: 'View transformer audit history' }).click();

      expect(fakeModal.prepare).toHaveBeenCalledWith('north_transformer', 'northTransformerId3');
    });

    test('should reset the list when the connector changes', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, true);
      await expect.element(tester.row('South 2')).toMatchTextContent('my transformer 3');

      tester.fixture.componentRef.setInput('northConnector', { ...northConnector, transformers: [] });

      await expect.element(tester.row('South 2')).toMatchTextContent('Dropped');
    });
  });
});
