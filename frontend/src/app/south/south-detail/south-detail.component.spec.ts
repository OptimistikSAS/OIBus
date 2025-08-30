import { TestBed } from '@angular/core/testing';

import { SouthDetailComponent } from './south-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { EngineService } from '../../services/engine.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CertificateService } from '../../services/certificate.service';

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
  let certificateService: jasmine.SpyObj<CertificateService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let engineService: jasmine.SpyObj<EngineService>;

  const manifest = testData.south.manifest;
  const southConnector = testData.south.list[0];
  const engineInfo = testData.engine.oIBusInfo;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
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
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    scanModeService.list.and.returnValue(of(testData.scanMode.list));
    certificateService.list.and.returnValue(of(testData.certificates.list));
    engineService.getInfo.and.returnValue(of(engineInfo));
    southConnectorService.get.and.returnValue(
      of({ ...southConnector, items: southConnector.items.map(element => ({ ...element, scanModeId: element.scanMode.id })) })
    );
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
    expect(tester.southItems.length).toBe(2);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('scanMode1');
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
    southConnectorService.get.and.returnValue(
      of({
        ...southConnector,
        items: southConnector.items.map(element => ({ ...element, scanModeId: element.scanMode.id })),
        enabled: false
      })
    );
    tester.detectChanges();
    tester.toggleButton.click();
    expect(southConnectorService.startSouth).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnector.name });
  });
});
