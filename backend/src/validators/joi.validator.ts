import Joi, { AnySchema } from 'joi';
import {
  OibAuthenticationFormControl,
  OibCheckboxFormControl,
  OibCodeBlockFormControl,
  OibFormControl,
  OibNumberFormControl,
  OibProxyFormControl,
  OibScanModeFormControl,
  OibSecretFormControl,
  OibSelectFormControl,
  OibTextAreaFormControl,
  OibTextFormControl,
  OibTimezoneFormControl
} from '../../../shared/model/form.model';

export default class JoiValidator {
  async validate(schema: Joi.ObjectSchema, dto: any): Promise<void> {
    await schema.validateAsync(dto, {
      abortEarly: false
    });
  }

  async validateSettings(settings: Array<OibFormControl>, dto: any): Promise<void> {
    const schema = this.generateJoiSchema(settings);
    await this.validate(schema, dto);
  }

  protected generateJoiSchema(settings: Array<OibFormControl>): Joi.ObjectSchema {
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
      case 'OibTimezone':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibProxy':
        return this.generateTextJoiSchema(oibFormControl);
      case 'OibAuthentication':
        return this.generateAuthenticationJoiSchema(oibFormControl);
    }
  }

  private generateTextJoiSchema(
    formControl:
      | OibTextFormControl
      | OibSecretFormControl
      | OibTextAreaFormControl
      | OibCodeBlockFormControl
      | OibScanModeFormControl
      | OibTimezoneFormControl
      | OibProxyFormControl
      | OibAuthenticationFormControl
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
      schema = schema.allow(null);
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

  private generateAuthenticationJoiSchema(formControl: OibAuthenticationFormControl): Record<string, AnySchema> {
    let schema = Joi.object({
      type: Joi.string()
        .required()
        .valid(...formControl.authTypes),
      username: Joi.optional(),
      password: Joi.optional(),
      token: Joi.optional(),
      key: Joi.optional(),
      secret: Joi.optional(),
      certPath: Joi.optional(),
      keyPath: Joi.optional()
    }).required();

    schema = this.handleConditionalDisplay(formControl, schema) as Joi.ObjectSchema;
    return {
      [formControl.key]: schema
    };
  }

  private handleConditionalDisplay(formControl: OibFormControl, schema: AnySchema): AnySchema {
    if (Object.prototype.hasOwnProperty.call(formControl, 'conditionalDisplay')) {
      Object.entries(formControl.conditionalDisplay!).forEach(([key, value]) => {
        schema = schema.when(key, {
          is: Joi.any().valid(...value),
          then: schema.required(),
          otherwise: schema.optional()
        });
      });
    }
    return schema;
  }
}
