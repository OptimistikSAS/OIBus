import { Component, inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { convertCsvDelimiter } from '../utils/csv-delimiter.util';

@Component({
  selector: 'oib-export-array-modal',
  templateUrl: './export-array-modal.component.html',
  styleUrl: './export-array-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ExportArrayModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  selectedDelimiter = 'COMMA';
  dateTime: string = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
  fileName = '';

  private fb = inject(NonNullableFormBuilder);
  exportForm = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    fileName: [this.fileName as string, Validators.required]
  });

  ngOnInit(): void {
    const settings = {
      delimiter: 'COMMA' as CsvCharacter,
      fileName: this.fileName
    };
    this.exportForm.patchValue(settings);
  }

  prepare(arrayKey: string | undefined) {
    if (arrayKey) {
      this.fileName = `${arrayKey}-export-${this.dateTime}`;
    } else {
      this.fileName = 'array-export-' + this.dateTime;
    }
  }

  save() {
    if (!this.exportForm.valid) {
      return;
    }
    const formValue = this.exportForm.value;
    this.fileName = formValue.fileName!;
    this.selectedDelimiter = convertCsvDelimiter(formValue.delimiter!);
    this.modal.close({ delimiter: this.selectedDelimiter, fileName: this.fileName });
  }

  cancel() {
    this.modal.close();
  }
}
