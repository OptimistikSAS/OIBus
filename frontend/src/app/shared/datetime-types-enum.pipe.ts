import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { DateTimeType } from '../../../../shared/model/types';

@Pipe({
  name: 'datetimeTypesEnum',
  pure: false,
  standalone: true
})
export class DatetimeTypesEnumPipe extends BaseEnumPipe<DateTimeType> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'datetime-types');
  }
}
