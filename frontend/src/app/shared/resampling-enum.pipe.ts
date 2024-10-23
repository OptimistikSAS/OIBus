import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { Resampling } from '../../../../backend/shared/model/types';

@Pipe({
  name: 'resamplingEnum',
  pure: false,
  standalone: true
})
export class ResamplingEnumPipe extends BaseEnumPipe<Resampling> implements PipeTransform {
  constructor() {
    super('resampling');
  }
}
