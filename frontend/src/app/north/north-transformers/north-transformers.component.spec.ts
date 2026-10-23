import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { ItemLightDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { fakeModal, MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { NorthTransformersComponent } from './north-transformers.component';
import { TransformerRoutingModalComponent } from './transformer-routing-modal/transformer-routing-modal.component';

function buildItem(index: number): ItemLightDTO {
  return {
    id: `itemId${index}`,
    name: `item${index}`,
    enabled: true,
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: ''
  };
}

class NorthTransformersComponentTester {
  readonly fixture = TestBed.createComponent(NorthTransformersComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add a transformer' });
  readonly none = this.root.getByText('No transformer');
  readonly uncovered = this.root.getByCss('#uncovered-souths');
  readonly uncoveredSouths = this.root.getByCss('.uncovered-south');
  readonly emitted: Array<Array<TransformerDTOWithOptions> | null> = [];

  constructor(northConnector: NorthConnectorDTO | null, saveChangesDirectly: boolean) {
    this.fixture.componentRef.setInput('northManifest', testData.north.manifest);
    this.fixture.componentRef.setInput('transformers', [testData.north.list[0].transformers[0].transformer]);
    this.fixture.componentRef.setInput('certificates', testData.certificates.list);
    this.fixture.componentRef.setInput('scanModes', testData.scanMode.list);
    this.fixture.componentRef.setInput('northConnector', northConnector);
    this.fixture.componentRef.setInput('saveChangesDirectly', saveChangesDirectly);
    this.fixture.componentInstance.inMemoryTransformersWithOptions.subscribe(value => this.emitted.push(value));
  }

  row(index: number) {
    return this.rows.nth(index);
  }

  cell(row: number, column: number) {
    return this.row(row).getByCss('td').nth(column);
  }

  editButton(row: number) {
    return this.row(row).getByRole('button', { name: 'Edit transformer' });
  }

  deleteButton(row: number) {
    return this.row(row).getByRole('button', { name: 'Delete transformer' });
  }
}

describe('NorthTransformersComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditNorthTransformerModalComponent | AuditHistoryModalComponent | TransformerRoutingModalComponent>;
  let northConnector: NorthConnectorDTO;
  let newTransformer: TransformerDTOWithOptions;

  function createFakeEditModal() {
    return createMock(EditNorthTransformerModalComponent, { directSave: signal(true) });
  }

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    southConnectorService.list.mockReturnValue(of(testData.south.listLight));
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

  test('should display an empty list', async () => {
    const tester = new NorthTransformersComponentTester(null, false);

    await expect.element(tester.none).toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(0);
  });

  test('should display the transformers of the connector', async () => {
    const base = northConnector.transformers[0];
    northConnector.transformers.push(
      {
        ...base,
        id: 'withGroup',
        source: { type: 'south', south: testData.south.listLight[0], group: { id: 'g1', name: 'Group 1' }, items: [] }
      },
      {
        ...base,
        id: 'severalItems',
        transformer: { ...testData.north.list[0].transformers[0].transformer, type: 'standard', functionName: 'file' },
        source: { type: 'south', south: testData.south.listLight[0], items: Array.from({ length: 7 }, (_, index) => buildItem(index)) }
      },
      { ...base, id: 'setpoint', source: { type: 'oianalytics-setpoint' } },
      { ...base, id: 'allDataSources', source: { type: 'oibus-api' } },
      {
        ...base,
        id: 'exceptItems',
        source: { type: 'south', south: testData.south.listLight[0], items: [], excludedItems: [buildItem(1), buildItem(2)] }
      }
    );
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await expect.element(tester.rows).toHaveLength(8);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('South 1 (Folder scanner) [item1]');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('my transformer 1');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('OIBus API (dataSourceId: dataSourceId1)');
    await expect.element(tester.cell(2, 0)).toHaveTextContent('South 2 (Microsoft SQL Server™) [All items]');
    await expect.element(tester.cell(3, 0)).toHaveTextContent('South 1 (Folder scanner) [Group: Group 1]');
    await expect.element(tester.cell(4, 0)).toHaveTextContent('South 1 (Folder scanner) [7 items]');
    await expect.element(tester.cell(4, 1)).toHaveTextContent('File (as is)');
    await expect.element(tester.cell(5, 0)).toHaveTextContent('OIAnalytics setpoints');
    await expect.element(tester.cell(6, 0)).toHaveTextContent('OIBus API (all data sources)');
    await expect.element(tester.cell(7, 0)).toHaveTextContent('South 1 (Folder scanner) [All items, except 2 items]');

    await tester.cell(4, 0).getByText('7 items').hover();
    await expect.element(page.getByCss('.items-tooltip')).toHaveTextContent('item0 item1 item2 item3 item4 ... (2 more)');
  });

  test('should not display the audit history button when transformers are edited in memory', async () => {
    const tester = new NorthTransformersComponentTester(northConnector, false);

    await expect.element(tester.editButton(0)).toBeInTheDocument();
    await expect.element(tester.root.getByRole('button', { name: 'View transformer audit history' })).not.toBeInTheDocument();
  });

  test('should open the audit history of a saved transformer', async () => {
    const fakeModal = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModal);
    const tester = new NorthTransformersComponentTester(northConnector, true);

    await tester.row(1).getByRole('button', { name: 'View transformer audit history' }).click();

    expect(fakeModal.prepare).toHaveBeenCalledWith('north_transformer', 'northTransformerId2');
  });

  describe('data without transformer', () => {
    test('should not list the souths whose data no transformer can send to the north', async () => {
      const tester = new NorthTransformersComponentTester({ ...northConnector, transformers: [] }, true);
      tester.fixture.componentRef.setInput('transformers', []);

      await expect.element(tester.none).toBeInTheDocument();
      await expect.element(tester.uncovered).not.toBeInTheDocument();
    });

    test('should list the souths without transformer, and add one for them', async () => {
      const editModal = createFakeEditModal();
      modalService.mockClosedModal(editModal, {
        ...newTransformer,
        source: { type: 'south', south: testData.south.listLight[1], items: [] }
      });
      const tester = new NorthTransformersComponentTester({ ...northConnector, transformers: [] }, false);

      // South 1 sends files, which no transformer given to the component can take
      await expect.element(tester.uncovered).toMatchTextContent('2 source(s) send data this North connector drops');
      await expect.element(tester.uncoveredSouths).not.toBeInTheDocument();
      await tester.uncovered.getByRole('button', { name: 'Show' }).click();
      await expect.element(tester.uncoveredSouths).toHaveLength(2);
      await expect
        .element(tester.uncoveredSouths.nth(0))
        .toMatchTextContent('South 2 (Microsoft SQL Server™): no transformer, all its data is dropped');
      await tester.uncoveredSouths.nth(0).getByRole('button', { name: 'Add a transformer' }).click();

      expect(editModal.prepareForCreation).toHaveBeenCalledWith(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [testData.north.list[0].transformers[0].transformer],
        testData.north.manifest.types,
        testData.south.listLight[1]
      );
      await expect.element(tester.uncovered).toMatchTextContent('1 source(s) send data');
      await tester.root.getByRole('button', { name: 'Hide' }).click();
      await expect.element(tester.uncoveredSouths).not.toBeInTheDocument();
    });

    test('should show the routing of a south some items of which are dropped, and send them', async () => {
      northConnector.transformers = [
        { ...northConnector.transformers[0], source: { type: 'south', south: testData.south.listLight[1], items: [buildItem(1)] } }
      ];
      const routingModal = createMock(TransformerRoutingModalComponent);
      const editModal = createFakeEditModal();
      vi.spyOn(modalService, 'open').mockImplementation(((component: unknown) =>
        component === TransformerRoutingModalComponent
          ? fakeModal(routingModal, Promise.resolve(testData.south.listLight[1]))
          : fakeModal(editModal)) as typeof modalService.open);
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.uncovered.getByRole('button', { name: 'Show' }).click();
      await expect
        .element(tester.uncoveredSouths.nth(0))
        .toMatchTextContent('South 2 (Microsoft SQL Server™): only some of its items have a transformer, the others are dropped');
      await tester.uncoveredSouths.nth(0).getByRole('button', { name: 'View routing' }).click();

      expect(routingModal.prepare).toHaveBeenCalledWith(testData.south.listLight, northConnector.transformers, testData.south.listLight[1]);
      await vi.waitFor(() => expect(editModal.prepareForCreation).toHaveBeenCalled());
      expect(editModal.prepareForCreation.mock.calls[0][5]).toEqual(testData.south.listLight[1]);
    });

    test('should show the routing of every south', async () => {
      const routingModal = createMock(TransformerRoutingModalComponent);
      modalService.mockDismissedModal(routingModal);
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.root.getByRole('button', { name: 'View routing' }).click();

      expect(routingModal.prepare).toHaveBeenCalledWith(testData.south.listLight, northConnector.transformers, null);
    });
  });

  describe('in memory', () => {
    test('should add a transformer', async () => {
      const fakeModal = createFakeEditModal();
      modalService.mockClosedModal(fakeModal, newTransformer);
      const tester = new NorthTransformersComponentTester(null, false);

      await tester.addButton.click();

      expect(fakeModal.directSave()).toBe(false);
      expect(fakeModal.prepareForCreation).toHaveBeenCalledWith(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [testData.north.list[0].transformers[0].transformer],
        testData.north.manifest.types,
        null
      );
      await expect.element(tester.rows).toHaveLength(1);
      await expect.element(tester.cell(0, 0)).toHaveTextContent('OIAnalytics setpoints');
      expect(tester.emitted).toEqual([[newTransformer]]);
      expect(northConnectorService.addOrEditTransformer).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
    });

    test('should edit a transformer', async () => {
      const editedTransformer: TransformerDTOWithOptions = { ...northConnector.transformers[1], options: { field: 'value' } };
      const fakeModal = createFakeEditModal();
      modalService.mockClosedModal(fakeModal, editedTransformer);
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.editButton(1).click();

      expect(fakeModal.prepareForEdition).toHaveBeenCalledWith(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [testData.north.list[0].transformers[0].transformer],
        testData.north.manifest.types,
        northConnector.transformers[1]
      );
      // the edited transformer is moved at the end of the list
      await expect.element(tester.cell(2, 0)).toHaveTextContent('OIBus API (dataSourceId: dataSourceId1)');
      expect(tester.emitted).toEqual([[northConnector.transformers[0], northConnector.transformers[2], editedTransformer]]);
      expect(northConnectorService.addOrEditTransformer).not.toHaveBeenCalled();
    });

    test('should not change anything when the edition is cancelled', async () => {
      modalService.mockDismissedModal(createFakeEditModal());
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.editButton(0).click();

      await expect.element(tester.rows).toHaveLength(3);
      expect(tester.emitted).toEqual([]);
    });

    test('should delete a transformer', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.deleteButton(0).click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'north.transformers.confirm-deletion' });
      await expect.element(tester.rows).toHaveLength(2);
      expect(tester.emitted).toEqual([[northConnector.transformers[1], northConnector.transformers[2]]]);
      expect(northConnectorService.removeTransformer).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
    });

    test('should not delete a transformer without confirmation', async () => {
      confirmationService.confirm.mockReturnValue(of());
      const tester = new NorthTransformersComponentTester(northConnector, false);

      await tester.deleteButton(0).click();

      await expect.element(tester.rows).toHaveLength(3);
      expect(tester.emitted).toEqual([]);
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

      await tester.editButton(1).click();

      expect(northConnectorService.addOrEditTransformer).toHaveBeenCalledWith('northId1', editedTransformer);
      expect(notificationService.success).toHaveBeenCalledWith('north.transformers.edited');
      expect(tester.emitted).toHaveLength(1);
    });

    test('should delete a transformer', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, true);

      await tester.deleteButton(1).click();

      expect(northConnectorService.removeTransformer).toHaveBeenCalledWith('northId1', 'northTransformerId2');
      expect(notificationService.success).toHaveBeenCalledWith('north.transformers.removed');
      await expect.element(tester.rows).toHaveLength(2);
      expect(tester.emitted).toEqual([[northConnector.transformers[0], northConnector.transformers[2]]]);
    });

    test('should reset the list when the connector changes', async () => {
      const tester = new NorthTransformersComponentTester(northConnector, true);
      await expect.element(tester.rows).toHaveLength(3);

      tester.fixture.componentRef.setInput('northConnector', { ...northConnector, transformers: [northConnector.transformers[0]] });

      await expect.element(tester.rows).toHaveLength(1);
    });
  });
});
