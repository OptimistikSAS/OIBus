import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { RegistrationSettingsCommandDTO } from '@oibus/shared/api/engine.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { NotificationService } from '../../../shared/notification.service';
import { RegisterOibusModalComponent } from './register-oibus-modal.component';

const registration = testData.oIAnalytics.registration.completed;

class RegisterOibusModalComponentTester {
  readonly fixture = TestBed.createComponent(RegisterOibusModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly host = this.root.getByLabelText('Host');
  readonly useProxy = this.root.getByLabelText('Use proxy');
  readonly proxyUrl = this.root.getByLabelText('Proxy URL');
  readonly proxyPassword = this.root.getByLabelText('Proxy password');
  readonly useApiGateway = this.root.getByLabelText('Use API Gateway');
  readonly apiGatewayHeaderValue = this.root.getByLabelText('Secret Header Value');
  readonly commandRefreshInterval = this.root.getByLabelText('Command retrieve interval (from OIAnalytics)');
  readonly updateVersion = this.root.getByRole('checkbox', { name: 'Upgrade' });
  readonly restartEngine = this.root.getByRole('checkbox', { name: 'Restart' });
  readonly restartEngineLabel = this.root.getByCss('label[for="permission-restartEngine"]');
  readonly createNorth = this.root.getByCss('#permission-createNorth');
  readonly permissions = this.root.getByCss('[formgroupname="commandPermissions"] input[type="checkbox"]');
  readonly allowAllOIBus = this.root.getByCss('#allow-all-oibus');
  readonly allowNoneOIBus = this.root.getByCss('#allow-none-oibus');
  readonly allowAllConnectors = this.root.getByCss('#allow-all-connectors');
  readonly allowNoneConnectors = this.root.getByCss('#allow-none-connectors');
  readonly allowAllHistoryQueries = this.root.getByCss('#allow-all-history-query');
  readonly allowNoneHistoryQueries = this.root.getByCss('#allow-none-history-query');
  readonly remoteUpdateDisabled = this.root.getByCss('#remote-update-disabled');
  readonly testButton = this.root.getByRole('button', { name: 'Test connection' });
  readonly testSuccess = this.root.getByCss('#test-success');
  readonly testError = this.root.getByCss('#test-error');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

describe('RegisterOibusModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    engineService.register.mockReturnValue(of(undefined));
    engineService.editRegistrationSettings.mockReturnValue(of(undefined));
    engineService.testOIAnalyticsConnection.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  function expectedCommand(overrides: Partial<RegistrationSettingsCommandDTO> = {}): RegistrationSettingsCommandDTO {
    return {
      host: registration.host,
      acceptUnauthorized: registration.acceptUnauthorized,
      useProxy: registration.useProxy,
      proxyUrl: '',
      proxyUsername: '',
      proxyPassword: '',
      useApiGateway: registration.useApiGateway,
      apiGatewayHeaderKey: '',
      apiGatewayHeaderValue: '',
      apiGatewayBaseEndpoint: '',
      commandRefreshInterval: registration.commandRefreshInterval,
      commandRetryInterval: registration.commandRetryInterval,
      messageRetryInterval: registration.messageRetryInterval,
      commandPermissions: registration.commandPermissions,
      ...overrides
    };
  }

  test('should register with the given settings', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await expect.element(tester.host).toHaveValue(registration.host);
    await expect.element(tester.host).toBeEnabled();
    await expect.element(tester.proxyUrl).not.toBeInTheDocument();
    await tester.host.fill('http://oia:4200');
    await tester.useProxy.click();
    await tester.proxyUrl.fill('http://proxy');
    await tester.proxyPassword.fill('secret');
    await tester.useApiGateway.click();
    await tester.apiGatewayHeaderValue.fill('gateway-secret');
    await tester.restartEngineLabel.click();
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({
        host: 'http://oia:4200',
        useProxy: true,
        proxyUrl: 'http://proxy',
        proxyPassword: 'secret',
        useApiGateway: true,
        apiGatewayHeaderValue: 'gateway-secret',
        commandPermissions: { ...registration.commandPermissions, restartEngine: !registration.commandPermissions.restartEngine }
      })
    );
    expect(engineService.editRegistrationSettings).not.toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should not save an invalid form', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.commandRefreshInterval.fill('0');
    await tester.saveButton.click();
    await tester.testButton.click();

    expect(engineService.register).not.toHaveBeenCalled();
    expect(engineService.testOIAnalyticsConnection).not.toHaveBeenCalled();
  });

