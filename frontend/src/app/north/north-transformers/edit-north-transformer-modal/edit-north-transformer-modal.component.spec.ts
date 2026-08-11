import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';

const transformer: TransformerDTO = {
  id: 'time-values-to-mqtt',
  type: 'standard',
  functionName: 'time-values-to-mqtt',
  inputType: 'time-values',
  outputType: 'mqtt',
  manifest: {
    type: 'object',
    key: 'configuration.oibus.manifest.transformers.options',
    translationKey: '',
    attributes: [
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: '',
          displayProperties: { visible: true, wrapInBox: false },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'pointId',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.point-id',
              defaultValue: null,
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            {
              type: 'string',
              key: 'address',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.address',
              defaultValue: null,
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            {
              type: 'string-select',
              key: 'modbusType',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.modbus-type',
              defaultValue: 'register',
              selectableValues: ['coil', 'register'],
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            }
          ]
        }
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
} as unknown as TransformerDTO;

describe('EditNorthTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    southConnectorService.getGroups.mockReturnValue(of([]));

    // Services used by the "copy from existing" picker (rendered once the user leaves the 'new' creation mode).
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of([]));
    historyQueryService.list.mockReturnValue(of([]));

    // Services used by the embedded transformer-test panel (rendered once a transformer is selected).
    const transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: TransformerService, useValue: transformerService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should not save in create mode when form is invalid', async () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], []);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('#save-button').click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should save in edit mode with oibus-api source', async () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForEdition([] as Array<SouthConnectorLightDTO>, [], [], [transformer], ['mqtt'], {
      id: 'northTransformerId1',
      transformer,
      options: {
        mapping: [
          { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
          { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
        ]
      },
      source: {
        type: 'oibus-api',
        dataSourceId: 'dataSourceId'
      }
    } as any);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('#save-button').click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'northTransformerId1',
        source: expect.objectContaining({ type: 'oibus-api', dataSourceId: 'dataSourceId' })
      })
    );
  });

  test('defaults to the new creation mode', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], ['mqtt']);
    fixture.detectChanges();

    expect(fixture.componentInstance.creationMode).toBe('new');
  });

  test('copies the transformer and its options from an existing attachment', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], ['mqtt']);
    fixture.detectChanges();

    fixture.componentInstance.setCreationMode('from-north');
    fixture.detectChanges();

    const copiedOptions = { mapping: [{ pointId: 'copiedPointId', address: 'copiedAddress', modbusType: 'coil' }] };
    fixture.componentInstance.applyExistingTransformer({ transformer, options: copiedOptions });

    expect(fixture.componentInstance.form.controls.transformer.value).toEqual(transformer);
    expect(fixture.componentInstance.form.controls.options.value).toEqual(copiedOptions);
  });

  test('does not wipe the copied transformer when the source changes outside of the new creation mode', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], ['mqtt']);
    fixture.detectChanges();
    fixture.componentInstance.setCreationMode('from-north');
    fixture.detectChanges();
    fixture.componentInstance.applyExistingTransformer({ transformer, options: {} });

    fixture.componentInstance.form.controls.source.setValue({ dataSourceType: 'oibus-api', south: null });

    expect(fixture.componentInstance.form.controls.transformer.value).toEqual(transformer);
  });

  test('wipes the selected transformer when the source changes in the new creation mode', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], ['mqtt']);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.transformer.setValue(transformer);

    fixture.componentInstance.form.controls.source.setValue({ dataSourceType: 'oibus-api', south: null });

    expect(fixture.componentInstance.form.controls.transformer.value).toBeNull();
  });

  test('resets the copied transformer when switching back to the new creation mode', () => {
    const fixture = TestBed.createComponent(EditNorthTransformerModalComponent);
    fixture.componentInstance.prepareForCreation([], [], [], [transformer], ['mqtt']);
    fixture.detectChanges();
    fixture.componentInstance.setCreationMode('from-north');
    fixture.detectChanges();
    fixture.componentInstance.applyExistingTransformer({ transformer, options: {} });

    fixture.componentInstance.setCreationMode('new');

    expect(fixture.componentInstance.form.controls.transformer.value).toBeNull();
  });
});
