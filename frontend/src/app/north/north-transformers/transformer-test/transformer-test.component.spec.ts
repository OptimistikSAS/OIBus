import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { NorthTransformerTestComponent } from './transformer-test.component';
import { TransformerService } from '../../../services/transformer.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from '../../../../test/vitest-create-mock';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';

const transformer = {
  id: 'transformer-1',
  type: 'standard',
  functionName: 'time-values-to-json',
  inputType: 'time-values'
} as TransformerDTO;

describe('NorthTransformerTestComponent', () => {
  let transformerService: ReturnType<typeof createMock<TransformerService>>;
  let southConnectorService: ReturnType<typeof createMock<SouthConnectorService>>;
  let historyQueryService: ReturnType<typeof createMock<HistoryQueryService>>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    transformerService.testTransformer.mockReturnValue(
      of({ raw: { type: 'any-content', content: '[]' }, transformed: { type: 'any-content', content: 'pasted-output' } }) as never
    );
    southConnectorService.getSouthManifest.mockReturnValue(of({ modes: { history: false } }) as never);
    southConnectorService.findById.mockReturnValue(of({ id: 'south-1', settings: { host: 'h' } }) as never);
    southConnectorService.searchItems.mockReturnValue(
      of({
        content: [{ id: 'item-1', name: 'item one', settings: { nodeId: 'n' } }],
        totalElements: 1,
        size: 10,
        number: 0,
        totalPages: 1
      }) as never
    );
    southConnectorService.testItem.mockReturnValue(of({ raw: { type: 'time-values', content: [] }, transformed: null }) as never);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  function create(itemSource: unknown = { kind: 'none' }) {
    const fixture = TestBed.createComponent(NorthTransformerTestComponent);
    fixture.componentRef.setInput('transformer', transformer);
    fixture.componentRef.setInput('options', { precision: 2 });
    fixture.componentRef.setInput('itemSource', itemSource);
    fixture.detectChanges();
    return fixture;
  }

  test('prefills the paste input from the transformer template', () => {
    const component = create().componentInstance;
    expect(transformerService.getInputTemplate).toHaveBeenCalledWith('time-values');
    expect(component.form.controls.inputData.value).toBe('[]');
  });

  test('runs the transformer with pasted input and its options', () => {
    const component = create().componentInstance;
    component.form.controls.inputSource.setValue('paste');
    component.form.controls.inputData.setValue('[{"pointId":"p"}]');

    component.runTest();

    expect(transformerService.testTransformer).toHaveBeenCalledWith('transformer-1', {
      inputData: '[{"pointId":"p"}]',
      options: { precision: 2 }
    });
  });

  test('loads the source south items and runs the selected item through the transformer', () => {
    const component = create({ kind: 'south', id: 'south-1', southType: 'opcua' }).componentInstance;

    // items were loaded from the source south
    expect(component.availableItems).toEqual([{ id: 'item-1', name: 'item one', settings: { nodeId: 'n' } }]);

    component.form.controls.inputSource.setValue('item');
    component.form.controls.itemId.setValue('item-1');
    component.runTest();

    expect(southConnectorService.testItem).toHaveBeenCalledWith(
      'south-1',
      'opcua',
      'item one',
      { host: 'h' },
      { nodeId: 'n' },
      {
        history: undefined,
        transformer: { transformerId: 'transformer-1', options: { precision: 2 } }
      }
    );
  });

  test('offers only the history query items for a history source', () => {
    historyQueryService.findById.mockReturnValue(
      of({ id: 'hq-1', southSettings: { host: 'h' }, items: [{ id: 'hi-1', name: 'hist item', settings: { nodeId: 'x' } }] }) as never
    );

    const component = create({ kind: 'history', id: 'hq-1', southType: 'mssql' }).componentInstance;

    expect(component.availableItems).toEqual([{ id: 'hi-1', name: 'hist item', settings: { nodeId: 'x' } }]);
    expect(southConnectorService.searchItems).not.toHaveBeenCalled();
  });
});
