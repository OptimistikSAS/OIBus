import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditTransformerModalComponent } from './edit-transformer-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { TransformerService } from '../../../services/transformer.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { CustomTransformerDTO, InputTemplate } from '../../../../../../backend/shared/model/transformer.model';

describe('EditTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    transformerService = createMock(TransformerService);
    const unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);
    const confirmationService = createMock(ConfirmationService);

    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '', description: '' } as InputTemplate));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: TransformerService, useValue: transformerService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should render create mode', async () => {
    const fixture = TestBed.createComponent(EditTransformerModalComponent);
    fixture.componentInstance.prepareForCreation();
    fixture.detectChanges();

    await expect.element(page.getByCss('#name')).toBeInTheDocument();
    await expect.element(page.getByCss('#name')).toHaveValue('');
  });

  test('should populate form in edit mode', async () => {
    const transformer = testData.transformers.customList[0] as unknown as CustomTransformerDTO;
    const fixture = TestBed.createComponent(EditTransformerModalComponent);
    fixture.componentInstance.prepareForEdition(transformer);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const nameInput = root.getByCss('#name');
    await expect.element(nameInput).toHaveValue(transformer.name);
  });

  test('should create a transformer', () => {
    const transformer = testData.transformers.customList[0] as unknown as CustomTransformerDTO;
    const createdTransformer = { ...transformer, id: 'new-id' } as CustomTransformerDTO;
    transformerService.create.mockReturnValue(of(createdTransformer));

    const fixture = TestBed.createComponent(EditTransformerModalComponent);
    fixture.componentInstance.prepareForCreation();
    fixture.detectChanges();

    fixture.componentInstance.form.patchValue({
      name: 'new-transformer',
      inputType: 'time-values',
      outputType: 'any',
      language: 'javascript',
      customCode: 'function transform() {}',
      timeout: 2000,
      description: ''
    });
    fixture.componentInstance.save();

    expect(transformerService.create).toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalledWith(createdTransformer);
  });
});
