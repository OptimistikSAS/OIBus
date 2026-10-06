import { Pipe, PipeTransform } from '@angular/core';

import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusSouthTypeEnum',
  pure: false
})
export class OIBusSouthTypeEnumPipe extends BaseEnumPipe<OIBusSouthType> implements PipeTransform {
  constructor() {
    super('oibus-south-type');
  }
}
