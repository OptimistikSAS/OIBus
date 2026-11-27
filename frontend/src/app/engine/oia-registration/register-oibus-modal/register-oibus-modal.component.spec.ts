import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { RegistrationSettingsCommandDTO } from '@oibus/shared/api/engine.model';
import { ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CertificateService } from '../../../services/certificate.service';
import { EngineService } from '../../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { chooseSelectOrCreateEntry, selectOrCreateEntryNames } from '../../../shared/form/select-or-create/select-or-create.testing';
import { NotificationService } from '../../../shared/notification.service';
import { TrustedCertificateCreator } from '../../certificate-list/trusted-certificate-creator.service';
import { RegisterOibusModalComponent } from './register-oibus-modal.component';

const registration = testData.oIAnalytics.registration.completed;

class RegisterOibusModalComponentTester {
  readonly fixture = TestBed.createComponent(RegisterOibusModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly host = this.root.getByLabelText('Host');
  readonly certificateValidation = this.root.getByLabelText('Server certificate validation');
  readonly trustedCertificate = this.root.getByLabelText('Trusted certificate', { exact: true });
  readonly useProxy = this.root.getByLabelText('Use proxy');
  readonly proxyUrl = this.root.getByLabelText('Proxy URL');
  readonly proxyPassword = this.root.getByLabelText('Proxy password');
  readonly useApiGateway = this.root.getByLabelText('Use API Gateway');
  readonly apiGatewayHeaderValue = this.root.getByLabelText('Secret Header Value');
  readonly commandRefreshInterval = this.root.getByLabelText('Command retrieve interval (from OIAnalytics)');
  readonly updateVersion = this.root.getByRole('switch', { name: 'Update version' });
  readonly operate = this.root.getByRole('switch', { name: 'Operate' });
  readonly configureDataFlow = this.root.getByRole('switch', { name: 'Data flow' });
  readonly diagnostics = this.root.getByRole('switch', { name: 'Diagnostics' });
  readonly permissions = this.root.getByCss('[formgroupname="commandPermissions"] input[type="checkbox"]');
  readonly allowAllLifecycle = this.root.getByCss('#allow-all-lifecycle');
  readonly allowNoneLifecycle = this.root.getByCss('#allow-none-lifecycle');
  readonly allowAllConfiguration = this.root.getByCss('#allow-all-configuration');
  readonly allowNoneConfiguration = this.root.getByCss('#allow-none-configuration');
  readonly allowAllSecurity = this.root.getByCss('#allow-all-security');
  readonly allowNoneSecurity = this.root.getByCss('#allow-none-security');
  readonly allowAllData = this.root.getByCss('#allow-all-data');
  readonly allowNoneData = this.root.getByCss('#allow-none-data');
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
    engineService.testOIAnalyticsConnection.mockReturnValue(of({ items: [] }));
    const certificateService = createMock(CertificateService);
    certificateService.list.mockReturnValue(
      of([
        { ...testData.certificates.list[0], id: 'presented', name: 'Presented', kind: 'key-pair' as const },
        { ...testData.certificates.list[1], id: 'trusted', name: 'OIAnalytics CA', kind: 'trusted' as const }
      ])
    );
    const trustedCertificateCreator = createMock(TrustedCertificateCreator, {
      createLabel: 'engine.certificate.import-trusted',
      created: signal([])
    });

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TrustedCertificateCreator, useValue: trustedCertificateCreator },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  function expectedCommand(overrides: Partial<RegistrationSettingsCommandDTO> = {}): RegistrationSettingsCommandDTO {
    return {
      host: registration.host,
      certificateValidation: registration.certificateValidation,
      trustedCertificateId: registration.trustedCertificateId,
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

  test('should validate the certificate of OIAnalytics against a trusted certificate', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await expect.element(tester.certificateValidation).toHaveDisplayValue('Standard');
    await expect.element(tester.trustedCertificate).not.toBeInTheDocument();
    await tester.certificateValidation.selectOptions('Trusted certificate');
    expect(await selectOrCreateEntryNames(tester.trustedCertificate)).toEqual(['OIAnalytics CA', 'Import a trusted certificate...']);
    await chooseSelectOrCreateEntry(tester.trustedCertificate, 'OIAnalytics CA');
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({ certificateValidation: 'trusted', trustedCertificateId: 'trusted' })
    );
  });

