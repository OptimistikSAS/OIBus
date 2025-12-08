import { TestBed } from '@angular/core/testing';

import { EditHistoryQueryComponent } from './edit-history-query.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { Modal, ModalService } from '../../shared/modal.service';
import { SouthMSSQLSettings, SouthMSSQLItemSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthConsoleSettings } from '../../../../../backend/shared/model/north-settings.model';
import { NorthConnectorCommandDTO, NorthConnectorCommandTypedDTO } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorCommandDTO, SouthConnectorCommandTypedDTO } from '../../../../../backend/shared/model/south-connector.model';
import { TransformerService } from '../../services/transformer.service';
import { CertificateService } from '../../services/certificate.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { DateRange } from '../../shared/date-range-selector/date-range-selector.component';

class EditHistoryQueryComponentTester extends ComponentTester<EditHistoryQueryComponent> {
  constructor() {
    super(EditHistoryQueryComponent);
  }

  get title() {
    return this.element('h1');
  }

  get name() {
    return this.input('#history-query-name');
  }

  get description() {
    return this.input('#history-query-description');
  }

  get dateRangeSelector() {
    return this.element('oib-date-range-selector');
  }

  get northSpecificTitle() {
    return this.element('#north-specific-settings-title');
  }

  get southSpecificTitle() {
    return this.element('#south-specific-settings-title');
  }

