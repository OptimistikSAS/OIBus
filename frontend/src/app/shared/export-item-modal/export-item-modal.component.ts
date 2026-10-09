import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { DateTime } from 'luxon';

import { ALL_CSV_CHARACTERS, CsvCharacter } from '@oibus/shared/common/types';

import { convertCsvDelimiter } from '../utils/csv.utils';

@Component({
  selector: 'oib-export-item-modal',
  templateUrl: './export-item-modal.component.html',
  styleUrl: './export-item-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule]
})
export class ExportItemModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly csvDelimiters = ALL_CSV_CHARACTERS;

  readonly form = this.fb.group({
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
