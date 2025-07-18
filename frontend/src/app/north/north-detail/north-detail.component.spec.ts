import { TestBed } from '@angular/core/testing';

import { NorthDetailComponent } from './north-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineService } from '../../services/engine.service';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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

  get northLogs() {
    return this.elements('#logs-title');
  }
}

describe('NorthDetailComponent', () => {
  let tester: NorthDetailComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let engineService: jasmine.SpyObj<EngineService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const northConnector: NorthConnectorDTO<NorthSettings> = {
    id: 'id1',
    type: 'file-writer',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    settings: {
      host: 'url'
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
    subscriptions: []
  };
  const manifest: NorthConnectorManifest = {
    id: 'oianalytics',
    category: 'api',
    modes: {
      files: true,
      points: true
    },
    settings: [
      {
        key: 'host',
        type: 'OibText',
        translationKey: 'north.oianalytics.specific-settings.host',
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
    northConnectorService = createMock(NorthConnectorService);
    scanModeService = createMock(ScanModeService);
    notificationService = createMock(NotificationService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
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
        { provide: EngineService, useValue: engineService },
        { provide: ScanModeService, useValue: scanModeService }
      ]
    });

    northConnectorService.get.and.returnValue(of(northConnector));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(of(manifest));
    northConnectorService.startNorth.and.returnValue(of(undefined));
    northConnectorService.stopNorth.and.returnValue(of(undefined));
    engineService.getInfo.and.returnValue(of(engineInfo));
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
    expect(settings[1]).toContainText('URL');
    expect(settings[1]).toContainText('url');
  });

  it('should display logs', () => {
    tester.detectChanges();
    expect(tester.northLogs.length).toBe(1);
  });

  it('should stop north', () => {
    tester.detectChanges();
    tester.toggleButton.click();
    expect(northConnectorService.stopNorth).toHaveBeenCalledWith(northConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: northConnector.name });
  });

  it('should start north', () => {
    northConnectorService.get.and.returnValue(of({ ...northConnector, enabled: false }));
    tester.detectChanges();
    tester.toggleButton.click();
    expect(northConnectorService.startNorth).toHaveBeenCalledWith(northConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: northConnector.name });
  });
});
