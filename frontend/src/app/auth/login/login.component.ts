import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RequestedUrlService } from '../authentication.guard';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { CurrentUserService } from '../../shared/current-user.service';
import { TranslateDirective } from '@ngx-translate/core';
import { WindowService } from '../../shared/window.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';

/**
 * The login component, displaying the password-based auth form.
 */
@Component({
  selector: 'oib-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, NgbCollapse, OI_FORM_VALIDATION_DIRECTIVES]
})
export class LoginComponent {
  private currentUserService = inject(CurrentUserService);
  private router = inject(Router);
  private requestedUrlService = inject(RequestedUrlService);
  private windowService = inject(WindowService);

  readonly loginError = signal(false);
  form = inject(NonNullableFormBuilder).group({
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
        this.router.navigateByUrl(this.requestedUrlService.getRequestedUrl()).then(() => {
          this.windowService.reload();
        });
      },
      error: () => this.loginError.set(true)
    });
  }
}
