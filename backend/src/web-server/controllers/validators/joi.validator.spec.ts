import Joi from 'joi';
import JoiValidator from './joi.validator';
import { OibFormControl, OibArrayFormControl } from '../../../../shared/model/form.model';

const validator = new JoiValidator();

class JoiValidatorExtend extends JoiValidator {
  generateJoiSchema(settings: Array<OibFormControl>): Joi.ObjectSchema {
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
    const settings: Array<OibFormControl> = [];
    const dto = {};
    const schema = Joi.object({});
    validator.validate = jest.fn();
    jest.spyOn(validator, 'generateJoiSchema').mockReturnValueOnce(schema);

    await validator.validateSettings(settings, dto);

    expect(validator.validate).toHaveBeenCalledWith(schema, dto);
  });

  it('generateJoiSchema should generate proper Joi schema for different form controls', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'text',
        type: 'OibText',
        translationKey: 'OibText'
      },
      {
        key: 'number',
        type: 'OibNumber',
        translationKey: 'OibNumber'
      },
      {
        key: 'select',
        type: 'OibSelect',
        options: ['GET', 'POST', 'PUT', 'PATCH'],
        translationKey: 'OibSelect'
      },
      {
        key: 'secret',
        type: 'OibSecret',
        translationKey: 'OibSecret'
      },
      {
        key: 'area',
        type: 'OibTextArea',
        translationKey: 'OibTextArea'
      },
      {
        key: 'block',
        type: 'OibCodeBlock',
        contentType: 'json',
        translationKey: 'OibCodeBlock'
      },
      {
        key: 'checkbox',
        type: 'OibCheckbox',
        translationKey: 'OibCheckbox'
      },
      {
        key: 'timezone',
        type: 'OibTimezone',
        translationKey: 'OibTimezone'
      },
      {
        key: 'scanMode',
        type: 'OibScanMode',
        translationKey: 'OibScanMode',
        acceptSubscription: false,
        subscriptionOnly: false
      },
      {
        key: 'certificate',
        type: 'OibCertificate',
        translationKey: 'OibCertificate'
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      text: Joi.string().allow(null, ''),
      number: Joi.number().allow(null),
      select: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH'),
      secret: Joi.string().allow(null, ''),
      area: Joi.string().allow(null, ''),
      block: Joi.string().allow(null, ''),
      checkbox: Joi.boolean().falsy(0).truthy(1),
      timezone: Joi.string().allow(null, ''),
      scanMode: Joi.string().allow(null, ''),
      certificate: Joi.string().allow(null, '')
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate text Joi schema', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'host',
        type: 'OibText',
        translationKey: 'Host',
        validators: [
          { key: 'required' },
          { key: 'minLength', params: { minLength: 1 } },
          { key: 'maxLength', params: { maxLength: 255 } },
          { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }
        ],
        displayInViewMode: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      host: Joi.string().required().min(1).max(255).pattern(new RegExp('^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*'))
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate number Joi schema', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'port',
        type: 'OibNumber',
        translationKey: 'Port',
        defaultValue: 1883,
        newRow: false,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
        displayInViewMode: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      port: Joi.number().required().min(1).max(65535)
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate select Joi schema', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'requestMethod',
        type: 'OibSelect',
        options: ['GET', 'POST', 'PUT', 'PATCH'],
        translationKey: 'HTTP Method',
        defaultValue: 'POST',
        newRow: false,
        validators: [{ key: 'required' }]
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      requestMethod: Joi.string().required().valid('GET', 'POST', 'PUT', 'PATCH')
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate boolean Joi schema', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'verbose',
        type: 'OibCheckbox',
        translationKey: 'Verbose',
        newRow: true,
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      verbose: Joi.boolean().required().falsy(0).truthy(1)
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly handle conditional display', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'driver',
        type: 'OibSelect',
        translationKey: 'SQL Driver',
        options: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'],
        validators: [{ key: 'required' }]
      },
      {
        key: 'databasePath',
        type: 'OibText',
        translationKey: 'Database path',
        conditionalDisplay: { field: 'driver', values: ['SQLite'] }
      },
      {
        key: 'query',
        type: 'OibText',
        translationKey: 'Query'
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      driver: Joi.string().required().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'),
      databasePath: Joi.string()
        .allow(null, '')
        .when('driver', {
          is: Joi.any().valid('SQLite'),
          then: Joi.string().allow(null, '').required(),
          otherwise: Joi.string().allow(null, '').optional()
        }),
      query: Joi.string().allow(null, '')
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should generate proper Joi schema for form Groups', async () => {
    const settings: Array<OibFormControl> = [
      {
        key: 'authentication',
        type: 'OibFormGroup',
        translationKey: 'Authentication',
        class: 'col',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'Type',
            options: ['none', 'basic', 'bearer', 'api-key'],
            validators: [{ key: 'required' }],
            defaultValue: 'none',
            newRow: true,
            displayInViewMode: false
          },
          {
            key: 'username',
            type: 'OibText',
            translationKey: 'Username',
            defaultValue: '',
            displayInViewMode: false
          },
          {
            key: 'password',
            type: 'OibSecret',
            translationKey: 'Password',
            defaultValue: '',
            displayInViewMode: false
          },
          {
            key: 'token',
            type: 'OibSecret',
            translationKey: 'Token',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'apiKeyHeader',
            type: 'OibSecret',
            translationKey: 'Api key header',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'apiKey',
            type: 'OibSecret',
            translationKey: 'Api key',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          }
        ]
      }
    ];
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
    const settings: Array<OibFormControl> = [
      {
        key: 'authentication',
        type: 'OibFormGroup',
        translationKey: 'Authentication',
        class: 'col',
        newRow: true,
        displayInViewMode: false,
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'Type',
            options: ['none', 'basic', 'bearer', 'api-key'],
            defaultValue: 'none',
            newRow: true,
            displayInViewMode: false
          },
          {
            key: 'username',
            type: 'OibText',
            translationKey: 'Username',
            defaultValue: '',
            displayInViewMode: false
          },
          {
            key: 'password',
            type: 'OibSecret',
            translationKey: 'Password',
            defaultValue: '',
            displayInViewMode: false
          },
          {
            key: 'token',
            type: 'OibSecret',
            translationKey: 'Token',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'apiKeyHeader',
            type: 'OibSecret',
            translationKey: 'Api key header',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'apiKey',
            type: 'OibSecret',
            translationKey: 'Api key',
            defaultValue: '',
            newRow: false,
            displayInViewMode: false
          }
        ]
      }
    ];
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
    const settings: Array<OibFormControl> = [
      {
        key: 'dateTimeFields',
        type: 'OibArray',
        translationKey: 'Date time fields',
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'fieldName',
            translationKey: 'Field name',
            type: 'OibText',
            defaultValue: '',
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'Reference field',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true
          },
          {
            key: 'type',
            translationKey: 'Type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
            displayInViewMode: true
          },
          {
            key: 'timezone',
            translationKey: 'Timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            displayInViewMode: true
          },
          {
            key: 'format',
            translationKey: 'Format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss'
          },
          {
            key: 'locale',
            translationKey: 'Locale',
            defaultValue: 'en-En',
            type: 'OibText'
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      }
    ];
    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      dateTimeFields: Joi.array()
        .required()
        .items(
          Joi.object({
            fieldName: Joi.string().allow(null, ''),
            useAsReference: Joi.boolean().falsy(0).truthy(1),
            type: Joi.string().valid('string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'),
            timezone: Joi.string().allow(null, ''),
            format: Joi.string().allow(null, ''),
            locale: Joi.string().allow(null, '')
          })
        )
    });

    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  describe('Array validation with custom validators', () => {
    const arrayFormControlWithUniqueAndSingleTrue: OibArrayFormControl = {
      key: 'dateTimeFields',
      type: 'OibArray',
      translationKey: 'Date time fields',
      content: [
        {
          key: 'fieldName',
          translationKey: 'Field name',
          type: 'OibText',
          validators: [{ key: 'required' }, { key: 'unique' }],
          displayInViewMode: true
        },
        {
          key: 'useAsReference',
          translationKey: 'Reference field',
          type: 'OibCheckbox',
          validators: [{ key: 'singleTrue' }],
          displayInViewMode: true
        },
        {
          key: 'type',
          translationKey: 'Type',
          type: 'OibSelect',
          options: ['string', 'iso-string'],
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ]
    };

    it('should pass validation with unique field names and single true value', async () => {
      const validData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: true, type: 'string' },
          { fieldName: 'field2', useAsReference: false, type: 'string' },
          { fieldName: 'field3', useAsReference: false, type: 'iso-string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], validData)).resolves.not.toThrow();
    });

    it('should pass validation with unique field names and no true values', async () => {
      const validData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: false, type: 'string' },
          { fieldName: 'field2', useAsReference: false, type: 'string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], validData)).resolves.not.toThrow();
    });

    it('should fail validation with duplicate field names', async () => {
      const invalidData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: true, type: 'string' },
          { fieldName: 'field2', useAsReference: false, type: 'string' },
          { fieldName: 'field1', useAsReference: false, type: 'iso-string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], invalidData)).rejects.toThrow();
    });

    it('should fail validation with multiple true values', async () => {
      const invalidData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: true, type: 'string' },
          { fieldName: 'field2', useAsReference: true, type: 'string' },
          { fieldName: 'field3', useAsReference: false, type: 'iso-string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], invalidData)).rejects.toThrow();
    });

    it('should fail validation with both duplicate field names and multiple true values', async () => {
      const invalidData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: true, type: 'string' },
          { fieldName: 'field1', useAsReference: true, type: 'string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], invalidData)).rejects.toThrow();
    });

    it('should pass validation with empty array', async () => {
      const validData = {
        dateTimeFields: []
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], validData)).resolves.not.toThrow();
    });

    it('should handle arrays with only one item correctly', async () => {
      const validData = {
        dateTimeFields: [{ fieldName: 'field1', useAsReference: true, type: 'string' }]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], validData)).resolves.not.toThrow();
    });

    it('should validate nested object structure correctly', async () => {
      const validData = {
        dateTimeFields: [
          { fieldName: 'timestamp', useAsReference: true, type: 'string' },
          { fieldName: 'created_at', useAsReference: false, type: 'iso-string' }
        ]
      };

      await expect(extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], validData)).resolves.not.toThrow();
    });

    it('should generate proper error messages', async () => {
      const invalidData = {
        dateTimeFields: [
          { fieldName: 'field1', useAsReference: true, type: 'string' },
          { fieldName: 'field1', useAsReference: true, type: 'string' }
        ]
      };

      try {
        await extendedValidator.validateSettings([arrayFormControlWithUniqueAndSingleTrue], invalidData);
        fail('Expected validation to throw an error');
      } catch (error: unknown) {
        expect(error instanceof Joi.ValidationError).toBeTruthy();
        if (error instanceof Joi.ValidationError) {
          expect(error.details).toBeDefined();
          expect(error.details.length).toBeGreaterThan(0);
          const errorMessages = error.details.map((detail: Joi.ValidationErrorItem) => detail.message);

          const hasUniqueError = errorMessages.some(
            (msg: string) =>
              msg.includes('duplicate') ||
              msg.includes('unique') ||
              msg.includes('fieldName') ||
              msg.toLowerCase().includes('contains a duplicate value')
          );

          const hasSingleTrueError = errorMessages.some(
            (msg: string) => msg.includes('Only one item') || msg.includes('useAsReference') || msg.includes('set to true')
          );

          expect(hasUniqueError || hasSingleTrueError).toBeTruthy();
        }
      }
    });
  });

  describe('Array level validators', () => {
    it('should apply min validator to array', async () => {
      const arrayFormControl: OibArrayFormControl = {
        key: 'items',
        type: 'OibArray',
        translationKey: 'Items',
        validators: [{ key: 'min', params: { min: 2 } }],
        content: [
          {
            key: 'name',
            type: 'OibText',
            translationKey: 'Name'
          }
        ]
      };

      const invalidData = { items: [{ name: 'item1' }] };
      const validData = { items: [{ name: 'item1' }, { name: 'item2' }] };

      await expect(extendedValidator.validateSettings([arrayFormControl], invalidData)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], validData)).resolves.not.toThrow();
    });

    it('should apply minLength validator to array', async () => {
      const arrayFormControl: OibArrayFormControl = {
        key: 'items',
        type: 'OibArray',
        translationKey: 'Items',
        validators: [{ key: 'minLength', params: { minLength: 3 } }],
        content: [
          {
            key: 'name',
            type: 'OibText',
            translationKey: 'Name'
          }
        ]
      };

      const invalidData = { items: [{ name: 'item1' }, { name: 'item2' }] };
      const validData = { items: [{ name: 'item1' }, { name: 'item2' }, { name: 'item3' }] };

      await expect(extendedValidator.validateSettings([arrayFormControl], invalidData)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], validData)).resolves.not.toThrow();
    });

    it('should apply max validator to array', async () => {
      const arrayFormControl: OibArrayFormControl = {
        key: 'items',
        type: 'OibArray',
        translationKey: 'Items',
        validators: [{ key: 'max', params: { max: 2 } }],
        content: [
          {
            key: 'name',
            type: 'OibText',
            translationKey: 'Name'
          }
        ]
      };

      const invalidData = { items: [{ name: 'item1' }, { name: 'item2' }, { name: 'item3' }] };
      const validData = { items: [{ name: 'item1' }, { name: 'item2' }] };

      await expect(extendedValidator.validateSettings([arrayFormControl], invalidData)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], validData)).resolves.not.toThrow();
    });

    it('should apply maxLength validator to array', async () => {
      const arrayFormControl: OibArrayFormControl = {
        key: 'items',
        type: 'OibArray',
        translationKey: 'Items',
        validators: [{ key: 'maxLength', params: { maxLength: 1 } }],
        content: [
          {
            key: 'name',
            type: 'OibText',
            translationKey: 'Name'
          }
        ]
      };

      const invalidData = { items: [{ name: 'item1' }, { name: 'item2' }] };
      const validData = { items: [{ name: 'item1' }] };

      await expect(extendedValidator.validateSettings([arrayFormControl], invalidData)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], validData)).resolves.not.toThrow();
    });

    it('should handle multiple array validators together', async () => {
      const arrayFormControl: OibArrayFormControl = {
        key: 'items',
        type: 'OibArray',
        translationKey: 'Items',
        validators: [
          { key: 'min', params: { min: 2 } },
          { key: 'max', params: { max: 4 } }
        ],
        content: [
          {
            key: 'name',
            type: 'OibText',
            translationKey: 'Name'
          }
        ]
      };

      const tooFewItems = { items: [{ name: 'item1' }] };
      const tooManyItems = { items: [{ name: 'item1' }, { name: 'item2' }, { name: 'item3' }, { name: 'item4' }, { name: 'item5' }] };
      const validData = { items: [{ name: 'item1' }, { name: 'item2' }, { name: 'item3' }] };

      await expect(extendedValidator.validateSettings([arrayFormControl], tooFewItems)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], tooManyItems)).rejects.toThrow();
      await expect(extendedValidator.validateSettings([arrayFormControl], validData)).resolves.not.toThrow();
    });
  });

  describe('SingleTrue validator edge cases', () => {
    it('should handle non-array values in singleTrue validator directly', () => {
      const validatorInstance = new JoiValidator();
      const customValidator: Joi.CustomValidator = (
        validatorInstance as unknown as {
          generateSingleTrueValidator: (field: string) => Joi.CustomValidator;
        }
      ).generateSingleTrueValidator('isActive');

      const mockHelpers = {
        message: jest.fn()
      };

      const nonArrayValue = 'not-an-array';
      const result = customValidator(nonArrayValue as unknown, mockHelpers as unknown as Joi.CustomHelpers);

      expect(result).toBe(nonArrayValue);
      expect(mockHelpers.message).not.toHaveBeenCalled();
    });

    it('should handle non-array values in singleTrue validator - alternative approach', async () => {
      const validatorInstance = new JoiValidator();
      const customValidator = (
        validatorInstance as unknown as { generateSingleTrueValidator: (field: string) => Joi.CustomValidator }
      ).generateSingleTrueValidator('isActive');

      const schema = Joi.any().custom(customValidator);

      const nonArrayValue = 'not-an-array';
      const result = await schema.validateAsync(nonArrayValue);

      expect(result).toBe(nonArrayValue);
    });

    it('should handle null values in singleTrue validator', async () => {
      const validatorInstance = new JoiValidator();
      const customValidator = (
        validatorInstance as unknown as { generateSingleTrueValidator: (field: string) => Joi.CustomValidator }
      ).generateSingleTrueValidator('isActive');

      const schema = Joi.any().custom(customValidator);

      const result = await schema.validateAsync(null);
      expect(result).toBe(null);
    });

    it('should handle undefined values in singleTrue validator', async () => {
      const validatorInstance = new JoiValidator();
      const customValidator = (
        validatorInstance as unknown as { generateSingleTrueValidator: (field: string) => Joi.CustomValidator }
      ).generateSingleTrueValidator('isActive');

      const schema = Joi.any().custom(customValidator);

      const result = await schema.validateAsync(undefined);
      expect(result).toBe(undefined);
    });
  });

  describe('MQTT Topic Validation', () => {
    describe('isMqttItemsArray', () => {
      it('should return true when array contains topic field', () => {
        const mqttArrayControl: OibArrayFormControl = {
          key: 'items',
          type: 'OibArray',
          translationKey: 'Items',
          content: [
            { key: 'topic', type: 'OibText', translationKey: 'Topic' },
            { key: 'qos', type: 'OibNumber', translationKey: 'QoS' }
          ]
        };

        const result = (validator as unknown as { isMqttItemsArray: (formControl: OibArrayFormControl) => boolean }).isMqttItemsArray(
          mqttArrayControl
        );
        expect(result).toBe(true);
      });

      it('should return false when array does not contain topic field', () => {
        const regularArrayControl: OibArrayFormControl = {
          key: 'items',
          type: 'OibArray',
          translationKey: 'Items',
          content: [
            { key: 'name', type: 'OibText', translationKey: 'Name' },
            { key: 'value', type: 'OibNumber', translationKey: 'Value' }
          ]
        };

        const result = (validator as unknown as { isMqttItemsArray: (formControl: OibArrayFormControl) => boolean }).isMqttItemsArray(
          regularArrayControl
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
        const mqttArrayControl: OibArrayFormControl = {
          key: 'items',
          type: 'OibArray',
          translationKey: 'Items',
          content: [
            { key: 'topic', type: 'OibText', translationKey: 'Topic' },
            { key: 'qos', type: 'OibNumber', translationKey: 'QoS' }
          ]
        };

        const validData = {
          items: [
            { topic: '/oibus/counter', qos: 0 },
            { topic: '/other/topic', qos: 1 }
          ]
        };

        await expect(extendedValidator.validateSettings([mqttArrayControl], validData)).resolves.not.toThrow();
      });

      it('should fail validation for overlapping MQTT topics', async () => {
        const mqttArrayControl: OibArrayFormControl = {
          key: 'items',
          type: 'OibArray',
          translationKey: 'Items',
          content: [
            { key: 'topic', type: 'OibText', translationKey: 'Topic' },
            { key: 'qos', type: 'OibNumber', translationKey: 'QoS' }
          ]
        };

        const invalidData = {
          items: [
            { topic: '/oibus/counter', qos: 0 },
            { topic: '/oibus/#', qos: 1 }
          ]
        };

        await expect(extendedValidator.validateSettings([mqttArrayControl], invalidData)).rejects.toThrow();
      });

      it('should pass validation for non-MQTT arrays without topic field', async () => {
        const regularArrayControl: OibArrayFormControl = {
          key: 'items',
          type: 'OibArray',
          translationKey: 'Items',
          content: [
            { key: 'name', type: 'OibText', translationKey: 'Name' },
            { key: 'description', type: 'OibText', translationKey: 'Description' }
          ]
        };

        const validData = {
          items: [
            { name: 'item1', description: '/oibus/counter' },
            { name: 'item2', description: '/oibus/#' }
          ]
        };

        await expect(extendedValidator.validateSettings([regularArrayControl], validData)).resolves.not.toThrow();
      });
    });
  });
});
