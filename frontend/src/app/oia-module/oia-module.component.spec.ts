import { TestBed } from '@angular/core/testing';

import { OiaModuleComponent } from './oia-module.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EngineService } from '../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';

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

  beforeEach(() => {
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideRouter([]), { provide: EngineService, useValue: engineService }]
    });

    tester = new OiaModuleComponentTester();
  });

  it('should display title and settings', () => {
    engineService.getRegistrationSettings.and.returnValue(of(registrationSettings));
    tester.detectChanges();

    expect(tester.title).toContainText('OIA Module');
  });
});
