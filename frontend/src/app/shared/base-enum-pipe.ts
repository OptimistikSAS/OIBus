/**
 * Base class for enum pipes
 */
import { inject, PipeTransform } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

export class BaseEnumPipe<E> implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  constructor(private readonly enumName: string) {}

  transform(value: E | null): string {
    return value !== null ? this.translateService.instant(`enums.${this.enumName}.${value}`) : '';
  }
}
