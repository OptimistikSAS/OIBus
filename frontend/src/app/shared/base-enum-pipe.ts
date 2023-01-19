/**
 * Base class for enum pipes
 */
import { TranslateService } from '@ngx-translate/core';
import { PipeTransform } from '@angular/core';

export class BaseEnumPipe<E> implements PipeTransform {
  constructor(private translateService: TranslateService, private enumName: string) {}

  transform(value: E) {
    return value !== null ? this.translateService.instant(`enums.${this.enumName}.${value}`) : '';
  }
}
