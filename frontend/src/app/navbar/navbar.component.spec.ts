import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { NEVER, Observable, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusInfo } from '@oibus/shared/api/engine.model';
import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { EngineService } from '../services/engine.service';
import { CurrentUserService } from '../shared/current-user.service';
import { NavbarComponent } from './navbar.component';

const currentUser: UserDTO = testData.users.list[0];

class NavbarComponentTester {
  readonly fixture = TestBed.createComponent(NavbarComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly navItems = this.root.getByCss('.nav-item');
  readonly version = this.root.getByText(/^Version:/);
  readonly userLogin = this.root.getByText(currentUser.login, { exact: true });
  readonly accountMenu = this.root.getByRole('button', { name: 'Account' });
  readonly logoutButton = this.root.getByRole('button', { name: 'Logout' });
  readonly documentationLink = this.root.getByRole('link', { name: 'Documentation' });
}

describe('NavbarComponent', () => {
  let currentUserService: MockObject<CurrentUserService>;

  function setup(user: UserDTO | null, info$: Observable<OIBusInfo> = of(testData.engine.oIBusInfo)) {
    currentUserService = createMock(CurrentUserService);
    currentUserService.get.mockReturnValue(of(user));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: EngineService, useValue: createMock(EngineService, { info$ }) }
      ]
    });
    return new NavbarComponentTester();
  }

  describe('without user', () => {
    let tester: NavbarComponentTester;

    beforeEach(() => {
      tester = setup(null);
    });

    test('should not display menu items, version nor login', async () => {
      await expect.element(tester.root.getByRole('img', { name: 'logo' })).toBeVisible();
      await expect.element(tester.navItems).not.toBeInTheDocument();
      await expect.element(tester.version).not.toBeInTheDocument();
    });

    test('should set the default page title', async () => {
      await tester.fixture.whenStable();
      expect(TestBed.inject(Title).getTitle()).toBe('OIBus');
    });
  });

  describe('with user', () => {
    let tester: NavbarComponentTester;

    beforeEach(() => {
      tester = setup(currentUser);
    });

    test('should display the nav items', async () => {
      await expect.element(tester.navItems).toHaveLength(11);
      await expect.element(tester.navItems.nth(0)).toHaveTextContent('Engine');
      await expect.element(tester.navItems.nth(1)).toHaveTextContent('North');
      await expect.element(tester.navItems.nth(2)).toHaveTextContent('South');
      await expect.element(tester.navItems.nth(3)).toHaveTextContent('History');
      await expect.element(tester.navItems.nth(4)).toHaveTextContent('Logs');
      await expect.element(tester.navItems.nth(5)).toHaveTextContent('About');
      await expect.element(tester.documentationLink).toBeVisible();
    });

    test('should display the version and the user login', async () => {
      await expect.element(tester.version).toHaveTextContent(`Version: ${testData.engine.oIBusInfo.version}`);
      await expect.element(tester.userLogin).toBeVisible();
    });

    test('should set the page title with the OIBus name', async () => {
      await expect.element(tester.version).toBeVisible();
      expect(TestBed.inject(Title).getTitle()).toBe(`OIBus - ${testData.engine.oIBusInfo.oibusName}`);
    });

    test('should logout when clicking on logout', async () => {
      await tester.accountMenu.click();
      await tester.logoutButton.click();

      expect(currentUserService.logout).toHaveBeenCalledTimes(1);
    });
  });

  test('should not display the version when the info is not available', async () => {
    const tester = setup(currentUser, NEVER);

    await expect.element(tester.userLogin).toBeVisible();
    await expect.element(tester.version).not.toBeInTheDocument();
  });
});
