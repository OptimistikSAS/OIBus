import { Component, computed, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusScanModeAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';

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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OIBusScanModeFormControlComponent {
  scanModeAttribute = input.required<OIBusScanModeAttribute>();
  allScanModes = input.required<Array<ScanModeDTO>>();

  scanModes = computed(() => {
    if (this.scanModeAttribute().acceptableType === 'SUBSCRIPTION') {
      return this.allScanModes().filter(scanMode => scanMode.id === 'subscription');
    } else if (this.scanModeAttribute().acceptableType === 'POLL') {
      return this.allScanModes().filter(scanMode => scanMode.id !== 'subscription');
    } else {
      return this.allScanModes();
    }
  });
}
