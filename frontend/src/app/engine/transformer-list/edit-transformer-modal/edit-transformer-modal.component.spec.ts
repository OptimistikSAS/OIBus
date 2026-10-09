import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { TransformerService } from '../../../services/transformer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditTransformerModalComponent } from './edit-transformer-modal.component';

class EditTransformerModalComponentTester {
  readonly fixture = TestBed.createComponent(EditTransformerModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByLabelText('Name');
  readonly description = this.root.getByLabelText('Description');
  readonly inputType = this.root.getByLabelText('Input', { exact: true });
  readonly outputType = this.root.getByLabelText('Output', { exact: true });
  readonly language = this.root.getByLabelText('Language');
  readonly languageDisclaimer = this.root.getByText('Select a programming language first.');
  readonly editor = this.root.getByCss('#custom-code .cm-content');
  readonly testPanel = this.root.getByCss('oib-transformer-test');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

describe('EditTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let transformerService: MockObject<TransformerService>;
  let confirmationService: MockObject<ConfirmationService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;
  const transformer = testData.transformers.customList[0];

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    transformerService = createMock(TransformerService);
    confirmationService = createMock(ConfirmationService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);
    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: TransformerService, useValue: transformerService },
        { provide: EngineService, useValue: engineService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  test('should create a transformer', async () => {
    const createdTransformer = { ...transformer, id: 'new-id' };
    transformerService.create.mockReturnValue(of(createdTransformer));
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForCreation();

    await expect.element(tester.title).toHaveTextContent('Create a Custom Transformer');
    await expect.element(tester.languageDisclaimer).toBeInTheDocument();
    await expect.element(tester.testPanel).not.toBeInTheDocument();

    await tester.name.fill('new-transformer');
    await tester.description.fill('my description');
    await tester.inputType.selectOptions('time-values');
    await tester.outputType.selectOptions('any');
    await tester.language.selectOptions('typescript');

    // the code template of the language is generated
    await expect.element(tester.editor).toMatchTextContent(/function transform\(inputData: string/);
    await expect.element(tester.testPanel).toBeInTheDocument();
    await tester.saveButton.click();

    expect(transformerService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'custom',
        name: 'new-transformer',
        description: 'my description',
        inputType: 'time-values',
        outputType: 'any',
        language: 'typescript',
        timeout: 2000,
        customCode: expect.stringContaining('function transform(inputData: string'),
        customManifest: expect.objectContaining({ type: 'object', key: 'options', attributes: [] })
      })
    );
    expect(activeModal.close).toHaveBeenCalledWith(createdTransformer);
  });

  test('should not save an invalid transformer', async () => {
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForCreation();

    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field is required').first()).toBeInTheDocument();
    expect(transformerService.create).not.toHaveBeenCalled();
  });

  test('should update a transformer after confirmation', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    transformerService.update.mockReturnValue(of(undefined));
    transformerService.findById.mockReturnValue(of({ ...transformer, name: 'updated' }));
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForEdition(transformer);

    await expect.element(tester.title).toHaveTextContent('Edit a Custom Transformer');
    await expect.element(tester.name).toHaveValue(transformer.name);
    await expect.element(tester.language).not.toBeInTheDocument();
    await expect.element(tester.editor).toHaveTextContent(transformer.customCode);
    await tester.name.fill('updated');
    await tester.saveButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'configuration.oibus.manifest.transformers.confirm-edit',
      interpolateParams: { name: transformer.name }
    });
    expect(transformerService.update).toHaveBeenCalledWith(transformer.id, expect.objectContaining({ name: 'updated' }));
    expect(activeModal.close).toHaveBeenCalledWith({ ...transformer, name: 'updated' });
  });

  test('should not update a transformer without confirmation', async () => {
    confirmationService.confirm.mockReturnValue(of());
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForEdition(transformer);
    await expect.element(tester.name).toHaveValue(transformer.name);

    await tester.saveButton.click();

    expect(transformerService.update).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should cancel', async () => {
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForCreation();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should ask for confirmation before dismissing a modified form', async () => {
    const tester = new EditTransformerModalComponentTester();
    tester.component.prepareForCreation();
    await expect.element(tester.name).toBeInTheDocument();
    expect(tester.component.canDismiss()).toBe(true);

    await tester.name.fill('modified');

    const result = tester.component.canDismiss();
    expect(isObservable(result) && (await firstValueFrom(result))).toBe(true);
    expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
  });
});