  get specificForm() {
    return this.element(OIBusObjectFormControlComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }

  get sharedConnection() {
    return this.input('#south-shared-connection');
  }
}

describe('EditHistoryQueryComponent', () => {
  let tester: EditHistoryQueryComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;
  let transformerService: jasmine.SpyObj<TransformerService>;
  let modalService: jasmine.SpyObj<ModalService>;

  const historyQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'Test',
    description: 'My History query description',
    status: 'PENDING',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-02-01T00:00:00.000Z',
    northType: 'console',
    southType: 'mssql',
    northSettings: {
      verbose: false
    } as NorthConsoleSettings,
    southSettings: {
      throttling: {
        maxInstantPerItem: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 0
      },
      host: 'host',
      port: 1433,
      connectionTimeout: 1_000,
      database: 'database',
      username: 'oibus',
      password: 'pass',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5_000
    } as SouthMSSQLSettings,
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
          query: 'SELECT * FROM table',
          dateTimeFields: [],
          serialization: {
            type: 'csv',
            filename: 'output.csv',
            delimiter: 'DOT',
            compression: false,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss',
            outputTimezone: 'Europe/Paris'
          }
        } as SouthMSSQLItemSettings
      }
    ],
    northTransformers: []
  };

  beforeEach(async () => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              historyQueryId: 'id1'
            }
          })
        },
        { provide: ModalService, useValue: modalService }
      ]
    });

    scanModeService.list.and.returnValue(of(testData.scanMode.list));
    certificateService.list.and.returnValue(of([]));
    transformerService.list.and.returnValue(of([]));
    historyQueryService.list.and.returnValue(of([]));

    historyQueryService.findById.and.returnValue(of(historyQuery));
    northConnectorService.getNorthManifest.and.returnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.and.returnValue(of(testData.south.manifest));

    tester = new EditHistoryQueryComponentTester();
    await tester.change();
  });

  it('should display general settings', () => {
    expect(historyQueryService.findById).toHaveBeenCalledWith('id1');
    expect(tester.title).toContainText('Edit Test');
    expect(tester.description).toHaveValue('My History query description');
    expect(tester.specificForm).toBeDefined();
    expect(tester.northSpecificTitle).toContainText('Console settings');
    expect(tester.southSpecificTitle).toContainText('Folder scanner settings');
    expect(tester.sharedConnection).toBeNull();
  });

  it('should display date range selector', () => {
    expect(tester.dateRangeSelector).toBeDefined();
    expect(tester.componentInstance.form?.controls.dateRange.value).toEqual({
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z'
    });
  });

  it('should display south sharing input when connection can be shared', async () => {
    southConnectorService.getSouthManifest.and.returnValue(of(testData.south.manifest));
    tester = new EditHistoryQueryComponentTester();
    await tester.change();
    expect(tester.sharedConnection).toBeDefined();
  });

  it('should test north connection', async () => {
    tester.componentInstance.northManifest = testData.north.manifest;
    tester.componentInstance.southManifest = testData.south.manifest;
    tester.componentInstance.historyQuery = historyQuery;
    tester.componentInstance.northType = historyQuery.northType;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    // Rebuild form with history query to ensure values are set
    tester.componentInstance.buildForm(null, null);
    // Spy on the getter to return the correct values
    const northCommand: NorthConnectorCommandTypedDTO<'console', NorthConsoleSettings> = {
      name: historyQuery.name,
      type: 'console',
      description: historyQuery.description,
      enabled: true,
      settings: historyQuery.northSettings as NorthConsoleSettings,
      caching: {
        trigger: {
          scanModeId: historyQuery.caching.trigger.scanMode.id,
          scanModeName: historyQuery.caching.trigger.scanMode.name,
          numberOfElements: historyQuery.caching.trigger.numberOfElements,
          numberOfFiles: historyQuery.caching.trigger.numberOfFiles
        },
        throttling: historyQuery.caching.throttling,
        error: historyQuery.caching.error,
        archive: historyQuery.caching.archive
      },
      subscriptions: [],
      transformers: []
    };
    spyOnProperty(tester.componentInstance, 'northConnectorCommand', 'get').and.returnValue(northCommand as NorthConnectorCommandDTO);

    tester.componentInstance.test('north');
    await tester.change();
    expect(spy).toHaveBeenCalledWith('north', 'id1', historyQuery.northSettings, testData.north.manifest.id, null);
  });

  it('should test south connection', async () => {
    tester.componentInstance.northManifest = testData.north.manifest;
    tester.componentInstance.southManifest = testData.south.manifest;
    tester.componentInstance.historyQuery = historyQuery;
    tester.componentInstance.southType = historyQuery.southType;
    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    // Rebuild form with history query to ensure values are set
    tester.componentInstance.buildForm(null, null);
    // Spy on the getter to return the correct values
    const southCommand: SouthConnectorCommandTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings> = {
      name: historyQuery.name,
      type: 'mssql',
      description: historyQuery.description,
      enabled: true,
      settings: historyQuery.southSettings as SouthMSSQLSettings,
      items: []
    };
    spyOnProperty(tester.componentInstance, 'southConnectorCommand', 'get').and.returnValue(southCommand as SouthConnectorCommandDTO);

    tester.componentInstance.test('south');
    await tester.change();
    expect(spy).toHaveBeenCalledWith('south', 'id1', historyQuery.southSettings, historyQuery.southType, null);
  });

  it('should validate date range properly', async () => {
    const validDateRange: DateRange = {
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:00:00.000Z'
    };

    tester.componentInstance.form?.controls.dateRange.setValue(validDateRange);
    await tester.change();

    expect(tester.componentInstance.form?.controls.dateRange.errors).toBeFalsy();
  });

  it('should save with date range values', () => {
    const dateRange: DateRange = {
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:00:00.000Z'
    };

    tester.componentInstance.form?.patchValue({
      name: 'Test Query',
      description: 'Test Description',
      dateRange: dateRange
    });

    historyQueryService.update.and.returnValue(of(undefined));
    historyQueryService.findById.and.returnValue(of(historyQuery));
    modalService.open.and.returnValue({
      result: of(false)
    } as Modal<boolean>);

    tester.componentInstance.save();

    expect(historyQueryService.update).toHaveBeenCalledWith(
      'id1',
      jasmine.objectContaining({
        startTime: dateRange.startTime,
        endTime: dateRange.endTime
      }),
      false
    );
  });

  it('should convert existing startTime/endTime to DateRange on load', () => {
    const expectedDateRange: DateRange = {
      startTime: historyQuery.startTime,
      endTime: historyQuery.endTime
    };

    expect(tester.componentInstance.form?.controls.dateRange.value).toEqual(expectedDateRange);
  });

  it('should handle form validation correctly', () => {
    tester.componentInstance.form?.patchValue({
      name: '',
      dateRange: undefined
    });

    expect(tester.componentInstance.form?.valid).toBeFalsy();

    tester.componentInstance.form?.patchValue({
      name: 'Valid Name',
      dateRange: {
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2024-01-01T00:00:00.000Z'
      }
    });

    expect(tester.componentInstance.form?.valid).toBeTruthy();
  });
});
