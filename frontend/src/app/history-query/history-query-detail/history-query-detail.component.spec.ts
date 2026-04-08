import { TestBed } from '@angular/core/testing';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO, HistoryQueryItemTypedDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { EngineService } from '../../services/engine.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { SouthOPCUASettings, SouthOPCUAItemSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthConsoleSettings } from '../../../../../backend/shared/model/north-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

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

  get sortByNameBtn() {
    return this.button('button:has( > span[translate="history-query.items.name"])')!;
  }

  get tableItemNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(3)').map(e => e.nativeElement.textContent?.trim() ?? '');
  }

  get deleteAllButton() {
    return this.button('#delete-all')!;
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
    queryTimeRange: {
      startTime: testData.constants.dates.DATE_1,
      endTime: testData.constants.dates.DATE_2,
      maxReadInterval: 3600,
      readDelay: 200
    },
    southSettings: {
      throttling: {
        maxInstantPerItem: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 0
      },
      sharedConnection: false,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000,
      authentication: {
        type: 'none'
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    } as SouthOPCUASettings,
    northSettings: {
      verbose: false
    } as NorthConsoleSettings,
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId1',
          name: 'scan mode',
          description: '',
          cron: '* * * *',
          createdBy: { id: '', friendlyName: '' },
          updatedBy: { id: '', friendlyName: '' },
          createdAt: '',
          updatedAt: ''
        } as any,
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
          nodeId: 'ns=2;s=MyNode',
          mode: 'ha'
        } as SouthOPCUAItemSettings,
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      }
    ],
    northTransformers: [],
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: ''
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
    (engineService as any).info$ = of(engineInfo);

    tester = new HistoryQueryDetailComponentTester();
  });

  it('should display History query detail', async () => {
    await tester.change();
    expect(tester.title).toContainText(historyQuery.name);
    const southSettings = tester.southSettings;
    expect(southSettings).toBeDefined();

    const northSettings = tester.northSettings;
    expect(northSettings).toBeDefined();
  });

  it('should display items', async () => {
    await tester.change();
    expect(tester.items.length).toBe(1);
    const item = tester.items[0];
    expect(item.elements('td')[2]).toContainText('item1');
  });

  it('should display logs', async () => {
    await tester.change();
    expect(tester.historyQueryLogs.length).toBe(1);
  });

  it('should test north connection', async () => {
    tester.componentInstance.northManifest = northManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('north');
    await tester.change();
    expect(spy).toHaveBeenCalledWith('north', 'id1', historyQuery.northSettings, historyQuery.northType);
  });

  it('should test south connection', async () => {
    tester.componentInstance.southManifest = southManifest;
    tester.componentInstance.historyQuery = historyQuery;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('south');
    await tester.change();
    expect(spy).toHaveBeenCalledWith('south', 'id1', historyQuery.southSettings, historyQuery.southType);
  });
});

