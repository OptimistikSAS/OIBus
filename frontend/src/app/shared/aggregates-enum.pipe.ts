import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { Aggregate } from '../../../../shared/model/types';

@Pipe({
  name: 'aggregatesEnum',
  pure: false,
  standalone: true
})
export class AggregatesEnumPipe extends BaseEnumPipe<Aggregate> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'aggregates');
  }
}
