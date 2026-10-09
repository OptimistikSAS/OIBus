import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable, switchMap } from 'rxjs';

import { CertificateCommandDTO, CertificateDTO } from '@oibus/shared/api/certificate.model';

import { CertificateService } from '../../../services/certificate.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-certificate-modal',
  templateUrl: './edit-certificate-modal.component.html',
  styleUrl: './edit-certificate-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditCertificateModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly certificateService = inject(CertificateService);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly state = new ObservableState();
  private certificate: CertificateDTO | null = null;
  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    regenerateCertificate: true,
    certificateOptions: this.fb.group({
      commonName: ['', Validators.required],
      countryName: ['', Validators.required],
      stateOrProvinceName: ['', Validators.required],
      localityName: ['', Validators.required],
      organizationName: ['', Validators.required],
      keySize: [4096, Validators.required],
      daysBeforeExpiry: [3650, Validators.required]
    })
  });

  /** Whether the certificate is (re)generated, as a signal for the template (the form is also patched by `prepareForEdition()`) */
  readonly regenerateCertificate = toSignal(this.form.controls.regenerateCertificate.valueChanges, {
    initialValue: this.form.controls.regenerateCertificate.value
  });

  constructor() {
    this.form.controls.regenerateCertificate.valueChanges.pipe(takeUntilDestroyed()).subscribe(next => {
      if (next) {
        this.form.controls.certificateOptions.enable();
      } else {
        this.form.controls.certificateOptions.disable();
      }
    });
  }

  prepareForCreation() {
    this.mode.set('create');
  }

  prepareForEdition(certificate: CertificateDTO) {
    this.mode.set('edit');
    this.certificate = certificate;

    this.form.patchValue({
      name: certificate.name,
      description: certificate.description,
      regenerateCertificate: false
    });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    const command: CertificateCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      regenerateCertificate: formValue.regenerateCertificate!,
      options:
        formValue.certificateOptions == null
          ? null
          : {
              commonName: formValue.certificateOptions.commonName!,
              countryName: formValue.certificateOptions.countryName!,
              stateOrProvinceName: formValue.certificateOptions.stateOrProvinceName!,
              localityName: formValue.certificateOptions.localityName!,
              organizationName: formValue.certificateOptions.organizationName!,
              keySize: formValue.certificateOptions.keySize!,
              daysBeforeExpiry: formValue.certificateOptions.daysBeforeExpiry!
            }
    };

    let obs: Observable<CertificateDTO>;
    if (this.mode() === 'create') {
      obs = this.certificateService.create(command);
    } else {
      obs = this.certificateService
        .update(this.certificate!.id, command)
        .pipe(switchMap(() => this.certificateService.findById(this.certificate!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(certificate => {
      this.modal.close(certificate);
    });
  }
}
