import { Component, computed, effect, input } from '@angular/core';
import { AbstractControl, ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';
import { OIBusAttribute, OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { OIBusNumberFormControlComponent } from '../oibus-number-form-control/oibus-number-form-control.component';
import { OIBusStringFormControlComponent } from '../oibus-string-form-control/oibus-string-form-control.component';
import { OIBusInstantFormControlComponent } from '../oibus-instant-form-control/oibus-instant-form-control.component';
import { OIBusBooleanFormControlComponent } from '../oibus-boolean-form-control/oibus-boolean-form-control.component';
import { OIBusScanModeFormControlComponent } from '../oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { OIBusSecretFormControlComponent } from '../oibus-secret-form-control/oibus-secret-form-control.component';
import { OIBusStringSelectFormControlComponent } from '../oibus-string-select-form-control/oibus-string-select-form-control.component';
import { OIBusTimezoneFormControlComponent } from '../oibus-timezone-form-control/oibus-timezone-form-control.component';
import { OibusCertificateFormControlComponent } from '../oibus-certificate-form-control/oibus-certificate-form-control.component';
import { OIBusCodeFormControlComponent } from '../oibus-code-form-control/oibus-code-form-control.component';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { OIBusArrayFormControlComponent } from '../oibus-array-form-control/oibus-array-form-control.component';
import { addEnablingConditions } from '../dynamic-form.builder';

interface FormRow {
  columns: Array<FormColumn>;
  wrapInRow: boolean;
}

interface FormColumn {
  size: number;
  attribute: OIBusAttribute;
}

@Component({
  selector: 'oib-oibus-object-form-control',
  templateUrl: './oibus-object-form-control.component.html',
  styleUrl: './oibus-object-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    OIBusNumberFormControlComponent,
    OIBusStringFormControlComponent,
    OIBusInstantFormControlComponent,
    OIBusBooleanFormControlComponent,
    OIBusArrayFormControlComponent,
    OIBusScanModeFormControlComponent,
    OIBusSecretFormControlComponent,
    OIBusStringSelectFormControlComponent,
    OIBusTimezoneFormControlComponent,
    OibusCertificateFormControlComponent,
    OIBusCodeFormControlComponent,
    OIBusArrayFormControlComponent
  ]
})
export class OIBusObjectFormControlComponent {
  scanModes = input.required<Array<ScanModeDTO>>();
  certificates = input.required<Array<CertificateDTO>>();
  group = input.required<FormGroup>();
  objectAttribute = input.required<OIBusObjectAttribute>();
  southId = input<string>();

  formRows = computed(() => {
    const rows: Array<FormRow> = [];
    this.objectAttribute().attributes.forEach(attribute => {
      switch (attribute.type) {
        case 'object':
        case 'array':
          rows.push({
            columns: [{ attribute: attribute, size: 0 }],
            wrapInRow: false
          });
          break;
        case 'string':
        case 'code':
        case 'string-select':
        case 'number':
        case 'boolean':
        case 'instant':
        case 'secret':
        case 'scan-mode':
        case 'certificate':
        case 'timezone':
          if (!rows[attribute.displayProperties.row]) {
            rows[attribute.displayProperties.row] = { columns: [], wrapInRow: true };
          }
          rows[attribute.displayProperties.row].columns.push({
            size: attribute.displayProperties.columns,
            attribute: attribute
          });
          break;
      }
    });
    return rows;
  });

  constructor() {
    effect(() => {
      addEnablingConditions(this.group(), this.objectAttribute().enablingConditions);
    });
  }

  asFormGroup(abstractControl: AbstractControl): FormGroup {
    return abstractControl as FormGroup;
  }

  asFormControl(abstractControl: AbstractControl): FormControl {
    return abstractControl as FormControl;
  }
}
