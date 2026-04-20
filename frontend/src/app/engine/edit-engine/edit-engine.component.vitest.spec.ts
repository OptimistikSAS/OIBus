import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EditEngineComponent } from './edit-engine.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
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
  readonly submitButton = this.root.getByCss('#save-button');
}

describe('EditEngineComponent', () => {
  let tester: EditEngineComponentTester;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<PortRedirectModalComponent>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;
  let router: Router;

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
    engineService.updateEngineSettings.mockReturnValue(
      of({
        needsRedirect: false,
        newPort: null
      })
    );

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
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

  test('should update engine settings', async () => {
    await tester.name.fill('OIBus Dev');
    await tester.proxyPort.fill('8000');
    await tester.proxyEnabled.click();
    await tester.consoleLevel.selectOptions('Error');
    await tester.fileNumberOfFiles.fill('10');
    await tester.lokiLevel.selectOptions('Silent');
    await tester.oiaLevel.selectOptions('Error');
    await tester.submitButton.click();

    expect(engineService.updateEngineSettings).toHaveBeenCalledWith({
      name: 'OIBus Dev',
      port: 2223,
      proxyEnabled: false,
      proxyPort: null,
      logParameters: {
        console: {
          level: 'error'
        },
        file: {
          level: 'trace',
          numberOfFiles: 10,
          maxFileSize: 10
        },
        database: {
          level: 'silent',
          maxNumberOfLogs: 100_000
        },
        loki: {
          level: 'silent',
          interval: 60,
          address: 'http://loki.oibus.com',
          username: 'oibus',
          password: 'pass'
        },
        oia: {
          level: 'error',
          interval: 60
        }
      }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(router.navigate).toHaveBeenCalledWith(['/engine']);
  });

  test('should show redirect modal when port changes', async () => {
    const redirectModalComponent = createMock(PortRedirectModalComponent);
    modalService.mockClosedModal(redirectModalComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    engineService.updateEngineSettings.mockReturnValue(
      of({
        needsRedirect: true,
        newPort: 3333
      })
    );

    await tester.port.fill('3333');
    await tester.submitButton.click();

    expect(engineService.updateEngineSettings).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
    expect(redirectModalComponent.initialize).toHaveBeenCalledWith(3333);
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
