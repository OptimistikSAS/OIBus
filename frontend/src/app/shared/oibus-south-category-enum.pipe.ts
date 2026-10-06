import { Pipe, PipeTransform } from '@angular/core';

import { OIBusSouthCategory } from '@oibus/shared/connector/south-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusSouthCategoryEnum',
  pure: false
})
export class OIBusSouthCategoryEnumPipe extends BaseEnumPipe<OIBusSouthCategory> implements PipeTransform {
  constructor() {
    super('oibus-south-category');
  }
}
