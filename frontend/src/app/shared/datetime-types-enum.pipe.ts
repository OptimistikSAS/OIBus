import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { DateTimeType } from '../../../../backend/shared/model/types';

@Pipe({
  name: 'datetimeTypesEnum',
  pure: false,
  standalone: true
})
export class DatetimeTypesEnumPipe extends BaseEnumPipe<DateTimeType> implements PipeTransform {
  constructor() {
    super('datetime-types');
  }
}
