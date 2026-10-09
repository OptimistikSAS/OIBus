import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { SouthConnectorItemTestResult } from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '@oibus/shared/api/transformer.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import SouthItemTestComponent from './south-item-test.component';

const connectorCommand = testData.south.command;
const item = testData.south.itemCommand;
const manifest = testData.south.manifest;
const manifestWithoutHistory: SouthConnectorManifest = { ...manifest, modes: { ...manifest.modes, history: false } };

// a transformer with one option, "name"
const transformer: TransformerDTO = {
  ...testData.north.list[0].transformers[0].transformer,
  manifest: { ...testData.north.list[0].transformers[0].transformer.manifest, attributes: [manifest.items.rootAttribute.attributes[0]] }
};
const north: NorthConnectorDTO = {
  ...testData.north.list[0],
  transformers: [{ ...testData.north.list[0].transformers[0], transformer, options: { name: 'configured' } }]
};
const historyTransformer: HistoryTransformerDTOWithOptions = {
  ...testData.historyQueries.list[0].northTransformers[0],
  transformer,
  options: { name: 'history' }
};

const testResult: SouthConnectorItemTestResult = {
  raw: { type: 'time-values', content: [] },
  transformed: null,
  connectionDuration: 12,
  queryDuration: 34
};

interface TesterOptions {
  type?: 'south' | 'history-south';
  entityId?: string;
  manifest?: SouthConnectorManifest;
  inMemoryTransformers?: Array<HistoryTransformerDTOWithOptions> | null;
}

