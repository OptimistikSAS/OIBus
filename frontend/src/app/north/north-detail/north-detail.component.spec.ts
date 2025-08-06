import { TestBed } from '@angular/core/testing';

import { NorthDetailComponent } from './north-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineService } from '../../services/engine.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
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

  const northConnector = testData.north.list[0] as NorthConnectorDTO<NorthSettings>;
  const manifest = testData.north.manifest;
  const engineInfo = testData.engine.oIBusInfo;

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
    expect(settings.length).toBe(1);
    expect(settings[0]).toContainText('Status');
    expect(settings[0]).toContainText('active');
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
