import { ComponentTester, createMock } from 'ngx-speculoos';
import { LoginComponent } from './login.component';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../shared/current-user.service';
import { provideHttpClient } from '@angular/common/http';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { AuthenticationGuard } from '../authentication.guard';

class LoginComponentTester extends ComponentTester<LoginComponent> {
  constructor() {
    super(LoginComponent);
  }

  get login() {
    return this.input('#login')!;
  }

  get password() {
    return this.input('#password')!;
  }

  get loginButton() {
    return this.button('#login-button')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }
}

describe('LoginComponent', () => {
  let tester: LoginComponentTester;

  let currentUserService: jasmine.SpyObj<CurrentUserService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    currentUserService = createMock(CurrentUserService);
    router = createMock(Router);

    const authenticationGuard = jasmine.createSpyObj<AuthenticationGuard>('AuthenticationGuard', ['getRequestedUrl']);
    authenticationGuard.getRequestedUrl.and.returnValue('/about');

    TestBed.configureTestingModule({
      imports: [LoginComponent, DefaultValidationErrorsComponent],
      providers: [
        provideHttpClient(),
        provideTestingI18n(),
        { provide: Router, useValue: router },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: AuthenticationGuard, useValue: authenticationGuard }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new LoginComponentTester();
    tester.detectChanges();
  });

  it('should display an empty form', () => {
    expect(tester.login).toHaveValue('');
    expect(tester.password).toHaveValue('');
  });

  it('should validate', () => {
    tester.loginButton.click();

    expect(tester.validationErrors.length).toBe(2);
  });

  it('should login', () => {
    currentUserService.loginWithPassword.and.returnValue(of(null));

    tester.login.fillWith('johndoe');
    tester.password.fillWith('passw0rd');
    tester.loginButton.click();
    expect(currentUserService.loginWithPassword).toHaveBeenCalledWith('johndoe', 'passw0rd');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/about');
  });

  it('should display an error if login fails', () => {
    currentUserService.loginWithPassword.and.returnValue(throwError(() => 'oops'));

    tester.login.fillWith('johndoe');
    tester.password.fillWith('passw0rd');
    tester.loginButton.click();
    expect(currentUserService.loginWithPassword).toHaveBeenCalledWith('johndoe', 'passw0rd');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(tester.testElement).toContainText('Invalid username or password');
  });
});
