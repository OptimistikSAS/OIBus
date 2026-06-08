import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { EditEngineNameModalComponent } from './edit-engine-name-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';

const engineSettings = engineSettings as unknown as EngineSettingsDTO;

class EditEngineNameModalTester {
  readonly fixture = TestBed.createComponent(EditEngineNameModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly nameInput = this.root.getByCss('#name');
  readonly saveButton = this.root.getByCss('#save-name-button');
  readonly cancelButton = this.root.getByCss('#cancel-name-button');
}

describe('EditEngineNameModalComponent', () => {
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

  test('should initialize the form with engine name', async () => {
    const tester = new EditEngineNameModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await expect.element(tester.nameInput).toHaveValue(engineSettings.name);
  });

  test('should not save when name is empty', async () => {
    const tester = new EditEngineNameModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await tester.nameInput.fill('');
    await tester.saveButton.click();
    expect(engineService.updateEngineName).not.toHaveBeenCalled();
  });

  test('should save the name and close modal', async () => {
    engineService.updateEngineName.mockReturnValue(of(undefined));
    const tester = new EditEngineNameModalTester();
    tester.fixture.componentInstance.initialize(engineSettings);
    tester.fixture.detectChanges();
    await tester.nameInput.fill('new name');
    await tester.saveButton.click();
    expect(engineService.updateEngineName).toHaveBeenCalledWith({ name: 'new name' });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should dismiss modal on cancel', async () => {
    const tester = new EditEngineNameModalTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(engineService.updateEngineName).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
