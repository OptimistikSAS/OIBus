import { Component, Input } from '@angular/core'; // Add Input
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { inject, OnInit } from '@angular/core';
import { formDirectives } from '../form-directives';
import { simpleHeaderValidator, CsvValidationError } from '../../shared/validators'; // Add these imports

@Component({
  selector: 'oib-import-item-modal',
  templateUrl: './import-item-modal.component.html',
  styleUrl: './import-item-modal.component.scss',
  imports: [TranslateDirective, ...formDirectives]
})
export class ImportItemModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);

  @Input() expectedHeaders: Array<string> = [];

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedDelimiter = 'COMMA';
  selectedFile: File = this.initializeFile;

  private fb = inject(NonNullableFormBuilder);
  importForm = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    file: [this.initializeFile]
  });

  ngOnInit(): void {
    const settings = {
      delimiter: 'COMMA' as CsvCharacter,
      file: this.initializeFile
    };
    this.importForm.patchValue(settings);
  }

  private updateFileValidator(): void {
    if (this.expectedHeaders.length > 0 && this.selectedFile !== this.initializeFile) {
      const delimiter = this.findCorrespondingDelimiter(this.importForm.get('delimiter')?.value as CsvCharacter);
      this.importForm.get('file')?.setAsyncValidators([simpleHeaderValidator(this.expectedHeaders, delimiter)]);
      this.importForm.get('file')?.updateValueAndValidity();
    }
  }

  onDelimiterChange(): void {
    this.updateFileValidator();
  }

  save() {
    if (!this.importForm.valid || this.selectedFile === this.initializeFile) {
      return;
    }

    const formValue = this.importForm.value;
    const fileControl = this.importForm.get('file');

    if (fileControl?.errors?.['csvFormatError']) {
      const validationError: CsvValidationError = fileControl.errors['csvFormatError'];
      this.modal.close({
        validationError,
        delimiter: this.findCorrespondingDelimiter(formValue.delimiter!),
        file: this.selectedFile
      });
      return;
    }

    this.selectedDelimiter = this.findCorrespondingDelimiter(formValue.delimiter!);
    this.modal.close({ delimiter: this.selectedDelimiter, file: this.selectedFile });
  }

  cancel() {
    this.modal.close();
  }

  onImportDragOver(e: Event) {
    e.preventDefault();
  }

  onImportDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer!.files![0];
    this.selectedFile = file;
    this.importForm.get('file')?.setValue(file);
    this.updateFileValidator();
  }

  onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    this.selectedFile = file;
    this.importForm.get('file')?.setValue(file);
    this.updateFileValidator();
    fileInput.value = '';
  }

  get hasValidationError(): boolean {
    const fileControl = this.importForm.get('file');
    return !!(fileControl?.errors?.['csvFormatError'] && fileControl?.touched);
  }

  get validationError(): CsvValidationError | null {
    const fileControl = this.importForm.get('file');
    return fileControl?.errors?.['csvFormatError'] || null;
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
