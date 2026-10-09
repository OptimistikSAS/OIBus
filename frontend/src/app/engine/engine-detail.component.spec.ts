import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EMPTY, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ConfigImportResponseDTO } from '@oibus/shared/oia/config-transfer.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { buildEngineSettings } from '../../test/builders';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { CertificateService } from '../services/certificate.service';
import { ConfigTransferService } from '../services/config-transfer.service';
import { EngineService } from '../services/engine.service';
import { IpFilterService } from '../services/ip-filter.service';
import { ScanModeService } from '../services/scan-mode.service';
import { TransformerService } from '../services/transformer.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { fakeModal, MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { NotificationService } from '../shared/notification.service';
import { METRICS_REFRESH_INTERVAL_MS } from '../shared/polling';
import { PortRedirectModalComponent } from '../shared/port-redirect-modal/port-redirect-modal.component';
import { WindowService } from '../shared/window.service';
import { ImportConfigModalComponent } from './config-transfer/import-config-modal/import-config-modal.component';
import { EditEngineLoggerModalComponent } from './edit-engine-logger-modal/edit-engine-logger-modal.component';
import { EditEngineNameModalComponent } from './edit-engine-name-modal/edit-engine-name-modal.component';
import { EditEngineProxyModalComponent } from './edit-engine-proxy-modal/edit-engine-proxy-modal.component';
import { EditEngineWebServerModalComponent } from './edit-engine-web-server-modal/edit-engine-web-server-modal.component';
import { EngineDetailComponent } from './engine-detail.component';

