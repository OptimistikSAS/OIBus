import { Component, Input } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { ControlContainer, FormGroupName, FormRecord, NonNullableFormBuilder } from '@angular/forms';
import { formDirectives } from '../form-directives';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { OibTextComponent } from './oib-text/oib-text.component';
import { OibTextAreaComponent } from './oib-text-area/oib-text-area.component';
import { OibNumberComponent } from './oib-number/oib-number.component';
import { OibCodeBlockComponent } from './oib-code-block/oib-code-block.component';
import { OibSelectComponent } from './oib-select/oib-select.component';
import { OibCheckboxComponent } from './oib-checkbox/oib-checkbox.component';
import { OibSecretComponent } from './oib-secret/oib-secret.component';
import { OibTimezoneComponent } from './oib-timezone/oib-timezone.component';

@Component({
  selector: 'oib-form',
  standalone: true,
  imports: [
    ...formDirectives,
    NgIf,
    NgForOf,
    OibTextComponent,
    OibTextAreaComponent,
    OibCodeBlockComponent,
    OibNumberComponent,
    OibCodeBlockComponent,
    OibSelectComponent,
    OibCheckboxComponent,
    OibSecretComponent,
    OibTimezoneComponent
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
  @Input() form: FormRecord = this.fb.record({});

  constructor(private fb: NonNullableFormBuilder) {}
}
