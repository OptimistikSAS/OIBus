import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';
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
import { ConfigTransferService } from '../services/config-transfer.service';
import { ImportConfigModalComponent } from './config-transfer/import-config-modal/import-config-modal.component';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { EngineSettingsDTO } from '../../../../backend/shared/model/engine.model';
import testData from '../../../../backend/src/tests/utils/test-data';

class EngineDetailComponentTester {
  readonly fixture = TestBed.createComponent(EngineDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly generalSettings = this.root.getByCss('table tr');
  readonly restartButton = this.root.getByCss('#restart');
  readonly exportConfigButton = this.root.getByCss('#export-config');
  readonly importConfigButton = this.root.getByCss('#import-config');
}

const engineSettings: EngineSettingsDTO = {
  id: 'id',
  general: { name: 'OIBus Test' },
  webServer: { port: 2223, authTokenDuration: '7d' },
  logger: {
    console: { level: 'silent' },
    file: { level: 'trace' },
    database: { level: 'silent' },
    loki: { level: 'error' },
    syslog: { level: 'silent' },
    oia: { level: 'silent' }
  },
  proxyServer: { enabled: true, port: 8888 }
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
  let configTransferService: MockObject<ConfigTransferService>;
  let modalService: MockModalService<ImportConfigModalComponent>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    windowService = createMock(WindowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    scanModeService = createMock(ScanModeService);
    ipFilterService = createMock(IpFilterService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    configTransferService = createMock(ConfigTransferService);

    engineService.getEngineSettings.mockReturnValue(of(engineSettings));
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
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
        provideModalTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: WindowService, useValue: windowService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: ConfigTransferService, useValue: configTransferService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display engine settings', async () => {
    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    await expect.element(tester.generalSettings.nth(0)).toHaveTextContent('OIBus Test');
    await expect.element(tester.generalSettings.nth(1)).toHaveTextContent('2223');
    await expect.element(tester.generalSettings.nth(2)).toHaveTextContent('7 days');
    await expect.element(tester.generalSettings.nth(3)).toHaveTextContent('8888');
    await expect.element(tester.generalSettings.nth(4)).toHaveTextContent('silent');
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

  test('should export the configuration', async () => {
    configTransferService.export.mockReturnValue(of(undefined));

    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    await tester.exportConfigButton.click();

    expect(configTransferService.export).toHaveBeenCalled();
  });

  test('should show an error notification when the export fails', async () => {
    configTransferService.export.mockReturnValue(throwError(() => 'boom'));

    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    await tester.exportConfigButton.click();

    expect(notificationService.errorMessage).toHaveBeenCalledWith('boom');
  });

  test('should open the import config modal and reload the page once it closes with a result', async () => {
    const fakeImportComponent = createMock(ImportConfigModalComponent);
    modalService.mockClosedModal(fakeImportComponent, { appliedUpgrades: [], warnings: [] });

    const tester = new EngineDetailComponentTester();
    tester.fixture.detectChanges();

    await tester.importConfigButton.click();

    expect(windowService.reload).toHaveBeenCalled();
  });
});
