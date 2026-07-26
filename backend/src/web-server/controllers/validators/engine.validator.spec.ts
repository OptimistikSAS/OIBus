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
      general: { name: null },
      webServer: { port: null, authTokenDuration: null },
      proxyServer: {
        enabled: null,
        port: null,
        forward: { enabled: null, url: null, username: null, password: null },
        username: null,
        password: null
      },
      logger: null
    },
    isValid: false,
    errorMessage:
      '"general.name" must be a string. "webServer.port" must be a number. "webServer.authTokenDuration" must be one of [1h, 6h, 1d, 3d, 7d, 14d, 30d]. "webServer.authTokenDuration" must be a string. "proxyServer.enabled" must be a boolean. "proxyServer.forward.enabled" must be a boolean. "logger" must be of type object'
  },
  {
    dto: {
      general: { name: 'OIBus' },
      webServer: { port: 2223, authTokenDuration: '7d' },
      proxyServer: {
        enabled: false,
        port: 9000,
        forward: { enabled: false, url: null, username: null, password: null },
        username: null,
        password: null
      },
      logger: {
        console: null,
        file: null,
        database: null,
        loki: null,
        oia: null
      }
    },
    isValid: false,
    errorMessage:
      '"logger.console" must be of type object. "logger.file" must be of type object. "logger.database" must be of type object. "logger.loki" must be of type object. "logger.oia" must be of type object'
  },
  {
    dto: {
      general: { name: null },
      webServer: { port: null, authTokenDuration: null },
      proxyServer: {
        enabled: null,
        port: null,
        forward: { enabled: null, url: null, username: null, password: null },
        username: null,
        password: null
      },
      logger: {
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
      '"general.name" must be a string. "webServer.port" must be a number. "webServer.authTokenDuration" must be one of [1h, 6h, 1d, 3d, 7d, 14d, 30d]. "webServer.authTokenDuration" must be a string. "proxyServer.enabled" must be a boolean. "proxyServer.forward.enabled" must be a boolean. "logger.console.level" must be a string. "logger.file.level" must be a string. "logger.file.maxFileSize" must be a number. "logger.file.numberOfFiles" must be a number. "logger.database.level" must be a string. "logger.database.maxNumberOfLogs" must be a number. "logger.loki.level" must be a string. "logger.loki.interval" must be a number. "logger.oia.level" must be a string. "logger.oia.interval" must be a number'
  },
  {
    dto: {
      general: { name: '' },
      webServer: { port: '', authTokenDuration: '' },
      proxyServer: {
        enabled: '',
        port: '',
        forward: { enabled: '', url: '', username: '', password: '' },
        username: '',
        password: ''
      },
      logger: {
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
      '"general.name" is not allowed to be empty. "webServer.port" must be a number. "webServer.authTokenDuration" must be one of [1h, 6h, 1d, 3d, 7d, 14d, 30d]. "webServer.authTokenDuration" is not allowed to be empty. "proxyServer.enabled" must be a boolean. "proxyServer.port" must be a number. "proxyServer.forward.enabled" must be a boolean. "logger.console.level" is not allowed to be empty. "logger.file.level" is not allowed to be empty. "logger.file.maxFileSize" must be a number. "logger.file.numberOfFiles" must be a number. "logger.database.level" is not allowed to be empty. "logger.database.maxNumberOfLogs" must be a number. "logger.loki.level" is not allowed to be empty. "logger.loki.interval" must be a number. "logger.oia.level" is not allowed to be empty. "logger.oia.interval" must be a number'
  },
  {
    dto: {
      general: { name: 'OIBus' },
      webServer: { port: 2223, authTokenDuration: '7d' },
      proxyServer: {
        enabled: false,
        port: 9000,
        forward: { enabled: false, url: null, username: null, password: null },
        username: null,
        password: null
      },
      logger: {
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

  it('should accept valid port and auth token duration', async () => {
    await assert.doesNotReject(validator.validate(engineWebServerSchema, { port: 2223, authTokenDuration: '7d' }));
  });

  it('should reject null port', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: null, authTokenDuration: '7d' }), {
      message: '"port" must be a number'
    });
  });

  it('should reject invalid port number', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: 99999, authTokenDuration: '7d' }), {
      message: '"port" must be a valid port'
    });
  });

  it('should reject missing auth token duration', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: 2223 }), {
      message: '"authTokenDuration" is required'
    });
  });

  it('should reject an auth token duration outside the allowed set', async () => {
    await assert.rejects(validator.validate(engineWebServerSchema, { port: 2223, authTokenDuration: '5h' }), {
      message: '"authTokenDuration" must be one of [1h, 6h, 1d, 3d, 7d, 14d, 30d]'
    });
  });
});

describe('Engine proxy validator', () => {
  const validator: JoiValidator = new JoiValidator();

  const disabledForward = { enabled: false, url: null, username: null, password: null };

  it('should accept enabled false with null port', async () => {
    await assert.doesNotReject(validator.validate(engineProxySchema, { enabled: false, port: null, forward: disabledForward }));
  });

  it('should accept enabled true with valid port', async () => {
    await assert.doesNotReject(validator.validate(engineProxySchema, { enabled: true, port: 9000, forward: disabledForward }));
  });

  it('should reject null enabled', async () => {
    await assert.rejects(validator.validate(engineProxySchema, { enabled: null, port: null, forward: disabledForward }), {
      message: '"enabled" must be a boolean'
    });
  });

  it('should reject invalid port', async () => {
    await assert.rejects(validator.validate(engineProxySchema, { enabled: true, port: 99999, forward: disabledForward }), {
      message: '"port" must be a valid port'
    });
  });

  it('should accept missing forward when proxy is disabled', async () => {
    await assert.doesNotReject(validator.validate(engineProxySchema, { enabled: false, port: null }));
  });

  it('should accept forward enabled with a valid url', async () => {
    await assert.doesNotReject(
      validator.validate(engineProxySchema, {
        enabled: false,
        port: null,
        forward: { enabled: true, url: 'http://forward-proxy:3128', username: null, password: null }
      })
    );
  });

  it('should reject null forward enabled', async () => {
    await assert.rejects(
      validator.validate(engineProxySchema, { enabled: false, port: null, forward: { ...disabledForward, enabled: null } }),
      { message: '"forward.enabled" must be a boolean' }
    );
  });

  it('should reject an invalid forward url', async () => {
    await assert.rejects(
      validator.validate(engineProxySchema, { enabled: false, port: null, forward: { ...disabledForward, url: 'not-a-url' } }),
      { message: '"forward.url" must be a valid uri' }
    );
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
