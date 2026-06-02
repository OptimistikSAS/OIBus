import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EditEngineComponent } from './edit-engine.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class EditEngineComponentTester {
  readonly fixture = TestBed.createComponent(EditEngineComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly componentInstance = this.fixture.componentInstance;
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly name = this.root.getByCss('#name');
  readonly port = this.root.getByCss('#port');
  readonly proxyEnabled = this.root.getByCss('#proxy-enabled');
  readonly proxyPort = this.root.getByCss('#proxy-port');
  readonly consoleLevel = this.root.getByCss('#console-level');
  readonly fileLevel = this.root.getByCss('#file-level');
  readonly fileMaxFileSize = this.root.getByCss('#file-max-file-size');
  readonly fileNumberOfFiles = this.root.getByCss('#file-number-of-files');
  readonly databaseLevel = this.root.getByCss('#database-level');
  readonly databaseMaxNumberOfLogs = this.root.getByCss('#database-max-number-of-logs');
  readonly lokiLevel = this.root.getByCss('#loki-level');
  readonly lokiInterval = this.root.getByCss('#loki-interval');
  readonly lokiAddress = this.root.getByCss('#loki-address');
  readonly lokiUsername = this.root.getByCss('#loki-username');
  readonly lokiPassword = this.root.getByCss('#loki-password');
  readonly oiaLevel = this.root.getByCss('#oia-level');
  readonly oiaInterval = this.root.getByCss('#oia-interval');
  readonly saveNameButton = this.root.getByCss('#save-name-button');
  readonly saveWebServerButton = this.root.getByCss('#save-web-server-button');
  readonly saveProxyButton = this.root.getByCss('#save-proxy-button');
  readonly saveLoggerButton = this.root.getByCss('#save-logger-button');

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('EditEngineComponent', () => {
  let tester: EditEngineComponentTester;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<PortRedirectModalComponent>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  const engineSettings: EngineSettingsDTO = {
    id: 'id',
    name: 'OIBus Test',
    port: 2223,
    version: '3.3.3',
    launcherVersion: '3.5.0',
    proxyEnabled: true,
    proxyPort: 9000,
    logParameters: {
      console: {
        level: 'silent'
      },
      file: {
        level: 'trace',
        numberOfFiles: 5,
        maxFileSize: 10
      },
      database: {
        level: 'silent',
        maxNumberOfLogs: 100_000
      },
      loki: {
        level: 'error',
        interval: 60,
        address: 'http://loki.oibus.com',
        username: 'oibus',
        password: 'pass'
      },
      oia: {
        level: 'silent',
        interval: 60
      }
    },
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        provideI18nTesting(),
        provideModalTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    engineService.getEngineSettings.mockReturnValue(of(engineSettings));
    engineService.updateEngineName.mockReturnValue(of(undefined));
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: false, newPort: null }));
    engineService.updateEngineProxy.mockReturnValue(of(undefined));
    engineService.updateEngineLogger.mockReturnValue(of(undefined));

    modalService = TestBed.inject(MockModalService);

    tester = new EditEngineComponentTester();
  });

  test('should display title and filled form', async () => {
    await expect.element(tester.title).toHaveTextContent('Edit engine settings');
    await expect.element(tester.name).toHaveValue(engineSettings.name);
    await expect.element(tester.port).toHaveValue(engineSettings.port);
    await expect.element(tester.proxyPort).toHaveValue(engineSettings.proxyPort!);
    await expect.element(tester.proxyEnabled).toBeChecked();
    await expect.element(tester.consoleLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.fileLevel).toHaveDisplayValue('Trace');
    await expect.element(tester.fileMaxFileSize).toHaveValue(engineSettings.logParameters.file.maxFileSize);
    await expect.element(tester.fileNumberOfFiles).toHaveValue(engineSettings.logParameters.file.numberOfFiles);
    await expect.element(tester.databaseLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.databaseMaxNumberOfLogs).not.toBeInTheDocument();
    await expect.element(tester.lokiLevel).toHaveDisplayValue('Error');
    await expect.element(tester.lokiInterval).toHaveValue(engineSettings.logParameters.loki.interval);
    await expect.element(tester.lokiAddress).toHaveValue(engineSettings.logParameters.loki.address);
    await expect.element(tester.lokiUsername).toHaveValue(engineSettings.logParameters.loki.username);
    await expect.element(tester.lokiPassword).toHaveValue(engineSettings.logParameters.loki.password);
    await expect.element(tester.oiaLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.oiaInterval).not.toBeInTheDocument();
  });

  test('should update engine name', async () => {
    await tester.name.fill('OIBus Dev');
    await tester.saveNameButton.click();

    expect(engineService.updateEngineName).toHaveBeenCalledWith({ name: 'OIBus Dev' });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });

  test('should update web server port without redirect', async () => {
    await tester.port.fill('3000');
    await tester.saveWebServerButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({ port: 3000 });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });

  test('should show redirect modal when port changes', async () => {
    const redirectModalComponent = createMock(PortRedirectModalComponent);
    modalService.mockClosedModal(redirectModalComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 3333 }));

    await tester.port.fill('3333');
    await tester.saveWebServerButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
    expect(redirectModalComponent.initialize).toHaveBeenCalledWith(3333);
    expect(notificationService.success).not.toHaveBeenCalled();
  });

  test('should update proxy settings', async () => {
    await tester.proxyEnabled.click();
    await tester.saveProxyButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({ proxyEnabled: false, proxyPort: null });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });

  test('should update logger settings', async () => {
    await tester.consoleLevel.selectOptions('Error');
    await tester.fileNumberOfFiles.fill('10');
    await tester.saveLoggerButton.click();

    expect(engineService.updateEngineLogger).toHaveBeenCalledWith({
      logParameters: {
        console: { level: 'error' },
        file: { level: 'trace', numberOfFiles: 10, maxFileSize: 10 },
        database: { level: 'silent', maxNumberOfLogs: 100_000 },
        loki: { level: 'error', interval: 60, address: 'http://loki.oibus.com', username: 'oibus', password: 'pass' },
        oia: { level: 'silent', interval: 60 }
      }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });

  test('should not save name when form is invalid', () => {
    tester.componentInstance.nameForm.controls.name.setValue('');
    tester.componentInstance.saveName();

    expect(engineService.updateEngineName).not.toHaveBeenCalled();
  });

  test('should not save web server when form is invalid', () => {
    tester.componentInstance.webServerForm.controls.port.setValue(null);
    tester.componentInstance.saveWebServer();

    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();
  });

  test('should not save proxy when form is invalid', () => {
    tester.componentInstance.proxyForm.controls.proxyEnabled.setValue(true);
    tester.componentInstance.proxyForm.controls.proxyPort.setValue(null);
    tester.componentInstance.proxyForm.controls.proxyPort.enable();
    tester.componentInstance.saveProxy();

    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();
  });

  test('should not save logger when form is invalid', () => {
    tester.componentInstance.loggerForm.controls.logParameters.controls.oia.controls.level.setValue('info');
    tester.componentInstance.loggerForm.controls.logParameters.controls.oia.controls.interval.setValue(null);
    tester.componentInstance.loggerForm.controls.logParameters.controls.oia.controls.interval.enable();
    tester.componentInstance.saveLogger();

    expect(engineService.updateEngineLogger).not.toHaveBeenCalled();
  });

  test('should return true from canDeactivate when no form is dirty', () => {
    const result = tester.componentInstance.canDeactivate();
    expect(result).toBe(true);
    expect(unsavedChangesConfirmationService.confirmUnsavedChanges).not.toHaveBeenCalled();
  });

  test('should call confirmUnsavedChanges from canDeactivate when a form is dirty', () => {
    const obs = new Subject<boolean>().asObservable();
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(obs);
    tester.componentInstance.nameForm.markAsDirty();

    const result = tester.componentInstance.canDeactivate();

    expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    expect(result).toBe(obs);
  });
});
