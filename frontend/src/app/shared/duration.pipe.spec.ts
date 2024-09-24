import { DurationPipe } from './duration.pipe';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';

describe('DurationPipe', () => {
  let pipe: DurationPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    pipe = TestBed.runInInjectionContext(() => new DurationPipe());
  });

  it('should format a duration in long style by default', () => {
    expect(pipe.transform(30_000)).toBe('30 seconds');
    expect(pipe.transform(60_000)).toBe('1 minute');
    expect(pipe.transform(61_000)).toBe('1 minute, 1 second');
    expect(pipe.transform(62_000)).toBe('1 minute, 2 seconds');
    expect(pipe.transform(120_000)).toBe('2 minutes');
    expect(pipe.transform(3_600_000)).toBe('1 hour');
    expect(pipe.transform(3_660_000)).toBe('1 hour, 1 minute');
    expect(pipe.transform(3_661_000)).toBe('1 hour, 1 minute, 1 second');
    expect(pipe.transform(3_662_000)).toBe('1 hour, 1 minute, 2 seconds');
    expect(pipe.transform(3_720_000)).toBe('1 hour, 2 minutes');
    expect(pipe.transform(7_200_000)).toBe('2 hours');
    expect(pipe.transform(7_201_000)).toBe('2 hours, 1 second');
    expect(pipe.transform(7_260_000)).toBe('2 hours, 1 minute');
    expect(pipe.transform(7_320_000)).toBe('2 hours, 2 minutes');
  });

  it('should format a duration in short style', () => {
    expect(pipe.transform(30_000, 'short')).toBe('30 s');
    expect(pipe.transform(60_000, 'short')).toBe('1 min');
    expect(pipe.transform(61_000, 'short')).toBe('1 min, 1 s');
    expect(pipe.transform(62_000, 'short')).toBe('1 min, 2 s');
    expect(pipe.transform(120_000, 'short')).toBe('2 min');
    expect(pipe.transform(3_600_000, 'short')).toBe('1 h');
    expect(pipe.transform(3_660_000, 'short')).toBe('1 h, 1 min');
    expect(pipe.transform(3_661_000, 'short')).toBe('1 h, 1 min, 1 s');
    expect(pipe.transform(3_662_000, 'short')).toBe('1 h, 1 min, 2 s');
    expect(pipe.transform(3_720_000, 'short')).toBe('1 h, 2 min');
    expect(pipe.transform(7_200_000, 'short')).toBe('2 h');
    expect(pipe.transform(7_201_000, 'short')).toBe('2 h, 1 s');
    expect(pipe.transform(7_260_000, 'short')).toBe('2 h, 1 min');
    expect(pipe.transform(7_320_000, 'short')).toBe('2 h, 2 min');
  });

  it('should format a duration in short style and hourMinute type ', () => {
    expect(pipe.transform(0, 'short', 'hourMinute')).toBe('0 h, 0 min');
    expect(pipe.transform(30_000, 'short', 'hourMinute')).toBe('0 h, 0 min');
    expect(pipe.transform(60_000, 'short', 'hourMinute')).toBe('0 h, 1 min');
    expect(pipe.transform(61_000, 'short', 'hourMinute')).toBe('0 h, 1 min');
    expect(pipe.transform(62_000, 'short', 'hourMinute')).toBe('0 h, 1 min');
    expect(pipe.transform(120_000, 'short', 'hourMinute')).toBe('0 h, 2 min');
    expect(pipe.transform(3_600_000, 'short', 'hourMinute')).toBe('1 h, 0 min');
    expect(pipe.transform(3_660_000, 'short', 'hourMinute')).toBe('1 h, 1 min');
    expect(pipe.transform(3_661_000, 'short', 'hourMinute')).toBe('1 h, 1 min');
    expect(pipe.transform(3_662_000, 'short', 'hourMinute')).toBe('1 h, 1 min');
    expect(pipe.transform(3_720_000, 'short', 'hourMinute')).toBe('1 h, 2 min');
    expect(pipe.transform(7_200_000, 'short', 'hourMinute')).toBe('2 h, 0 min');
    expect(pipe.transform(7_201_000, 'short', 'hourMinute')).toBe('2 h, 0 min');
    expect(pipe.transform(7_260_000, 'short', 'hourMinute')).toBe('2 h, 1 min');
    expect(pipe.transform(7_320_000, 'short', 'hourMinute')).toBe('2 h, 2 min');
  });
});
