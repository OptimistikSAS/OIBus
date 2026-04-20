import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { LoginComponent } from './login.component';
import { CurrentUserService } from '../../shared/current-user.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { RequestedUrlService } from '../authentication.guard';
import { WindowService } from '../../shared/window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class LoginComponentTester {
  readonly fixture = TestBed.createComponent(LoginComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly login = this.root.getByLabelText('Login');
  readonly password = this.root.getByLabelText('Password');
  readonly loginButton = this.root.getByCss('#login-button');
  readonly validationErrors = this.root.getByCss('val-errors div');
  readonly alert = this.root.getByRole('alert');
}

describe('LoginComponent', () => {
  let tester: LoginComponentTester;
  let currentUserService: MockObject<CurrentUserService>;
  let requestedUrlService: MockObject<RequestedUrlService>;
  let router: MockObject<Router>;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    currentUserService = createMock(CurrentUserService);
    requestedUrlService = createMock(RequestedUrlService);
    router = createMock(Router);
    windowService = createMock(WindowService);

    requestedUrlService.getRequestedUrl.mockReturnValue('/about');
    router.navigateByUrl.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: Router, useValue: router },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: RequestedUrlService, useValue: requestedUrlService },
        { provide: WindowService, useValue: windowService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
    tester = new LoginComponentTester();
  });

  test('should display an empty form', async () => {
    await expect.element(tester.login).toHaveValue('');
    await expect.element(tester.password).toHaveValue('');
  });

  test('should validate', async () => {
    await tester.loginButton.click();

    await expect.element(tester.validationErrors).toHaveLength(2);
  });

  test('should login', async () => {
    currentUserService.loginWithPassword.mockReturnValue(of(null));

    await tester.login.fill('johndoe');
    await tester.password.fill('passw0rd');
    await tester.loginButton.click();
    await tester.fixture.whenStable();

    expect(currentUserService.loginWithPassword).toHaveBeenCalledWith('johndoe', 'passw0rd');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/about');
    expect(windowService.reload).toHaveBeenCalled();
  });

  test('should display an error if login fails', async () => {
    currentUserService.loginWithPassword.mockReturnValue(throwError(() => 'oops'));

    await tester.login.fill('johndoe');
    await tester.password.fill('passw0rd');
    await tester.loginButton.click();

    expect(currentUserService.loginWithPassword).toHaveBeenCalledWith('johndoe', 'passw0rd');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(windowService.reload).not.toHaveBeenCalled();
    await expect.element(tester.alert).toHaveTextContent('Invalid username or password');
  });
});
