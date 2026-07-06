import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { OIARegistrationComponent } from './oia-registration.component';
import { EngineService } from '../../services/engine.service';
import { OibusCommandService } from '../../services/oibus-command.service';
import { ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { RegistrationSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';
import { emptyPage } from '../../shared/test-utils';
import { OIBusCommandDTO } from '../../../../../backend/shared/model/command.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const registrationNotRegistered: RegistrationSettingsDTO = {
  id: 'id',
  host: 'http://localhost:4200',
  acceptUnauthorized: false,
  useProxy: false,
  status: 'NOT_REGISTERED',
  activationCode: '',
  activationDate: '',
  activationExpirationDate: '',
  checkUrl: null,
  proxyUrl: null,
  proxyUsername: null,
  commandRefreshInterval: 10,
  commandRetryInterval: 5,
  messageRetryInterval: 5,
  commandPermissions: {}
} as unknown as RegistrationSettingsDTO;

const activatedRouteStub = {
  snapshot: {
    queryParamMap: {
      getAll: () => [],
      get: () => null
    }
  },
  queryParamMap: of({
    get: (_key: string) => null,
    getAll: (_key: string) => [] as Array<string>
  })
};

class OIARegistrationComponentTester {
  readonly fixture = TestBed.createComponent(OIARegistrationComponent);
  readonly title = page.getByCss('h1.oib-title');
  readonly registerButton = page.getByCss('#register-button');
  readonly unregisterButton = page.getByCss('#unregister-button');
}

describe('OIARegistrationComponent', () => {
  let engineService: MockObject<EngineService>;
  let commandService: MockObject<OibusCommandService>;
  let modalService: MockObject<ModalService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    vi.useFakeTimers();

    engineService = createMock(EngineService);
    commandService = createMock(OibusCommandService);
    modalService = createMock(ModalService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    engineService.getRegistrationSettings.mockReturnValue(of(registrationNotRegistered));
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    commandService.search.mockReturnValue(of(emptyPage<OIBusCommandDTO>()));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: EngineService, useValue: engineService },
        { provide: OibusCommandService, useValue: commandService },
        { provide: ModalService, useValue: modalService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should display NOT_REGISTERED state', async () => {
    const tester = new OIARegistrationComponentTester();
    tester.fixture.detectChanges();
    vi.advanceTimersByTime(0); // fire timer(0, ...) so registration signal is populated
    tester.fixture.detectChanges();

    await expect.element(tester.title).toBeInTheDocument();
    await expect.element(tester.registerButton).toBeInTheDocument();
  });

  test('should open register modal', () => {
    const fakeModal = {
      componentInstance: { prepare: vi.fn() },
      result: of(undefined)
    };
    modalService.open.mockReturnValue(fakeModal as any);

    const tester = new OIARegistrationComponentTester();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.register();

    expect(modalService.open).toHaveBeenCalledWith(RegisterOibusModalComponent, expect.anything());
  });

  test('should unregister', () => {
    const registrationPending: RegistrationSettingsDTO = {
      ...registrationNotRegistered,
      status: 'PENDING',
      activationCode: 'ABC123',
      activationExpirationDate: '2020-01-01T00:00:00Z'
    } as unknown as RegistrationSettingsDTO;

    engineService.getRegistrationSettings.mockReturnValue(of(registrationPending));
    confirmationService.confirm.mockReturnValue(of(undefined));
    engineService.unregister.mockReturnValue(of(undefined));
    engineService.getRegistrationSettings.mockReturnValueOnce(of(registrationPending)).mockReturnValue(of(registrationNotRegistered));

    const tester = new OIARegistrationComponentTester();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.unregister();

    expect(engineService.unregister).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('oia-module.registration.unregistered');
  });
});
