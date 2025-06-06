import Joi, { AnySchema } from 'joi';
import {
  OibCheckboxFormControl,
  OibCodeBlockFormControl,
  OibArrayFormControl,
  OibFormControl,
  OibFormGroup,
  OibNumberFormControl,
  OibScanModeFormControl,
  OibSecretFormControl,
  OibSelectFormControl,
  OibTextAreaFormControl,
  OibTextFormControl,
  OibTimezoneFormControl,
  OibCertificateFormControl
} from '../../../../shared/model/form.model';

export default class JoiValidator {
  async validate(schema: Joi.ObjectSchema, dto: object): Promise<void> {
    await schema.validateAsync(dto, {
      abortEarly: false
    });
  }

  async validateSettings(settings: Array<OibFormControl>, dto: object): Promise<void> {
    const schema = this.generateJoiSchema(settings);
    await this.validate(schema, dto);
  }

  public generateJoiSchema(settings: Array<OibFormControl>): Joi.ObjectSchema {
    let schema = Joi.object({});
    settings.forEach(setting => {
      schema = schema.append(this.generateJoiSchemaFromOibFormControl(setting));
    });

    return schema;
  }

  private generateJoiSchemaFromOibFormControl(oibFormControl: OibFormControl): Record<string, AnySchema> {
    switch (oibFormControl.type) {
      case 'OibText':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibNumber':
        return this.generateNumberJoiSchema(oibFormControl);
      case 'OibSelect':
        return this.generateSelectJoiSchema(oibFormControl);
      case 'OibSecret':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibTextArea':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibCodeBlock':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibCheckbox':
        return this.generateBooleanJoiSchema(oibFormControl);
      case 'OibScanMode':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibCertificate':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibTimezone':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibFormGroup':
        return this.generateFormGroupJoiSchema(oibFormControl);
      case 'OibArray':
        return this.generateFormArrayJoiSchema(oibFormControl);
    }
  }

