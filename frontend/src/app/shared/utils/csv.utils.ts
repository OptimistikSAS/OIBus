import csv from 'papaparse';
import { CsvCharacter } from '../../../../../backend/shared/model/types';
import { OIBusArrayAttribute, OIBusAttribute, OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { OIBusValidationError } from '../../../../../backend/src/model/types';

export const convertCsvDelimiter = (delimiter: CsvCharacter): string => {
  switch (delimiter) {
    case 'DOT':
      return '.';
    case 'SEMI_COLON':
      return ';';
    case 'COLON':
      return ':';
    case 'COMMA':
      return ',';
    case 'SLASH':
      return '/';
    case 'TAB':
      return '  ';
    case 'NON_BREAKING_SPACE':
      return ' ';
    case 'PIPE':
      return '|';
  }
};

export const exportArrayElements = (arrayAttribute: OIBusArrayAttribute, elements: Array<Record<string, any>>, delimiter: string): Blob => {
  const columns: Set<string> = new Set<string>();
  const flattenedElements: Array<Record<string, string | object | boolean>> = [];
  for (const element of elements) {
    const flattenedElement: Record<string, string | object | boolean> = {};
    flattenObject(element, arrayAttribute.rootAttribute, flattenedElement, []);
    for (const key of Object.keys(flattenedElement)) {
      columns.add(key);
    }
    flattenedElements.push(flattenedElement);
  }
  return new Blob([csv.unparse(flattenedElements, { columns: Array.from(columns), delimiter })], { type: 'text/csv' });
};

const joinAttributeKey = (prefix: Array<string>, key: string): string => [...prefix, key].filter(Boolean).join('_');

const flattenObject = (
  obj: Record<string, unknown>,
  attribute: OIBusObjectAttribute,
  flattened: Record<string, unknown>,
  prefix: Array<string>
): void => {
  if (attribute.type !== 'object' || !attribute.attributes) {
    return;
  }

  for (const subAttribute of attribute.attributes) {
    const key = subAttribute.key;
    if (key === undefined) {
      continue;
    }

    const value = obj[key];
    if (value === undefined || value === null) {
      continue;
    }

    const fullKey = joinAttributeKey(prefix, key);

    switch (subAttribute.type) {
      case 'object':
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          flattened[fullKey] = JSON.stringify(value);
        } else {
          flattened[fullKey] = value;
        }
        break;
      case 'array':
        flattened[fullKey] = JSON.stringify(value);
        break;
      case 'boolean':
      case 'number':
      case 'string':
      case 'code':
      case 'string-select':
      case 'secret':
      case 'timezone':
      case 'instant':
      case 'scan-mode':
      case 'certificate':
        flattened[fullKey] = typeof value === 'object' ? JSON.stringify(value) : value;
        break;
      default:
        flattened[fullKey] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
  }
};

const unflattenObject = (
  flattened: Record<string, unknown>,
  attribute: OIBusObjectAttribute,
  prefix: Array<string> = []
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  if (attribute.type !== 'object' || !Array.isArray(attribute.attributes)) {
    return result;
  }

  for (const subAttributeUnknown of attribute.attributes) {
    const subAttribute = subAttributeUnknown as OIBusAttribute;
    const key = subAttribute.key;
    if (key === undefined) {
      continue;
    }

    const fullKey = joinAttributeKey(prefix, key);
    const value = flattened[fullKey];

    switch (subAttribute.type) {
      case 'object': {
        result[key] = JSON.parse(value as string);
        break;
      }
      case 'array':
        result[key] = parseArrayValue(value, fullKey);
        break;
      case 'boolean':
        if (value !== undefined && value !== '') {
          result[key] = stringToBoolean(String(value));
        }
        break;
      case 'number':
        if (value !== undefined && value !== '') {
          const parsedNumber = Number(value);
          if (Number.isNaN(parsedNumber)) {
            throw new OIBusValidationError(`Invalid number value "${value}" for "${fullKey}"`);
          }
          result[key] = parsedNumber;
        }
        break;
      case 'string':
      case 'code':
      case 'string-select':
      case 'secret':
      case 'timezone':
      case 'instant':
      case 'scan-mode':
      case 'certificate':
        if (value !== undefined) {
          result[key] = String(value);
        }
        break;
      default:
        if (value !== undefined) {
          result[key] = value;
        }
    }
  }

  return result;
};

const parseArrayValue = (rawValue: unknown, key: string): Array<unknown> => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        throw new Error(`Value ${rawValue} is not an array`);
      }
      return parsed;
    } catch {
      throw new OIBusValidationError(`Invalid array value for "${key}": ${rawValue}`);
    }
  }

  throw new OIBusValidationError(`Invalid array value for "${key}"`);
};