class EngineDetailComponentTester {
  readonly fixture = TestBed.createComponent(EngineDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly settingRows = this.root.getByCss('table.mb-3 tr');
  readonly restartButton = this.root.getByRole('button', { name: 'Restart' });
  readonly exportConfigButton = this.root.getByCss('#export-config');
  readonly importConfigButton = this.root.getByCss('#import-config');
  readonly memoryDumpButton = this.root.getByCss('#memory-dump');
  readonly engineMetrics = this.root.getByCss('oib-engine-metrics');
}

type EngineSettingsModal =
  EditEngineNameModalComponent | EditEngineWebServerModalComponent | EditEngineProxyModalComponent | EditEngineLoggerModalComponent;

const importResponse: ConfigImportResponseDTO = {
  fromVersion: '3.10.0',
  toVersion: '3.10.0',
  appliedUpgrades: [],
  warnings: [],
  newPort: null
};

describe('EngineDetailComponent', () => {
  let engineService: MockObject<EngineService>;
  let windowService: MockObject<WindowService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let configTransferService: MockObject<ConfigTransferService>;
  let modalService: MockModalService<
    ImportConfigModalComponent | AuditHistoryModalComponent | PortRedirectModalComponent | EngineSettingsModal
  >;
  const engineSettings = buildEngineSettings();

  beforeEach(() => {
    engineService = createMock(EngineService);
    windowService = createMock(WindowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    configTransferService = createMock(ConfigTransferService);
    const scanModeService = createMock(ScanModeService);
    const ipFilterService = createMock(IpFilterService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);

    // used by the help links of the lists
    windowService.languageToUse.mockReturnValue('en');
    engineService.getEngineSettings.mockReturnValue(of(engineSettings));
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    engineService.getEngineMetrics.mockReturnValue(of(testData.engine.metrics));
    scanModeService.list.mockReturnValue(of([]));
    ipFilterService.list.mockReturnValue(of([]));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
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

    await expect.element(tester.title).toHaveTextContent('Engine');
    await expect.element(tester.settingRows.nth(0)).toMatchTextContent('NameOIBus Test');
    await expect.element(tester.settingRows.nth(1)).toMatchTextContent('Port2223');
    await expect.element(tester.settingRows.nth(2)).toMatchTextContent('7 days');
    await expect.element(tester.settingRows.nth(3)).toMatchTextContent('Proxy serverEnabled on port 8888');
    await expect
      .element(tester.settingRows.nth(4))
      .toMatchTextContent('Console: silent|File: trace|Database: silent|Loki: error|Syslog: silent|OIAnalytics: silent');
    await expect.element(tester.settingRows.nth(5)).toMatchTextContent('90 days');
  });

  test('should display a disabled proxy server and no audit retention duration', async () => {
    engineService.getEngineSettings.mockReturnValue(
      of(buildEngineSettings({ auditRetentionDuration: null, proxyServer: { ...engineSettings.proxyServer, enabled: false } }))
    );
    const tester = new EngineDetailComponentTester();

    await expect.element(tester.settingRows.nth(3)).toMatchTextContent('Proxy serverDisabled');
    await expect.element(tester.settingRows.nth(5)).toMatchTextContent('0 days');
  });

  test.each<[string, Type<EngineSettingsModal>]>([
    ['#edit-name-button', EditEngineNameModalComponent],
    ['#edit-web-server-button', EditEngineWebServerModalComponent],
    ['#edit-proxy-button', EditEngineProxyModalComponent],
    ['#edit-logger-button', EditEngineLoggerModalComponent]
  ])('should open the edit modal with %s and refresh the settings once it is closed', async (button, modalComponent) => {
    const fakeModalComponent = createMock(modalComponent);
    modalService.mockClosedModal(fakeModalComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    const tester = new EngineDetailComponentTester();
    await expect.element(tester.settingRows.nth(0)).toMatchTextContent('OIBus Test');
    engineService.getEngineSettings.mockReturnValue(of(buildEngineSettings({ general: { name: 'Renamed' } })));

    await tester.root.getByCss(button).click();

    expect(openSpy.mock.lastCall?.[0]).toBe(modalComponent);
    expect(fakeModalComponent.initialize).toHaveBeenCalledWith(engineSettings);
    await expect.element(tester.settingRows.nth(0)).toMatchTextContent('Renamed');
    expect(engineService.getEngineSettings).toHaveBeenCalledTimes(2);
  });

  test('should not refresh the settings when an edit modal is dismissed', async () => {
    modalService.mockDismissedModal(createMock(EditEngineNameModalComponent));
    const tester = new EngineDetailComponentTester();

    await tester.root.getByCss('#edit-name-button').click();

    expect(engineService.getEngineSettings).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['#show-audit-general-button', 'engine_general'],
    ['#show-audit-web-server-button', 'engine_web_server'],
    ['#show-audit-proxy-button', 'engine_proxy_server'],
    ['#show-audit-logger-button', 'engine_logging']
  ])('should open the audit history of an engine settings section with %s', async (button, section) => {
    const fakeAuditComponent = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeAuditComponent);
    const tester = new EngineDetailComponentTester();

    await tester.root.getByCss(button).click();

    expect(fakeAuditComponent.prepare).toHaveBeenCalledWith(section, engineSettings.id);
  });

  describe('metrics polling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });

    afterEach(() => vi.useRealTimers());

    test('should display the engine metrics and refresh them periodically', async () => {
      engineService.getEngineMetrics.mockReturnValueOnce(of(testData.engine.metrics));
      engineService.getEngineMetrics.mockReturnValue(of({ ...testData.engine.metrics, processCpuUsageInstant: 0.5 }));
      const tester = new EngineDetailComponentTester();

      await vi.advanceTimersByTimeAsync(0);
      expect(engineService.getEngineMetrics).toHaveBeenCalledTimes(1);
      await expect.element(tester.engineMetrics).toMatchTextContent('0.00%');

      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(engineService.getEngineMetrics).toHaveBeenCalledTimes(2);
      await expect.element(tester.engineMetrics).toMatchTextContent('50.00%');

      tester.fixture.destroy();
      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(engineService.getEngineMetrics).toHaveBeenCalledTimes(2);
    });
  });

  test('should restart after confirmation', async () => {
    const restartSubject = new Subject<void>();
    engineService.restart.mockReturnValue(restartSubject);
    confirmationService.confirm.mockReturnValue(of(undefined));
    const tester = new EngineDetailComponentTester();

    await tester.restartButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'engine.confirm-restart' });
    expect(engineService.restart).toHaveBeenCalled();
    await expect.element(tester.restartButton).toBeDisabled();

    restartSubject.next();
    restartSubject.complete();

    expect(notificationService.success).toHaveBeenCalledWith('engine.restart-complete');
    await expect.element(tester.restartButton).toBeEnabled();
  });

  test('should not restart if not confirmed', async () => {
    confirmationService.confirm.mockReturnValue(EMPTY);
    const tester = new EngineDetailComponentTester();

    await tester.restartButton.click();

    expect(engineService.restart).not.toHaveBeenCalled();
    expect(notificationService.success).not.toHaveBeenCalled();
  });

