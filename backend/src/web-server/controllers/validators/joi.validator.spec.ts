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
});
