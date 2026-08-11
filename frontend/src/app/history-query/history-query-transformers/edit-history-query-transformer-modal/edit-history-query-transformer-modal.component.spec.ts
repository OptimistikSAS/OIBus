import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditHistoryQueryTransformerModalComponent } from './edit-history-query-transformer-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../../services/transformer.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { of } from 'rxjs';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { OIBusSouthType } from '../../../../../../backend/shared/model/south-connector.model';

describe('EditHistoryQueryTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    // Services used by the embedded transformer-test panel (rendered once a transformer is selected).
    const transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    const southConnectorService = createMock(SouthConnectorService);
    southConnectorService.getSouthManifest.mockReturnValue(of({ modes: { history: false } }) as never);

    // Services used by the "copy from existing" picker (rendered once the user leaves the 'new' creation mode).
    const northConnectorService = createMock(NorthConnectorService);
    const historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of([]));
    historyQueryService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should not save in create mode when form is invalid', async () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    const transformer = testData.transformers.customList[0] as unknown as TransformerDTO;
    fixture.componentInstance.prepareForCreation('opcua-ha' as OIBusSouthType, [], [], [transformer], ['any'], []);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('#save-button').click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should save in edit mode', async () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    const transformer = testData.transformers.customList[0] as unknown as TransformerDTO;
    fixture.componentInstance.prepareForEdition('opcua-ha' as OIBusSouthType, [], [], [transformer], ['any'], [], {
      id: 'historyTransformerId1',
      transformer,
      options: {},
      items: []
    });
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('#save-button').click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'historyTransformerId1',
        transformer: expect.objectContaining({ id: transformer.id })
      })
    );
  });

  test('defaults to the new creation mode', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    const transformer = testData.transformers.customList[0] as unknown as TransformerDTO;
    fixture.componentInstance.prepareForCreation('opcua-ha' as OIBusSouthType, [], [], [transformer], ['any'], []);
    fixture.detectChanges();

    expect(fixture.componentInstance.creationMode).toBe('new');
  });

  test('copies the transformer and its options from an existing attachment', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    const transformerWithOptions = {
      ...(testData.transformers.customList[0] as unknown as TransformerDTO),
      manifest: {
        type: 'object',
        key: 'transformers.options',
        translationKey: '',
        attributes: [
          {
            type: 'string',
            key: 'delimiter',
            translationKey: '',
            defaultValue: ',',
            validators: [],
            displayProperties: { row: 0, columns: 4, displayInViewMode: true }
          }
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: { visible: true, wrapInBox: false }
      }
    } as unknown as TransformerDTO;
    fixture.componentInstance.prepareForCreation('opcua-ha' as OIBusSouthType, [], [], [transformerWithOptions], ['any'], []);
    fixture.detectChanges();

    fixture.componentInstance.setCreationMode('from-history');
    fixture.detectChanges();
    fixture.componentInstance.applyExistingTransformer({ transformer: transformerWithOptions, options: { delimiter: ';' } });

    expect(fixture.componentInstance.form.controls.transformer.value).toEqual(transformerWithOptions);
    expect(fixture.componentInstance.form.controls.options.value).toEqual({ delimiter: ';' });
  });

  test('resets the copied transformer when switching back to the new creation mode', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
    const transformer = testData.transformers.customList[0] as unknown as TransformerDTO;
    fixture.componentInstance.prepareForCreation('opcua-ha' as OIBusSouthType, [], [], [transformer], ['any'], []);
    fixture.detectChanges();
    fixture.componentInstance.setCreationMode('from-north');
    fixture.detectChanges();
    fixture.componentInstance.applyExistingTransformer({ transformer, options: {} });

    fixture.componentInstance.setCreationMode('new');

    expect(fixture.componentInstance.form.controls.transformer.value).toBeNull();
  });
});
