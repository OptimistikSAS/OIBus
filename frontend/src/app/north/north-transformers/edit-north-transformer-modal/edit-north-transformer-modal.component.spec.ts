import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ItemLightDTO, SouthConnectorItemDTO } from '@oibus/shared/api/south-connector.model';
import { SourceOriginSouthDTO, StandardTransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

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
import { EditNorthTransformerModalComponent, TransformerSourcePreset } from './edit-north-transformer-modal.component';

const recordListToMqtt: StandardTransformerDTO = {
  id: 'record-list-to-mqtt',
  type: 'standard',
  functionName: 'record-list-to-mqtt',
  inputType: 'record-list',
  outputType: 'mqtt',
  manifest: {
    type: 'object',
    key: 'options',
    translationKey: '',
    attributes: [
      {
        type: 'string',
        key: 'topic',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.point-id',
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
  ...recordListToMqtt,
  id: 'any-to-mqtt',
  functionName: 'file-to-mqtt',
  inputType: 'file',
  manifest: { ...recordListToMqtt.manifest, attributes: [] }
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
  readonly modeNew = this.root.getByRole('button', { name: 'New', exact: true });
  readonly modeFromNorth = this.root.getByRole('button', { name: 'From a North connector' });
  readonly allItems = this.root.getByRole('button', { name: 'All items' });
  readonly byGroup = this.root.getByRole('button', { name: 'By group' });
  readonly specificItems = this.root.getByRole('button', { name: 'Specific items' });
  readonly sourceLine = this.root.getByCss('#transformer-source');
  readonly impact = this.root.getByCss('#transformer-impact');
  readonly group = this.root.getByCss('#group');
  readonly itemSearch = this.root.getByLabelText('Search items...');
  readonly selectionCount = this.root.getByCss('.selection-count');
  readonly excludeItems = this.root.getByLabelText('Except some items');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly nextButton = this.root.getByRole('button', { name: 'Next' });
  readonly sourceStep = this.root.getByCss('#modal-step-source');
  readonly optionsStep = this.root.getByCss('#modal-step-options');
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly testPanel = this.root.getByCss('oib-north-transformer-test');

  prepareForCreation(supportedOutputTypes: Array<string> = ['mqtt']) {
    this.component.prepareForCreation(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [recordListToMqtt, anyToMqtt],
      supportedOutputTypes
    );
  }

  prepareForEdition(transformer: TransformerDTOWithOptions) {
    this.component.prepareForEdition(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [recordListToMqtt, anyToMqtt],
      ['mqtt'],
      transformer
    );
  }

  item(name: string) {
    return this.root.getByRole('checkbox', { name, exact: true });
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
    southConnectorService.findById.mockImplementation(southId =>
      of({ ...testData.south.list.find(south => south.id === southId)!, groups: [buildSouthItemGroup('groupId1', 'Group 1')] })
    );

    // Services used by the "copy from existing" picker (rendered once the user leaves the 'new' creation mode).
    northConnectorService = createMock(NorthConnectorService);
    const historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.findById.mockReturnValue(of(testData.north.list[0]));
    historyQueryService.list.mockReturnValue(of([]));

    // Services used by the embedded transformer-test panel (rendered once a transformer is selected).
    const transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'record-list', data: '[]', description: '' }));
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));

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
    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.nextButton.click();

    await expect.element(tester.okButton).toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeInTheDocument();
  });

  test('should only open the next step once the source and the transformer are chosen', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    // a new transformer is saved once its source and the transformer are chosen
    await expect.element(tester.saveButton).not.toBeInTheDocument();

    await tester.nextButton.click();

    await expect.element(tester.sourceStep).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.sourceStep).toHaveClass('modal-step-invalid');
    expect(activeModal.close).not.toHaveBeenCalled();

    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.nextButton.click();
    await expect.element(tester.optionsStep).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.topic).toBeVisible();
    // the options are tried out right away
    await expect.element(tester.testPanel).toBeVisible();
    await tester.topic.fill('my/topic');
    await tester.nextButton.click();
    await expect.element(tester.root.getByCss('#source-summary')).toMatchTextContent('OIAnalytics setpoints');
    await expect.element(tester.root.getByCss('#source-summary')).toMatchTextContent('MQTT payloads');
    await expect.element(tester.testPanel).not.toBeVisible();
    await expect.element(tester.nextButton).not.toBeInTheDocument();
    await tester.root.getByRole('button', { name: 'Back' }).click();
    await expect.element(tester.optionsStep).toHaveAttribute('aria-current', 'step');
  });

  test('should create a transformer with an OIBus API source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('OIBus API data source');
    await tester.apiDataSource.fill('my-source');
    // only the transformers accepting any content are proposed
    await expect.element(tester.output.getByRole('option')).toHaveLength(2);
    await tester.output.selectOptions('MQTT payloads');
    await expect.element(tester.testPanel).toBeInTheDocument();
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      id: expect.stringMatching(/^temp_/),
      source: { type: 'oibus-api', dataSourceId: 'my-source' },
      transformer: anyToMqtt,
      options: {}
    });
  });

  test('should create a transformer applying to every OIBus API data source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('OIBus API data source');
    await expect.element(tester.apiDataSource).toHaveAttribute('placeholder', 'All data sources');
    await tester.output.selectOptions('MQTT payloads');
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ source: { type: 'oibus-api', dataSourceId: undefined } }));
  });

  test('should edit a transformer applying to every OIBus API data source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition({ id: 'northTransformerId1', transformer: anyToMqtt, options: {}, source: { type: 'oibus-api' } });

    await expect.element(tester.apiDataSource).toHaveValue('');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ source: { type: 'oibus-api', dataSourceId: undefined } }));
  });

  test('should create a transformer with an OIAnalytics setpoint source and options', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('OIAnalytics setpoints');
    // the setpoints are records
    await expect.element(tester.output.getByRole('option')).toHaveLength(2);
    await tester.output.selectOptions('MQTT payloads');
    await tester.nextButton.click();
    await tester.topic.fill('my/topic');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: { type: 'oianalytics-setpoint' }, transformer: recordListToMqtt, options: { topic: 'my/topic' } })
    );
  });

  test('should validate the transformer options', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    // without source, every transformer is proposed
    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.source.selectOptions('');
    await expect.element(tester.output.getByRole('option')).toHaveLength(3);
    await tester.output.selectOptions(tester.output.getByRole('option').nth(1));
    await tester.nextButton.click();

    await tester.saveButton.click();
    expect(activeModal.close).not.toHaveBeenCalled();
    await expect.element(tester.optionsStep).toHaveClass('modal-step-invalid');

    await tester.topic.fill('my/topic');
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ transformer: recordListToMqtt, options: { topic: 'my/topic' } })
    );
  });

  test('should create a transformer for all the items of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await expect.element(tester.allItems).toHaveAttribute('aria-pressed', 'true');
    await tester.output.selectOptions('MQTT payloads');
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(southConnectorService.findById).toHaveBeenCalledWith('southId1');
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [], excludedItems: [] }
      })
    );
  });

  test('should create a transformer for a group of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.byGroup.click();
    await tester.group.selectOptions('Group 1');
    await tester.output.selectOptions('MQTT payloads');
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          type: 'south',
          south: testData.south.listLight[0],
          group: { id: 'groupId1', name: 'Group 1' },
          items: [],
          excludedItems: []
        }
      })
    );
  });

  test('should create a transformer for specific items of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();

    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.specificItems.click();
    await tester.item('item2').click();
    await expect.element(tester.selectionCount).toHaveTextContent('1 of 2 items selected');
    await tester.output.selectOptions('MQTT payloads');
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [toItemLight(items[1])], excludedItems: [] }
      })
    );
  });

  test('should search and filter the items as the south items list', async () => {
    const group = buildSouthItemGroup('groupId1', 'Group 1');
    const south = testData.south.list[0];
    if (south.type !== 'folder-scanner') throw new Error('Expected a folder scanner in the test data');
    const [item1, item2] = south.items;
    southConnectorService.findById.mockReturnValue(
      of({
        ...south,
        groups: [group],
        items: [
          { ...item1, group },
          { ...item2, enabled: false }
        ]
      })
    );
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    await tester.source.selectOptions('South 1 (Folder scanner)');
    await tester.specificItems.click();

    await tester.itemSearch.fill('item1');
    await expect.element(tester.item('item1')).toBeInTheDocument();
    await expect.element(tester.item('item2')).not.toBeInTheDocument();
    await tester.itemSearch.fill('');

    await tester.root.getByLabelText('Status').selectOptions('Disabled');
    await expect.element(tester.item('item1')).not.toBeInTheDocument();
    await expect.element(tester.item('item2')).toBeInTheDocument();
    await tester.root.getByLabelText('Status').selectOptions('All statuses');

    await tester.root.getByLabelText('Group').selectOptions('Group 1');
    await expect.element(tester.item('item1')).toBeInTheDocument();
    await expect.element(tester.item('item2')).not.toBeInTheDocument();
    await tester.root.getByLabelText('Group').selectOptions('None');
    await expect.element(tester.item('item1')).not.toBeInTheDocument();

    await tester.root.getByLabelText('Group').selectOptions('All groups');
    await tester.root.getByLabelText('Schedule').selectOptions(testData.scanMode.list[1].name);
    await expect.element(tester.item('item1')).not.toBeInTheDocument();
  });

  test('should edit a transformer with an OIBus API source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition({
      id: 'northTransformerId1',
      transformer: recordListToMqtt,
      options: { topic: 'my/topic' },
      source: { type: 'oibus-api', dataSourceId: 'dataSourceId' }
    });

    await expect.element(tester.sourceLine).toHaveTextContent('OIBus API data source');
    await expect.element(tester.source).not.toBeInTheDocument();
    await tester.apiDataSource.fill('other-source');
    // an edited transformer is saved from any step
    await expect.element(tester.saveButton).toBeVisible();
    await tester.optionsStep.click();
    await expect.element(tester.topic).toHaveValue('my/topic');
    await tester.topic.fill('other/topic');
    // the review tells what changed since the transformer was saved
    await tester.root.getByCss('#modal-step-review').click();
    await expect.element(tester.root.getByCss('#review-changes')).toHaveTextContent('Settings changed since the transformer was saved: 2');
    await expect.element(tester.root.getByCss('#options-summary')).toMatchTextContent('other/topic');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      id: 'northTransformerId1',
      source: { type: 'oibus-api', dataSourceId: 'other-source' },
      transformer: recordListToMqtt,
      options: { topic: 'other/topic' }
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

    await expect.element(tester.sourceLine).toHaveTextContent('South 1Folder scanner');
    await expect.element(tester.specificItems).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.selectionCount).toHaveTextContent('2 of 2 items selected');
    await tester.item('item1').click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'northTransformerId1',
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [toItemLight(items[1])], excludedItems: [] }
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

    await expect.element(tester.sourceLine).toMatchTextContent(/South 2.*paused/);
    await expect.element(tester.byGroup).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.group).toHaveDisplayValue('Group 1');

    await tester.allItems.click();
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.objectContaining({ group: undefined, items: [] }) })
    );
  });

  test('should propose the obvious transformer of the source when it changes in the new creation mode', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    await tester.source.selectOptions('OIAnalytics setpoints');
    // the only transformer producing MQTT payloads from records, as the setpoints are
    await expect.element(tester.output).toHaveDisplayValue(/^\s*MQTT payloads\s*$/);

    await tester.source.selectOptions('OIBus API data source');
    await expect.element(tester.output).toHaveDisplayValue(/MQTT payloads/);

    await tester.source.selectOptions('');
    await expect.element(tester.output).toHaveDisplayValue('');
    await expect.element(tester.testPanel).not.toBeInTheDocument();
  });

  test('should preselect the south the transformer is created for', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.component.prepareForCreation(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [recordListToMqtt, anyToMqtt],
      ['mqtt'],
      { dataSourceType: 'south', south: testData.south.listLight[0] }
    );

    // the source is shown, not chosen
    await expect.element(tester.sourceLine).toHaveTextContent('South 1Folder scanner');
    await expect.element(tester.source).not.toBeInTheDocument();
    await expect.element(tester.output).toHaveDisplayValue(/MQTT payloads/);
    await expect.element(tester.allItems).toHaveAttribute('aria-pressed', 'true');
  });

  test('should preselect the group or the items the transformer is created for', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    const prepare = (preset: Partial<TransformerSourcePreset>) =>
      tester.component.prepareForCreation(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [recordListToMqtt, anyToMqtt],
        ['mqtt'],
        { dataSourceType: 'south', south: testData.south.listLight[0], ...preset }
      );

    prepare({ items: [toItemLight(items[1])] });
    await expect.element(tester.specificItems).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.item('item2')).toBeChecked();
    await tester.nextButton.click();
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.objectContaining({ items: [toItemLight(items[1])], excludedItems: [] }) })
    );

    prepare({ group: { id: 'groupId1', name: 'Group 1' } });
    await tester.sourceStep.click();
    await expect.element(tester.byGroup).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.group).toHaveDisplayValue('Group 1');
  });

  test('should preselect the OIBus API source', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.component.prepareForCreation(
      testData.south.listLight,
      testData.scanMode.list,
      testData.certificates.list,
      [recordListToMqtt, anyToMqtt],
      ['mqtt'],
      { dataSourceType: 'oibus-api' }
    );

    await expect.element(tester.apiDataSource).toBeVisible();
  });

  test('should leave some items out of a transformer applying to all the items of a south connector', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation();
    await tester.source.selectOptions('South 1 (Folder scanner)');

    await tester.excludeItems.click();
    await tester.item('item2').click();
    await expect.element(tester.selectionCount).toHaveTextContent('1 of 2 items left out');
    await tester.nextButton.click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: 'south', south: testData.south.listLight[0], group: undefined, items: [], excludedItems: [toItemLight(items[1])] }
      })
    );
  });

  test('should edit the items left out of a transformer applying to a group', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForEdition({
      id: 'northTransformerId1',
      transformer: anyToMqtt,
      options: {},
      source: {
        type: 'south',
        south: testData.south.listLight[0],
        group: { id: 'groupId1', name: 'Group 1' },
        items: [],
        excludedItems: items.map(toItemLight)
      }
    });

    await expect.element(tester.excludeItems).toBeChecked();
    await expect.element(tester.selectionCount).toHaveTextContent('2 of 2 items left out');
    await tester.item('item1').click();
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({ group: { id: 'groupId1', name: 'Group 1' }, excludedItems: [toItemLight(items[1])] })
      })
    );

    await tester.excludeItems.click();
    await expect.element(tester.itemSearch).not.toBeInTheDocument();
    await tester.specificItems.click();
    await expect.element(tester.selectionCount).toHaveTextContent('0 of 2 items selected');
    await expect.element(tester.excludeItems).not.toBeInTheDocument();
  });

  test('should copy the transformer and its options from an existing attachment, and keep it when the source changes', async () => {
    const tester = new EditNorthTransformerModalComponentTester();
    tester.prepareForCreation(['file']);
    await expect.element(tester.modeNew).toHaveAttribute('aria-pressed', 'true');

    await tester.modeFromNorth.click();
    await tester.root.getByLabelText('Select a source').selectOptions('North 1');
    await tester.root.getByLabelText('Transformer to copy').selectOptions('my transformer 2');
    await expect.element(tester.output).not.toBeInTheDocument();
    await expect.element(tester.testPanel).toBeInTheDocument();

    await tester.source.selectOptions('OIAnalytics setpoints');
    await tester.nextButton.click();
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
    tester.prepareForCreation(['file']);
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

  describe('what the transformer would send', () => {
    const south = testData.south.listLight[0];
    const southLink = (id: string, source: Partial<SourceOriginSouthDTO>): TransformerDTOWithOptions => ({
      id,
      transformer: anyToMqtt,
      options: {},
      source: { type: 'south', south, items: [], ...source }
    });
    const prepare = (tester: EditNorthTransformerModalComponentTester, existing: Array<TransformerDTOWithOptions>) => {
      tester.component.existingTransformers.set(existing);
      tester.component.prepareForCreation(
        testData.south.listLight,
        testData.scanMode.list,
        testData.certificates.list,
        [recordListToMqtt, anyToMqtt],
        ['mqtt'],
        { dataSourceType: 'south', south }
      );
    };

    test('should tell the items it would send, currently dropped', async () => {
      const tester = new EditNorthTransformerModalComponentTester();
      prepare(tester, []);

      await expect.element(tester.impact).toMatchTextContent('2 item(s) sent through this transformer');
      await expect.element(tester.impact).toMatchTextContent('2 currently dropped');
    });

    test('should tell the items keeping a transformer applying first', async () => {
      const tester = new EditNorthTransformerModalComponentTester();
      prepare(tester, [southLink('itemLevel', { items: [toItemLight(items[0])] })]);

      await expect.element(tester.impact).toMatchTextContent('1 item(s) sent through this transformer');
      await expect.element(tester.impact).toMatchTextContent('1 of the selected items keep a transformer applying first');
    });

    test('should tell the items it would take over from another transformer', async () => {
      const tester = new EditNorthTransformerModalComponentTester();
      prepare(tester, [southLink('southLevel', {})]);

      await tester.specificItems.click();
      // no item selected yet: nothing to tell
      await expect.element(tester.impact).not.toBeInTheDocument();
      await tester.item('item1').click();

      await expect.element(tester.impact).toMatchTextContent('1 item(s) sent through this transformer');
      await expect.element(tester.impact).toMatchTextContent('1 currently sent through another transformer');
    });

    test('should warn when it would send nothing', async () => {
      const tester = new EditNorthTransformerModalComponentTester();
      prepare(tester, [southLink('southLevel', {}), southLink('southLevelAgain', {})]);

      await expect.element(tester.impact).toMatchTextContent('No item would go through this transformer');
    });

    test('should not save a transformer for specific items without any', async () => {
      const tester = new EditNorthTransformerModalComponentTester();
      prepare(tester, []);
      await tester.specificItems.click();

      await tester.nextButton.click();

      await expect.element(tester.root.getByText('Select at least one item')).toBeVisible();
      await expect.element(tester.sourceStep).toHaveAttribute('aria-current', 'step');
      expect(activeModal.close).not.toHaveBeenCalled();
      await tester.allItems.click();
      await expect.element(tester.root.getByText('Select at least one item')).not.toBeInTheDocument();
    });
  });
});
