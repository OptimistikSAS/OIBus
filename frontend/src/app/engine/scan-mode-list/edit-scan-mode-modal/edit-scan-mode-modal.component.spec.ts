import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { isObservable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '@oibus/shared/api/scan-mode.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { catchUnhandledErrors } from '../../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ScanModeService } from '../../../services/scan-mode.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditScanModeModalComponent } from './edit-scan-mode-modal.component';

class EditScanModeModalComponentTester {
  readonly fixture = TestBed.createComponent(EditScanModeModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly description = this.root.getByLabelText('Description');
  readonly typeCron = this.root.getByRole('button', { name: 'Cron', exact: true });
  readonly typeInterval = this.root.getByRole('button', { name: 'Interval', exact: true });
  readonly cron = this.root.getByLabelText('Cron', { exact: true });
  readonly cronMeaning = this.root.getByText('Cron meaning:');
  readonly intervalValue = this.root.getByLabelText('Every');
  readonly intervalUnit = this.root.getByCss('#interval-unit');
  readonly subSecondWarning = this.root.getByText('Intervals under 1 second may not be achievable', { exact: false });
  readonly restrictActivationWindow = this.root.getByLabelText('Restrict activation window');
  readonly activationWindowSection = this.root.getByCss('#activation-window-section');
  readonly clearWindowStart = this.root.getByCss('#clear-window-start');
  readonly timezoneChangedWarning = this.root.getByCss('#timezone-changed-warning');
  readonly timeStart = this.root.getByLabelText('Start', { exact: true });
  readonly timeEnd = this.root.getByLabelText('End', { exact: true });
  readonly overnightBadge = this.root.getByText('+1', { exact: true });
  readonly summary = this.root.getByCss('#activation-window-summary');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  day(label: string) {
    return this.root.getByRole('button', { name: label, exact: true });
  }
}

const scanMode: ScanModeDTO = {
  ...testData.scanMode.list[0],
  id: 'scanModeId1',
  name: 'scanMode1',
  description: 'my scan mode',
  cron: '* * * * * *'
};

const validCron: ValidatedCronExpression = {
  isValid: true,
  errorMessage: '',
  nextExecutions: ['2024-01-01T00:00:00.000Z'],
  humanReadableForm: 'Every second'
};

describe('EditScanModeModalComponent', () => {
  let scanModeService: MockObject<ScanModeService>;
  let activeModal: MockObject<NgbActiveModal>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    scanModeService = createMock(ScanModeService);
    activeModal = createMock(NgbActiveModal);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    scanModeService.list.mockReturnValue(of([scanMode]));
    scanModeService.verifyCron.mockReturnValue(of(validCron));
    scanModeService.create.mockReturnValue(of(scanMode));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: ScanModeService, useValue: scanModeService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  function createTester() {
    const tester = new EditScanModeModalComponentTester();
    tester.componentInstance.prepareForCreation();
    return tester;
  }

  describe('creation', () => {
    test('should display an empty cron scan mode', async () => {
      const tester = createTester();

      await expect.element(tester.title).toHaveTextContent('Create a scan mode');
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.typeCron).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.cron).toHaveValue('');
      await expect.element(tester.intervalValue).not.toBeInTheDocument();
      await expect.element(tester.activationWindowSection).not.toBeInTheDocument();
    });

    test('should create a cron scan mode', async () => {
      const tester = createTester();

      await tester.name.fill('new-scan-mode');
      await tester.description.fill('desc');
      await tester.cron.fill('* * * * * *');
      await expect.element(tester.cronMeaning).toBeInTheDocument();
      await expect.element(tester.root.getByText('Every second')).toBeInTheDocument();
      await tester.saveButton.click();

      const expectedCommand: ScanModeCommandDTO = {
        name: 'new-scan-mode',
        description: 'desc',
        type: 'cron',
        cron: '* * * * * *',
        interval: null,
        activationWindow: null
      };
      expect(scanModeService.verifyCron).toHaveBeenCalledWith('* * * * * *');
      expect(scanModeService.create).toHaveBeenCalledWith(expectedCommand);
      expect(activeModal.close).toHaveBeenCalledWith(scanMode);
    });

    test('should require a name and a cron', async () => {
      const tester = createTester();

      await tester.saveButton.click();

      await expect.element(tester.root.getByText('This field is required')).toHaveLength(2);
      expect(scanModeService.create).not.toHaveBeenCalled();
    });

    test('should reject a name already used by another scan mode', async () => {
      const tester = createTester();

      await tester.name.fill(' SCANMODE1 ');
      await tester.cron.fill('* * * * * *');
      await tester.saveButton.click();

      await expect.element(tester.root.getByText('Must be unique')).toBeInTheDocument();
      expect(scanModeService.create).not.toHaveBeenCalled();
    });

    test('should check the uniqueness of the name once the scan modes are loaded', async () => {
      const scanModes = new Subject<Array<ScanModeDTO>>();
      scanModeService.list.mockReturnValue(scanModes);
      const tester = createTester();

      await tester.name.fill('scanMode1');
      await tester.description.click();
      await expect.element(tester.root.getByText('Must be unique')).not.toBeInTheDocument();

      scanModes.next([scanMode]);

      await expect.element(tester.root.getByText('Must be unique')).toBeInTheDocument();
    });

    test('should display the error of an invalid cron once it is verified', async () => {
      const verification = new Subject<ValidatedCronExpression>();
      scanModeService.verifyCron.mockReturnValue(verification);
      const tester = createTester();

      await tester.name.fill('new-scan-mode');
      await tester.cron.fill('bad cron');
      await tester.saveButton.click();
      verification.next({ ...validCron, isValid: false, errorMessage: 'Invalid cron expression' });
      verification.complete();

      await expect.element(tester.root.getByText('Invalid cron expression')).toBeInTheDocument();
      await expect.element(tester.cronMeaning).not.toBeInTheDocument();
      expect(scanModeService.create).not.toHaveBeenCalled();
    });

    test('should keep the modal open when the creation fails', async () => {
      const unhandledError = catchUnhandledErrors();
      scanModeService.create.mockReturnValue(throwError(() => new Error('boom')));
      const tester = createTester();

      await tester.name.fill('new-scan-mode');
      await tester.cron.fill('* * * * * *');
      await tester.saveButton.click();

      await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(tester.saveButton).toBeEnabled();
    });

    test('should cancel', async () => {
      const tester = createTester();

      await tester.cancelButton.click();

      expect(activeModal.dismiss).toHaveBeenCalled();
    });

    test('should allow dismissal without confirmation when nothing was changed', () => {
      const tester = createTester();

      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should ask for a confirmation before dismissing when the type was changed', async () => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
      const tester = createTester();

      await tester.typeInterval.click();

      expect(isObservable(tester.componentInstance.canDismiss())).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });

  describe('edition', () => {
    test('should populate the form and update the scan mode', async () => {
      const updatedScanMode: ScanModeDTO = { ...scanMode, name: 'updated-name' };
      scanModeService.update.mockReturnValue(of(undefined));
      scanModeService.findById.mockReturnValue(of(updatedScanMode));
      const tester = new EditScanModeModalComponentTester();
      tester.componentInstance.prepareForEdition(scanMode);

      await expect.element(tester.title).toHaveTextContent('Edit scan mode');
      await expect.element(tester.name).toHaveValue('scanMode1');
      await expect.element(tester.description).toHaveValue('my scan mode');
      await expect.element(tester.cron).toHaveValue('* * * * * *');

      // its own name is not a duplicate
      await tester.name.fill('updated-name');
      await tester.saveButton.click();

      expect(scanModeService.update).toHaveBeenCalledWith('scanModeId1', {
        name: 'updated-name',
        description: 'my scan mode',
        type: 'cron',
        cron: '* * * * * *',
        interval: null,
        activationWindow: null
      });
      expect(scanModeService.findById).toHaveBeenCalledWith('scanModeId1');
      expect(activeModal.close).toHaveBeenCalledWith(updatedScanMode);
    });

    test('should display an interval scan mode', async () => {
      const tester = new EditScanModeModalComponentTester();
      tester.componentInstance.prepareForEdition({ ...scanMode, type: 'interval', cron: '', interval: { value: 2, unit: 'min' } });

      await expect.element(tester.typeInterval).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.cron).not.toBeInTheDocument();
      await expect.element(tester.intervalValue).toHaveValue(2);
      await expect.element(tester.intervalUnit).toHaveDisplayValue('minutes');
    });
  });

  describe('interval type', () => {
    async function intervalTester(value: string, unit: string) {
      const tester = createTester();
      await tester.name.fill('interval-scan-mode');
      await tester.typeInterval.click();
      await tester.intervalValue.fill(value);
      await tester.intervalUnit.selectOptions(unit);
      return tester;
    }

    test('should swap the cron and interval sections', async () => {
      const tester = await intervalTester('30', 'seconds');

      await expect.element(tester.typeInterval).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.cron).not.toBeInTheDocument();

      await tester.typeCron.click();
      await expect.element(tester.cron).toBeInTheDocument();
      await expect.element(tester.intervalValue).not.toBeInTheDocument();
    });

    test('should send the interval and no cron, an empty cron not blocking the save', async () => {
      const tester = await intervalTester('30', 'seconds');

      await tester.saveButton.click();

      expect(scanModeService.create).toHaveBeenCalledWith({
        name: 'interval-scan-mode',
        description: '',
        type: 'interval',
        cron: '',
        interval: { value: 30, unit: 's' },
        activationWindow: null
      });
    });

    test('should reject an interval below the 10 ms floor', async () => {
      const tester = await intervalTester('5', 'milliseconds');

      await tester.saveButton.click();

      await expect.element(tester.root.getByText('The interval must be at least 10 ms')).toBeInTheDocument();
      expect(scanModeService.create).not.toHaveBeenCalled();
    });

    test('should accept exactly 10 ms', async () => {
      const tester = await intervalTester('10', 'milliseconds');

      await tester.saveButton.click();

      expect(scanModeService.create).toHaveBeenCalledWith(expect.objectContaining({ interval: { value: 10, unit: 'ms' } }));
    });

    test('should warn about a sub-second interval without blocking saving', async () => {
      const tester = await intervalTester('500', 'milliseconds');

      await expect.element(tester.subSecondWarning).toBeInTheDocument();
      await tester.saveButton.click();

      expect(scanModeService.create).toHaveBeenCalledWith(expect.objectContaining({ interval: { value: 500, unit: 'ms' } }));
    });

    test('should not warn at or above one second', async () => {
      const tester = await intervalTester('2', 'seconds');

      await expect.element(tester.intervalValue).toHaveValue(2);
      await expect.element(tester.subSecondWarning).not.toBeInTheDocument();
    });
  });

