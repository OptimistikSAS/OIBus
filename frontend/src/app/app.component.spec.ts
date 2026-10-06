import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusInfo } from '@oibus/shared/api/engine.model';
import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../i18n/mock-i18n';
import { createMock, MockObject } from '../test/vitest-create-mock';
import { AppComponent } from './app.component';
import { EngineService } from './services/engine.service';
import { CurrentUserService } from './shared/current-user.service';
import { WindowService } from './shared/window.service';

class AppComponentTester {
  readonly fixture = TestBed.createComponent(AppComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly navbar = this.root.getByCss('oib-navbar');
  readonly routerOutlet = this.root.getByCss('router-outlet');
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

  beforeEach(() => {
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
    tester.fixture.detectChanges();
  });

  test('should have a navbar', async () => {
    await expect.element(tester.navbar).toBeInTheDocument();
  });

  test('should have a router outlet', async () => {
    await expect.element(tester.routerOutlet).toBeInTheDocument();
  });
});
