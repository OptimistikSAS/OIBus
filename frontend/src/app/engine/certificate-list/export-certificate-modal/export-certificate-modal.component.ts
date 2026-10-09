import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { concat, Observable } from 'rxjs';

import { ALL_CERTIFICATE_EXPORT_FORMATS, CertificateDTO, CertificateExportFormat } from '@oibus/shared/api/certificate.model';

import { CertificateService } from '../../../services/certificate.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent, NgbCollapse]
})
export class ExportCertificateModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly certificateService = inject(CertificateService);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly certificate = signal<CertificateDTO | null>(null);
  readonly formats = ALL_CERTIFICATE_EXPORT_FORMATS;
  readonly state = new ObservableState();
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    format: ['PEM' as CertificateExportFormat, Validators.required],
    includeChain: false,
    includePrivateKey: false,
    passphraseForm: this.fb.group(
      {
        passphrase: ['', [Validators.required, Validators.minLength(8)]],
        passphraseConfirmation: ['', Validators.required]
      },
      { validators: samePassphraseValidator }
    )
  });

  constructor() {
    this.form.controls.passphraseForm.disable();

    this.form.controls.includePrivateKey.valueChanges.pipe(takeUntilDestroyed()).subscribe(includePrivateKey => {
      if (includePrivateKey) {
        this.form.controls.passphraseForm.enable();
      } else {
        this.form.controls.passphraseForm.disable();
      }
    });

    this.form.controls.format.valueChanges.pipe(takeUntilDestroyed()).subscribe(format => {
      if (format === 'DER') {
        this.form.controls.includeChain.setValue(false);
        this.form.controls.includeChain.disable();
      } else {
        this.form.controls.includeChain.enable();
      }
    });
  }

  prepare(certificate: CertificateDTO) {
    this.certificate.set(certificate);
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
    const certificate = this.certificate();
    if (!this.form.valid || !certificate) {
      return;
    }

    this.error.set(null);
    const formValue = this.form.getRawValue();
    const format = formValue.format;
    const sanitisedName = this.sanitise(certificate.name);
    const certificateFilename = `${sanitisedName}.${format === 'DER' ? 'cer' : 'pem'}`;

    const exports = [this.certificateService.exportCertificate(certificate.id, format, formValue.includeChain, certificateFilename)];

    if (formValue.includePrivateKey) {
      const keyFilename = `${sanitisedName}-private-key.pem`;
      exports.push(this.certificateService.exportPrivateKey(certificate.id, formValue.passphraseForm.passphrase, keyFilename));
    }

    concat(...exports)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe({
        complete: () => this.modal.close(),
        error: (message: string) => this.error.set(message)
      });
  }
}
