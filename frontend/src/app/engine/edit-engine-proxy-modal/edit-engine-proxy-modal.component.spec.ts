import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildEngineSettings } from '../../../test/builders';
import { catchUnhandledErrors } from '../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { NotificationService } from '../../shared/notification.service';
import { EditEngineProxyModalComponent } from './edit-engine-proxy-modal.component';

const disabledProxy: EngineSettingsDTO['proxyServer'] = {
  enabled: false,
  port: null,
  username: null,
  password: null,
  forward: { enabled: false, url: null, username: null, password: null }
};

const forwardingProxy: EngineSettingsDTO['proxyServer'] = {
  enabled: true,
  port: 3128,
  username: 'proxy-user',
  password: 'proxy-password',
  forward: { enabled: true, url: 'http://upstream:3128', username: 'forward-user', password: 'forward-password' }
};

class EditEngineProxyModalTester {
  readonly fixture = TestBed.createComponent(EditEngineProxyModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly proxyEnabled = this.root.getByLabelText('Enabled');
  readonly port = this.root.getByLabelText('Port');
  readonly username = this.root.getByCss('#proxy-username');
  readonly password = this.root.getByCss('#proxy-password');
  readonly forwardEnabled = this.root.getByLabelText('Forward to upstream proxy');
  readonly forwardUrl = this.root.getByLabelText('URL');
  readonly forwardUsername = this.root.getByCss('#forward-proxy-username');
  readonly forwardPassword = this.root.getByCss('#forward-proxy-password');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor(proxyServer: EngineSettingsDTO['proxyServer']) {
    this.fixture.componentInstance.initialize(buildEngineSettings({ proxyServer }));
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
    engineService.updateEngineProxy.mockReturnValue(of(undefined));

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

  test('should only display the toggle when the proxy is disabled', async () => {
    const tester = new EditEngineProxyModalTester(disabledProxy);

    await expect.element(tester.proxyEnabled).not.toBeChecked();
    await expect.element(tester.port).not.toBeInTheDocument();
    await expect.element(tester.forwardEnabled).not.toBeInTheDocument();
    await expect.element(tester.forwardUrl).not.toBeInTheDocument();
  });

  test('should save a disabled proxy and close the modal', async () => {
    const tester = new EditEngineProxyModalTester(disabledProxy);

    await tester.saveButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: false,
      port: null,
      username: null,
      password: null,
      forward: { enabled: false, url: undefined, username: null, password: null }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should display every field of a forwarding proxy', async () => {
    const tester = new EditEngineProxyModalTester(forwardingProxy);

    await expect.element(tester.proxyEnabled).toBeChecked();
    await expect.element(tester.port).toHaveValue(3128);
    await expect.element(tester.username).toHaveValue('proxy-user');
    await expect.element(tester.password).toHaveValue('proxy-password');
    await expect.element(tester.forwardEnabled).toBeChecked();
    await expect.element(tester.forwardUrl).toHaveValue('http://upstream:3128');
    await expect.element(tester.forwardUsername).toHaveValue('forward-user');
    await expect.element(tester.forwardPassword).toHaveValue('forward-password');
  });

  test('should enable the proxy and save its own credentials', async () => {
    const tester = new EditEngineProxyModalTester(disabledProxy);

    await tester.proxyEnabled.click();
    await expect.element(tester.forwardEnabled).not.toBeChecked();
    await expect.element(tester.forwardUrl).not.toBeInTheDocument();

    await tester.saveButton.click();
    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();

    await tester.port.fill('3128');
    await tester.username.fill('proxy-user');
    await tester.password.fill('proxy-password');
    await tester.saveButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: true,
      port: 3128,
      username: 'proxy-user',
      password: 'proxy-password',
      forward: { enabled: false, url: undefined, username: null, password: null }
    });
  });

  test('should save the forward proxy credentials, separate from the proxy server ones', async () => {
    const tester = new EditEngineProxyModalTester({ ...disabledProxy, enabled: true, port: 3128 });

    await tester.forwardEnabled.click();
    await tester.saveButton.click();
    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();

    await tester.username.fill('proxy-user');
    await tester.forwardUrl.fill('http://upstream:3128');
    await tester.forwardUsername.fill('forward-user');
    await tester.forwardPassword.fill('forward-password');
    await tester.saveButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: true,
      port: 3128,
      username: 'proxy-user',
      password: null,
      forward: { enabled: true, url: 'http://upstream:3128', username: 'forward-user', password: 'forward-password' }
    });
  });

  test('should clear the forward proxy when it is disabled', async () => {
    const tester = new EditEngineProxyModalTester(forwardingProxy);

    await tester.forwardEnabled.click();
    await expect.element(tester.forwardUrl).not.toBeInTheDocument();
    await tester.saveButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: true,
      port: 3128,
      username: 'proxy-user',
      password: 'proxy-password',
      forward: { enabled: false, url: undefined, username: null, password: null }
    });
  });

  test('should clear every setting when the proxy is disabled', async () => {
    const tester = new EditEngineProxyModalTester(forwardingProxy);

    await tester.proxyEnabled.click();
    await expect.element(tester.port).not.toBeInTheDocument();
    await expect.element(tester.forwardEnabled).not.toBeInTheDocument();

    await tester.proxyEnabled.click();
    await expect.element(tester.port).toHaveValue(null);
    await expect.element(tester.username).toHaveValue('');
    await expect.element(tester.forwardEnabled).not.toBeChecked();
    await tester.proxyEnabled.click();
    await tester.saveButton.click();

    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      enabled: false,
      port: null,
      username: null,
      password: null,
      forward: { enabled: false, url: undefined, username: null, password: null }
    });
  });

  test('should keep the modal open when the save fails', async () => {
    const unhandledError = catchUnhandledErrors();
    engineService.updateEngineProxy.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new EditEngineProxyModalTester(disabledProxy);

    await tester.saveButton.click();

    await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new EditEngineProxyModalTester(disabledProxy);

    await tester.cancelButton.click();

    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
