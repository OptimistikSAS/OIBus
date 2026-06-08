import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { provideRouter } from '@angular/router';

import { EngineDetailComponent } from './engine-detail.component';
import { EngineService } from '../services/engine.service';
import { WindowService } from '../shared/window.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ScanModeService } from '../services/scan-mode.service';
import { IpFilterService } from '../services/ip-filter.service';
import { CertificateService } from '../services/certificate.service';
import { TransformerService } from '../services/transformer.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { EngineSettingsDTO } from '../../../../backend/shared/model/engine.model';

class EngineDetailComponentTester {
  readonly fixture = TestBed.createComponent(EngineDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly generalSettings = this.root.getByCss('table tr');
  readonly restartButton = this.root.getByCss('#restart');
}

const engineSettings: EngineSettingsDTO = {
  id: 'id',
  name: 'OIBus Test',
  port: 2223,
  logParameters: {
    console: { level: 'silent' },
    file: { level: 'trace' },
    database: { level: 'silent' },
    loki: { level: 'error' },
    oia: { level: 'silent' }
  },
  proxyEnabled: true,
  proxyPort: 8888
} as EngineSettingsDTO;

describe('EngineDetailComponent', () => {
  let engineService: MockObject<EngineService>;
  let windowService: MockObject<WindowService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let scanModeService: MockObject<ScanModeService>;
  let ipFilterService: MockObject<IpFilterService>;
  let certificateService: MockObject<CertificateService>;
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    windowService = createMock(WindowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    scanModeService = createMock(ScanModeService);
    ipFilterService = createMock(IpFilterService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);

    engineService.getEngineSettings.mockReturnValue(of(engineSettings));
    scanModeService.list.mockReturnValue(of([]));
    ipFilterService.list.mockReturnValue(of([]));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    windowService.getStorageItem.mockReturnValue('token');

    function MockEventSource(this: { onmessage: null; close: () => void }) {
      this.onmessage = null;
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
        { provide: EngineService, useValue: engineService },
        { provide: WindowService, useValue: windowService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService }
      ]
    });
  });

  test('should display engine settings', async () => {
    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    await expect.element(tester.generalSettings.nth(0)).toHaveTextContent('OIBus Test');
    await expect.element(tester.generalSettings.nth(1)).toHaveTextContent('2223');
    await expect.element(tester.generalSettings.nth(2)).toHaveTextContent('8888');
    await expect.element(tester.generalSettings.nth(3)).toHaveTextContent('silent');
  });

  test('should restart', () => {
    const restartSubject = new Subject<void>();
    engineService.restart.mockReturnValue(restartSubject);
    confirmationService.confirm.mockReturnValue(of(undefined));

    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.restart();

    restartSubject.next();

    expect(engineService.restart).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.restart-complete');
  });
});
