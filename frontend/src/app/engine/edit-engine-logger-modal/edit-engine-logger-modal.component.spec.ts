import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { EngineLoggerCommandDTO } from '@oibus/shared/api/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildEngineSettings } from '../../../test/builders';
import { catchUnhandledErrors } from '../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { NotificationService } from '../../shared/notification.service';
import { EditEngineLoggerModalComponent } from './edit-engine-logger-modal.component';

class EditEngineLoggerModalTester {
  readonly fixture = TestBed.createComponent(EditEngineLoggerModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly auditRetentionDuration = this.root.getByLabelText('Audit log retention');
  readonly consoleLevel = this.root.getByLabelText('Console level');
  readonly fileLevel = this.root.getByLabelText('File level');
  readonly databaseLevel = this.root.getByLabelText('Database level');
  readonly maxNumberOfLogs = this.root.getByLabelText('Max number of logs');
  readonly lokiLevel = this.root.getByLabelText('Loki level');
  readonly oiaLevel = this.root.getByLabelText('OIAnalytics level');
  readonly syslogLevel = this.root.getByLabelText('Syslog level');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  constructor() {
    this.fixture.componentInstance.initialize(buildEngineSettings());
  }
}

// the logger settings of buildEngineSettings()
const expectedCommand: EngineLoggerCommandDTO = {
  auditRetentionDuration: 90,
  console: { level: 'silent' },
  file: { level: 'trace', maxFileSize: 50, numberOfFiles: 5 },
  database: { level: 'silent', maxNumberOfLogs: 100_000 },
  loki: { level: 'error', interval: 60, address: 'http://loki:3100', username: 'loki-user', password: 'loki-password' },
  oia: { level: 'silent', interval: 10 },
  syslog: { level: 'silent', host: '', port: 514, protocol: 'udp4' }
};

describe('EditEngineLoggerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    engineService.updateEngineLogger.mockReturnValue(of(undefined));

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

  test('should initialize the form with the logger settings', async () => {
    const tester = new EditEngineLoggerModalTester();

    await expect.element(tester.auditRetentionDuration).toHaveValue(90);
    await expect.element(tester.consoleLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.fileLevel).toHaveDisplayValue('Trace');
    await expect.element(tester.databaseLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.lokiLevel).toHaveDisplayValue('Error');
    await expect.element(tester.oiaLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.syslogLevel).toHaveDisplayValue('Silent');
    await expect.element(tester.root.getByLabelText('Max file size')).toHaveValue(50);
    await expect.element(tester.root.getByLabelText('Loki url')).toHaveValue('http://loki:3100');
  });

  test('should initialize the audit retention duration to 0 when not set', async () => {
    const tester = new EditEngineLoggerModalTester();
    tester.fixture.componentInstance.initialize(buildEngineSettings({ auditRetentionDuration: null }));

    await expect.element(tester.auditRetentionDuration).toHaveValue(0);
  });

  test.each([
    ['OIAnalytics level', ['OIAnalytics interval']],
    ['Database level', ['Max number of logs']],
    ['File level', ['Max file size', 'Number of files']],
    ['Loki level', ['Loki interval', 'Loki url', 'Loki username', 'Loki password']],
    ['Syslog level', ['Syslog host', 'Syslog port', 'Syslog protocol']]
  ])('should only display the settings of %s when it is not silent', async (levelLabel, settingLabels) => {
    const tester = new EditEngineLoggerModalTester();
    const level = tester.root.getByLabelText(levelLabel);

    await level.selectOptions('Silent');
    for (const label of settingLabels) {
      await expect.element(tester.root.getByLabelText(label)).not.toBeInTheDocument();
    }

    await level.selectOptions('Info');
    for (const label of settingLabels) {
      await expect.element(tester.root.getByLabelText(label)).toBeInTheDocument();
    }
  });

  test('should save the logger settings and close the modal', async () => {
    const tester = new EditEngineLoggerModalTester();

    await tester.saveButton.click();

    expect(engineService.updateEngineLogger).toHaveBeenCalledWith(expectedCommand);
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should save the modified levels and settings', async () => {
    const tester = new EditEngineLoggerModalTester();

    await tester.auditRetentionDuration.fill('30');
    await tester.consoleLevel.selectOptions('Debug');
    await tester.oiaLevel.selectOptions('Warning');
    await tester.root.getByLabelText('OIAnalytics interval').fill('20');
    await tester.syslogLevel.selectOptions('Info');
    await tester.root.getByLabelText('Syslog host').fill('syslog.example.com');
    await tester.root.getByLabelText('Syslog protocol').selectOptions('TCP');
    await tester.saveButton.click();

    expect(engineService.updateEngineLogger).toHaveBeenCalledWith({
      ...expectedCommand,
      auditRetentionDuration: 30,
      console: { level: 'debug' },
      oia: { level: 'warn', interval: 20 },
      syslog: { level: 'info', host: 'syslog.example.com', port: 514, protocol: 'tcp' }
    });
  });

  test('should reject a negative audit retention duration', async () => {
    const tester = new EditEngineLoggerModalTester();

    await tester.auditRetentionDuration.fill('-1');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field must be at least 0')).toBeInTheDocument();
    expect(engineService.updateEngineLogger).not.toHaveBeenCalled();
  });

  test('should only validate the settings of a non silent output', async () => {
    const tester = new EditEngineLoggerModalTester();

    await tester.databaseLevel.selectOptions('Info');
    await tester.maxNumberOfLogs.fill('10');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field must be at least 100,000')).toBeInTheDocument();
    expect(engineService.updateEngineLogger).not.toHaveBeenCalled();

    await tester.databaseLevel.selectOptions('Silent');
    await tester.saveButton.click();

    expect(engineService.updateEngineLogger).toHaveBeenCalledWith({
      ...expectedCommand,
      database: { level: 'silent', maxNumberOfLogs: 10 }
    });
  });

  test('should keep the modal open when the save fails', async () => {
    const unhandledError = catchUnhandledErrors();
    engineService.updateEngineLogger.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new EditEngineLoggerModalTester();

    await tester.saveButton.click();

    await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss the modal on cancel', async () => {
    const tester = new EditEngineLoggerModalTester();

    await tester.cancelButton.click();

    expect(engineService.updateEngineLogger).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
