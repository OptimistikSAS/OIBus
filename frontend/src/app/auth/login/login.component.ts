import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { RequestedUrlService } from '../authentication.guard';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { formDirectives } from '../../shared/form-directives';
import { CurrentUserService } from '../../shared/current-user.service';
import { TranslateModule } from '@ngx-translate/core';
import { WindowService } from '../../shared/window.service';

/**
 * The login component, displaying the password-based auth form.
 */
@Component({
  selector: 'oib-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  imports: [...formDirectives, TranslateModule, NgbCollapse],
  standalone: true
})
export class LoginComponent {
  private currentUserService = inject(CurrentUserService);
  private router = inject(Router);
  private requestedUrlService = inject(RequestedUrlService);
  private windowService = inject(WindowService);

  loginError = false;
  form: FormGroup = inject(NonNullableFormBuilder).group({
    login: ['', Validators.required],
    password: ['', Validators.required]
  });

  login() {
    if (this.form.invalid) {
      return;
    }

    this.loginError = false;
    this.currentUserService.loginWithPassword(this.form.value.login, this.form.value.password).subscribe({
      next: () => {
        this.router.navigateByUrl(this.requestedUrlService.getRequestedUrl()).then(() => {
          this.windowService.reload();
        });
      },
      error: () => (this.loginError = true)
    });
  }
}
