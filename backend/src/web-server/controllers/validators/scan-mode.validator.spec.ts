import JoiValidator from './joi.validator';
import { scanModeSchema } from '../../../engine/oibus-validation-schema';

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
    errorMessage: 'Expression contains non-standard characters: L'
  }
];

describe('Scan mode validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it.each(dataProviders)(`$# Should be valid: $isValid`, async dataProvider => {
    if (dataProvider.isValid) {
      await expect(validator.validate(scanModeSchema, dataProvider.dto)).resolves.not.toThrow();
    } else {
      await expect(validator.validate(scanModeSchema, dataProvider.dto)).rejects.toThrow(new Error(dataProvider.errorMessage as string));
    }
  });
});
