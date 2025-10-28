import { TestBed } from '@angular/core/testing';

import { EditTransformerModalComponent } from './edit-transformer-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { TransformerService } from '../../../services/transformer.service';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OibCodeBlockStubComponent } from '../../../shared/form/oib-code-block/oib-code-block-stub.component';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { of } from 'rxjs';

class EditTransformerModalComponentTester extends ComponentTester<EditTransformerModalComponent> {
  constructor() {
    super(EditTransformerModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get description() {
    return this.input('#description')!;
  }

  get inputType() {
    return this.select('#input-type')!;
  }

  get outputType() {
    return this.select('#output-type')!;
  }

  get language() {
    return this.select('#language')!;
  }

  get languageDisclaimer() {
    return this.element('#language-disclaimer')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('EditTransformerModalComponent', () => {
  let tester: EditTransformerModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let transformerService: jasmine.SpyObj<TransformerService>;

  beforeEach(async () => {
    transformerService = createMock(TransformerService);
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: NgbActiveModal, useValue: fakeActiveModal }
      ]
    });

    TestBed.overrideComponent(EditTransformerModalComponent, {
      remove: {
        imports: [OibCodeBlockComponent]
      },
      add: {
        imports: [OibCodeBlockStubComponent]
      }
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    transformerService.create.and.returnValue(of(testData.transformers.customList[0]));
    transformerService.get.and.returnValue(of(testData.transformers.customList[0]));
    transformerService.update.and.returnValue(of(undefined));

    tester = new EditTransformerModalComponentTester();
  });

  it('should create', () => {
    tester.componentInstance.prepareForCreation();
    tester.detectChanges();

    expect(tester.inputType).toBeDefined();
    expect(tester.outputType).toBeDefined();
    expect(tester.language).toBeDefined();

    expect(tester.languageDisclaimer).toContainText('Select a programming language first.');

    tester.inputType.selectValue('any');
    tester.outputType.selectValue('any');
    tester.language.selectValue('javascript');
    tester.name.fillWith('my new transformer');
    tester.description.fillWith('my description');
    tester.componentInstance.form.get('customCode')!.setValue('my code');

    tester.save.click();

    expect(transformerService.create).toHaveBeenCalledWith({
      type: 'custom',
      inputType: 'any',
      outputType: 'any',
      name: 'my new transformer',
      description: 'my description',
      customCode: 'my code',
      language: 'javascript',
      customManifest: {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.choose-transformer-modal.options',
        attributes: tester.componentInstance.form.get('attributes')!.value!,
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    });
    expect(fakeActiveModal.close).toHaveBeenCalledWith(testData.transformers.customList[0]);
  });

  it('should update', () => {
    tester.componentInstance.prepareForEdition(testData.transformers.customList[0]);
    tester.detectChanges();

    expect(tester.inputType).toBeNull();
    expect(tester.outputType).toBeNull();
    expect(tester.language).toBeNull();

    tester.name.fillWith('updated name');

    tester.save.click();

    expect(transformerService.update).toHaveBeenCalledWith(testData.transformers.customList[0].id, {
      type: 'custom',
      inputType: testData.transformers.customList[0].inputType,
      outputType: testData.transformers.customList[0].outputType,
      name: 'updated name',
      description: testData.transformers.customList[0].description,
      customCode: testData.transformers.customList[0].customCode,
      language: testData.transformers.customList[0].language,
      customManifest: {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.choose-transformer-modal.options',
        attributes: tester.componentInstance.form.get('attributes')!.value!,
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    });
    expect(transformerService.get).toHaveBeenCalledWith(testData.transformers.customList[0].id);
    expect(fakeActiveModal.close).toHaveBeenCalledWith(testData.transformers.customList[0]);
  });

  it('should not save if invalid', () => {
    tester.componentInstance.prepareForCreation();
    tester.detectChanges();

    tester.save.click();

    // Form should be invalid and not save
    expect(tester.componentInstance.form?.valid).toBeFalsy();
    expect(tester.validationErrors.length).toBeGreaterThan(0);
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
