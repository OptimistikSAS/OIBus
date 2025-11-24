import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';

import { OIARegistrationComponent } from './oia-registration.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EngineService } from '../../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { OibusCommandService } from '../../services/oibus-command.service';
import { emptyPage } from '../../shared/test-utils';
import { OIBusCommandDTO } from '../../../../../backend/shared/model/command.model';

class OIARegistrationComponentTester extends ComponentTester<OIARegistrationComponent> {
  constructor() {
    super(OIARegistrationComponent);
  }

  get title() {
    return this.element('h1')!;
  }
}

describe('OIARegistrationComponent', () => {
  let tester: OIARegistrationComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;
  let commandService: jasmine.SpyObj<OibusCommandService>;

  const registrationSettings: RegistrationSettingsDTO = {
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
  } as RegistrationSettingsDTO;

  const route = stubRoute({
    queryParams: {
      page: '2'
    },
    params: {
      oibusId: 'id1'
    }
  });

  beforeEach(() => {
    engineService = createMock(EngineService);
    commandService = createMock(OibusCommandService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: EngineService, useValue: engineService },
        { provide: OibusCommandService, useValue: commandService }
      ]
    });

    commandService.search.and.returnValue(of(emptyPage<OIBusCommandDTO>()));
    engineService.getRegistrationSettings.and.returnValue(of(registrationSettings));

    tester = new OIARegistrationComponentTester();
  });

  it('should display title and settings', fakeAsync(async () => {
    await tester.change();
    tick(3000);
    await tester.change();

    expect(tester.title).toContainText('OIAnalytics registration');
    discardPeriodicTasks();
  }));
});
