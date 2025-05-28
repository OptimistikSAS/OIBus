import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusStringSelectAttribute } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-oibus-string-select-form-control',
  templateUrl: './oibus-string-select-form-control.component.html',
  styleUrl: './oibus-string-select-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslatePipe, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusStringSelectFormControlComponent {
  stringSelectAttribute = input.required<OIBusStringSelectAttribute>();
}
