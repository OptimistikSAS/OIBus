import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JoiValidator from './joi.validator';
import { scanModeSchema } from './oibus-validation-schema';

interface DataProvider {
  dto: object;
  isValid: boolean;
  errorMessage: string | null;
}

const validCron = {
  name: 'valid',
  description: 'valid',
  type: 'cron',
  cron: '* * * * * *',
  interval: null,
  activationWindow: null
};

const validInterval = {
  name: 'valid',
  description: 'valid',
  type: 'interval',
  cron: '',
  interval: { value: 30, unit: 's' },
  activationWindow: null
};

const dataProviders: Array<DataProvider> = [
  {
    dto: { name1: 'missing', description1: 'missing', cron1: 'missing' },
    isValid: false,
    errorMessage:
      '"name" is required. "description" is required. "type" is required. "name1" is not allowed. "description1" is not allowed. "cron1" is not allowed'
  },
  {
    dto: { name: null, description: null, type: 'cron', cron: null },
    isValid: false,
    errorMessage: '"name" must be a string. "cron" must be a string'
  },
  {
    dto: { name: '', description: '', type: 'cron', cron: '' },
    isValid: false,
    errorMessage: '"name" is not allowed to be empty. "cron" is not allowed to be empty'
  },
  {
    dto: { ...validCron, description1: 'valid' },
    isValid: false,
    errorMessage: '"description1" is not allowed'
  },
  { dto: validCron, isValid: true, errorMessage: null },
  {
    dto: { ...validCron, cron: '* * * * * *L' },
    isValid: false,
    errorMessage: 'Cron Expression: Non-standard characters: L'
  },
  {
    dto: { ...validCron, type: 'unknown' },
    isValid: false,
    errorMessage: '"type" must be one of [cron, interval]'
  },
  // --- interval ---
  { dto: validInterval, isValid: true, errorMessage: null },
  {
    dto: { ...validInterval, interval: null },
    isValid: false,
    errorMessage: '"interval" must be of type object'
  },
  {
    dto: { ...validInterval, interval: { value: 30, unit: 'week' } },
    isValid: false,
    errorMessage: '"interval.unit" must be one of [ms, s, min, hour]'
  },
  {
    dto: { ...validInterval, interval: { value: 1.5, unit: 's' } },
    isValid: false,
    errorMessage: '"interval.value" must be an integer'
  },
  {
    dto: { ...validInterval, interval: { value: 5, unit: 'ms' } },
    isValid: false,
    errorMessage: '"interval" must be at least 10 ms (got 5 ms)'
  },
  { dto: { ...validInterval, interval: { value: 10, unit: 'ms' } }, isValid: true, errorMessage: null },
  {
    // Past 2^31-1 ms Node would wrap the delay back to 1 ms.
    dto: { ...validInterval, interval: { value: 1000, unit: 'hour' } },
    isValid: false,
    errorMessage: '"interval" must not exceed 2147483647 ms (got 3600000000 ms)'
  },
  // An interval scan mode does not need a cron, and any cron it carries is ignored.
  { dto: { ...validInterval, cron: 'nonsense' }, isValid: true, errorMessage: null },
  // --- activation window ---
  {
    dto: {
      ...validCron,
      activationWindow: { dateRange: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z' }, recurring: null }
    },
    isValid: true,
    errorMessage: null
  },
  {
    // Each bound is independently optional.
    dto: { ...validCron, activationWindow: { dateRange: { start: '2026-08-01T00:00:00.000Z' } } },
    isValid: true,
    errorMessage: null
  },
  {
    dto: { ...validCron, activationWindow: { dateRange: { start: 'not-a-date' } } },
    isValid: false,
    errorMessage: '"activationWindow.dateRange.start" must be in iso format'
  },
  {
    dto: {
      ...validCron,
      activationWindow: { recurring: { timezone: 'Europe/Paris', daysOfWeek: [6, 0], timeOfDay: { start: '22:00', end: '02:00' } } }
    },
    isValid: true,
    errorMessage: null
  },
  {
    dto: { ...validCron, activationWindow: { recurring: { timezone: 'Not/AZone' } } },
    isValid: false,
    errorMessage: '"Not/AZone" is not a valid IANA timezone'
  },
  {
    dto: { ...validCron, activationWindow: { recurring: { timezone: 'Europe/Paris', daysOfWeek: [7] } } },
    isValid: false,
    errorMessage: '"activationWindow.recurring.daysOfWeek[0]" must be less than or equal to 6'
  },
  {
    dto: {
      ...validCron,
      activationWindow: { recurring: { timezone: 'Europe/Paris', timeOfDay: { start: '25:00', end: '02:00' } } }
    },
    isValid: false,
    errorMessage: '"timeOfDay.start" must be a time of day in HH:mm format'
  }
];

describe('Scan mode validator', () => {
  const validator = new JoiValidator();

  for (const [index, dataProvider] of dataProviders.entries()) {
    it(`${index} Should be valid: ${dataProvider.isValid}`, async () => {
      if (dataProvider.isValid) {
        await assert.doesNotReject(validator.validate(scanModeSchema, dataProvider.dto));
      } else {
        await assert.rejects(validator.validate(scanModeSchema, dataProvider.dto), {
          message: dataProvider.errorMessage as string
        });
      }
    });
  }
});
