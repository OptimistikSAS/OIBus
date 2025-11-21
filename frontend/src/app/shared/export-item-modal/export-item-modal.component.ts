import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { ALL_CSV_CHARACTERS, CsvCharacter } from '../../../../../backend/shared/model/types';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { convertCsvDelimiter } from '../utils/csv.utils';
import { DateTime } from 'luxon';

@Component({
  selector: 'oib-export-item-modal',
  templateUrl: './export-item-modal.component.html',
  styleUrl: './export-item-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ExportItemModalComponent {
  private modal = inject(NgbActiveModal);

  readonly csvDelimiters = ALL_CSV_CHARACTERS;

  private fb = inject(NonNullableFormBuilder);
  form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    filename: ['' as string, Validators.required]
  });

  prepare(filename: string) {
    this.form.patchValue({ filename: `${filename}_${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv` });
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const formValue = this.form.value;
    this.modal.close({ delimiter: convertCsvDelimiter(formValue.delimiter!), filename: formValue.filename });
  }

  cancel() {
    this.modal.close();
  }
}
