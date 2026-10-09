import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ItemLightDTO, SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';
import { StandardTransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { toPage } from '../../../shared/utils/page.utils';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal.component';

const timeValuesToMqtt: StandardTransformerDTO = {
  id: 'time-values-to-mqtt',
  type: 'standard',
  functionName: 'time-values-to-mqtt',
  inputType: 'time-values',
  outputType: 'mqtt',
  manifest: {
    type: 'object',
    key: 'options',
    translationKey: '',
    attributes: [
      {
        type: 'string',
        key: 'topic',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.point-id',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
};

const anyToMqtt: StandardTransformerDTO = {
  ...timeValuesToMqtt,
  id: 'any-to-mqtt',
  functionName: 'ignore',
  inputType: 'any',
  manifest: { ...timeValuesToMqtt.manifest, attributes: [] }
};

const setpointToMqtt: StandardTransformerDTO = {
  ...anyToMqtt,
  id: 'setpoint-to-mqtt',
  functionName: 'setpoint-to-mqtt',
  inputType: 'setpoint'
};

const items: Array<SouthConnectorItemDTO> = testData.south.list[0].items;

function toItemLight(item: SouthConnectorItemDTO): ItemLightDTO {
  return {
    id: item.id,
    name: item.name,
    enabled: item.enabled,
    createdBy: item.createdBy,
    updatedBy: item.updatedBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

class EditNorthTransformerModalComponentTester {
  readonly fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly source = this.root.getByLabelText('Source', { exact: true });
  readonly apiDataSource = this.root.getByLabelText('API data source');
  readonly output = this.root.getByLabelText('Output', { exact: true });
  readonly topic = this.root.getByRole('textbox', { name: /Point ID/ });
  readonly modeNew = this.root.getByLabelText('New', { exact: true });
  readonly modeFromNorth = this.root.getByLabelText('From a North connector');
  readonly allItems = this.root.getByLabelText('All items');
  readonly byGroup = this.root.getByLabelText('By group');
  readonly specificItems = this.root.getByLabelText('Specific items');
  readonly group = this.root.getByCss('#group');
  readonly itemSearch = this.root.getByLabelText('Search items...');
  readonly pills = this.root.getByCss('oib-pill');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly testPanel = this.root.getByCss('oib-north-transformer-test');

  prepareForCreation(supportedOutputTypes: Array<string> = ['mqtt']) {
    this.component.prepareForCreation(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [timeValuesToMqtt, anyToMqtt, setpointToMqtt],
      supportedOutputTypes
    );
  }

  prepareForEdition(transformer: TransformerDTOWithOptions) {
    this.component.prepareForEdition(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [timeValuesToMqtt, anyToMqtt, setpointToMqtt],
      ['mqtt'],
      transformer
    );
  }

  dropdownItem(name: string) {
    return this.root.getByRole('button', { name, exact: true });
  }
}

describe('EditNorthTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    southConnectorService.getGroups.mockReturnValue(of([buildSouthItemGroup('groupId1', 'Group 1')]));
    southConnectorService.searchItems.mockReturnValue(of(toPage(items)));

    // Services used by the "copy from existing" picker (rendered once the user leaves the 'new' creation mode).
    northConnectorService = createMock(NorthConnectorService);
    const historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.findById.mockReturnValue(of(testData.north.list[0]));
    historyQueryService.list.mockReturnValue(of([]));

    // Services used by the embedded transformer-test panel (rendered once a transformer is selected).
    const transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));

    const engineService = createMock(EngineService, { info$: of(testData.engine.oIBusInfo) });
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(false));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: TransformerService, useValue: transformerService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  test('should cancel', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should display OK instead of Save when the changes are not saved directly', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.component.directSave.set(false);
    tester.prepareForCreation();

    await expect.element(tester.okButton).toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeInTheDocument();
  });

  test('should not save in create mode when form is invalid', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.saveButton.click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should create a transformer with an OIBus API source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('OIBus API data source');
    await tester.apiDataSource.fill('my-source');
    // only the transformers accepting any content are proposed
    await expect.element(tester.output.getByRole('option')).toHaveLength(2);
    await tester.output.selectOptions('Ignore');
    await expect.element(tester.testPanel).toBeInTheDocument();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      id: expect.stringMatching(/^temp_/),
      source: { type: 'oibus-api', dataSourceId: 'my-source' },
      transformer: anyToMqtt,
      options: {}
    });
  });

  test('should create a transformer with an OIAnalytics setpoint source and options', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('OIAnalytics setpoints');
    await expect.element(tester.output.getByRole('option')).toHaveLength(3);
    await tester.output.selectOptions('Ignore');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: { type: 'oianalytics-setpoint' }, transformer: anyToMqtt })
    );
  });

  test('should validate the transformer options', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    // without source, every transformer is proposed
    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.source.selectOptions('');
    await expect.element(tester.output.getByRole('option')).toHaveLength(4);
    await tester.output.selectOptions(tester.output.getByRole('option').nth(1));

    await tester.saveButton.click();
    expect(activeModal.close).not.toHaveBeenCalled();

    await tester.topic.fill('my/topic');
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ transformer: timeValuesToMqtt, options: { topic: 'my/topic' } })
    );
  });

  test('should create a transformer for all the items of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await expect.element(tester.allItems).toBeChecked();
    await tester.output.selectOptions('Ignore');
    await tester.saveButton.click();

    expect(southConnectorService.getGroups).toHaveBeenCalledWith('southId1');
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [] } })
    );
  });

  test('should create a transformer for a group of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.byGroup.click();
    await tester.group.selectOptions('Group 1');
    await tester.output.selectOptions('Ignore');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'south', south: testData.south.listLight[0], group: { id: 'groupId1', name: 'Group 1' }, items: [] }
      })
    );
  });

  test('should create a transformer for specific items of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.specificItems.click();
    await tester.itemSearch.click();
    await tester.dropdownItem('item2').click();
    await expect.element(tester.pills).toHaveLength(1);
    await tester.root.getByRole('button', { name: 'Select all results' }).click();
    await expect.element(tester.pills).toHaveLength(2);
    await tester.pills.nth(1).getByRole('button').click();
    await expect.element(tester.pills).toHaveLength(1);
    await tester.output.selectOptions('Ignore');
    await tester.saveButton.click();

    expect(southConnectorService.searchItems).toHaveBeenCalledWith('southId1', { name: '', page: 0 });
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [toItemLight(items[1])] }
      })
    );
  });

  test('should search items', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.specificItems.click();
    southConnectorService.searchItems.mockReturnValue(of(toPage([items[0]])));

    await tester.itemSearch.fill('item1');

    expect(southConnectorService.searchItems).toHaveBeenLastCalledWith('southId1', { name: 'item1', page: 0 });
    await expect.element(tester.dropdownItem('item1')).toBeInTheDocument();
    await expect.element(tester.dropdownItem('item2')).not.toBeInTheDocument();
    await expect.element(tester.root.getByText('1 results')).toBeInTheDocument();
  });

  test('should edit a transformer with an OIBus API source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition({
      id: 'northTransformerId1',
      transformer: timeValuesToMqtt,
      options: { topic: 'my/topic' },
      source: { type: 'oibus-api', dataSourceId: 'dataSourceId' }
    });

    await expect.element(tester.root.getByText('Source: OIBus API data source')).toBeInTheDocument();
    await expect.element(tester.source).not.toBeInTheDocument();
    await expect.element(tester.topic).toHaveValue('my/topic');
    await tester.apiDataSource.fill('other-source');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      id: 'northTransformerId1',
      source: { type: 'oibus-api', dataSourceId: 'other-source' },
      transformer: timeValuesToMqtt,
      options: { topic: 'my/topic' }
    });
  });

  test('should edit the items of a transformer without changing the edited transformer', async () => {
    const transformer: TransformerDTOWithOptions = {
      id: 'northTransformerId1',
      transformer: anyToMqtt,
      options: {},
      source: { type: 'south', south: testData.south.listLight[0], items: items.map(toItemLight) }
    };
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition(transformer);

    await expect.element(tester.root.getByText('Source: South 1 (Folder scanner)')).toBeInTheDocument();
    await expect.element(tester.specificItems).toBeChecked();
    await expect.element(tester.pills).toHaveLength(2);
    await tester.pills.nth(0).getByRole('button').click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'northTransformerId1',
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [toItemLight(items[1])] }
      })
    );
    // the selection works on a copy of the edited transformer items
    expect(transformer.source.type === 'south' && transformer.source.items).toHaveLength(2);
  });

  test('should edit a transformer with a group and a disabled south', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition({
      id: 'northTransformerId1',
      transformer: anyToMqtt,
      options: {},
      source: { type: 'south', south: testData.south.listLight[1], group: { id: 'groupId1', name: 'Group 1' }, items: [] }
    });

    await expect.element(tester.root.getByText(/^Source: South 2 .* - paused$/)).toBeInTheDocument();
    await expect.element(tester.byGroup).toBeChecked();
    await expect.element(tester.group).toHaveDisplayValue('Group 1');

    await tester.allItems.click();
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.objectContaining({ group: undefined, items: [] }) })
    );
  });

  test('should wipe the selected transformer when the source changes in the new creation mode', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.output.selectOptions('Ignore');

    await tester.source.selectOptions('OIBus API data source');

    await expect.element(tester.output).toHaveDisplayValue('');
    await expect.element(tester.testPanel).not.toBeInTheDocument();
  });

  test('should copy the transformer and its options from an existing attachment, and keep it when the source changes', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation(['any']);
    await expect.element(tester.modeNew).toBeChecked();

    await tester.modeFromNorth.click();
    await tester.root.getByLabelText('Select a source').selectOptions('North 1');
    await tester.root.getByLabelText('Transformer to copy').selectOptions('my transformer 2');
    await expect.element(tester.output).not.toBeInTheDocument();
    await expect.element(tester.testPanel).toBeInTheDocument();

    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'oianalytics-setpoint' },
        transformer: testData.north.list[0].transformers[1].transformer,
        options: {}
      })
    );
  });

  test('should reset the copied transformer when switching back to the new creation mode', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation(['any']);
    await tester.modeFromNorth.click();
    await tester.root.getByLabelText('Select a source').selectOptions('North 1');
    await tester.root.getByLabelText('Transformer to copy').selectOptions('my transformer 2');
    await expect.element(tester.testPanel).toBeInTheDocument();

    await tester.modeNew.click();

    await expect.element(tester.output).toHaveDisplayValue('');
    await expect.element(tester.testPanel).not.toBeInTheDocument();
  });

  test('should ask for confirmation before dismissing a modified form', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    expect(tester.component.canDismiss()).toBe(true);

    await tester.source.selectOptions('OIAnalytics setpoints');

    const result = tester.component.canDismiss();
    expect(isObservable(result) && (await firstValueFrom(result))).toBe(false);
    expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
  });
});
