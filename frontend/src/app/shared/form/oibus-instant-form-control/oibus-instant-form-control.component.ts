import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { DatetimepickerComponent } from '../../datetimepicker/datetimepicker.component';
import { OIBusInstantAttribute } from '../../../../../../backend/shared/model/form.model';

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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, DatetimepickerComponent]
})
export class OIBusInstantFormControlComponent {
  instantAttribute = input.required<OIBusInstantAttribute>();
}
