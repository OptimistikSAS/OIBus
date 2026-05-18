import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditScanModeModalComponent } from './edit-scan-mode-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { ScanModeService } from '../../../services/scan-mode.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ScanModeDTO, ValidatedCronExpression } from '../../../../../../backend/shared/model/scan-mode.model';

class EditScanModeModalComponentTester {
  readonly fixture = TestBed.createComponent(EditScanModeModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly name = this.root.getByCss('#name');
  readonly cron = this.root.getByCss('#cron');
  readonly cancelButton = page.getByCss('#cancel-button');
}

const scanMode: ScanModeDTO = {
  id: 'scanModeId1',
  name: 'scanMode1',
  description: 'my scan mode',
  cron: '* * * * * *'
} as ScanModeDTO;

describe('EditScanModeModalComponent', () => {
  let scanModeService: MockObject<ScanModeService>;
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    scanModeService = createMock(ScanModeService);
    activeModal = createMock(NgbActiveModal);
    const unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    scanModeService.list.mockReturnValue(of([]));
    scanModeService.verifyCron.mockReturnValue(
      of({
        isValid: true,
        expression: '* * * * *',
        errorMessage: '',
        nextExecutions: [],
        humanReadableForm: ''
      } as ValidatedCronExpression)
    );

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: ScanModeService, useValue: scanModeService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should create a scan mode', () => {
    const createdScanMode = { ...scanMode, id: 'new-id' } as ScanModeDTO;
    scanModeService.create.mockReturnValue(of(createdScanMode));

    const tester = new EditScanModeModalComponentTester();
    tester.fixture.componentInstance.prepareForCreation();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.form.controls.name.setValue('new-scan-mode');
    tester.fixture.componentInstance.form.controls.cron.setValue('* * * * * *');
    tester.fixture.componentInstance.form.controls.description.setValue('desc');
    tester.fixture.componentInstance.save();

    expect(scanModeService.create).toHaveBeenCalledWith({ name: 'new-scan-mode', cron: '* * * * * *', description: 'desc' });
    expect(activeModal.close).toHaveBeenCalledWith(createdScanMode);
  });

  test('should populate form and update a scan mode', () => {
    const updatedScanMode = { ...scanMode, name: 'updated-name' } as ScanModeDTO;
    scanModeService.update.mockReturnValue(of(undefined));
    scanModeService.findById.mockReturnValue(of(updatedScanMode));

    const tester = new EditScanModeModalComponentTester();
    tester.fixture.componentInstance.prepareForEdition(scanMode);
    tester.fixture.detectChanges();

    expect(tester.fixture.componentInstance.form.controls.name.value).toBe('scanMode1');
    expect(tester.fixture.componentInstance.form.controls.cron.value).toBe('* * * * * *');

    tester.fixture.componentInstance.form.controls.name.setValue('updated-name');
    tester.fixture.componentInstance.save();

    expect(scanModeService.update).toHaveBeenCalledWith('scanModeId1', {
      name: 'updated-name',
      cron: '* * * * * *',
      description: 'my scan mode'
    });
    expect(activeModal.close).toHaveBeenCalledWith(updatedScanMode);
  });

  test('should cancel', async () => {
    const tester = new EditScanModeModalComponentTester();
    tester.fixture.componentInstance.prepareForCreation();
    tester.fixture.detectChanges();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
