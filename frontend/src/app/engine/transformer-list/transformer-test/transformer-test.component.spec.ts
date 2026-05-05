import { Component, forwardRef, input, output, Pipe, PipeTransform } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of, throwError } from 'rxjs';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { TransformerTestComponent } from './transformer-test.component';
import { TransformerService } from '../../../services/transformer.service';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import {
  CustomTransformerCommandDTO,
  InputTemplate,
  TransformerTestResponse
} from '../../../../../../backend/shared/model/transformer.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { Page } from '../../../../../../backend/shared/model/types';

// --- Stubs ---

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

@Component({ selector: 'oib-pagination', standalone: true, template: '' })
class PaginationComponentStub {
  readonly page = input<Page<any> | null>(null);
  readonly pageChanged = output<number>();
}

@Pipe({ name: 'datetime', standalone: true })
class DatetimePipeStub implements PipeTransform {
  transform(value: any): string {
    return String(value);
  }
}

@Pipe({ name: 'fileSize', standalone: true, pure: false })
class FileSizePipeStub implements PipeTransform {
  transform(value: number): string {
    return `${value} B`;
  }
}

// --- Tester ---

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

  get viewDropdown() {
    return this.element('[ngbDropdown]');
  }

  setTransformer(transformer: CustomTransformerCommandDTO | null) {
    this.fixture.componentRef.setInput('transformer', transformer);
    this.detectChanges();
  }
}

// --- Test data ---

const mockManifest: OIBusObjectAttribute = {
  type: 'object',
  attributes: [],
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false },
  key: 'options',
  translationKey: '',
  validators: []
};

const mockTransformer: CustomTransformerCommandDTO = {
  type: 'custom',
  name: 'Test Transformer',
  description: 'A test transformer',
  inputType: 'time-values',
  outputType: 'any',
  customCode: 'function transform(data) { return data; }',
  language: 'javascript',
  timeout: 2000,
  customManifest: mockManifest
};

const mockInputTemplate: InputTemplate = {
  type: 'time-values',
  data: JSON.stringify([{ pointId: 'sensor_01', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 25.5 } }], null, 2),
  description: 'Sample time-series data'
};

const mockJsonResponse: TransformerTestResponse = {
  output: JSON.stringify({ transformed: 'data' }),
  metadata: {
    contentType: 'json',
    contentFile: 'output.json',
    contentSize: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    numberOfElement: 1
  }
};

// --- Tests ---

