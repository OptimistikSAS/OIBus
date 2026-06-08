import { TestBed } from '@angular/core/testing';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { EditEngineWebServerModalComponent } from './edit-engine-web-server-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';

const engineSettings = { port: 2223 } as EngineSettingsDTO;

class EditEngineWebServerModalTester {
  readonly fixture = TestBed.createComponent(EditEngineWebServerModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly portInput = this.root.getByCss('#port');
  readonly saveButton = this.root.getByCss('#save-web-server-button');
  readonly cancelButton = this.root.getByCss('#cancel-web-server-button');
}

describe('EditEngineWebServerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService },
        { provide: NgbModal, useValue: createMock(NgbModal) }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should initialize the form with engine port', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await expect.element(tester.portInput).toHaveValue(String(engineSettings.port));
  });

  test('should not save when form is invalid', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.fixture.detectChanges();
    await tester.portInput.fill('');
    await tester.saveButton.click();
    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();
  });

  test('should save and show success when port did not change', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: false, newPort: null }));
    const tester = new EditEngineWebServerModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(engineService.updateEngineWebServer).toHaveBeenCalledWith({ port: engineSettings.port });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should open redirect modal when port changed', async () => {
    engineService.updateEngineWebServer.mockReturnValue(of({ needsRedirect: true, newPort: 3333 }));
    const redirectModalRef = { componentInstance: { initialize: () => {} } };
    modalService.open.mockReturnValue(redirectModalRef as any);
    const tester = new EditEngineWebServerModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalled();
    expect(modalService.open).toHaveBeenCalled();
  });

  test('should dismiss modal on cancel', async () => {
    const tester = new EditEngineWebServerModalTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(engineService.updateEngineWebServer).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
