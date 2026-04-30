import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JoiValidator from './joi.validator';
import { ipFilterSchema } from './oibus-validation-schema';

interface DataProvider {
  dto: object;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: Array<DataProvider> = [
  {
    dto: {
      address1: 'missing',
      description1: 'missing'
    },
    isValid: false,
    errorMessage: '"address" is required. "description" is required. "address1" is not allowed. "description1" is not allowed'
  },
  {
    dto: {
      address: null,
      description: null
    },
    isValid: false,
    errorMessage: '"address" must be a string'
  },
  {
    dto: {
      address: '',
      description: ''
    },
    isValid: false,
    errorMessage: '"address" is not allowed to be empty'
  },
  {
    dto: {
      address: 'valid',
      description: 'valid',
      description1: 'invalid'
    },
    isValid: false,
    errorMessage: '"description1" is not allowed'
  },
  {
    dto: {
      address: 'valid',
      description: 'valid'
    },
    isValid: true,
    errorMessage: null
  }
];

describe('Ip filter validator', () => {
  const validator = new JoiValidator();

  for (const [index, dataProvider] of dataProviders.entries()) {
    it(`${index} Should be valid: ${dataProvider.isValid}`, async () => {
      if (dataProvider.isValid) {
        await assert.doesNotReject(validator.validate(ipFilterSchema, dataProvider.dto));
      } else {
        await assert.rejects(validator.validate(ipFilterSchema, dataProvider.dto), {
          message: dataProvider.errorMessage as string
        });
      }
    });
  }
});
