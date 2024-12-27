import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { Aggregate } from '../../../../backend/shared/model/types';

@Pipe({
  name: 'aggregatesEnum',
  pure: false
})
export class AggregatesEnumPipe extends BaseEnumPipe<Aggregate> implements PipeTransform {
  constructor() {
    super('aggregates');
  }
}
