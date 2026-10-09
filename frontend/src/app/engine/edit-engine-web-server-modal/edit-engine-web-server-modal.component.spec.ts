import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildEngineSettings } from '../../../test/builders';
import { catchUnhandledErrors } from '../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';
import { EditEngineWebServerModalComponent } from './edit-engine-web-server-modal.component';

class EditEngineWebServerModalTester {
  readonly fixture = TestBed.createComponent(EditEngineWebServerModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly port = this.root.getByLabelText('Port');
  readonly authTokenDuration = this.root.getByLabelText('Authentication duration');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  initialize() {
    this.fixture.componentInstance.initialize(buildEngineSettings({ webServer: { port: 2223, authTokenDuration: '1d' } }));
  }
}

describe('EditEngineWebServerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<PortRedirectModalComponent>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
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
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: false, newPort: null }));
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.authTokenDuration.selectOptions('30 days');
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({ port: 2223, authTokenDuration: '30d' });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should close and open the redirect modal when the port changed', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 3333 }));
    const redirectComponent = createMock(PortRedirectModalComponent);
    modalService.mockDismissedModal(redirectComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    const tester = new EditEngineWebServerModalTester();
    tester.initialize();

    await tester.port.fill('3333');
    await tester.saveButton.click();

    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({ port: 3333, authTokenDuration: '1d' });
    expect(activeModal.close).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
    expect(redirectComponent.initialize).toHaveBeenCalledWith(3333);
    expect(notificationService.success).not.toHaveBeenCalled();
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
