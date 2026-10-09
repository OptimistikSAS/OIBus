import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { ALL_CSV_CHARACTERS, CsvCharacter } from '@oibus/shared/common/types';

import { CsvValidationError, MqttTopicValidationError, validateCsvHeaders, validateCsvMqttTopics } from '../form/validators';
import { convertCsvDelimiter } from '../utils/csv.utils';

@Component({
  selector: 'oib-import-item-modal',
  templateUrl: './import-item-modal.component.html',
  styleUrl: './import-item-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ImportItemModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);

  private expectedHeaders: Array<string> = [];
  private optionalHeaders: Array<string> = [];
  private existingMqttTopics: Array<string> = [];
  private isMqttConnector = false;
  readonly showEraseOption = signal(false);

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  private readonly initializeFile = new File([''], 'Choose a file');
  readonly selectedFile = signal<File>(this.initializeFile);
  readonly validationError = signal<CsvValidationError | null>(null);
  readonly mqttValidationError = signal<MqttTopicValidationError | null>(null);

  readonly form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    eraseExisting: [false]
  });
  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  prepare(
    expectedHeaders: Array<string>,
    optionalHeaders: Array<string>,
    existingMqttTopics: Array<string>,
    isMqttConnector: boolean,
    showEraseOption = false
  ) {
    this.expectedHeaders = expectedHeaders;
    this.optionalHeaders = optionalHeaders;
    this.existingMqttTopics = existingMqttTopics;
    this.isMqttConnector = isMqttConnector;
    this.showEraseOption.set(showEraseOption);
  }

  readonly canSave = computed(
    () =>
      this.selectedFile() !== this.initializeFile && !this.validationError() && !this.mqttValidationError() && this.formStatus() === 'VALID'
  );

  public async onFileSelected(file: File): Promise<void> {
    this.selectedFile.set(file);
    this.validationError.set(null);
    this.mqttValidationError.set(null);

    if (file !== this.initializeFile) {
      const delimiter = convertCsvDelimiter(this.form.get('delimiter')?.value as CsvCharacter);

      this.validationError.set(await validateCsvHeaders(file, delimiter, this.expectedHeaders, this.optionalHeaders));

      if (!this.validationError() && this.isMqttConnector) {
        this.mqttValidationError.set(await validateCsvMqttTopics(file, delimiter, this.existingMqttTopics));
      }
    }
  }

  async onDelimiterChange(): Promise<void> {
    const selectedFile = this.selectedFile();
    if (selectedFile !== this.initializeFile) {
      const delimiter = convertCsvDelimiter(this.form.get('delimiter')?.value as CsvCharacter);

      this.validationError.set(await validateCsvHeaders(selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders));

      if (!this.validationError() && this.isMqttConnector) {
        this.mqttValidationError.set(await validateCsvMqttTopics(selectedFile, delimiter, this.existingMqttTopics));
      } else {
        this.mqttValidationError.set(null);
      }
    }
  }

  save() {
    if (!this.canSave()) {
      return;
    }

    const formValue = this.form.value;

    this.modal.close({
      delimiter: convertCsvDelimiter(formValue.delimiter!),
      file: this.selectedFile(),
      eraseExisting: formValue.eraseExisting ?? false
    });
  }

  cancel() {
    this.modal.close();
  }

  onImportDragOver(e: Event) {
    e.preventDefault();
  }

  async onImportDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer!.files![0];
    if (file) {
      await this.onFileSelected(file);
    }
  }

  async onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    if (file) {
      await this.onFileSelected(file);
      fileInput.value = '';
    }
  }
}
