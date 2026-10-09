import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CustomTransformerCommandDTO, TransformerTestResponse } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { TransformerTestComponent } from './transformer-test.component';

function buildResponse(output: string, contentFile: string, contentType: string): TransformerTestResponse {
  return {
    output,
    metadata: { contentType, contentFile, contentSize: 2048, createdAt: '2020-03-15T00:00:00.000Z', numberOfElement: 2 }
  };
}

class TransformerTestComponentTester {
  readonly fixture = TestBed.createComponent(TransformerTestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly runButton = this.root.getByRole('button', { name: 'Run Test' });
  readonly inputEditor = this.root.getByCss('#transformer-test-input-data .cm-content');
  readonly error = this.root.getByRole('alert').filter({ hasText: '400' });
  readonly success = this.root.getByText('Test completed successfully');
  readonly viewDropdown = this.root.getByCss('#view-dropdown');
  readonly outputEditor = this.root.getByCss('oib-code-block').nth(1).getByCss('.cm-content');
  readonly tableHeaders = this.root.getByCss('.grid-table-header > div');
  readonly tableRows = this.root.getByCss('.grid-table-row');
  readonly delimiter = this.root.getByLabelText('Delimiter');
  readonly pagination = this.root.getByCss('oib-pagination');

  constructor(transformer: CustomTransformerCommandDTO | null = testData.transformers.command) {
    this.fixture.componentRef.setInput('transformer', transformer);
  }

  viewMode(name: 'Raw view' | 'Table view' | 'JSON view') {
    return this.root.getByRole('button', { name, exact: true });
  }
}

describe('TransformerTestComponent', () => {
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[{"pointId":"p1"}]', description: '' }));
    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: TransformerService, useValue: transformerService },
        { provide: EngineService, useValue: engineService }
      ]
    });
  });

  test('should not be runnable without transformer', async () => {
    const tester = new TransformerTestComponentTester(null);

    await expect.element(tester.runButton).toBeDisabled();
    await expect.element(tester.inputEditor).not.toBeInTheDocument();
    expect(transformerService.getInputTemplate).not.toHaveBeenCalled();
  });

  test('should load the input template of the transformer input type', async () => {
    const tester = new TransformerTestComponentTester();

    await expect.element(tester.inputEditor).toHaveTextContent('[{"pointId":"p1"}]');
    expect(transformerService.getInputTemplate).toHaveBeenCalledWith('time-values');
    await expect.element(tester.runButton).toBeEnabled();
  });

  test('should only reload the input template when the input type changes', async () => {
    const tester = new TransformerTestComponentTester();
    await expect.element(tester.inputEditor).toHaveTextContent('[{"pointId":"p1"}]');

    tester.fixture.componentRef.setInput('transformer', { ...testData.transformers.command, name: 'renamed' });
    await tester.fixture.whenStable();
    expect(transformerService.getInputTemplate).toHaveBeenCalledTimes(1);

    tester.fixture.componentRef.setInput('transformer', { ...testData.transformers.command, inputType: 'any' });
    await tester.fixture.whenStable();
    expect(transformerService.getInputTemplate).toHaveBeenLastCalledWith('any');
  });

  test('should display an error when the input template cannot be loaded', async () => {
    transformerService.getInputTemplate.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new TransformerTestComponentTester();

    await expect.element(tester.root.getByText('Failed to load input template: boom')).toBeInTheDocument();
  });

  test('should disable the test when the input data is empty', async () => {
    const tester = new TransformerTestComponentTester();
    await expect.element(tester.runButton).toBeEnabled();

    await tester.inputEditor.fill('');

    await expect.element(tester.runButton).toBeDisabled();
  });

  test('should test the transformer and display a JSON response', async () => {
    transformerService.test.mockReturnValue(of(buildResponse('[{"a":1,"b":{"c":2}},{"a":3}]', 'output.json', 'json')));
    const tester = new TransformerTestComponentTester();
    await expect.element(tester.inputEditor).toHaveTextContent('[{"pointId":"p1"}]');

    await tester.runButton.click();

    expect(transformerService.test).toHaveBeenCalledWith(testData.transformers.command, { inputData: '[{"pointId":"p1"}]', options: {} });
    await expect.element(tester.success).toBeInTheDocument();
    await expect.element(tester.root.getByText(/output\.json/)).toBeInTheDocument();
    await expect.element(tester.root.getByText(/2\.0 kB/)).toBeInTheDocument();
    await expect.element(tester.root.getByText(/Number of elements:\s*2/)).toBeInTheDocument();
    await expect.element(tester.viewDropdown).toHaveTextContent('JSON view');
    // the JSON output is pretty printed
    await expect.element(tester.outputEditor).toMatchTextContent(/\[\s*\{\s*"a": 1/);

    await tester.viewDropdown.click();
    await tester.viewMode('Table view').click();
    await expect.element(tester.tableHeaders).toHaveLength(2);
    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(0)).toHaveTextContent('1{"c":2}');
    await expect.element(tester.delimiter).not.toBeInTheDocument();

    await tester.viewDropdown.click();
    await tester.viewMode('Raw view').click();
    await expect.element(tester.outputEditor).toHaveTextContent('[{"a":1,"b":{"c":2}},{"a":3}]');
  });

  test('should display a JSON array of values as a table', async () => {
    transformerService.test.mockReturnValue(of(buildResponse('[1,2,3]', 'output.json', 'json')));
    const tester = new TransformerTestComponentTester();
    await tester.runButton.click();

    await tester.viewDropdown.click();
    await tester.viewMode('Table view').click();

    await expect.element(tester.tableHeaders).toHaveTextContent('value');
    await expect.element(tester.tableRows).toHaveLength(3);
  });

  test('should display a raw response', async () => {
    transformerService.test.mockReturnValue(of(buildResponse('not json', 'output.txt', 'any')));
    const tester = new TransformerTestComponentTester();

    await tester.runButton.click();

    await expect.element(tester.viewDropdown).toHaveTextContent('Raw view');
    await expect.element(tester.outputEditor).toHaveTextContent('not json');
    await expect.element(tester.root.getByText(/Number of elements/)).not.toBeInTheDocument();
    await tester.viewDropdown.click();
    await expect.element(tester.viewMode('Table view')).not.toBeInTheDocument();
  });

  test('should display a CSV response as a paginated table with a configurable delimiter', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => `value${index};${index}`);
    transformerService.test.mockReturnValue(of(buildResponse(['name;value', ...rows].join('\n'), 'output.csv', 'any')));
    const tester = new TransformerTestComponentTester();
    await tester.runButton.click();
    await expect.element(tester.viewDropdown).toHaveTextContent('Raw view');

    await tester.viewDropdown.click();
    await tester.viewMode('Table view').click();

    // comma delimiter by default
    await expect.element(tester.tableHeaders).toHaveLength(1);
    await tester.delimiter.selectOptions(';');
    await expect.element(tester.tableHeaders).toHaveLength(2);
    await expect.element(tester.tableRows).toHaveLength(10);
    await expect.element(tester.tableRows.nth(0)).toHaveTextContent('value00');

    await tester.pagination.getByRole('link', { name: '2' }).click();
    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(0)).toHaveTextContent('value1010');
  });

  test('should display the error of a failed test', async () => {
    transformerService.test.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: { message: 'invalid code' } }))
    );
    const tester = new TransformerTestComponentTester();

    await tester.runButton.click();

    await expect.element(tester.error).toMatchTextContent(/400 - .* - invalid code/);
    await expect.element(tester.success).not.toBeInTheDocument();
    await expect.element(tester.runButton).toBeEnabled();
  });
});
