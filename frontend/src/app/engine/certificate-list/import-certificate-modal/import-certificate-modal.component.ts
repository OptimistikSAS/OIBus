import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { map, Observable } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { CertificateKind } from '@oibus/shared/domain/certificate.model';

import { CertificateService } from '../../../services/certificate.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

type FileField = 'certificateFile' | 'privateKeyFile' | 'certificateChainFile';

@Component({
  selector: 'oib-import-certificate-modal',
  templateUrl: './import-certificate-modal.component.html',
  styleUrl: './import-certificate-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent, NgbCollapse]
})
export class ImportCertificateModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly certificateService = inject(CertificateService);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly state = new ObservableState();
  readonly error = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly initializeFile = new File([''], 'Choose a file');
  readonly certificateFile = signal<File>(this.initializeFile);
  readonly privateKeyFile = signal<File>(this.initializeFile);
  readonly certificateChainFile = signal<File>(this.initializeFile);

  readonly form = this.fb.group({
    // A certificate OIBus presents, with its private key, or a certificate it trusts (certification authority, server)
    kind: this.fb.control<CertificateKind>('key-pair'),
    name: ['', Validators.required],
    description: '',
    privateKeyPassphrase: ''
  });
  private readonly formValid = toSignal(this.form.statusChanges.pipe(map(status => status === 'VALID')), {
    initialValue: this.form.valid
  });
  readonly kind = toSignal(this.form.controls.kind.valueChanges, { initialValue: this.form.controls.kind.value });

  readonly canSave = computed(
    () =>
      this.formValid() &&
      this.certificateFile() !== this.initializeFile &&
      (this.kind() === 'trusted' || this.privateKeyFile() !== this.initializeFile)
  );

  /** Imports a certificate OIBus trusts, from a select of trusted certificates */
  prepareForTrusted() {
    this.form.controls.kind.setValue('trusted');
  }

  onFileSelected(field: FileField, file: File) {
    if (file.size > MAX_FILE_SIZE) {
      this.fileError.set('file-too-large');
      return;
    }
    this.fileError.set(null);
    this[field].set(file);
  }

  onDragOver(e: Event) {
    e.preventDefault();
  }

  onDrop(field: FileField, e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      this.onFileSelected(field, file);
    }
  }

  onInputChange(field: FileField, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.onFileSelected(field, file);
    }
    input.value = '';
  }

  canDismiss(): Observable<boolean> | boolean {
    const hasFile =
      this.certificateFile() !== this.initializeFile ||
      this.privateKeyFile() !== this.initializeFile ||
      this.certificateChainFile() !== this.initializeFile;
    if (this.form.dirty || hasFile) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.canSave()) {
      return;
    }

    this.error.set(null);
    const formValue = this.form.value;
    const trusted = this.kind() === 'trusted';
    this.certificateService
      .importCertificate(
        {
          name: formValue.name!,
          description: formValue.description!,
          privateKeyPassphrase: !trusted && formValue.privateKeyPassphrase ? formValue.privateKeyPassphrase : null
        },
        {
          certificate: this.certificateFile(),
          privateKey: trusted ? null : this.privateKeyFile(),
          certificateChain: !trusted && this.certificateChainFile() !== this.initializeFile ? this.certificateChainFile() : null
        }
      )
      .pipe(this.state.pendingUntilFinalization())
      .subscribe({
        next: (certificate: CertificateDTO) => this.modal.close(certificate),
        error: (message: string) => this.error.set(message)
      });
  }
}
