import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { EditEngineLoggerModalComponent } from './edit-engine-logger-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';

const engineSettings = {
  logParameters: {
    console: { level: 'silent' },
    file: { level: 'info', maxFileSize: 50, numberOfFiles: 5 },
    database: { level: 'info', maxNumberOfLogs: 100_000 },
    loki: { level: 'silent', interval: 60, address: '', username: '', password: '' },
    oia: { level: 'silent', interval: 10 },
    syslog: { level: 'silent', host: '', port: 514, protocol: 'udp4' }
  }
} as EngineSettingsDTO;

class EditEngineLoggerModalTester {
  readonly fixture = TestBed.createComponent(EditEngineLoggerModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly consoleLevelSelect = this.root.getByCss('#console-level');
  readonly fileLevelSelect = this.root.getByCss('#file-level');
  readonly databaseLevelSelect = this.root.getByCss('#database-level');
  readonly oiaLevelSelect = this.root.getByCss('#oia-level');
  readonly saveButton = this.root.getByCss('#save-logger-button');
  readonly cancelButton = this.root.getByCss('#cancel-logger-button');
}

describe('EditEngineLoggerModalComponent', () => {
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

  test('should initialize the form with logger settings', async () => {
    const tester = new EditEngineLoggerModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await expect.element(tester.consoleLevelSelect).toHaveValue('0: silent');
  });

  test('should save logger settings and close modal', async () => {
    engineService.updateEngineLogger.mockReturnValue(of(undefined));
    const tester = new EditEngineLoggerModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(engineService.updateEngineLogger).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should dismiss modal on cancel', async () => {
    const tester = new EditEngineLoggerModalTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(engineService.updateEngineLogger).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
