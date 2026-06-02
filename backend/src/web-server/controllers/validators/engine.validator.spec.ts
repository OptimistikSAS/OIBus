import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JoiValidator from './joi.validator';
import { engineLoggerSchema, engineNameSchema, engineProxySchema, engineSchema, engineWebServerSchema } from './oibus-validation-schema';

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
      '"name" must be a string. "port" must be a number. "proxyEnabled" must be a boolean. "logParameters" must be of type object'
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
      '"name" must be a string. "port" must be a number. "proxyEnabled" must be a boolean. "logParameters.console.level" must be a string. "logParameters.file.level" must be a string. "logParameters.file.maxFileSize" must be a number. "logParameters.file.numberOfFiles" must be a number. "logParameters.database.level" must be a string. "logParameters.database.maxNumberOfLogs" must be a number. "logParameters.loki.level" must be a string. "logParameters.loki.interval" must be a number. "logParameters.oia.level" must be a string. "logParameters.oia.interval" must be a number'
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

  for (const [index, dataProvider] of dataProviders.entries()) {
    it(`${index} Should be valid: ${dataProvider.isValid}`, async () => {
      if (dataProvider.isValid) {
        await assert.doesNotReject(validator.validate(engineSchema, dataProvider.dto));
      } else {
        await assert.rejects(validator.validate(engineSchema, dataProvider.dto), {
          message: dataProvider.errorMessage as string
        });
      }
    });
  }
});

describe('Engine name validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it('should accept valid name', async () => {
    await assert.doesNotReject(validator.validate(engineNameSchema, { name: 'OIBus' }));
  });

  it('should reject null name', async () => {
    await assert.rejects(validator.validate(engineNameSchema, { name: null }), {
      message: '"name" must be a string'
    });
  });

  it('should reject empty name', async () => {
    await assert.rejects(validator.validate(engineNameSchema, { name: '' }), {
      message: '"name" is not allowed to be empty'
    });
  });
});

describe('Engine web server validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it('should accept valid port', async () => {
    await assert.doesNotReject(validator.validate(engineWebServerSchema, { port: 2223 }));
  });

  it('should reject null port', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: null }), {
      message: '"port" must be a number'
    });
  });

  it('should reject invalid port number', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: 99999 }), {
      message: '"port" must be a valid port'
    });
  });
});

describe('Engine proxy validator', () => {
  const validator: JoiValidator = new JoiValidator();

  it('should accept proxyEnabled false with null proxyPort', async () => {
    await assert.doesNotReject(validator.validate(engineProxySchema, { proxyEnabled: false, proxyPort: null }));
  });

  it('should accept proxyEnabled true with valid proxyPort', async () => {
    await assert.doesNotReject(validator.validate(engineProxySchema, { proxyEnabled: true, proxyPort: 9000 }));
  });

  it('should reject null proxyEnabled', async () => {
    await assert.rejects(validator.validate(engineProxySchema, { proxyEnabled: null, proxyPort: null }), {
      message: '"proxyEnabled" must be a boolean'
    });
  });

  it('should reject invalid proxyPort', async () => {
    await assert.rejects(validator.validate(engineProxySchema, { proxyEnabled: true, proxyPort: 99999 }), {
      message: '"proxyPort" must be a valid port'
    });
  });
});

describe('Engine logger validator', () => {
  const validator: JoiValidator = new JoiValidator();

  const validLogParameters = {
    console: { level: 'silent' },
    file: { level: 'info', maxFileSize: 50, numberOfFiles: 5 },
    database: { level: 'info', maxNumberOfLogs: 100_000 },
    loki: { level: 'silent', interval: 60, address: '', username: '', password: '' },
    oia: { level: 'silent', interval: 10 }
  };

  it('should accept valid log parameters', async () => {
    await assert.doesNotReject(validator.validate(engineLoggerSchema, validLogParameters));
  });

  it('should reject null console', async () => {
    await assert.rejects(validator.validate(engineLoggerSchema, { ...validLogParameters, console: null }), {
      message: '"console" must be of type object'
    });
  });

  it('should reject empty log level', async () => {
    await assert.rejects(validator.validate(engineLoggerSchema, { ...validLogParameters, console: { level: '' } }), {
      message: '"console.level" is not allowed to be empty'
    });
  });

  it('should reject loki interval below minimum', async () => {
    await assert.rejects(
      validator.validate(engineLoggerSchema, { ...validLogParameters, loki: { ...validLogParameters.loki, interval: 5 } }),
      { message: '"loki.interval" must be greater than or equal to 10' }
    );
  });

  it('should reject file maxFileSize below minimum', async () => {
    await assert.rejects(
      validator.validate(engineLoggerSchema, { ...validLogParameters, file: { ...validLogParameters.file, maxFileSize: 0 } }),
      { message: '"file.maxFileSize" must be greater than or equal to 1' }
    );
  });

  it('should reject database maxNumberOfLogs below minimum', async () => {
    await assert.rejects(
      validator.validate(engineLoggerSchema, { ...validLogParameters, database: { level: 'info', maxNumberOfLogs: 1000 } }),
      { message: '"database.maxNumberOfLogs" must be greater than or equal to 100000' }
    );
  });
});