  test('should require a trusted certificate with the trusted validation', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(
      { ...registration, certificateValidation: 'trusted', trustedCertificateId: null },
      'register',
      false
    );

    await expect.element(tester.trustedCertificate).toBeInTheDocument();
    await tester.saveButton.click();

    expect(engineService.register).not.toHaveBeenCalled();
  });

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
    await tester.operate.click();
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({
        host: 'http://oia:4200',
        useProxy: true,
        proxyUrl: 'http://proxy',
        proxyPassword: 'secret',
        useApiGateway: true,
        apiGatewayHeaderValue: 'gateway-secret',
        commandPermissions: { ...registration.commandPermissions, operate: !registration.commandPermissions.operate }
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

  describe('identity of OIAnalytics', () => {
    const { presented } = testData.serverTrust;
    const x509: ServerIdentity = { ...testData.serverTrust.identities.x509 };

    test('should show the identity OIAnalytics presents when its certificate does not validate, and trust it in the form', async () => {
      engineService.testOIAnalyticsConnection.mockReturnValueOnce(of({ items: [], serverIdentity: { identity: x509, status: 'unknown' } }));
      const tester = new RegisterOibusModalComponentTester();
      tester.fixture.componentInstance.prepare(registration, 'register', false);

      await tester.testButton.click();
      await expect
        .element(tester.root.getByCss('#server-not-trusted'))
        .toMatchTextContent(/The certificate of OIAnalytics does not validate/);
      await expect.element(tester.testSuccess).not.toBeInTheDocument();
      await tester.root.getByRole('button', { name: 'Trust this identity' }).click();

      // tested again, trusting the identity
      expect(engineService.testOIAnalyticsConnection).toHaveBeenLastCalledWith(
        expectedCommand({ serverTrust: { identity: x509, trustOnFirstUse: false } })
      );
      await expect.element(tester.testSuccess).toBeInTheDocument();
      await expect.element(tester.root.getByCss('#server-trusted-in-form')).toBeInTheDocument();

      await tester.saveButton.click();
      expect(engineService.register).toHaveBeenCalledWith(expectedCommand({ serverTrust: { identity: x509, trustOnFirstUse: false } }));
    });

    test('should drop the identity trusted in the form when the settings connect to another server', async () => {
      engineService.testOIAnalyticsConnection.mockReturnValueOnce(of({ items: [], serverIdentity: presented.changed }));
      const tester = new RegisterOibusModalComponentTester();
      tester.fixture.componentInstance.prepare(registration, 'register', false);

      await tester.testButton.click();
      await expect.element(tester.root.getByCss('#server-not-trusted')).toHaveClass('alert-danger');
      await tester.root.getByRole('button', { name: 'Trust this identity' }).click();
      await tester.host.fill('https://another-oia');
      await tester.saveButton.click();

      expect(engineService.register).toHaveBeenCalledWith(expectedCommand({ host: 'https://another-oia' }));
    });
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

  test('should display the fields rejected by the validation of the connection test', async () => {
    const rejected = {
      'command.commandPermissions.restartEngine': {
        message: '"restartEngine" is an excess property with value true',
        value: true
      }
    };
    engineService.testOIAnalyticsConnection.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: rejected } }))
    );
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.testButton.click();

    await expect
      .element(tester.testError)
      .toHaveTextContent(
        'Error when testing connectioncommandPermissions.restartEngine: "restartEngine" is an excess property with value true'
      );
  });

  test('should allow all or none of the permissions of a group', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);
    await expect.element(tester.allowAllLifecycle).toBeDisabled();
    await expect.element(tester.allowNoneLifecycle).toBeEnabled();

    await tester.allowNoneLifecycle.click();

    await expect.element(tester.allowNoneLifecycle).toBeDisabled();
    await expect.element(tester.allowAllLifecycle).toBeEnabled();
    await expect.element(tester.updateVersion).not.toBeChecked();
    await expect.element(tester.operate).not.toBeChecked();
    // the other groups are left untouched
    await expect.element(tester.configureDataFlow).toBeChecked();
    await expect.element(tester.allowAllConfiguration).toBeDisabled();

    await tester.operate.click();
    await expect.element(tester.operate).toBeChecked();
    await expect.element(tester.allowNoneLifecycle).toBeEnabled();

    await tester.allowNoneConfiguration.click();
    await tester.allowNoneSecurity.click();
    await tester.allowNoneData.click();
    await tester.allowNoneLifecycle.click();
    for (const checkbox of tester.permissions.elements()) {
      expect(checkbox).not.toBeChecked();
    }

    await tester.allowAllLifecycle.click();
    await tester.allowAllConfiguration.click();
    await tester.allowAllSecurity.click();
    await tester.allowAllData.click();
    await expect.element(tester.allowAllLifecycle).toBeDisabled();
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
    await expect.element(tester.allowAllLifecycle).toBeDisabled();

    await tester.allowNoneLifecycle.click();
    await tester.allowAllLifecycle.click();
    await expect.element(tester.updateVersion).not.toBeChecked();
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({ commandPermissions: { ...registration.commandPermissions, updateVersion: false } })
    );
  });

  test('should display the permissions grouped by risk, with what each one allows', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await expect.element(tester.permissions).toHaveLength(11);
    await expect
      .element(tester.diagnostics)
      .toHaveAccessibleDescription('Retrieve a memory dump, which may contain secrets in clear text, or the logs database');
    await tester.diagnostics.click();
    await tester.saveButton.click();

    expect(engineService.register).toHaveBeenCalledWith(
      expectedCommand({ commandPermissions: { ...registration.commandPermissions, diagnostics: false } })
    );
  });

  test('should cancel', async () => {
    const tester = new RegisterOibusModalComponentTester();
    tester.fixture.componentInstance.prepare(registration, 'register', false);

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
