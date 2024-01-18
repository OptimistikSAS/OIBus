import { TestBed } from '@angular/core/testing';

import { OiaModuleComponent } from './oia-module.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EngineService } from '../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';
import { OibusCommandService } from '../services/oibus-command.service';
import { emptyPage } from '../shared/test-utils';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';

class OiaModuleComponentTester extends ComponentTester<OiaModuleComponent> {
  constructor() {
    super(OiaModuleComponent);
  }

  get title() {
    return this.element('h1')!;
  }
}

describe('OiaModuleComponent', () => {
  let tester: OiaModuleComponentTester;
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
    activationExpirationDate: ''
  };

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
        provideHttpClient(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: EngineService, useValue: engineService }
      ]
    });

    commandService.searchCommands.and.returnValue(of(emptyPage<OIBusCommandDTO>()));
    tester = new OiaModuleComponentTester();
  });

  it('should display title and settings', () => {
    engineService.getRegistrationSettings.and.returnValue(of(registrationSettings));
    tester.detectChanges();

    expect(tester.title).toContainText('OIA Module');
  });
});
