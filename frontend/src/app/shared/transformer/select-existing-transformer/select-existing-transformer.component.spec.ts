import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { SelectExistingTransformerComponent } from './select-existing-transformer.component';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from '../../../../test/vitest-create-mock';
import { NorthConnectorDTO, NorthConnectorLightDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { HistoryQueryDTO, HistoryQueryLightDTO } from '../../../../../../backend/shared/model/history-query.model';

const norths = [
  { id: 'north-1', name: 'North One' },
  { id: 'north-2', name: 'North Two' }
] as Array<NorthConnectorLightDTO>;

const historyQueries = [{ id: 'history-1', name: 'History One' }] as Array<HistoryQueryLightDTO>;

const compatibleTransformer = {
  id: 'transformer-ignore',
  type: 'standard',
  functionName: 'ignore',
  inputType: 'any',
  outputType: 'any-content'
};

const incompatibleTransformer = {
  id: 'transformer-iso',
  type: 'standard',
  functionName: 'iso',
  inputType: 'mqtt',
  outputType: 'mqtt'
};

const northDetail = {
  id: 'north-1',
  transformers: [
    {
      id: 'north-transformer-1',
      source: { type: 'south', south: { id: 'south-1', name: 'My South', type: 'opcua' } },
      transformer: compatibleTransformer,
      options: { key: 'value' }
    },
    {
      id: 'north-transformer-2',
      source: { type: 'oibus-api', dataSourceId: 'data-source-1' },
      transformer: incompatibleTransformer,
      options: {}
    }
  ]
} as unknown as NorthConnectorDTO;

const historyDetail = {
  id: 'history-1',
  northTransformers: [
    {
      id: 'history-transformer-1',
      items: [],
      transformer: compatibleTransformer,
      options: { key: 'value' }
    }
  ]
} as unknown as HistoryQueryDTO;

describe('SelectExistingTransformerComponent', () => {
  let northConnectorService: ReturnType<typeof createMock<NorthConnectorService>>;
  let historyQueryService: ReturnType<typeof createMock<HistoryQueryService>>;

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

  function create(sourceKind: 'north' | 'history-query', supportedOutputTypes: Array<string>) {
    const fixture = TestBed.createComponent(SelectExistingTransformerComponent);
    fixture.componentRef.setInput('sourceKind', sourceKind);
    fixture.componentRef.setInput('supportedOutputTypes', supportedOutputTypes);
    fixture.detectChanges();
    return fixture;
  }

  test('loads the north connector list', () => {
    const component = create('north', ['any-content']).componentInstance;

    expect(northConnectorService.list).toHaveBeenCalled();
    expect(component.norths).toEqual(norths);
  });

  test('loads the history query list', () => {
    const component = create('history-query', ['any-content']).componentInstance;

    expect(historyQueryService.list).toHaveBeenCalled();
    expect(component.historyQueries).toEqual(historyQueries);
  });

  test('loads and filters the north connector transformers by supported output type when a source is selected', () => {
    const component = create('north', ['any-content']).componentInstance;

    component.selectedSourceId = 'north-1';
    component.onSourceChange();

    expect(northConnectorService.findById).toHaveBeenCalledWith('north-1');
    expect(component.attachments).toEqual([
      {
        id: 'north-transformer-1',
        label: 'Ignore (My South)',
        transformer: compatibleTransformer,
        options: { key: 'value' }
      }
    ]);
  });

  test('loads and filters the history query transformers by supported output type when a source is selected', () => {
    const component = create('history-query', ['any-content']).componentInstance;

    component.selectedSourceId = 'history-1';
    component.onSourceChange();

    expect(historyQueryService.findById).toHaveBeenCalledWith('history-1');
    expect(component.attachments).toEqual([
      {
        id: 'history-transformer-1',
        label: 'Ignore',
        transformer: compatibleTransformer,
        options: { key: 'value' }
      }
    ]);
  });

  test('clears the attachments and selection when no source is selected', () => {
    const component = create('north', ['any-content']).componentInstance;

    component.selectedSourceId = 'north-1';
    component.onSourceChange();
    component.selectedAttachmentId = 'north-transformer-1';

    component.selectedSourceId = null;
    component.onSourceChange();

    expect(component.attachments).toEqual([]);
    expect(component.selectedAttachmentId).toEqual(null);
  });

  test('emits the picked transformer and its options', () => {
    const component = create('north', ['any-content']).componentInstance;
    const emitted: Array<unknown> = [];
    component.transformerPicked.subscribe((value: unknown) => emitted.push(value));

    component.selectedSourceId = 'north-1';
    component.onSourceChange();
    component.selectedAttachmentId = 'north-transformer-1';
    component.onAttachmentChange();

    expect(emitted).toEqual([{ transformer: compatibleTransformer, options: { key: 'value' } }]);
  });

  test('does not emit when the selected attachment id no longer matches an attachment', () => {
    const component = create('north', ['any-content']).componentInstance;
    const emitted: Array<unknown> = [];
    component.transformerPicked.subscribe((value: unknown) => emitted.push(value));

    component.selectedAttachmentId = 'unknown-id';
    component.onAttachmentChange();

    expect(emitted).toEqual([]);
  });

  test('resets the selection when switching between north connectors and history queries', () => {
    const fixture = create('north', ['any-content']);
    const component = fixture.componentInstance;
    component.selectedSourceId = 'north-1';
    component.onSourceChange();
    component.selectedAttachmentId = 'north-transformer-1';

    fixture.componentRef.setInput('sourceKind', 'history-query');
    fixture.detectChanges();

    expect(component.selectedSourceId).toEqual(null);
    expect(component.selectedAttachmentId).toEqual(null);
    expect(component.attachments).toEqual([]);
  });
});
