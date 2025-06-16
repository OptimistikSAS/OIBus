import Joi, { AnySchema } from 'joi';
import {
  OIBusArrayAttribute,
  OIBusAttribute,
  OIBusAttributeValidator,
  OIBusBooleanAttribute,
  OIBusCertificateAttribute,
  OIBusCodeAttribute,
  OIBusInstantAttribute,
  OIBusNumberAttribute,
  OIBusObjectAttribute,
  OIBusScanModeAttribute,
  OIBusSecretAttribute,
  OIBusStringAttribute,
  OIBusStringSelectAttribute,
  OIBusTimezoneAttribute
} from '../../../../shared/model/form.model';

export default class JoiValidator {
  async validate(schema: Joi.ObjectSchema, dto: object): Promise<void> {
    await schema.validateAsync(dto, {
      abortEarly: false
    });
  }

  async validateSettings(settings: OIBusObjectAttribute, dto: object): Promise<void> {
    const schema = this.generateFormGroupJoiSchema(settings)[settings.key];
    await this.validate(schema, dto);
  }

  public generateJoiSchema(settings: OIBusObjectAttribute): Joi.ObjectSchema {
    return Joi.object(this.generateJoiSchemaFromOibFormControl(settings));
  }

  private generateJoiSchemaFromOibFormControl(oibFormControl: OIBusAttribute): Record<string, AnySchema> {
    switch (oibFormControl.type) {
      case 'string':
      case 'secret':
      case 'instant':
      case 'scan-mode':
      case 'certificate':
      case 'timezone':
      case 'code':
        return this.generateTextJoiSchema(oibFormControl);
      case 'number':
        return this.generateNumberJoiSchema(oibFormControl);
      case 'string-select':
        return this.generateSelectJoiSchema(oibFormControl);
      case 'boolean':
        return this.generateBooleanJoiSchema(oibFormControl);
      case 'object':
        return this.generateFormGroupJoiSchema(oibFormControl);
      case 'array':
        return this.generateFormArrayJoiSchema(oibFormControl);
    }
  }

