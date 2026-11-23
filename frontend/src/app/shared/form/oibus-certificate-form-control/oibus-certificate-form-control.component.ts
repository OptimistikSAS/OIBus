import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { OIBusCertificateAttribute } from '@oibus/shared/connector/form.model';

import { CertificateCreator } from '../../../engine/certificate-list/certificate-creator.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { SelectOrCreateComponent } from '../select-or-create/select-or-create.component';

@Component({
  selector: 'oib-oibus-certificate-form-control',
  templateUrl: './oibus-certificate-form-control.component.html',
  styleUrl: './oibus-certificate-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SelectOrCreateComponent]
})
export class OibusCertificateFormControlComponent {
  readonly certificateCreator = inject(CertificateCreator);
  private readonly controlContainer = inject(ControlContainer);

  readonly certificateAttribute = input.required<OIBusCertificateAttribute>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  /**
   * Prefixed by the groups nesting the control under the settings, when there are: nested settings can have the key of
   * another certificate (the OPC UA certificate and the certificate authenticating the user are both `certificateId`)
   */
  readonly inputId = computed(() => [...(this.controlContainer.path ?? []).slice(1), this.certificateAttribute().key].join('-'));
}
