import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { FieldOperation, RecordFieldValue } from '@oibus/shared/domain/configuration-workflow.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { FieldProcessModalComponent } from './field-process-modal.component';

class FieldProcessModalComponentTester {
  readonly fixture = TestBed.createComponent(FieldProcessModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly operations = this.root.getByCss('.field-operation');
  readonly operationTypes = this.root.getByCss('.field-operation .operation-type');
  readonly noOperation = this.root.getByCss('#field-operations-none');
  readonly newOperationType = this.root.getByLabelText('Operation to add');
  readonly addButton = this.root.getByRole('button', { name: 'Add' });
  readonly testButton = this.root.getByRole('button', { name: 'Test' });
  readonly noValue = this.root.getByCss('#field-process-no-value');
  readonly testError = this.root.getByCss('#field-process-test-error');
  readonly testResults = this.root.getByCss('#field-process-test-results tbody tr');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor(operations: Array<FieldOperation> = [], values: Array<RecordFieldValue> = ['Reactor/Temperature', 'Reactor/Pressure']) {
    this.fixture.componentInstance.initialize('southId1', 'path', operations, values);
  }

  operation(index: number) {
    return this.operations.nth(index);
  }

  async addOperation(type: string) {
    await this.newOperationType.selectOptions(type);
    await this.addButton.click();
  }
}

describe('FieldProcessModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService }
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

  test('should convert date times, with the format, timezone and locale of a string only', async () => {
    const tester = new FieldProcessModalComponentTester([]);

    await tester.addOperation('Date time conversion');
    await expect.element(tester.operation(0).getByLabelText('Input format')).not.toBeInTheDocument();
    await tester.operation(0).getByLabelText('Input type').selectOptions('Unix epoch (ms)');
    await tester.operation(0).getByLabelText('Output type').selectOptions('String');
    await tester.operation(0).getByLabelText('Output format').fill('yyyy-MM-dd');
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
    configurationWorkflowService.testFieldProcess.mockReturnValue(
      of([
        { value: 'Reactor/Temperature', result: 'Temperature', error: null },
        { value: 'Reactor/Pressure', result: null, error: 'something went wrong' }
      ])
    );
    const tester = new FieldProcessModalComponentTester([{ type: 'substring', start: 8, end: null }]);

    await tester.testButton.click();

    expect(configurationWorkflowService.testFieldProcess).toHaveBeenCalledWith('southId1', {
      operations: [{ type: 'substring', start: 8, end: null }],
      values: ['Reactor/Temperature', 'Reactor/Pressure']
    });
    await expect.element(tester.testResults).toHaveLength(2);
    await expect.element(tester.testResults.nth(0)).toMatchTextContent(/Reactor\/Temperature\s*Temperature/);
    await expect.element(tester.testResults.nth(1).getByCss('.text-danger')).toHaveTextContent('something went wrong');

    // the results are of the operations tested
    await tester.addOperation('Upper case');
    await expect.element(tester.testResults).not.toBeInTheDocument();
  });

  test('should show why a test failed', async () => {
    configurationWorkflowService.testFieldProcess.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Invalid operations' } }))
    );
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }]);

    await tester.testButton.click();

    await expect.element(tester.testError).toHaveTextContent('Invalid operations');
  });

  test('should not test without any value discovered for the field', async () => {
    const tester = new FieldProcessModalComponentTester([{ type: 'uppercase' }], []);

    await expect.element(tester.noValue).toHaveTextContent('No value discovered for this field yet: preview the records first');
    await expect.element(tester.testButton).toBeDisabled();
  });

  test('should cancel', async () => {
    const tester = new FieldProcessModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
