import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../i18n/mock-i18n';
import testData from '../test/test-data';
import { createMock, MockObject } from '../test/vitest-create-mock';
import { AppComponent } from './app.component';
import { EngineService } from './services/engine.service';
import { CurrentUserService } from './shared/current-user.service';
import { MockModalService, provideModalTesting } from './shared/mock-modal.service.testing';
import { VersionCheckService } from './shared/version-check.service';
import { VersionUpdateModalComponent } from './shared/version-update-modal/version-update-modal.component';
import { WindowService } from './shared/window.service';

class AppComponentTester {
  readonly fixture = TestBed.createComponent(AppComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly navbar = this.root.getByRole('navigation');
  readonly main = this.root.getByRole('main');
}

describe('AppComponent', () => {
  let windowService: MockObject<WindowService>;
  let currentUserService: MockObject<CurrentUserService>;
  let versionCheckService: MockObject<VersionCheckService>;
  let versionChange$: Subject<{ oldVersion: string; newVersion: string }>;

  // language en and timezone Europe/Paris, same as the ones used by the window service by default
  const currentUser: UserDTO = testData.users.list[0];

  beforeEach(() => {
    versionChange$ = new Subject();
    windowService = createMock(WindowService);
    windowService.languageToUse.mockReturnValue('en');
    windowService.timezoneToUse.mockReturnValue('Europe/Paris');
    currentUserService = createMock(CurrentUserService);
    versionCheckService = createMock(VersionCheckService, { versionChange$ });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        provideModalTesting(),
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: EngineService, useValue: createMock(EngineService, { info$: of(testData.engine.oIBusInfo) }) },
        { provide: VersionCheckService, useValue: versionCheckService }
      ]
    });
  });

  describe('with an authenticated user', () => {
    let tester: AppComponentTester;

    beforeEach(() => {
      currentUserService.get.mockReturnValue(of(currentUser));
      tester = new AppComponentTester();
    });

    test('should display the navbar and the main content', async () => {
      await expect.element(tester.navbar).toBeVisible();
      await expect.element(tester.main).toBeInTheDocument();
    });

    test('should not reload when the language and the timezone are the used ones', async () => {
      await tester.fixture.whenStable();
      expect(windowService.storeLanguage).not.toHaveBeenCalled();
      expect(windowService.storeTimezone).not.toHaveBeenCalled();
      expect(windowService.reload).not.toHaveBeenCalled();
    });

    test('should start version monitoring and stop it on destroy', async () => {
      await tester.fixture.whenStable();
      expect(versionCheckService.startMonitoring).toHaveBeenCalledTimes(1);
      expect(versionCheckService.stopMonitoring).not.toHaveBeenCalled();

      tester.fixture.destroy();

      expect(versionCheckService.stopMonitoring).toHaveBeenCalledTimes(1);
    });

    test('should open the version update modal when the version changes', async () => {
      await tester.fixture.whenStable();
      const modalService = TestBed.inject(MockModalService<VersionUpdateModalComponent>);
      const fakeModal = createMock(VersionUpdateModalComponent);
      modalService.mockClosedModal(fakeModal);
      const open = vi.spyOn(modalService, 'open');

      versionChange$.next({ oldVersion: '3.4.0', newVersion: '3.5.0' });

      expect(open).toHaveBeenCalledWith(VersionUpdateModalComponent, { backdrop: 'static', keyboard: false });
      expect(fakeModal.initialize).toHaveBeenCalledWith('3.4.0', '3.5.0');
    });

    test('should not open the version update modal once destroyed', async () => {
      await tester.fixture.whenStable();
      const modalService = TestBed.inject(MockModalService<VersionUpdateModalComponent>);
      const open = vi.spyOn(modalService, 'open');
      tester.fixture.destroy();

      versionChange$.next({ oldVersion: '3.4.0', newVersion: '3.5.0' });

      expect(open).not.toHaveBeenCalled();
    });
  });

  test.each([
    { mismatch: 'language', user: { ...currentUser, language: 'fr' } satisfies UserDTO },
    { mismatch: 'timezone', user: { ...currentUser, timezone: 'Asia/Tokyo' } satisfies UserDTO }
  ])('should store the user preferences and reload when the $mismatch differs', async ({ user }) => {
    currentUserService.get.mockReturnValue(of(user));
    const tester = new AppComponentTester();
    await tester.fixture.whenStable();

    expect(windowService.storeLanguage).toHaveBeenCalledWith(user.language);
    expect(windowService.storeTimezone).toHaveBeenCalledWith(user.timezone);
    expect(windowService.reload).toHaveBeenCalledTimes(1);
  });

  test('should neither reload nor monitor the version without user', async () => {
    currentUserService.get.mockReturnValue(of(null));
    const tester = new AppComponentTester();

    await expect.element(tester.navbar).toBeVisible();
    expect(windowService.reload).not.toHaveBeenCalled();
    expect(versionCheckService.startMonitoring).not.toHaveBeenCalled();
  });
});
