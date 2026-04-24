import { Component, forwardRef, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of, throwError } from 'rxjs';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { TransformerTestComponent } from './transformer-test.component';
import { TransformerService } from '../../../services/transformer.service';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import {
  CustomTransformerCommandDTO,
  InputTemplate,
  TransformerTestResponse
} from '../../../../../../backend/shared/model/transformer.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-code-block',
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibCodeBlockStubComponent), multi: true }]
})
class OibCodeBlockStubComponent implements ControlValueAccessor {
  readonly language = input('');
  readonly readOnly = input(false);
  readonly height = input('');
  writeValue() {}
  registerOnChange() {}
  registerOnTouched() {}
}

@Component({ selector: 'oib-oibus-object-form-control', standalone: true, template: '' })
class OIBusObjectFormControlStubComponent {
  readonly scanModes = input<Array<any>>([]);
  readonly certificates = input<Array<any>>([]);
  readonly group = input<AbstractControl | null>(null);
  readonly objectAttribute = input<OIBusObjectAttribute | null>(null);
}

class TransformerTestComponentTester extends ComponentTester<TransformerTestComponent> {
  constructor() {
    super(TransformerTestComponent);
  }

  get runTestButton() {
    return this.button('#run-test-button')!;
  }

  get successAlert() {
    return this.element('.alert-info');
  }

  get errorAlert() {
    return this.element('.alert-danger');
  }

  get loadingSpinner() {
    return this.element('.spinner-border');
  }

  get testForm() {
    return this.element('form#test-form');
  }

  setTransformer(transformer: CustomTransformerCommandDTO | null) {
    this.fixture.componentRef.setInput('transformer', transformer);
    this.detectChanges();
  }
}

