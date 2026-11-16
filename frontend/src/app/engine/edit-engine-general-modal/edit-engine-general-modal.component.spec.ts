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
import { EditEngineGeneralModalComponent } from './edit-engine-general-modal.component';

class EditEngineGeneralModalTester {
  readonly fixture = TestBed.createComponent(EditEngineGeneralModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { name: 'General settings' });
  readonly name = this.root.getByLabelText('Name');
  readonly description = this.root.getByLabelText('Description');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor() {
    this.fixture.componentInstance.initialize(buildEngineSettings({ general: { name: 'OIBus', description: 'Plant A' } }));
  }
}

describe('EditEngineGeneralModalComponent', () => {
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

  test('should initialize the form with the engine name and description', async () => {
    const tester = new EditEngineGeneralModalTester();

    await expect.element(tester.title).toBeInTheDocument();
    await expect.element(tester.name).toHaveValue('OIBus');
    await expect.element(tester.description).toHaveValue('Plant A');
  });

  test('should initialize an empty description when the engine has none', async () => {
    const tester = new EditEngineGeneralModalTester();
    tester.fixture.componentInstance.initialize(buildEngineSettings({ general: { name: 'OIBus', description: null } }));

    await expect.element(tester.description).toHaveValue('');
  });

  test('should not save when the name is empty', async () => {
    const tester = new EditEngineGeneralModalTester();

    await tester.name.fill('');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    expect(engineService.updateEngineGeneral).not.toHaveBeenCalled();
  });

  test('should save the name and description and close the modal', async () => {
    engineService.updateEngineGeneral.mockReturnValue(of(undefined));
    const tester = new EditEngineGeneralModalTester();

    await tester.name.fill('new name');
    await tester.description.fill('new description');
    await tester.saveButton.click();

    expect(engineService.updateEngineGeneral).toHaveBeenCalledWith({ name: 'new name', description: 'new description' });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should save a blank description as null', async () => {
    engineService.updateEngineGeneral.mockReturnValue(of(undefined));
    const tester = new EditEngineGeneralModalTester();

    await tester.description.fill('  ');
    await tester.saveButton.click();

    expect(engineService.updateEngineGeneral).toHaveBeenCalledWith({ name: 'OIBus', description: null });
  });

  test('should keep the modal open when the save fails', async () => {
    const unhandledError = catchUnhandledErrors();
    engineService.updateEngineGeneral.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new EditEngineGeneralModalTester();

    await tester.saveButton.click();

    await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new EditEngineGeneralModalTester();

    await tester.cancelButton.click();

    expect(engineService.updateEngineGeneral).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
