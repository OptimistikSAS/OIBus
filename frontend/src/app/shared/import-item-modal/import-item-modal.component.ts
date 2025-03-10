import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { inject, OnInit } from '@angular/core';
import { formDirectives } from '../form-directives';

@Component({
  selector: 'oib-import-item-modal',
  templateUrl: './import-item-modal.component.html',
  styleUrl: './import-item-modal.component.scss',
  imports: [TranslateDirective, ...formDirectives]
})
export class ImportItemModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedDelimiter = 'COMMA';
  selectedFile: File = this.initializeFile;

  private fb = inject(NonNullableFormBuilder);
  importForm = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required]
  });

  ngOnInit(): void {
    const settings = {
      delimiter: 'COMMA' as CsvCharacter
    };
    this.importForm.patchValue(settings);
  }

  save() {
    if (!this.importForm.valid || this.selectedFile === this.initializeFile) {
      return;
    }
    const formValue = this.importForm.value;
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
  }

  onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    this.selectedFile = file;
    fileInput.value = '';
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
