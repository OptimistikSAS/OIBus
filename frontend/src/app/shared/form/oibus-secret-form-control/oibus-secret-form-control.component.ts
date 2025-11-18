import { Component, inject, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OIBusSecretAttribute } from '../../../../../../backend/shared/model/form.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBUS_FORM_MODE } from '../oibus-form-mode.token';

@Component({
  selector: 'oib-oibus-secret-form-control',
  templateUrl: './oibus-secret-form-control.component.html',
  styleUrl: './oibus-secret-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusSecretFormControlComponent {
  secretAttribute = input.required<OIBusSecretAttribute>();

  private readonly formMode = inject(OIBUS_FORM_MODE);

  isEditMode(): boolean {
    return this.formMode() === 'edit';
  }
}
