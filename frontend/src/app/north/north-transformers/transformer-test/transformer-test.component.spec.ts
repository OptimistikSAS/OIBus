import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorItemTestResult } from '@oibus/shared/api/south-connector.model';
import { StandardTransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../../services/history-query.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { NorthTransformerTestComponent, TransformerTestItemSource } from './transformer-test.component';

const transformer: StandardTransformerDTO = {
  id: 'transformer-1',
  type: 'standard',
  functionName: 'record-list-to-file',
  inputType: 'record-list',
  outputType: 'file',
  manifest: {
    type: 'object',
    key: 'options',
    translationKey: '',
    attributes: [],
    enablingConditions: [],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
};

const testResult: SouthConnectorItemTestResult = {
  raw: { type: 'file', content: 'raw-input' },
  transformed: { type: 'file', content: 'pasted-output' },
  connectionDuration: 12,
  queryDuration: 34
};

class NorthTransformerTestComponentTester {
  readonly fixture = TestBed.createComponent(NorthTransformerTestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { name: 'Testing transformer' });
  readonly runButton = this.root.getByCss('#run-transformer-test');
  readonly inputToggle = this.root.getByRole('group', { name: 'Input' });
  readonly fromItemButton = this.root.getByRole('button', { name: 'From a source item' });
  readonly itemSearch = this.root.getByLabelText('Item', { exact: true });
  readonly suggestions = page.getByCss('ngb-typeahead-window').getByRole('option');
  readonly editor = this.root.getByCss('#transformer-test-input-data .cm-content');
  readonly info = this.root.getByCss('.alert-primary');
  readonly error = this.root.getByCss('.alert-danger');
  readonly outdated = this.root.getByCss('#outdated-result');
  readonly runAgainButton = this.root.getByRole('button', { name: 'Run again' });
  readonly durations = this.root.getByCss('#test-durations');
  readonly result = this.root.getByCss('oib-transformer-test-result');
  readonly summaryChip = this.root.getByCss('#expand-settings');
  readonly hideSettingsButton = this.root.getByCss('#hide-settings');
  readonly dateRangeSelector = this.root.getByCss('oib-date-range-selector');

  constructor(itemSource: TransformerTestItemSource = { kind: 'none' }, transformerInput: StandardTransformerDTO | null = transformer) {
    this.fixture.componentRef.setInput('transformer', transformerInput);
    this.fixture.componentRef.setInput('options', { precision: 2 });
    this.fixture.componentRef.setInput('itemSource', itemSource);
  }

  /** Searches an item of the source and picks it among the suggestions */
  async selectItem(name: string) {
    await this.itemSearch.fill(name);
    await this.suggestions.filter({ hasText: name }).first().click();
    await expect.element(this.itemSearch).toHaveValue(name);
  }
}

describe('NorthTransformerTestComponent', () => {
  let transformerService: MockObject<TransformerService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    transformerService.getInputTemplate.mockReturnValue(of({ type: 'record-list', data: '[]', description: '' }));
    transformerService.testTransformer.mockReturnValue(of(testResult));
    southConnectorService.getSouthManifest.mockReturnValue(
      of({ ...testData.south.manifest, modes: { ...testData.south.manifest.modes, history: false } })
    );
    southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));
    southConnectorService.testItem.mockReturnValue(of(testResult));
    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0]));
    historyQueryService.testItem.mockReturnValue(of(testResult));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  test('should display nothing without transformer', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'none' }, null);

    await expect.element(tester.runButton).not.toBeInTheDocument();
    expect(transformerService.getInputTemplate).not.toHaveBeenCalled();
  });

  test('should prefill the paste input from the transformer template and offer only the paste source', async () => {
    const tester = new NorthTransformerTestComponentTester();

    await expect.element(tester.title).toBeInTheDocument();
    await expect.element(tester.editor).toHaveTextContent('[]');
    expect(transformerService.getInputTemplate).toHaveBeenCalledWith('record-list');
    await expect.element(tester.inputToggle).not.toBeInTheDocument();
    await expect.element(tester.runButton).toHaveTextContent('Run test');
    await expect.element(tester.info).toHaveTextContent('Test results will appear here');
    expect(southConnectorService.getSouthManifest).not.toHaveBeenCalled();
  });

  test('should run the transformer with pasted input and its options, and collapse the settings on demand', async () => {
    const tester = new NorthTransformerTestComponentTester();
    await expect.element(tester.editor).toHaveTextContent('[]');
    await tester.editor.fill('[{"pointId":"p"}]');

    await tester.runButton.click();

    expect(transformerService.testTransformer).toHaveBeenCalledWith('transformer-1', {
      inputData: '[{"pointId":"p"}]',
      options: { precision: 2 }
    });
    await expect.element(tester.result).toBeInTheDocument();
    // the button joins the result, next to the choice of the panes
    await expect.element(tester.result.getByCss('#run-transformer-test')).toHaveTextContent('Run test');
    await expect.element(tester.info).not.toBeInTheDocument();
    // pasted data is not queried from a source
    await expect.element(tester.durations).not.toBeInTheDocument();
    await expect.element(tester.editor).toBeVisible();

    await tester.hideSettingsButton.click();
    await expect.element(tester.summaryChip).toHaveTextContent('Paste data');
    await expect.element(tester.editor).not.toBeVisible();

    await tester.summaryChip.click();
    await expect.element(tester.summaryChip).not.toBeInTheDocument();
    await expect.element(tester.editor).toBeVisible();
  });

  test('should flag the result as outdated when the input or the options change, and run it again', async () => {
    const tester = new NorthTransformerTestComponentTester();
    await expect.element(tester.editor).toHaveTextContent('[]');
    await tester.runButton.click();
    await expect.element(tester.result).toBeInTheDocument();
    await expect.element(tester.outdated).not.toBeInTheDocument();

    await tester.editor.fill('[{"pointId":"q"}]');
    await expect.element(tester.outdated).toMatchTextContent('The transformer options or the input changed since this test ran');

    await tester.runAgainButton.click();
    expect(transformerService.testTransformer).toHaveBeenLastCalledWith('transformer-1', {
      inputData: '[{"pointId":"q"}]',
      options: { precision: 2 }
    });
    await expect.element(tester.outdated).not.toBeInTheDocument();

    tester.fixture.componentRef.setInput('options', { precision: 3 });
    await expect.element(tester.outdated).toBeInTheDocument();
  });

  test('should display the error of a failed test', async () => {
    transformerService.testTransformer.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: { message: 'invalid input' } }))
    );
    const tester = new NorthTransformerTestComponentTester();

    await tester.runButton.click();

    await expect.element(tester.error).toMatchTextContent(/^400 - .* - invalid input$/);
    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.runButton).toBeEnabled();
    await expect.element(tester.summaryChip).not.toBeInTheDocument();
  });

  test('should cancel a running test', async () => {
    const result$ = new Subject<SouthConnectorItemTestResult>();
    transformerService.testTransformer.mockReturnValue(result$);
    const tester = new NorthTransformerTestComponentTester();

    await tester.runButton.click();
    await expect.element(tester.runButton).toHaveTextContent('Cancel');

    await tester.runButton.click();

    await expect.element(tester.runButton).toHaveTextContent('Run test');
    expect(result$.observed).toBe(false);
    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.info).toHaveTextContent('Test cancelled');
  });

  test('should keep the run button when a test run again over a result is cancelled', async () => {
    const tester = new NorthTransformerTestComponentTester();
    await tester.runButton.click();
    await expect.element(tester.result).toBeInTheDocument();
    const result$ = new Subject<SouthConnectorItemTestResult>();
    transformerService.testTransformer.mockReturnValue(result$);

    await tester.runButton.click();
    await expect.element(tester.runButton).toHaveTextContent('Cancel');
    await tester.runButton.click();

    await expect.element(tester.info).toHaveTextContent('Test cancelled');
    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.runButton).toHaveTextContent('Run test');
  });

  test('should run an item of the source by default, the pasted data being the other choice', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await expect.element(tester.inputToggle.getByRole('button').nth(0)).toHaveTextContent('From a source item');
    await expect.element(tester.fromItemButton).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.itemSearch).toBeVisible();
    await expect.element(tester.editor).not.toBeInTheDocument();

    await tester.inputToggle.getByRole('button', { name: 'Paste data' }).click();
    await expect.element(tester.editor).toBeVisible();
    await expect.element(tester.itemSearch).not.toBeInTheDocument();
  });

  test('should load the source south items and run the selected item through the transformer', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.fromItemButton.click();
    await expect.element(tester.dateRangeSelector).not.toBeInTheDocument();
    await expect.element(tester.editor).not.toBeInTheDocument();
    await tester.selectItem('item2');
    await tester.runButton.click();

    expect(southConnectorService.findById).toHaveBeenCalledWith('southId1');
    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'southId1',
      'folder-scanner',
      'item2',
      testData.south.list[0].settings,
      testData.south.list[0].items[1].settings,
      { history: undefined, transformer: { transformerId: 'transformer-1', options: { precision: 2 } } }
    );
    await expect.element(tester.durations).toHaveTextContent('Connection: 12 ms · Query: 34 ms');
    await tester.hideSettingsButton.click();
    await expect.element(tester.summaryChip).toHaveTextContent('item2');

    // another item
    await tester.summaryChip.click();
    await tester.selectItem('item1');
    await expect.element(tester.outdated).toBeInTheDocument();
  });

  test('should not run an item test without selected item', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.fromItemButton.click();
    await tester.runButton.click();

    expect(southConnectorService.testItem).not.toHaveBeenCalled();
    await expect.element(tester.runButton).toBeEnabled();
  });

  test('should send a history range when the source supports history', async () => {
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.fromItemButton.click();
    await expect.element(tester.dateRangeSelector).toBeInTheDocument();
    await tester.selectItem('item1');
    await tester.runButton.click();

    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'southId1',
      'folder-scanner',
      'item1',
      testData.south.list[0].settings,
      testData.south.list[0].items[0].settings,
      {
        history: { startTime: expect.any(String), endTime: expect.any(String) },
        transformer: { transformerId: 'transformer-1', options: { precision: 2 } }
      }
    );
    // item label and range label
    await tester.hideSettingsButton.click();
    await expect.element(tester.summaryChip).toMatchTextContent(/item1 · .+/);
  });

  test('should offer only the history query items for a history source', async () => {
    const historyQuery = testData.historyQueries.list[0];
    const tester = new NorthTransformerTestComponentTester({ kind: 'history', id: 'historyId1', southType: 'mssql' });

    await tester.fromItemButton.click();
    // the search lists the items of the history query when it opens
    await tester.itemSearch.click();
    await expect.element(tester.suggestions).toHaveLength(historyQuery.items.length);
    await tester.selectItem(historyQuery.items[0].name);
    await tester.runButton.click();

    expect(southConnectorService.findById).not.toHaveBeenCalled();
    expect(historyQueryService.testItem).toHaveBeenCalledWith(
      'historyId1',
      null,
      'mssql',
      historyQuery.items[0].name,
      historyQuery.southSettings,
      historyQuery.items[0].settings,
      expect.objectContaining({ transformer: { transformerId: 'transformer-1', options: { precision: 2 } } })
    );
  });

  test('should reset the result when the transformer changes', async () => {
    const tester = new NorthTransformerTestComponentTester();
    await tester.runButton.click();
    await expect.element(tester.result).toBeInTheDocument();

    tester.fixture.componentRef.setInput('transformer', { ...transformer, id: 'transformer-2', inputType: 'file' });

    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.summaryChip).not.toBeInTheDocument();
    await expect.element(tester.info).toHaveTextContent('Test results will appear here');
    expect(transformerService.getInputTemplate).toHaveBeenLastCalledWith('file');
  });
});