  describe('activation window', () => {
    async function windowTester() {
      const tester = createTester();
      await tester.name.fill('my window');
      await tester.cron.fill('* * * * * *');
      await tester.restrictActivationWindow.click();
      return tester;
    }

    test('should send null when the window is disabled', async () => {
      const tester = createTester();
      await tester.name.fill('no-window');
      await tester.cron.fill('* * * * * *');

      await tester.saveButton.click();

      expect(scanModeService.create).toHaveBeenCalledWith(expect.objectContaining({ activationWindow: null }));
    });

    test('should send null when the window is enabled but left blank', async () => {
      const tester = await windowTester();

      await tester.saveButton.click();

      expect(scanModeService.create).toHaveBeenCalledWith(expect.objectContaining({ activationWindow: null }));
    });

    test('should stamp the current timezone into the recurring rule at save time', async () => {
      const tester = await windowTester();
      await tester.day('Sat').click();
      await tester.day('Sun').click();
      await tester.timeStart.fill('22:00');
      await tester.timeEnd.fill('02:00');

      await tester.saveButton.click();

      expect(scanModeService.create.mock.lastCall?.[0].activationWindow).toEqual({
        dateRange: null,
        recurring: { timezone: 'Europe/Paris', daysOfWeek: [0, 6], timeOfDay: { start: '22:00', end: '02:00' } }
      });
    });

    test('should persist all seven days as "every day"', async () => {
      const tester = await windowTester();
      for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
        await tester.day(day).click();
      }
      await tester.timeStart.fill('08:00');
      await tester.timeEnd.fill('18:00');

      await tester.saveButton.click();

      expect(scanModeService.create.mock.lastCall?.[0].activationWindow?.recurring?.daysOfWeek).toBeNull();
    });

    test('should reject a half-filled time of day', async () => {
      const tester = await windowTester();

      await tester.timeStart.fill('08:00');
      await tester.timeEnd.click();

      await expect.element(tester.root.getByText('Both the start and end times must be set, or neither')).toBeInTheDocument();
    });

    test('should reject a zero-length time of day', async () => {
      const tester = await windowTester();

      await tester.timeStart.fill('08:00');
      await tester.timeEnd.fill('08:00');

      await expect.element(tester.root.getByText('The start and end times must be different')).toBeInTheDocument();
    });

    test('should flag an overnight window with a +1 badge', async () => {
      const tester = await windowTester();

      await tester.timeStart.fill('22:00');
      await tester.timeEnd.fill('02:00');

      await expect.element(tester.overnightBadge).toBeInTheDocument();
    });

    test('should not flag a same-day window', async () => {
      const tester = await windowTester();

      await tester.timeStart.fill('08:00');
      await tester.timeEnd.fill('18:00');

      await expect.element(tester.summary).toMatchTextContent('between 08:00 and 18:00');
      await expect.element(tester.overnightBadge).not.toBeInTheDocument();
    });

    test('should summarise the combined rule', async () => {
      const tester = await windowTester();

      await tester.day('Fri').click();
      await tester.day('Sat').click();
      await tester.timeStart.fill('22:00');
      await tester.timeEnd.fill('02:00');

      await expect.element(tester.summary).toMatchTextContent('on Fri, Sat');
      await expect.element(tester.summary).toMatchTextContent('between 22:00 and 02:00 (+1 day)');
    });

    test('should summarise an unrestricted window as active all day', async () => {
      const tester = await windowTester();

      await expect.element(tester.summary).toHaveTextContent('Active, all day');
    });

    test('should round-trip an existing window through edition, and clear a bound', async () => {
      const windowed: ScanModeDTO = {
        ...scanMode,
        activationWindow: {
          dateRange: { start: '2026-08-01T00:00:00.000Z', end: null },
          recurring: { timezone: 'Europe/Paris', daysOfWeek: [1, 2], timeOfDay: { start: '08:00', end: '18:00' } }
        }
      };
      scanModeService.update.mockReturnValue(of(undefined));
      scanModeService.findById.mockReturnValue(of(windowed));
      const tester = new EditScanModeModalComponentTester();
      tester.componentInstance.prepareForEdition(windowed);

      await expect.element(tester.restrictActivationWindow).toBeChecked();
      await expect.element(tester.day('Mon')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.day('Tue')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.day('Wed')).toHaveAttribute('aria-pressed', 'false');
      await expect.element(tester.timeStart).toHaveValue('08:00');
      await expect.element(tester.timeEnd).toHaveValue('18:00');
      await expect.element(tester.summary).toMatchTextContent('from');
      await expect.element(tester.timezoneChangedWarning).not.toBeInTheDocument();

      await tester.saveButton.click();
      expect(scanModeService.update.mock.lastCall?.[1].activationWindow).toEqual({
        dateRange: { start: '2026-08-01T00:00:00.000Z', end: null },
        recurring: { timezone: 'Europe/Paris', daysOfWeek: [1, 2], timeOfDay: { start: '08:00', end: '18:00' } }
      });

      await tester.clearWindowStart.click();
      await expect.element(tester.clearWindowStart).not.toBeInTheDocument();
      await tester.saveButton.click();
      expect(scanModeService.update.mock.lastCall?.[1].activationWindow?.dateRange).toBeNull();
    });

    test('should warn when the window was saved with another timezone', async () => {
      const tester = new EditScanModeModalComponentTester();
      tester.componentInstance.prepareForEdition({
        ...scanMode,
        activationWindow: { dateRange: null, recurring: { timezone: 'Asia/Tokyo', daysOfWeek: [1], timeOfDay: null } }
      });

      await expect.element(tester.timezoneChangedWarning).toMatchTextContent('saved with the timezone Asia/Tokyo');
      await expect.element(tester.timezoneChangedWarning).toMatchTextContent('current timezone Europe/Paris');
    });
  });
});
