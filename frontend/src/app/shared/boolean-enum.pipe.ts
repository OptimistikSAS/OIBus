import { Pipe, PipeTransform, inject } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'booleanEnum',
  standalone: true,
  pure: false
})
export class BooleanEnumPipe extends BaseEnumPipe<boolean> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'boolean');
  }
}