  test('should dump memory after confirmation', async () => {
    engineService.dumpMemory.mockReturnValue(of({ filename: 'oibus-memory-dump.heapsnapshot' }));
    confirmationService.confirm.mockReturnValue(of(undefined));
    const tester = new EngineDetailComponentTester();

    await tester.memoryDumpButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      titleKey: 'engine.confirm-memory-dump-title',
      messageKey: 'engine.confirm-memory-dump'
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.memory-dump-complete', {
      filename: 'oibus-memory-dump.heapsnapshot'
    });
  });

  test('should not dump memory if not confirmed', async () => {
    confirmationService.confirm.mockReturnValue(EMPTY);
    const tester = new EngineDetailComponentTester();

    await tester.memoryDumpButton.click();

    expect(engineService.dumpMemory).not.toHaveBeenCalled();
  });

  test('should export the configuration', async () => {
    const exportSubject = new Subject<void>();
    configTransferService.export.mockReturnValue(exportSubject);
    const tester = new EngineDetailComponentTester();

    await tester.exportConfigButton.click();

    expect(configTransferService.export).toHaveBeenCalled();
    await expect.element(tester.exportConfigButton).toBeDisabled();
    exportSubject.complete();
    await expect.element(tester.exportConfigButton).toBeEnabled();
  });

  test('should show an error notification when the export fails', async () => {
    configTransferService.export.mockReturnValue(throwError(() => 'boom'));
    const tester = new EngineDetailComponentTester();

    await tester.exportConfigButton.click();

    expect(notificationService.errorMessage).toHaveBeenCalledWith('boom');
  });

  describe('config import', () => {
    test('should reload the page once the import modal closes with a result', async () => {
      modalService.mockClosedModal(createMock(ImportConfigModalComponent), importResponse);
      const tester = new EngineDetailComponentTester();

      await tester.importConfigButton.click();

      expect(windowService.reload).toHaveBeenCalled();
    });

    test('should reload the page when the import modal is dismissed (e.g. Escape/backdrop) after a successful import', async () => {
      const fakeImportComponent = createMock(ImportConfigModalComponent, { result: signal(importResponse) });
      fakeImportComponent.canDismiss.mockReturnValue(true);
      // A dismissal (unlike an explicit close) completes the result without a value: only `beforeDismiss` can reload.
      modalService.mockDismissedModal(fakeImportComponent);
      const openSpy = vi.spyOn(modalService, 'open');
      const tester = new EngineDetailComponentTester();
      await tester.importConfigButton.click();

      const canDismiss = await openSpy.mock.lastCall![1]!.beforeDismiss!();

      expect(canDismiss).toBe(true);
      expect(windowService.reload).toHaveBeenCalled();
    });

    test('should not reload the page when the import modal is dismissed before any import has completed', async () => {
      const fakeImportComponent = createMock(ImportConfigModalComponent, { result: signal(null) });
      fakeImportComponent.canDismiss.mockReturnValue(true);
      modalService.mockDismissedModal(fakeImportComponent);
      const openSpy = vi.spyOn(modalService, 'open');
      const tester = new EngineDetailComponentTester();
      await tester.importConfigButton.click();

      const canDismiss = await openSpy.mock.lastCall![1]!.beforeDismiss!();

      expect(canDismiss).toBe(true);
      expect(windowService.reload).not.toHaveBeenCalled();
    });

    test('should not reload the page when the dismissal of the import modal is refused', async () => {
      const fakeImportComponent = createMock(ImportConfigModalComponent, { result: signal(importResponse) });
      fakeImportComponent.canDismiss.mockReturnValue(of(false));
      modalService.mockDismissedModal(fakeImportComponent);
      const openSpy = vi.spyOn(modalService, 'open');
      const tester = new EngineDetailComponentTester();
      await tester.importConfigButton.click();

      const canDismiss = await openSpy.mock.lastCall![1]!.beforeDismiss!();

      expect(canDismiss).toBe(false);
      expect(windowService.reload).not.toHaveBeenCalled();
    });

    test('should redirect to the new port instead of reloading when the import changed the web server port', async () => {
      const redirectComponent = createMock(PortRedirectModalComponent);
      const openSpy = vi
        .spyOn(modalService, 'open')
        .mockImplementation(component =>
          component === PortRedirectModalComponent
            ? fakeModal(redirectComponent)
            : fakeModal(createMock(ImportConfigModalComponent), Promise.resolve({ ...importResponse, newPort: 2224 }))
        );
      const tester = new EngineDetailComponentTester();

      await tester.importConfigButton.click();

      await vi.waitFor(() => expect(redirectComponent.initialize).toHaveBeenCalledWith(2224));
      expect(openSpy.mock.lastCall?.[1]).toEqual({ backdrop: 'static', keyboard: false });
      expect(windowService.reload).not.toHaveBeenCalled();
    });
  });
});
