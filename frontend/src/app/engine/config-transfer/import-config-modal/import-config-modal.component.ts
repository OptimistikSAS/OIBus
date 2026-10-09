import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { catchError, EMPTY, Observable, Subject, switchMap } from 'rxjs';

import {
  ConfigImportEntityValidationError,
  ConfigImportPreviewDTO,
  ConfigImportResponseDTO
} from '@oibus/shared/oia/config-transfer.model';

import { ConfigImportFailure, ConfigTransferService } from '../../../services/config-transfer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { ConfigImportPreviewComponent } from '../config-import-preview/config-import-preview.component';

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

@Component({
  selector: 'oib-import-config-modal',
  templateUrl: './import-config-modal.component.html',
  styleUrl: './import-config-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, SaveButtonComponent, AsyncPipe, ConfigImportPreviewComponent]
})
export class ImportConfigModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly configTransferService = inject(ConfigTransferService);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly maxFileSizeMb = MAX_FILE_SIZE_MB;
  readonly state = new ObservableState();
  readonly previewState = new ObservableState();
  readonly preview = signal<ConfigImportPreviewDTO | null>(null);
  readonly error = signal<string | null>(null);
  readonly validationErrors = signal<Array<ConfigImportEntityValidationError>>([]);
  readonly fileError = signal<string | null>(null);
  readonly result = signal<ConfigImportResponseDTO | null>(null);

  readonly initializeFile = new File([''], 'Choose a file');
  readonly file = signal<File>(this.initializeFile);

  /** Only a file whose preview succeeded can be imported: the user must have seen what it contains. */
  readonly canImport = computed(() => this.file() !== this.initializeFile && this.preview() !== null);

  /** The files to preview: a newer selection cancels the preview of the previous one */
  private readonly filesToPreview = new Subject<File>();

  constructor() {
    this.filesToPreview
      .pipe(
        switchMap(file =>
          this.configTransferService.preview(file).pipe(
            this.previewState.pendingUntilFinalization(),
            catchError((err: ConfigImportFailure | string) => {
              this.showFailure(err);
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(preview => this.preview.set(preview));
  }

  onFileSelected(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      this.fileError.set('file-too-large');
      return;
    }
    this.fileError.set(null);
    this.file.set(file);
    this.loadPreview(file);
  }

  /**
   * Upgrades and validates the selected file on the backend without importing it, so every entity it
   * would write can be reviewed (and any validation error shown) before the import is confirmed.
   */
  private loadPreview(file: File) {
    this.preview.set(null);
    this.error.set(null);
    this.validationErrors.set([]);
    this.filesToPreview.next(file);
  }

  private showFailure(err: ConfigImportFailure | string) {
    if (err instanceof ConfigImportFailure) {
      this.error.set(err.message);
      this.validationErrors.set(err.validationErrors);
    } else {
      this.error.set(err);
    }
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
    if (!this.canImport()) {
      return;
    }

    this.error.set(null);
    this.validationErrors.set([]);
    this.confirmationService
      .confirm({
        messageKey: 'engine.config-transfer.import.confirm-message'
      })
      .pipe(switchMap(() => this.configTransferService.import(this.file()).pipe(this.state.pendingUntilFinalization())))
      .subscribe({
        next: (response: ConfigImportResponseDTO) => this.result.set(response),
        error: (err: ConfigImportFailure | string) => this.showFailure(err)
      });
  }

  close() {
    this.modal.close(this.result());
  }
}
