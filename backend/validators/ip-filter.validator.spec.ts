import JoiValidator from './joi.validator';
import { ipFilterSchema } from '../engine/oibus-validation-schema';
import ValidatorInterface from './validator.interface';

interface DataProvider {
  dto: any;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: DataProvider[] = [
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
  const validator: ValidatorInterface = new JoiValidator(ipFilterSchema);

  it.each(dataProviders)(`$# Should be valid: $isValid`, async dataProvider => {
    if (dataProvider.isValid) {
      await expect(validator.validate(dataProvider.dto)).resolves.not.toThrow();
    } else {
      await expect(validator.validate(dataProvider.dto)).rejects.toThrowError(new Error(dataProvider.errorMessage as string));
    }
  });
});
