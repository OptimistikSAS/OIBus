import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CsvCharacterEnumPipe } from '../csv-character-enum.pipe';
import { CsvCharacter, ALL_CSV_CHARACTERS } from '../../../../../shared/model/types';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { inject, OnInit } from '@angular/core';
import { formDirectives } from '../../shared/form-directives';
import { DateTime } from 'luxon';

@Component({
  selector: 'oib-export-item-modal',
  templateUrl: './export-item-modal.component.html',
  styleUrl: './export-item-modal.component.scss',
  imports: [TranslateModule, ...formDirectives, CsvCharacterEnumPipe],
  standalone: true
})
export class ExportItemModalComponent implements OnInit {
  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  selectedDelimiter: string = 'COMMA';
  dateTime: string = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
  fileName: string = '';

  private fb = inject(NonNullableFormBuilder);
  exportForm = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    fileName: [this.fileName as string, Validators.required]
  });

  constructor(private modal: NgbActiveModal) {}

  ngOnInit(): void {
    const settings = {
      delimiter: 'COMMA' as CsvCharacter,
      fileName: this.fileName
    };
    this.exportForm.patchValue(settings);
  }

  prepare(connectorName: string | undefined) {
    if (typeof connectorName === 'string') {
      this.fileName = connectorName + '-item-' + this.dateTime;
    } else {
      this.fileName = 'south-item-' + this.dateTime;
    }
  }

  save() {
    if (!this.exportForm.valid) {
      return;
    }
    const formValue = this.exportForm.value;
    this.fileName = formValue.fileName!;
    this.selectedDelimiter = this.findCorrespondingDelimiter(formValue.delimiter!);
    this.modal.close({ delimiter: this.selectedDelimiter, fileName: this.fileName });
  }

  cancel() {
    this.modal.close();
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
