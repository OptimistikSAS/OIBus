import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { noAnimation } from '../../../shared/test-utils';
import { TestTransformerModalComponent } from './test-transformer-modal.component';
import { TransformerService } from '../../../services/transformer.service';
import { CustomTransformerDTO, TransformerTestResponse } from '../../../../../../backend/shared/model/transformer.model';
import { InputTemplate } from '../../../../../../backend/src/service/input-template.service';

class TestTransformerModalComponentTester extends ComponentTester<TestTransformerModalComponent> {
  get modalTitle() {
    return this.element('.modal-title')!;
  }

  get transformerName() {
    return this.element('.form-control-plaintext')!;
  }

  get inputTypeDisplay() {
    return this.elements('.form-control-plaintext')[1];
  }

  get inputDataCodeBlock() {
    return this.element('oib-code-block[formControlName="inputData"]')!;
  }

  get optionsManifestArray() {
    return this.element('oib-manifest-attributes-array')!;
  }

  get testButton() {
    return this.button('button[type="button"][form="test-form"]')!;
  }

  get cancelButton() {
    return this.button('button[translate="common.cancel"]')!;
  }

  get successAlert() {
    return this.element('.alert-info')!;
  }

  get errorAlert() {
    return this.element('.alert-danger')!;
  }

  get outputCodeBlock() {
    return this.element('oib-code-block[formControl]')!;
  }

  get loadingSpinner() {
    return this.element('.spinner-border')!;
  }

  get form() {
    return this.element('form#test-form')!;
  }

  fillInputData(data: string) {
    (this.component as any).form.patchValue({ inputData: data });
    this.detectChanges();
  }

  fillOptions(options: any) {
    (this.component as any).form.patchValue({ options });
    this.detectChanges();
  }
}

