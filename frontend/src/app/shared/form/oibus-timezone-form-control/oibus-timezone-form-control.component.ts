import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { Timezone } from '@oibus/shared/common/types';
import { OIBusTimezoneAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { inMemoryTypeahead } from '../typeahead';
import { OI_TYPEAHEAD_DIRECTIVES } from '../typeahead-directives';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, OI_TYPEAHEAD_DIRECTIVES]
})
export class OIBusTimezoneFormControlComponent {
  readonly timezoneAttribute = input.required<OIBusTimezoneAttribute>();

  private readonly timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  readonly timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );
}
