import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import SouthItemTestComponent from './south-item-test.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from '../../../../test/vitest-create-mock';
import { SouthConnectorItemDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { SouthFolderScannerItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const connectorCommand = testData.south.command;
const item: SouthConnectorItemDTO = {
  id: 'id1',
  name: 'item1',
  enabled: true,
  settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
  scanMode: testData.scanMode.list[0]
} as unknown as SouthConnectorItemDTO;

const standardTransformer = {
  id: 't1',
  type: 'standard',
  functionName: 'time-values-to-json',
  inputType: 'time-values',
  outputType: 'any',
  manifest: { attributes: [], enablingConditions: [] }
};

describe('SouthItemTestComponent', () => {
  let southConnectorService: ReturnType<typeof createMock<SouthConnectorService>>;
  let northConnectorService: ReturnType<typeof createMock<NorthConnectorService>>;
  let historyQueryService: ReturnType<typeof createMock<HistoryQueryService>>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    southConnectorService.testItem.mockReturnValue(of({ raw: { type: 'time-values', content: [] }, transformed: null }) as never);
    northConnectorService.list.mockReturnValue(of([]));
    historyQueryService.findById.mockReturnValue(of(null) as never);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  function createComponent(type: 'south' | 'history-south' = 'south', entityId = 'southId1') {
    const fixture = TestBed.createComponent(SouthItemTestComponent);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('entityId', entityId);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('connectorCommand', connectorCommand);
    fixture.componentRef.setInput('manifest', manifest);
    fixture.detectChanges();
    return fixture;
  }

  test('should render with all required inputs and load norths in a south context', () => {
    northConnectorService.list.mockReturnValue(of([{ id: 'northId1', name: 'North 1' }]) as never);
    const component = createComponent().componentInstance;
    expect(component.norths.map(n => n.id)).toEqual(['northId1']);
  });

  test('selecting a north loads its transformers, selecting one builds the options form', () => {
    northConnectorService.list.mockReturnValue(of([{ id: 'northId1', name: 'North 1' }]) as never);
    northConnectorService.findById.mockReturnValue(
      of({
        id: 'northId1',
        name: 'North 1',
        transformers: [{ id: 'b1', transformer: standardTransformer, options: { foo: 'bar' } }]
      }) as never
    );

    const component = createComponent().componentInstance;
    component.form!.controls.northId.setValue('northId1');
    expect(component.transformerChoices.map(t => t.transformerId)).toEqual(['t1']);

    component.form!.controls.transformerId.setValue('t1');
    expect(component.selectedTransformer?.id).toBe('t1');
  });

  test('runs the item and stores the raw + transformed result', () => {
    southConnectorService.testItem.mockReturnValue(
      of({ raw: { type: 'time-values', content: [] }, transformed: { type: 'any-content', content: 'out' } }) as never
    );

    const component = createComponent().componentInstance;
    component.testItem();

    expect(component.testResult?.transformed).toEqual({ type: 'any-content', content: 'out' });
    expect(southConnectorService.testItem).toHaveBeenCalled();
  });

  test('history context offers only the history query transformers', () => {
    historyQueryService.findById.mockReturnValue(of({ northTransformers: [{ transformer: standardTransformer, options: {} }] }) as never);

    const component = createComponent('history-south', 'hq1').componentInstance;
    expect(component.transformerChoices.map(t => t.transformerId)).toEqual(['t1']);
  });
});
