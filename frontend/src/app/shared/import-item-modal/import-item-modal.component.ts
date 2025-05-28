import { Component, Input, inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CsvValidationError, validateCsvHeaders } from '../form/validators';

@Component({
  selector: 'oib-import-item-modal',
  templateUrl: './import-item-modal.component.html',
  styleUrl: './import-item-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ImportItemModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  @Input() expectedHeaders: Array<string> = [];
  @Input() optionalHeaders: Array<string> = [];

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedFile: File = this.initializeFile;
  validationError: CsvValidationError | null = null;

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
    return this.selectedFile !== this.initializeFile && !this.validationError && this.importForm.valid;
  }

  public async onFileSelected(file: File): Promise<void> {
    this.selectedFile = file;
    this.validationError = null;

    if (file !== this.initializeFile) {
      const delimiter = this.findCorrespondingDelimiter(this.importForm.get('delimiter')?.value as CsvCharacter);
      this.validationError = await validateCsvHeaders(file, delimiter, this.expectedHeaders, this.optionalHeaders);
    }
  }

  async onDelimiterChange(): Promise<void> {
    if (this.selectedFile !== this.initializeFile) {
      const delimiter = this.findCorrespondingDelimiter(this.importForm.get('delimiter')?.value as CsvCharacter);
      this.validationError = await validateCsvHeaders(this.selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders);
    }
  }

  save() {
    if (!this.canSave) {
      return;
    }

    const formValue = this.importForm.value;
    const selectedDelimiter = this.findCorrespondingDelimiter(formValue.delimiter!);

    this.modal.close({
      delimiter: selectedDelimiter,
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

  findCorrespondingDelimiter(delimiter: CsvCharacter) {
    switch (delimiter) {
      case 'DOT': {
        return '.';
      }
      case 'SEMI_COLON': {
        return ';';
      }
      case 'COLON': {
        return ':';
      }
      case 'COMMA': {
        return ',';
      }
      case 'SLASH': {
        return '/';
      }
      case 'TAB': {
        return '  ';
      }
      case 'NON_BREAKING_SPACE': {
        return ' ';
      }
      case 'PIPE': {
        return '|';
      }
    }
  }
}
