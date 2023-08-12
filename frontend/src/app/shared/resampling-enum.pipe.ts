import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { Resampling } from '../../../../shared/model/types';

@Pipe({
  name: 'resamplingEnum',
  pure: false,
  standalone: true
})
export class ResamplingEnumPipe extends BaseEnumPipe<Resampling> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'resampling');
  }
}