class SouthItemTestComponentTester {
  readonly fixture = TestBed.createComponent(SouthItemTestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly testButton = this.root.getByRole('button', { name: 'Run test' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly dateRange = this.root.getByCss('oib-date-range-selector');
  readonly northSelect = this.root.getByLabelText('North');
  readonly transformerSelect = this.root.getByLabelText('Transformer', { exact: true });
  readonly pipelineTransformer = this.root.getByCss('.pipeline-transformer');
  readonly editOptionsButton = this.root.getByRole('button', { name: 'Edit options' });
  readonly optionsSummary = this.root.getByCss('.pipeline-options');
  readonly info = this.root.getByCss('.alert-primary');
  readonly error = this.root.getByCss('.alert-danger');
  readonly durations = this.root.getByText(/Connection: \d+ ms/);
  readonly result = this.root.getByCss('oib-transformer-test-result');
  readonly hideSettingsButton = this.root.getByRole('button', { name: 'Hide settings' });
  readonly settingsSummary = this.root.getByCss('#expand-settings');

  constructor(options: TesterOptions = {}) {
    this.fixture.componentRef.setInput('type', options.type ?? 'south');
    this.fixture.componentRef.setInput('entityId', options.entityId ?? 'southId1');
    this.fixture.componentRef.setInput('fromSouth', 'southId2');
    this.fixture.componentRef.setInput('item', item);
    this.fixture.componentRef.setInput('connectorCommand', connectorCommand);
    this.fixture.componentRef.setInput('manifest', options.manifest ?? manifestWithoutHistory);
    this.fixture.componentRef.setInput('inMemoryTransformers', options.inMemoryTransformers ?? null);
  }
}

describe('SouthItemTestComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    southConnectorService.testItem.mockReturnValue(of(testResult));
    historyQueryService.testItem.mockReturnValue(of(testResult));
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.findById.mockReturnValue(of(north));
    historyQueryService.findById.mockReturnValue(of({ ...testData.historyQueries.list[0], northTransformers: [historyTransformer] }));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: EngineService, useValue: engineService }
      ]
    });
  });

  test('should display the initial state in a south context', async () => {
    const tester = new SouthItemTestComponentTester();

    await expect.element(tester.info).toHaveTextContent('Test results will appear here');
    await expect.element(tester.northSelect).toHaveDisplayValue('Raw (no transformer)');
    await expect.element(tester.northSelect.getByRole('option')).toHaveLength(1 + testData.north.listLight.length);
    await expect.element(tester.transformerSelect).not.toBeInTheDocument();
    await expect.element(tester.dateRange).not.toBeInTheDocument();
    await expect.element(tester.cancelButton).toBeDisabled();
  });

  test('should not load the norths of a connector being created', async () => {
    const tester = new SouthItemTestComponentTester({ entityId: 'create' });

    await expect.element(tester.northSelect.getByRole('option')).toHaveLength(1);
    expect(northConnectorService.list).not.toHaveBeenCalled();
  });

  test('should select a north and one of its transformers, and edit its options', async () => {
    const tester = new SouthItemTestComponentTester();

    await tester.northSelect.selectOptions('North 1');
    expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
    await tester.transformerSelect.selectOptions('my transformer 1');

    await expect.element(tester.pipelineTransformer).toMatchTextContent('North 1 · my transformer 1');
    await expect.element(tester.optionsSummary).toHaveTextContent('name: configured');

    await tester.editOptionsButton.click();
    await expect.element(tester.optionsSummary).not.toBeInTheDocument();
    await tester.root.getByRole('textbox', { name: 'Name' }).fill('edited');

    await tester.testButton.click();

    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'southId1',
      connectorCommand.type,
      item.name,
      connectorCommand.settings,
      item.settings,
      { history: undefined, transformer: { transformerId: 'transformerId1', options: { name: 'edited' } } }
    );
    // running a test leaves the options edit mode
    await expect.element(tester.optionsSummary).toHaveTextContent('name: edited');
  });

  test('should reset the transformer when another north is selected', async () => {
    const tester = new SouthItemTestComponentTester();
    await tester.northSelect.selectOptions('North 1');
    await tester.transformerSelect.selectOptions('my transformer 1');
    await expect.element(tester.pipelineTransformer).toBeVisible();

    await tester.northSelect.selectOptions('Raw (no transformer)');

    await expect.element(tester.transformerSelect).not.toBeInTheDocument();
    await expect.element(tester.pipelineTransformer).not.toBeInTheDocument();
  });

  test('should run the test and display the result', async () => {
    const tester = new SouthItemTestComponentTester({ manifest });
    await expect.element(tester.dateRange).toBeVisible();

    await tester.testButton.click();

    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'southId1',
      connectorCommand.type,
      item.name,
      connectorCommand.settings,
      item.settings,
      { history: { startTime: expect.any(String), endTime: expect.any(String) }, transformer: undefined }
    );
    await expect.element(tester.durations).toHaveTextContent('Connection: 12 ms · Query: 34 ms');
    await expect.element(tester.result).toBeVisible();
    await expect.element(tester.info).not.toBeInTheDocument();
  });

  test('should collapse the settings into a summary once there is a result', async () => {
    const tester = new SouthItemTestComponentTester({ manifest });
    await expect.element(tester.hideSettingsButton).not.toBeInTheDocument();
    await tester.testButton.click();

    await tester.hideSettingsButton.click();

    await expect.element(tester.settingsSummary).toHaveTextContent('Last 10 minutes · Raw (no transformer)');
    await expect.element(tester.northSelect).not.toBeVisible();

    await tester.settingsSummary.click();
    await expect.element(tester.northSelect).toBeVisible();
    await expect.element(tester.settingsSummary).not.toBeInTheDocument();
  });

  test('should display the error of a failed test', async () => {
    southConnectorService.testItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: { message: 'boom' } }))
    );
    const tester = new SouthItemTestComponentTester();

    await tester.testButton.click();

    await expect.element(tester.error).toMatchTextContent(/^400 - .* - boom$/);
    await expect.element(tester.result).not.toBeInTheDocument();
    await expect.element(tester.testButton).toBeEnabled();
  });

  test('should cancel a running test', async () => {
    const result$ = new Subject<SouthConnectorItemTestResult>();
    southConnectorService.testItem.mockReturnValue(result$);
    const tester = new SouthItemTestComponentTester();

    await tester.testButton.click();
    await expect.element(tester.testButton).toBeDisabled();
    await expect.element(tester.info).not.toBeInTheDocument();

    await tester.cancelButton.click();

    await expect.element(tester.info).toHaveTextContent('Test cancelled');
    await expect.element(tester.testButton).toBeEnabled();
    await expect.element(tester.cancelButton).toBeDisabled();
    expect(result$.observed).toBe(false);
  });

  test('should offer the history query transformers in a history context', async () => {
    const tester = new SouthItemTestComponentTester({ type: 'history-south', entityId: 'historyId1' });

    await expect.element(tester.northSelect).not.toBeInTheDocument();
    await tester.transformerSelect.selectOptions('my transformer 1');
    await tester.testButton.click();

    expect(historyQueryService.findById).toHaveBeenCalledWith('historyId1');
    expect(northConnectorService.list).not.toHaveBeenCalled();
    expect(historyQueryService.testItem).toHaveBeenCalledWith(
      'historyId1',
      'southId2',
      connectorCommand.type,
      item.name,
      connectorCommand.settings,
      item.settings,
      { history: undefined, transformer: { transformerId: 'transformerId1', options: { name: 'history' } } }
    );
    await expect.element(tester.pipelineTransformer).toMatchTextContent(/^\s*my transformer 1/);
  });

  test('should use the in-memory transformer list in a history context instead of fetching', async () => {
    const tester = new SouthItemTestComponentTester({
      type: 'history-south',
      entityId: 'create',
      inMemoryTransformers: [{ ...historyTransformer, options: { name: 'in memory' } }]
    });

    await tester.transformerSelect.selectOptions('my transformer 1');

    await expect.element(tester.optionsSummary).toHaveTextContent('name: in memory');
    expect(historyQueryService.findById).not.toHaveBeenCalled();
  });

  test('should offer no transformer for a history query being created without in-memory transformers', async () => {
    const tester = new SouthItemTestComponentTester({ type: 'history-south', entityId: 'create' });

    await expect.element(tester.transformerSelect.getByRole('option')).toHaveLength(1);
    expect(historyQueryService.findById).not.toHaveBeenCalled();
  });
});
