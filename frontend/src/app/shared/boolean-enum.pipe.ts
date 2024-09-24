import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'booleanEnum',
  standalone: true,
  pure: false
})
export class BooleanEnumPipe extends BaseEnumPipe<boolean> implements PipeTransform {
  constructor() {
    super('boolean');
  }
}
