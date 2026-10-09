import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { OIBusCertificateAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';

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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OibusCertificateFormControlComponent {
  readonly certificateAttribute = input.required<OIBusCertificateAttribute>();
  readonly certificates = input.required<Array<CertificateDTO>>();
}
