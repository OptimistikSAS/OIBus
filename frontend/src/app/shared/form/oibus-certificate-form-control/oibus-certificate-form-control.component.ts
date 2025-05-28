import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusCertificateAttribute } from '../../../../../../backend/shared/model/form.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';

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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class OibusCertificateFormControlComponent {
  certificateAttribute = input.required<OIBusCertificateAttribute>();
  certificates = input.required<Array<CertificateDTO>>();
}
