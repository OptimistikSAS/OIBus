import JoiValidator from './joi.validator';
import { proxySchema } from '../engine/oibus-validation-schema';

interface DataProvider {
  dto: any;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: DataProvider[] = [
  {
    dto: {
      name1: 'missing',
      description1: 'missing',
      address1: 'missing',
      username1: 'missing',
      password1: 'missing'
    },
    isValid: false,
    errorMessage:
      '"name" is required. "description" is required. "address" is required. "username" is required. "password" is required. "name1" is not allowed. "description1" is not allowed. "address1" is not allowed. "username1" is not allowed. "password1" is not allowed'
  },
  {
    dto: {
      name: null,
      description: null,
      address: null,
      username: null,
      password: null
    },
    isValid: false,
    errorMessage: '"name" must be a string. "address" must be a string'
  },
  {
    dto: {
      name: '',
      description: '',
      address: '',
      username: '',
      password: ''
    },
    isValid: false,
    errorMessage: '"name" is not allowed to be empty. "address" is not allowed to be empty'
  },
  {
    dto: {
      name: 'valid',
      description: 'valid',
      description1: 'valid',
      address: 'valid',
      username: 'valid',
      password: 'valid'
    },
    isValid: false,
    errorMessage: '"description1" is not allowed'
  },
  {
    dto: {
      name: 'valid',
      description: 'valid',
      address: 'valid',
      username: 'valid',
      password: 'valid'
    },
    isValid: true,
    errorMessage: null
  }
];

describe('Proxy validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it.each(dataProviders)(`$# Should be valid: $isValid`, async dataProvider => {
    if (dataProvider.isValid) {
      await expect(validator.validate(proxySchema, dataProvider.dto)).resolves.not.toThrow();
    } else {
      await expect(validator.validate(proxySchema, dataProvider.dto)).rejects.toThrowError(new Error(dataProvider.errorMessage as string));
    }
  });
});
