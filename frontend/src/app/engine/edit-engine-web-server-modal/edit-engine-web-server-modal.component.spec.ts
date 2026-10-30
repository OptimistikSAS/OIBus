import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildEngineSettings } from '../../../test/builders';
import testData from '../../../test/test-data';
import { catchUnhandledErrors } from '../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';
import { EditEngineWebServerModalComponent } from './edit-engine-web-server-modal.component';

const HTTP: EngineSettingsDTO['webServer']['https'] = {
  enabled: false,
  certificateSource: 'store',
  certificateId: null,
  certificatePath: null,
  privateKeyPath: null
};

class EditEngineWebServerModalTester {
  readonly fixture = TestBed.createComponent(EditEngineWebServerModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly port = this.root.getByLabelText('Port');
  readonly authTokenDuration = this.root.getByLabelText('Authentication duration');
  readonly httpsEnabled = this.root.getByLabelText('Serve HTTPS');
  readonly certificateSource = this.root.getByLabelText('Certificate source');
  readonly certificate = this.root.getByLabelText('Certificate', { exact: true });
  readonly certificatePath = this.root.getByLabelText('Certificate file');
  readonly privateKeyPath = this.root.getByLabelText('Private key file');
  readonly enableContentEndpoint = this.root.getByLabelText('Enable the content endpoints');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  initialize(https: EngineSettingsDTO['webServer']['https'] = HTTP, enableContentEndpoint = false) {
    this.fixture.componentInstance.initialize(
      buildEngineSettings({ webServer: { port: 2223, authTokenDuration: '1d', https, enableContentEndpoint } })
    );
  }
}

describe('EditEngineWebServerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let certificateService: MockObject<CertificateService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<PortRedirectModalComponent>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    certificateService = createMock(CertificateService);
    certificateService.list.mockReturnValue(of(testData.certificates.list));
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: CertificateService, useValue: certificateService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should initialize the form with the web server settings', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await expect.element(tester.port).toHaveValue(2223);
    await expect.element(tester.authTokenDuration).toHaveDisplayValue('1 day');
    await expect.element(tester.httpsEnabled).not.toBeChecked();
    await expect.element(tester.certificateSource).not.toBeInTheDocument();
  });

  test('should initialize the form with the https settings', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.initialize({ ...HTTP, enabled: true, certificateId: testData.certificates.list[1].id });

    await expect.element(tester.httpsEnabled).toBeChecked();
    await expect.element(tester.certificateSource).toHaveDisplayValue('Certificate store');
    await expect.element(tester.certificate).toHaveDisplayValue(testData.certificates.list[1].name);
    await expect.element(tester.certificatePath).not.toBeInTheDocument();
  });

  test('should default the auth token duration to 7 days on a fresh form', async () => {
    const tester = new EditEngineWebServerModalTester();

    await expect.element(tester.authTokenDuration).toHaveDisplayValue('7 days');
  });

  test('should not save when the port is empty', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.port.fill('');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();
  });

  test('should save and show a success when the port did not change', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: false, newPort: null, newProtocol: null }));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.authTokenDuration.selectOptions('30 days');
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 2223,
      authTokenDuration: '30d',
      https: HTTP,
      enableContentEndpoint: false
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should initialize and save the content endpoint setting', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: false, newPort: null, newProtocol: null }));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize(HTTP, true);

    await expect.element(tester.enableContentEndpoint).toBeChecked();
    await tester.enableContentEndpoint.click();
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 2223,
      authTokenDuration: '1d',
      https: HTTP,
      enableContentEndpoint: false
    });
  });

  test('should close and open the redirect modal when the port changed', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 3333, newProtocol: 'http' }));
    const redirectComponent = createMock(PortRedirectModalComponent);
    modalService.mockDismissedModal(redirectComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.port.fill('3333');
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 3333,
      authTokenDuration: '1d',
      https: HTTP,
      enableContentEndpoint: false
    });
    expect(activeModal.close).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
    expect(redirectComponent.initialize).toHaveBeenCalledWith(3333, 'http');
    expect(notificationService.success).not.toHaveBeenCalled();
  });

  test('should enable https with a certificate of the store and redirect to it', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 2223, newProtocol: 'https' }));
    const redirectComponent = createMock(PortRedirectModalComponent);
    modalService.mockDismissedModal(redirectComponent);
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.httpsEnabled.click();
    await tester.saveButton.click();

    // the certificate is required
    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();

    await tester.certificate.selectOptions(testData.certificates.list[0].name);
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 2223,
      authTokenDuration: '1d',
      https: { ...HTTP, enabled: true, certificateId: testData.certificates.list[0].id },
      enableContentEndpoint: false
    });
    expect(redirectComponent.initialize).toHaveBeenCalledWith(2223, 'https');
  });

  test('should enable https with certificate files', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 2223, newProtocol: 'https' }));
    modalService.mockDismissedModal(createMock(PortRedirectModalComponent));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.httpsEnabled.click();
    await tester.certificateSource.selectOptions('Files');
    await expect.element(tester.certificate).not.toBeInTheDocument();
    await tester.certificatePath.fill('/etc/oibus/oibus.crt');
    await tester.saveButton.click();

    // the private key file is required
    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();

    await tester.privateKeyPath.fill('/etc/oibus/oibus.key');
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 2223,
      authTokenDuration: '1d',
      https: {
        enabled: true,
        certificateSource: 'file',
        certificateId: null,
        certificatePath: '/etc/oibus/oibus.crt',
        privateKeyPath: '/etc/oibus/oibus.key'
      },
      enableContentEndpoint: false
    });
  });

  test('should tell when the store has no certificate', async () => {
    certificateService.list.mockReturnValue(of([]));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize({ ...HTTP, enabled: true });

    await expect.element(tester.root.getByText(/No certificate in the store/)).toBeInTheDocument();
  });

  test('should disable https, keeping its certificate settings', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 2223, newProtocol: 'http' }));
    modalService.mockDismissedModal(createMock(PortRedirectModalComponent));
    const https = { ...HTTP, enabled: true, certificateSource: 'file' as const, certificatePath: 'oibus.crt', privateKeyPath: 'oibus.key' };
    const tester = new EditEngineWebServerModalTester();
    tester.initialize(https);

    await expect.element(tester.certificatePath).toHaveValue('oibus.crt');
    await tester.httpsEnabled.click();
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({
      port: 2223,
      authTokenDuration: '1d',
      https: { ...https, enabled: false },
      enableContentEndpoint: false
    });
  });

  test('should keep the modal open when the save fails', async () => {
    const unhandledError = catchUnhandledErrors();
    engineService.updateEngineWebServer.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.saveButton.click();

    await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new EditEngineWebServerModalTester();

    await tester.cancelButton.click();

    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
