import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { CurrentUserService } from '../../shared/current-user.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { WindowService } from '../../shared/window.service';
import { PASSWORD_CHANGED_PARAM, RequestedUrlService } from '../authentication.guard';

/**
 * The login component, displaying the password-based auth form.
 */
@Component({
  selector: 'oib-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, NgbCollapse, OI_FORM_VALIDATION_DIRECTIVES]
})
export class LoginComponent {
  private currentUserService = inject(CurrentUserService);
  private router = inject(Router);
  private requestedUrlService = inject(RequestedUrlService);
  private windowService = inject(WindowService);
  private fb = inject(NonNullableFormBuilder);

  /** Set when the password change page logged out the user once their password changed, to log in with the new one */
  readonly passwordChanged = inject(ActivatedRoute).snapshot.queryParamMap.has(PASSWORD_CHANGED_PARAM);
  readonly loginError = signal(false);
  readonly form = this.fb.group({
    login: ['', Validators.required],
    password: ['', Validators.required]
  });

  login() {
    if (!this.form.valid) {
      return;
    }

    this.loginError.set(false);
    const value = this.form.getRawValue();
    this.currentUserService.loginWithPassword(value.login, value.password).subscribe({
      next: () => {
        // Reloaded on the page the guards lead to (the password change page for a user who must change it first), not
        // when they refuse the navigation, which would only show the login form again
        this.router.navigateByUrl(this.requestedUrlService.getRequestedUrl()).then(navigated => {
          if (navigated) {
            this.windowService.reload();
          }
        });
      },
      error: () => this.loginError.set(true)
    });
  }
}
