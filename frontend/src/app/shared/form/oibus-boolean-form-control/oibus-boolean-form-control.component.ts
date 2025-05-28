import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusBooleanAttribute } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-oibus-boolean-form-control',
  templateUrl: './oibus-boolean-form-control.component.html',
  styleUrl: './oibus-boolean-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusBooleanFormControlComponent {
  booleanAttribute = input.required<OIBusBooleanAttribute>();
}