describe('TransformerTestComponent', () => {
  let tester: TransformerTestComponentTester;
  let transformerService: jasmine.SpyObj<TransformerService>;

  const mockTransformer: CustomTransformerCommandDTO = {
    type: 'custom',
    name: 'Test Transformer',
    description: 'A test transformer',
    inputType: 'time-values',
    outputType: 'any',
    customCode: 'function transform(data) { return data; }',
    language: 'javascript',
    timeout: 2000,
    customManifest: {
      type: 'object',
      attributes: [],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: false },
      key: 'options',
      translationKey: '',
      validators: []
    }
  };

  const mockInputTemplate: InputTemplate = {
    type: 'time-values',
    data: JSON.stringify([{ pointId: 'sensor_01', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 25.5 } }], null, 2),
    description: 'Sample time-series data'
  };

  const mockTestResponse: TransformerTestResponse = {
    output: JSON.stringify({ transformed: 'data' }, null, 2),
    metadata: { contentType: 'application/json', numberOfElement: 1 }
  };

  beforeEach(() => {
    transformerService = createMock(TransformerService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: TransformerService, useValue: transformerService }]
    });

    TestBed.overrideComponent(TransformerTestComponent, {
      remove: { imports: [OibCodeBlockComponent, OIBusObjectFormControlComponent] },
      add: { imports: [OibCodeBlockStubComponent, OIBusObjectFormControlStubComponent] }
    });

    tester = new TransformerTestComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.componentInstance).toBeTruthy();
  });

  describe('initial state (no transformer)', () => {
    it('should have null transformer', () => {
      expect(tester.componentInstance.transformer()).toBeNull();
    });

    it('should have empty signals', () => {
      expect(tester.componentInstance.output()).toBe('');
      expect(tester.componentInstance.error()).toBe('');
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should have disabled run-test button', () => {
      expect(tester.runTestButton.disabled).toBe(true);
    });

    it('should not render the test form', () => {
      expect(tester.testForm).toBeNull();
    });
  });

  describe('when transformer input is set', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.setTransformer(mockTransformer);
    });

    it('should render the test form', () => {
      expect(tester.testForm).toBeTruthy();
    });

    it('should load the input template', () => {
      expect(transformerService.getInputTemplate).toHaveBeenCalledWith('time-values');
    });

    it('should pre-fill inputData with the template', () => {
      expect(tester.componentInstance.form.get('inputData')?.value).toBe(mockInputTemplate.data);
    });

    it('should enable the run-test button when form is valid', () => {
      expect(tester.runTestButton.disabled).toBe(false);
    });

    it('should reload template when inputType changes', () => {
      const newTemplate: InputTemplate = { type: 'raw-file', data: '{}', description: 'Raw file' };
      transformerService.getInputTemplate.and.returnValue(of(newTemplate));

      tester.setTransformer({ ...mockTransformer, inputType: 'raw-file' });

      expect(transformerService.getInputTemplate).toHaveBeenCalledWith('raw-file');
      expect(tester.componentInstance.form.get('inputData')?.value).toBe('{}');
    });

    it('should not reload template when only manifest changes', () => {
      transformerService.getInputTemplate.calls.reset();
      tester.setTransformer({ ...mockTransformer, customManifest: { ...mockTransformer.customManifest } });
      expect(transformerService.getInputTemplate).not.toHaveBeenCalled();
    });

    it('should set error when template loading fails', () => {
      const errorMessage = 'Template not found';
      transformerService.getInputTemplate.and.returnValue(throwError(() => new Error(errorMessage)));

      tester.setTransformer({ ...mockTransformer, inputType: 'raw-file' });

      expect(tester.componentInstance.error()).toBe('Failed to load input template: ' + errorMessage);
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should clear test form when transformer is set back to null', () => {
      tester.setTransformer(null);
      expect(tester.testForm).toBeNull();
      expect(tester.runTestButton.disabled).toBe(true);
    });
  });

  describe('test()', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      transformerService.test.and.returnValue(of(mockTestResponse));
      tester.setTransformer(mockTransformer);
    });

    it('should call transformerService.test with form values', () => {
      tester.componentInstance.form.patchValue({ inputData: '{"key": "value"}' });
      tester.componentInstance.test();

      expect(transformerService.test).toHaveBeenCalledWith(mockTransformer, {
        inputData: '{"key": "value"}',
        options: {}
      });
    });

    it('should display pretty-printed JSON output on success', () => {
      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();
      tester.detectChanges();

      expect(tester.componentInstance.output()).toBe(mockTestResponse.output);
      expect(tester.successAlert).toBeTruthy();
      expect(tester.componentInstance.error()).toBe('');
    });

    it('should display raw string output when response is not JSON', () => {
      const rawResponse: TransformerTestResponse = {
        output: 'plain text output',
        metadata: { contentType: 'text/plain', numberOfElement: 1 }
      };
      transformerService.test.and.returnValue(of(rawResponse));

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.output()).toBe('plain text output');
    });

    it('should set error signal and clear output on test failure', () => {
      transformerService.test.and.returnValue(throwError(() => new Error('Execution failed')));

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.error()).toBe('Execution failed');
      expect(tester.componentInstance.output()).toBe('');
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should clear previous error and output before running a new test', () => {
      tester.componentInstance.error.set('old error');
      tester.componentInstance.output.set('old output');

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.error()).toBe('');
      expect(tester.componentInstance.output()).toBe(mockTestResponse.output);
    });

    it('should not call test when form is invalid', () => {
      tester.componentInstance.form.patchValue({ inputData: '' });
      tester.componentInstance.test();

      expect(transformerService.test).not.toHaveBeenCalled();
    });

    it('should not call test when transformer is null', () => {
      tester.setTransformer(null);
      tester.componentInstance.test();

      expect(transformerService.test).not.toHaveBeenCalled();
    });
  });

  describe('UI state', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.setTransformer(mockTransformer);
    });

    it('should show loading spinner when isLoading is true', () => {
      tester.componentInstance.isLoading.set(true);
      tester.detectChanges();

      expect(tester.loadingSpinner).toBeTruthy();
    });

    it('should hide loading spinner when isLoading is false', () => {
      tester.componentInstance.isLoading.set(false);
      tester.detectChanges();

      expect(tester.loadingSpinner).toBeFalsy();
    });

    it('should disable run-test button when loading', () => {
      tester.componentInstance.isLoading.set(true);
      tester.detectChanges();

      expect(tester.runTestButton.disabled).toBe(true);
    });

    it('should disable run-test button when form is invalid', () => {
      tester.componentInstance.form.patchValue({ inputData: '' });
      tester.detectChanges();

      expect(tester.runTestButton.disabled).toBe(true);
    });

    it('should show error alert when error signal is set', () => {
      tester.componentInstance.error.set('something went wrong');
      tester.detectChanges();

      expect(tester.errorAlert).toBeTruthy();
      expect(tester.errorAlert!.textContent?.trim()).toBe('something went wrong');
    });

    it('should show success alert when output signal is set', () => {
      tester.componentInstance.output.set('some output');
      tester.detectChanges();

      expect(tester.successAlert).toBeTruthy();
    });

    it('should not show output section when output is empty', () => {
      expect(tester.successAlert).toBeFalsy();
    });

    it('should not show error alert when error is empty', () => {
      expect(tester.errorAlert).toBeFalsy();
    });
  });
});
