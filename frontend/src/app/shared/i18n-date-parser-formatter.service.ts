import { Injectable } from '@angular/core';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';

@Injectable()
export class I18nDateParserFormatterService extends NgbDateParserFormatter {
  private parsePattern = 'yyyy-M-d';
  private formatPattern = 'yyyy-MM-dd';

  constructor(translateService: TranslateService) {
    super();
    translateService.get('datepicker.parse-pattern').subscribe(pattern => (this.parsePattern = pattern));
    translateService.get('datepicker.format-pattern').subscribe(pattern => (this.formatPattern = pattern));
  }

  parse(value: string): NgbDateStruct | null {
    if (value) {
      const date = DateTime.fromFormat(value, this.parsePattern, { zone: 'utc' });
      if (!date.isValid) {
        return null;
      }
      return {
        year: date.year,
        month: date.month,
        day: date.day
      };
    }
    return null;
  }

  format(date: NgbDateStruct): string {
    return date ? DateTime.utc(date.year, date.month, date.day).toFormat(this.formatPattern) : '';
  }
}
