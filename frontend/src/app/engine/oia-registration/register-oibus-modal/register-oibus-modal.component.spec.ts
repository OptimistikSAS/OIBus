import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { RegisterOibusModalComponent } from './register-oibus-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { EngineService } from '../../../services/engine.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { RegistrationSettingsDTO } from '../../../../../../backend/shared/model/engine.model';

describe('RegisterOibusModalComponent', () => {
  let engineService: MockObject<EngineService>;
  let activeModal: MockObject<NgbActiveModal>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    activeModal = createMock(NgbActiveModal);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should render in register mode', async () => {
    const registration = testData.oIAnalytics.registration.completed as unknown as RegistrationSettingsDTO;
    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register', false);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#host')).toBeInTheDocument();
  });

  test('should populate form in edit mode with host disabled', async () => {
    const registration = testData.oIAnalytics.registration.completed as unknown as RegistrationSettingsDTO;
    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'edit', false);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const hostInput = root.getByCss('#host');
    await expect.element(hostInput).toHaveValue(registration.host);
    await expect.element(hostInput).toBeDisabled();
  });

  test('should test connection and show success', () => {
    const registration = testData.oIAnalytics.registration.completed as unknown as RegistrationSettingsDTO;
    engineService.testOIAnalyticsConnection.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register', false);
    fixture.componentInstance.form.controls.host.setValue('http://localhost:4200');
    fixture.detectChanges();

    fixture.componentInstance.testConnection();

    expect(engineService.testOIAnalyticsConnection).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.test-connection-success');
    expect(fixture.componentInstance.testSuccess()).toBe(true);
    expect(fixture.componentInstance.testLoading()).toBe(false);
  });

  test('should save in register mode', () => {
    const registration = testData.oIAnalytics.registration.completed as unknown as RegistrationSettingsDTO;
    engineService.register.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register', false);
    fixture.componentInstance.form.controls.host.setValue('http://localhost:4200');
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(engineService.register).toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should disable the update-version toggle when remote update is ignored', async () => {
    const registration = testData.oIAnalytics.registration.completed as unknown as RegistrationSettingsDTO;

    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register', true);
    fixture.detectChanges();

    const updateVersionControl = fixture.componentInstance.form.controls.commandPermissions.controls.updateVersion;
    expect(updateVersionControl.disabled).toBe(true);
    expect(updateVersionControl.value).toBe(false);
    expect(fixture.componentInstance.ignoreRemoteUpdate()).toBe(true);

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#remote-update-disabled')).toBeInTheDocument();
    await expect.element(root.getByCss('#update-version')).toBeDisabled();
  });
});
