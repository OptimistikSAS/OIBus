import Joi from 'joi';
import JoiValidator from './joi.validator';
import { OibFormControl } from '../../../shared/model/form.model';

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

    await expect(validator.validate(schema, dto)).rejects.toThrowError(new Error());
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
    const settings: OibFormControl[] = [];
    const dto = {};
    const schema = Joi.object({});
    validator.validate = jest.fn();
    jest.spyOn(validator as any, 'generateJoiSchema').mockReturnValueOnce(schema);

    await validator.validateSettings(settings, dto);

    expect(validator.validate).toHaveBeenCalledWith(schema, dto);
  });

  it('generateJoiSchema should generate proper Joi schema for different form controls', async () => {
    const settings: OibFormControl[] = [
      {
        key: 'text',
        type: 'OibText',
        label: 'OibText'
      },
      {
        key: 'number',
        type: 'OibNumber',
        label: 'OibNumber'
      },
      {
        key: 'select',
        type: 'OibSelect',
        options: ['GET', 'POST', 'PUT', 'PATCH'],
        label: 'OibSelect'
      },
      {
        key: 'secret',
        type: 'OibSecret',
        label: 'OibSecret'
      },
      {
        key: 'area',
        type: 'OibTextArea',
        label: 'OibTextArea'
      },
      {
        key: 'block',
        type: 'OibCodeBlock',
        contentType: 'json',
        label: 'OibCodeBlock'
      },
      {
        key: 'checkbox',
        type: 'OibCheckbox',
        label: 'OibCheckbox'
      },
      {
        key: 'timezone',
        type: 'OibTimezone',
        label: 'OibTimezone'
      },
      {
        key: 'proxy',
        type: 'OibProxy',
        label: 'OibProxy'
      },
      {
        key: 'authentication',
        type: 'OibAuthentication',
        label: 'OibAuthentication',
        authTypes: ['none', 'basic', 'cert']
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      text: Joi.string().allow(null),
      number: Joi.number().allow(null),
      select: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH'),
      secret: Joi.string().allow(null),
      area: Joi.string().allow(null),
      block: Joi.string().allow(null),
      checkbox: Joi.boolean().falsy(0).truthy(1),
      timezone: Joi.string().allow(null),
      proxy: Joi.string().allow(null),
      authentication: Joi.object({
        type: Joi.string().required().valid('none', 'basic', 'cert'),
        username: Joi.optional(),
        password: Joi.optional(),
        token: Joi.optional(),
        key: Joi.optional(),
        secret: Joi.optional(),
        certPath: Joi.optional(),
        keyPath: Joi.optional()
      }).required()
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate text Joi schema', async () => {
    const settings: OibFormControl[] = [
      {
        key: 'host',
        type: 'OibText',
        label: 'Host',
        validators: [
          { key: 'required' },
          { key: 'minLength', params: { minLength: 1 } },
          { key: 'maxLength', params: { maxLength: 255 } },
          { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }
        ],
        readDisplay: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      host: Joi.string().required().min(1).max(255).pattern(new RegExp('^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*'))
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate number Joi schema', async () => {
    const settings: OibFormControl[] = [
      {
        key: 'port',
        type: 'OibNumber',
        label: 'Port',
        defaultValue: 1883,
        newRow: false,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
        readDisplay: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      port: Joi.number().required().min(1).max(65535)
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly generate select Joi schema', async () => {
    const settings: OibFormControl[] = [
      {
        key: 'requestMethod',
        type: 'OibSelect',
        options: ['GET', 'POST', 'PUT', 'PATCH'],
        label: 'HTTP Method',
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
    const settings: OibFormControl[] = [
      {
        key: 'verbose',
        type: 'OibCheckbox',
        label: 'Verbose',
        newRow: true,
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      verbose: Joi.boolean().required().falsy(0).truthy(1)
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });

  it('generateJoiSchema should properly handle conditional display', async () => {
    const settings: OibFormControl[] = [
      {
        key: 'driver',
        type: 'OibSelect',
        label: 'SQL Driver',
        options: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'],
        validators: [{ key: 'required' }]
      },
      {
        key: 'databasePath',
        type: 'OibText',
        label: 'Database path',
        conditionalDisplay: { driver: ['SQLite'] }
      }
    ];

    const generatedSchema = extendedValidator.generateJoiSchema(settings);

    const expectedSchema = Joi.object({
      driver: Joi.string().required().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'),
      databasePath: Joi.string()
        .allow(null)
        .when('driver', {
          is: Joi.any().valid('SQLite'),
          then: Joi.string().allow(null).required()
        })
    });
    expect(expectedSchema.describe()).toEqual(generatedSchema.describe());
  });
});
