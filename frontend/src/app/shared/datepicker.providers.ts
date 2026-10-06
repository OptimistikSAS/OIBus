import { NgbDateAdapter, NgbDateParserFormatter, NgbTimeAdapter } from '@ng-bootstrap/ng-bootstrap';

import { I18nDateParserFormatterService } from './i18n-date-parser-formatter.service';
import { IsoDateAdapterService } from './iso-date-adapter.service';
import { IsoTimeAdapterService } from './iso-time-adapter.service';

/**
 * Custom services and components used to customize the NgbDatepicker.
 */
export function provideDatepicker() {
  return [
    { provide: NgbDateAdapter, useClass: IsoDateAdapterService },
    { provide: NgbTimeAdapter, useClass: IsoTimeAdapterService },
    { provide: NgbDateParserFormatter, useClass: I18nDateParserFormatterService }
  ];
}
