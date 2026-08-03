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
  readonly typeCron = this.root.getByCss('#type-cron');
  readonly typeInterval = this.root.getByCss('#type-interval');
  readonly intervalSection = this.root.getByCss('#interval-section');
  readonly subSecondWarning = this.root.getByCss('#sub-second-warning');
  readonly activationWindowSection = this.root.getByCss('#activation-window-section');
  readonly overnightBadge = this.root.getByCss('#overnight-badge');
  readonly summary = this.root.getByCss('#activation-window-summary');
  readonly cancelButton = page.getByCss('#cancel-button');
}

const scanMode: ScanModeDTO = {
  id: 'scanModeId1',
  name: 'scanMode1',
  description: 'my scan mode',
  type: 'cron',
  cron: '* * * * * *',
  interval: null,
  activationWindow: null,
  activationWindowExpired: false
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

    expect(scanModeService.create).toHaveBeenCalledWith({
      name: 'new-scan-mode',
      description: 'desc',
      type: 'cron',
      cron: '* * * * * *',
      interval: null,
      activationWindow: null
    });
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
      description: 'my scan mode',
      type: 'cron',
      cron: '* * * * * *',
      interval: null,
      activationWindow: null
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

  describe('interval type', () => {
    function intervalTester(value: number, unit: 'ms' | 's' | 'min' | 'hour' = 's') {
      const tester = new EditScanModeModalComponentTester();
      tester.fixture.componentInstance.prepareForCreation();
      tester.fixture.componentInstance.selectType('interval');
      tester.fixture.componentInstance.form.controls.interval.setValue({ value, unit });
      tester.fixture.detectChanges();
      return tester;
    }

    test('should swap the cron and interval sections', () => {
      const tester = intervalTester(30);

      expect(tester.fixture.componentInstance.form.controls.cron.disabled).toBe(true);
      expect(tester.fixture.componentInstance.form.controls.interval.enabled).toBe(true);
    });

    test('should not let an empty cron block saving in interval mode', () => {
      const tester = intervalTester(30);
      tester.fixture.componentInstance.form.controls.name.setValue('interval-scan-mode');

      expect(tester.fixture.componentInstance.form.valid).toBe(true);
    });

    test('should send the interval and no cron', () => {
      scanModeService.create.mockReturnValue(of(scanMode));
      const tester = intervalTester(30);
      tester.fixture.componentInstance.form.controls.name.setValue('interval-scan-mode');
      tester.fixture.componentInstance.form.controls.description.setValue('desc');

      tester.fixture.componentInstance.save();

      expect(scanModeService.create).toHaveBeenCalledWith({
        name: 'interval-scan-mode',
        description: 'desc',
        type: 'interval',
        cron: '',
        interval: { value: 30, unit: 's' },
        activationWindow: null
      });
    });

    test('should reject an interval below the 10 ms floor', () => {
      const tester = intervalTester(5, 'ms');

      expect(tester.fixture.componentInstance.form.controls.interval.hasError('intervalTooSmall')).toBe(true);
    });

    test('should accept exactly 10 ms', () => {
      const tester = intervalTester(10, 'ms');

      expect(tester.fixture.componentInstance.form.controls.interval.hasError('intervalTooSmall')).toBe(false);
    });

    test('should warn about a sub-second interval without blocking saving', () => {
      const tester = intervalTester(500, 'ms');
      tester.fixture.componentInstance.form.controls.name.setValue('fast');
      tester.fixture.detectChanges();

      expect(tester.fixture.componentInstance.showSubSecondIntervalWarning).toBe(true);
      expect(tester.subSecondWarning.query()).toBeTruthy();
      // The advisory is not a validator.
      expect(tester.fixture.componentInstance.form.valid).toBe(true);
    });

    test('should not warn at or above one second', () => {
      const tester = intervalTester(2);

      expect(tester.fixture.componentInstance.showSubSecondIntervalWarning).toBe(false);
    });
  });

  describe('activation window', () => {
    function windowTester() {
      const tester = new EditScanModeModalComponentTester();
      tester.fixture.componentInstance.prepareForCreation();
      tester.fixture.componentInstance.form.controls.activationWindowEnabled.setValue(true);
      tester.fixture.componentInstance.onActivationWindowToggle();
      tester.fixture.detectChanges();
      return tester;
    }

    test('should send null when the window is disabled', () => {
      scanModeService.create.mockReturnValue(of(scanMode));
      const tester = new EditScanModeModalComponentTester();
      tester.fixture.componentInstance.prepareForCreation();
      tester.fixture.componentInstance.form.controls.name.setValue('no-window');
      tester.fixture.componentInstance.form.controls.cron.setValue('* * * * * *');

      tester.fixture.componentInstance.save();

      expect(scanModeService.create).toHaveBeenCalledWith(expect.objectContaining({ activationWindow: null }));
    });

    test('should stamp the current timezone into the recurring rule at save time', () => {
      scanModeService.create.mockReturnValue(of(scanMode));
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.name.setValue('weekend');
      tester.fixture.componentInstance.form.controls.cron.setValue('* * * * * *');
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({
        daysOfWeek: [6, 0],
        timeStart: '22:00',
        timeEnd: '02:00'
      });

      tester.fixture.componentInstance.save();

      const command = scanModeService.create.mock.calls[0][0];
      expect(command.activationWindow!.dateRange).toBeNull();
      expect(command.activationWindow!.recurring!.daysOfWeek).toEqual([0, 6]);
      expect(command.activationWindow!.recurring!.timeOfDay).toEqual({ start: '22:00', end: '02:00' });
      expect(command.activationWindow!.recurring!.timezone).toBeTruthy();
    });

    test('should persist all seven days as "every day"', () => {
      scanModeService.create.mockReturnValue(of(scanMode));
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.name.setValue('all-days');
      tester.fixture.componentInstance.form.controls.cron.setValue('* * * * * *');
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        timeStart: '08:00',
        timeEnd: '18:00'
      });

      tester.fixture.componentInstance.save();

      expect(scanModeService.create.mock.calls[0][0].activationWindow!.recurring!.daysOfWeek).toBeNull();
    });

    test('should reject a half-filled time of day', () => {
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({ timeStart: '08:00', timeEnd: null });

      expect(tester.fixture.componentInstance.form.controls.activationWindow.hasError('timeOfDayIncomplete')).toBe(true);
    });

    test('should reject a zero-length time of day', () => {
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({ timeStart: '08:00', timeEnd: '08:00' });

      expect(tester.fixture.componentInstance.form.controls.activationWindow.hasError('timeOfDayEmpty')).toBe(true);
    });

    test('should flag an overnight window with a +1 badge', () => {
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({ timeStart: '22:00', timeEnd: '02:00' });
      tester.fixture.detectChanges();

      expect(tester.fixture.componentInstance.isOvernight).toBe(true);
      expect(tester.overnightBadge.query()).toBeTruthy();
    });

    test('should not flag a same-day window', () => {
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({ timeStart: '08:00', timeEnd: '18:00' });
      tester.fixture.detectChanges();

      expect(tester.fixture.componentInstance.isOvernight).toBe(false);
      expect(tester.overnightBadge.query()).toBeFalsy();
    });

    test('should summarise the combined rule', () => {
      const tester = windowTester();
      tester.fixture.componentInstance.form.controls.activationWindow.patchValue({
        daysOfWeek: [5, 6],
        timeStart: '22:00',
        timeEnd: '02:00'
      });
      tester.fixture.detectChanges();

      const summary = tester.fixture.componentInstance.activationWindowSummary;
      expect(summary).toContain('Fri, Sat');
      expect(summary).toContain('between 22:00 and 02:00 (+1 day)');
    });

    test('should summarise an unrestricted window as active all day', () => {
      const tester = windowTester();

      expect(tester.fixture.componentInstance.activationWindowSummary).toBe('Active, all day');
    });

    test('should round-trip an existing window through edition', () => {
      const windowed = {
        ...scanMode,
        activationWindow: {
          dateRange: { start: '2026-08-01T00:00:00.000Z', end: null },
          recurring: { timezone: 'Europe/Paris', daysOfWeek: [1, 2], timeOfDay: { start: '08:00', end: '18:00' } }
        }
      } as ScanModeDTO;
      scanModeService.update.mockReturnValue(of(undefined));
      scanModeService.findById.mockReturnValue(of(windowed));

      const tester = new EditScanModeModalComponentTester();
      tester.fixture.componentInstance.prepareForEdition(windowed);
      tester.fixture.detectChanges();

      expect(tester.fixture.componentInstance.form.controls.activationWindowEnabled.value).toBe(true);
      expect(tester.fixture.componentInstance.form.controls.activationWindow.getRawValue()).toEqual({
        start: '2026-08-01T00:00:00.000Z',
        end: null,
        daysOfWeek: [1, 2],
        timeStart: '08:00',
        timeEnd: '18:00'
      });

      tester.fixture.componentInstance.save();

      expect(scanModeService.update.mock.calls[0][1].activationWindow!.dateRange).toEqual({
        start: '2026-08-01T00:00:00.000Z',
        end: null
      });
    });
  });
});
