import { Pipe, PipeTransform } from '@angular/core';

import { OIBusNorthCategory } from '@oibus/shared/connector/north-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusNorthCategoryEnum',
  pure: false
})
export class OIBusNorthCategoryEnumPipe extends BaseEnumPipe<OIBusNorthCategory> implements PipeTransform {
  constructor() {
    super('oibus-north-category');
  }
}
