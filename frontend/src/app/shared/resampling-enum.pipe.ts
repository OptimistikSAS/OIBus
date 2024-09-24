import { Pipe, PipeTransform, inject } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { Resampling } from '../../../../shared/model/types';

@Pipe({
  name: 'resamplingEnum',
  pure: false,
  standalone: true
})
export class ResamplingEnumPipe extends BaseEnumPipe<Resampling> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'resampling');
  }
}
