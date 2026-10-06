import { Pipe, PipeTransform } from '@angular/core';

import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusNorthTypeEnum',
  pure: false
})
export class OIBusNorthTypeEnumPipe extends BaseEnumPipe<OIBusNorthType> implements PipeTransform {
  constructor() {
    super('oibus-north-type');
  }
}
