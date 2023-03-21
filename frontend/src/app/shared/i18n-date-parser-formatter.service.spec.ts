import { TestBed } from '@angular/core/testing';

import { I18nDateParserFormatterService } from './i18n-date-parser-formatter.service';
import { NgbDateAdapter, NgbDateParserFormatter, NgbTimeAdapter } from '@ng-bootstrap/ng-bootstrap';
import { MockI18nModule } from '../../i18n/mock-i18n.spec';
import { IsoDateAdapterService } from './iso-date-adapter.service';
import { IsoTimeAdapterService } from './iso-time-adapter.service';

describe('I18nDateParserFormatterService', () => {
  let service: NgbDateParserFormatter;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule],
      providers: [
        { provide: NgbDateAdapter, useClass: IsoDateAdapterService },
        { provide: NgbDateParserFormatter, useClass: I18nDateParserFormatterService },
        { provide: NgbTimeAdapter, useClass: IsoTimeAdapterService }
      ]
    });

    service = TestBed.inject(NgbDateParserFormatter);
  });

  it('should be properly provided', () => {
    expect(service instanceof I18nDateParserFormatterService).toBe(true);
  });

  it('should format', () => {
    expect(service.format(null)).toBe('');
    expect(
      service.format({
        year: 2018,
        month: 2,
        day: 14
      })
    ).toBe('14/02/2018');
  });

  it('should parse', () => {
    expect(service.parse('')).toBeNull();
    expect(service.parse('2018/02/14')).toBeNull();
    expect(service.parse('18-02-14')).toBeNull();
    expect(service.parse('abcd-ef-gh')).toBeNull();
    expect(service.parse('29/02/2018')).toBeNull();
    expect(service.parse('14/02/2018')).toEqual({
      year: 2018,
      month: 2,
      day: 14
    });
    expect(service.parse('4/2/2018')).toEqual({
      year: 2018,
      month: 2,
      day: 4
    });
  });
});
