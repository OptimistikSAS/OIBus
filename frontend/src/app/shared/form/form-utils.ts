import { TranslateService } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { FieldOperation } from '@oibus/shared/connector/field-process.model';
import { OIBusAttribute, OIBusAttributeType } from '@oibus/shared/connector/form.model';

import { isDisplayableAttribute } from './dynamic-form.builder';

export interface Column {
  path: Array<string>;
  type: OIBusAttributeType;
  translationKey: string;
}

/** The operations of a field process, by their names in order - empty without operation */
export function summarizeFieldOperations(operations: Array<FieldOperation> | null, translateService: TranslateService): string {
  return (operations ?? []).map(operation => translateService.instant(`field-process.operation.${operation.type}`)).join(' → ');
}

export class FormUtils {
  static buildColumn(attributes: Array<OIBusAttribute>, prefix: Array<string>): Array<Column> {
    return attributes
      .filter(
        attribute => attribute.type === 'object' || (isDisplayableAttribute(attribute) && attribute.displayProperties.displayInViewMode)
      )
      .map(attribute => {
        switch (attribute.type) {
          case 'scan-mode':
          case 'certificate':
          case 'timezone':
          case 'boolean':
          case 'instant':
          case 'number':
          case 'secret':
          case 'string':
          case 'code':
          case 'string-select':
          case 'field-process':
            return [{ path: [...prefix, attribute.key], type: attribute.type, translationKey: attribute.translationKey }];
          case 'object':
            return this.buildColumn(attribute.attributes, [...prefix, attribute.key]);
          case 'array':
            return [];
        }
      })
      .flat();
  }

  static formatValue(
    element: Record<string, unknown>,
    path: Array<string>,
    type: OIBusAttributeType,
    translationKey: string,
    translateService: TranslateService,
    scanModes: Array<ScanModeDTO>
  ) {
    const value = this.getValueByPath(element, path);
    if (value === undefined) {
      return '';
    }
    switch (type) {
      case 'object':
      case 'array':
        return '';
      case 'string-select':
        return translateService.instant(`${translationKey}.${value}`);
      case 'number':
      case 'code':
      case 'string':
      case 'timezone':
      case 'instant':
        return value;
      case 'boolean':
        return translateService.instant(`enums.boolean.${value}`);
      case 'scan-mode':
        return scanModes.find(scanMode => scanMode.id === value)?.name;
      case 'field-process':
        return summarizeFieldOperations(value as Array<FieldOperation> | null, translateService);
    }
  }

  static getValueByPath(obj: unknown, path: Array<string>): unknown {
    return path.reduce<unknown>((acc, key) => acc && (acc as Record<string, unknown>)[key], obj);
  }
}