  private generateTextJoiSchema(
    formControl:
      | OibTextFormControl
      | OibSecretFormControl
      | OibTextAreaFormControl
      | OibCodeBlockFormControl
      | OibCertificateFormControl
      | OibScanModeFormControl
      | OibTimezoneFormControl
  ): Record<string, AnySchema> {
    let schema = Joi.string();
    let isRequired = false;
    formControl.validators?.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          isRequired = true;
          break;
        case 'pattern':
          schema = schema.pattern(new RegExp(validator.params.pattern));
          break;
        case 'minLength':
          schema = schema.min(validator.params.minLength);
          break;
        case 'maxLength':
          schema = schema.max(validator.params.maxLength);
          break;
      }
    });
    if (!isRequired) {
      schema = schema.allow(null, '');
    }
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.StringSchema;
    return {
      [formControl.key]: schema
    };
  }

  private generateNumberJoiSchema(formControl: OibNumberFormControl): Record<string, AnySchema> {
    let schema = Joi.number();
    let isRequired = false;
    formControl.validators?.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          isRequired = true;
          break;
        case 'min':
          schema = schema.min(validator.params.min);
          break;
        case 'max':
          schema = schema.max(validator.params.max);
          break;
      }
    });
    if (!isRequired) {
      schema = schema.allow(null);
    }
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.NumberSchema;
    return {
      [formControl.key]: schema
    };
  }

  private generateSelectJoiSchema(formControl: OibSelectFormControl): Record<string, AnySchema> {
    let schema = Joi.string();
    formControl.validators?.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          break;
      }
    });
    schema = schema.valid(...formControl.options);
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.StringSchema;
    return {
      [formControl.key]: schema
    };
  }

  private generateBooleanJoiSchema(formControl: OibCheckboxFormControl): Record<string, AnySchema> {
    let schema = Joi.boolean();
    formControl.validators?.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          break;
      }
    });
    schema = schema.falsy(0).truthy(1);
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.BooleanSchema;

    return {
      [formControl.key]: schema
    };
  }

  private generateFormGroupJoiSchema(formControl: OibFormGroup): Record<string, AnySchema> {
    const subSchema: Record<string, AnySchema> = {};

    formControl.content.forEach(formControl => {
      subSchema[formControl.key] = this.generateJoiSchemaFromOibFormControl(formControl)[formControl.key];
    });
    let schema = Joi.object(subSchema);

    formControl.validators?.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          break;
      }
    });
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.ObjectSchema;
    return {
      [formControl.key]: schema
    };
  }

  private generateFormArrayJoiSchema(formControl: OibArrayFormControl): Record<string, AnySchema> {
    const { subSchema, customValidators } = this.buildArraySubSchemaAndValidators(formControl.content);

    let schema = Joi.array().items(Joi.object(subSchema));

    schema = this.applyCustomArrayValidators(schema, customValidators);
    schema = this.applyArrayLevelValidators(schema, formControl.validators);
    schema = this.handleConditionalDisplay(formControl, schema) as Joi.ArraySchema;

    return {
      [formControl.key]: schema
    };
  }

  private buildArraySubSchemaAndValidators(content: Array<OibFormControl>) {
    const subSchema: Record<string, AnySchema> = {};
    const customValidators = {
      unique: [] as Array<string>,
      singleTrue: [] as Array<string>
    };

    content.forEach(subControl => {
      subSchema[subControl.key] = this.generateJoiSchemaFromOibFormControl(subControl)[subControl.key];

      subControl.validators?.forEach(validator => {
        if (validator.key === 'unique') {
          customValidators.unique.push(subControl.key);
        } else if (validator.key === 'singleTrue') {
          customValidators.singleTrue.push(subControl.key);
        }
      });
    });

    return { subSchema, customValidators };
  }

  private applyCustomArrayValidators(
    schema: Joi.ArraySchema,
    validators: { unique: Array<string>; singleTrue: Array<string> }
  ): Joi.ArraySchema {
    validators.unique.forEach(fieldKey => {
      schema = schema.unique(fieldKey);
    });

    validators.singleTrue.forEach(fieldKey => {
      schema = schema.custom(this.generateSingleTrueValidator(fieldKey), `singleTrue validation for ${fieldKey}`);
    });

    return schema;
  }

  private applyArrayLevelValidators(
    schema: Joi.ArraySchema,
    validators?: Array<{ key: string; params?: Record<string, unknown> }>
  ): Joi.ArraySchema {
    if (!validators) return schema;

    validators.forEach(validator => {
      switch (validator.key) {
        case 'required':
          schema = schema.required();
          break;
        case 'min':
          schema = schema.min(Number(validator.params?.min));
          break;
        case 'minLength':
          schema = schema.min(Number(validator.params?.minLength));
          break;
        case 'max':
          schema = schema.max(Number(validator.params?.max));
          break;
        case 'maxLength':
          schema = schema.max(Number(validator.params?.maxLength));
          break;
      }
    });

    return schema;
  }

  private generateSingleTrueValidator(fieldKey: string): Joi.CustomValidator {
    return (value: Array<Record<string, unknown>>, helpers: Joi.CustomHelpers) => {
      if (!Array.isArray(value)) {
        return value;
      }

      const trueCount = value.filter(item => item?.[fieldKey] === true).length;

      return trueCount > 1 ? helpers.message({ custom: `Only one item in the array can have "${fieldKey}" set to true` }) : value;
    };
  }

  private handleConditionalDisplay(formControl: OibFormControl, schema: AnySchema): AnySchema {
    if (formControl.conditionalDisplay) {
      const condition = formControl.conditionalDisplay;
      schema = schema.when(condition.field, {
        is: Joi.any().valid(...condition.values),
        then: schema.required(),
        otherwise: schema.allow('').optional()
      });
    }
    return schema;
  }
}
