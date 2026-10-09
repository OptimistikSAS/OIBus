import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorItemDTO, SouthConnectorItemTestResult } from '@oibus/shared/api/south-connector.model';
import { StandardTransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../../services/history-query.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { toPage } from '../../../shared/utils/page.utils';
import { NorthTransformerTestComponent, TransformerTestItemSource } from './transformer-test.component';

const transformer: StandardTransformerDTO = {
  id: 'transformer-1',
  type: 'standard',
  functionName: 'time-values-to-json',
  inputType: 'time-values',
  outputType: 'any',
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
  raw: { type: 'any-content', content: 'raw-input' },
  transformed: { type: 'any-content', content: 'pasted-output' },
  connectionDuration: 0,
  queryDuration: 0
};

class NorthTransformerTestComponentTester {
  readonly fixture = TestBed.createComponent(NorthTransformerTestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly runButton = this.root.getByRole('button', { name: 'Run test' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly pasteRadio = this.root.getByLabelText('Paste data');
  readonly itemRadio = this.root.getByLabelText('From a source item');
  readonly itemSelect = this.root.getByLabelText('Item', { exact: true });
  readonly editor = this.root.getByCss('.cm-content');
  readonly error = this.root.getByCss('.alert-danger');
  readonly result = this.root.getByCss('oib-transformer-test-result');
  readonly summaryChip = this.root.getByCss('#expand-settings');
  readonly hideSettingsButton = this.root.getByCss('#hide-settings');
  readonly dateRangeSelector = this.root.getByCss('oib-date-range-selector');

  constructor(itemSource: TransformerTestItemSource = { kind: 'none' }, transformerInput: StandardTransformerDTO | null = transformer) {
    this.fixture.componentRef.setInput('transformer', transformerInput);
    this.fixture.componentRef.setInput('options', { precision: 2 });
    this.fixture.componentRef.setInput('itemSource', itemSource);
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

    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    transformerService.testTransformer.mockReturnValue(of(testResult));
    southConnectorService.getSouthManifest.mockReturnValue(
      of({ ...testData.south.manifest, modes: { ...testData.south.manifest.modes, history: false } })
    );
    southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));
    southConnectorService.searchItems.mockReturnValue(of(toPage<SouthConnectorItemDTO>(testData.south.list[0].items)));
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

    await expect.element(tester.editor).toHaveTextContent('[]');
    expect(transformerService.getInputTemplate).toHaveBeenCalledWith('time-values');
    await expect.element(tester.pasteRadio).toBeChecked();
    await expect.element(tester.itemRadio).not.toBeInTheDocument();
    await expect.element(tester.cancelButton).toBeDisabled();
    expect(southConnectorService.getSouthManifest).not.toHaveBeenCalled();
  });

  test('should run the transformer with pasted input and its options, then collapse the settings', async () => {
    const tester = new NorthTransformerTestComponentTester();
    await expect.element(tester.editor).toHaveTextContent('[]');
    await tester.editor.fill('[{"pointId":"p"}]');

    await tester.runButton.click();

    expect(transformerService.testTransformer).toHaveBeenCalledWith('transformer-1', {
      inputData: '[{"pointId":"p"}]',
      options: { precision: 2 }
    });
    await expect.element(tester.result).toBeInTheDocument();
    await expect.element(tester.summaryChip).toHaveTextContent('Paste data');
    await expect.element(tester.pasteRadio).not.toBeVisible();

    await tester.summaryChip.click();
    await expect.element(tester.summaryChip).not.toBeInTheDocument();
    await expect.element(tester.pasteRadio).toBeVisible();

    await tester.hideSettingsButton.click();
    await expect.element(tester.summaryChip).toBeInTheDocument();
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
    await expect.element(tester.runButton).toBeDisabled();

    await tester.cancelButton.click();

    await expect.element(tester.runButton).toBeEnabled();
    expect(result$.observed).toBe(false);
    await expect.element(tester.result).not.toBeInTheDocument();
  });

  test('should load the source south items and run the selected item through the transformer', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.itemRadio.click();
    await expect.element(tester.dateRangeSelector).not.toBeInTheDocument();
    await tester.itemSelect.selectOptions('item2');
    await tester.runButton.click();

    expect(southConnectorService.searchItems).toHaveBeenCalledWith('southId1', { page: 0 });
    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'southId1',
      'folder-scanner',
      'item2',
      testData.south.list[0].settings,
      testData.south.list[0].items[1].settings,
      { history: undefined, transformer: { transformerId: 'transformer-1', options: { precision: 2 } } }
    );
    await expect.element(tester.summaryChip).toHaveTextContent('item2');
  });

  test('should not run an item test without selected item', async () => {
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.itemRadio.click();
    await tester.runButton.click();

    expect(southConnectorService.testItem).not.toHaveBeenCalled();
    await expect.element(tester.runButton).toBeEnabled();
  });

  test('should send a history range when the source supports history', async () => {
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    const tester = new NorthTransformerTestComponentTester({ kind: 'south', id: 'southId1', southType: 'folder-scanner' });

    await tester.itemRadio.click();
    await expect.element(tester.dateRangeSelector).toBeInTheDocument();
    await tester.itemSelect.selectOptions('item1');
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
    await expect.element(tester.summaryChip).toMatchTextContent(/item1 · .+/);
  });

  test('should offer only the history query items for a history source', async () => {
    const historyQuery = testData.historyQueries.list[0];
    const tester = new NorthTransformerTestComponentTester({ kind: 'history', id: 'historyId1', southType: 'mssql' });

    await tester.itemRadio.click();
    await expect.element(tester.itemSelect.getByRole('option')).toHaveLength(historyQuery.items.length + 1);
    await tester.itemSelect.selectOptions(historyQuery.items[0].name);
    await tester.runButton.click();

    expect(southConnectorService.searchItems).not.toHaveBeenCalled();
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

    tester.fixture.componentRef.setInput('transformer', { ...transformer, id: 'transformer-2', inputType: 'any' });

    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.summaryChip).not.toBeInTheDocument();
    expect(transformerService.getInputTemplate).toHaveBeenLastCalledWith('any');
  });
});
