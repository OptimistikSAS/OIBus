import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { CurrentUserService } from '../../shared/current-user.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../../shared/form/oi-ngb-testing';
import { WindowService } from '../../shared/window.service';
import { RequestedUrlService } from '../authentication.guard';
import { LoginComponent } from './login.component';

class LoginComponentTester {
  readonly fixture = TestBed.createComponent(LoginComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly login = this.root.getByLabelText('Login');
  readonly password = this.root.getByLabelText('Password');
  readonly loginButton = this.root.getByRole('button', { name: 'Sign in' });
  readonly requiredErrors = this.root.getByText('This field is required');
  readonly alert = this.root.getByRole('alert');

  async submit(login: string, password: string) {
    await this.login.fill(login);
    await this.password.fill(password);
    await this.loginButton.click();
  }
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
        provideNgbConfigTesting(),
        { provide: Router, useValue: router },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: RequestedUrlService, useValue: requestedUrlService },
        { provide: WindowService, useValue: windowService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new LoginComponentTester();
  });

  test('should display an empty form without error', async () => {
    await expect.element(tester.login).toHaveValue('');
    await expect.element(tester.password).toHaveValue('');
    await expect.element(tester.alert).not.toBeInTheDocument();
  });

  test('should validate the required fields', async () => {
    await tester.loginButton.click();

    await expect.element(tester.requiredErrors).toHaveLength(2);
    expect(currentUserService.loginWithPassword).not.toHaveBeenCalled();
  });

  test('should login, navigate to the requested url and reload', async () => {
    currentUserService.loginWithPassword.mockReturnValue(of(testData.users.list[0]));

    await tester.submit('johndoe', 'passw0rd');

    expect(currentUserService.loginWithPassword).toHaveBeenCalledWith('johndoe', 'passw0rd');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/about');
    await expect.poll(() => windowService.reload).toHaveBeenCalled();
  });

  test('should display an error if login fails, and hide it when retrying', async () => {
    currentUserService.loginWithPassword.mockReturnValue(throwError(() => 'oops'));

    await tester.submit('johndoe', 'passw0rd');

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(windowService.reload).not.toHaveBeenCalled();
    await expect.element(tester.alert).toBeVisible();
    await expect.element(tester.alert).toHaveTextContent('Invalid username or password');

    const retry = new Subject<UserDTO | null>();
    currentUserService.loginWithPassword.mockReturnValue(retry);
    await tester.submit('johndoe', 'secret');

    expect(currentUserService.loginWithPassword).toHaveBeenLastCalledWith('johndoe', 'secret');
    await expect.element(tester.alert).not.toBeInTheDocument();
  });
});
