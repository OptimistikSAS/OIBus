import { Component, Input, inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { convertCsvDelimiter } from '../utils/csv-delimiter.util';

@Component({
  selector: 'oib-import-array-modal',
  templateUrl: './import-array-modal.component.html',
  styleUrl: './import-array-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ImportArrayModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  @Input() arrayKey!: string;

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedFile: File = this.initializeFile;
  validationError: string | null = null;
  validationErrors: Array<{ item: Record<string, string>; error: string }> = [];

  importForm = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required]
  });

  ngOnInit(): void {
    const settings = {
      delimiter: 'COMMA' as CsvCharacter
    };
    this.importForm.patchValue(settings);
  }

  get canSave(): boolean {
    return this.selectedFile !== this.initializeFile && !this.validationError && this.validationErrors.length === 0 && this.importForm.valid;
  }

  public async onFileSelected(file: File): Promise<void> {
    this.selectedFile = file;
    this.validationError = null;
    this.validationErrors = [];

    if (file !== this.initializeFile) {
      // Basic file validation - check if it's a CSV file
      if (!file.name.toLowerCase().endsWith('.csv')) {
        this.validationError = 'Please select a CSV file';
        return;
      }

      // Additional validation could be added here
      // For now, we'll do basic validation and let the backend handle the rest
    }
  }

  async onDelimiterChange(): Promise<void> {
    if (this.selectedFile !== this.initializeFile) {
      // Re-validate with new delimiter if needed
      this.validationError = null;
    }
  }

  save() {
    if (!this.canSave) {
      return;
    }

    const formValue = this.importForm.value;
    const selectedDelimiter = convertCsvDelimiter(formValue.delimiter!);

    this.modal.close({
      delimiter: selectedDelimiter,
      file: this.selectedFile
    });
  }

  cancel() {
    this.modal.close();
  }

  setValidationErrors(errors: Array<{ item: Record<string, string>; error: string }>) {
    this.validationErrors = errors;
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
