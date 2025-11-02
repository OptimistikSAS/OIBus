import { TestBed } from '@angular/core/testing';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { EngineService } from '../../services/engine.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';

class HistoryQueryDetailComponentTester extends ComponentTester<HistoryQueryDetailComponent> {
  constructor() {
    super(HistoryQueryDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get southSettings() {
    return this.elements('tbody.south-settings tr');
  }

  get northSettings() {
    return this.elements('tbody.north-settings tr');
  }

  get items() {
    return this.elements('tbody tr.south-item');
  }

  get historyQueryLogs() {
    return this.elements('#logs-title');
  }
}

describe('HistoryQueryDetailComponent', () => {
  let tester: HistoryQueryDetailComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;
  let transformerService: jasmine.SpyObj<TransformerService>;
  let engineService: jasmine.SpyObj<EngineService>;
  let modalService: jasmine.SpyObj<ModalService>;

  const southManifest = testData.south.manifest;
  const northManifest = testData.north.manifest;
  const historyQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'History query',
    description: 'My History query description',
    status: 'PENDING',
    southType: 'opcua',
    northType: 'console',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-01-01T00:00:00.000Z',
    southSettings: {
      database: 'my database'
    } as SouthSettings,
    northSettings: {
      host: 'localhost'
    } as NorthSettings,
    caching: {
      trigger: {
        scanMode: { id: 'scanModeId1', name: 'scan mode', description: '', cron: '* * * *' },
        numberOfElements: 1_000,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'sql'
        } as SouthItemSettings
      }
    ],
    northTransformers: []
  };
  const engineInfo = testData.engine.oIBusInfo;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    engineService = createMock(EngineService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              historyQueryId: 'id1'
            }
          })
        },
        { provide: EngineService, useValue: engineService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    historyQueryService.findById.and.returnValue(of(historyQuery));
    historyQueryService.start.and.returnValue(of(undefined));
    historyQueryService.pause.and.returnValue(of(undefined));
    southConnectorService.getSouthManifest.and.returnValue(of(southManifest));
    northConnectorService.getNorthManifest.and.returnValue(of(northManifest));
    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));
    transformerService.list.and.returnValue(of([]));
    engineService.getInfo.and.returnValue(of(engineInfo));

    tester = new HistoryQueryDetailComponentTester();
  });

  it('should display History query detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(historyQuery.name);
    const southSettings = tester.southSettings;
    expect(southSettings).toBeDefined();

    const northSettings = tester.northSettings;
    expect(northSettings).toBeDefined();
  });

  it('should display items', () => {
    tester.detectChanges();
    expect(tester.items.length).toBe(1);
    const item = tester.items[0];
    expect(item.elements('td')[1]).toContainText('item1');
  });

  it('should display logs', () => {
    tester.detectChanges();
    expect(tester.historyQueryLogs.length).toBe(1);
  });

  it('should test north connection', () => {
    tester.componentInstance.northManifest = northManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('north');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith('north', 'id1', historyQuery.northSettings, historyQuery.northType);
  });

  it('should test south connection', () => {
    tester.componentInstance.southManifest = southManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('south');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith('south', 'id1', historyQuery.southSettings, historyQuery.southType);
  });
});
