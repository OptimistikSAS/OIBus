import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusSouthCategory } from '@oibus/shared/south-connector.model';

@Pipe({
  name: 'oIBusSouthCategoryEnum',
  pure: false
})
export class OIBusSouthCategoryEnumPipe extends BaseEnumPipe<OIBusSouthCategory> implements PipeTransform {
  constructor() {
    super('oibus-south-category');
  }
}
