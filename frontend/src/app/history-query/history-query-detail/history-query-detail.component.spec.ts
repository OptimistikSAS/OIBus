import { TestBed } from '@angular/core/testing';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthConnectorCommandDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorCommandDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { EngineService } from '../../services/engine.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

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
  let engineService: jasmine.SpyObj<EngineService>;
  let modalService: jasmine.SpyObj<ModalService>;

  const southManifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    settings: [
      {
        key: 'database',
        type: 'OibText',
        translationKey: 'south.mssql.database',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ],
    items: {
      scanMode: 'POLL',
      settings: [
        {
          translationKey: 'south.items.mssql.query',
          key: 'query',
          displayInViewMode: true,
          type: 'OibText'
        }
      ]
    },
    modes: {
      subscription: false,
      history: true,
      lastFile: true,
      lastPoint: false
    }
  };
  const northManifest: NorthConnectorManifest = {
    id: 'oianalytics',
    category: 'api',
    types: ['any', 'time-values'],
    settings: [
      {
        key: 'host',
        type: 'OibText',
        translationKey: 'south.oianalytics.specific-settings.host',
        validators: [
          { key: 'required' },
          {
            key: 'pattern',
            params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
          }
        ],
        displayInViewMode: true
      }
    ]
  };
  const historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
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
        scanModeId: 'scanModeId1',
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
  const engineInfo: OIBusInfo = {
    version: '3.0.0',
    launcherVersion: '3.5.0',
    dataDirectory: 'data-folder',
    processId: '1234',
    architecture: 'x64',
    hostname: 'hostname',
    binaryDirectory: 'bin-directory',
    operatingSystem: 'Windows',
    platform: 'windows',
    oibusId: 'id',
    oibusName: 'name'
  };

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);
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
        { provide: ModalService, useValue: modalService }
      ]
    });

    historyQueryService.get.and.returnValue(of(historyQuery));
    historyQueryService.startHistoryQuery.and.returnValue(of(undefined));
    historyQueryService.pauseHistoryQuery.and.returnValue(of(undefined));
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(southManifest));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(of(northManifest));
    scanModeService.list.and.returnValue(of([]));
    engineService.getInfo.and.returnValue(of(engineInfo));

    tester = new HistoryQueryDetailComponentTester();
  });

  it('should display History query detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(historyQuery.name);
    const southSettings = tester.southSettings;
    expect(southSettings.length).toBe(1);
    expect(southSettings[0]).toContainText('Database');
    expect(southSettings[0]).toContainText('my database');

    const northSettings = tester.northSettings;
    expect(northSettings.length).toBe(1);
    expect(northSettings[0]).toContainText('Host');
    expect(northSettings[0]).toContainText('localhost');
  });

  it('should display items', () => {
    tester.detectChanges();
    expect(tester.items.length).toBe(1);
    const item = tester.items[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('sql');
  });

  it('should display logs', () => {
    tester.detectChanges();
    expect(tester.historyQueryLogs.length).toBe(1);
  });

  it('should test north connection', () => {
    tester.componentInstance.northManifest = northManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const command = {
      type: northManifest.id,
      settings: historyQuery.northSettings,
      caching: historyQuery.caching
    } as NorthConnectorCommandDTO<NorthSettings>;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('north');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith('north', command, 'id1');
  });

  it('should test south connection', () => {
    tester.componentInstance.southManifest = southManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const command = {
      type: southManifest.id,
      settings: historyQuery.southSettings
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('south');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith('south', command, 'id1');
  });
});
