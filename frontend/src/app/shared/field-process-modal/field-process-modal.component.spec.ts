import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { FieldOperation, RecordFieldValue } from '@oibus/shared/connector/field-process.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { TransformerService } from '../../services/transformer.service';
import { DefaultValidationErrorsComponent } from '../default-validation-errors/default-validation-errors.component';
import { FieldProcessModalComponent } from './field-process-modal.component';

class FieldProcessModalComponentTester {
  readonly fixture = TestBed.createComponent(FieldProcessModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly operations = this.root.getByCss('.field-operation');
  readonly operationTypes = this.root.getByCss('.field-operation .operation-type');
  readonly noOperation = this.root.getByCss('#field-operations-none');
  readonly newOperationType = this.root.getByLabelText('Operation to add');
  readonly addButton = this.root.getByRole('button', { name: 'Add', exact: true });
  readonly testButton = this.root.getByRole('button', { name: 'Test' });
  readonly testError = this.root.getByCss('#field-process-test-error');
  readonly testValues = this.root.getByCss('#field-process-test-values tbody tr');
  readonly addValueButton = this.root.getByRole('button', { name: 'Add a value' });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor(operations: Array<FieldOperation> = [], values: Array<RecordFieldValue> = ['Reactor/Temperature', 'Reactor/Pressure']) {
    this.fixture.componentInstance.initialize('path', operations, values);
  }

  operation(index: number) {
    return this.operations.nth(index);
  }

  testValue(index: number) {
    return this.testValues.nth(index).getByCss('.test-value');
  }

  testResult(index: number) {
    return this.testValues.nth(index).getByCss('.test-result');
  }

  async addOperation(type: string) {
    await this.newOperationType.selectOptions(type);
    await this.addButton.click();
  }
}

describe('FieldProcessModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    transformerService = createMock(TransformerService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: TransformerService, useValue: transformerService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should show the operations of the field, with their settings', async () => {
    const tester = new FieldProcessModalComponentTester([
      { type: 'lowercase' },
      { type: 'substring', start: 8, end: null },
      { type: 'add-to-string', prefix: 'plant1.', suffix: '' }
    ]);

    await expect.element(tester.title).toHaveTextContent('Processing of the field path');
    await expect.element(tester.operationTypes).toHaveLength(3);
    await expect.element(tester.operationTypes.nth(0)).toHaveTextContent('Lower case');
    await expect.element(tester.operation(1).getByLabelText('Start')).toHaveValue(8);
    await expect.element(tester.operation(1).getByLabelText('End')).toHaveValue(null);
    await expect.element(tester.operation(2).getByLabelText('Prefix')).toHaveValue('plant1.');
  });

  test('should save the operations as they are set up, in order', async () => {
    const tester = new FieldProcessModalComponentTester([{ type: 'trim' }]);

    await tester.addOperation('Number operation');
    await tester.operation(1).getByLabelText('Operation').selectOptions('Divide by');
    await tester.operation(1).getByLabelText('Operand').fill('10');
    await tester.addOperation('Round');
    await tester.operation(2).getByLabelText('Decimals').fill('1');
    await tester.addOperation('Replace text');
    await tester.operation(3).getByLabelText('Text to replace').fill('.');
    await tester.operation(3).getByLabelText('Replacement').fill(',');
    await tester.addOperation('Expression');
    await tester.operation(4).getByLabelText('Expression').fill("value + ' bar'");
    // the trim goes down and back up, then last
    await tester.operation(0).getByRole('button', { name: 'Move down' }).click();
    await tester.operation(1).getByRole('button', { name: 'Move up' }).click();
    await expect.element(tester.operation(0).getByRole('button', { name: 'Move up' })).toBeDisabled();
    await tester.operation(0).getByRole('button', { name: 'Move down' }).click();
    await tester.operation(1).getByRole('button', { name: 'Move down' }).click();
    await tester.operation(2).getByRole('button', { name: 'Move down' }).click();
    await tester.operation(3).getByRole('button', { name: 'Move down' }).click();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith([
      { type: 'number-operation', operator: 'divide', operand: 10 },
      { type: 'round', decimals: 1 },
      { type: 'replace', search: '.', replacement: ',' },
      { type: 'expression', expression: "value + ' bar'" },
      { type: 'trim' }
    ]);
  });

  test('should convert values to another type', async () => {
    const tester = new FieldProcessModalComponentTester([{ type: 'convert', to: 'boolean' }]);
    await expect.element(tester.operation(0).getByLabelText('To')).toHaveDisplayValue('Boolean');

    await tester.addOperation('Convert');
    await tester.operation(1).getByLabelText('To').selectOptions('JSON (object or array)');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith([
      { type: 'convert', to: 'boolean' },
      { type: 'convert', to: 'json' }
    ]);
  });

