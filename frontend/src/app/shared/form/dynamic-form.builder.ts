import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import {
  OIBusAttribute,
  OIBusAttributeValidator,
  OIBusControlAttribute,
  OIBusDisplayableAttribute,
  OIBusEnablingCondition
} from '../../../../../backend/shared/model/form.model';
import { Instant } from '../../../../../backend/shared/model/types';
import { mqttTopicOverlapValidator, singleTrueValidator, uniqueFieldNamesValidator } from './validators';

export function addAttributeToForm(fb: NonNullableFormBuilder, formGroup: FormGroup, attribute: OIBusAttribute): boolean {
  switch (attribute.type) {
    case 'object':
      {
        const subGroup = fb.group<any>({});
        attribute.attributes.forEach(attribute => {
          addAttributeToForm(fb, subGroup, attribute);
        });
        formGroup.addControl(attribute.key, subGroup);
      }
      return true;
    case 'array':
      formGroup.addControl(attribute.key, fb.control([], getArrayValidators(attribute.rootAttribute.attributes)));
      return true;
    case 'string':
    case 'code':
    case 'string-select':
    case 'secret':
    case 'number':
    case 'boolean':
    case 'instant':
    case 'scan-mode':
    case 'certificate':
    case 'timezone':
      formGroup.addControl(attribute.key, createControl(fb, attribute));
      return true;
  }
}

export function createControl(fb: NonNullableFormBuilder, attribute: OIBusControlAttribute): FormControl {
  switch (attribute.type) {
    case 'boolean':
      return fb.control<boolean>(attribute.defaultValue, buildValidators(attribute.validators));
    case 'instant':
      return fb.control<Instant | null>(null, buildValidators(attribute.validators));
    case 'number':
      return fb.control<number | null>(attribute.defaultValue, buildValidators(attribute.validators));
    case 'string':
    case 'code':
    case 'string-select':
    case 'timezone':
      return fb.control<string | null>(attribute.defaultValue, buildValidators(attribute.validators));
    case 'secret':
    case 'scan-mode':
    case 'certificate':
      return fb.control<string | null>(null, buildValidators(attribute.validators));
  }
}

export function addEnablingConditions(form: FormGroup, enablingConditions: Array<OIBusEnablingCondition>) {
  enablingConditions.forEach(condition => {
    const referenceControl = form.get(condition.referralPathFromRoot);
    const targetControl = form.get(condition.targetPathFromRoot);

    if (!targetControl || !referenceControl) {
      throw new Error('wrong configuration in manifest');
    }

    if (checkCondition(referenceControl.value, condition)) {
      targetControl.enable();
    } else {
      targetControl.disable();
    }
    referenceControl.valueChanges.subscribe(newValue => {
      if (checkCondition(newValue, condition)) {
        targetControl.enable();
      } else {
        targetControl.disable();
      }
    });
  });
}

const checkCondition = (value: any, condition: OIBusEnablingCondition): boolean => {
  const operator = condition.operator || 'EQUALS';
  if (operator === 'CONTAINS') {
    // For CONTAINS, check if the reference value (string) contains any of the condition values
    if (typeof value === 'string') {
      return condition.values.some(conditionValue => value.includes(String(conditionValue)));
    }
    return false;
  } else {
    // Default EQUALS behavior
    return condition.values.includes(value);
  }
};

function buildValidators(validators: Array<OIBusAttributeValidator>): Array<ValidatorFn> {
  return validators.map(validator => {
    switch (validator.type) {
      case 'REQUIRED':
        return Validators.required;
      case 'POSITIVE_INTEGER':
        return Validators.min(0);
      case 'VALID_CRON':
        return Validators.required;
      case 'MAXIMUM':
        return Validators.max(parseInt(validator.arguments[0]));
      case 'MINIMUM':
        return Validators.min(parseInt(validator.arguments[0]));
      case 'PATTERN':
        return Validators.pattern(validator.arguments[0]);
      case 'UNIQUE':
      case 'SINGLE_TRUE':
      case 'MQTT_TOPIC_OVERLAP':
        // Note: These are handled at the array level, not individual field level
        return Validators.nullValidator;
    }
  });
}

/**
 * Create array-specific validators based on the content configuration
 */
export const getArrayValidators = (content: Array<OIBusAttribute>): Array<ValidatorFn> => {
  const validators: Array<ValidatorFn> = [];

  const uniqueFields: Array<string> = [];
  const singleTrueFields: Array<string> = [];

  content.forEach(field => {
    if (field.validators) {
      field.validators.forEach(validator => {
        if (validator.type === 'UNIQUE') {
          uniqueFields.push(field.key);
        }
        if (validator.type === 'SINGLE_TRUE') {
          singleTrueFields.push(field.key);
        }
      });
    }
  });

  uniqueFields.forEach(fieldKey => {
    validators.push(uniqueFieldNamesValidator(fieldKey));
  });

  singleTrueFields.forEach(fieldKey => {
    validators.push(singleTrueValidator(fieldKey));
  });

  return validators;
};

export const createMqttValidator = (formGroup: FormGroup, existingMqttTopics: Array<string>): void => {
  const topicControl = formGroup.get('topic');

  if (topicControl && existingMqttTopics.length > 0) {
    topicControl.addValidators(mqttTopicOverlapValidator(existingMqttTopics));
  }
};

export function isDisplayableAttribute(attribute: OIBusAttribute): attribute is OIBusDisplayableAttribute {
  switch (attribute.type) {
    case 'object':
    case 'array':
    case 'code':
      return false;
    case 'string':
    case 'string-select':
    case 'timezone':
    case 'secret':
    case 'number':
    case 'boolean':
    case 'instant':
    case 'scan-mode':
    case 'certificate':
      return true;
  }
}

export function asFormGroup(abstractControl: AbstractControl): FormGroup {
  return abstractControl as FormGroup;
}
