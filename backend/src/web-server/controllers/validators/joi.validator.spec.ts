import Joi from 'joi';
import JoiValidator from './joi.validator';
import {
  OIBusArrayAttribute,
  OIBusBooleanAttribute,
  OIBusCertificateAttribute,
  OIBusCodeAttribute,
  OIBusNumberAttribute,
  OIBusObjectAttribute,
  OIBusScanModeAttribute,
  OIBusSecretAttribute,
  OIBusStringAttribute,
  OIBusStringSelectAttribute,
  OIBusTimezoneAttribute
} from '../../../../shared/model/form.model';

const validator = new JoiValidator();

class JoiValidatorExtend extends JoiValidator {
  generateJoiSchema(settings: OIBusObjectAttribute): Joi.ObjectSchema {
    return super.generateJoiSchema(settings);
  }
}

const extendedValidator = new JoiValidatorExtend();

describe('Joi validator', () => {
  it('validate should throw exception on invalid schema', async () => {
    const schema = Joi.object({});
    const dto = {};
    const validateAsyncSpy = jest.spyOn(schema, 'validateAsync').mockImplementationOnce(() => {
      throw new Error();
    });

    await expect(validator.validate(schema, dto)).rejects.toThrow(new Error());
    expect(validateAsyncSpy).toHaveBeenCalledWith(dto, { abortEarly: false });
  });

  it('validate should not throw exception on valid schema', async () => {
    const schema = Joi.object({});
    const dto = {};
    const validateAsyncSpy = jest.spyOn(schema, 'validateAsync');

    await expect(validator.validate(schema, dto)).resolves.not.toThrow();
    expect(validateAsyncSpy).toHaveBeenCalledWith(dto, { abortEarly: false });
  });

  it('validateSettings should properly call validate', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'objectSettings',
      translationKey: '',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    };
    const dto = {};
    const schema = Joi.object({});
    validator.validate = jest.fn();
    jest.spyOn(validator, 'generateFormGroupJoiSchema').mockReturnValueOnce({ objectSettings: schema });

    await validator.validateSettings(settings, dto);

    expect(validator.validate).toHaveBeenCalledWith(schema, dto);
  });

  it('generateJoiSchema should generate proper Joi schema for different form controls', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          key: 'text',
          type: 'string',
          translationKey: 'OibText'
        } as OIBusStringAttribute,
        {
          key: 'number',
          type: 'number',
          translationKey: 'OibNumber'
        } as OIBusNumberAttribute,
        {
          key: 'select',
          type: 'string-select',
          selectableValues: ['GET', 'POST', 'PUT', 'PATCH'],
          translationKey: 'OibSelect'
        } as OIBusStringSelectAttribute,
        {
          key: 'secret',
          type: 'secret',
          translationKey: 'OibSecret'
        } as OIBusSecretAttribute,
        {
          key: 'block',
          type: 'code',
          contentType: 'json',
          translationKey: 'OibCodeBlock'
        } as OIBusCodeAttribute,
        {
          key: 'checkbox',
          type: 'boolean',
          translationKey: 'OibCheckbox'
        } as OIBusBooleanAttribute,
        {
          key: 'timezone',
          type: 'timezone',
          translationKey: 'OibTimezone'
        } as OIBusTimezoneAttribute,
        {
          key: 'scanMode',
          type: 'scan-mode',
          translationKey: 'OibScanMode',
          acceptableType: 'SUBSCRIPTION_AND_POLL'
        } as OIBusScanModeAttribute,
        {
          key: 'certificate',
          type: 'certificate',
          translationKey: 'OibCertificate'
        } as OIBusCertificateAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        text: Joi.string().allow(null, ''),
        number: Joi.number().allow(null),
        select: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH'),
        secret: Joi.string().allow(null, ''),
        block: Joi.string().allow(null, ''),
        checkbox: Joi.boolean().falsy(0).truthy(1),
        timezone: Joi.string().allow(null, ''),
        scanMode: Joi.string().allow(null, ''),
        certificate: Joi.string().allow(null, '')
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate text Joi schema', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          key: 'host',
          type: 'string',
          translationKey: 'Host',
          validators: [
            { type: 'REQUIRED', arguments: [] },
            { type: 'PATTERN', arguments: ['^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*'] }
          ]
        } as OIBusStringAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        host: Joi.string().required().pattern(new RegExp('^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*'))
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate number Joi schema', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          key: 'port',
          type: 'number',
          translationKey: 'Port',
          defaultValue: 1883,
          validators: [{ type: 'REQUIRED' }, { type: 'MINIMUM', arguments: ['1'] }, { type: 'MAXIMUM', arguments: ['65535'] }]
        } as OIBusNumberAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        port: Joi.number().required().min(1).max(65535)
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate select Joi schema', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          key: 'requestMethod',
          type: 'string-select',
          selectableValues: ['GET', 'POST', 'PUT', 'PATCH'],
          translationKey: 'HTTP Method',
          defaultValue: 'POST',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: {
            row: 0,
            columns: 1,
            displayInViewMode: true
          }
        } as OIBusStringSelectAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        requestMethod: Joi.string().required().valid('GET', 'POST', 'PUT', 'PATCH')
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate boolean Joi schema', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          key: 'verbose',
          type: 'boolean',
          translationKey: 'Verbose',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          defaultValue: false,
          displayProperties: {
            row: 0,
            columns: 1,
            displayInViewMode: true
          }
        } as OIBusBooleanAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        verbose: Joi.boolean().required().falsy(0).truthy(1)
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly handle conditional display', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'objectSettings',
      translationKey: '',
      attributes: [
        {
          key: 'driver',
          type: 'string-select',
          translationKey: 'SQL Driver',
          selectableValues: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'],
          validators: [{ type: 'REQUIRED', arguments: [] }],
          defaultValue: '',
          displayProperties: {
            row: 0,
            columns: 1,
            displayInViewMode: true
          }
        } as OIBusStringSelectAttribute,
        {
          key: 'databasePath',
          type: 'string',
          translationKey: 'Database path',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: {
            row: 0,
            columns: 2,
            displayInViewMode: true
          },
          defaultValue: ''
        } as OIBusStringAttribute,
        {
          key: 'query',
          type: 'string',
          translationKey: 'Query'
        } as OIBusStringAttribute
      ],
      enablingConditions: [{ referralPathFromRoot: 'driver', targetPathFromRoot: 'databasePath', values: ['SQLite'] }],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      objectSettings: Joi.object({
        driver: Joi.string().required().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'),
        databasePath: Joi.string()
          .required()
          .when('driver', {
            is: Joi.any().valid('SQLite'),
            then: Joi.string().required(),
            otherwise: Joi.string().allow('').optional()
          }),
        query: Joi.string().allow(null, '')
      })
    });
    expect(generatedSchema.describe()).toEqual(expectedSchema.describe());
  });

  it('generateJoiSchema should generate proper Joi schema for form Groups', async () => {
    const settings: OIBusObjectAttribute = {
      key: 'authentication',
      type: 'object',
      translationKey: 'Authentication',
      validators: [{ type: 'REQUIRED', arguments: [] }],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: false },
      attributes: [
        {
          key: 'type',
          type: 'string-select',
          translationKey: 'Type',
          selectableValues: ['none', 'basic', 'bearer', 'api-key'],
          validators: [{ type: 'REQUIRED', arguments: [] }],
          defaultValue: '',
          displayProperties: {
            row: 0,
            columns: 1,
            displayInViewMode: true
          }
        } as OIBusStringSelectAttribute,
        {
          key: 'username',
          type: 'string',
          translationKey: 'Username',
          defaultValue: ''
        } as OIBusStringAttribute,
        {
          key: 'password',
          type: 'secret',
          translationKey: 'Password'
        } as OIBusSecretAttribute,
        {
          key: 'token',
          type: 'secret',
          translationKey: 'Token'
        } as OIBusSecretAttribute,
        {
          key: 'apiKeyHeader',
          type: 'secret',
          translationKey: 'Api key header'
        } as OIBusSecretAttribute,
        {
          key: 'apiKey',
          type: 'secret',
          translationKey: 'Api key'
        } as OIBusSecretAttribute
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      authentication: Joi.object({
        type: Joi.string().valid('none', 'basic', 'bearer', 'api-key').required(),
        username: Joi.string().allow(null, ''),
        password: Joi.string().allow(null, ''),
        token: Joi.string().allow(null, ''),
        apiKeyHeader: Joi.string().allow(null, ''),
        apiKey: Joi.string().allow(null, '')
      }).required()
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should generate proper Joi schema for form Groups without validators', async () => {
    const settings: OIBusObjectAttribute = {
      key: 'authentication',
      type: 'object',
      translationKey: 'Authentication',
      validators: [],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: false },
      attributes: [
        {
          key: 'type',
          type: 'string-select',
          translationKey: 'Type',
          selectableValues: ['none', 'basic', 'bearer', 'api-key'],
          validators: [],
          defaultValue: '',
          displayProperties: {
            row: 0,
            columns: 1,
            displayInViewMode: true
          }
        } as OIBusStringSelectAttribute,
        {
          key: 'username',
          type: 'string',
          translationKey: 'Username'
        } as OIBusStringAttribute,
        {
          key: 'password',
          type: 'secret',
          translationKey: 'Password'
        } as OIBusSecretAttribute,
        {
          key: 'token',
          type: 'secret',
          translationKey: 'Token'
        } as OIBusSecretAttribute,
        {
          key: 'apiKeyHeader',
          type: 'secret',
          translationKey: 'Api key header'
        } as OIBusSecretAttribute,
        {
          key: 'apiKey',
          type: 'secret',
          translationKey: 'Api key'
        } as OIBusSecretAttribute
      ]
    } as OIBusObjectAttribute;
    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      authentication: Joi.object({
        type: Joi.string().valid('none', 'basic', 'bearer', 'api-key'),
        username: Joi.string().allow(null, ''),
        password: Joi.string().allow(null, ''),
        token: Joi.string().allow(null, ''),
        apiKeyHeader: Joi.string().allow(null, ''),
        apiKey: Joi.string().allow(null, '')
      })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should generate proper Joi schema for form Array', async () => {
    const settings: OIBusObjectAttribute = {
      type: 'object',
      key: 'settings',
      translationKey: 'configuration.oibus.manifest.south.items.settings',
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'array',
          key: 'dateTimeFields',
          translationKey: 'Date time fields',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.south.items.item',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [
              {
                referralPathFromRoot: 'type',
                targetPathFromRoot: 'timezone',
                values: ['string']
              },
              {
                referralPathFromRoot: 'type',
                targetPathFromRoot: 'locale',
                values: ['string']
              },
              {
                referralPathFromRoot: 'type',
                targetPathFromRoot: 'format',
                values: ['string']
              }
            ],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'fieldName',
                translationKey: 'date-time-fields.field-name',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  },
                  {
                    type: 'UNIQUE',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'boolean',
                key: 'useAsReference',
                translationKey: 'date-time-fields.use-as-reference',
                defaultValue: false,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  },
                  {
                    type: 'SINGLE_TRUE',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string-select',
                key: 'type',
                translationKey: 'date-time-fields.type',
                defaultValue: 'string',
                selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 4,
                  displayInViewMode: false
                }
              },
              {
                type: 'timezone',
                key: 'timezone',
                translationKey: 'date-time-fields.timezone',
                defaultValue: 'UTC',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: false
                }
              },
              {
                type: 'string',
                key: 'format',
                translationKey: 'date-time-fields.format',
                defaultValue: 'yyyy-MM-dd HH:mm:ss',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: false
                }
              },
              {
                type: 'string',
                key: 'locale',
                translationKey: 'date-time-fields.locale',
                defaultValue: 'en-En',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              }
            ]
          }
        }
      ]
    };

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      settings: Joi.object({
        dateTimeFields: Joi.array()
          .required()
          .items(
            Joi.object({
              fieldName: Joi.string().required(),
              useAsReference: Joi.boolean().required().falsy(0).truthy(1),
              type: Joi.string().required().valid('iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'),
              timezone: Joi.string()
                .required()
                .when('type', {
                  is: Joi.any().valid('string'),
                  then: Joi.string().required(),
                  otherwise: Joi.string().allow('').optional()
                }),
              format: Joi.string()
                .required()
                .when('type', {
                  is: Joi.any().valid('string'),
                  then: Joi.string().required(),
                  otherwise: Joi.string().allow('').optional()
                }),
              locale: Joi.string()
                .required()
                .when('type', {
                  is: Joi.any().valid('string'),
                  then: Joi.string().required(),
                  otherwise: Joi.string().allow('').optional()
                })
            })
          )
          .unique('fieldName')
          .custom(() => null, 'SINGLE_TRUE validation for useAsReference')
      })
    });
    expect(JSON.stringify(generatedSchema.describe())).toEqual(JSON.stringify(expectedSchema.describe()));
  });

  it('generateSingleTrueValidator should manage single true fields', async () => {
    const helpers = { message: jest.fn().mockReturnValueOnce('error') } as unknown as Joi.CustomHelpers;
    const test = extendedValidator['generateSingleTrueValidator']('singleTrueField');
    expect(test([{ singleTrueField: true }, { singleTrueField: true }, { singleTrueField: true }], helpers)).toEqual('error');
    expect(helpers.message).toHaveBeenCalledWith({ custom: `Only one item in the array can have "singleTrueField" set to true` });

    expect(test([{ singleTrueField: true }, { singleTrueField: false }, { singleTrueField: false }], helpers)).toEqual([
      { singleTrueField: true },
      { singleTrueField: false },
      { singleTrueField: false }
    ]);

    expect(test({ singleTrueField: true }, helpers)).toEqual({ singleTrueField: true });
  });

  it('applyArrayLevelValidators should return schema if no validators', async () => {
    const schema = Joi.array();
    expect(extendedValidator['applyArrayLevelValidators'](schema)).toEqual(schema);
  });

  describe('MQTT Topic Validation', () => {
    describe('isMqttItemsArray', () => {
      it('should return true when array contains topic field', () => {
        const mqttArrayControl: OIBusArrayAttribute = {
          key: 'items',
          type: 'array',
          translationKey: 'Items',
          paginate: false,
          numberOfElementPerPage: 50,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.south.items.item',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'topic',
                translationKey: 'mqtt.topic',
                defaultValue: '',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              }
            ]
          }
        };

        const result = (validator as unknown as { isMqttItemsArray: (formControl: OIBusArrayAttribute) => boolean }).isMqttItemsArray(
          mqttArrayControl
        );
        expect(result).toBe(true);
      });

      it('should return false when array does not contain topic field', () => {
        const mqttArrayControl: OIBusArrayAttribute = {
          key: 'items',
          type: 'array',
          translationKey: 'Items',
          paginate: false,
          numberOfElementPerPage: 50,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.south.items.item',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'name',
                translationKey: 'mqtt.name',
                defaultValue: '',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              }
            ]
          }
        };

        const result = (validator as unknown as { isMqttItemsArray: (formControl: OIBusArrayAttribute) => boolean }).isMqttItemsArray(
          mqttArrayControl
        );
        expect(result).toBe(false);
      });
    });

    describe('doMqttTopicsOverlap', () => {
      it('should return true for identical topics', () => {
        const result = (validator as unknown as { doMqttTopicsOverlap: (topic1: string, topic2: string) => boolean }).doMqttTopicsOverlap(
          '/oibus/counter',
          '/oibus/counter'
        );
        expect(result).toBe(true);
      });

      it('should return true when topic1 matches topic2 pattern', () => {
        const result = (validator as unknown as { doMqttTopicsOverlap: (topic1: string, topic2: string) => boolean }).doMqttTopicsOverlap(
          '/oibus/counter',
          '/oibus/#'
        );
        expect(result).toBe(true);
      });

      it('should return true when topic2 matches topic1 pattern', () => {
        const result = (validator as unknown as { doMqttTopicsOverlap: (topic1: string, topic2: string) => boolean }).doMqttTopicsOverlap(
          '/oibus/#',
          '/oibus/counter'
        );
        expect(result).toBe(true);
      });

      it('should return false for non-overlapping topics', () => {
        const result = (validator as unknown as { doMqttTopicsOverlap: (topic1: string, topic2: string) => boolean }).doMqttTopicsOverlap(
          '/oibus/counter',
          '/other/topic'
        );
        expect(result).toBe(false);
      });
    });

    describe('mqttTopicMatches', () => {
      describe('exact matches', () => {
        it('should match identical topics', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/counter'
          );
          expect(result).toBe(true);
        });

        it('should not match different topics', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/other'
          );
          expect(result).toBe(false);
        });
      });

      describe('single-level wildcard (+)', () => {
        it('should match single level wildcard', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/+'
          );
          expect(result).toBe(true);
        });

        it('should match multiple single level wildcards', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter/value',
            '/oibus/+/+'
          );
          expect(result).toBe(true);
        });

        it('should not match if level count differs', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/+/value'
          );
          expect(result).toBe(false);
        });

        it('should match empty level with + (implementation behavior)', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus//value',
            '/oibus/+/value'
          );
          expect(result).toBe(true);
        });
      });

      describe('multi-level wildcard (#)', () => {
        it('should match everything after # wildcard', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter/value',
            '/oibus/#'
          );
          expect(result).toBe(true);
        });

        it('should not match exact prefix with # when topic is shorter', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus',
            '/oibus/#'
          );
          expect(result).toBe(false);
        });

        it('should match root level with #', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/#'
          );
          expect(result).toBe(true);
        });

        it('should match everything with just #', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter/value',
            '#'
          );
          expect(result).toBe(true);
        });

        it('should not match if prefix does not match', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/other/counter',
            '/oibus/#'
          );
          expect(result).toBe(false);
        });

        it('should not match if topic is shorter than prefix', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oib',
            '/oibus/#'
          );
          expect(result).toBe(false);
        });
      });

      describe('combined wildcards', () => {
        it('should handle combined + and # wildcards based on implementation', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter/value/123',
            '/oibus/+/#'
          );
          expect(result).toBe(false);
        });

        it('should not match if single level part does not match', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter/value',
            '/other/+/#'
          );
          expect(result).toBe(false);
        });
      });

      describe('additional pattern matching', () => {
        it('should not match when # is not at the end of pattern', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/#/something'
          );
          expect(result).toBe(false);
        });

        it('should not match when # is not preceded by / and not at beginning', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus#'
          );
          expect(result).toBe(false);
        });

        it('should match when # is at beginning of pattern', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'oibus/counter',
            '#'
          );
          expect(result).toBe(true);
        });

        it('should match exact topic and pattern without wildcards - final return', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'level1/level2/level3',
            'level1/level2/level3'
          );
          expect(result).toBe(true);
        });

        it('should match topic with + wildcards in all positions - final return', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'level1/level2/level3',
            '+/+/+'
          );
          expect(result).toBe(true);
        });

        it('should handle pattern with # followed by non-empty character', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter',
            '/oibus/#extra'
          );
          expect(result).toBe(false);
        });

        it('should not match when topic is shorter than required parts before #', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'a',
            'a#/b/#'
          );
          expect(result).toBe(false);
        });

        it('should not match when parts before # do not match', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'a#/different/extra',
            'a#/b/#'
          );
          expect(result).toBe(false);
        });

        it('should match when parts before # match correctly', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'a#/b/extra/parts',
            'a#/b/#'
          );
          expect(result).toBe(true);
        });

        it('should match with + wildcard before # in split pattern', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'a#/anything/extra',
            'a#/+/#'
          );
          expect(result).toBe(true);
        });
      });

      describe('edge cases', () => {
        it('should handle empty topics', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '',
            ''
          );
          expect(result).toBe(true);
        });

        it('should handle topics with special characters', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            '/oibus/counter-1_test',
            '/oibus/+'
          );
          expect(result).toBe(true);
        });

        it('should handle topics starting without slash', () => {
          const result = (validator as unknown as { mqttTopicMatches: (topic: string, pattern: string) => boolean }).mqttTopicMatches(
            'oibus/counter',
            'oibus/+'
          );
          expect(result).toBe(true);
        });
      });
    });

    describe('mqttTopicOverlapValidator', () => {
      it('should pass validation when no overlaps exist', () => {
        const mockHelpers = {
          message: jest.fn()
        };

        const topics = [{ topic: '/oibus/counter' }, { topic: '/other/topic' }, { topic: '/different/path' }];

        const result = (validator as unknown as { mqttTopicOverlapValidator: Joi.CustomValidator }).mqttTopicOverlapValidator(
          topics,
          mockHelpers as unknown as Joi.CustomHelpers
        );
        expect(result).toBe(topics);
        expect(mockHelpers.message).not.toHaveBeenCalled();
      });

      it('should fail validation when overlaps exist', () => {
        const mockHelpers = {
          message: jest.fn().mockReturnValue('error message')
        };

        const topics = [{ topic: '/oibus/counter' }, { topic: '/oibus/#' }];

        const result = (validator as unknown as { mqttTopicOverlapValidator: Joi.CustomValidator }).mqttTopicOverlapValidator(
          topics,
          mockHelpers as unknown as Joi.CustomHelpers
        );

        expect(mockHelpers.message).toHaveBeenCalledWith({
          custom: 'MQTT topic subscriptions cannot overlap. Conflicting topics: "/oibus/counter" and "/oibus/#"'
        });
        expect(result).toBe('error message');
      });

      it('should handle non-array input', () => {
        const mockHelpers = {
          message: jest.fn()
        };

        const nonArrayValue = 'not-an-array';
        const result = (validator as unknown as { mqttTopicOverlapValidator: Joi.CustomValidator }).mqttTopicOverlapValidator(
          nonArrayValue as unknown as Array<Record<string, unknown>>,
          mockHelpers as unknown as Joi.CustomHelpers
        );
        expect(result).toBe(nonArrayValue);
        expect(mockHelpers.message).not.toHaveBeenCalled();
      });

      it('should filter out empty topics', () => {
        const mockHelpers = {
          message: jest.fn()
        };

        const topics = [{ topic: '/oibus/counter' }, { topic: '' }, { topic: '   ' }, { topic: '/other/topic' }];

        const result = (validator as unknown as { mqttTopicOverlapValidator: Joi.CustomValidator }).mqttTopicOverlapValidator(
          topics,
          mockHelpers as unknown as Joi.CustomHelpers
        );
        expect(result).toBe(topics);
        expect(mockHelpers.message).not.toHaveBeenCalled();
      });

      it('should handle multiple overlaps', () => {
        const mockHelpers = {
          message: jest.fn().mockReturnValue('error message')
        };

        const topics = [{ topic: '/oibus/counter' }, { topic: '/oibus/+' }, { topic: '/oibus/#' }];

        const result = (validator as unknown as { mqttTopicOverlapValidator: Joi.CustomValidator }).mqttTopicOverlapValidator(
          topics,
          mockHelpers as unknown as Joi.CustomHelpers
        );

        expect(mockHelpers.message).toHaveBeenCalledWith({
          custom: expect.stringContaining('MQTT topic subscriptions cannot overlap')
        });
        expect(result).toBe('error message');
      });
    });

    describe('MQTT validation integration', () => {
      it('should apply MQTT validation to arrays with topic field', async () => {
        const settings: OIBusObjectAttribute = {
          type: 'object',
          key: 'objectSettings',
          translationKey: '',
          attributes: [
            {
              key: 'items',
              type: 'array',
              translationKey: 'Items',
              paginate: false,
              numberOfElementPerPage: 50,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'item',
                translationKey: 'configuration.oibus.manifest.south.items.item',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'topic',
                    translationKey: 'mqtt.topic',
                    defaultValue: '',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'string',
                    key: 'qos',
                    translationKey: 'mqtt.qos',
                    defaultValue: '',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  }
                ]
              }
            }
          ],
          enablingConditions: [],
          validators: [],
          displayProperties: { visible: true, wrapInBox: false }
        };

        const validData = {
          items: [
            { topic: '/oibus/counter', qos: '0' },
            { topic: '/other/topic', qos: '1' }
          ]
        };

        await expect(extendedValidator.validateSettings(settings, validData)).resolves.not.toThrow();
      });

      it('should fail validation for overlapping MQTT topics', async () => {
        const settings: OIBusObjectAttribute = {
          type: 'object',
          key: 'objectSettings',
          translationKey: '',
          attributes: [
            {
              key: 'items',
              type: 'array',
              translationKey: 'Items',
              paginate: false,
              numberOfElementPerPage: 50,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'item',
                translationKey: 'configuration.oibus.manifest.south.items.item',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'topic',
                    translationKey: 'mqtt.topic',
                    defaultValue: '',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'string',
                    key: 'qos',
                    translationKey: 'mqtt.qos',
                    defaultValue: '',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  }
                ]
              }
            }
          ],
          enablingConditions: [],
          validators: [],
          displayProperties: { visible: true, wrapInBox: false }
        };

        const invalidData = {
          items: [
            { topic: '/oibus/counter', qos: 0 },
            { topic: '/oibus/#', qos: 1 }
          ]
        };

        await expect(extendedValidator.validateSettings(settings, invalidData)).rejects.toThrow();
      });

      it('should pass validation for non-MQTT arrays without topic field', async () => {
        const settings: OIBusObjectAttribute = {
          type: 'object',
          key: 'objectSettings',
          translationKey: '',
          attributes: [
            {
              key: 'items',
              type: 'array',
              translationKey: 'Items',
              paginate: false,
              numberOfElementPerPage: 50,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'item',
                translationKey: 'configuration.oibus.manifest.south.items.item',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'name',
                    translationKey: 'mqtt.name',
                    defaultValue: '',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  }
                ]
              }
            }
          ],
          enablingConditions: [],
          validators: [],
          displayProperties: { visible: true, wrapInBox: false }
        };

        const validData = {
          items: [{ name: 'item1' }, { name: 'item2' }]
        };

        await expect(extendedValidator.validateSettings(settings, validData)).resolves.not.toThrow();
      });
    });
  });
});
