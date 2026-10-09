import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { OIBusInstantAttribute } from '@oibus/shared/connector/form.model';

import { DatetimepickerComponent } from '../../datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

@Component({
  selector: 'oib-oibus-instant-form-control',
  templateUrl: './oibus-instant-form-control.component.html',
  styleUrl: './oibus-instant-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, DatetimepickerComponent]
})
export class OIBusInstantFormControlComponent {
  readonly instantAttribute = input.required<OIBusInstantAttribute>();
}
