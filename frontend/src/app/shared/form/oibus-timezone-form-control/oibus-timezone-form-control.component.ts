import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OI_TYPEAHEAD_DIRECTIVES } from '../typeahead-directives';
import { OIBusTimezoneAttribute } from '../../../../../../backend/shared/model/form.model';
import { Timezone } from '../../../../../../backend/shared/model/types';
import { inMemoryTypeahead } from '../typeahead';

@Component({
  selector: 'oib-oibus-timezone-form-control',
  templateUrl: './oibus-timezone-form-control.component.html',
  styleUrl: './oibus-timezone-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, OI_TYPEAHEAD_DIRECTIVES]
})
export class OIBusTimezoneFormControlComponent {
  timezoneAttribute = input.required<OIBusTimezoneAttribute>();

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );
}
