import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OIBusSecretAttribute } from '../../../../../../backend/shared/model/form.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusSecretFormControlComponent {
  secretAttribute = input.required<OIBusSecretAttribute>();
}