export const validateArrayElementsImport = async (
  file: File,
  delimiter: string,
  arrayAttribute: OIBusArrayAttribute,
  existingElements: Array<Record<string, unknown>> = []
): Promise<{
  elements: Array<Record<string, unknown>>;
  errors: Array<{ element: Record<string, string>; error: string }>;
}> => {
  const csvContent = await file.text();

  const csvData = csv.parse(csvContent, { header: true, delimiter, skipEmptyLines: true });

  if (csvData.meta.delimiter !== delimiter) {
    throw new OIBusValidationError(
      `The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvData.meta.delimiter}"`
    );
  }

  const validElements: Array<Record<string, unknown>> = [];
  const errors: Array<{ element: Record<string, string>; error: string }> = [];

  const existingElementNames = new Set(existingElements.map(element => getElementName(element)).filter(name => name));
  const seenElementNames = new Set<string>();

  for (const [index, data] of csvData.data.entries()) {
    try {
      const element = unflattenObject(data as Record<string, unknown>, arrayAttribute.rootAttribute);

      const elementName = getElementName(element);
      if (elementName) {
        if (seenElementNames.has(elementName)) {
          errors.push({
            element: data as Record<string, string>,
            error: `Row ${index + 1}: Duplicate element name "${elementName}" found in CSV file`
          });
          continue;
        }
        seenElementNames.add(elementName);

        // Check against existing elements
        if (existingElementNames.has(elementName)) {
          errors.push({
            element: data as Record<string, string>,
            error: `Row ${index + 1}: Element name "${elementName}" already exists in the array`
          });
          continue;
        }
      }

      validElements.push(element);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        element: data as Record<string, string>,
        error: `Row ${index + 1}: ${errorMessage}`
      });
    }
  }

  return { elements: validElements, errors };
};

export const getElementName = (element: Record<string, unknown>): string => {
  const nameKeys = ['name', 'id', 'key', 'title', 'fieldName'];
  for (const key of nameKeys) {
    if (element[key] && typeof element[key] === 'string') {
      return element[key] as string;
    }
  }
  for (const [, value] of Object.entries(element)) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
};

export const findArrayAttributeInAttributes = (arrayKey: string, attributes: Array<OIBusAttribute>): OIBusArrayAttribute | null => {
  for (const attribute of attributes) {
    if (!attribute) {
      continue;
    }

    if (attribute.key === arrayKey) {
      if (attribute.type !== 'array') {
        throw new OIBusValidationError(`Field "${arrayKey}" is not an array`);
      }
      return attribute as OIBusArrayAttribute;
    }

    if (attribute.type === 'object' && 'attributes' in attribute && Array.isArray(attribute.attributes)) {
      const nested = findArrayAttributeInAttributes(arrayKey, attribute.attributes as Array<OIBusAttribute>);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

const stringToBoolean = (value: string): boolean => {
  if (['true', 'True', 'TRUE', '1'].includes(value)) return true;
  if (['false', 'False', 'FALSE', '0'].includes(value)) return false;
  return false;
};
