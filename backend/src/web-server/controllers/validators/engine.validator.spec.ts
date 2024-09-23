import JoiValidator from './joi.validator';
import { engineSchema } from './oibus-validation-schema';

interface DataProvider {
  dto: object;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: Array<DataProvider> = [
  {
    dto: {
      name: null,
      port: null,
      proxyEnabled: null,
      proxyPort: null,
      logParameters: null
    },
    isValid: false,
    errorMessage:
      '"name" must be a string. "port" must be a number. "proxyEnabled" must be a boolean. "proxyPort" must be a number. "logParameters" must be of type object'
  },
  {
    dto: {
      name: 'OIBus',
      port: 2223,
      proxyEnabled: false,
      proxyPort: 9000,
      logParameters: {
        console: null,
        file: null,
        database: null,
        loki: null,
        oia: null
      }
    },
    isValid: false,
    errorMessage:
      '"logParameters.console" must be of type object. "logParameters.file" must be of type object. "logParameters.database" must be of type object. "logParameters.loki" must be of type object. "logParameters.oia" must be of type object'
  },
  {
    dto: {
      name: null,
      port: null,
      proxyEnabled: null,
      proxyPort: null,
      logParameters: {
        console: {
          level: null
        },
        file: {
          level: null,
          maxFileSize: null,
          numberOfFiles: null
        },
        database: {
          level: null,
          maxNumberOfLogs: null
        },
        loki: {
          level: null,
          interval: null,
          address: null,
          username: null,
          password: null
        },
        oia: {
          level: null,
          interval: null
        }
      }
    },
    isValid: false,
    errorMessage:
      '"name" must be a string. "port" must be a number. "proxyEnabled" must be a boolean. "proxyPort" must be a number. "logParameters.console.level" must be a string. "logParameters.file.level" must be a string. "logParameters.file.maxFileSize" must be a number. "logParameters.file.numberOfFiles" must be a number. "logParameters.database.level" must be a string. "logParameters.database.maxNumberOfLogs" must be a number. "logParameters.loki.level" must be a string. "logParameters.loki.interval" must be a number. "logParameters.oia.level" must be a string. "logParameters.oia.interval" must be a number'
  },
  {
    dto: {
      name: '',
      port: '',
      proxyEnabled: '',
      proxyPort: '',
      logParameters: {
        console: {
          level: ''
        },
        file: {
          level: '',
          maxFileSize: '',
          numberOfFiles: ''
        },
        database: {
          level: '',
          maxNumberOfLogs: ''
        },
        loki: {
          level: '',
          interval: '',
          address: '',
          username: '',
          password: ''
        },
        oia: {
          level: '',
          interval: ''
        }
      }
    },
    isValid: false,
    errorMessage:
      '"name" is not allowed to be empty. "port" must be a number. "proxyEnabled" must be a boolean. "proxyPort" must be a number. "logParameters.console.level" is not allowed to be empty. "logParameters.file.level" is not allowed to be empty. "logParameters.file.maxFileSize" must be a number. "logParameters.file.numberOfFiles" must be a number. "logParameters.database.level" is not allowed to be empty. "logParameters.database.maxNumberOfLogs" must be a number. "logParameters.loki.level" is not allowed to be empty. "logParameters.loki.interval" must be a number. "logParameters.oia.level" is not allowed to be empty. "logParameters.oia.interval" must be a number'
  },
  {
    dto: {
      name: 'OIBus',
      port: 2223,
      proxyEnabled: false,
      proxyPort: 9000,
      logParameters: {
        console: {
          level: 'silent'
        },
        file: {
          level: 'info',
          maxFileSize: 50,
          numberOfFiles: 5
        },
        database: {
          level: 'info',
          maxNumberOfLogs: 100_000
        },
        loki: {
          level: 'silent',
          interval: 60,
          address: '',
          username: '',
          password: ''
        },
        oia: {
          level: 'silent',
          interval: 60
        }
      }
    },
    isValid: true,
    errorMessage: null
  }
];

describe('Engine validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it.each(dataProviders)(`$# Should be valid: $isValid`, async dataProvider => {
    if (dataProvider.isValid) {
      await expect(validator.validate(engineSchema, dataProvider.dto)).resolves.not.toThrow();
    } else {
      await expect(validator.validate(engineSchema, dataProvider.dto)).rejects.toThrow(new Error(dataProvider.errorMessage as string));
    }
  });
});