  test('should edit the registration settings with the original host', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare({ ...registration, useProxy: true, proxyUrl: 'http://proxy' }, 'edit', false);

    await expect.element(tester.host).toBeDisabled();
    await expect.element(tester.proxyUrl).toHaveValue('http://proxy');
    await tester.saveButton.click();

    expect(engineService.editRegistrationSettings).toHaveBeenCalledWith(expectedCommand({ useProxy: true, proxyUrl: 'http://proxy' }));
    expect(engineService.register).not.toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should test the connection', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.testButton.click();

    expect(engineService.testOIAnalyticsConnection).toHaveBeenCalledWith(expectedCommand());
    await expect.element(tester.testSuccess).toBeInTheDocument();
    await expect.element(tester.testError).not.toBeInTheDocument();
    expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.test-connection-success');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should display the error of a failed connection test', async () => {
    engineService.testOIAnalyticsConnection.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Connection refused' } }))
    );
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.testButton.click();

    await expect.element(tester.testError).toHaveTextContent('Error when testing connectionConnection refused');
    await expect.element(tester.testSuccess).not.toBeInTheDocument();
    await expect.element(tester.testButton).toBeEnabled();
  });

  test('should allow all or none of the permissions of a group', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);
    await expect.element(tester.allowAllOIBus).toBeDisabled();
    await expect.element(tester.allowNoneOIBus).toBeEnabled();

    await tester.allowNoneOIBus.click();

    await expect.element(tester.allowNoneOIBus).toBeDisabled();
    await expect.element(tester.allowAllOIBus).toBeEnabled();
    await expect.element(tester.restartEngine).not.toBeChecked();
    await expect.element(tester.restartEngineLabel).toHaveClass('btn-outline-danger');
    // the other groups are left untouched
    await expect.element(tester.createNorth).toBeChecked();
    await expect.element(tester.allowAllConnectors).toBeDisabled();

    await tester.restartEngineLabel.click();
    await expect.element(tester.restartEngineLabel).toHaveClass('btn-outline-success');
    await expect.element(tester.allowNoneOIBus).toBeEnabled();

    await tester.allowNoneConnectors.click();
    await tester.allowNoneHistoryQueries.click();
    await tester.allowNoneOIBus.click();
    for (const checkbox of tester.permissions.elements()) {
      expect(checkbox).not.toBeChecked();
    }

    await tester.allowAllOIBus.click();
    await tester.allowAllConnectors.click();
    await tester.allowAllHistoryQueries.click();
    await expect.element(tester.allowAllOIBus).toBeDisabled();
    for (const checkbox of tester.permissions.elements()) {
      expect(checkbox).toBeChecked();
    }
  });

  test('should disable the update-version permission when remote update is ignored', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', true);

    await expect.element(tester.remoteUpdateDisabled).toBeInTheDocument();
    await expect.element(tester.updateVersion).toBeDisabled();
    await expect.element(tester.updateVersion).not.toBeChecked();
    // the locked permission is ignored by the group buttons
    await expect.element(tester.allowAllOIBus).toBeDisabled();

    await tester.allowNoneOIBus.click();
    await tester.allowAllOIBus.click();
    await expect.element(tester.updateVersion).not.toBeChecked();
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({ commandPermissions: { ...registration.commandPermissions, updateVersion: false } })
    );
  });

  test('should group the diagnostic permissions in their own section', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await expect.element(tester.root.getByCss('#permission-section-diagnostic')).toHaveTextContent('Diagnostic');
    const diagnostic = tester.root.getByRole('group', { name: 'Diagnostic' });
    await expect.element(diagnostic.getByRole('checkbox', { name: 'Memory dump' })).toBeChecked();
    await expect.element(diagnostic.getByRole('checkbox', { name: 'Logs database' })).toBeChecked();
    await expect.element(diagnostic.getByRole('checkbox')).toHaveLength(2);
  });

  test('should cancel', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