  test('should convert date times, with the format, timezone and locale of a string only', async () => {
    const tester = new FieldProcessModalComponentTester([]);

    await tester.addOperation('Date time conversion');
    await expect.element(tester.operation(0).getByLabelText('Input format')).not.toBeInTheDocument();
    await tester.operation(0).getByLabelText('Input type').selectOptions('Unix epoch (ms)');
    await tester.operation(0).getByLabelText('Output type').selectOptions('String');
    await tester.operation(0).getByLabelText('Output format').fill('yyyy-MM-dd');
    await expect.element(tester.operation(0).getByLabelText('Precision')).toHaveDisplayValue('Unchanged');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith([
      {
        type: 'datetime',
        inputType: 'unix-epoch-ms',
        outputType: 'string',
        outputFormat: 'yyyy-MM-dd',
        outputTimezone: 'UTC',
        outputLocale: 'en-En'
      }
    ]);
  });

  test('should round a date time down to a precision', async () => {
    const tester = new FieldProcessModalComponentTester([
      { type: 'datetime', inputType: 'iso-string', outputType: 'iso-string', precision: 'hr' }
    ]);
    await expect.element(tester.operation(0).getByLabelText('Precision')).toHaveDisplayValue('Hour');

    await tester.operation(0).getByLabelText('Precision').selectOptions('Minute');
    await tester.addOperation('Date time conversion');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith([
      { type: 'datetime', inputType: 'iso-string', outputType: 'iso-string', precision: 'min' },
      { type: 'datetime', inputType: 'iso-string', outputType: 'iso-string' }
    ]);
  });

  test('should not save an operation missing a setting', async () => {
    const tester = new FieldProcessModalComponentTester([]);

    await tester.addOperation('Number operation');
    await tester.saveButton.click();

    await expect.element(tester.operation(0).getByText('This field is required')).toBeInTheDocument();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should remove operations, saving none to stop processing the field', async () => {
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }]);

    await tester.operation(0).getByRole('button', { name: 'Delete' }).click();
    await expect.element(tester.noOperation).toBeInTheDocument();
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith([]);
  });

  test('should test the operations on the first values of the field, telling why one fails', async () => {
    transformerService.testFieldProcess.mockReturnValue(
      of([
        { value: 'Reactor/Temperature', result: 'Temperature', error: null },
        { value: 'Reactor/Pressure', result: null, error: 'something went wrong' }
      ])
    );
    const tester = new FieldProcessModalComponentTester([{ type: 'substring', start: 8, end: null }]);
    await expect.element(tester.testValue(0)).toHaveValue('Reactor/Temperature');

    await tester.testButton.click();

    expect(transformerService.testFieldProcess).toHaveBeenCalledWith({
      operations: [{ type: 'substring', start: 8, end: null }],
      values: ['Reactor/Temperature', 'Reactor/Pressure']
    });
    await expect.element(tester.testResult(0)).toHaveTextContent('Temperature');
    await expect.element(tester.testResult(1)).toHaveClass('text-danger');
    await expect.element(tester.testResult(1)).toHaveTextContent('something went wrong');

    // the results are of the operations tested
    await tester.addOperation('Upper case');
    await expect.element(tester.testResult(0)).toBeEmptyDOMElement();
  });

  test('should test values changed, added or removed', async () => {
    transformerService.testFieldProcess.mockReturnValue(of([]));
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }], ['a', 12, 'c']);

    await tester.testValue(0).fill('b');
    await tester.testValues.nth(2).getByRole('button', { name: 'Remove the value' }).click();
    await tester.addValueButton.click();
    await tester.testValue(2).fill('d');
    await tester.testButton.click();

    expect(transformerService.testFieldProcess).toHaveBeenCalledWith({ operations: [{ type: 'uppercase' }], values: ['b', 12, 'd'] });
  });

  test('should show why a test failed', async () => {
    transformerService.testFieldProcess.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Invalid operations' } }))
    );
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }]);

    await tester.testButton.click();

    await expect.element(tester.testError).toHaveTextContent('Invalid operations');
  });

  test('should not test without any value of the field', async () => {
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }], []);

    await expect.element(tester.root.getByText('No value of the field yet: add some to test the operations')).toBeInTheDocument();
    await expect.element(tester.testButton).toBeDisabled();
    await tester.addValueButton.click();
    await expect.element(tester.testButton).toBeEnabled();
  });

  test('should cancel', async () => {
    const tester = new FieldProcessModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
