import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusStringAttribute } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-oibus-string-form-control',
  templateUrl: './oibus-string-form-control.component.html',
  styleUrl: './oibus-string-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusStringFormControlComponent {
  stringAttribute = input.required<OIBusStringAttribute>();
}
