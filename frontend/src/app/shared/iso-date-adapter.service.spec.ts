import { IsoDateAdapterService } from './iso-date-adapter.service';

describe('IsoDateAdapterService', () => {
  it('should transform string to NgbDateStruct', () => {
    const service = new IsoDateAdapterService();
    expect(service.fromModel('2017-01-01')).toEqual({ year: 2017, month: 1, day: 1 });
    expect(service.fromModel('2017-12-31')).toEqual({ year: 2017, month: 12, day: 31 });
    expect(service.fromModel('2017-12-1')).toBeNull();
    expect(service.fromModel('')).toBeNull();
    expect(service.fromModel(null)).toBeNull();
  });

  it('should transform NgbDateStruct to string', () => {
    const service = new IsoDateAdapterService();
    expect(service.toModel({ year: 2017, month: 1, day: 1 })).toBe('2017-01-01');
    expect(service.toModel({ year: 2017, month: 12, day: 31 })).toBe('2017-12-31');
    expect(service.toModel(null)).toBeNull();
  });
});
