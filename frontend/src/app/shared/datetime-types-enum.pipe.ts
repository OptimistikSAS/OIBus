import { Pipe, PipeTransform, inject } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { DateTimeType } from '../../../../shared/model/types';

@Pipe({
  name: 'datetimeTypesEnum',
  pure: false,
  standalone: true
})
export class DatetimeTypesEnumPipe extends BaseEnumPipe<DateTimeType> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'datetime-types');
  }
}
