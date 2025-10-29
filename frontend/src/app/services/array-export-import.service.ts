import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OIBusArrayAttribute, OIBusObjectAttribute } from '../../../../backend/shared/model/form.model';
import * as Papa from 'papaparse';

@Injectable({
  providedIn: 'root'
})
export class ArrayExportImportService {
  private http = inject(HttpClient);

  exportArray(southId: string, arrayKey: string, delimiter: string): Observable<Blob> {
    return this.http.put(`/api/south/${southId}/array/${arrayKey}/export`, { delimiter, arrayKey }, { responseType: 'blob' });
  }

  checkImportArray(
    southId: string,
    arrayKey: string,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<Record<string, any>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('delimiter', delimiter);
    formData.set('arrayKey', arrayKey);

    return this.http.post<{
      items: Array<Record<string, any>>;
      errors: Array<{ item: Record<string, string>; error: string }>;
    }>(`/api/south/${southId}/array/${arrayKey}/check-import`, formData);
  }

  importArray(southId: string, arrayKey: string, items: Array<Record<string, any>>): Observable<void> {
    const formData = new FormData();
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }));
    formData.set('arrayKey', arrayKey);

    return this.http.post<void>(`/api/south/${southId}/array/${arrayKey}/import`, formData);
  }

  exportArrayToCSV(arrayData: Array<Record<string, any>>, delimiter: string, arrayAttribute: OIBusArrayAttribute): string {
    const columns: Set<string> = new Set<string>();
    const flattenedItems: Array<Record<string, any>> = [];

    for (const item of arrayData) {
      const flattenedItem: Record<string, any> = {};
      this.flattenObject(item, arrayAttribute.rootAttribute, flattenedItem, []);

      // Collect all column names
      for (const key of Object.keys(flattenedItem)) {
        columns.add(key);
      }

      flattenedItems.push(flattenedItem);
    }

    return Papa.unparse(flattenedItems, { columns: Array.from(columns), delimiter });
  }

  validateAndImportCSV(
    file: File,
    delimiter: string,
    arrayAttribute: OIBusArrayAttribute
  ): Observable<{
    items: Array<Record<string, any>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const csvContent = e.target?.result as string;
          const result = this.validateArrayCSVImport(csvContent, delimiter, arrayAttribute);
          observer.next(result);
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      };
      reader.onerror = () => observer.error(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private validateArrayCSVImport(
    csvContent: string,
    delimiter: string,
    arrayAttribute: OIBusArrayAttribute
  ): {
    items: Array<Record<string, any>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  } {
    const csvData = Papa.parse(csvContent, { header: true, delimiter, skipEmptyLines: true });

    if (csvData.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvData.meta.delimiter}"`);
    }

    const validItems: Array<Record<string, any>> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];

    for (const [index, data] of csvData.data.entries()) {
      try {
        const item = this.unflattenObject(data as Record<string, any>, arrayAttribute.rootAttribute);
        validItems.push(item);
      } catch (error) {
        errors.push({
          item: data as Record<string, string>,
          error: `Row ${index + 1}: ${(error as Error).message}`
        });
      }
    }

    return { items: validItems, errors };
  }

  private unflattenObject(flattened: Record<string, any>, attribute: OIBusObjectAttribute): Record<string, any> {
    const result: Record<string, any> = {};

    if (attribute.type === 'object' && attribute.attributes) {
      for (const subAttribute of attribute.attributes) {
        const key = subAttribute.key;

        if (subAttribute.type === 'object') {
          if (key !== undefined) {
            result[key] = this.unflattenObject(flattened, subAttribute);
          }
        } else {
          if (key !== undefined) {
            const value = flattened[key];
            if (value !== undefined) {
              // Handle type conversion based on attribute type
              switch (subAttribute.type) {
                case 'boolean':
                  result[key] = this.stringToBoolean(value as string);
                  break;
                case 'number':
                  result[key] = Number(value);
                  break;
                case 'string':
                case 'code':
                case 'string-select':
                case 'secret':
                case 'timezone':
                case 'instant':
                case 'scan-mode':
                case 'certificate':
                  result[key] = String(value);
                  break;
                default:
                  result[key] = value;
              }
            }
          }
        }
      }
    }

    return result;
  }

  private stringToBoolean(value: string): boolean {
    if (['true', 'True', 'TRUE', '1'].includes(value)) return true;
    if (['false', 'False', 'FALSE', '0'].includes(value)) return false;
    return false;
  }

  private flattenObject(
    obj: Record<string, any>,
    attribute: OIBusObjectAttribute,
    flattened: Record<string, any>,
    prefix: Array<string>
  ): void {
    if (attribute.type === 'object' && attribute.attributes) {
      for (const subAttribute of attribute.attributes) {
        const key = subAttribute.key;
        const value = obj[key];

        if (value !== undefined) {
          const fullKey = [...prefix, key].join('_');

          if (subAttribute.type === 'object') {
            if (value && typeof value === 'object') {
              this.flattenObject(value as Record<string, any>, subAttribute, flattened, [...prefix, key]);
            }
          } else {
            if (typeof value === 'object' && value !== null) {
              flattened[fullKey] = JSON.stringify(value);
            } else {
              flattened[fullKey] = value;
            }
          }
        }
      }
    }
  }
}
