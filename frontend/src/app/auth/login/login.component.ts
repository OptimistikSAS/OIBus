import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthenticationGuard } from '../authentication.guard';
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
  styleUrls: ['./login.component.scss'],
  imports: [...formDirectives, TranslateModule, NgbCollapse],
  standalone: true
})
export class LoginComponent {
  loginError = false;
  form: FormGroup = this.fb.group({
    login: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private currentUserService: CurrentUserService,
    private router: Router,
    private authenticationGuard: AuthenticationGuard,
    private windowService: WindowService
  ) {}

  login() {
    if (this.form.invalid) {
      return;
    }

    this.loginError = false;
    this.currentUserService.loginWithPassword(this.form.value.login, this.form.value.password).subscribe({
      next: () => {
        this.router.navigateByUrl(this.authenticationGuard.getRequestedUrl()).then(() => {
          this.windowService.reload();
        });
      },
      error: () => (this.loginError = true)
    });
  }
}
