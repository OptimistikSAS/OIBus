import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../../services/certificate.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

type FileField = 'certificateFile' | 'privateKeyFile' | 'certificateChainFile';

@Component({
  selector: 'oib-import-certificate-modal',
  templateUrl: './import-certificate-modal.component.html',
  styleUrl: './import-certificate-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent, NgbCollapse]
})
export class ImportCertificateModalComponent {
  private modal = inject(NgbActiveModal);
  private certificateService = inject(CertificateService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  state = new ObservableState();
  error = signal(false);
  fileError = signal<string | null>(null);

  readonly initializeFile = new File([''], 'Choose a file');
  certificateFile: File = this.initializeFile;
  privateKeyFile: File = this.initializeFile;
  certificateChainFile: File = this.initializeFile;

  form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    description: '',
    privateKeyPassphrase: ''
  });

  get canSave(): boolean {
    return this.form.valid && this.certificateFile !== this.initializeFile && this.privateKeyFile !== this.initializeFile;
  }

  onFileSelected(field: FileField, file: File) {
    if (file.size > MAX_FILE_SIZE) {
      this.fileError.set('file-too-large');
      return;
    }
    this.fileError.set(null);
    this[field] = file;
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
      this.certificateFile !== this.initializeFile ||
      this.privateKeyFile !== this.initializeFile ||
      this.certificateChainFile !== this.initializeFile;
    if (this.form.dirty || hasFile) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.canSave) {
      return;
    }

    const formValue = this.form.value;
    this.certificateService
      .importCertificate(
        {
          name: formValue.name!,
          description: formValue.description!,
          privateKeyPassphrase: formValue.privateKeyPassphrase ? formValue.privateKeyPassphrase : null
        },
        {
          certificate: this.certificateFile,
          privateKey: this.privateKeyFile,
          certificateChain: this.certificateChainFile !== this.initializeFile ? this.certificateChainFile : null
        }
      )
      .pipe(this.state.pendingUntilFinalization())
      .subscribe({
        next: (certificate: CertificateDTO) => this.modal.close(certificate),
        error: () => this.error.set(true)
      });
  }
}