describe('TransformerTestComponent', () => {
  let tester: TransformerTestComponentTester;
  let transformerService: jasmine.SpyObj<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: TransformerService, useValue: transformerService }]
    });

    TestBed.overrideComponent(TransformerTestComponent, {
      remove: { imports: [OibCodeBlockComponent, OIBusObjectFormControlComponent, DatetimePipe, FileSizePipe, PaginationComponent] },
      add: {
        imports: [
          OibCodeBlockStubComponent,
          OIBusObjectFormControlStubComponent,
          DatetimePipeStub,
          FileSizePipeStub,
          PaginationComponentStub
        ]
      }
    });

    tester = new TransformerTestComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.componentInstance).toBeTruthy();
  });

  describe('initial state (no transformer)', () => {
    it('should have null response, empty error, and not loading', () => {
      expect(tester.componentInstance.response()).toBeNull();
      expect(tester.componentInstance.error()).toBe('');
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should have null displayMode', () => {
      expect(tester.componentInstance.displayMode()).toBeNull();
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
      tester.setTransformer({ ...mockTransformer, customManifest: { ...mockManifest } });
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
      transformerService.test.and.returnValue(of(mockJsonResponse));
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

    it('should set response and display success on success', () => {
      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();
      tester.detectChanges();

      expect(tester.componentInstance.response()).toEqual(mockJsonResponse);
      expect(tester.successAlert).toBeTruthy();
      expect(tester.componentInstance.error()).toBe('');
    });

    it('should set initial displayMode to json for JSON response', () => {
      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.displayMode()).toBe('json');
    });

    it('should set initial displayMode to any for non-JSON response', () => {
      const plainResponse: TransformerTestResponse = {
        output: 'plain text',
        metadata: {
          contentType: 'text/plain',
          contentFile: 'output.txt',
          contentSize: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      };
      transformerService.test.and.returnValue(of(plainResponse));

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.displayMode()).toBe('any');
    });

    it('should clear response and displayMode on test failure', () => {
      transformerService.test.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Internal Server Error',
              error: { message: 'Execution failed' }
            })
        )
      );

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.error()).toContain('500');
      expect(tester.componentInstance.error()).toContain('Execution failed');
      expect(tester.componentInstance.response()).toBeNull();
      expect(tester.componentInstance.displayMode()).toBeNull();
      expect(tester.componentInstance.isLoading()).toBe(false);
    });

    it('should clear previous response and error before running a new test', () => {
      tester.componentInstance.error.set('old error');
      tester.componentInstance.response.set({
        output: 'old output',
        metadata: {
          contentType: 'json',
          contentFile: 'old.json',
          contentSize: 50,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });

      tester.componentInstance.form.patchValue({ inputData: '{}' });
      tester.componentInstance.test();

      expect(tester.componentInstance.error()).toBe('');
      expect(tester.componentInstance.response()).toEqual(mockJsonResponse);
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

  describe('availableDisplayModes', () => {
    it('should return empty array when no response', () => {
      expect(tester.componentInstance.availableDisplayModes()).toEqual([]);
    });

    it('should return [json, any] for a JSON object response', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify({ key: 'value' }),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 20,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });
      expect(tester.componentInstance.availableDisplayModes()).toEqual(['json', 'any']);
    });

    it('should return [json, table, any] for a JSON array response', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify([{ id: 1 }, { id: 2 }]),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 30,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 2
        }
      });
      expect(tester.componentInstance.availableDisplayModes()).toEqual(['json', 'table', 'any']);
    });

    it('should return [any] for a non-JSON response', () => {
      tester.componentInstance.response.set({
        output: 'plain text',
        metadata: {
          contentType: 'text/plain',
          contentFile: 'out.txt',
          contentSize: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });
      expect(tester.componentInstance.availableDisplayModes()).toEqual(['any']);
    });

    it('should include table for CSV files', () => {
      tester.componentInstance.response.set({
        output: 'name,age\nAlice,30',
        metadata: {
          contentType: 'text/csv',
          contentFile: 'out.csv',
          contentSize: 18,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });
      expect(tester.componentInstance.availableDisplayModes()).toContain('table');
    });
  });

  describe('numberOfElements', () => {
    it('should return null when no response', () => {
      expect(tester.componentInstance.numberOfElements()).toBeNull();
    });

    it('should return null for a non-JSON content type', () => {
      tester.componentInstance.response.set({
        output: 'plain text',
        metadata: {
          contentType: 'text/plain',
          contentFile: 'out.txt',
          contentSize: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 5
        }
      });
      expect(tester.componentInstance.numberOfElements()).toBeNull();
    });

    it('should return null for a JSON object (not an array)', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify({ key: 'value' }),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 15,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 1
        }
      });
      expect(tester.componentInstance.numberOfElements()).toBeNull();
    });

    it('should return numberOfElement for a JSON array', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify([1, 2, 3]),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 7,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 3
        }
      });
      expect(tester.componentInstance.numberOfElements()).toBe(3);
    });
  });

  describe('changeDisplayMode()', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.setTransformer(mockTransformer);
      tester.componentInstance.response.set(mockJsonResponse);
      tester.componentInstance.displayMode.set('json');
    });

    it('should update the displayMode signal', () => {
      tester.componentInstance.changeDisplayMode('any');
      expect(tester.componentInstance.displayMode()).toBe('any');
    });

    it('should set raw output on outputControl when switching to any mode', () => {
      tester.componentInstance.changeDisplayMode('any');
      expect(tester.componentInstance.outputControl.value).toBe(mockJsonResponse.output);
    });

    it('should set pretty-printed JSON on outputControl when switching to json mode', () => {
      tester.componentInstance.changeDisplayMode('any');
      tester.componentInstance.changeDisplayMode('json');
      expect(tester.componentInstance.outputControl.value).toBe(JSON.stringify(JSON.parse(mockJsonResponse.output), null, 2));
    });

    it('should build the table page when switching to table mode', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify([{ name: 'Alice' }, { name: 'Bob' }]),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 50,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 2
        }
      });
      tester.componentInstance.changeDisplayMode('table');

      expect(tester.componentInstance.tableHeaders).toEqual(['name']);
      expect(tester.componentInstance.tablePage.content).toEqual([['Alice'], ['Bob']]);
    });
  });

  describe('buildTablePage()', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.setTransformer(mockTransformer);
    });

    it('should parse a JSON array of objects into table rows', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 60,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 2
        }
      });

      tester.componentInstance.buildTablePage(0);

      expect(tester.componentInstance.tableHeaders).toEqual(['id', 'name']);
      expect(tester.componentInstance.tablePage.totalElements).toBe(2);
      expect(tester.componentInstance.tablePage.content[0]).toEqual(['1', 'Alice']);
      expect(tester.componentInstance.tablePage.content[1]).toEqual(['2', 'Bob']);
    });

    it('should parse a JSON array of primitives with a single "value" column', () => {
      tester.componentInstance.response.set({
        output: JSON.stringify([10, 20, 30]),
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 3
        }
      });

      tester.componentInstance.buildTablePage(0);

      expect(tester.componentInstance.tableHeaders).toEqual(['value']);
      expect(tester.componentInstance.tablePage.totalElements).toBe(3);
      expect(tester.componentInstance.tablePage.content).toEqual([['10'], ['20'], ['30']]);
    });

    it('should produce an empty page for invalid JSON', () => {
      tester.componentInstance.response.set({
        output: 'not valid json',
        metadata: {
          contentType: 'json',
          contentFile: 'out.json',
          contentSize: 14,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });

      tester.componentInstance.buildTablePage(0);

      expect(tester.componentInstance.tablePage.totalElements).toBe(0);
    });
  });

  describe('CSV delimiter', () => {
    beforeEach(() => {
      transformerService.getInputTemplate.and.returnValue(of(mockInputTemplate));
      tester.setTransformer(mockTransformer);
      tester.componentInstance.response.set({
        output: 'name;age\nAlice;30\nBob;25',
        metadata: {
          contentType: 'text/csv',
          contentFile: 'out.csv',
          contentSize: 22,
          createdAt: '2024-01-01T00:00:00.000Z',
          numberOfElement: 0
        }
      });
    });

    it('should default to comma delimiter', () => {
      expect(tester.componentInstance.csvDelimiter()).toBe(',');
    });

    it('should re-parse CSV and update table when delimiter changes', () => {
      tester.componentInstance.changeCsvDelimiter(';');

      expect(tester.componentInstance.csvDelimiter()).toBe(';');
      expect(tester.componentInstance.tableHeaders).toEqual(['name', 'age']);
      expect(tester.componentInstance.tablePage.content[0]).toEqual(['Alice', '30']);
      expect(tester.componentInstance.tablePage.content[1]).toEqual(['Bob', '25']);
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

    it('should show success alert when response is set', () => {
      tester.componentInstance.response.set(mockJsonResponse);
      tester.componentInstance.displayMode.set('json');
      tester.detectChanges();

      expect(tester.successAlert).toBeTruthy();
    });

    it('should not show output section when response is null', () => {
      expect(tester.successAlert).toBeFalsy();
    });

    it('should not show error alert when error is empty', () => {
      expect(tester.errorAlert).toBeFalsy();
    });

    it('should show display mode dropdown when displayMode is set', () => {
      tester.componentInstance.response.set(mockJsonResponse);
      tester.componentInstance.displayMode.set('json');
      tester.detectChanges();

      expect(tester.viewDropdown).toBeTruthy();
    });

    it('should not show display mode dropdown before a test is run', () => {
      expect(tester.viewDropdown).toBeFalsy();
    });
  });
});
