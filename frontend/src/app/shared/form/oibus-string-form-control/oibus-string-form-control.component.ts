import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { OIBusStringAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusStringFormControlComponent {
  readonly stringAttribute = input.required<OIBusStringAttribute>();
}
