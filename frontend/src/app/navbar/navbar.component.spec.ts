import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { CurrentUserService } from '../shared/current-user.service';
import { EngineService } from '../services/engine.service';
import { NavbarComponent } from './navbar.component';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { UserDTO } from '../../../../backend/shared/model/user.model';
import { OIBusInfo } from '../../../../backend/shared/model/engine.model';

const currentUser = { login: 'admin', language: 'en', timezone: 'Asia/Tokyo' } as UserDTO;

class NavbarComponentTester {
  readonly fixture = TestBed.createComponent(NavbarComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly navItems = this.root.getByCss('.nav-item');
  readonly version = this.root.getByCss('#navbar-version');
}

describe('NavbarComponent', () => {
  let currentUserService: MockObject<CurrentUserService>;
  let engineService: MockObject<EngineService>;

  beforeEach(() => {
    currentUserService = createMock(CurrentUserService);
    engineService = createMock(EngineService);
    (engineService as any).info$ = of({ version: '3.0' } as OIBusInfo);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: EngineService, useValue: engineService }
      ]
    });
  });

  test('should not display menu items when there is no user', async () => {
    currentUserService.get.mockReturnValue(of(null));
    const tester = new NavbarComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.navItems).not.toBeInTheDocument();
  });

  test('should have a navbar with nav items', async () => {
    currentUserService.get.mockReturnValue(of(currentUser));
    const tester = new NavbarComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.navItems).toHaveLength(11);
    await expect.element(tester.navItems.nth(0)).toHaveTextContent('Engine');
    await expect.element(tester.navItems.nth(1)).toHaveTextContent('North');
    await expect.element(tester.navItems.nth(2)).toHaveTextContent('South');
    await expect.element(tester.navItems.nth(3)).toHaveTextContent('History');
    await expect.element(tester.navItems.nth(4)).toHaveTextContent('Logs');
    await expect.element(tester.navItems.nth(5)).toHaveTextContent('About');
  });

  test('should display version when it is available and there is a user', async () => {
    currentUserService.get.mockReturnValue(of(currentUser));
    const tester = new NavbarComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.version).toHaveTextContent('Version: 3.0');
  });

  test('should logout when logout is called', () => {
    currentUserService.get.mockReturnValue(of(currentUser));
    const tester = new NavbarComponentTester();
    tester.fixture.detectChanges();
    tester.fixture.componentInstance.logout();
    expect(currentUserService.logout).toHaveBeenCalled();
  });
});