describe('TestTransformerModalComponent', () => {
  let tester: TestTransformerModalComponentTester;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockTransformerService: jasmine.SpyObj<TransformerService>;

  const mockTransformer: CustomTransformerDTO = {
    id: 'test-transformer-1',
    name: 'Test Transformer',
    description: 'A test transformer',
    type: 'custom',
    inputType: 'time-values',
    outputType: 'any',
    customCode: 'function transform(data) { return data; }',
    language: 'javascript',
    manifest: {
      type: 'object',
      attributes: [],
      enablingConditions: [],
      displayProperties: {},
      key: '',
      translationKey: '',
      validators: []
    }
  } as unknown as CustomTransformerDTO;

  const mockInputTemplate: InputTemplate = {
    type: 'time-values',
    data: JSON.stringify(
      [
        {
          pointId: 'sensor_01',
          timestamp: '2024-01-01T00:00:00.000Z',
          data: { value: 25.5, unit: '°C', quality: 'good' }
        }
      ],
      null,
      2
    ),
    description: 'Sample time-series data'
  };

  const mockTestResponse: TransformerTestResponse = {
    output: JSON.stringify({ transformed: 'data' }, null, 2),
    metadata: {
      contentType: 'application/json',
      numberOfElement: 1
    }
  };

  beforeEach(() => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['dismiss', 'close']);
    mockTransformerService = jasmine.createSpyObj('TransformerService', ['getInputTemplate', 'test']);

    TestBed.configureTestingModule({
      imports: [TestTransformerModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18nTesting(),
        noAnimation,
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: TransformerService, useValue: mockTransformerService }
      ]
    });

    tester = new TestTransformerModalComponentTester(TestBed.createComponent(TestTransformerModalComponent));
    tester.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(tester.componentInstance).toBeTruthy();
    });

    it('should initialize with empty form', () => {
      expect(tester.componentInstance.form.get('inputData')?.value).toBe('');
      expect(tester.componentInstance.form.get('options')?.value).toEqual([] as any);
    });

    it('should have required validators on inputData', () => {
      const inputDataControl = tester.componentInstance.form.get('inputData');
      expect(inputDataControl?.hasError('required')).toBe(true);
    });
  });

  describe('prepareForCreation', () => {
    beforeEach(() => {
      mockTransformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
    });

    it('should set transformer and load input template', () => {
      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();

      expect(tester.componentInstance.transformer()).toEqual(mockTransformer);
      expect(mockTransformerService.getInputTemplate).toHaveBeenCalledWith('time-values');
    });

    it('should pre-fill options when customManifest is provided', () => {
      const customManifest = [{ key: 'testKey', type: 'string', label: 'Test Label' }];
      tester.componentInstance.prepareForCreation(mockTransformer, undefined, customManifest);
      tester.detectChanges();

      expect(tester.componentInstance.form.get('options')?.value).toEqual(customManifest as any);
    });

    it('should handle input template loading success', () => {
      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();

      expect(tester.componentInstance.inputTemplate()).toBe(mockInputTemplate.data);
      expect(tester.componentInstance.form.get('inputData')?.value).toBe(mockInputTemplate.data);
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should handle input template loading error', () => {
      const errorMessage = 'Template loading failed';
      mockTransformerService.getInputTemplate.and.returnValue(throwError(() => new Error(errorMessage)));

      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();

      expect(tester.componentInstance.error()).toBe('Failed to load input template: ' + errorMessage);
      expect(tester.componentInstance.isLoading()).toBe(false);
    });
  });

  describe('Template Display', () => {
    beforeEach(() => {
      mockTransformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();
    });

    it('should display transformer information', () => {
      expect(tester.modalTitle.textContent?.trim()).toBe('Test Custom Transformer');
      expect(tester.transformerName.textContent?.trim()).toBe('Test Transformer');
    });

    it('should display input type', () => {
      expect(tester.inputTypeDisplay.textContent?.trim()).toBe('OIBus time values');
    });

    it('should show loading spinner when loading', () => {
      tester.componentInstance.isLoading.set(true);
      tester.detectChanges();

      expect(tester.loadingSpinner).toBeTruthy();
    });

    it('should hide loading spinner when not loading', () => {
      tester.componentInstance.isLoading.set(false);
      tester.detectChanges();

      expect(tester.loadingSpinner).toBeFalsy();
    });
  });

  describe('Test Functionality', () => {
    beforeEach(() => {
      mockTransformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      mockTransformerService.test.and.returnValue(of(mockTestResponse));
      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();
    });

    it('should not test when form is invalid', () => {
      tester.componentInstance.form.patchValue({ inputData: '' }); // Invalid - required field empty
      tester.detectChanges();

      tester.testButton.click();

      expect(mockTransformerService.test).not.toHaveBeenCalled();
    });

    it('should not test when transformer is null', () => {
      tester.componentInstance.transformer.set(null);
      tester.detectChanges();

      tester.testButton.click();

      expect(mockTransformerService.test).not.toHaveBeenCalled();
    });

    it('should test transformer with valid form', () => {
      const testData = '{"test": "data"}';
      tester.componentInstance.form.patchValue({ inputData: testData });
      tester.detectChanges();

      tester.testButton.click();

      expect(mockTransformerService.test).toHaveBeenCalledWith('test-transformer-1', {
        inputData: testData,
        options: []
      });
    });

    it('should handle successful test response', () => {
      const testData = '{"test": "data"}';
      tester.componentInstance.form.patchValue({ inputData: testData });
      tester.detectChanges();

      tester.testButton.click();

      expect(tester.componentInstance.output()).toBe(mockTestResponse.output);
      expect(tester.componentInstance.isLoading()).toBe(false);
      expect(tester.componentInstance.error()).toBe('');
    });

    it('should handle test response with non-JSON output', () => {
      const nonJsonResponse: TransformerTestResponse = {
        output: 'plain text output',
        metadata: { contentType: 'text/plain', numberOfElement: 1 }
      };
      mockTransformerService.test.and.returnValue(of(nonJsonResponse));

      const testData = '{"test": "data"}';
      tester.componentInstance.form.patchValue({ inputData: testData });
      tester.detectChanges();

      tester.testButton.click();

      expect(tester.componentInstance.output()).toBe('plain text output');
    });

    it('should handle test error', () => {
      const errorMessage = 'Test execution failed';
      mockTransformerService.test.and.returnValue(throwError(() => new Error(errorMessage)));

      const testData = '{"test": "data"}';
      tester.componentInstance.form.patchValue({ inputData: testData });
      tester.detectChanges();

      tester.testButton.click();

      expect(tester.componentInstance.error()).toBe('Test failed: ' + errorMessage);
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should show success alert when output is available', () => {
      tester.componentInstance.output.set('test output');
      tester.detectChanges();

      expect(tester.successAlert).toBeTruthy();
    });

    it('should show error alert when error is present', () => {
      tester.componentInstance.error.set('Test error');
      tester.detectChanges();

      expect(tester.errorAlert).toBeTruthy();
      expect(tester.errorAlert.textContent?.trim()).toBe('Test error');
    });
  });

  describe('Modal Actions', () => {
    it('should dismiss modal when cancel button is clicked', () => {
      tester.cancelButton.click();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should disable test button when form is invalid', () => {
      tester.componentInstance.form.patchValue({ inputData: '' }); // Invalid
      tester.detectChanges();

      expect(tester.testButton.disabled).toBe(true);
    });

    it('should disable test button when loading', () => {
      tester.componentInstance.isLoading.set(true);
      tester.detectChanges();

      expect(tester.testButton.disabled).toBe(true);
    });

    it('should enable test button when form is valid and not loading', () => {
      tester.componentInstance.form.patchValue({ inputData: '{"valid": "data"}' });
      tester.componentInstance.isLoading.set(false);
      tester.detectChanges();

      expect(tester.testButton.disabled).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should mark form as invalid when inputData is empty', () => {
      tester.componentInstance.form.patchValue({ inputData: '' });
      tester.detectChanges();

      expect(tester.componentInstance.form.valid).toBe(false);
    });

    it('should mark form as valid when inputData is provided', () => {
      tester.componentInstance.form.patchValue({ inputData: '{"valid": "data"}' });
      tester.detectChanges();

      expect(tester.componentInstance.form.valid).toBe(true);
    });
  });

  describe('Output Display', () => {
    beforeEach(() => {
      mockTransformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.componentInstance.prepareForCreation(mockTransformer);
      tester.detectChanges();
    });

    it('should not show output section when no output', () => {
      expect(tester.outputCodeBlock).toBeFalsy();
    });

    it('should show output section when output is available', () => {
      tester.componentInstance.output.set('test output');
      tester.detectChanges();

      const outputSection = tester.element('.output-container');
      expect(outputSection).toBeTruthy();

      const successAlert = tester.element('.alert-info');
      expect(successAlert).toBeTruthy();
    });
  });
});
