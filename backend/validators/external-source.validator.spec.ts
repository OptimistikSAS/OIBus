import JoiValidator from './joi.validator';
import { externalSourceSchema } from '../engine/oibus-validation-schema';

interface DataProvider {
  dto: any;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: DataProvider[] = [
  {
    dto: {
      reference1: 'missing',
      description1: 'missing'
    },
    isValid: false,
    errorMessage: '"reference" is required. "description" is required. "reference1" is not allowed. "description1" is not allowed'
  },
  {
    dto: {
      reference: null,
      description: null
    },
    isValid: false,
    errorMessage: '"reference" must be a string'
  },
  {
    dto: {
      reference: '',
      description: ''
    },
    isValid: false,
    errorMessage: '"reference" is not allowed to be empty'
  },
  {
    dto: {
      reference: 'valid',
      description: 'valid',
      description1: 'invalid'
    },
    isValid: false,
    errorMessage: '"description1" is not allowed'
  },
  {
    dto: {
      reference: 'valid',
      description: 'valid'
    },
    isValid: true,
    errorMessage: null
  }
];

describe('External source validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it.each(dataProviders)(`$# Should be valid: $isValid`, async dataProvider => {
    if (dataProvider.isValid) {
      await expect(validator.validate(externalSourceSchema, dataProvider.dto)).resolves.not.toThrow();
    } else {
      await expect(validator.validate(externalSourceSchema, dataProvider.dto)).rejects.toThrowError(new Error(dataProvider.errorMessage as string));
    }
  });
});
