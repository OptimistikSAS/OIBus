import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JoiValidator from './joi.validator';
import { scanModeSchema } from './oibus-validation-schema';

interface DataProvider {
  dto: object;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: Array<DataProvider> = [
  {
    dto: {
      name1: 'missing',
      description1: 'missing',
      cron1: 'missing'
    },
    isValid: false,
    errorMessage:
      '"name" is required. "description" is required. "cron" is required. "name1" is not allowed. "description1" is not allowed. "cron1" is not allowed'
  },
  {
    dto: {
      name: null,
      description: null,
      cron: null
    },
    isValid: false,
    errorMessage: '"name" must be a string. "cron" must be a string'
  },
  {
    dto: {
      name: '',
      description: '',
      cron: ''
    },
    isValid: false,
    errorMessage: '"name" is not allowed to be empty. "cron" is not allowed to be empty'
  },
  {
    dto: {
      name: 'valid',
      description: 'valid',
      description1: 'valid',
      cron: '* * * * * *'
    },
    isValid: false,
    errorMessage: '"description1" is not allowed'
  },
  {
    dto: {
      name: 'valid',
      description: 'valid',
      cron: '* * * * * *'
    },
    isValid: true,
    errorMessage: null
  },
  {
    dto: {
      name: 'valid',
      description: 'valid',
      cron: '* * * * * *L'
    },
    isValid: false,
    errorMessage: 'Cron Expression: Non-standard characters: L'
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
