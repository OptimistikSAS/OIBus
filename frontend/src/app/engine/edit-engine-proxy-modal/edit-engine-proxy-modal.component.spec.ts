import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { EditEngineProxyModalComponent } from './edit-engine-proxy-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';

const engineSettings = {
  proxyServer: {
    enabled: false,
    port: null,
    username: null,
    password: null,
    forward: {
      enabled: false,
      url: null,
      username: null,
      password: null
    }
  }
} as EngineSettingsDTO;

class EditEngineProxyModalTester {
  readonly fixture = TestBed.createComponent(EditEngineProxyModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly proxyEnabledCheckbox = this.root.getByCss('#proxy-enabled');
  readonly proxyUsername = this.root.getByCss('#proxy-username');
  readonly proxyPassword = this.root.getByCss('#proxy-password');
  readonly forwardProxyEnabled = this.root.getByCss('#forward-proxy-enabled');
  readonly forwardProxyUrl = this.root.getByCss('#forward-proxy-url');
  readonly forwardProxyUsername = this.root.getByCss('#forward-proxy-username');
  readonly forwardProxyPassword = this.root.getByCss('#forward-proxy-password');
  readonly saveButton = this.root.getByCss('#save-proxy-button');
  readonly cancelButton = this.root.getByCss('#cancel-proxy-button');

  get componentInstance() {
    return this.fixture.componentInstance;
  }
}

describe('EditEngineProxyModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should initialize the form with proxy settings', async () => {
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await expect.element(tester.proxyEnabledCheckbox).not.toBeChecked();
    await expect.element(tester.forwardProxyEnabled).not.toBeInTheDocument();
    await expect.element(tester.forwardProxyUrl).not.toBeInTheDocument();
    await expect.element(tester.forwardProxyUsername).not.toBeInTheDocument();
    await expect.element(tester.forwardProxyPassword).not.toBeInTheDocument();
  });

  test('should save proxy settings and close modal', async () => {
    engineService.updateEngineProxy.mockReturnValue(of(undefined));
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize({
      ...engineSettings,
      proxyServer: { ...engineSettings.proxyServer, enabled: false, port: null }
    });
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: false,
      port: null,
      username: null,
      password: null,
      forward: {
        enabled: false,
        url: undefined,
        username: null,
        password: null
      }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should display forward proxy fields when forward is enabled from init', async () => {
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize({
      ...engineSettings,
      proxyServer: {
        ...engineSettings.proxyServer,
        enabled: true,
        port: 3128,
        forward: { enabled: true, url: null, username: null, password: null }
      }
    });
    tester.fixture.detectChanges();
    await expect.element(tester.forwardProxyUrl).toBeInTheDocument();
  });

  test('should display forward proxy fields only when forward is enabled', async () => {
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize({
      ...engineSettings,
      proxyServer: { ...engineSettings.proxyServer, enabled: true, port: 3128 }
    });
    tester.fixture.detectChanges();

    await expect.element(tester.forwardProxyUrl).not.toBeInTheDocument();
    await expect.element(tester.forwardProxyUsername).not.toBeInTheDocument();
    await expect.element(tester.forwardProxyPassword).not.toBeInTheDocument();

    await tester.forwardProxyEnabled.click();
    tester.fixture.detectChanges();

    await expect.element(tester.forwardProxyUrl).toBeInTheDocument();
    await expect.element(tester.forwardProxyUsername).toBeInTheDocument();
    await expect.element(tester.forwardProxyPassword).toBeInTheDocument();
  });

  test('should save its own forward proxy credentials, separate from the proxy server ones', () => {
    engineService.updateEngineProxy.mockReturnValue(of(undefined));
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize({
      ...engineSettings,
      proxyServer: { ...engineSettings.proxyServer, enabled: true, port: 3128 }
    });
    tester.fixture.detectChanges();

    const controls = tester.componentInstance.form.controls;
    controls.proxyUsername.setValue('proxyuser');
    controls.proxyPassword.setValue('proxypass');
    controls.forwardProxyEnabled.setValue(true);
    controls.forwardProxyUrl.setValue('http://upstream.proxy:3128');
    controls.forwardProxyUsername.setValue('forwarduser');
    controls.forwardProxyPassword.setValue('forwardpass');

    tester.componentInstance.save();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        username: 'proxyuser',
        password: 'proxypass',
        forward: {
          enabled: true,
          url: 'http://upstream.proxy:3128',
          username: 'forwarduser',
          password: 'forwardpass'
        }
      })
    );
  });

  test('should dismiss modal on cancel', async () => {
    const tester = new EditEngineProxyModalTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
