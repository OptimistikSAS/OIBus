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
  proxyEnabled: false,
  proxyPort: null,
  forwardProxyUrl: null,
  forwardProxyUsername: null,
  forwardProxyPassword: null,
  proxyUsername: null,
  proxyPassword: null
} as EngineSettingsDTO;

class EditEngineProxyModalTester {
  readonly fixture = TestBed.createComponent(EditEngineProxyModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly proxyEnabledCheckbox = this.root.getByCss('#proxy-enabled');
  readonly saveButton = this.root.getByCss('#save-proxy-button');
  readonly cancelButton = this.root.getByCss('#cancel-proxy-button');
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
    const proxyEnabled = engineSettings.proxyEnabled;
    if (proxyEnabled) {
      await expect.element(tester.proxyEnabledCheckbox).toBeChecked();
    } else {
      await expect.element(tester.proxyEnabledCheckbox).not.toBeChecked();
    }
  });

  test('should save proxy settings and close modal', async () => {
    engineService.updateEngineProxy.mockReturnValue(of(undefined));
    const tester = new EditEngineProxyModalTester();
    tester.fixture.componentInstance.initialize({ ...engineSettings, proxyEnabled: false, proxyPort: null });
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(engineService.updateEngineProxy).toHaveBeenCalledWith({
      proxyEnabled: false,
      proxyPort: null,
      forwardProxyUrl: null,
      forwardProxyUsername: null,
      forwardProxyPassword: null,
      proxyUsername: null,
      proxyPassword: null
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should dismiss modal on cancel', async () => {
    const tester = new EditEngineProxyModalTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(engineService.updateEngineProxy).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
