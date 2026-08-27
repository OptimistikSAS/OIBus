import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { ConfigImportEntityValidationError, ConfigImportResponseDTO } from '../../../../../../backend/shared/model/config-transfer.model';
import { ConfigImportFailure, ConfigTransferService } from '../../../services/config-transfer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

@Component({
  selector: 'oib-import-config-modal',
  templateUrl: './import-config-modal.component.html',
  styleUrl: './import-config-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, SaveButtonComponent]
})
export class ImportConfigModalComponent {
  private modal = inject(NgbActiveModal);
  private configTransferService = inject(ConfigTransferService);
  private confirmationService = inject(ConfirmationService);

  state = new ObservableState();
  error = signal<string | null>(null);
  validationErrors = signal<Array<ConfigImportEntityValidationError>>([]);
  fileError = signal<string | null>(null);
  result = signal<ConfigImportResponseDTO | null>(null);

  readonly initializeFile = new File([''], 'Choose a file');
  file: File = this.initializeFile;

  get canImport(): boolean {
    return this.file !== this.initializeFile;
  }

  onFileSelected(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      this.fileError.set('file-too-large');
      return;
    }
    this.fileError.set(null);
    this.file = file;
  }

  onDragOver(e: Event) {
    e.preventDefault();
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      this.onFileSelected(file);
    }
  }

  onInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.onFileSelected(file);
    }
    input.value = '';
  }

  canDismiss(): Observable<boolean> | boolean {
    // Always allowed to dismiss (e.g. via Escape or the backdrop), including after the import has
    // completed — the caller (EngineDetailComponent) checks `result()` itself when a dismissal goes
    // through and reloads just as it would for the explicit "Close and reload" button, so this only
    // ever needs to say whether dismissing is permitted at all, not whether it should reload.
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  import() {
    if (!this.canImport) {
      return;
    }

    this.error.set(null);
    this.validationErrors.set([]);
    this.confirmationService
      .confirm({
        messageKey: 'engine.config-transfer.import.confirm-message'
      })
      .pipe(switchMap(() => this.configTransferService.import(this.file).pipe(this.state.pendingUntilFinalization())))
      .subscribe({
        next: (response: ConfigImportResponseDTO) => this.result.set(response),
        error: (err: ConfigImportFailure | string) => {
          if (err instanceof ConfigImportFailure) {
            this.error.set(err.message);
            this.validationErrors.set(err.validationErrors);
          } else {
            this.error.set(err);
          }
        }
      });
  }

  close() {
    this.modal.close(this.result());
  }
}
