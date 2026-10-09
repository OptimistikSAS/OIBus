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
import { NotificationService } from '../../shared/notification.service';
import { EditEngineNameModalComponent } from './edit-engine-name-modal.component';

class EditEngineNameModalTester {
  readonly fixture = TestBed.createComponent(EditEngineNameModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { name: 'General settings' });
  readonly name = this.root.getByLabelText('Name');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor() {
    this.fixture.componentInstance.initialize(buildEngineSettings({ general: { name: 'OIBus' } }));
  }
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

  test('should initialize the form with the engine name', async () => {
    const tester = new EditEngineNameModalTester();

    await expect.element(tester.title).toBeInTheDocument();
    await expect.element(tester.name).toHaveValue('OIBus');
  });

  test('should not save when the name is empty', async () => {
    const tester = new EditEngineNameModalTester();

    await tester.name.fill('');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineName).not.toHaveBeenCalled();
  });

  test('should save the name and close the modal', async () => {
    engineService.updateEngineName.mockReturnValue(of(undefined));
    const tester = new EditEngineNameModalTester();

    await tester.name.fill('new name');
    await tester.saveButton.click();

    expect(engineService.updateEngineName).toHaveBeenCalledWith({ name: 'new name' });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should keep the modal open when the save fails', async () => {
    const unhandledError = catchUnhandledErrors();
    engineService.updateEngineName.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new EditEngineNameModalTester();

    await tester.saveButton.click();

    await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new EditEngineNameModalTester();

    await tester.cancelButton.click();

    expect(engineService.updateEngineName).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
