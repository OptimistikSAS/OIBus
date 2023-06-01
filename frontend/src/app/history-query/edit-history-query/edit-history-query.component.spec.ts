import { TestBed } from '@angular/core/testing';

import { EditHistoryQueryComponent } from './edit-history-query.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { FormComponent } from '../../shared/form/form.component';
import { ProxyService } from '../../services/proxy.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';

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

  get enabled() {
    return this.input('#history-query-enabled');
  }

  get description() {
    return this.textarea('#history-query-description');
  }

  get startTime() {
    return this.element('#start');
  }

  get endTime() {
    return this.element('#end');
  }

  get northSpecificTitle() {
    return this.element('#north-specific-settings-title');
  }

  get southSpecificTitle() {
    return this.element('#south-specific-settings-title');
  }

  get specificForm() {
    return this.element(FormComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }
}
describe('EditHistoryQueryComponent', () => {
  let tester: EditHistoryQueryComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let proxyService: jasmine.SpyObj<ProxyService>;

  const historyQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'Test',
    description: 'My History query description',
    enabled: true,
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200
    },
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-02-01T00:00:00.000Z',
    northType: 'Console',
    southType: 'SQL',
    northSettings: {},
    southSettings: {},
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      sendFileImmediately: true,
      maxSize: 30
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  };

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);
    proxyService = createMock(ProxyService);

    TestBed.configureTestingModule({
      imports: [EditHistoryQueryComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: ProxyService, useValue: proxyService },
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              historyQueryId: 'id1'
            }
          })
        }
      ]
    });

    scanModeService.list.and.returnValue(of([]));
    proxyService.list.and.returnValue(of([]));

    historyQueryService.get.and.returnValue(of(historyQuery));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(
      of({
        category: 'debug',
        name: 'Console',
        description: 'Console description',
        modes: {
          files: true,
          points: true
        },
        settings: [],
        schema: {} as unknown
      } as NorthConnectorManifest)
    );
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(
      of({
        category: 'database',
        name: 'SQL',
        description: 'SQL description',
        modes: {
          history: true,
          lastFile: false,
          lastPoint: false,
          subscription: false
        },
        settings: [],
        items: {
          scanMode: {
            acceptSubscription: false,
            subscriptionOnly: false
          },
          settings: [],
          schema: {} as unknown
        },
        schema: {} as unknown
      } as SouthConnectorManifest)
    );
    tester = new EditHistoryQueryComponentTester();
    tester.detectChanges();
  });

  it('should display general settings', () => {
    expect(historyQueryService.get).toHaveBeenCalledWith('id1');
    expect(tester.title).toContainText('Edit history query Test');
    expect(tester.enabled).toBeChecked();
    expect(tester.description).toHaveValue('My History query description');
    expect(tester.specificForm).toBeDefined();
    expect(tester.northSpecificTitle).toContainText('Console settings');
    expect(tester.southSpecificTitle).toContainText('SQL settings');
  });
});
