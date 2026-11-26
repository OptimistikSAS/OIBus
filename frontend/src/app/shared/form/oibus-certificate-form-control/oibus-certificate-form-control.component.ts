import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { OIBusCertificateAttribute } from '@oibus/shared/connector/form.model';

import { CertificateCreator } from '../../../engine/certificate-list/certificate-creator.service';
import { TrustedCertificateCreator } from '../../../engine/certificate-list/trusted-certificate-creator.service';
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
  private readonly presentedCertificateCreator = inject(CertificateCreator);
  private readonly trustedCertificateCreator = inject(TrustedCertificateCreator);
  private readonly controlContainer = inject(ControlContainer);

  readonly certificateAttribute = input.required<OIBusCertificateAttribute>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  /**
   * The certificates OIBus presents, with their private key, or the certificates it trusts, which have none, as the attribute
   * asks for
   */
  readonly offeredCertificates = computed(() => {
    const kind = this.certificateAttribute().trusted ? 'trusted' : 'key-pair';
    return this.certificates().filter(certificate => certificate.kind === kind);
  });
  /** Creates a certificate OIBus presents, or imports one it trusts */
  readonly certificateCreator = computed(() =>
    this.certificateAttribute().trusted ? this.trustedCertificateCreator : this.presentedCertificateCreator
  );
  /**
   * Prefixed by the groups nesting the control under the settings, when there are: nested settings can have the key of
   * another certificate (the OPC UA certificate and the certificate authenticating the user are both `certificateId`)
   */
  readonly inputId = computed(() => [...(this.controlContainer.path ?? []).slice(1), this.certificateAttribute().key].join('-'));
}
