import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../i18n/mock-i18n';
import { WindowService } from './shared/window.service';
import { CurrentUserService } from './shared/current-user.service';
import { UserDTO } from '../../../backend/shared/model/user.model';
import { of } from 'rxjs';
import { EngineService } from './services/engine.service';
import { OIBusInfo } from '../../../backend/shared/model/engine.model';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../test/vitest-create-mock';

class AppComponentTester extends ComponentTester<AppComponent> {
  constructor() {
    super(AppComponent);
  }

  get navbar() {
    return this.element('oib-navbar');
  }

  get routerOutlet() {
    return this.element('router-outlet');
  }
}

describe('AppComponent', () => {
  let tester: AppComponentTester;

  let windowService: MockObject<WindowService>;
  let currentUserService: MockObject<CurrentUserService>;
  let engineService: MockObject<EngineService>;

  const currentUser = {
    login: 'admin',
    language: 'en',
    timezone: 'Asia/Tokyo'
  } as UserDTO;

  beforeEach(async () => {
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: EngineService, useValue: engineService }
      ]
    });

    currentUserService.get.mockReturnValue(of(currentUser));
    engineService.getInfo.mockReturnValue(of({ version: '3.0' } as OIBusInfo));
    (engineService as unknown as { info$: unknown }).info$ = of({ version: '3.0' } as OIBusInfo);
    tester = new AppComponentTester();
    await tester.change();
  });

  test('should have a navbar', () => {
    expect(tester.navbar).not.toBeNull();
  });

  test('should have a router outlet', () => {
    expect(tester.routerOutlet).not.toBeNull();
  });
});
