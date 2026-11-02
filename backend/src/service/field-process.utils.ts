import Joi from 'joi';

import { FieldProcessTestResultDTO } from '../../shared/model/api/transformer.model';
import {
  FIELD_CONVERT_TYPES,
  FIELD_DATETIME_PRECISIONS,
  FIELD_DATETIME_TYPES,
  FIELD_NUMBER_OPERATORS,
  FIELD_OPERATION_TYPES,
  FieldOperation,
  RecordFieldValue
} from '../../shared/model/connector/field-process.model';

import { applyFieldOperations } from '../transformers/field-process';

const datetimeTypes = Joi.string()
  .valid(...FIELD_DATETIME_TYPES)
  .required();

/** One operation of a field process - its settings depend on its type. */
const fieldOperation = Joi.object({
  type: Joi.string()
    .valid(...FIELD_OPERATION_TYPES)
    .required()
})
  .when(Joi.object({ type: 'convert' }).unknown(), {
    then: Joi.object({
      to: Joi.string()
        .valid(...FIELD_CONVERT_TYPES)
        .required()
    })
  })
  .when(Joi.object({ type: 'substring' }).unknown(), {
    then: Joi.object({ start: Joi.number().integer().required(), end: Joi.number().integer().allow(null).required() })
  })
  .when(Joi.object({ type: 'add-to-string' }).unknown(), {
    then: Joi.object({ prefix: Joi.string().allow('').required(), suffix: Joi.string().allow('').required() })
  })
  .when(Joi.object({ type: 'replace' }).unknown(), {
    then: Joi.object({ search: Joi.string().allow('').required(), replacement: Joi.string().allow('').required() })
  })
  .when(Joi.object({ type: 'number-operation' }).unknown(), {
    then: Joi.object({
      operator: Joi.string()
        .valid(...FIELD_NUMBER_OPERATORS)
        .required(),
      operand: Joi.number().required()
    })
  })
  .when(Joi.object({ type: 'round' }).unknown(), {
    then: Joi.object({ decimals: Joi.number().integer().min(0).required() })
  })
  .when(Joi.object({ type: 'datetime' }).unknown(), {
    then: Joi.object({
      inputType: datetimeTypes,
      inputTimezone: Joi.string(),
      inputFormat: Joi.string(),
      inputLocale: Joi.string(),
      outputType: datetimeTypes,
      outputTimezone: Joi.string(),
      outputFormat: Joi.string(),
      outputLocale: Joi.string(),
      precision: Joi.string().valid(...FIELD_DATETIME_PRECISIONS)
    })
  })
  .when(Joi.object({ type: 'expression' }).unknown(), {
    then: Joi.object({ expression: Joi.string().required() })
  });

/** The operations of a field process, as a transformer setting or a field process of a configuration workflow. */
export const FIELD_OPERATIONS_SCHEMA = Joi.array().items(fieldOperation);

/** What the operations of a field process return, as a value a record can hold: an object or an array as JSON text. */
export function toRecordFieldValue(value: unknown): RecordFieldValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}

/** Tests the operations of a field process on values, as they are applied - but with each failure told. */
export function testFieldOperations(operations: Array<FieldOperation>, values: Array<RecordFieldValue>): Array<FieldProcessTestResultDTO> {
  return values.map(value => {
    if (value === null || value === undefined) {
      return { value: null, result: null, error: null };
    }
    try {
      return { value, result: toRecordFieldValue(applyFieldOperations(value, operations)), error: null };
    } catch (error: unknown) {
      return { value, result: null, error: (error as Error).message };
    }
  });
}
