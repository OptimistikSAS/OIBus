import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder, Validators } from '@angular/forms';

import { Authentication, AuthenticationType } from '../../../../../../shared/model/engine.model';
import { TranslateModule } from '@ngx-translate/core';
import { AuthTypesEnumPipe } from '../../auth-types-enum.pipe';

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
  authCtrl = this.fb.group({
    type: ['none' as AuthenticationType, Validators.required],
    key: [null as string | null, Validators.required],
    secret: [null as string | null, Validators.required]
  });
  disabled = false;

  onChange: (value: Authentication) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.authCtrl.valueChanges.subscribe(newValue => {
      const authentication: Authentication = {
        type: newValue.type!,
        key: newValue.key!,
        secret: newValue.secret!
      };
      this.onChange(authentication);
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
    this.authCtrl.setValue(value);
  }
}
