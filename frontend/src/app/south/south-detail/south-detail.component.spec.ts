import { TestBed } from '@angular/core/testing';

import { SouthDetailComponent } from './south-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { EngineService } from '../../services/engine.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';

class SouthDisplayComponentTester extends ComponentTester<SouthDetailComponent> {
  constructor() {
    super(SouthDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get toggleButton() {
    return this.button('#south-enabled')!;
  }

  get southSettings() {
    return this.elements('tbody.south-settings tr');
  }

  get southItems() {
    return this.elements('tbody tr.south-item');
  }

  get southLogs() {
    return this.elements('#logs-title');
  }
}

describe('SouthDetailComponent', () => {
  let tester: SouthDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let engineService: jasmine.SpyObj<EngineService>;

  const manifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    settings: [],
    items: {
      scanMode: {
        acceptSubscription: false,
        subscriptionOnly: false
      },
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
  const southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
    id: 'id1',
    type: 'mssql',
    name: 'South Connector',
    description: 'My South connector description',
    enabled: true,
    settings: {} as SouthSettings,
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'sql'
        } as SouthItemSettings,
        scanModeId: 'scanModeId1'
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
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              southId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    scanModeService.list.and.returnValue(
      of([
        {
          id: 'scanModeId1',
          name: 'Every mn',
          description: '',
          cron: ''
        }
      ])
    );
    engineService.getInfo.and.returnValue(of(engineInfo));
    southConnectorService.get.and.returnValue(of(southConnector));
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(manifest));
    southConnectorService.startSouth.and.returnValue(of(undefined));
    southConnectorService.stopSouth.and.returnValue(of(undefined));

    tester = new SouthDisplayComponentTester();
  });

  it('should display south connector detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(southConnector.name);
    const settings = tester.southSettings;
    expect(settings.length).toBe(1);
    expect(settings[0]).toContainText('Status');
    expect(settings[0]).toContainText('active');
  });

  it('should display items', () => {
    tester.detectChanges();
    expect(tester.southItems.length).toBe(1);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('Every mn');
    expect(item.elements('td')[3]).toContainText('sql');
  });

  it('should display logs', () => {
    tester.detectChanges();
    expect(tester.southLogs.length).toBe(1);
  });

  it('should stop south', () => {
    tester.detectChanges();
    tester.toggleButton.click();
    expect(southConnectorService.stopSouth).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.stopped', { name: southConnector.name });
  });

  it('should start south', () => {
    southConnectorService.get.and.returnValue(of({ ...southConnector, enabled: false }));
    tester.detectChanges();
    tester.toggleButton.click();
    expect(southConnectorService.startSouth).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnector.name });
  });
});
