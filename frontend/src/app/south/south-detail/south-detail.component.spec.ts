import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SouthDetailComponent } from './south-detail.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ModalService } from '../../shared/modal.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorDTO } from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const southConnector = testData.south.list[0] as unknown as SouthConnectorDTO;
const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const oibusInfo = testData.engine.oIBusInfo;

const activatedRouteStub = {
  snapshot: { queryParamMap: { getAll: () => [], get: () => null } },
  paramMap: of({ get: (key: string) => (key === 'southId' ? southConnector.id : null) }),
  queryParamMap: of({ get: (_key: string) => null, getAll: (_key: string) => [] as Array<string> })
};

describe('SouthDetailComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const engineService = createMock(EngineService);
    const windowService = createMock(WindowService);
    notificationService = createMock(NotificationService);
    const confirmationService = createMock(ConfirmationService);
    const modalService = createMock(ModalService);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    (engineService as any).info$ = of(oibusInfo);
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getGroups.mockReturnValue(of([]));
    southConnectorService.start.mockReturnValue(of(undefined));
    southConnectorService.stop.mockReturnValue(of(undefined));
    windowService.getStorageItem.mockReturnValue('token');

    function MockEventSource(this: { addEventListener: () => void; close: () => void }) {
      this.addEventListener = vi.fn();
      this.close = vi.fn();
    }
    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
      configurable: true
    });

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: EngineService, useValue: engineService },
        { provide: WindowService, useValue: windowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  test('should display south connector title', async () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#title')).toHaveTextContent(southConnector.name);
  });

  test('should toggle connector on', () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(true);

    expect(southConnectorService.start).toHaveBeenCalledWith(southConnector.id);
  });

  test('should toggle connector off', () => {
    const fixture = TestBed.createComponent(SouthDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(false);

    expect(southConnectorService.stop).toHaveBeenCalledWith(southConnector.id);
  });
});
