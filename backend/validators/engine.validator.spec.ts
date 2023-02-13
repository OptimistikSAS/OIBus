import JoiValidator from './joi.validator';
import { engineSchema } from '../engine/oibus-validation-schema';

interface DataProvider {
  dto: any;
  isValid: boolean;
  errorMessage: string | null;
}

const dataProviders: DataProvider[] = [
  {
    dto: {
      name: null,
      port: null,
      logParameters: null,
      healthSignal: null
    },
    isValid: false,
    errorMessage:
      '"name" must be a string. "port" must be a number. "logParameters" must be of type object. "healthSignal" must be of type object'
  },
  {
    dto: {
      name: 'OIBus',
      port: 2223,
      logParameters: {
        console: null,
        file: null,
        database: null,
        loki: null
      },
      healthSignal: {
        logging: null,
        http: null
      }
    },
    isValid: false,
    errorMessage:
      '"logParameters.console" must be of type object. "logParameters.file" must be of type object. "logParameters.database" must be of type object. "logParameters.loki" must be of type object. "healthSignal.logging" must be of type object. "healthSignal.http" must be of type object'
  },
  {
    dto: {
      name: null,
      port: null,
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
          tokenAddress: null,
          username: null,
          password: null,
          proxyId: null
        }
      },
      healthSignal: {
        logging: {
          enabled: null,
          interval: null
        },
        http: {
          enabled: null,
          interval: null,
          verbose: null,
          address: null,
          proxyId: null,
          authentication: {
            type: null,
            key: null,
            secret: null
          }
        }
      }
    },
    isValid: false,
    errorMessage:
      '"name" must be a string. "port" must be a number. "logParameters.console.level" must be a string. "logParameters.file.level" must be a string. "logParameters.file.maxFileSize" must be a number. "logParameters.file.numberOfFiles" must be a number. "logParameters.database.level" must be a string. "logParameters.database.maxNumberOfLogs" must be a number. "logParameters.loki.level" must be a string. "logParameters.loki.interval" must be a number. "logParameters.loki.address" must be a string. "logParameters.loki.tokenAddress" must be a string. "logParameters.loki.username" must be a string. "logParameters.loki.password" must be a string. "healthSignal.logging.enabled" must be a boolean. "healthSignal.logging.interval" must be a number. "healthSignal.http.enabled" must be a boolean. "healthSignal.http.interval" must be a number. "healthSignal.http.verbose" must be a boolean. "healthSignal.http.address" must be a string. "healthSignal.http.authentication.type" must be a string. "healthSignal.http.authentication.key" must be a string. "healthSignal.http.authentication.secret" must be a string'
  },
  {
    dto: {
      name: '',
      port: '',
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: ''
        }
      },
      healthSignal: {
        logging: {
          enabled: '',
          interval: ''
        },
        http: {
          enabled: '',
          interval: '',
          verbose: '',
          address: '',
          proxyId: '',
          authentication: {
            type: '',
            key: '',
            secret: ''
          }
        }
      }
    },
    isValid: false,
    errorMessage:
      '"name" is not allowed to be empty. "port" must be a number. "logParameters.console.level" is not allowed to be empty. "logParameters.file.level" is not allowed to be empty. "logParameters.file.maxFileSize" must be a number. "logParameters.file.numberOfFiles" must be a number. "logParameters.database.level" is not allowed to be empty. "logParameters.database.maxNumberOfLogs" must be a number. "logParameters.loki.level" is not allowed to be empty. "logParameters.loki.interval" must be a number. "healthSignal.logging.enabled" must be a boolean. "healthSignal.logging.interval" must be a number. "healthSignal.http.enabled" must be a boolean. "healthSignal.http.interval" must be a number. "healthSignal.http.verbose" must be a boolean. "healthSignal.http.authentication.type" is not allowed to be empty'
  },
  {
    dto: {
      name: 'OIBus',
      port: 2223,
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: null
        }
      },
      healthSignal: {
        logging: {
          enabled: true,
          interval: 60
        },
        http: {
          enabled: false,
          interval: 60,
          verbose: false,
          address: '',
          proxyId: null,
          authentication: {
            type: 'basic',
            key: '',
            secret: ''
          }
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
      await expect(validator.validate(engineSchema, dataProvider.dto)).rejects.toThrowError(new Error(dataProvider.errorMessage as string));
    }
  });
});
