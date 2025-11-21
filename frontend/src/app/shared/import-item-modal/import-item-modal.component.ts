import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CsvValidationError, MqttTopicValidationError, validateCsvHeaders, validateCsvMqttTopics } from '../form/validators';
import { convertCsvDelimiter } from '../utils/csv.utils';

@Component({
  selector: 'oib-import-item-modal',
  templateUrl: './import-item-modal.component.html',
  styleUrl: './import-item-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ImportItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  expectedHeaders: Array<string> = [];
  optionalHeaders: Array<string> = [];
  existingMqttTopics: Array<string> = [];
  isMqttConnector = false;

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedFile: File = this.initializeFile;
  validationError: CsvValidationError | null = null;
  mqttValidationError: MqttTopicValidationError | null = null;

  form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required]
  });

  prepare(expectedHeaders: Array<string>, optionalHeaders: Array<string>, existingMqttTopics: Array<string>, isMqttConnector: boolean) {
    this.expectedHeaders = expectedHeaders;
    this.optionalHeaders = optionalHeaders;
    this.existingMqttTopics = existingMqttTopics;
    this.isMqttConnector = isMqttConnector;
  }

  get canSave(): boolean {
    return this.selectedFile !== this.initializeFile && !this.validationError && !this.mqttValidationError && this.form.valid;
  }

  public async onFileSelected(file: File): Promise<void> {
    this.selectedFile = file;
    this.validationError = null;
    this.mqttValidationError = null;

    if (file !== this.initializeFile) {
      const delimiter = convertCsvDelimiter(this.form.get('delimiter')?.value as CsvCharacter);

      this.validationError = await validateCsvHeaders(file, delimiter, this.expectedHeaders, this.optionalHeaders);

      if (!this.validationError && this.isMqttConnector) {
        this.mqttValidationError = await validateCsvMqttTopics(file, delimiter, this.existingMqttTopics);
      }
    }
  }

  async onDelimiterChange(): Promise<void> {
    if (this.selectedFile !== this.initializeFile) {
      const delimiter = convertCsvDelimiter(this.form.get('delimiter')?.value as CsvCharacter);

      this.validationError = await validateCsvHeaders(this.selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders);

      if (!this.validationError && this.isMqttConnector) {
        this.mqttValidationError = await validateCsvMqttTopics(this.selectedFile, delimiter, this.existingMqttTopics);
      } else {
        this.mqttValidationError = null;
      }
    }
  }

  save() {
    if (!this.canSave) {
      return;
    }

    const formValue = this.form.value;

    this.modal.close({
      delimiter: convertCsvDelimiter(formValue.delimiter!),
      file: this.selectedFile
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
