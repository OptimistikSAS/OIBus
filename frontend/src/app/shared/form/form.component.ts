import { Component, Input } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { ControlContainer, FormGroup, FormGroupName } from '@angular/forms';
import { formDirectives } from '../form-directives';
import { OibFormControl, OibFormGroup } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { OibCodeBlockComponent } from './oib-code-block/oib-code-block.component';
import { OibProxyComponent } from './oib-proxy/oib-proxy.component';
import { OibAuthComponent } from './oib-auth/oib-auth.component';
import { Timezone } from '../../../../../shared/model/types';
import { Observable } from 'rxjs';
import { inMemoryTypeahead } from '../typeahead';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { DatetimeFieldsComponent } from './oib-datetime-fields/datetime-fields.component';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}

@Component({
  selector: 'oib-form',
  standalone: true,
  imports: [
    ...formDirectives,
    NgIf,
    NgForOf,
    OibCodeBlockComponent,
    OibProxyComponent,
    OibAuthComponent,
    NgbTypeahead,
    TranslateModule,
    DatetimeFieldsComponent
  ],
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ]
})
export class FormComponent {
  @Input() settingsSchema: Array<Array<OibFormControl>> = [];
  @Input() scanModes: Array<ScanModeDTO> = [];
  @Input() proxies: Array<ProxyDTO> = [];
  @Input({ required: true }) formGroup!: FormGroup;

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );
  protected readonly FormGroup = FormGroup;

  getFormGroup(setting: OibFormGroup): FormGroup {
    return this.formGroup.controls[setting.key] as FormGroup;
  }
}
