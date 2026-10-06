/**
 * Base class for enum pipes
 */
import { inject, PipeTransform } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

export class BaseEnumPipe<E> implements PipeTransform {
  private translateService = inject(TranslateService);

  constructor(private enumName: string) {}

  transform(value: E) {
    return value !== null ? this.translateService.instant(`enums.${this.enumName}.${value}`) : '';
  }
}
