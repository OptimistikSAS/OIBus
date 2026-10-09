import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryDTO } from '@oibus/shared/api/history-query.model';
import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { StandardTransformerDTO, TransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SelectExistingTransformerComponent } from './select-existing-transformer.component';

const standardTransformer = (id: string, functionName: string, outputType: string): StandardTransformerDTO => ({
  id,
  type: 'standard',
  functionName,
  inputType: 'any',
  outputType,
  manifest: testData.transformers.customList[0].manifest
});

const compatibleTransformer = standardTransformer('transformer-ignore', 'ignore', 'any');
const incompatibleTransformer = standardTransformer('transformer-iso', 'iso', 'mqtt');
const customTransformer: TransformerDTO = testData.transformers.customList[0];

const northDetail: NorthConnectorDTO = {
  ...testData.north.list[0],
  transformers: [
    {
      id: 'north-transformer-1',
      source: { type: 'south', south: testData.south.listLight[0], items: [] },
      transformer: compatibleTransformer,
      options: { key: 'value' }
    },
    {
      id: 'north-transformer-2',
      source: { type: 'oibus-api', dataSourceId: 'data-source-1' },
      transformer: incompatibleTransformer,
      options: {}
    },
    { id: 'north-transformer-3', source: { type: 'oibus-api', dataSourceId: 'data-source-1' }, transformer: customTransformer, options: {} }
  ]
};

const historyDetail: HistoryQueryDTO = {
  ...testData.historyQueries.list[0],
  northTransformers: [
    { id: 'history-transformer-1', items: [], transformer: compatibleTransformer, options: { key: 'history' } },
    { id: 'history-transformer-2', items: [], transformer: incompatibleTransformer, options: {} }
  ]
};

class SelectExistingTransformerComponentTester {
  readonly fixture = TestBed.createComponent(SelectExistingTransformerComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly source = this.root.getByLabelText('Select a source');
  readonly transformer = this.root.getByLabelText('Transformer to copy');
  readonly noCompatibleTransformer = this.root.getByText('No compatible transformer found for this source');
  readonly picked: Array<unknown> = [];

  constructor(sourceKind: 'north' | 'history-query', supportedOutputTypes: Array<string>) {
    this.fixture.componentRef.setInput('sourceKind', sourceKind);
    this.fixture.componentRef.setInput('supportedOutputTypes', supportedOutputTypes);
    this.fixture.componentInstance.transformerPicked.subscribe(picked => this.picked.push(picked));
  }

  optionLabels(select: typeof this.source) {
    return select
      .getByRole('option')
      .elements()
      .map(option => option.textContent?.trim());
  }
}

describe('SelectExistingTransformerComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;
  const norths = testData.north.listLight;
  const historyQueries = testData.historyQueries.listLight;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of(norths));
    historyQueryService.list.mockReturnValue(of(historyQueries));
    northConnectorService.findById.mockReturnValue(of(northDetail));
    historyQueryService.findById.mockReturnValue(of(historyDetail));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  test('should list the north connectors', async () => {
    const tester = new SelectExistingTransformerComponentTester('north', ['any']);

    await expect.element(tester.source.getByRole('option')).toHaveLength(norths.length + 1);
    expect(tester.optionLabels(tester.source)).toEqual(['', ...norths.map(north => north.name)]);
    await expect.element(tester.transformer).not.toBeInTheDocument();
  });

  test('should list the history queries', async () => {
    const tester = new SelectExistingTransformerComponentTester('history-query', ['any']);

    await expect.element(tester.source.getByRole('option')).toHaveLength(historyQueries.length + 1);
    expect(tester.optionLabels(tester.source)).toEqual(['', ...historyQueries.map(historyQuery => historyQuery.name)]);
  });

  test('should list the compatible transformers of the selected north connector, and emit the picked one', async () => {
    const tester = new SelectExistingTransformerComponentTester('north', ['any']);

    await tester.source.selectOptions(norths[0].name);

    expect(northConnectorService.findById).toHaveBeenCalledWith(norths[0].id);
    await expect.element(tester.transformer.getByRole('option')).toHaveLength(3);
    expect(tester.optionLabels(tester.transformer)).toEqual(['', `Ignore (${testData.south.listLight[0].name})`, customTransformer.name]);

    await tester.transformer.selectOptions(`Ignore (${testData.south.listLight[0].name})`);

    expect(tester.picked).toEqual([{ transformer: compatibleTransformer, options: { key: 'value' } }]);
  });

  test('should list the compatible transformers of the selected history query, and emit the picked one', async () => {
    const tester = new SelectExistingTransformerComponentTester('history-query', ['any']);

    await tester.source.selectOptions(historyQueries[0].name);

    expect(historyQueryService.findById).toHaveBeenCalledWith(historyQueries[0].id);
    await expect.element(tester.transformer.getByRole('option')).toHaveLength(2);
    expect(tester.optionLabels(tester.transformer)).toEqual(['', 'Ignore']);

    await tester.transformer.selectOptions('Ignore');

    expect(tester.picked).toEqual([{ transformer: compatibleTransformer, options: { key: 'history' } }]);
  });

  test('should tell when the source has no compatible transformer', async () => {
    const tester = new SelectExistingTransformerComponentTester('history-query', ['modbus']);

    await tester.source.selectOptions(historyQueries[0].name);

    await expect.element(tester.noCompatibleTransformer).toBeVisible();
    await expect.element(tester.transformer.getByRole('option')).toHaveLength(1);
  });

  test('should not emit when the empty transformer is selected again', async () => {
    const tester = new SelectExistingTransformerComponentTester('history-query', ['any']);
    await tester.source.selectOptions(historyQueries[0].name);
    await tester.transformer.selectOptions('Ignore');

    await tester.transformer.selectOptions('');

    expect(tester.picked).toHaveLength(1);
  });

  test('should clear the transformers when no source is selected', async () => {
    const tester = new SelectExistingTransformerComponentTester('north', ['any']);
    await tester.source.selectOptions(norths[0].name);
    await expect.element(tester.transformer).toBeVisible();

    await tester.source.selectOptions('');

    await expect.element(tester.transformer).not.toBeInTheDocument();
    expect(northConnectorService.findById).toHaveBeenCalledTimes(1);
  });

  test('should reset the selection when switching between north connectors and history queries', async () => {
    const tester = new SelectExistingTransformerComponentTester('north', ['any']);
    await tester.source.selectOptions(norths[0].name);
    await expect.element(tester.transformer).toBeVisible();

    tester.fixture.componentRef.setInput('sourceKind', 'history-query');

    await expect.element(tester.transformer).not.toBeInTheDocument();
    expect(tester.optionLabels(tester.source)).toEqual(['', ...historyQueries.map(historyQuery => historyQuery.name)]);
    await expect.element(tester.source).toHaveValue('0: null');
  });
});
