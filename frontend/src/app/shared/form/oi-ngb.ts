import { Injectable, Provider } from '@angular/core';
import {
  NgbDateAdapter,
  NgbDateParserFormatter,
  NgbDatepickerConfig,
  NgbModalConfig,
  NgbTimeAdapter,
  NgbTimepickerConfig
} from '@ng-bootstrap/ng-bootstrap';
import { IsoDateAdapterService } from '../iso-date-adapter.service';
import { I18nDateParserFormatterService } from '../i18n-date-parser-formatter.service';
import { IsoTimeAdapterService } from '../iso-time-adapter.service';

@Injectable()
class OiNgbDatepickerConfig extends NgbDatepickerConfig {
  constructor() {
    super();
    this.minDate = { year: 2010, month: 1, day: 1 };
    this.maxDate = { year: new Date().getFullYear() + 2, month: 12, day: 31 };
  }
}

@Injectable()
class OiNgbTimepickerConfig extends NgbTimepickerConfig {
  constructor() {
    super();
    this.seconds = false;
    this.meridian = false;
    this.spinners = false;
  }
}

@Injectable()
class OiNgbModalConfig extends NgbModalConfig {
  constructor() {
    super();
    this.backdrop = 'static';
  }
}

export function provideNgbConfig(): Array<Provider> {
  return [
    { provide: NgbDateAdapter, useClass: IsoDateAdapterService },
    { provide: NgbDateParserFormatter, useClass: I18nDateParserFormatterService },
    { provide: NgbTimeAdapter, useClass: IsoTimeAdapterService },
    { provide: NgbDatepickerConfig, useClass: OiNgbDatepickerConfig },
    { provide: NgbTimepickerConfig, useClass: OiNgbTimepickerConfig },
    { provide: NgbModalConfig, useClass: OiNgbModalConfig }
  ];
}
