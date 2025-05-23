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
    const schema = Joi.array().required();

    return {
      [formControl.key]: schema
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
