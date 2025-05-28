import { TestBed } from '@angular/core/testing';

import { EditHistoryQueryComponent } from './edit-history-query.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { Modal, ModalService } from '../../shared/modal.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { TransformerService } from '../../services/transformer.service';
import { CertificateService } from '../../services/certificate.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';

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

  get startTime() {
    return this.element('#startTime');
  }

  get endTime() {
    return this.element('#endTime');
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

  const historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
    id: 'id1',
    name: 'Test',
    description: 'My History query description',
    status: 'PENDING',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-02-01T00:00:00.000Z',
    northType: 'console',
    southType: 'mssql',
    northSettings: {} as NorthSettings,
    southSettings: {} as SouthSettings,
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

  beforeEach(() => {
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
        provideHttpClient(),
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

    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));
    transformerService.list.and.returnValue(of([]));

    historyQueryService.get.and.returnValue(of(historyQuery));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(of(testData.north.manifest));
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(testData.south.manifest));

    tester = new EditHistoryQueryComponentTester();
    tester.detectChanges();
  });

  it('should display general settings', () => {
    expect(historyQueryService.get).toHaveBeenCalledWith('id1');
    expect(tester.title).toContainText('Edit Test');
    expect(tester.description).toHaveValue('My History query description');
    expect(tester.specificForm).toBeDefined();
    expect(tester.northSpecificTitle).toContainText('Console settings');
    expect(tester.southSpecificTitle).toContainText('Folder scanner settings');
    expect(tester.sharedConnection).toBeNull();
  });

  it('should display south sharing input when connection can be shared', () => {
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(testData.south.manifest));
    tester = new EditHistoryQueryComponentTester();
    tester.detectChanges();
    expect(tester.sharedConnection).toBeDefined();
  });

  it('should test north connection', () => {
    tester.componentInstance.northManifest = testData.north.manifest;
    tester.componentInstance.historyQuery = historyQuery;

    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('north');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith(
      'north',
      {
        type: 'console',
        settings: {},
        caching: {
          trigger: { scanModeId: 'scanModeId1', numberOfElements: 1000, numberOfFiles: 1 },
          throttling: { runMinDelay: 200, maxSize: 30, maxNumberOfElements: 10000 },
          error: { retryInterval: 1000, retryCount: 3, retentionDuration: 24 },
          archive: { enabled: false, retentionDuration: 0 }
        }
      },
      'id1',
      null
    );
  });

  it('should test south connection', () => {
    tester.componentInstance.southManifest = testData.south.manifest;
    tester.componentInstance.historyQuery = historyQuery;
    const spy = jasmine.createSpy();
    modalService.open.and.returnValue({
      componentInstance: {
        runHistoryQueryTest: spy
      }
    } as Modal<unknown>);

    tester.componentInstance.test('south');
    tester.detectChanges();
    expect(spy).toHaveBeenCalledWith('south', { type: 'folder-scanner', settings: {}, items: [] }, 'id1', null);
  });

  it('should validate start and end time', () => {
    // Should throw error
    historyQuery.startTime = '2024-01-01T00:00:00.000Z';
    historyQuery.endTime = '2023-01-01T00:00:00.000Z';
    tester = new EditHistoryQueryComponentTester();
    tester.detectChanges();

    expect(tester.componentInstance.form?.controls.startTime.errors).toEqual({
      badStartDateRange: true
    });
    expect(tester.componentInstance.form?.controls.endTime.errors).toEqual({
      badEndDateRange: true
    });

    // Should not throw error
    historyQuery.startTime = '2023-01-01T00:00:00.000Z';
    historyQuery.endTime = '2024-01-01T00:00:00.000Z';
    tester = new EditHistoryQueryComponentTester();
    tester.detectChanges();

    expect(tester.componentInstance.form?.controls.startTime.errors).toEqual(null);
    expect(tester.componentInstance.form?.controls.endTime.errors).toEqual(null);
  });
});
