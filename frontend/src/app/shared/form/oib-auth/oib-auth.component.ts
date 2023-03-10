import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

import { Authentication, AuthenticationType } from '../../../../../../shared/model/engine.model';
import { TranslateModule } from '@ngx-translate/core';
import { AuthTypesEnumPipe } from '../../auth-types-enum.pipe';
import { createAuthenticationForm } from '../../utils';

@Component({
  selector: 'oib-auth',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, AuthTypesEnumPipe],
  templateUrl: './oib-auth.component.html',
  styleUrls: ['./oib-auth.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibAuthComponent), multi: true }]
})
export class OibAuthComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  @Input() authTypes: Array<AuthenticationType> = [];
  authCtrl = this.fb.group(createAuthenticationForm({ type: 'none' }));
  disabled = false;

  onChange: (value: Authentication) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.authCtrl.controls.type.valueChanges.subscribe(newValue => {
      switch (newValue) {
        case 'none':
          this.authCtrl.controls.username.disable();
          this.authCtrl.controls.password.disable();
          this.authCtrl.controls.token.disable();
          this.authCtrl.controls.key.disable();
          this.authCtrl.controls.secret.disable();
          this.authCtrl.controls.certPath.disable();
          this.authCtrl.controls.keyPath.disable();
          break;

        case 'basic':
          this.authCtrl.controls.username.enable();
          this.authCtrl.controls.password.enable();
          this.authCtrl.controls.token.disable();
          this.authCtrl.controls.key.disable();
          this.authCtrl.controls.secret.disable();
          this.authCtrl.controls.certPath.disable();
          this.authCtrl.controls.keyPath.disable();
          break;

        case 'bearer':
          this.authCtrl.controls.username.disable();
          this.authCtrl.controls.password.disable();
          this.authCtrl.controls.token.enable();
          this.authCtrl.controls.key.disable();
          this.authCtrl.controls.secret.disable();
          this.authCtrl.controls.certPath.disable();
          this.authCtrl.controls.keyPath.disable();
          break;

        case 'api-key':
          this.authCtrl.controls.username.disable();
          this.authCtrl.controls.password.disable();
          this.authCtrl.controls.token.disable();
          this.authCtrl.controls.key.enable();
          this.authCtrl.controls.secret.enable();
          this.authCtrl.controls.certPath.disable();
          this.authCtrl.controls.keyPath.disable();
          break;

        case 'cert':
          this.authCtrl.controls.username.disable();
          this.authCtrl.controls.password.disable();
          this.authCtrl.controls.token.disable();
          this.authCtrl.controls.key.disable();
          this.authCtrl.controls.secret.disable();
          this.authCtrl.controls.certPath.enable();
          this.authCtrl.controls.keyPath.enable();
          break;
      }
    });

    this.authCtrl.valueChanges.subscribe(newValue => {
      switch (newValue.type) {
        case 'none':
          this.onChange({ type: 'none' });
          break;

        case 'basic':
          this.onChange({ type: 'basic', username: newValue.username!, password: newValue.password! });
          break;

        case 'bearer':
          this.onChange({ type: 'bearer', token: newValue.token! });
          break;

        case 'api-key':
          this.onChange({ type: 'api-key', key: newValue.key!, secret: newValue.secret! });
          break;

        case 'cert':
          this.onChange({ type: 'cert', keyPath: newValue.keyPath!, certPath: newValue.certPath! });
          break;
      }
    });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.authCtrl.disable();
    } else {
      this.authCtrl.enable();
    }
  }

  writeValue(value: Authentication): void {
    switch (value.type) {
      case 'none':
        this.authCtrl.patchValue({ type: 'none' });
        break;
      case 'basic':
        this.authCtrl.patchValue({ type: 'basic', username: value.username!, password: value.password! });
        break;
      case 'bearer':
        this.authCtrl.patchValue({ type: 'bearer', token: value.token! });
        break;
      case 'api-key':
        this.authCtrl.patchValue({ type: 'api-key', key: value.key!, secret: value.secret! });
        break;
      case 'cert':
        this.authCtrl.patchValue({ type: 'cert', keyPath: value.keyPath!, certPath: value.certPath! });
        break;
    }
  }
}