describe('HistoryQueryDetailComponent item management', () => {
  let tester: HistoryQueryDetailComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;
  let transformerService: jasmine.SpyObj<TransformerService>;
  let engineService: jasmine.SpyObj<EngineService>;
  let modalService: jasmine.SpyObj<ModalService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const multiItemHistoryQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'History query',
    description: 'My History query description',
    status: 'PENDING',
    southType: 'opcua',
    northType: 'console',
    queryTimeRange: {
      startTime: testData.constants.dates.DATE_1,
      endTime: testData.constants.dates.DATE_2,
      maxReadInterval: 3600,
      readDelay: 200
    },
    southSettings: {
      throttling: { maxInstantPerItem: false, maxReadInterval: 3600, readDelay: 200, overlap: 0 },
      sharedConnection: false,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000,
      authentication: { type: 'none' },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    } as SouthOPCUASettings,
    northSettings: { verbose: false } as NorthConsoleSettings,
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId1',
          name: 'scan mode',
          description: '',
          cron: '* * * *',
          createdBy: { id: '', friendlyName: '' },
          updatedBy: { id: '', friendlyName: '' },
          createdAt: '',
          updatedAt: ''
        } as any,
        numberOfElements: 1_000,
        numberOfFiles: 1
      },
      throttling: { runMinDelay: 200, maxSize: 30, maxNumberOfElements: 10_000 },
      error: { retryInterval: 1_000, retryCount: 3, retentionDuration: 24 },
      archive: { enabled: false, retentionDuration: 0 }
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { nodeId: 'ns=1;s=A', mode: 'ha' } as SouthOPCUAItemSettings,
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item1-copy',
        enabled: false,
        settings: { nodeId: 'ns=1;s=B', mode: 'ha' } as SouthOPCUAItemSettings,
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: false,
        settings: { nodeId: 'ns=1;s=C', mode: 'ha' } as SouthOPCUAItemSettings,
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      }
    ],
    northTransformers: [],
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    engineService = createMock(EngineService);
    modalService = createMock(ModalService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({ params: { historyQueryId: 'id1' } })
        },
        { provide: EngineService, useValue: engineService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: ModalService, useValue: modalService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    historyQueryService.findById.and.returnValue(of(multiItemHistoryQuery));
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.getSouthManifest.and.returnValue(of(testData.south.manifest));
    northConnectorService.getNorthManifest.and.returnValue(of(testData.north.manifest));
    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));
    transformerService.list.and.returnValue(of([]));
    engineService.getInfo.and.returnValue(of(testData.engine.oIBusInfo));
    (engineService as any).info$ = of(testData.engine.oIBusInfo);
    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new HistoryQueryDetailComponentTester();
  });

  it('should display all items', async () => {
    await tester.change();
    expect(tester.items.length).toBe(3);
  });

  it('should sort items by name ascending then descending', async () => {
    await tester.change();

    // Click 1: ascending
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy', 'item3']);

    // Click 2: descending
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    // Click 3: indeterminate — filteredItems stays in descending order (no re-sort)
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    // Click 4: ascending again
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy', 'item3']);
  });

  it('should filter items by name', async () => {
    await tester.change();
    tester.componentInstance.searchControl.setValue('item1');
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  });

  it('should filter items by status', async () => {
    await tester.change();
    tester.componentInstance.statusFilterControl.setValue('enabled');
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1']);

    tester.componentInstance.statusFilterControl.setValue('disabled');
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item3']);
  });

  it('should delete an item and refresh', async () => {
    const afterDelete = { ...multiItemHistoryQuery, items: multiItemHistoryQuery.items.slice(1) };
    historyQueryService.findById.and.returnValues(of(multiItemHistoryQuery), of(afterDelete));
    await tester.change();

    tester.items[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledWith('id1', 'id1');
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.deleted');
    expect(tester.items.length).toBe(2);
  });

  it('should delete all items', async () => {
    historyQueryService.findById.and.returnValues(of(multiItemHistoryQuery), of({ ...multiItemHistoryQuery, items: [] }));
    await tester.change();

    tester.deleteAllButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteAllItems).toHaveBeenCalledWith('id1');
    expect(tester.items.length).toBe(0);
  });

  it('should sort items by enabled status', async () => {
    await tester.change();
    // item1=enabled, item1-copy=disabled, item3=disabled

    tester.componentInstance.toggleColumnSort('enabled');
    await tester.change();
    // ascending: disabled (0) first
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item3', 'item1']);

    tester.componentInstance.toggleColumnSort('enabled');
    await tester.change();
    // descending: enabled (1) first
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy', 'item3']);
  });

  it('should sort items by createdAt', async () => {
    await tester.change();
    const items = tester.componentInstance.filteredItems as Array<HistoryQueryItemTypedDTO<SouthOPCUAItemSettings>>;
    tester.componentInstance.filteredItems = [
      { ...items[0], createdAt: '2024-02-01T00:00:00.000Z' },
      { ...items[1], createdAt: '2024-01-01T00:00:00.000Z' },
      { ...items[2], createdAt: '2024-03-01T00:00:00.000Z' }
    ];
    await tester.change();

    tester.componentInstance.toggleColumnSort('createdAt');
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item1', 'item3']); // Jan < Feb < Mar

    tester.componentInstance.toggleColumnSort('createdAt');
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item3', 'item1', 'item1-copy']);
  });

  it('should return empty array from filter() when historyQuery is null', () => {
    tester.componentInstance.historyQuery = null;
    expect(tester.componentInstance.filter()).toEqual([]);
  });
});
