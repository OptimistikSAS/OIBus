import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { RegisterOibusModalComponent } from './register-oibus-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { EngineService } from '../../../services/engine.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { RegistrationSettingsDTO } from '../../../../../../backend/shared/model/engine.model';

const registration: RegistrationSettingsDTO = {
  id: 'id',
  host: 'http://localhost:4200',
  acceptUnauthorized: false,
  useProxy: false,
  useApiGateway: false,
  apiGatewayHeaderKey: '',
  apiGatewayHeaderValue: '',
  apiGatewayBaseEndpoint: '',
  proxyUrl: '',
  proxyUsername: '',
  status: 'REGISTERED',
  commandRefreshInterval: 60,
  commandRetryInterval: 5,
  messageRetryInterval: 5,
  commandPermissions: {
    updateVersion: true,
    restartEngine: true,
    regenerateCipherKeys: true,
    updateEngineSettings: true,
    updateRegistrationSettings: true,
    createScanMode: true,
    updateScanMode: true,
    deleteScanMode: true,
    createIpFilter: true,
    updateIpFilter: true,
    deleteIpFilter: true,
    createCertificate: true,
    updateCertificate: true,
    deleteCertificate: true,
    createHistoryQuery: true,
    updateHistoryQuery: true,
    deleteHistoryQuery: true,
    createOrUpdateHistoryItemsFromCsv: true,
    testHistoryNorthConnection: true,
    testHistorySouthConnection: true,
    testHistorySouthItem: true,
    createSouth: true,
    updateSouth: true,
    deleteSouth: true,
    createOrUpdateSouthItemsFromCsv: true,
    testSouthConnection: true,
    testSouthItem: true,
    createNorth: true,
    updateNorth: true,
    deleteNorth: true,
    testNorthConnection: true,
    setpoint: true,
    searchNorthCacheContent: true,
    getNorthCacheFileContent: true,
    updateNorthCacheContent: true,
    searchHistoryCacheContent: true,
    getHistoryCacheFileContent: true,
    updateHistoryCacheContent: true,
    createCustomTransformer: true,
    updateCustomTransformer: true,
    deleteCustomTransformer: true,
    testCustomTransformer: true
  }
} as unknown as RegistrationSettingsDTO;

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
        { provide: EngineService, useValue: engineService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate form in edit mode with host disabled', async () => {
    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'edit');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const hostInput = root.getByCss('#host');
    await expect.element(hostInput).toHaveValue('http://localhost:4200');
    await expect.element(hostInput).toBeDisabled();
  });

  test('should test connection and show success', () => {
    engineService.testOIAnalyticsConnection.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register');
    fixture.componentInstance.form.controls.host.setValue('http://localhost:4200');
    fixture.detectChanges();

    fixture.componentInstance.testConnection();

    expect(engineService.testOIAnalyticsConnection).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.test-connection-success');
    expect(fixture.componentInstance.testSuccess()).toBe(true);
    expect(fixture.componentInstance.testLoading()).toBe(false);
  });

  test('should save in register mode', () => {
    engineService.register.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(RegisterOibusModalComponent);
    fixture.componentInstance.prepare(registration, 'register');
    fixture.componentInstance.form.controls.host.setValue('http://localhost:4200');
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(engineService.register).toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalled();
  });
});
