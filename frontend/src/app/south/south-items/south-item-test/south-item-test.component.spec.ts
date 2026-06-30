import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, test } from 'vitest';

import SouthItemTestComponent from './south-item-test.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
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
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  createdAt: '',
  updatedAt: ''
} as unknown as SouthConnectorItemDTO;

describe('SouthItemTestComponent', () => {
  beforeEach(() => {
    const southConnectorService = createMock(SouthConnectorService);
    const historyQueryService = createMock(HistoryQueryService);

    southConnectorService.testItem.mockReturnValue(of({} as any));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  test('should render with all required inputs', () => {
    const fixture = TestBed.createComponent(SouthItemTestComponent);
    fixture.componentRef.setInput('type', 'south');
    fixture.componentRef.setInput('entityId', 'southId1');
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('connectorCommand', connectorCommand);
    fixture.componentRef.setInput('manifest', manifest);
    fixture.detectChanges();
  });
});
