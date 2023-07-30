import { TestBed } from '@angular/core/testing';

import { NorthDetailComponent } from './north-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NotificationService } from '../../shared/notification.service';

class NorthDetailComponentTester extends ComponentTester<NorthDetailComponent> {
  constructor() {
    super(NorthDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get toggleButton() {
    return this.button('#north-enabled')!;
  }

  get northSettings() {
    return this.elements('tbody.north-settings tr');
  }
}

describe('NorthDetailComponent', () => {
  let tester: NorthDetailComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const northConnector: NorthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    settings: {
      host: 'url'
    },
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

  const manifest: NorthConnectorManifest = {
    id: 'oianalytics',
    name: 'OIAnalytics',
    category: 'api',
    description: 'OIAnalytics description',
    modes: {
      files: true,
      points: true
    },
    settings: [
      {
        key: 'host',
        type: 'OibText',
        label: 'Host',
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

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    scanModeService = createMock(ScanModeService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              northId: 'id1'
            }
          })
        },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ScanModeService, useValue: scanModeService }
      ]
    });

    northConnectorService.getNorthConnector.and.returnValue(of(northConnector));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(of(manifest));
    northConnectorService.startNorth.and.returnValue(of(undefined));
    northConnectorService.stopNorth.and.returnValue(of(undefined));
    scanModeService.list.and.returnValue(of([]));

    tester = new NorthDetailComponentTester();
  });

  it('should display north connector detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(northConnector.name);
    const settings = tester.northSettings;
    expect(settings.length).toBe(2);
    expect(settings[0]).toContainText('Status');
    expect(settings[0]).toContainText('active');
    expect(settings[1]).toContainText('Host');
    expect(settings[1]).toContainText('url');
  });

  it('should stop north', () => {
    tester.detectChanges();
    tester.toggleButton.click();
    expect(northConnectorService.stopNorth).toHaveBeenCalledWith(northConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: northConnector.name });
  });

  it('should start north', () => {
    northConnectorService.getNorthConnector.and.returnValue(of({ ...northConnector, enabled: false }));
    tester.detectChanges();
    tester.toggleButton.click();
    expect(northConnectorService.startNorth).toHaveBeenCalledWith(northConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: northConnector.name });
  });
});
