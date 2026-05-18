import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EditTransformerModalComponent } from './edit-transformer-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { TransformerService } from '../../../services/transformer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CustomTransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const transformer = testData.transformers.customList[0] as unknown as CustomTransformerDTO;

describe('EditTransformerModalComponent', () => {
  let transformerService: MockObject<TransformerService>;
  let confirmationService: MockObject<ConfirmationService>;
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    confirmationService = createMock(ConfirmationService);
    activeModal = createMock(NgbActiveModal);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'any', data: '', description: '' }));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NgbActiveModal, useValue: activeModal }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate form in edit mode', async () => {
    const fixture = TestBed.createComponent(EditTransformerModalComponent);
    fixture.componentInstance.prepareForEdition(transformer);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const nameInput = root.getByCss('#name');
    await expect.element(nameInput).toHaveValue(transformer.name);
  });

  test('should create a transformer', () => {
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
