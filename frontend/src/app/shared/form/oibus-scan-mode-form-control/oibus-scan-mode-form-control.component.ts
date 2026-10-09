import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

@Component({
  selector: 'oib-oibus-scan-mode-form-control',
  templateUrl: './oibus-scan-mode-form-control.component.html',
  styleUrl: './oibus-scan-mode-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusScanModeFormControlComponent {
  readonly scanModeAttribute = input.required<OIBusScanModeAttribute>();
  readonly allScanModes = input.required<Array<ScanModeDTO>>();

  readonly scanModes = computed(() => {
    if (this.scanModeAttribute().acceptableType === 'SUBSCRIPTION') {
      return this.allScanModes().filter(scanMode => scanMode.id === 'subscription');
    } else if (this.scanModeAttribute().acceptableType === 'POLL') {
      return this.allScanModes().filter(scanMode => scanMode.id !== 'subscription');
    } else {
      return this.allScanModes();
    }
  });
}