  private generateTextJoiSchema(
    formControl:
      | OIBusStringAttribute
      | OIBusSecretAttribute
      | OIBusCodeAttribute
      | OIBusCertificateAttribute
      | OIBusScanModeAttribute
      | OIBusTimezoneAttribute
      | OIBusInstantAttribute
  ): Record<string, AnySchema> {
    let schema = Joi.string();
    let isRequired = false;
    formControl.validators?.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
          isRequired = true;
          break;
        case 'PATTERN':
          schema = schema.pattern(new RegExp(validator.arguments[0]));
          break;
      }
    });
    if (!isRequired) {
      schema = schema.allow(null, '');
    }
    return {
      [formControl.key]: schema
    };
  }

  private generateNumberJoiSchema(formControl: OIBusNumberAttribute): Record<string, AnySchema> {
    let schema = Joi.number();
    let isRequired = false;
    formControl.validators?.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
          isRequired = true;
          break;
        case 'MINIMUM':
          schema = schema.min(parseInt(validator.arguments[0]));
          break;
        case 'MAXIMUM':
          schema = schema.max(parseInt(validator.arguments[0]));
          break;
      }
    });
    if (!isRequired) {
      schema = schema.allow(null);
    }
    return {
      [formControl.key]: schema
    };
  }

  private generateSelectJoiSchema(formControl: OIBusStringSelectAttribute): Record<string, AnySchema> {
    let schema = Joi.string();
    formControl.validators?.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
          break;
      }
    });
    schema = schema.valid(...formControl.selectableValues);
    return {
      [formControl.key]: schema
    };
  }

  private generateBooleanJoiSchema(formControl: OIBusBooleanAttribute): Record<string, AnySchema> {
    let schema = Joi.boolean();
    formControl.validators?.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
          break;
      }
    });
    schema = schema.falsy(0).truthy(1);
    return {
      [formControl.key]: schema
    };
  }

  generateFormGroupJoiSchema(objectAttribute: OIBusObjectAttribute): Record<string, Joi.ObjectSchema> {
    const subSchema: Record<string, AnySchema> = {};
    objectAttribute.attributes.forEach(formControl => {
      subSchema[formControl.key] = this.generateJoiSchemaFromOibFormControl(formControl)[formControl.key];
      const enablingCondition = objectAttribute.enablingConditions.find(element => element.targetPathFromRoot === formControl.key);
      if (enablingCondition) {
        subSchema[formControl.key] = subSchema[formControl.key].when(enablingCondition.referralPathFromRoot, {
          is: Joi.any().valid(...enablingCondition.values),
          then: subSchema[formControl.key].required(),
          otherwise: subSchema[formControl.key].allow('').optional()
        });
      }
    });
    let schema = Joi.object(subSchema);
    objectAttribute.validators.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
          break;
      }
    });
    return {
      [objectAttribute.key]: schema
    };
  }

  private generateFormArrayJoiSchema(formControl: OIBusArrayAttribute): Record<string, AnySchema> {
    const { subSchema, customValidators } = this.buildArraySubSchemaAndValidators(formControl.rootAttribute);

    let schema = Joi.array().items(Joi.object(subSchema));

    schema = this.applyCustomArrayValidators(schema, customValidators);
    schema = this.applyArrayLevelValidators(schema, formControl.validators);

    if (this.isMqttItemsArray(formControl)) {
      schema = schema.custom(this.mqttTopicOverlapValidator, 'MQTT topic overlap validation');
    }
    return {
      [formControl.key]: schema
    };
  }

  private buildArraySubSchemaAndValidators(objectAttribute: OIBusObjectAttribute) {
    const subSchema: Record<string, AnySchema> = {};
    const customValidators = {
      UNIQUE: [] as Array<string>,
      SINGLE_TRUE: [] as Array<string>
    };

    objectAttribute.attributes.forEach(subControl => {
      subSchema[subControl.key] = this.generateJoiSchemaFromOibFormControl(subControl)[subControl.key];
      const enablingCondition = objectAttribute.enablingConditions.find(element => element.targetPathFromRoot === subControl.key);
      if (enablingCondition) {
        subSchema[subControl.key] = subSchema[subControl.key].when(enablingCondition.referralPathFromRoot, {
          is: Joi.any().valid(...enablingCondition.values),
          then: subSchema[subControl.key].required(),
          otherwise: subSchema[subControl.key].allow('').optional()
        });
      }

      subControl.validators?.forEach(validator => {
        if (validator.type === 'UNIQUE') {
          customValidators.UNIQUE.push(subControl.key);
        } else if (validator.type === 'SINGLE_TRUE') {
          customValidators.SINGLE_TRUE.push(subControl.key);
        }
      });
    });

    return { subSchema, customValidators };
  }

  private applyCustomArrayValidators(
    schema: Joi.ArraySchema,
    validators: { UNIQUE: Array<string>; SINGLE_TRUE: Array<string> }
  ): Joi.ArraySchema {
    validators.UNIQUE.forEach(fieldKey => {
      schema = schema.unique(fieldKey);
    });

    validators.SINGLE_TRUE.forEach(fieldKey => {
      schema = schema.custom(this.generateSingleTrueValidator(fieldKey), `SINGLE_TRUE validation for ${fieldKey}`);
    });

    return schema;
  }

  private applyArrayLevelValidators(schema: Joi.ArraySchema, validators?: Array<OIBusAttributeValidator>): Joi.ArraySchema {
    if (!validators) return schema;

    validators.forEach(validator => {
      switch (validator.type) {
        case 'REQUIRED':
          schema = schema.required();
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

  private isMqttItemsArray(formControl: OIBusArrayAttribute): boolean {
    return formControl.rootAttribute.attributes.some(control => control.key === 'topic');
  }

  private mqttTopicOverlapValidator: Joi.CustomValidator = (value: Array<Record<string, unknown>>, helpers: Joi.CustomHelpers) => {
    if (!Array.isArray(value)) {
      return value;
    }

    const topics = value.map(item => item.topic).filter((topic): topic is string => typeof topic === 'string' && topic.trim().length > 0);

    const conflicts: Array<{ topic1: string; topic2: string }> = [];

    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        const topic1 = topics[i];
        const topic2 = topics[j];

        if (this.doMqttTopicsOverlap(topic1, topic2)) {
          conflicts.push({ topic1, topic2 });
        }
      }
    }

    return conflicts.length > 0
      ? helpers.message({
          custom: `MQTT topic subscriptions cannot overlap. Conflicting topics: ${conflicts.map(c => `"${c.topic1}" and "${c.topic2}"`).join(', ')}`
        })
      : value;
  };

  private doMqttTopicsOverlap(topic1: string, topic2: string): boolean {
    if (topic1 === topic2) {
      return true;
    }
    return this.mqttTopicMatches(topic1, topic2) || this.mqttTopicMatches(topic2, topic1);
  }

  private mqttTopicMatches(topic: string, pattern: string): boolean {
    if (!pattern.includes('+') && !pattern.includes('#')) {
      return topic === pattern;
    }

    if (pattern.includes('#')) {
      const hashIndex = pattern.indexOf('#');
      const prefix = pattern.substring(0, hashIndex);

      if (hashIndex === pattern.length - 1 || pattern.charAt(hashIndex + 1) === '') {
        if (hashIndex === 0 || pattern.charAt(hashIndex - 1) === '/') {
          return topic.startsWith(prefix);
        }
      }
    }

    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');

    if (patternParts[patternParts.length - 1] === '#') {
      if (topicParts.length < patternParts.length - 1) {
        return false;
      }
      for (let i = 0; i < patternParts.length - 1; i++) {
        if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
          return false;
        }
      }
      return true;
    }

    if (topicParts.length !== patternParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }
}
