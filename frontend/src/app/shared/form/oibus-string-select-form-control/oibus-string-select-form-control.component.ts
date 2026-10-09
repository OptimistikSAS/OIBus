import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OIBusStringSelectAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusStringSelectFormControlComponent {
  readonly stringSelectAttribute = input.required<OIBusStringSelectAttribute>();
}
