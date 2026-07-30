import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { concat, Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import {
  ALL_CERTIFICATE_EXPORT_FORMATS,
  CertificateDTO,
  CertificateExportFormat
} from '../../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../../services/certificate.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

interface PassphraseFormValue {
  passphrase: string;
  passphraseConfirmation: string;
}

function samePassphraseValidator(passphraseForm: AbstractControl): ValidationErrors | null {
  const value: PassphraseFormValue = passphraseForm.value;
  return value.passphrase && value.passphraseConfirmation && value.passphrase !== value.passphraseConfirmation
    ? { samePassphrase: true }
    : null;
}

@Component({
  selector: 'oib-export-certificate-modal',
  templateUrl: './export-certificate-modal.component.html',
  styleUrl: './export-certificate-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent, NgbCollapse]
})
export class ExportCertificateModalComponent {
  private modal = inject(NgbActiveModal);
  private certificateService = inject(CertificateService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  certificate: CertificateDTO | null = null;
  readonly formats = ALL_CERTIFICATE_EXPORT_FORMATS;
  state = new ObservableState();
  error = signal(false);

  form = inject(NonNullableFormBuilder).group({
    format: ['PEM' as CertificateExportFormat, Validators.required],
    includeChain: false,
    includePrivateKey: false,
    passphraseForm: inject(NonNullableFormBuilder).group(
      {
        passphrase: ['', [Validators.required, Validators.minLength(8)]],
        passphraseConfirmation: ['', Validators.required]
      },
      { validators: samePassphraseValidator }
    )
  });

  constructor() {
    this.form.controls.passphraseForm.disable();

    this.form.controls.includePrivateKey.valueChanges.subscribe(includePrivateKey => {
      if (includePrivateKey) {
        this.form.controls.passphraseForm.enable();
      } else {
        this.form.controls.passphraseForm.disable();
      }
    });

    this.form.controls.format.valueChanges.subscribe(format => {
      if (format === 'DER') {
        this.form.controls.includeChain.setValue(false);
        this.form.controls.includeChain.disable();
      } else {
        this.form.controls.includeChain.enable();
      }
    });
  }

  prepare(certificate: CertificateDTO) {
    this.certificate = certificate;
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  private sanitise(name: string) {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid || !this.certificate) {
      return;
    }

    this.error.set(false);
    const formValue = this.form.getRawValue();
    const format = formValue.format;
    const sanitisedName = this.sanitise(this.certificate.name);
    const certificateFilename = `${sanitisedName}.${format === 'DER' ? 'cer' : 'pem'}`;

    const exports = [this.certificateService.exportCertificate(this.certificate.id, format, formValue.includeChain, certificateFilename)];

    if (formValue.includePrivateKey) {
      const keyFilename = `${sanitisedName}-private-key.pem`;
      exports.push(this.certificateService.exportPrivateKey(this.certificate.id, formValue.passphraseForm.passphrase, keyFilename));
    }

    concat(...exports)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe({
        complete: () => this.modal.close(),
        error: () => this.error.set(true)
      });
  }
}
